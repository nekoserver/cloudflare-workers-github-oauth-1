import { describe, it, expect } from 'vitest';
import { getApiKeysPage } from './views/apiKeys';
import { getWelcomePage } from './views/welcome';
import { getCountdownRegisterScript } from './utils/countdownRegister';

// 対象: /api-keys でキー発行したあと、welcome と同じ
// window.registerCountdownEvent で POST /api/countdown する処理。
// label はトースト/ウィジェットに出る予定名で、api-keys では 'PK期限' を渡す。
//
// 故障シナリオ:
//   (1) 共通スクリプトを api-keys に埋め込まず registerCountdownEvent が未定義
//   (2) 発行した expiresAt ではなく別の日時を送る
//   (3) 予定名(label)が PK期限 ではない
//   (4) 無期限キーでも POST してしまう
//   (5) confirmNavigate を true のままにして生キーモーダルから遷移する
//   (6) welcome 側の登録ボタンが共通関数を使わず、二重実装のまま分岐する

describe('🔑キー管理ページ: 発行後に共通登録関数へ予定名と期限を渡す', () => {
  const html = getApiKeysPage({ name: 'テストユーザー', username: 'testuser' });

  it('共通の registerCountdownEvent スクリプトを埋め込む', () => {
    expect(html).toContain('window.registerCountdownEvent = function(opts)');
    expect(getCountdownRegisterScript()).toContain("fetch('/api/countdown'");
  });

  it('発行成功後に expiresAt を targetAt、予定名 PK期限 を label として渡す', () => {
    const idx = html.indexOf('function createApiKey()');
    const block = html.slice(idx, idx + 1800);
    expect(block).toContain('registerCountdownEvent({');
    expect(block).toContain("label: 'PK期限'");
    expect(block).toContain('targetAt: res.data.key.expiresAt');
    expect(block).toContain('confirmNavigate: false');
  });

  it('無期限(expiresAt無し)では POST せず、無期限である旨だけ出す', () => {
    const idx = html.indexOf('function createApiKey()');
    const block = html.slice(idx, idx + 1800);
    expect(block).toContain('if (res.data.key && res.data.key.expiresAt)');
    expect(block).toContain('無期限のためカウントダウンには登録しませんでした');
  });

  it('発行モーダルに登録結果の表示枠がある', () => {
    expect(html).toContain('id="countdownNotice"');
  });
});

describe('/welcome: セッション期限ボタンも同じ共通関数を使う', () => {
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
    expect(body).toContain("label: 'セッション有効期限'");
    expect(body).toContain('new Date(expiresAtTimestamp * 1000).toISOString()');
    expect(body).toContain('confirmNavigate: true');
    expect(body).not.toContain("fetch('/api/countdown'");
  });
});
