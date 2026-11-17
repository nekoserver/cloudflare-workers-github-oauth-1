import { DurableObject } from 'cloudflare:workers';
import '@ai-ecoverse/wasm-tailscale/wasm_exec.js';
import wasm from '@ai-ecoverse/wasm-tailscale/main.wasm';
import type { IPN } from '@ai-ecoverse/wasm-tailscale';
import type { Bindings } from '../types';
import { WasmTailnetService } from '../utils/wasmTailnetService';
import { WasmMuseBridge, type MuseKeyStat } from '../utils/wasmMuseBridge';
import { readMuseNodeSnapshot, waitForMuseNode } from '../utils/museNodeReady';
import { MuseAgentJobs } from '../utils/museAgentJobs';
import { createGoLifecycle } from '../utils/goLifecycle';
import { parseSelfIp } from '../utils/tailnetSelfIp';
import { decideBootRecovery, fingerprintState } from '../utils/nodeBootRecovery';

// Go が終了したら(2026-11-12 19:29:33 UTC に exit code 1 で終了した)、次の要求で起動し直す。ノードの状態は SQLite に残るので、ログインし直しは要らない。
const goRuntime = createGoLifecycle(() => {
  const go = new Go();
  const instance = new WebAssembly.Instance(wasm, go.importObject);
  (globalThis as { newIPN?: unknown }).newIPN = undefined;
  const exited = go.run(instance);
  const ready = (async () => {
    let failure = false;
    exited.catch(() => { failure = true; });
    for (let i = 0; i < 500 && typeof globalThis.newIPN !== 'function'; i++) {
      if (failure) throw new Error('Tailscale WASM startup failed');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (typeof globalThis.newIPN !== 'function') throw new Error('Tailscale WASM startup timed out');
  })();
  return { ready, exited };
});
function startGo(): Promise<void> { return goRuntime.start(); }
/** One server-owned node, credentials in private DO SQLite, never in browser storage. */
export class TailscaleWasm extends DurableObject<Bindings> {
  private service!: WasmTailnetService;
  private bridge!: WasmMuseBridge;
  private node!: IPN;
  private loginRequested = false;
  private autoLoginDisabled = false;
  private selfIp: string | null = null;
  private nodeReady?: Promise<void>;
  private jobs!: MuseAgentJobs;
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS tailnet_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS worker_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS muse_key_results (fingerprint TEXT PRIMARY KEY, replied INTEGER NOT NULL DEFAULT 0, unanswered INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)');
      this.autoLoginDisabled = [...ctx.storage.sql.exec<{ value: string }>("SELECT value FROM worker_settings WHERE key='auto_login_disabled'")][0]?.value === '1';
      this.jobs = new MuseAgentJobs(ctx.storage, prompt => this.deliver(new Request('http://tailnet/muse/v1/chat/completions', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) })));
      if ([...ctx.storage.sql.exec("SELECT id FROM muse_agent_messages WHERE state='queued' LIMIT 1")].length && await ctx.storage.getAlarm() === null) await ctx.storage.setAlarm(Date.now() + 1000);
    });
  }
  private ensureNode(): Promise<void> {
    if (goRuntime.exited && this.nodeReady) {
      console.log('[tailscale-wasm] ' + JSON.stringify({ event: 'go_exited_restart' }));
      this.nodeReady = undefined;
      this.loginRequested = false;
    }
    return this.nodeReady ??= (async () => {
      try {
        await this.bootNode();
      } catch (error) {
        // 起動に失敗したとき、永続化したノード状態が壊れている可能性がある。その状態を
        // 1回だけ破棄して初回参加をやり直す(SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery)。
        // 破棄済みの状態と同じものは二度と破棄しないので、破棄のループにはならない。
        if (!this.discardStateForRecovery(error)) throw error;
        await this.bootNode();
      }
    })().catch(error => { this.nodeReady = undefined; throw error; });
  }
  private logBootEvent(event: 'boot_failed' | 'state_discarded', fingerprint: string | null, reason: string): void {
    const db = this.env.DB;
    if (!db) return;
    // D1 への記録は要求の経路を止めない。失敗しても握り潰す(記録は DO 内の記録と併用する)。
    this.ctx.waitUntil(
      db.prepare('INSERT INTO tailscale_wasm_boot_log(event, fingerprint, reason) VALUES(?,?,?)')
        .bind(event, fingerprint, reason.slice(0, 200)).run()
        .then(() => undefined, () => undefined),
    );
  }
  private discardStateForRecovery(error: unknown): boolean {
    const sql = this.ctx.storage.sql;
    const rows = [...sql.exec<{ key: string; value: string }>('SELECT key, value FROM tailnet_state')];
    const stateFingerprint = rows.length ? fingerprintState(rows.map(r => [r.key, r.value] as const)) : null;
    this.logBootEvent('boot_failed', stateFingerprint, String(error));
    let lastDiscardedFingerprint: string | null = null;
    const marker = [...sql.exec<{ value: string }>("SELECT value FROM worker_settings WHERE key='node_boot_recovery_discard'")][0]?.value;
    if (marker) {
      try {
        const parsed = JSON.parse(marker) as { fingerprint?: unknown };
        lastDiscardedFingerprint = typeof parsed.fingerprint === 'string' ? parsed.fingerprint : null;
      } catch { lastDiscardedFingerprint = null; }
    }
    if (decideBootRecovery({ stateFingerprint, lastDiscardedFingerprint }) !== 'discard-and-retry') return false;
    const reason = String(error).slice(0, 200);
    sql.exec('DELETE FROM tailnet_state');
    sql.exec("INSERT INTO worker_settings(key,value) VALUES('node_boot_recovery_discard',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      JSON.stringify({ fingerprint: stateFingerprint, at: new Date().toISOString(), reason }));
    console.log('[tailscale-wasm] ' + JSON.stringify({ event: 'node_state_discarded', fingerprint: stateFingerprint, reason }));
    this.logBootEvent('state_discarded', stateFingerprint, reason);
    this.loginRequested = false;
    return true;
  }
  private async bootNode(): Promise<void> {
      const ctx = this.ctx, env = this.env;
      await startGo();
      const node = globalThis.newIPN({ hostname: 'main-worker-muse', ephemeral: false, logUpload: false, stateStorage: {
        getState(key) { return [...ctx.storage.sql.exec<{ value: string }>('SELECT value FROM tailnet_state WHERE key = ?', key)][0]?.value ?? ''; },
        setState(key, value) { ctx.storage.sql.exec('INSERT INTO tailnet_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value); },
      } });
      if (node instanceof Error) throw new Error('Tailscale node initialization failed');
      this.service = new WasmTailnetService(node as IPN, env);
      this.node = node as IPN;
      this.bridge = new WasmMuseBridge(this.node, env.MUSE_API_KEY, undefined, undefined, {
        record(fingerprint, replied) {
          ctx.storage.sql.exec(replied
            ? 'INSERT INTO muse_key_results(fingerprint,replied,updated_at) VALUES(?,1,?) ON CONFLICT(fingerprint) DO UPDATE SET replied=replied+1, updated_at=excluded.updated_at'
            : 'INSERT INTO muse_key_results(fingerprint,unanswered,updated_at) VALUES(?,1,?) ON CONFLICT(fingerprint) DO UPDATE SET unanswered=unanswered+1, updated_at=excluded.updated_at', fingerprint, new Date().toISOString());
        },
        list() { return [...ctx.storage.sql.exec<MuseKeyStat>('SELECT fingerprint, replied, unanswered FROM muse_key_results ORDER BY replied DESC LIMIT 10')].map(r => ({ fingerprint: r.fingerprint, replied: r.replied, unanswered: r.unanswered })); },
      });
      node.run({ notifyState() {}, notifyNetMap: (netMap: string) => { this.selfIp = parseSelfIp(netMap, 'main-worker-muse'); }, notifyBrowseToURL: url => this.service.browse(url), notifyPanicRecover() {} });
  }
  private async deliver(request: Request): Promise<Response> {
    await this.ensureNode();
    const key = this.env.TAILSCALE_WASM_AUTHKEY || this.env.TAILSCALE_AUTHKEY;
    await waitForMuseNode({
      snapshot: () => readMuseNodeSnapshot(this.node.status()),
      canLogin: !this.autoLoginDisabled && !!key,
      login: () => { if (!this.loginRequested && key) { this.loginRequested = true; this.node.login(key); } },
    });
    return this.bridge.fetch(request);
  }
  async alarm() { await this.jobs.processOne(); }
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/agent-jobs')) {
        const owner = request.headers.get('X-Muse-Owner');
        if (!owner) return Response.json({ error: 'unauthorized' }, { status: 401 });
        if (url.pathname === '/agent-jobs' && request.method === 'GET') return Response.json({ jobs: await this.jobs.list(owner) });
        if (url.pathname === '/agent-jobs' && request.method === 'POST') return this.jobs.enqueue(owner, await request.json());
        const consumer = url.searchParams.get('consumer') || '';
        if (!['codex', 'claude'].includes(consumer)) return Response.json({ error: 'invalid_consumer' }, { status: 400 });
        if (url.pathname === '/agent-jobs/changes' && request.method === 'GET') return Response.json(await this.jobs.changes(owner, consumer));
        if (url.pathname === '/agent-jobs/ack' && request.method === 'POST') return this.jobs.ack(owner, consumer, (await request.json() as { cursor?: unknown }).cursor);
        return new Response('Not found', { status: 404 });
      }
      if (url.pathname.startsWith('/muse/')) return await this.deliver(request);
      await this.ensureNode();
      const path = url.pathname;
      let response = await this.service.fetch(request);
      // /status には netmap から得た自ノードの IP を足す(REQ-TW-016)。
      if (path === '/status' && response.ok) {
        const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (body) response = Response.json({ ...body, nodeIp: this.selfIp });
      }
      if (response.ok && request.method === 'POST' && (path === '/logout' || path === '/login')) {
        this.autoLoginDisabled = path === '/logout';
        this.loginRequested = path === '/login';
        this.ctx.storage.sql.exec("INSERT INTO worker_settings(key,value) VALUES('auto_login_disabled',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", this.autoLoginDisabled ? '1' : '0');
      }
      return response;
    }
    catch { return Response.json({ error: 'tailscale_wasm_unavailable' }, { status: 503 }); }
  }
}
