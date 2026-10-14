/** Fixed upstream probe; never forwards browser credentials to the embed host. */
export async function conversationStreamHealthy(): Promise<boolean> {
  try {
    const response = await fetch('https://mynw.nekomaneki.work/lib/conversation-embed.html', {
      method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000),
      headers: { 'Cache-Control': 'no-cache' },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
