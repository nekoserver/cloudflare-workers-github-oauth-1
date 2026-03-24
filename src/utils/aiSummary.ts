export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

export const DESIGN_SPEC_CHECKLIST = [
  'GitHub OAuth 2.0 + JWT認証',
  'D1セッション管理 (user_sessions)',
  'Resend webhook受信・オリジン通知・Slack通知',
  'GitHub App Webhook受信・D1権限保存',
  'セキュリティSlack通知 (JWT検証失敗・OAuth失敗・App変更)',
  'リポジトリ一覧・権限モーダル・Zanzibar表示',
  'コミットヒートマップカレンダー・D1キャッシュ',
  'キャッシュ状況ページ (/status)',
  'チーム・ワークスペースによるマルチテナント分離',
  'ナイトモード (ダークテーマ)',
  '別アカウントでログイン機能',
  'コミット詳細モーダル・コミット一覧ページネーション',
  'Markdownプレビューページ (/md-preview)',
  'AI要約パイプライン (Workers AI)',
].join('\n');

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
  designSpec?: string;
};

export async function generateAiSummary(
  params: GenerateSummaryParams
): Promise<string> {
  const { ai, model, title, description, trimmedDiff, designSpec } = params;

  const userParts: string[] = [];
  userParts.push(`PRタイトル:\n${title}`);
  userParts.push(`説明:\n${description}`);
  if (trimmedDiff) {
    userParts.push(`差分:\n${trimmedDiff}`);
  }
  if (designSpec) {
    userParts.push(`初期設計チェックリスト:\n${designSpec}`);
    userParts.push(
      '以下の形式で日本語で出力してください:\n- 概要\n- 主な変更点\n- 影響範囲\n- 初期設計との差異（達成/進行中/変更/中止の状態と達成数を「N/M件達成」形式で記載）'
    );
  } else {
    userParts.push(
      '以下の形式で日本語で出力してください:\n- 概要\n- 主な変更点\n- 影響範囲'
    );
  }

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
  designSpec?: string;
};

export type SummaryPipelineResult = {
  summary: string;
  success: boolean;
};

export async function runSummaryPipeline(
  params: RunSummaryPipelineParams
): Promise<SummaryPipelineResult> {
  const { ai, model, title, description, trimmedDiff, designSpec } = params;

  if (!ai) {
    return { summary: '[AI_NO_BINDING] Workers AI binding is not available', success: false };
  }

  try {
    const summary = await generateAiSummary({ ai, model, title, description, trimmedDiff, designSpec });
    return { summary, success: !summary.startsWith('[AI_') };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { summary: `[AI_ERROR] ${msg}`, success: false };
  }
}

export type ExtractedSummary = {
  summary: string;
  designDiff: string;
};

export function extractDesignDiff(rawSummary: string): ExtractedSummary {
  const marker = /[-#*]*\s*初期設計との差異/;
  const match = rawSummary.match(marker);
  if (!match || match.index === undefined) {
    return { summary: rawSummary, designDiff: '' };
  }
  const summary = rawSummary.slice(0, match.index).trimEnd();
  const designDiff = rawSummary.slice(match.index + match[0].length).trim();
  return { summary, designDiff };
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
  designDiff?: string;
  workerBaseUrl?: string;
};

export type SlackMessagePayload = {
  text: string;
  blocks: Record<string, unknown>[];
};

export function buildSlackMessage(params: BuildSlackMessageParams): SlackMessagePayload {
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
    designDiff,
    workerBaseUrl,
  } = params;

  const actionLabel = prAction === 'opened' ? '作成' : '更新';
  const hasSummary = summary !== '' && !summary.startsWith('[AI_');
  const hasDesignDiff = !!designDiff;

  const textLines = [
    `*PR ${actionLabel}:* #${prNumber} ${title}`,
    `リポジトリ: ${repoFullName}`,
    `作成者: ${author}`,
    prUrl,
  ];
  if (hasSummary) {
    textLines.push('', '*AI要約:*', summary);
  }
  if (hasDesignDiff) {
    textLines.push('', '*初期設計との差異:*', designDiff);
  }
  textLines.push('', `_AI問い合わせ #${dailySeq} (本日) | ID: ${requestId}_`);
  const text = textLines.join('\n');

  const blocks: Record<string, unknown>[] = [];

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*PR ${actionLabel}:* #${prNumber} ${title}\nリポジトリ: ${repoFullName}\n作成者: ${author}\n${prUrl}`,
    },
  });

  if (hasSummary) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*AI要約:*\n\`\`\`\n${summary}\n\`\`\``,
      },
    });

  }

  if (hasDesignDiff) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*初期設計との差異:*\n\`\`\`\n${designDiff}\n\`\`\``,
      },
    });
  }

  const contextElements: Record<string, unknown>[] = [
    {
      type: 'mrkdwn',
      text: `AI問い合わせ #${dailySeq} (本日) | ID: ${requestId}`,
    },
  ];
  if (hasSummary && workerBaseUrl) {
    contextElements.push({
      type: 'mrkdwn',
      text: `<${workerBaseUrl}/ai-summary/${requestId}|詳細を見る>`,
    });
  }
  blocks.push({
    type: 'context',
    elements: contextElements,
  });

  return { text, blocks };
}

