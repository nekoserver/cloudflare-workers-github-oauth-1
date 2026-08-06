import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「answer-graph: 『この回答文のキーワード:』からキーワード
// を選んで再検索したとき、キーワード数0・経路「ー」の行を表示しない」トグル。
// デフォルトで有効(ON)であることを確認する。
describe('設定ページ: answer-graphの空行(キーワード数0・経路ー)非表示トグル', () => {
  it('answerGraphHideEmptyRowsを指定しない場合はデフォルトでON(チェック済み)表示になる', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('id="answerGraphHideEmptyRowsCheckbox"');
    expect(html).toMatch(/id="answerGraphHideEmptyRowsCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="answerGraphHideEmptyRowsLabel">ON<');
  });

  it("answerGraphHideEmptyRows='off'の場合はOFF(未チェック)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, answerGraphHideEmptyRows: 'off' });
    expect(html).not.toMatch(/id="answerGraphHideEmptyRowsCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="answerGraphHideEmptyRowsLabel">OFF<');
  });

  it("answerGraphHideEmptyRows='on'の場合はON(チェック済み)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, answerGraphHideEmptyRows: 'on' });
    expect(html).toMatch(/id="answerGraphHideEmptyRowsCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="answerGraphHideEmptyRowsLabel">ON<');
  });

  it('変更はonAnswerGraphHideEmptyRowsChangeで/api/settings/answer-graph-hide-empty-rowsへPOSTする', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('onchange="onAnswerGraphHideEmptyRowsChange()"');
    const fnIdx = html.indexOf('async function onAnswerGraphHideEmptyRowsChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("fetch('/api/settings/answer-graph-hide-empty-rows'");
    expect(fn).toContain('method: \'POST\'');
  });
});
