import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import { getCookieValue } from './cookie';

export const SECUREMINE_COOKIE = 'securemine_session';
export const SECUREMINE_TTL = 604800;
const encoder = new TextEncoder();
export async function sessionHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))), b => b.toString(16).padStart(2, '0')).join('');
}
async function encryptionKey(secret: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode('SecureMine API credentials v1\n' + secret));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptCredential(secret: string, apiKey: string, owner: string, base: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:encoder.encode(JSON.stringify([owner, base]))}, await encryptionKey(secret), encoder.encode(apiKey));
  return JSON.stringify({iv:Array.from(iv), data:Array.from(new Uint8Array(encrypted))});
}
export async function decryptCredential(secret: string, value: string, owner: string, base: string) {
  const data = JSON.parse(value);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:new Uint8Array(data.iv), additionalData:encoder.encode(JSON.stringify([owner, base]))}, await encryptionKey(secret), new Uint8Array(data.data)));
}
export type SecuremineSession = { token_hash: string; user_id: string; base_url: string; account_name: string; api_key_encrypted: string; redmine_user_json: string; logged_in_at: string; expires_at: string };
export async function readSecuremineSession(c: Context<{Bindings:Bindings;Variables:Variables}>) {
  const token = getCookieValue(c.req.header('Cookie'), SECUREMINE_COOKIE);
  if (!token || !c.env.DB) return null;
  return c.env.DB.prepare('SELECT * FROM securemine_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?')
    .bind(await sessionHash(token), c.get('user').sub, new Date().toISOString()).first<SecuremineSession>();
}
