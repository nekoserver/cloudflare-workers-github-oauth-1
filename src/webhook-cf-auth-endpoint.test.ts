import { describe, expect, it } from 'vitest';
import app from './index';

// 対象: POST /webhook/cf-auth (dynamicnekoからのログイン等イベント通知を受ける
// エンドポイント)。CF_AUTH_WEBHOOK_SECRETの有無・署名の正当性でハンドラの
// 分岐が正しく切り替わることを、実際にHono appへリクエストを投げて確認する。
//
// このテストが書かれるまで、このエンドポイントを実際にリクエストで叩いて
// 検証するテストが存在しなかった(CF_AUTH_WEBHOOK_SECRETを使う別の設定APIの
// テストはあったが、このwebhookハンドラ自体は未検証だった)。
//
// 故障シナリオ:
//   (1) CF_AUTH_WEBHOOK_SECRET未設定時に500以外を返してしまう、またはメッセージが変わる
//   (2) 正しいシークレット・正しい署名なのに401/500になってしまう
//     (例: importKey/signの実装ミス、ヘッダー名の綴り間違いなど)
//   (3) 署名が不正なのに200/OKを返してしまう(検証がバイパスされる)
//   (4) 有効なペイロードなのにusernameが抽出できず400になる

async function signPayload(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

describe('POST /webhook/cf-auth', () => {
  it('CF_AUTH_WEBHOOK_SECRET未設定のとき、500と固定メッセージを返す', async () => {
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'octocat' }),
    }, {});
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Webhook endpoint is not available' });
  });

  it('CF_AUTH_WEBHOOK_SECRET設定済みでも、署名ヘッダーが無ければ401', async () => {
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'octocat' }),
    }, { CF_AUTH_WEBHOOK_SECRET: 'correct-secret' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized webhook' });
  });

  it.each([
    ['Bearer付き', 'Bearer correct-secret'],
    ['シークレットのみ', 'correct-secret'],
  ])('Authorizationが%sでもX-Hub-Signature-256の代わりにはならない', async (_label, authorization) => {
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({ username: 'octocat' }),
    }, { CF_AUTH_WEBHOOK_SECRET: 'correct-secret' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized webhook' });
  });

  it('CF_AUTH_WEBHOOK_SECRET設定済みでも、署名が不正な値なら401', async () => {
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=deadbeef' },
      body: JSON.stringify({ username: 'octocat' }),
    }, { CF_AUTH_WEBHOOK_SECRET: 'correct-secret' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized webhook' });
  });

  it('正しいシークレットで署名した正当なリクエストは401にならず、判定結果を返す(DB未設定時はNG)', async () => {
    const secret = 'correct-secret';
    const body = JSON.stringify({ username: 'octocat', event: 'login', action: 'success' });
    const signature = await signPayload(body, secret);
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body,
    }, { CF_AUTH_WEBHOOK_SECRET: secret });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'NG', user: 'octocat' });
  });

  it('シークレットが正しくても、送信側が別のシークレットで署名していれば401になる(シークレット不一致の再現)', async () => {
    const body = JSON.stringify({ username: 'octocat' });
    const signature = await signPayload(body, 'sender-side-secret');
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body,
    }, { CF_AUTH_WEBHOOK_SECRET: 'worker-side-secret' });
    expect(response.status).toBe(401);
  });

  it('署名は正しいがusernameを抽出できないペイロードは400を返す', async () => {
    const secret = 'correct-secret';
    const body = JSON.stringify({ event: 'login' });
    const signature = await signPayload(body, secret);
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body,
    }, { CF_AUTH_WEBHOOK_SECRET: secret });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ result: 'NG', reason: 'username not found in payload' });
  });

  // dynamicnekoのリポジトリに設定したGitHubネイティブのpush webhookを
  // そのまま/webhook/cf-authへ転送しているケース。イベント種別はJSON本文の
  // "event"キーではなくX-GitHub-Eventヘッダーで送られ、ユーザー名に相当する
  // フィールドはトップレベルにはなく pusher.name / sender.login にしかない。
  it('GitHubネイティブのpush webhookペイロード(pusher.name)からユーザー名を抽出しOK/NG判定する', async () => {
    const secret = 'correct-secret';
    const body = JSON.stringify({
      ref: 'refs/heads/main',
      pusher: { name: 'nekoserver', email: 'nekoserver@example.com' },
      sender: { login: 'nekoserver' },
    });
    const signature = await signPayload(body, secret);
    const response = await app.request('/webhook/cf-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
      },
      body,
    }, { CF_AUTH_WEBHOOK_SECRET: secret });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'NG', user: 'nekoserver' });
  });
});
