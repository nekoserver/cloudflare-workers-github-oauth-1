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

/**
 * 入力されたシークレットとサーバー側の値をタイミングセーフに比較する。
 * 前後の空白・改行は無視する(貼り付けで混入するため)。サーバー側が未設定なら常に不一致。
 */
export function hmacInputMatches(input: string, secret: string | undefined): boolean {
  const a = input.trim();
  const b = secret?.trim() ?? '';
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < b.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** 共有のHMACシークレットの候補(設定されているものすべて。値が別々に設定されていてもどれかと一致すればよい)。 */
export function resolveOriginHmacSecrets(env: { ORIGIN_HMAC_SECRET?: string; HMAC_SECRET?: string; REDMINE_HMAC_SECRET?: string }): string[] {
  return [env.ORIGIN_HMAC_SECRET, env.HMAC_SECRET, env.REDMINE_HMAC_SECRET]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);
}

/** 入力がいずれかの候補と一致するか。候補が無ければ不一致。 */
export function hmacInputMatchesAny(input: string, secrets: string[]): boolean {
  let matched = false;
  for (const secret of secrets) {
    if (hmacInputMatches(input, secret)) matched = true;
  }
  return matched;
}

export type AuthorizedKeyResponse =
  | { ok: true; added: boolean; message?: string }
  | { ok: false; error: string };

/**
 * コンテナ(server.js /admin/authorized-keys)の応答を解釈する。
 * 応答に ok: true が無ければ、追記できたとはみなさない。古いイメージのコンテナは
 * どのパスにも200のJSONを返すため、ステータスだけで成功と判断すると誤表示になる。
 */
export function parseAuthorizedKeyResponse(status: number, text: string): AuthorizedKeyResponse {
  let data: { ok?: unknown; added?: unknown; message?: unknown; error?: unknown } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (status >= 200 && status < 300 && data?.ok === true) {
    return { ok: true, added: data.added !== false, message: typeof data.message === 'string' ? data.message : undefined };
  }
  if (typeof data?.error === 'string') return { ok: false, error: data.error };
  return {
    ok: false,
    error: `コンテナが公開鍵の追記に対応していません(HTTP ${status})。コンテナが古いイメージのまま動いている可能性があります。コンテナの更新(デプロイ)が必要です`,
  };
}
