import { describe, it, expect } from 'vitest';
import { r9Signature, fetchR9Status } from './r9Gateway';

// 対象: /r9-statusページが使う、r9.nekomaneki.workへのHMAC署名付きGETリクエスト処理
// (src/utils/r9Gateway.ts)。deploy/redmine/のHMACゲートウェイと同じ方式
// (X-R9-Timestamp/X-R9-Nonce/X-R9-Signature、HMAC-SHA256)を採用する。
//
// 故障シナリオ:
//   (1) secretが空文字でも署名してしまう(本来はWorker側で未設定チェックすべきだが、
//       署名関数自体が空文字入力でも出力を返してしまうと気づきにくい)
//   (2) fetch自体が失敗(ネットワークエラー)した場合にcatchされず例外が伝播する
//   (3) HTTPステータスが異常(5xx等)でもok:trueとして扱ってしまう
//   (4) リダイレクトを追跡してしまう(署名ヘッダーが別ホストへ漏れる可能性)

describe('r9Signature', () => {
  it('同じ入力なら同じ署名を返す(決定的)', async () => {
    const a = await r9Signature('secret', 'GET', '/', '1700000000', 'nonce-1', '');
    const b = await r9Signature('secret', 'GET', '/', '1700000000', 'nonce-1', '');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('secretが異なれば署名も異なる', async () => {
    const a = await r9Signature('secret-a', 'GET', '/', '1700000000', 'nonce-1', '');
    const b = await r9Signature('secret-b', 'GET', '/', '1700000000', 'nonce-1', '');
    expect(a).not.toBe(b);
  });

  it('nonceやtimestampが異なれば署名も異なる(リプレイ耐性の前提)', async () => {
    const base = await r9Signature('secret', 'GET', '/', '1700000000', 'nonce-1', '');
    const diffNonce = await r9Signature('secret', 'GET', '/', '1700000000', 'nonce-2', '');
    const diffTime = await r9Signature('secret', 'GET', '/', '1700000001', 'nonce-1', '');
    expect(diffNonce).not.toBe(base);
    expect(diffTime).not.toBe(base);
  });
});

describe('fetchR9Status', () => {
  it('署名付きヘッダー(X-R9-Timestamp/X-R9-Nonce/X-R9-Signature)を付けてGETする', async () => {
    let capturedRequest: Request | null = null;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedRequest = new Request(input, init);
      return new Response('r9 ok', { status: 200 });
    }) as typeof fetch;
    const result = await fetchR9Status('test-secret', fetchImpl);
    expect(result).toEqual({ ok: true, status: 200, bodyText: 'r9 ok' });
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe('https://r9.nekomaneki.work/');
    expect(capturedRequest!.method).toBe('GET');
    expect(capturedRequest!.headers.get('X-R9-Timestamp')).toMatch(/^\d+$/);
    expect(capturedRequest!.headers.get('X-R9-Nonce')).toBeTruthy();
    expect(capturedRequest!.headers.get('X-R9-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('リダイレクトを追跡せず、302等はエラーとして扱う', async () => {
    const fetchImpl = (async () => new Response(null, { status: 302 })) as typeof fetch;
    const result = await fetchR9Status('test-secret', fetchImpl);
    expect(result).toEqual({
      ok: false,
      errorCode: 'redirect',
      detail: 'r9.nekomaneki.workがリダイレクトを返しました(ステータス302)。',
    });
  });

  it('HTTPエラーステータス(5xx等)はok:falseとして扱う(本文が200風でも誤判定しない)', async () => {
    const fetchImpl = (async () => new Response('internal error', { status: 503 })) as typeof fetch;
    const result = await fetchR9Status('test-secret', fetchImpl);
    expect(result).toEqual({ ok: false, errorCode: 'http_error', status: 503, detail: 'internal error' });
  });

  it('fetch自体が失敗(ネットワークエラー)した場合は例外を投げずok:falseを返す', async () => {
    const fetchImpl = (async () => { throw new Error('network down'); }) as typeof fetch;
    const result = await fetchR9Status('test-secret', fetchImpl);
    expect(result).toEqual({
      ok: false,
      errorCode: 'network_error',
      detail: 'r9.nekomaneki.workに接続できません: network down',
    });
  });

  it('応答本文が極端に大きい場合でも例外を投げない(500KiBで切り詰める)', async () => {
    const huge = 'x'.repeat(600 * 1024);
    const fetchImpl = (async () => new Response(huge, { status: 200 })) as typeof fetch;
    const result = await fetchR9Status('test-secret', fetchImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bodyText.length).toBe(500 * 1024);
    }
  });
});
