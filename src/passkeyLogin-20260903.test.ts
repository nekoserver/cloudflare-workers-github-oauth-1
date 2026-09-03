import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

// 対象: /login ページの「公開鍵(パスキー)でログイン」導線、
// POST /auth/public-key/challenge・POST /auth/public-key/verify(未認証で呼べる
// チャレンジ署名ログイン)、finalizePasskeyLogin(src/index.ts)。
// 公開鍵登録(/public-keys, POST /api/public-keys 系)の続きとして、GitHub OAuthを
// 経由せずログインできるようにする機能。
//
// 故障シナリオ:
//   (1) finalizePasskeyLoginがupdateUserSessionを呼ぶ際、既存のuser_sessions行の
//       github_access_token/github_granted_scopesを引き継がずNULLで上書きしてしまい、
//       GitHub操作(コミット検索等、access_tokenを使う機能)が壊れる
//   (2) /auth/public-key/verify が challengeRow.key_id と body.keyId の不一致
//       (他の鍵になりすまして別ユーザーのチャレンジを使い回す)を見逃す
//   (3) POST /auth/public-key/challenge・verify が authMiddleware配下に置かれ、
//       未ログイン状態からそもそも呼べなくなる(パスキーログインの前提が崩れる)

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');
const loginSrc = fs.readFileSync(path.join(__dirname, 'views', 'login.ts'), 'utf-8');

describe('POST /auth/public-key/challenge, /verify は未認証で呼べる', () => {
  it('authMiddlewareを経由せずに定義されている', () => {
    expect(indexSrc).toContain("app.post('/auth/public-key/challenge', async (c) => {");
    expect(indexSrc).toContain("app.post('/auth/public-key/verify', async (c) => {");
  });
});

describe('finalizePasskeyLoginはgithub_access_tokenを引き継ぐ', () => {
  it('updateUserSessionにexisting.githubAccessToken/githubGrantedScopesを渡している', () => {
    const start = indexSrc.indexOf('async function finalizePasskeyLogin');
    expect(start).toBeGreaterThan(-1);
    const body = indexSrc.slice(start, start + 1200);
    expect(body).toContain('existing?.githubAccessToken ?? undefined');
    expect(body).toContain('existing?.githubGrantedScopes ?? undefined');
  });
});

describe('POST /auth/public-key/verify のチャレンジ検証', () => {
  it('challengeRow.key_id と body.keyId の不一致をkey_mismatchとして拒否する', () => {
    const start = indexSrc.indexOf("app.post('/auth/public-key/verify'");
    const body = indexSrc.slice(start, start + 3000);
    expect(body).toContain("challengeRow!.key_id !== keyId");
    expect(body).toContain("key_mismatch");
  });

  it('validateChallengeRowでチャレンジの有効性(期限切れ・二重使用・他ユーザー)を検証する', () => {
    const start = indexSrc.indexOf("app.post('/auth/public-key/verify'");
    const body = indexSrc.slice(start, start + 3000);
    expect(body).toContain('validateChallengeRow(challengeRow ?? null, userId, now)');
  });
});

describe('/loginページのパスキーログイン導線', () => {
  it('登録済み鍵をIndexedDBから列挙してボタンを表示する', () => {
    expect(loginSrc).toContain('listLocalKeys()');
    expect(loginSrc).toContain("document.getElementById('passkeySection').style.display = 'block'");
  });

  it('IndexedDBから読んだ秘密鍵でチャレンジに署名する', () => {
    expect(loginSrc).toContain("crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, data)");
  });
});
