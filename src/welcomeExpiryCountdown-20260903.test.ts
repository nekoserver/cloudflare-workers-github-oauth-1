import { describe, it, expect } from 'vitest';
import { getWelcomePage } from './views/welcome';

// 対象: /welcomeページの「セッションの有効期限」表示に追加した
// 「⏱️ カウントダウンに登録」ボタン。既存の /countdown 機能(POST /api/countdown)
// にセッション期限をそのまま登録できるようにする。
//
// 故障シナリオ:
//   (1) expiresAtTimestampが無い(未ログイン相当の呼び出し)場合にボタンだけ描画され、
//       クリックしてもJS未定義でエラーになる(ボタンとJSの両方が同じ条件で
//       出し分けられていることを保証する)
//   (2) POST /api/countdown に渡すtargetAtが、画面表示中のカウントダウン計算と
//       異なる時刻(再計算による誤差)になる

describe('getWelcomePage: セッション期限のカウントダウン登録ボタン', () => {
  const baseUser = {
    username: 'octocat',
    expiresAt: '2026-09-03 12:00:00',
    expiresAtTimestamp: 1893456000,
    sessionDuration: '1h',
  };

  it('expiresAtTimestampがある場合、ボタンとハンドラの両方が出力される', () => {
    const html = getWelcomePage(baseUser);
    expect(html).toContain('id="countdownRegisterBtn"');
    expect(html).toContain('onclick="registerExpiryCountdown()"');
    expect(html).toContain('window.registerExpiryCountdown = function()');
  });

  it('expiresAtTimestampが無い場合、ボタンもハンドラも出力されない', () => {
    const html = getWelcomePage({ username: 'octocat' });
    expect(html).not.toContain('id="countdownRegisterBtn"');
    expect(html).not.toContain('window.registerExpiryCountdown');
  });

  it('POST /api/countdownへ、画面表示中と同じexpiresAtTimestamp由来のtargetAtを送る', () => {
    const html = getWelcomePage(baseUser);
    const start = html.indexOf('window.registerExpiryCountdown');
    const body = html.slice(start, start + 700);
    expect(body).toContain("fetch('/api/countdown'");
    expect(body).toContain('new Date(expiresAtTimestamp * 1000).toISOString()');
  });
});
