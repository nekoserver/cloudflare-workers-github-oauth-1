import {Hono} from 'hono';
import type {Bindings} from '../types';
import type {ContainerOperationLogEntry} from '../utils/cfContainerOperationLog';
import {buildWorkerSignatureMessage} from '../utils/workerRequestSignature';

export type T3ContainerState = {status: string; lastChange?: number};
export type T3PowerStub = {
  getState(): Promise<T3ContainerState>;
  setRunning(running: boolean): Promise<{changed: boolean; state: T3ContainerState}>;
};
type Dependencies = {
  getContainer(env: Bindings): Promise<T3PowerStub | null>;
  authenticate(env: Bindings, token: string): Promise<{ok: true; login: string} | {ok: false; error: string; status: number}>;
  audit(env: Bindings, entry: ContainerOperationLogEntry): Promise<boolean>;
};
const knownStates = new Set(['running','healthy','stopping','stopped','stopped_with_code']);
function statusResponse(state: T3ContainerState) {
  if (!state || !knownStates.has(state.status)) throw new Error('本体demoコンテナの状態を確認できません');
  return {status: state.status, running: state.status === 'running' || state.status === 'healthy'};
}
async function authenticated(request: Request, raw: string, secret: string | undefined): Promise<boolean> {
  if (!secret || request.headers.get('CF-Worker') !== 'dynamicneko') return false;
  const timestamp = request.headers.get('CF-Worker-Timestamp') ?? '';
  const signature = request.headers.get('CF-Worker-Signature') ?? '';
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(Date.now()/1000-Number(timestamp)) > 300 || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const url = new URL(request.url);
  const message = buildWorkerSignatureMessage('dynamicneko',Number(timestamp),request.method,url.pathname+url.search,raw);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, hex => parseInt(hex,16));
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(message));
}

/** Only explicit start/stop operations reach the single authoritative demo DO. */
export function createTreeViewT3PowerRoutes(dependencies: Dependencies) {
  const app = new Hono<{Bindings: Bindings}>();
  app.post('/api/tree-view/t3-power-external',async c => {
    c.header('Cache-Control','no-store');
    const raw = await c.req.text();
    if (raw.length > 8192 || !(await authenticated(c.req.raw,raw,c.env.DYNAMICNEKO_WORKER_HMAC_SECRET))) return c.json({error:'Unauthorized'},401);
    let body: {action?:unknown;userToken?:unknown};
    try {body=JSON.parse(raw);} catch {return c.json({error:'不正なリクエストです'},400);}
    if (!body || (typeof body.action !== 'string' || !['status','start','stop'].includes(body.action)) || typeof body.userToken !== 'string') return c.json({error:'actionはstatus/start/stopで指定してください'},400);
    const action = body.action as 'status'|'start'|'stop';
    const auth = await dependencies.authenticate(c.env,body.userToken);
    if (!auth.ok) return c.json({error:auth.error},auth.status as 400|401|403|500|503);
    if (auth.login.toLowerCase() !== 'nekoserver') return c.json({error:'この操作は管理者に限定されています'},403);
    const stub = await dependencies.getContainer(c.env);
    if (!stub) return c.json({error:'DEMO_CONTAINERが未設定です'},503);
    if (action === 'status') {
      try {return c.json({...statusResponse(await stub.getState()),checkedAt:new Date().toISOString()});}
      catch {return c.json({error:'本体demoコンテナの状態を取得できませんでした'},503);}
    }
    try {
      const result = await stub.setRunning(action === 'start');
      const state = statusResponse(result.state);
      const pending = action === 'stop' && state.status === 'stopping';
      if (state.running !== (action === 'start') && !pending) throw new Error('操作後に希望する稼働状態を確認できませんでした');
      const auditRecorded = await dependencies.audit(c.env,{
        action:!result.changed ? `t3:${action}:no-op` : pending ? `t3:${action}:pending` : action,performedBy:auth.login,result:'success',
        detail:JSON.stringify({source:'tree-view/T3 Code',desired:action,...state,pending}),
      });
      return c.json({...state,pending,auditRecorded,checkedAt:new Date().toISOString()},pending ? 202 : 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作に失敗しました';
      await dependencies.audit(c.env,{action,performedBy:auth.login,result:'failure',detail:JSON.stringify({source:'tree-view/T3 Code',error:message})});
      return c.json({error:message},/別の操作|停止処理中/.test(message) ? 409 : 502);
    }
  });
  return app;
}
