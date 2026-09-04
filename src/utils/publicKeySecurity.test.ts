import { describe, it, expect, vi } from 'vitest';
import { buildPublicKeySecurityAlertText, recordPublicKeySecurityEvent, type PublicKeySecurityEventDb } from './publicKeySecurity';

// 対象: 公開鍵チャレンジ署名ログインの異常検知(対象鍵が見つからない・署名が
// 一致しない)を記録・通知するsrc/utils/publicKeySecurity.tsの純粋関数群。
//
// 故障シナリオ:
//   (1) Slack通知本文に誰(userId)・どの鍵(keyId)・何が起きたか(eventType/detail)・
//       いつ(createdAt)・どこから(ip)のいずれかが欠落し、調査に使えない
//   (2) DB記録のSQL/バインド順がテーブル定義(id, user_id, key_id, event_type,
//       detail, ip, created_at)とずれ、誤った列に値が入る

describe('buildPublicKeySecurityAlertText', () => {
  it('ユーザー・鍵ID・種別・詳細・IP・時刻をすべて含む', () => {
    const text = buildPublicKeySecurityAlertText({
      userId: 'octocat', keyId: 'key-1', eventType: 'signature_mismatch',
      detail: '署名が一致しない', ip: '203.0.113.1',
    }, '2026-09-04T00:00:00.000Z');
    expect(text).toContain('octocat');
    expect(text).toContain('key-1');
    expect(text).toContain('signature_mismatch');
    expect(text).toContain('署名が一致しない');
    expect(text).toContain('203.0.113.1');
    expect(text).toContain('2026-09-04T00:00:00.000Z');
    expect(text).toContain('[セキュリティ警告]');
  });
});

describe('recordPublicKeySecurityEvent', () => {
  it('public_key_security_eventsへ正しい列順でINSERTする', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const db: PublicKeySecurityEventDb = { prepare };

    await recordPublicKeySecurityEvent(
      db,
      { userId: 'octocat', keyId: 'key-1', eventType: 'key_not_found', detail: '見つからない', ip: '203.0.113.1' },
      'evt-1',
      '2026-09-04T00:00:00.000Z'
    );

    expect(prepare).toHaveBeenCalledWith(
      'INSERT INTO public_key_security_events (id, user_id, key_id, event_type, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    expect(bind).toHaveBeenCalledWith(
      'evt-1', 'octocat', 'key-1', 'key_not_found', '見つからない', '203.0.113.1', '2026-09-04T00:00:00.000Z'
    );
    expect(run).toHaveBeenCalled();
  });
});
