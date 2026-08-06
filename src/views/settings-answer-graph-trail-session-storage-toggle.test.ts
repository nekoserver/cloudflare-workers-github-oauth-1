import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「answer-graph: パン屑リスト(選択履歴の足跡)をブラウザの
// sessionStorageに保存し、リロード後も復元する」トグル。足跡には検索履歴・
// 回答内容に由来する情報が含まれるため、デフォルトOFF(同意なく保存しない)
// であることを確認する。
describe('設定ページ: answer-graphのパン屑リストsessionStorage保存トグル', () => {
  it('answerGraphTrailSessionStorageを指定しない場合はデフォルトでOFF(未チェック)表示になる', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('id="answerGraphTrailSessionStorageCheckbox"');
    expect(html).not.toMatch(/id="answerGraphTrailSessionStorageCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="answerGraphTrailSessionStorageLabel">OFF<');
  });

  it("answerGraphTrailSessionStorage='off'の場合もOFF(未チェック)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, answerGraphTrailSessionStorage: 'off' });
    expect(html).not.toMatch(/id="answerGraphTrailSessionStorageCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="answerGraphTrailSessionStorageLabel">OFF<');
  });

  it("answerGraphTrailSessionStorage='on'の場合はON(チェック済み)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, answerGraphTrailSessionStorage: 'on' });
    expect(html).toMatch(/id="answerGraphTrailSessionStorageCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="answerGraphTrailSessionStorageLabel">ON<');
  });

  it('デフォルトOFF・同意の上でONにする旨の説明を表示する', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('デフォルトOFF');
    expect(html).toContain('同意の上でONにしてください');
  });

  it('変更はonAnswerGraphTrailSessionStorageChangeで/api/settings/answer-graph-trail-session-storageへPOSTする', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('onchange="onAnswerGraphTrailSessionStorageChange()"');
    const fnIdx = html.indexOf('async function onAnswerGraphTrailSessionStorageChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("fetch('/api/settings/answer-graph-trail-session-storage'");
    expect(fn).toContain('method: \'POST\'');
  });
});
