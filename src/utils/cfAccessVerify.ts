/**
 * CloudflareのWARP/Zero Trust Access ならびに Tunnel を経由した正規ユーザーの
 * ログインであることを証明するための検証ロジック。
 *
 * 信用してよいのは Cloudflare Access が発行する署名済みJWT
 * (`Cf-Access-Jwt-Assertion`ヘッダー、またはCookie `CF_Authorization`)だけで、
 * その他のヘッダー(Cf-Connecting-Ip等)はオリジン(本Worker)に届く時点で
 * クライアントや中間者に偽装される余地があるため、診断用の参考情報としてのみ
 * 扱い、本人証明の根拠には使わない。JWTの署名検証にはCloudflare Access側が
 * 公開する公開鍵セット(`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`)
 * を使う(対称鍵の共有シークレットではなく非対称鍵によるRS256署名のため、
 * この公開鍵セットの値自体は機密情報ではない)。
 */

export type AccessJwtPayload = {
  email?: string;
  aud?: string[] | string;
  iss?: string;
  exp?: number;
  iat?: number;
  identity_nonce?: string;
  [key: string]: unknown;
};

export type ParsedAccessJwt = {
  header: Record<string, unknown>;
  payload: AccessJwtPayload;
  signingInput: string;
  signature: Uint8Array;
};

function base64UrlToBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(padLength);
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const binary = atob(base64UrlToBase64(input));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToString(input: string): string {
  return new TextDecoder().decode(base64UrlDecodeToBytes(input));
}

/**
 * JWTを3パーツに分解し、ヘッダー・ペイロードをJSONとして解釈する(署名検証は行わない)。
 * 形式が不正(パーツ数・JSON解釈失敗)な場合はnullを返す。
 */
export function parseAccessJwt(token: string): ParsedAccessJwt | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return null;
  try {
    const header = JSON.parse(base64UrlDecodeToString(parts[0])) as Record<string, unknown>;
    const payload = JSON.parse(base64UrlDecodeToString(parts[1])) as AccessJwtPayload;
    const signature = base64UrlDecodeToBytes(parts[2]);
    return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature };
  } catch {
    return null;
  }
}

export type AccessCertsResponse = { keys: (JsonWebKey & { kid?: string })[] };

