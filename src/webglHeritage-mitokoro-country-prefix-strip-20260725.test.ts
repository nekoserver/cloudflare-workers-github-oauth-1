import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: /webgl-heritage ページの見どころキャッシュモーダル(👀/👁️ボタン、
// openHeritageMitokoroCacheModal)。
//
// 背景: heritage-accessページの「AIに何を質問しますか」パネルは、同名で国が
// 異なる世界遺産の誤回答を防ぐため、質問文の先頭に「「国名」にある」を補足
// してから問い合わせている。この補足込みの回答がそのままDB(ai_chat_shares)
// へ保存されるため、webgl-heritageページの見どころキャッシュ読み出し時にも
// 同じ接頭辞が残ったまま表示されてしまっていた。heritage-accessページ側は
// 国名を保持しているため文字列一致(stripCountryContextPrefix)で削除できるが、
// webgl-heritage側は国名を保持していないため、正規表現で「「任意の文字列」
// にある」という形自体を検出して取り除くstripHeritageCountryPrefixを追加した。
//
// 故障シナリオ:
//   (1) 接頭辞が文中(先頭以外)に現れる場合まで誤って削除してしまう
//   (2) 「にある」を伴わない単なる引用符「」(例:「姫路城」は美しい)まで
//       誤って削除してしまう
//   (3) 接頭辞除去後に残る読点・句点・空白を取り除けず不自然な文頭になる
//   (4) null/undefined/空文字を渡すと例外を投げる
//   (5) fetchハンドラでstripせずdata.answerをそのままanswerTextへ代入して
//       しまう(修正前の不具合そのもの)

function extractFn(html: string, name: string): string {
  const re = new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

function loadStripFn(html: string) {
  const src = extractFn(html, 'stripHeritageCountryPrefix');
  const fn = new Function(`${src}\nreturn stripHeritageCountryPrefix;`);
  return fn();
}

describe('stripHeritageCountryPrefix: 「「国名」にある」接頭辞の除去', () => {
  it('先頭の「「国名」にある」を取り除く', () => {
    const html = getWebGLHeritagePage('tester');
    const strip = loadStripFn(html);
    expect(strip('「イタリア」にあるモンテ・サン・ジョルジョは...')).toBe('モンテ・サン・ジョルジョは...');
  });

  it('接頭辞の直後に読点・句点・空白があればそれも取り除く', () => {
    const html = getWebGLHeritagePage('tester');
    const strip = loadStripFn(html);
    expect(strip('「日本」にある、姫路城は白鷺城とも呼ばれる。')).toBe('姫路城は白鷺城とも呼ばれる。');
    expect(strip('「日本」にある。姫路城は美しい。')).toBe('姫路城は美しい。');
    expect(strip('「日本」にある 姫路城は美しい。')).toBe('姫路城は美しい。');
  });

  it('先頭以外に「「国名」にある」が現れても削除しない(誤爆防止)', () => {
    const html = getWebGLHeritagePage('tester');
    const strip = loadStripFn(html);
    const text = '姫路城は、日本にある世界遺産です。「日本」にあることでも有名。';
    expect(strip(text)).toBe(text);
  });

  it('「にある」を伴わない単なる引用符は削除しない', () => {
    const html = getWebGLHeritagePage('tester');
    const strip = loadStripFn(html);
    expect(strip('「姫路城」は美しい建築です。')).toBe('「姫路城」は美しい建築です。');
  });

  it('接頭辞が無い通常の回答はそのまま返す', () => {
    const html = getWebGLHeritagePage('tester');
    const strip = loadStripFn(html);
    expect(strip('姫路城は白鷺城とも呼ばれる美しい城です。')).toBe('姫路城は白鷺城とも呼ばれる美しい城です。');
  });

  it('null/undefined/空文字を渡しても例外を投げず空文字を返す', () => {
    const html = getWebGLHeritagePage('tester');
    const strip = loadStripFn(html);
    expect(() => strip(null)).not.toThrow();
    expect(strip(null)).toBe('');
    expect(strip(undefined)).toBe('');
    expect(strip('')).toBe('');
  });
});

describe('/webgl-heritage ページ: 見どころキャッシュモーダルが読み出し時に接頭辞を除去する', () => {
  const html = getWebGLHeritagePage('tester');

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

  it('openHeritageMitokoroCacheModalのfetchハンドラがdata.answerをstripHeritageCountryPrefix経由でanswerTextへ代入している', () => {
    const idx = html.indexOf('function openHeritageMitokoroCacheModal');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 3000);
    expect(block).toContain('answerText = stripHeritageCountryPrefix(data.answer);');
  });
});
