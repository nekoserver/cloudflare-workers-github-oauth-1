import { describe, it, expect } from 'vitest';
import { getSessionExpiredPage } from './views/session-expired';
import { getLoginPage } from './views/login';

// 対象: セッション期限切れページ(getSessionExpiredPage)・ログインページ(getLoginPage)の
// return_to 引き回し。認証済みページ(例: /webgl-heritage)でセッションが切れた場合、
// 再ログイン後に元のページへ戻れるように、期限切れページ→トップページ→GitHubログイン
// までの一連の遷移で return_to パラメータを保持する。
//
// 故障シナリオ:
//   (1) return_to が渡されているのに反映されず、常にトップ('/')へ飛ばされてしまう
//   (2) return_to にオープンリダイレクト攻撃パターン(絶対URL・//始まり・..)が
//       渡された場合にそのまま埋め込んでしまう
//   (3) return_to が未指定の場合に不正な値('undefined'文字列等)が埋め込まれてしまう

describe('getSessionExpiredPage: return_to の引き回し', () => {
  it('return_to が未指定の場合は / にリダイレクトする', () => {
    const html = getSessionExpiredPage();
    expect(html).toContain("window.location.href = \"/\"");
  });

  it('有効な return_to が指定された場合は /?return_to=... にリダイレクトする', () => {
    const html = getSessionExpiredPage('/webgl-heritage');
    expect(html).toContain('window.location.href = "/?return_to=%2Fwebgl-heritage"');
  });

  it('オープンリダイレクト攻撃パターンの return_to は無視されて / にリダイレクトする', () => {
    const html = getSessionExpiredPage('https://evil.com');
    expect(html).toContain("window.location.href = \"/\"");
    expect(html).not.toContain('evil.com');
  });
});

describe('getLoginPage: return_to の引き回し', () => {
  it('return_to が未指定の場合は /auth/github にリンクする', () => {
    const html = getLoginPage();
    expect(html).toContain('href="/auth/github" class="github-btn"');
  });

  it('有効な return_to が指定された場合は /auth/github?return_to=... にリンクする', () => {
    const html = getLoginPage('/webgl-heritage');
    expect(html).toContain('href="/auth/github?return_to=%2Fwebgl-heritage" class="github-btn"');
  });

  it('オープンリダイレクト攻撃パターンの return_to は無視されて /auth/github にリンクする', () => {
    const html = getLoginPage('//evil.com');
    expect(html).toContain('href="/auth/github" class="github-btn"');
    expect(html).not.toContain('evil.com');
  });
});
