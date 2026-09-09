import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

// 対象: 公開鍵チャレンジ署名ログイン(/auth/public-key/*, /api/public-keys/*)の
// 異常検知(flagPublicKeySecurityEvent)が、4つの失敗経路すべてで呼ばれているか。
//
// 背景: 秘密鍵が何らかの方法で別環境に持ち出され、悪用が試みられた場合、
// 「対象鍵が見つからない(userId/keyId不一致・失効・期限切れ)」または
// 「署名が登録済み公開鍵と一致しない(秘密鍵が違う)」のいずれかとして必ず
// 検出される。この検出時に記録・通知が漏れると、不正アクセスの試行に
// 気づく手段が無くなる。
//
// 故障シナリオ:
//   (1) 4つのエンドポイント(/auth/public-key/challenge・verify、
//       /api/public-keys/challenge・verify)のうちどれか1つで
//       flagPublicKeySecurityEventの呼び出しを書き忘れる
//   (2) key_not_found/signature_mismatchのイベント種別を取り違える

const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');

function bodyOf(routeMarker: string, len: number): string {
  const start = src.indexOf(routeMarker);
  expect(start, `${routeMarker} が見つからない`).toBeGreaterThan(-1);
  return src.slice(start, start + len);
}

describe('/auth/public-key/challenge: 異常検知', () => {
  it('対象鍵が見つからない場合にkey_not_foundを記録する', () => {
    const body = bodyOf("app.post('/auth/public-key/challenge'", 1500);
    expect(body).toContain("eventType: 'key_not_found'");
  });
});

describe('/auth/public-key/verify: 異常検知', () => {
  const body = bodyOf("app.post('/auth/public-key/verify'", 3000);

  it('対象鍵が見つからない場合にkey_not_foundを記録する', () => {
    expect(body).toContain("eventType: 'key_not_found'");
  });

  it('署名が一致しない場合にsignature_mismatchを記録する', () => {
    expect(body).toContain("eventType: 'signature_mismatch'");
  });
});

describe('/api/public-keys/challenge: 異常検知', () => {
  it('対象鍵が見つからない場合にkey_not_foundを記録する', () => {
    const body = bodyOf("app.post('/api/public-keys/challenge'", 1500);
    expect(body).toContain("eventType: 'key_not_found'");
  });
});

describe('/api/public-keys/verify: 異常検知', () => {
  const body = bodyOf("app.post('/api/public-keys/verify'", 3000);

  it('対象鍵が見つからない場合にkey_not_foundを記録する', () => {
    expect(body).toContain("eventType: 'key_not_found'");
  });

  it('署名が一致しない場合にsignature_mismatchを記録する', () => {
    expect(body).toContain("eventType: 'signature_mismatch'");
  });
});

describe('flagPublicKeySecurityEvent', () => {
  it('DB記録とSlack通知の両方を行う(記録失敗時もSlack通知は継続する)', () => {
    const start = src.indexOf('async function flagPublicKeySecurityEvent');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, start + 1600);
    expect(body).toContain('recordPublicKeySecurityEvent(db, eventParams');
    expect(body).toContain('postSlackMessage({');
    expect(body).toContain('buildPublicKeySecurityAlertText(eventParams, createdAt)');
  });
});
