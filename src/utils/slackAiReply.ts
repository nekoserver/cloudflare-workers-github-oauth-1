import { stripThinkTags } from './stripThinkTags';
import { AICHAT_MODEL_MAX_TOKENS, getModelRunParams } from './aichatModelConfig';
import { extractAiUsage } from './aiUsage';

export type AiRunFn = (model: string, params: Record<string, unknown>) => Promise<unknown>;

export type AiUsage = {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};

export type SlackAiReplyResult =
  | { ok: true; text: string; usedModel: string; usage: AiUsage }
  | { ok: false; error: string };

/**
 * Slack @メンションAI応答の既定モデル。gemma-4-26b-a4b-itはsystem messageが
 * 含まれるとthinking modeを強制するバグがあるため(aichatModelConfig.ts参照)、
 * system roleを使わずuser roleのみでメッセージを組み立てる(buildSlackAiMessages)。
 */
export const SLACK_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Slack応答のmax_tokens上限。AICHAT_MODEL_MAX_TOKENSはAIチャットページでの
 * 対話的な利用を想定した値(gemma-4-26b-a4b-itは65536)だが、Slackへの返信は
 * 短い会話メッセージであるべきで、この上限をそのまま使うと極端に長い(数十万文字規模の)
 * 応答が生成され得る。そのような巨大な応答はai_chat_sharesに保存された後、
 * AIチャットページの検索結果からその履歴を開いた際にクライアント側のMarkdown
 * パーサー・キーワードハイライト処理が長時間かかりページがフリーズする原因になるため、
 * Slack応答はより小さい上限に丸める。
 */
const SLACK_MAX_TOKENS = 4096;

const SLACK_RESPONSE_INSTRUCTION =
  '日本語で、Markdown記法(見出し・箇条書き・強調など)を使って分かりやすく回答してください。\n\n';

/**
 * Slack応答用のメッセージを組み立てる。system roleを使うとgemma-4-26b-a4b-itが
 * thinking modeを強制してしまうため、指示文をuserメッセージ本文の先頭に埋め込む。
 */
export function buildSlackAiMessages(message: string): Array<{ role: string; content: string }> {
  return [{ role: 'user', content: SLACK_RESPONSE_INSTRUCTION + message }];
}

function extractAiText(result: unknown): string {
  const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
  const rawResponse = 'response' in resultObj ? String(resultObj['response'] ?? '') : '';
  const rawReasoning = 'reasoning_content' in resultObj ? String(resultObj['reasoning_content'] ?? '') : '';
  const choices = Array.isArray(resultObj['choices']) ? resultObj['choices'] as Array<Record<string, unknown>> : [];
  const choiceMsg = choices.length > 0 ? (choices[0]['message'] as Record<string, unknown> | undefined) ?? {} : {};
  const rawChoices = String(choiceMsg['content'] ?? '');
  const rawChoicesReasoning = String(choiceMsg['reasoning_content'] ?? '');
  return rawResponse || rawReasoning || rawChoices || rawChoicesReasoning;
}

/**
 * Slackからのメンション本文をAIチャットモデルに渡し応答テキストを取得する。
 * /api/aichat と同じモデル別パラメータ調整(getModelRunParams)・空応答の除去(stripThinkTags)を使い、
 * primaryModelが失敗/空応答の場合はFALLBACK_MODELに一度だけフォールバックする。
 */
export async function generateSlackAiReply(
  message: string,
  configuredModel: string | undefined,
  aiRun: AiRunFn
): Promise<SlackAiReplyResult> {
  const primaryModel = (configuredModel ?? '').trim() || SLACK_AI_MODEL;
  const modelsToTry = primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];

  let lastError = 'AI応答の取得に失敗しました';
  for (const model of modelsToTry) {
    try {
      const maxTokens = Math.min(AICHAT_MODEL_MAX_TOKENS[model] ?? 4096, SLACK_MAX_TOKENS);
      const baseParams = { messages: buildSlackAiMessages(message), max_tokens: maxTokens };
      const runParams = getModelRunParams(model, baseParams);
      const result = await aiRun(model, runParams);
      const cleaned = stripThinkTags(extractAiText(result));
      if (!cleaned) {
        lastError = `AI returned empty response [model=${model}]`;
        continue;
      }
      const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
      const usageObj = (typeof resultObj['usage'] === 'object' && resultObj['usage'] !== null)
        ? resultObj['usage'] as Record<string, unknown>
        : {};
      return { ok: true, text: cleaned, usedModel: model, usage: extractAiUsage(usageObj) };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  return { ok: false, error: lastError };
}
