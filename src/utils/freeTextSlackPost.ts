const MAX_FREE_TEXT_LENGTH = 3000;

export type FreeTextValidationResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function validateFreeText(text: unknown): FreeTextValidationResult {
  if (typeof text !== 'string') {
    return { ok: false, error: '本文が指定されていません' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: '本文が空です' };
  }
  if (trimmed.length > MAX_FREE_TEXT_LENGTH) {
    return { ok: false, error: `本文が長すぎます（${MAX_FREE_TEXT_LENGTH}文字以内にしてください）` };
  }
  return { ok: true, text: trimmed };
}

export function buildFreeTextSlackMessage(displayName: string, text: string): string {
  return `📮 *${displayName}* さんの投稿:\n${text}`;
}
