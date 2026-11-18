import { describe, expect, it, vi } from 'vitest';
import { askTunnelSigner } from './tunnelSignerAsk';
const envelope = (data: unknown) => new Response(JSON.stringify(data));
describe('Muse投稿の障害箇所の区別', () => {
  it.each([502, 530])('tunnels HTTP %sの本文をエンジン非対応として扱わない', async status => {
    const fetch = vi.fn(async () => envelope({ ok: false, status, body: '{"ask_error":"unsupported_engine","ask_status":"failed"}' }));
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(/tunnels\.rbへの接続.*HTTP/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('非対応応答は後段の到達を確認していないと伝える', async () => {
    const fetch = vi.fn(async () => envelope({ ok: true, status: 200, body: '{"ask_error":"unsupported_engine","ask_status":"failed"}' }));
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(/Muse.*対応していません.*Tailscale.*未確認/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('中継接続失敗をtunnelsやTailscaleの故障と断定しない', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(/中継Worker.*tunnels\.rb以降.*未確認/);
  });
  it('Muse接続失敗はエンジン非対応と区別する', async () => {
    const fetch = vi.fn(async () => envelope({ ok: true, status: 200, body: '{"ask_error":"muse_connection_failed","ask_status":"failed"}' }));
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(/Tailscale経由のMuse接続に失敗.*切断.*断定できません/);
  });
  it.each([
    ['codex_worker_unavailable', /LLM workerに接続できません.*Tailscale.*未確認/],
    ['muse_not_authenticated', /MUSE_API_KEYが未設定/],
    ['muse_authentication_failed', /Museの認証に失敗/],
    ['llm_timeout', /タイムアウト.*断定できません/],
  ])('%sを対応する障害区間として表示する', async (code, message) => {
    const fetch = vi.fn(async () => envelope({ ok: true, status: 200, body: JSON.stringify({ ask_error: code, ask_status: 'failed' }) }));
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(message);
  });
  it('中継エラーと同居する古い実行結果を採用しない', async () => {
    const fetch = vi.fn(async () => envelope({ error: 'connection_failed', ok: true, status: 200, body: '{"ask_error":"unsupported_engine"}' }));
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(/rust-worker-sqlx-d1からエラー応答: connection_failed/);
  });
  it('2xxの中継でも上流HTTPエラーを成功扱いしない', async () => {
    const fetch = vi.fn(async () => envelope({ ok: true, status: 503, body: '{"reply":"cached success"}' }));
    await expect(askTunnelSigner({ fetch }, 'muse_prompt="質問"')).rejects.toThrow(/HTTP 503/);
  });
});
