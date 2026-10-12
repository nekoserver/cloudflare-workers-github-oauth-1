import { describe, expect, it } from 'vitest';
import { buildWorkerSignatureMessage, signWorkerRequest, MAIN_WORKER_NAME } from './workerRequestSignature';

// 対象: CF-Worker + HMAC照合方式(CLAUDE.mdルール38)で他Workerへの
// リクエストを署名するユーティリティ。
//
// 故障シナリオ:
//   (1) 署名対象メッセージの各フィールドの区切り(改行)がずれ、呼び出し元と
//       受信側(他リポジトリ実装)で異なる文字列を署名してしまう
//   (2) methodの大文字小文字が呼び出し元と受信側でずれて署名不一致になる
//   (3) ヘッダー名・sha256=プレフィックスの付け忘れ

describe('buildWorkerSignatureMessage', () => {
  it('caller/timestamp/method/path/bodyを改行区切りで連結する', () => {
    const message = buildWorkerSignatureMessage(
      MAIN_WORKER_NAME,
      1733654400,
      'get',
      '/api/wspace/repo-check?repo=nekoserver%2Frailway',
      ''
    );
    expect(message).toBe(
      'cloudflare-workers-github-oauth-1\n1733654400\nGET\n/api/wspace/repo-check?repo=nekoserver%2Frailway\n'
    );
  });

  it('methodは常に大文字化される(呼び出し元のgetとGETで同じ署名になる)', () => {
    const lower = buildWorkerSignatureMessage('x', 1, 'get', '/p', 'body');
    const upper = buildWorkerSignatureMessage('x', 1, 'GET', '/p', 'body');
    expect(lower).toBe(upper);
  });
});

describe('signWorkerRequest', () => {
  it('3つのヘッダー(CF-Worker/CF-Worker-Timestamp/CF-Worker-Signature)を返す', async () => {
    const headers = await signWorkerRequest('secret123', MAIN_WORKER_NAME, 'GET', '/api/wspace/repo-check', '', 1733654400);
    expect(headers['CF-Worker']).toBe(MAIN_WORKER_NAME);
    expect(headers['CF-Worker-Timestamp']).toBe('1733654400');
    expect(headers['CF-Worker-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('同じ入力なら毎回同じ署名になる(決定的)', async () => {
    const a = await signWorkerRequest('secret123', 'x', 'GET', '/p', 'body', 1733654400);
    const b = await signWorkerRequest('secret123', 'x', 'GET', '/p', 'body', 1733654400);
    expect(a['CF-Worker-Signature']).toBe(b['CF-Worker-Signature']);
  });

  it('secretが異なれば署名も異なる', async () => {
    const a = await signWorkerRequest('secretA', 'x', 'GET', '/p', 'body', 1733654400);
    const b = await signWorkerRequest('secretB', 'x', 'GET', '/p', 'body', 1733654400);
    expect(a['CF-Worker-Signature']).not.toBe(b['CF-Worker-Signature']);
  });

  it('pathが異なれば署名も異なる(クエリ文字列の改ざんを検出できる)', async () => {
    const a = await signWorkerRequest('secret123', 'x', 'GET', '/p?repo=a', '', 1733654400);
    const b = await signWorkerRequest('secret123', 'x', 'GET', '/p?repo=b', '', 1733654400);
    expect(a['CF-Worker-Signature']).not.toBe(b['CF-Worker-Signature']);
  });
});
