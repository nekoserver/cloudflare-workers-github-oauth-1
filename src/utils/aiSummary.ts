export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

export function resolveAiModel(envValue: string | undefined): string {
  return envValue?.trim() || DEFAULT_AI_MODEL;
}

export type AiBinding = {
  run(model: string, input: { messages: { role: string; content: string }[] }): Promise<unknown>;
};

export type FetchDiffParams = {
  diffUrl: string;
  githubToken: string;
};

export type FetchDiffResult = {
  trimmedDiff: string;
  diffLength: number;
};

export async function fetchPrDiff(
  params: FetchDiffParams
): Promise<FetchDiffResult> {
  const { diffUrl, githubToken } = params;

  const diffRes = await fetch(diffUrl, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3.diff',
      'User-Agent': 'cloudflare-workers-github-oauth-1',
    },
  });

  if (!diffRes.ok) {
    const errorBody = await diffRes.text().catch(() => '');
    throw new Error(
      `Diff fetch failed: ${diffRes.status} ${diffRes.statusText} ${errorBody.slice(0, 500)}`
    );
  }

  const diff = await diffRes.text();
  return {
    diffLength: diff.length,
    trimmedDiff: diff.slice(0, 8000),
  };
}

export type GenerateSummaryParams = {
  ai: AiBinding;
  model: string;
  title: string;
  description: string;
  trimmedDiff: string;
};

export async function generateAiSummary(
  params: GenerateSummaryParams
): Promise<string> {
  const { ai, model, title, description, trimmedDiff } = params;

  const userParts: string[] = [];
  userParts.push(`PRタイトル:\n${title}`);
  userParts.push(`説明:\n${description}`);
  if (trimmedDiff) {
    userParts.push(`差分:\n${trimmedDiff}`);
  }
  userParts.push(
    '以下の形式で日本語で出力してください:\n- 概要\n- 主な変更点\n- 影響範囲'
  );

  const aiRes = await ai.run(model, {
    messages: [
      {
        role: 'system',
        content:
          'あなたはコードレビュー支援AIです。プルリクエストの変更点・目的・影響範囲を日本語で簡潔にまとめてください。',
      },
      {
        role: 'user',
        content: userParts.join('\n\n'),
      },
    ],
  });

  if (aiRes && typeof aiRes === 'object' && 'response' in aiRes) {
    const raw = (aiRes as { response: string }).response;
    if (raw) {
      return raw;
    }
    return `[AI_EMPTY_RESPONSE] keys=${Object.keys(aiRes).join(',')} response=${JSON.stringify(raw)}`;
  }

  return `[AI_UNEXPECTED_FORMAT] type=${typeof aiRes} value=${JSON.stringify(aiRes).slice(0, 500)}`;
}

export type SummaryDiagnosis = {
  rating: 'good' | 'bad';
  hasSummary: boolean;
  comment: string;
};

export function classifySummaryResult(summary: string | null): SummaryDiagnosis {
  if (summary === null || summary === undefined) {
    return { rating: 'bad', hasSummary: false, comment: '要約が生成されなかった（AIバインディング未設定の可能性）' };
  }
  if (summary === '') {
    return { rating: 'bad', hasSummary: false, comment: '要約が空で返された' };
  }
  if (summary.startsWith('[AI_ERROR]')) {
    return { rating: 'bad', hasSummary: false, comment: `AI_ERROR: ${summary}` };
  }
  if (summary.startsWith('[AI_EMPTY_RESPONSE]')) {
    return { rating: 'bad', hasSummary: false, comment: `AI_EMPTY_RESPONSE: ${summary}` };
  }
  if (summary.startsWith('[AI_UNEXPECTED_FORMAT]')) {
    return { rating: 'bad', hasSummary: false, comment: `AI_UNEXPECTED_FORMAT: ${summary}` };
  }

  return { rating: 'good', hasSummary: true, comment: summary };
}

export type RunSummaryPipelineParams = {
  ai: AiBinding | null | undefined;
  model: string;
  title: string;
  description: string;
  trimmedDiff: string;
};

export type SummaryPipelineResult = {
  summary: string;
  success: boolean;
};

export async function runSummaryPipeline(
  params: RunSummaryPipelineParams
): Promise<SummaryPipelineResult> {
  const { ai, model, title, description, trimmedDiff } = params;

  if (!ai) {
    return { summary: '[AI_NO_BINDING] Workers AI binding is not available', success: false };
  }

  try {
    const summary = await generateAiSummary({ ai, model, title, description, trimmedDiff });
    return { summary, success: !summary.startsWith('[AI_') };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { summary: `[AI_ERROR] ${msg}`, success: false };
  }
}

export type BuildSlackMessageParams = {
  prAction: string;
  prNumber: number;
  title: string;
  repoFullName: string;
  author: string;
  prUrl: string;
  summary: string;
  dailySeq: number;
  requestId: string;
  workerBaseUrl: string;
};

export function buildSlackMessage(params: BuildSlackMessageParams): string {
  const {
    prAction,
    prNumber,
    title,
    repoFullName,
    author,
    prUrl,
    summary,
    dailySeq,
    requestId,
    workerBaseUrl,
  } = params;

  const lines = [
    `*PR ${prAction === 'opened' ? '作成' : '更新'}:* #${prNumber} ${title}`,
    `リポジトリ: ${repoFullName}`,
    `作成者: ${author}`,
    prUrl,
  ];
  if (summary && !summary.startsWith('[AI_')) {
    const quoted = summary.split('\n').map(line => `> ${line}`).join('\n');
    lines.push('', '*AI要約:*', quoted);
  }

  const idDisplay = workerBaseUrl
    ? `<${workerBaseUrl}/api/ai-summary/${requestId}|${requestId}>`
    : requestId;
  lines.push('', `_AI問い合わせ #${dailySeq} (本日) | ID: ${idDisplay}_`);

  return lines.join('\n');
}
