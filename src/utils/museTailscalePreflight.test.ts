import { describe, expect, it, vi } from 'vitest';
import { withMuseTailscalePreflight } from './museTailscalePreflight';
function fixture(data: unknown, status = 200) {
  const container = { getState: vi.fn(async () => ({ status: 'healthy' })), fetch: vi.fn(async (_request: Request) => new Response(JSON.stringify(data), { status })) };
  const getContainer = vi.fn(async () => container);
  const send = vi.fn(async () => ({ reply: 'ok' }));
  return { container, getContainer, send, ask: withMuseTailscalePreflight(send, getContainer) };
}
describe('Muse投稿前のTailscale確認', () => {
  it.each(['Stopped', 'NeedsLogin', 'Starting', ''])('%sではtunnelsへ送信しない', async backendState => {
    const f = fixture({ backendState, peers: [] });
    await expect(f.ask('muse_prompt="質問"')).rejects.toThrow(/Tailscale.*未接続.*送信していません/);
    expect(f.send).not.toHaveBeenCalled();
  });
  it.each([[[]], [[{ hostName: 'muse-vm', online: false }]], [[{ hostName: 'other', online: true }]]])('宛先のonline確認ができなければ停止する', async peers => {
    const f = fixture({ backendState: 'Running', peers });
    await expect(f.ask('muse_prompt="質問"')).rejects.toThrow(/muse-vm.*接続.*送信していません/);
    expect(f.send).not.toHaveBeenCalled();
  });
  it('接続確認後だけ元の質問を一度送る', async () => {
    const f = fixture({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] });
    await expect(f.ask('muse_prompt="質問"')).resolves.toEqual({ reply: 'ok' });
    expect(f.send).toHaveBeenCalledExactlyOnceWith('muse_prompt="質問"');
    const req = f.container.fetch.mock.calls[0][0] as Request;
    expect(new URL(req.url).pathname).toBe('/debug/tailscale-peers');
  });
  it('確認API異常は未確認として停止する', async () => {
    const f = fixture({ ask_error: 'unsupported_engine' }, 502);
    await expect(f.ask('muse_prompt="質問"')).rejects.toThrow(/接続状態を確認できません.*送信していません/);
    expect(f.send).not.toHaveBeenCalled();
  });
  it('コンテナが停止中ならfetchも起動も送信もしない', async () => {
    const f = fixture({}); f.container.getState.mockResolvedValue({ status: 'stopped' });
    await expect(f.ask('muse_prompt="質問"')).rejects.toThrow(/コンテナ.*停止/);
    expect(f.container.fetch).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
  });
  it('他のエンジンはMuseの接続確認で止めない', async () => {
    const f = fixture({}); await f.ask('claude_prompt="質問"');
    expect(f.getContainer).not.toHaveBeenCalled(); expect(f.send).toHaveBeenCalledOnce();
  });
  it('接続確認が応答しなければ期限で停止し、その後の成功でも送信しない', async () => {
    vi.useFakeTimers();
    try {
      const f = fixture({});
      let resolve!: (value: Response) => void;
      f.container.fetch.mockImplementation(() => new Promise(r => { resolve = r; }));
      const pending = withMuseTailscalePreflight(f.send, f.getContainer, 50)('muse_prompt="質問"');
      const rejected = expect(pending).rejects.toThrow(/接続状態を確認できません/);
      await vi.advanceTimersByTimeAsync(50); await rejected;
      resolve(new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] })));
      await Promise.resolve(); expect(f.send).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('通信例外・JSON破損・コンテナ不在も送信しない', async () => {
    for (const mode of ['network', 'json', 'missing']) {
      const f = fixture({});
      if (mode === 'network') f.container.fetch.mockRejectedValue(new Error('offline'));
      if (mode === 'json') f.container.fetch.mockResolvedValue(new Response('not json'));
      const ask = mode === 'missing' ? withMuseTailscalePreflight(f.send, async () => null) : f.ask;
      await expect(ask('muse_prompt="質問"')).rejects.toThrow(/送信していません/);
      expect(f.send).not.toHaveBeenCalled();
    }
  });
});
