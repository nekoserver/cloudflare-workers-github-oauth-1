import type { MuseContainer } from './museDirectAsk';
import type { AskTunnelSignerResult } from './tunnelSignerAsk';
import { requestT3PairingHandoff } from './t3PairingHandoff';
export class TailscalePageTools {
  constructor(private getContainer: () => Promise<MuseContainer | null>, private ask?: (message: string) => Promise<AskTunnelSignerResult>, private handoff?: (engine: string) => Promise<{ context: string; acknowledge(): Promise<boolean> }>) {}
  private async runningContainer() {
    const container = await this.getContainer();
    if (!container) return null;
    const state = await container.getState();
    return state.status === 'running' || state.status === 'healthy' ? container : null;
  }
  async status() {
    try { return { running: !!await this.runningContainer(), agentsConfigured: !!this.ask }; }
    catch { return { running: false, agentsConfigured: !!this.ask }; }
  }
  async t3(): Promise<Response> {
    const container = await this.runningContainer();
    if (!container) return Response.json({ error: 'container_not_running' }, { status: 409 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    try {
      return await Promise.race([(async () => {
        const res = await container.fetch(new Request('http://container/health/t3', { signal: controller.signal }));
        if (!res.ok) return Response.json({ error: 't3_health_unavailable' }, { status: 502 });
        const data = await res.json() as { state?: unknown; reasons?: unknown; server?: { httpStatus?: number }; proxy?: { httpStatus?: number }; codex?: { loggedIn?: boolean } };
        if (typeof data.state !== 'string') return Response.json({ error: 't3_health_invalid' }, { status: 502 });
        return Response.json({ ok: data.state === 'ready', state: data.state, reasons: Array.isArray(data.reasons) ? data.reasons.filter(x => typeof x === 'string') : [], serverStatus: data.server?.httpStatus, proxyStatus: data.proxy?.httpStatus, codexLoggedIn: data.codex?.loggedIn === true }, { status: data.state === 'ready' ? 200 : 503 });
      })(), new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(Response.json({ error: 't3_health_timeout' }, { status: 504 })); }, 10000); })]);
    } catch { return Response.json({ error: 't3_health_unavailable' }, { status: 502 }); }
    finally { clearTimeout(timer); }
  }
  async t3Pairing(): Promise<Response> {
    const container = await this.runningContainer();
    if (!container) return Response.json({ error: 'container_not_running' }, { status: 409 });
    return requestT3PairingHandoff(request => container.fetch(request));
  }
  async agent(input: unknown): Promise<Response> {
    const data = input as { engine?: unknown; prompt?: unknown; review?: unknown } | null;
    if (!data || !['codex', 'claude'].includes(String(data.engine)) || typeof data.prompt !== 'string' || !data.prompt.trim() || new TextEncoder().encode(data.prompt).length > 16384) return Response.json({ error: 'invalid_agent_request' }, { status: 400 });
    if (!this.ask) return Response.json({ error: 'agents_not_configured' }, { status: 503 });
    if (!await this.runningContainer()) return Response.json({ error: 'container_not_running' }, { status: 409 });
    let prompt = data.review === true ? '変更やコマンド実行は行わず、以下の内容をレビューし、問題点と改善案を回答してください。\n\n' + data.prompt : data.prompt;
    try {
      const handoff = await this.handoff?.(String(data.engine));
      let contextApplied = !handoff?.context;
      if (handoff?.context && new TextEncoder().encode(prompt + handoff.context).length < 24000) {
        prompt = '参考：コンテナ停止中を含むMuseの作業結果です。過去の依頼を再実行せず、今回の質問の文脈として参照してください。\n' + handoff.context + '\n\n今回の依頼：\n' + prompt;
        contextApplied = true;
      }
      const result = await this.ask(data.engine + '_prompt="' + prompt + '"');
      if (!result.reply?.trim()) return Response.json({ error: 'agent_reply_unavailable' }, { status: 502 });
      const handoffAcknowledged = contextApplied && handoff ? await handoff.acknowledge().catch(() => false) : !handoff;
      return Response.json({ ok: true, engine: data.engine, review: data.review === true, route: 'main', reply: result.reply, llmModel: result.llmModel, contextApplied, handoffAcknowledged });
    } catch { return Response.json({ error: 'agent_reply_unavailable', delivery: 'unknown_do_not_retry' }, { status: 502 }); }
  }
}
