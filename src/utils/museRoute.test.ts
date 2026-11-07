import { describe, expect, it, vi } from 'vitest';
import { readMuseTunnelsPolicy, routeMusePrompt, type MuseRouteDeps } from './museRoute';
import type { MuseDirectResult } from './museDirectAsk';

// 2026-11-07 ユーザー指定:
// 1. tunnels.rbへ問い合わせる前に、tailnet上のmuse-vmを確かめ、確認できれば直接接続を最優先する。
// 2. それでも失敗し、選択中のモデルがMuseなら、tunnels接続のポリシー(既定OFF)を確かめる。OFFならtunnels.rbへも問い合わせない。
// 3. Muse投稿を停止してよいのは、tailnet上にmuse-vmを確認できない場合だけ。
const online = { state: 'online' } as const;
const notConfirmed = { state: 'not_confirmed', reason: '本体コンテナが停止中のため、Tailscaleの接続状態を確認できません' } as const;

function deps(over: Partial<MuseRouteDeps> & { direct?: MuseDirectResult | 'never' } = {}) {
  const askMuseDirect = vi.fn(async (): Promise<MuseDirectResult> => {
    if (over.direct === 'never') return new Promise<MuseDirectResult>(() => {});
    return over.direct ?? { ok: true, reply: '直接の回答', llmModel: 'muse' };
  });
  // interpretMusePromptの代わり。渡されたaskで送り、結果を表示用に変える(タイムアウトは呼ばずに返す)。
  const interpretDirect = vi.fn(async (prompt: string, ask?: (p: string) => Promise<MuseDirectResult>) => {
    if (!ask) return { handled: true as const, response: '❌ Muse は現在利用できません(DEMO_CONTAINER未設定)' };
    if (over.direct === 'never') return { handled: true as const, response: '❌ Muse がタイムアウトしました' };
    const r = await ask(prompt);
    return r.ok
      ? { handled: true as const, response: r.reply, saveAsAiResponse: true, museAskgk: true }
      : { handled: true as const, response: '❌ Muse でエラーが発生しました: ' + r.error };
  });
  const askTunnels = vi.fn(async () => ({ handled: true as const, response: 'tunnelsの回答', saveAsAiResponse: true, museAskgk: true }));
  const d: MuseRouteDeps = {
    checkMuseVm: vi.fn(async () => online),
    askMuseDirect,
    interpretDirect,
    tunnelsPolicy: false,
    askTunnels,
    ...over,
  };
  return { d, askMuseDirect, interpretDirect, askTunnels };
}

