import { Hono, type Context } from 'hono';
import type { Bindings, Variables } from '../types';
import { proxyRedmine } from './redmineProxy';
import { renewSession } from './session';
import { encryptCredential, readSecuremineSession, sessionHash, SECUREMINE_COOKIE, SECUREMINE_TTL } from './securemineSessionStore';
type AppEnv = {Bindings:Bindings;Variables:Variables};
const verifier = new Hono<AppEnv>();
verifier.get('/', proxyRedmine);
export async function securemineLogin(c: Context<AppEnv>) {
  const headers = {'Cache-Control':'no-store'};
  if (c.req.header('Origin') !== new URL(c.req.url).origin) return c.json({error:'同じオリジンから操作してください。'},403,headers);
  if (!c.env.DB) return c.json({error:'ログイン情報を保存するDBが設定されていません。'},503,headers);
  try {
    const input = await c.req.json<{base:string;name:string;apiKey:string}>();
    if (typeof input.base !== 'string' || typeof input.apiKey !== 'string' || !input.apiKey || input.apiKey.length > 512 || typeof input.name !== 'string' || input.name.length > 80) return c.json({error:'接続情報が不正です。'},400,headers);
    const url = new URL(c.req.url); url.pathname = '/'; url.search = new URLSearchParams({base:input.base,path:'users/current.json'}).toString();
    const verified = await verifier.fetch(new Request(url, {headers:{'X-Redmine-API-Key':input.apiKey,Origin:url.origin}}),c.env);
    if (!verified.ok) return new Response(verified.body,{status:verified.status,headers:verified.headers});
    const current = (await verified.json() as {user?:{id:number;login:string;firstname?:string;lastname?:string}}).user;
    if (!current || !Number.isSafeInteger(current.id) || current.id <= 0) return c.json({error:'Redmineのユーザー情報を確認できません。'},502,headers);
    // Retain only display identity; Redmine may return api_key and other private fields.
    const identity = {id:current.id,login:current.login,firstname:current.firstname,lastname:current.lastname};
    const user = c.get('user');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now()+SECUREMINE_TTL*1000).toISOString();
    const token = crypto.randomUUID()+crypto.randomUUID();
    const encrypted = await encryptCredential(c.env.JWT_SECRET,input.apiKey,user.sub,input.base);
    const renewed = await renewSession({currentUser:user,newDuration:'1w',jwtSecret:c.env.JWT_SECRET,idleTimeoutEnv:c.env.SESSION_IDLE_TIMEOUT_SECONDS});
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM securemine_sessions WHERE expires_at <= ?').bind(now),
      c.env.DB.prepare('INSERT INTO securemine_sessions (token_hash,user_id,base_url,account_name,api_key_encrypted,redmine_user_json,logged_in_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(await sessionHash(token),user.sub,input.base,input.name,encrypted,JSON.stringify(identity),now,expiresAt),
      c.env.DB.prepare('INSERT INTO securemine_login_history (user_id,base_url,redmine_user_id,logged_in_at) VALUES (?,?,?,?)').bind(user.sub,input.base,current.id,now),
      c.env.DB.prepare(`INSERT INTO user_sessions (user_id,session_duration,current_login_at,last_activity_at,idle_timeout_seconds,updated_at) VALUES (?,'1w',?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_login_at=user_sessions.current_login_at,current_login_at=excluded.current_login_at,last_activity_at=excluded.last_activity_at,session_duration=excluded.session_duration,idle_timeout_seconds=excluded.idle_timeout_seconds,updated_at=excluded.updated_at`).bind(user.sub,now,now,renewed.idleTimeoutSeconds,now),
    ]);
    for (const cookie of renewed.cookies) c.header('Set-Cookie',cookie,{append:true});
    c.header('Set-Cookie',`${SECUREMINE_COOKIE}=${token}; Path=/api/taskmine; HttpOnly; Secure; SameSite=Lax; Max-Age=${SECUREMINE_TTL}`,{append:true});
    return c.json({loggedInAt:now,expiresAt,user:identity},200,headers);
  } catch { return c.json({error:'Redmine HTTP 502: ログイン情報を保存できません。接続設定とDBの状態を確認してください。'},502,headers); }
}
export async function securemineSession(c: Context<AppEnv>) {
  try {
    const session = await readSecuremineSession(c);
    return c.json(session ? {account:{id:session.token_hash,name:session.account_name,url:session.base_url},user:JSON.parse(session.redmine_user_json),loggedInAt:session.logged_in_at,expiresAt:session.expires_at} : {account:null},200,{'Cache-Control':'no-store'});
  } catch { return c.json({error:'Redmineセッションを復元できません。再ログインしてください。'},503,{'Cache-Control':'no-store'}); }
}
