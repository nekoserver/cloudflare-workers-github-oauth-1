export async function computeConversationHash(
  userId: string,
  question: string,
  answer: string,
  model: string,
  createdAt: string
): Promise<string> {
  const input = [userId, question, answer, model, createdAt].join('\x00');
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeQuestionHash(userId: string, question: string): Promise<string> {
  const input = [userId, question].join('\x00');
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
