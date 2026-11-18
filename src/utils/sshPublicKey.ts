/**
 * 対象: /cf-containersの管理画面から登録するSSH公開鍵の検証と、登録済み鍵への
 * 追加(重複排除)。秘密鍵は受け付けない。
 *
 * 失敗は文字列prefixではなくerrorCodeで表現する。鍵の種別と本体の先頭に
 * 書かれた種別名が一致するかも確認し、貼り間違いを早く弾く。
 */
const SUPPORTED_TYPES = [
  'ssh-ed25519',
  'ssh-rsa',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'sk-ssh-ed25519@openssh.com',
  'sk-ecdsa-sha2-nistp256@openssh.com',
] as const;

export type SshPublicKeyErrorCode =
  | 'EMPTY'
  | 'PRIVATE_KEY'
  | 'MULTILINE'
  | 'UNSUPPORTED_TYPE'
  | 'INVALID_BODY'
  | 'TYPE_MISMATCH';

export type SshPublicKeyResult =
  | { ok: true; value: string; keyType: string; body: string }
  | { ok: false; errorCode: SshPublicKeyErrorCode; error: string };

const MAX_LENGTH = 16_384;

function fail(errorCode: SshPublicKeyErrorCode, error: string): SshPublicKeyResult {
  return { ok: false, errorCode, error };
}

/** base64の本体の先頭(uint32長 + 文字列)が鍵種別と一致するか確かめる。 */
function bodyStartsWithType(body: string, keyType: string): boolean {
  let bytes: Uint8Array;
  try {
    const binary = atob(body);
    bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return false;
  }
  if (bytes.length < 4) return false;
  const length = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  if (length !== keyType.length || bytes.length < 4 + length) return false;
  const name = String.fromCharCode(...bytes.slice(4, 4 + length));
  return name === keyType;
}

export function validateSshPublicKey(input: string): SshPublicKeyResult {
  const trimmed = input.trim();
  if (!trimmed) return fail('EMPTY', '公開鍵が空です');
  if (trimmed.length > MAX_LENGTH) return fail('INVALID_BODY', '公開鍵が長すぎます');
  if (/PRIVATE KEY/.test(trimmed)) return fail('PRIVATE_KEY', '秘密鍵は登録できません。公開鍵(.pub の内容)を貼ってください');
  if (/[\r\n]/.test(trimmed)) return fail('MULTILINE', '公開鍵は1行で貼ってください');

  const parts = trimmed.split(/\s+/);
  const [keyType, body] = parts;
  if (!(SUPPORTED_TYPES as readonly string[]).includes(keyType)) {
    return fail('UNSUPPORTED_TYPE', `未対応の鍵種別です: ${keyType}`);
  }
  if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    return fail('INVALID_BODY', '公開鍵の本体(base64)が正しくありません');
  }
  if (!bodyStartsWithType(body, keyType)) {
    return fail('TYPE_MISMATCH', '鍵種別と公開鍵の本体が一致しません');
  }
  return { ok: true, value: trimmed, keyType, body };
}

/**
 * 既存の鍵一覧へ追加する。種別と本体が同じ鍵は、コメントが違っても重複扱いにする。
 */
export function addSshPublicKey(existing: string[], value: string): { added: boolean; keys: string[] } {
  const identity = (key: string) => key.trim().split(/\s+/).slice(0, 2).join(' ');
  const target = identity(value);
  if (existing.some((key) => identity(key) === target)) {
    return { added: false, keys: existing };
  }
  return { added: true, keys: [...existing, value] };
}

/** Originヘッダが要求URLと同じオリジンか(ポートを含めて比較する)。Originが無ければfalse。 */
export function isSameOrigin(originHeader: string | undefined, requestUrl: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
