/**
 * 対象: /cf-containersの画面から受け付けるSSH公開鍵と、操作前に入力させるHMACシークレットの照合。
 * 公開鍵はコンテナの/root/.ssh/authorized_keysへ追記するだけで、どこにも保存しない。
 */
const SUPPORTED_TYPES = [
  'ssh-ed25519',
  'ssh-rsa',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'sk-ssh-ed25519@openssh.com',
  'sk-ecdsa-sha2-nistp256@openssh.com',
];

export type PublicKeyLineResult =
  | { ok: true; value: string }
  | { ok: false; errorCode: 'EMPTY' | 'PRIVATE_KEY' | 'MULTILINE' | 'UNSUPPORTED_TYPE' | 'INVALID_BODY'; error: string };

export function validatePublicKeyLine(input: string): PublicKeyLineResult {
  const value = input.trim();
  if (!value) return { ok: false, errorCode: 'EMPTY', error: '公開鍵が空です' };
  if (value.includes('PRIVATE KEY')) return { ok: false, errorCode: 'PRIVATE_KEY', error: '秘密鍵は受け付けません。公開鍵(.pubの内容)を貼ってください' };
  if (/[\r\n]/.test(value)) return { ok: false, errorCode: 'MULTILINE', error: '公開鍵は1行で貼ってください' };
  const [keyType, body] = value.split(/\s+/);
  if (!SUPPORTED_TYPES.includes(keyType)) return { ok: false, errorCode: 'UNSUPPORTED_TYPE', error: `未対応の鍵種別です: ${keyType}` };
  if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return { ok: false, errorCode: 'INVALID_BODY', error: '公開鍵の本体(base64)が正しくありません' };
  return { ok: true, value: value.split(/\s+/).join(' ') };
}

/** 入力されたシークレットとサーバー側の値をタイミングセーフに比較する。サーバー側が未設定なら常に不一致。 */
export function hmacInputMatches(input: string, secret: string | undefined): boolean {
  if (!secret || !input || input.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) mismatch |= input.charCodeAt(i) ^ secret.charCodeAt(i);
  return mismatch === 0;
}

/** 共有のHMACシークレット(src/utils/redmineProxy.tsと同じ優先順)。 */
export function resolveOriginHmacSecret(env: { ORIGIN_HMAC_SECRET?: string; HMAC_SECRET?: string; REDMINE_HMAC_SECRET?: string }): string | undefined {
  return env.ORIGIN_HMAC_SECRET?.trim() || env.HMAC_SECRET?.trim() || env.REDMINE_HMAC_SECRET?.trim() || undefined;
}
