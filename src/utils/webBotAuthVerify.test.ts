import { describe, it, expect } from 'vitest';
import { signerFromJWK } from 'web-bot-auth/crypto';
import { sign, generateNonce } from 'web-bot-auth';
import { verifyIncomingBotRequest } from './webBotAuthVerify';

// 対象: /bot-auth-verify ページが使う、Cloudflareのweb-bot-authライブラリによる
// 受信リクエスト検証処理(src/utils/webBotAuthVerify.ts)。CursorのBotなど
// Web Bot Auth(HTTP Message Signatures)で自己署名したリクエストを検証し、
// 署名者の鍵をBot自身が公開するkey directory(Signature-AgentヘッダーのURI)
// から取得して照合する。
//
// 故障シナリオ:
//   (1) Signatureヘッダーが無いリクエストを「不合格」と誤判定する(本来は
//       「未検証(neutral)」であり、Bot以外の通常アクセスを弾いてはいけない)
//   (2) key directoryの取得に失敗した場合に例外が伝播し、ページ全体が落ちる
//   (3) key directory内に候補のkeyidと一致する鍵が無い場合でも検証成功と
//       誤判定する
//   (4) 署名を改ざんされたリクエストを合格と誤判定する

// RFC 9421 Appendix B.1.4のテスト用鍵(READMEに記載の公開テストベクタ)。
const TEST_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  alg: 'EdDSA',
  kid: 'test-key-ed25519',
  d: 'n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU',
  x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs',
};
const TEST_PUBLIC_JWK = { kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', kid: 'test-key-ed25519', x: TEST_JWK.x };

async function buildSignedRequest(): Promise<Request> {
  const signatureAgent = 'sig1="https://bot.example.test";type=directory';
  const base = new Request('https://example.com/bot-auth-verify', { headers: { 'Signature-Agent': signatureAgent } });
  const now = new Date();
  const fields = await sign(base, {
    signer: await signerFromJWK(TEST_JWK),
    created: now,
    expires: new Date(now.getTime() + 300_000),
    nonce: generateNonce(),
  });
  return new Request('https://example.com/bot-auth-verify', {
    headers: {
      Signature: fields.signature,
      'Signature-Agent': signatureAgent,
      'Signature-Input': fields.signatureInput,
    },
  });
}

describe('verifyIncomingBotRequest', () => {
  it('Signatureヘッダーが無いリクエストはneutral(未検証)を返す(弾かない)', async () => {
    const request = new Request('https://example.com/bot-auth-verify');
    const result = await verifyIncomingBotRequest(request, async () => new Response('{}'));
    expect(result.status).toBe('neutral');
  });

  it('key directoryの鍵と一致する正しい署名はvalidを返す', async () => {
    const request = await buildSignedRequest();
    const fetchImpl = async () => new Response(JSON.stringify({ keys: [TEST_PUBLIC_JWK] }), { status: 200 });
    const result = await verifyIncomingBotRequest(request, fetchImpl);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      // keyidはJWK Thumbprint(RFC 7638)であり固定の読める文字列ではないため、
      // 存在することと一致する候補が見つかったことだけを確認する。
      expect(result.keyid.length).toBeGreaterThan(0);
      expect(result.algorithm).toBe('ed25519');
    }
  });

  it('key directoryの取得に失敗した場合は例外を投げずinvalidを返す', async () => {
    const request = await buildSignedRequest();
    const fetchImpl = async () => new Response('not found', { status: 404 });
    const result = await verifyIncomingBotRequest(request, fetchImpl);
    expect(result.status).toBe('invalid');
  });

  it('key directoryに一致する鍵が無い場合はinvalidを返す(別の鍵材料)', async () => {
    const request = await buildSignedRequest();
    // x座標(鍵材料そのもの)が異なる別鍵。JWK Thumbprintはkty/crv/xで決まるため
    // kidだけ変えた鍵では区別にならない(x自体を変える必要がある)。
    const otherKey = {
      kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', kid: 'other-key',
      x: 'G5PDK1eXI7gkPz5zWn7KyK0qXwYbWQjF3kH1xJaH3Qo',
    };
    const fetchImpl = async () => new Response(JSON.stringify({ keys: [otherKey] }), { status: 200 });
    const result = await verifyIncomingBotRequest(request, fetchImpl);
    expect(result.status).toBe('invalid');
  });

  it('署名バイト列を改ざんされたリクエストはinvalidを返す(鍵は正しい)', async () => {
    const request = await buildSignedRequest();
    const originalSignature = request.headers.get('Signature')!;
    // sig1=:<base64>: の中身を1バイト変えて署名を無効化する(鍵・他ヘッダーは正しいまま)。
    const tamperedSignature = originalSignature.replace(/:([A-Za-z0-9+/=]{10})/, (m, b64) => {
      const flipped = b64[0] === 'A' ? 'B' : 'A';
      return ':' + flipped + b64.slice(1);
    });
    expect(tamperedSignature).not.toBe(originalSignature);
    const tampered = new Request(request.url, { headers: request.headers });
    tampered.headers.set('Signature', tamperedSignature);
    const fetchImpl = async () => new Response(JSON.stringify({ keys: [TEST_PUBLIC_JWK] }), { status: 200 });
    const result = await verifyIncomingBotRequest(tampered, fetchImpl);
    expect(result.status).toBe('invalid');
  });
});
