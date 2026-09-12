import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページのグループ(=画面上部のタブ)一覧。
// Slack関連のAPI(/api/settings/slack-notify, /api/tsubuyaki)が他の
// 汎用設定グループ(プロフィール・設定、その他)に埋もれていたため、
// 専用の「Slack」タブへまとめた。
describe('/apis ページ: Slack専用タブ', () => {
  const html = getApisPage();

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it("group: 'Slack' というタブが定義されている", () => {
    expect(html).toContain("group: 'Slack'");
  });

  it('Slack関連の3エンドポイントがカタログに登録されている', () => {
    expect(html).toContain("method:'GET',  path:'/api/settings/slack-notify'");
    expect(html).toContain("method:'POST', path:'/api/settings/slack-notify'");
    expect(html).toContain("method:'POST', path:'/api/tsubuyaki'");
  });

  it('Slack関連エンドポイントは1回ずつだけ登場する(他グループへの重複残存がない)', () => {
    const countOccurrences = (needle: string) => html.split(needle).length - 1;
    expect(countOccurrences("path:'/api/settings/slack-notify'")).toBe(2); // GET/POSTの2件
    expect(countOccurrences("path:'/api/tsubuyaki'")).toBe(1);
  });

  it("Slackタブが 'その他' タブより前に定義されている(移動漏れの確認)", () => {
    const slackIdx = html.indexOf("group: 'Slack'");
    const otherIdx = html.indexOf("group: 'その他'");
    expect(slackIdx).toBeGreaterThan(-1);
    expect(otherIdx).toBeGreaterThan(-1);
    expect(otherIdx).toBeLessThan(slackIdx);
  });
});