describe('routeMusePrompt: Muse選択の接頭語なし投稿の振り分け', () => {
  it('muse-vmを確認できれば直接送り、tunnelsへは問い合わせない', async () => {
    const { d, askMuseDirect, askTunnels } = deps({ tunnelsPolicy: true });
    const routed = await routeMusePrompt('質問', d);
    expect(routed).toMatchObject({ route: 'direct', museVm: 'online', result: { response: '直接の回答' } });
    expect(askMuseDirect).toHaveBeenCalledExactlyOnceWith('質問');
    expect(askTunnels).not.toHaveBeenCalled();
  });

  it('muse-vmを確認できず、ポリシーOFF(既定)なら停止し、tunnels.rbへも問い合わせない', async () => {
    const { d, askMuseDirect, askTunnels } = deps({ checkMuseVm: async () => notConfirmed });
    const routed = await routeMusePrompt('質問', d);
    expect(routed.route).toBe('stopped');
    expect(routed.museVm).toBe('not_confirmed');
    const text = (routed.result as { response: string }).response;
    expect(text).toMatch(/^❌ Muse投稿を停止しました。tailnet上にmuse-vmを確認できません（本体コンテナが停止中/);
    expect(text).toContain('Museへは送信していません');
    expect(text).toContain('tunnels.rbへも問い合わせていません');
    // 「停止しました」を二重に書かない(旧表示の「停止しました: 停止しました。」の再発防止)。
    expect(text.match(/停止しました/g)).toHaveLength(1);
    expect(askMuseDirect).not.toHaveBeenCalled();
    expect(askTunnels).not.toHaveBeenCalled();
  });

  it('muse-vmを確認できず、ポリシーONならtunnels.rbへ問い合わせる', async () => {
    const { d, askMuseDirect, askTunnels } = deps({ checkMuseVm: async () => notConfirmed, tunnelsPolicy: true });
    const routed = await routeMusePrompt('質問', d);
    expect(routed).toMatchObject({ route: 'tunnels', museVm: 'not_confirmed', result: { response: 'tunnelsの回答' } });
    expect(askTunnels).toHaveBeenCalledExactlyOnceWith('質問');
    expect(askMuseDirect).not.toHaveBeenCalled();
  });

  it.each(['container_not_running', 'muse_connection_failed', 'muse_not_authenticated'] as const)(
    'muse-vmを確認できても直接経路が使えない(%s)とき、ONならtunnels.rbへ問い合わせる', async (error) => {
      const { d, askTunnels } = deps({ direct: { ok: false, error }, tunnelsPolicy: true });
      const routed = await routeMusePrompt('質問', d);
      expect(routed).toMatchObject({ route: 'tunnels', museVm: 'online', result: { response: 'tunnelsの回答' } });
      expect(askTunnels).toHaveBeenCalledOnce();
    });

  it('muse-vmを確認できて直接経路が使えないとき、OFFなら直接のエラーを返し、停止とは書かない', async () => {
    const { d, askTunnels } = deps({ direct: { ok: false, error: 'muse_connection_failed' } });
    const routed = await routeMusePrompt('質問', d);
    expect(routed.route).toBe('direct_failed');
    const text = (routed.result as { response: string }).response;
    expect(text).toContain('muse_connection_failed');
    expect(text).toContain('tunnels.rbへは問い合わせていません');
    expect(text).not.toContain('停止');
    expect(askTunnels).not.toHaveBeenCalled();
  });

  // 故障想定: muse-vmに届いた後の失敗をtunnelsへ再送し、同じ質問を二重に推論させる。
  it.each(['muse_authentication_failed', 'muse_usage_limit', 'muse_command_failed', 'muse_execution_failed', 'llm_timeout', 'prompt_too_large'] as const)(
    'muse-vmが応答した失敗(%s)は、ONでもtunnelsへ再送しない', async (error) => {
      const { d, askTunnels } = deps({ direct: { ok: false, error }, tunnelsPolicy: true });
      const routed = await routeMusePrompt('質問', d);
      expect(routed.route).toBe('direct_failed');
      expect((routed.result as { response: string }).response).toContain(error);
      expect((routed.result as { response: string }).response).not.toContain('停止');
      expect(askTunnels).not.toHaveBeenCalled();
    });

  it('直接送信がタイムアウトしたら、ONでもtunnelsへ再送しない(muse-vmが処理中の可能性)', async () => {
    const { d, askTunnels } = deps({ direct: 'never', tunnelsPolicy: true });
    const routed = await routeMusePrompt('質問', d);
    expect(routed.route).toBe('direct_failed');
    expect(askTunnels).not.toHaveBeenCalled();
  });

  it('直接経路が未設定(DEMO_CONTAINERなし)なら、ONのときだけtunnelsへ問い合わせる', async () => {
    const on = deps({ askMuseDirect: undefined, tunnelsPolicy: true });
    expect((await routeMusePrompt('質問', on.d)).route).toBe('tunnels');
    const off = deps({ askMuseDirect: undefined });
    expect((await routeMusePrompt('質問', off.d)).route).toBe('direct_failed');
    expect(off.askTunnels).not.toHaveBeenCalled();
  });

  it('ONでもtunnelsの送り先(RUST_WORKER)が無ければ、その理由を書いて止める', async () => {
    const { d } = deps({ checkMuseVm: async () => notConfirmed, tunnelsPolicy: true, askTunnels: undefined });
    const routed = await routeMusePrompt('質問', d);
    expect(routed.route).toBe('stopped');
    expect((routed.result as { response: string }).response).toContain('RUST_WORKER');
  });
});

describe('readMuseTunnelsPolicy: tunnels接続のポリシー', () => {
  it.each([
    [undefined, undefined, false],
    [undefined, '', false],
    [undefined, 'aichat_muse_tunnels=off', false],
    [undefined, 'other=1; aichat_muse_tunnels=on', true],
    [undefined, 'aichat_muse_tunnels=on; x=2', true],
    [undefined, 'xaichat_muse_tunnels=on', false],
    [true, '', true],
    [false, 'aichat_muse_tunnels=on', false],
    ['true', 'aichat_muse_tunnels=on', false],
    [1, '', false],
  ])('リクエスト指定%sとCookie%sならON=%s(既定OFF、明示値が優先、true以外はOFF)', (override, cookie, expected) => {
    expect(readMuseTunnelsPolicy(override, cookie)).toBe(expected);
  });
});
