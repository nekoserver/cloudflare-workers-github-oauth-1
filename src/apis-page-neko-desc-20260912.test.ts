import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページの POST /api/aichat の説明文。
// 実際には /neko サブコマンドが多数(kana・aireqst等)追加されているのに、
// 説明文には初期の4個("/neko hms"・"/neko cal"・"/neko clog"・"/neko limit")
// だけが列挙されたまま更新されておらず実態と乖離していた。
// 追加のたびに書き換えが必要な列挙をやめ、"/neko help"を案内する形に修正した。
describe('/apis ページ: POST /api/aichat の説明文', () => {
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

  it('個別のサブコマンド名を列挙せず、/neko help への案内を含む', () => {
    expect(html).toContain('/neko help');
    expect(html).not.toContain('/neko hms');
    expect(html).not.toContain('/neko clog');
  });
});
