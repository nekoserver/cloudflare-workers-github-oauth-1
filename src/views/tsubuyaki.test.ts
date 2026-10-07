import { describe, it, expect } from 'vitest';
import { getTsubuyakiPage } from './tsubuyaki';

describe('getTsubuyakiPage', () => {
  const html = getTsubuyakiPage('octocat');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('ユーザー名をエスケープして表示する', () => {
    expect(html).toContain('octocat');
  });

  it('ユーザー名に含まれるHTMLはエスケープされる（XSS対策）', () => {
    const xssHtml = getTsubuyakiPage('<script>alert(1)</script>');
    expect(xssHtml).not.toContain('<script>alert(1)</script>');
    expect(xssHtml).toContain('&lt;script&gt;');
  });

  it('自由記述用のtextareaと投稿ボタンが存在する', () => {
    expect(html).toContain('id="freeText"');
    expect(html).toContain('id="postBtn"');
    expect(html).toContain('function postToSlack()');
  });

  it('投稿ボタンは /api/tsubuyaki へPOSTする', () => {
    expect(html).toContain("fetch('/api/tsubuyaki'");
    expect(html).toContain("method: 'POST'");
  });

  it('成功時・失敗時どちらも画面上にステータスメッセージを表示する', () => {
    expect(html).toContain('id="statusMsg"');
    expect(html).toContain("showStatus('success'");
    expect(html).toContain("showStatus('error'");
  });

  it('文字数カウンターが上限(3000)を表示する', () => {
    expect(html).toContain('0 / 3000');
    expect(html).toContain('MAX_LEN = 3000');
  });

  it('多数のBlock Kitテンプレートが左サイドバーのアイコンから選択できる', () => {
    const iconCount = (html.match(/class="sidebar-icon/g) || []).length;
    expect(iconCount).toBeGreaterThanOrEqual(25);
    expect(html).toContain('Block Kit テンプレート');
    expect(html).toContain('data-template="incident"');
    expect(html).toContain('data-template="approval"');
    expect(html).toContain('id="templateSidebar"');
    expect(html).toContain('template: selectedTemplate');
  });

  it('テンプレート選択後、スニペットプレビューとRun▶ボタンで投稿に適用する', () => {
    expect(html).toContain('id="snippetCode"');
    expect(html).toContain('id="applyTemplateButton"');
    expect(html).toContain('Run▶');
    expect(html).toContain('selectedTemplate = previewTemplate.id');
  });

  it('各テンプレートのBlock Kitスニペット(JSON)がサーバー側で埋め込まれている', () => {
    expect(html).toContain('var TEMPLATES = ');
    expect(html).toContain('"snippet"');
  });
});

it('インタラクティブサンプルを選択でき、応答と保存なしの説明がある', () => {
  const html = getTsubuyakiPage('octocat');
  expect(html).toContain('data-template="interactive_sample"');
  expect(html).toContain('自分だけに確認メッセージ');
  expect(html).toContain('集計・保存なし');
  expect(html).toContain('tsubuyaki_sample_reaction_understood');
});
