import { buildAiMessages, type SystemPromptMode } from './buildAiMessages';
import { stripThinkTags } from './stripThinkTags';
import { AICHAT_MODEL_MAX_TOKENS, getModelRunParams } from './aichatModelConfig';

export type AiRunFn = (model: string, params: Record<string, unknown>) => Promise<unknown>;

export type SlackAiReplyResult =
  | { ok: true; text: string; usedModel: string }
  | { ok: false; error: string };

const FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

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
  aiRun: AiRunFn,
  systemPromptMode: SystemPromptMode = 'a'
): Promise<SlackAiReplyResult> {
  const primaryModel = (configuredModel ?? '').trim() || FALLBACK_MODEL;
  const modelsToTry = primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];

  let lastError = 'AI応答の取得に失敗しました';
  for (const model of modelsToTry) {
    try {
      const maxTokens = AICHAT_MODEL_MAX_TOKENS[model] ?? 4096;
      const baseParams = { messages: buildAiMessages(message, systemPromptMode), max_tokens: maxTokens };
      const runParams = getModelRunParams(model, baseParams);
      const result = await aiRun(model, runParams);
      const cleaned = stripThinkTags(extractAiText(result));
      if (!cleaned) {
        lastError = `AI returned empty response [model=${model}]`;
        continue;
      }
      return { ok: true, text: cleaned, usedModel: model };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  return { ok: false, error: lastError };
}