export type SummaryModalRow = {
  request_id: string;
  daily_seq: number;
  event_date: string;
  repo_full_name: string | null;
  pr_number: number | null;
  pr_action: string | null;
  pr_url: string | null;
  model: string | null;
  summary: string | null;
  diff_length: number | null;
  created_at: string;
};

export type SlackModalView = {
  type: 'modal';
  title: { type: 'plain_text'; text: string };
  blocks: Record<string, unknown>[];
};

export function buildSummaryModal(row: SummaryModalRow): SlackModalView {
  const blocks: Record<string, unknown>[] = [];

  const prLabel = row.pr_number
    ? (row.pr_url ? `<${row.pr_url}|PR #${row.pr_number}>` : `PR #${row.pr_number}`)
    : '(不明)';

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*リポジトリ:*\n${row.repo_full_name ?? '(不明)'}` },
      { type: 'mrkdwn', text: `*PR:*\n${prLabel}` },
      { type: 'mrkdwn', text: `*モデル:*\n${row.model ?? '(不明)'}` },
      { type: 'mrkdwn', text: `*Diff長:*\n${row.diff_length ?? 0} 文字` },
    ],
  });

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*日時:*\n${row.created_at}` },
      { type: 'mrkdwn', text: `*日次番号:*\n#${row.daily_seq} (${row.event_date})` },
    ],
  });

  blocks.push({ type: 'divider' });

  const isNullSummary = row.summary === null || row.summary === undefined;
  const isDiffEmpty = !row.diff_length || row.diff_length === 0;
  let summaryDisplay: string;
  if (isNullSummary && isDiffEmpty) {
    summaryDisplay = '(要約なし)\n\n_差分を取得できなかったため、AI要約は生成されませんでした。_';
  } else if (isNullSummary) {
    summaryDisplay = '(要約なし)';
  } else {
    summaryDisplay = row.summary!;
  }
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*AI要約:*\n${summaryDisplay}`,
    },
  });

  blocks.push({ type: 'divider' });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        '*テーブル関連一覧:*',
        '```',
        'Table              | Key Columns',
        '-------------------+--------------------------------',
        'ai_summary_log     | request_id (UNIQUE, PK)',
        '  Columns:         | daily_seq, event_date,',
        '                   | repo_full_name, pr_number,',
        '                   | pr_action, pr_url, model,',
        '                   | summary, diff_length,',
        '                   | slack_notified, resolved,',
        '                   | resolved_at, resolution_note,',
        '                   | view_count, parent_id, tags,',
        '                   | created_at',
        '',
        'ai_summary_reviews | summary_request_id (FK)',
        '  FK:              | -> ai_summary_log.request_id',
        '  Columns:         | rating, reviewer_type,',
        '                   | reviewer_name, review_model,',
        '                   | comment, created_at',
        '```',
      ].join('\n'),
    },
  });

  return {
    type: 'modal',
    title: { type: 'plain_text', text: '要約を表示' },
    blocks,
  };
}

export function buildSummaryFallbackBlocks(row: SummaryModalRow): { text: string; blocks: Record<string, unknown>[] } {
  const prLabel = row.pr_number
    ? (row.pr_url ? `<${row.pr_url}|PR #${row.pr_number}>` : `PR #${row.pr_number}`)
    : '(不明)';

  const isNullSummary = row.summary === null || row.summary === undefined;
  const isDiffEmpty = !row.diff_length || row.diff_length === 0;
  let summaryDisplay: string;
  if (isNullSummary && isDiffEmpty) {
    summaryDisplay = '(要約なし — 差分を取得できなかったため生成されませんでした)';
  } else if (isNullSummary) {
    summaryDisplay = '(要約なし)';
  } else {
    summaryDisplay = row.summary!;
  }

  const lines = [
    `*AI要約詳細* (${prLabel})`,
    `リポジトリ: ${row.repo_full_name ?? '(不明)'}`,
    `モデル: ${row.model ?? '(不明)'} / Diff長: ${row.diff_length ?? 0}文字`,
    `日時: ${row.created_at} / #${row.daily_seq} (${row.event_date})`,
    '',
    '```',
    summaryDisplay,
    '```',
  ];
  const text = lines.join('\n');

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];

  return { text, blocks };
}
