import { describe, expect, it } from 'vitest';
import { getPublicKeysPage } from './views/publicKeys';

/**
 * 対象: /public-keys ページ(getPublicKeysPage)の登録完了バナー(#registrationResult)。
 *
 * 背景: PR 6871037で追加した登録完了バナーが、鍵一覧<table>の直前に
 * 通常のブロック要素として挿入されていた。バナーが表示されるとその分だけ
 * テーブルが下に押し下げられ、各行の「照合テスト」「失効」ボタンの画面上の
 * 位置がずれる不具合が実際にユーザーから報告された(「ボタンの位置もなぜか
 * 変わってる」)。
 *
 * 故障シナリオ: バナーが static/block のままレイアウトに参加していると、
 * 表示のたびに後続要素(テーブル・ボタン)が押し下げられる。
 *
 * 対処方針: バナーを position: fixed の通知(既存の.settings-toastと同じ
 * パターン)にし、ドキュメントフローから外す。これにより表示/非表示に
 * かかわらずテーブル・ボタンの位置は変わらない。
 */
describe('/public-keys: 登録完了バナーがテーブルの位置をずらさない', () => {
  const html = getPublicKeysPage({ name: 'Test', username: 'test-user' });

  it('.registration-resultはposition: fixedで、ドキュメントフローに参加しない', () => {
    const ruleMatch = html.match(/\.registration-result\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    expect(ruleMatch![1]).toContain('position: fixed');
  });

  it('既存の登録完了バナーの要素・ロジックは維持されている(回帰防止)', () => {
    expect(html).toContain('id="registrationResult"');
    expect(html).toContain('role="status"');
    expect(html).toContain('id="countdownPageLink" href="/countdown"');
    expect(html).toContain('showRegistrationResult(res.data.countdownNotice, res.data.countdown)');
  });
});