export async function fetchAccessCerts(teamDomain: string, fetchImpl: typeof fetch = fetch): Promise<AccessCertsResponse> {
  const res = await fetchImpl(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access証明書の取得に失敗しました: HTTP ${res.status}`);
  return res.json() as Promise<AccessCertsResponse>;
}

/**
 * CloudflareのAccess公開鍵セットでJWT署名(RS256)を検証する。
 * kidが一致する鍵があればそれだけ試し、無ければ全鍵を順に試す
 * (鍵のローテーション直後でkidが未知の場合の救済)。
 */
export async function verifyAccessJwtSignature(parsed: ParsedAccessJwt, certs: AccessCertsResponse): Promise<boolean> {
  const kid = typeof parsed.header.kid === 'string' ? parsed.header.kid : undefined;
  const keys = certs.keys ?? [];
  const matching = kid ? keys.filter((k) => k.kid === kid) : [];
  const candidates = matching.length ? matching : keys;

  for (const jwk of candidates) {
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      const ok = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        parsed.signature as BufferSource,
        new TextEncoder().encode(parsed.signingInput)
      );
      if (ok) return true;
    } catch {
      // この鍵では検証できなかった(形式不一致等)。次の候補を試す。
    }
  }
  return false;
}

/**
 * メールアドレスの@以降(ドメイン)が許可リストに含まれるか確認する。
 * 許可リストが未設定(空文字・undefined)の場合は「ドメイン制限なし」として
 * trueを返す(本チェックを要求しない設定として明示的に扱う)。
 */
export function isEmailAllowed(email: string | undefined, allowedDomainsCsv: string | undefined): boolean {
  if (!allowedDomainsCsv || !allowedDomainsCsv.trim()) return true;
  if (!email) return false;
  const domains = allowedDomainsCsv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!domains.length) return true;
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return false;
  const emailDomain = email.slice(atIndex + 1).toLowerCase();
  return domains.includes(emailDomain);
}

/**
 * JWTのaud(Application Audience Tag)が設定値と一致するか確認する。
 * 設定値が未設定の場合は「audチェックなし」としてtrueを返す。
 */
export function isAudValid(payload: AccessJwtPayload, expectedAud: string | undefined): boolean {
  if (!expectedAud || !expectedAud.trim()) return true;
  const aud = payload.aud;
  if (typeof aud === 'string') return aud === expectedAud;
  if (Array.isArray(aud)) return aud.includes(expectedAud);
  return false;
}

/** JWTのexpが現在時刻より過去なら期限切れとする。expが数値でない場合も不正(期限切れ扱い)とする。 */
export function isTokenExpired(payload: AccessJwtPayload, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  if (typeof payload.exp !== 'number') return true;
  return payload.exp < nowSeconds;
}

/**
 * リクエストのHostヘッダーが、Tunnel経由で期待される値と一致するか確認する
 * (*.workers.devへの直接アクセス等、Tunnel/Accessを経由しない経路を検知する目的)。
 * 期待値が未設定の場合は「チェックなし」としてtrueを返す。
 */
export function isHostAppropriate(hostHeader: string | undefined, expectedHost: string | undefined): boolean {
  if (!expectedHost || !expectedHost.trim()) return true;
  if (!hostHeader) return false;
  return hostHeader.toLowerCase() === expectedHost.trim().toLowerCase();
}

export type AccessVerificationConfig = {
  teamDomain?: string;
  expectedAud?: string;
  allowedEmailDomainsCsv?: string;
  expectedHost?: string;
};

export type AccessVerificationCheck = {
  key: string;
  label: string;
  /** 'pass'=合格, 'fail'=不合格, 'skipped'=未設定のため検証不能(合否に含めない) */
  status: 'pass' | 'fail' | 'skipped';
  detail: string;
};

export type AccessVerificationReport = {
  overall: 'pass' | 'fail';
  checks: AccessVerificationCheck[];
  email: string | null;
  jwtPayload: AccessJwtPayload | null;
};

/**
 * JWTの有無・解析結果・署名検証結果・各種設定値を受け取り、チェック一覧と
 * 総合判定をまとめる。署名検証(ネットワークアクセスを要する)は呼び出し元で
 * 事前に実行し、結果(signatureValid)だけをここへ渡す(本関数自体は純粋関数)。
 */
export function buildAccessVerificationReport(params: {
  rawToken: string | undefined;
  parsed: ParsedAccessJwt | null;
  signatureValid: boolean | null;
  hostHeader: string | undefined;
  config: AccessVerificationConfig;
  nowSeconds?: number;
}): AccessVerificationReport {
  const checks: AccessVerificationCheck[] = [];
  const { rawToken, parsed, signatureValid, hostHeader, config } = params;

  checks.push(rawToken
    ? { key: 'jwt_present', label: 'Access JWTの有無', status: 'pass', detail: 'Cf-Access-Jwt-Assertion(またはCF_Authorization Cookie)を受信しました' }
    : { key: 'jwt_present', label: 'Access JWTの有無', status: 'fail', detail: 'Access JWTが見つかりません。Cloudflare Accessを経由していないか、直接オリジンへアクセスしています' });

  checks.push(parsed
    ? { key: 'jwt_format', label: 'JWT形式の解析', status: 'pass', detail: 'ヘッダー・ペイロードをJSONとして解析できました' }
    : { key: 'jwt_format', label: 'JWT形式の解析', status: rawToken ? 'fail' : 'skipped', detail: rawToken ? 'JWTの形式が不正で解析できませんでした' : 'JWTが無いため解析できません' });

  if (!config.teamDomain) {
    checks.push({ key: 'jwt_signature', label: 'JWT署名検証', status: 'skipped', detail: 'CF_ACCESS_TEAM_DOMAINが未設定のため署名検証をスキップしました' });
  } else if (!parsed) {
    checks.push({ key: 'jwt_signature', label: 'JWT署名検証', status: 'fail', detail: 'JWTを解析できないため署名検証できません' });
  } else {
    checks.push(signatureValid
      ? { key: 'jwt_signature', label: 'JWT署名検証', status: 'pass', detail: 'Cloudflare Accessの公開鍵で署名を検証できました' }
      : { key: 'jwt_signature', label: 'JWT署名検証', status: 'fail', detail: '署名検証に失敗しました(偽装・改ざんの可能性)' });
  }

  const payload = parsed?.payload ?? null;

  if (payload) {
    const expired = isTokenExpired(payload, params.nowSeconds);
    checks.push(expired
      ? { key: 'jwt_expiry', label: 'JWT有効期限', status: 'fail', detail: '有効期限(exp)が切れています' }
      : { key: 'jwt_expiry', label: 'JWT有効期限', status: 'pass', detail: '有効期限内です' });

    const audValid = isAudValid(payload, config.expectedAud);
    checks.push(!config.expectedAud
      ? { key: 'jwt_aud', label: 'Application Audience Tag(aud)', status: 'skipped', detail: 'CF_ACCESS_AUDが未設定のためaudチェックをスキップしました' }
      : audValid
        ? { key: 'jwt_aud', label: 'Application Audience Tag(aud)', status: 'pass', detail: '期待するaudと一致しました' }
        : { key: 'jwt_aud', label: 'Application Audience Tag(aud)', status: 'fail', detail: '期待するaudと一致しません(別のAccessアプリケーション宛のトークンの可能性)' });

    const emailAllowed = isEmailAllowed(payload.email, config.allowedEmailDomainsCsv);
    checks.push(!config.allowedEmailDomainsCsv
      ? { key: 'email_domain', label: 'メールアドレスの許可ドメイン', status: 'skipped', detail: 'CF_ACCESS_ALLOWED_EMAIL_DOMAINSが未設定のためドメイン制限なし' }
      : emailAllowed
        ? { key: 'email_domain', label: 'メールアドレスの許可ドメイン', status: 'pass', detail: `${payload.email ?? ''} は許可ドメインに含まれます` }
        : { key: 'email_domain', label: 'メールアドレスの許可ドメイン', status: 'fail', detail: `${payload.email ?? '(メールアドレス無し)'} は許可ドメインに含まれません` });
  }

  const hostOk = isHostAppropriate(hostHeader, config.expectedHost);
  checks.push(!config.expectedHost
    ? { key: 'gateway_host', label: '通過ゲートウェイ(Host)の適否', status: 'skipped', detail: 'CF_ACCESS_EXPECTED_HOSTが未設定のためHostチェックをスキップしました' }
    : hostOk
      ? { key: 'gateway_host', label: '通過ゲートウェイ(Host)の適否', status: 'pass', detail: `Host: ${hostHeader ?? ''} は期待する経路と一致しました` }
      : { key: 'gateway_host', label: '通過ゲートウェイ(Host)の適否', status: 'fail', detail: `Host: ${hostHeader ?? '(無し)'} は期待する経路(${config.expectedHost})と一致しません。*.workers.devへの直接アクセス等、Tunnelを経由していない可能性があります` });

  const overall = checks.some((c) => c.status === 'fail') ? 'fail' : 'pass';

  return {
    overall,
    checks,
    email: typeof payload?.email === 'string' ? payload.email : null,
    jwtPayload: payload,
  };
}
