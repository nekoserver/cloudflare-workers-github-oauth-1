export type SystemPromptMode = 'a' | 'b' | 'c';

export const SYSTEM_PROMPT_JA = 'あなたは親切なアシスタントです。必ず日本語で回答してください。';
export const USER_PREFIX_JA = '日本語で答えてください。\n\n';
export const ALLOWED_MODES: ReadonlySet<string> = new Set(['a', 'b', 'c']);

export function buildAiMessages(
  message: string,
  mode: SystemPromptMode = 'a'
): Array<{ role: string; content: string }> {
  switch (mode) {
    case 'a':
      return [
        { role: 'system', content: SYSTEM_PROMPT_JA },
        { role: 'user', content: message },
      ];
    case 'b':
      return [
        { role: 'user', content: USER_PREFIX_JA + message },
      ];
    case 'c':
      return [{ role: 'user', content: message }];
  }
}
