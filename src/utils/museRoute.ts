import type { AichatSlashCommandResult } from './aichatSlashCommand';
import type { MuseDirectError, MuseDirectResult } from './museDirectAsk';
import { museVmNotConfirmedMessage, type MuseVmPresence } from './museTailscalePreflight';

/**
 * 言語モデルスイッチがMuseのときの、接頭語なし投稿の振り分け(ユーザー指定、2026-11-07)。
 *
 * 1. tunnels.rbへ問い合わせる前に、tailnet上のmuse-vmを確かめる。確認できれば直接接続
 *    (本体Worker → DEMO_CONTAINER → server.js → tailscale nc → muse-vm)を最優先する。
 * 2. それでも失敗したら、tunnels接続のポリシー(ON/OFF、既定OFF)を確かめる。
 *    ONならtunnels.rb(rust-worker-sqlx-d1 → tunnels.rb → LLM worker → muse-vm)へ問い合わせる。
 *    OFFならtunnels.rbへも問い合わせない。
 * 3. 「Muse投稿を停止」と返すのは、tailnet上にmuse-vmを確認できない場合だけ。
 *    muse-vmを確認できた後の失敗は、直接経路のエラーとしてそのまま返す。
 *
 * 「それでも失敗」に数えるのは、直接経路がmuse-vmへ届かなかった失敗だけ(TUNNELS_RETRYABLE)。
 * muse-vmが応答した失敗やタイムアウトは、tunnelsへ再送すると同じ質問を二重に推論させるため数えない。
 * 接頭語付きの投稿(`/askmuse`・`/neko askgk muse_prompt=`)はここを通らない(AGENTS.md)。
 */
export const MUSE_TUNNELS_COOKIE = 'aichat_muse_tunnels';

const TUNNELS_RETRYABLE: ReadonlySet<MuseDirectError> = new Set<MuseDirectError>([
  'container_not_running',
  'muse_connection_failed',
  'muse_not_authenticated',
]);

export type MuseRoute = 'direct' | 'tunnels' | 'stopped' | 'direct_failed';

export type MuseRouteDeps = {
  /** tailnet上のmuse-vmの確認(checkMuseVmOnTailnet)。 */
  checkMuseVm: () => Promise<MuseVmPresence>;
  /** 直接経路の送信。DEMO_CONTAINERが無ければundefined。 */
  askMuseDirect?: (prompt: string) => Promise<MuseDirectResult>;
  /** 直接経路の結果を表示用に変える(interpretMusePrompt)。渡したaskで送ること。 */
  interpretDirect: (prompt: string, askMuseDirect?: (prompt: string) => Promise<MuseDirectResult>) => Promise<AichatSlashCommandResult>;
  /** tunnels接続のポリシー。readMuseTunnelsPolicyで決める。 */
  tunnelsPolicy: boolean;
  /** tunnels.rbへの問い合わせ。RUST_WORKERが無ければundefined。 */
  askTunnels?: (prompt: string) => Promise<AichatSlashCommandResult>;
};

export type MuseRouteOutcome = {
  result: AichatSlashCommandResult;
  route: MuseRoute;
  museVm: MuseVmPresence['state'];
};

/** リクエストの明示値(trueだけがON)を優先し、無ければCookieを見る。どちらも無ければOFF。 */
export function readMuseTunnelsPolicy(override: unknown, cookieHeader: string | undefined): boolean {
  if (override !== undefined) return override === true;
  return String(cookieHeader ?? '').split(';').some(part => part.trim() === MUSE_TUNNELS_COOKIE + '=on');
}

function tunnelsSkipped(policy: boolean, available: boolean, stopped: boolean): string {
  const also = stopped ? 'tunnels.rbへも問い合わせていません。' : 'tunnels.rbへは問い合わせていません。';
  if (!policy) return 'tunnels接続のポリシーがOFF（既定）のため、' + also;
  return available ? '' : 'tunnels接続のポリシーはONですが、RUST_WORKERが未設定のため、' + also;
}

export async function routeMusePrompt(prompt: string, deps: MuseRouteDeps): Promise<MuseRouteOutcome> {
  const presence = await deps.checkMuseVm();
  const tunnelsAvailable = !!deps.askTunnels;
  let directResult: AichatSlashCommandResult | undefined;

  if (presence.state === 'online') {
    let sent: MuseDirectResult | undefined;
    const ask = deps.askMuseDirect && (async (p: string) => (sent = await deps.askMuseDirect!(p)));
    directResult = await deps.interpretDirect(prompt, ask);
    if (sent?.ok) return { result: directResult, route: 'direct', museVm: 'online' };
    // 未送信(直接経路が無い)か、muse-vmへ届かなかった失敗だけをtunnelsの対象にする。
    const retryable = !deps.askMuseDirect || (sent !== undefined && !sent.ok && TUNNELS_RETRYABLE.has(sent.error));
    if (!retryable) return { result: directResult, route: 'direct_failed', museVm: 'online' };
  }

  if (deps.tunnelsPolicy && deps.askTunnels) {
    return { result: await deps.askTunnels(prompt), route: 'tunnels', museVm: presence.state };
  }

  if (presence.state !== 'online') {
    const response = '❌ ' + museVmNotConfirmedMessage(presence.reason) + tunnelsSkipped(deps.tunnelsPolicy, tunnelsAvailable, true);
    return { result: { handled: true, response }, route: 'stopped', museVm: presence.state };
  }
  const direct = directResult && directResult.handled ? directResult.response : '❌ Muse でエラーが発生しました';
  const note = '\n（tailnet上のmuse-vmは確認できています。' + tunnelsSkipped(deps.tunnelsPolicy, tunnelsAvailable, false) + '）';
  return { result: { handled: true, response: direct + note }, route: 'direct_failed', museVm: 'online' };
}
