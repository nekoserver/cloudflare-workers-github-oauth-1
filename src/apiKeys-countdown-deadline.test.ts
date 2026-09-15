import { describe, it, expect } from 'vitest';
import { getApiKeysPage } from './views/apiKeys';
import { getWelcomePage } from './views/welcome';
import { API_KEY_DEADLINE_LABEL, getCountdownRegisterScript } from './utils/countdownRegister';

// 対象: /api-keys でキー発行したあと、welcome と同じ
// window.registerCountdownEvent (POST /api/countdown) を label=PK期限 で呼ぶ処理。
//
// 故障シナリオ:
//   (1) 共通スクリプトを api-keys に埋め込まず registerCountdownEvent が未定義
//   (2) 発行した expiresAt ではなく別の日時を送る
//   (3) ラベルが PK期限 ではない
//   (4) 無期限キーでも POST してしまう
//   (5) confirmNavigate を true のままにして生キーモーダルから遷移する
//   (6) welcome 側の登録ボタンが共通関数を使わず、二重実装のまま分岐する

describe('🔑キー管理ページ: 発行後に共通ライブラリで PK期限 を予約する', () => {
  const html = getApiKeysPage({ name: 'テストユーザー', username: 'testuser' });

  it('共通の registerCountdownEvent スクリプトを埋め込む', () => {
    expect(html).toContain('window.registerCountdownEvent = function(opts)');
    expect(getCountdownRegisterScript()).toContain("fetch('/api/countdown'");
  });

  it('発行成功後に registerApiKeyDeadlineCountdown(res.data.key.expiresAt) を呼ぶ', () => {
    expect(html).toContain('showRawKeyModal(res.data.rawKey)');
    expect(html).toContain('registerApiKeyDeadlineCountdown(res.data.key && res.data.key.expiresAt)');
  });

  it('有効期限があるときは label=PK期限 と expiresAt を共通関数へ渡す', () => {
    const idx = html.indexOf('function registerApiKeyDeadlineCountdown(expiresAt)');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('registerCountdownEvent({');
    expect(block).toContain(`label: ${JSON.stringify(API_KEY_DEADLINE_LABEL)}`);
    expect(block).toContain('targetAt: expiresAt');
    expect(API_KEY_DEADLINE_LABEL).toBe('PK期限');
  });

  it('無期限(expiresAt無し)では POST せず、無期限である旨だけ出す', () => {
    const idx = html.indexOf('function registerApiKeyDeadlineCountdown(expiresAt)');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('if (!expiresAt)');
    expect(block).toContain('無期限のためカウントダウンには登録しませんでした');
  });

  it('生キーを消さないよう confirmNavigate は false', () => {
    const idx = html.indexOf('function registerApiKeyDeadlineCountdown(expiresAt)');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('confirmNavigate: false');
  });

  it('発行モーダルに countdownNotice 要素がある', () => {
    expect(html).toContain('id="countdownNotice"');
  });
});

describe('/welcome: セッション期限ボタンも同じ共通ライブラリを使う', () => {
  const html = getWelcomePage({
    username: 'octocat',
    expiresAt: '2026-09-03 12:00:00',
    expiresAtTimestamp: 1893456000,
    sessionDuration: '1h',
  });

  it('共通スクリプトを埋め込み、registerExpiryCountdown から registerCountdownEvent を呼ぶ', () => {
    expect(html).toContain('window.registerCountdownEvent = function(opts)');
    const start = html.indexOf('window.registerExpiryCountdown');
    const body = html.slice(start, start + 700);
    expect(body).toContain('window.registerCountdownEvent({');
    expect(body).toContain('label: "セッション有効期限"');
    expect(body).toContain('new Date(expiresAtTimestamp * 1000).toISOString()');
    expect(body).toContain('confirmNavigate: true');
    expect(body).not.toContain("fetch('/api/countdown'");
  });
});
