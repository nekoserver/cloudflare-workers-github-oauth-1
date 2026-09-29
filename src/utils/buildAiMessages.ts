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

export type AiThreadTurn = { question: string; answer: string };

/**
 * Insert the persisted conversation before the new user message.
 *
 * The newest complete turns are retained when the character budget is reached.
 * Keeping the system message (when present) and the current question outside the
 * budget means a follow-up can never accidentally lose its instructions or prompt.
 */
export function addThreadHistoryToAiMessages(
  messages: Array<{ role: string; content: string }>,
  turns: AiThreadTurn[],
  maxHistoryCharacters = 24_000
): Array<{ role: string; content: string }> {
  if (turns.length === 0 || messages.length === 0) return messages;

  const history: Array<{ role: string; content: string }> = [];
  let usedCharacters = 0;
  for (let index = turns.length - 1; index >= 0; index--) {
    const question = String(turns[index].question ?? '').trim();
    const answer = String(turns[index].answer ?? '').trim();
    if (!question || !answer) continue;
    const turnCharacters = question.length + answer.length;
    if (history.length > 0 && usedCharacters + turnCharacters > maxHistoryCharacters) break;
    if (turnCharacters > maxHistoryCharacters) continue;
    history.unshift(
      { role: 'user', content: question },
      { role: 'assistant', content: answer }
    );
    usedCharacters += turnCharacters;
  }

  if (history.length === 0) return messages;
  const currentUserMessage = messages[messages.length - 1];
  return [...messages.slice(0, -1), ...history, currentUserMessage];
}
