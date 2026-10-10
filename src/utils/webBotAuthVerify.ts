/**
 * /bot-auth-verify ページが使う、Cloudflareのweb-bot-authライブラリ
 * (https://github.com/cloudflare/web-bot-auth)による受信リクエスト検証処理。
 * CursorのBot等がWeb Bot Auth(HTTP Message Signatures、
 * draft-meunier-webbotauth-httpsig-protocol-00)で自己署名したリクエストを検証する。
 *
 * 署名者の公開鍵は固定で持たず、リクエストのSignature-Agentヘッダーが指す
 * Bot自身のkey directory(JSON Web Key Set)を都度取得して照合する
 * (CLAUDE.mdルール36と同じ考え方: 固定の鍵をハードコードせず、Botが
 * 公開している現在値を参照する)。
 */
import { verify, type UntrustedWebBotSignatureCandidate, type WebBotVerifier } from 'web-bot-auth';
import { verifierFromJWK } from 'web-bot-auth/crypto';

export type WebBotAuthVerifyResult =
  | { status: 'neutral' }
  | { status: 'valid'; keyid: string; algorithm: string; signatureAgentUri?: string; created: Date; expires: Date }
  | { status: 'invalid'; detail: string };

function base64UrlDigestFromArrayBuffer(digest: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * candidateのkeyidに一致する鍵を、Bot自身が公開するkey directory(JWKS)から探す。
 * kidが直接一致する場合を優先し、無ければJWK Thumbprint(RFC 7638)で照合する。
 */
async function resolveVerifierFromDirectory(
  candidate: UntrustedWebBotSignatureCandidate,
  fetchImpl: typeof fetch
): Promise<WebBotVerifier> {
  if (!candidate.signatureAgent) throw new Error('Signature-Agentヘッダーがありません');
  const response = await fetchImpl(candidate.signatureAgent.uri);
  if (!response.ok) throw new Error(`key directoryの取得に失敗しました: HTTP ${response.status}`);
  const directory = (await response.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
  if (!Array.isArray(directory.keys)) throw new Error('key directoryの形式が不正です(keys配列がありません)');

  for (const jwk of directory.keys) {
    if (jwk.kid === candidate.keyid) return verifierFromJWK(jwk);
  }
  const { jwkThumbprint } = await import('jsonwebkey-thumbprint');
  for (const jwk of directory.keys) {
    const thumbprint = await jwkThumbprint(
      jwk,
      (data) => crypto.subtle.digest('SHA-256', data),
      (digest) => base64UrlDigestFromArrayBuffer(digest)
    );
    if (thumbprint === candidate.keyid) return verifierFromJWK(jwk);
  }
  throw new Error(`key directoryに一致する鍵がありません(keyid: ${candidate.keyid})`);
}

/**
 * 受信リクエストを検証する。Signatureヘッダーが無ければneutral(未検証、
 * Bot以外の通常アクセスとして弾かない)を返す。検証に失敗した場合も例外を
 * 投げずinvalidを返す。
 */
export async function verifyIncomingBotRequest(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<WebBotAuthVerifyResult> {
  if (!request.headers.get('Signature')) return { status: 'neutral' };

  try {
    const verified = await verify(request, {
      resolver: (candidate) => resolveVerifierFromDirectory(candidate, fetchImpl),
    });
    return {
      status: 'valid',
      keyid: verified.keyid,
      algorithm: verified.verifier.algorithm,
      signatureAgentUri: verified.signatureAgent?.uri,
      created: verified.created,
      expires: verified.expires,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: 'invalid', detail };
  }
}
