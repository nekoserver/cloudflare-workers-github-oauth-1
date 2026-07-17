import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

// 対象: heritageAccess.ts の「AIに何を質問しますか」パネル(askAI/askAICached)。
// 同名で国が異なる世界遺産(例: モンテ・サン・ジョルジョ = イタリア/スイス)が
// 実データに存在するため、AIへの問い合わせ文の先頭に国名を付けて
// 「「国名」にある「世界遺産名」の「トピック」について説明してください」の形で
// 問い合わせることで誤回答(別の国の同名遺産についての回答)を防ぐ。
// ただしAIがその国名プレフィックスをそのまま応答の先頭に復唱してしまうと
// UI上の見た目が不自然になるため、応答表示直前に先頭の「「国名」にある」だけを
// 取り除いてから通常どおり表示する。
//
// 故障シナリオ:
//   (1) プロンプトに国名を混ぜ忘れ、同名別国の世界遺産について誤回答するリスクが残る
//   (2) 国名プレフィックスをAIが復唱した場合、表示にそのまま残ってしまう
//   (3) ストリップ処理が本文中に偶然含まれる同じ文字列まで壊してしまう(先頭以外を誤って削る)
//   (4) 国名が空(未取得)の場合にプロンプトが「「」にある...」のような壊れた文言になる
//   (5) askAICached(キャッシュ済み回答の再表示)には国名が渡らず、ストリップされないまま表示される

function buildPage(): string {
  return getHeritageAccessPage('tester');
}

function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n\\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

describe('askAI / askAICached: 関数シグネチャに国名(countryName)を追加', () => {
  const html = buildPage();

  it('askAI が countryName 引数を受け取る', () => {
    expect(html).toContain('function askAI(heritageName, topic, countryName, onComplete)');
  });

  it('askAICached が countryName 引数を受け取る', () => {
    expect(html).toContain('function askAICached(heritageName, topic, countryName, shareId)');
  });

  it('buildAiPanel が countryName を受け取り、ボタンに data-country として埋め込む', () => {
    expect(html).toContain('function buildAiPanel(heritageName, countryName)');
    const idx = html.indexOf('function buildAiPanel(heritageName, countryName)');
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('data-country="');
  });

  it('acc-ai-btn クリック時に data-country を読み取り askAI/askAICached へ渡す', () => {
    const idx = html.indexOf("inner.querySelectorAll('.acc-ai-btn')");
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("btn.getAttribute('data-country')");
    expect(block).toContain('askAICached(name, topic, country, shareId)');
    expect(block).toContain('askAI(name, topic, country, function(newShareId)');
  });

  it('renderHeritageInner がアコーディオンの都市国コード(data-cc)から国名を算出し、各行のAIパネルへ渡す', () => {
    const idx = html.indexOf('function renderHeritageInner(');
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain("accTr.previousElementSibling");
    expect(block).toContain('ccToJp(');
    expect(block).toContain('buildAiPanel(h.heritage_name,');
  });
});

describe('askAI: 問い合わせ文の先頭に国名プレフィックスを付ける', () => {
  const html = buildPage();

  it('プロンプトが「「国名」にある「世界遺産名」の「トピック」について説明してください」の形式になる', () => {
    const idx = html.indexOf('function askAI(heritageName, topic, countryName, onComplete)');
    const block = html.slice(idx, idx + 400);
    expect(block).toMatch(/countryName \? '「' \+ countryName \+ '」にある' : ''/);
    expect(block).toContain("'「' + heritageName + '」の「' + topic + '」について説明してください'");
  });
});

describe('stripCountryContextPrefix: 応答先頭の国名プレフィックス復唱を除去する', () => {
  const html = buildPage();

  function loadFn(): (text: string, countryName: string) => string {
    const src = extractFn(html, 'stripCountryContextPrefix', 'text, countryName');
    const fn = new Function(`${src}\nreturn stripCountryContextPrefix;`);
    return fn();
  }

  it('応答が国名プレフィックスで始まる場合、その部分だけを取り除く', () => {
    const strip = loadFn();
    expect(strip('「日本」にある姫路城は、白鷺城とも呼ばれる名城です。', '日本'))
      .toBe('姫路城は、白鷺城とも呼ばれる名城です。');
  });

  it('プレフィックス直後の読点・句点・空白も併せて取り除く', () => {
    const strip = loadFn();
    expect(strip('「日本」にある、姫路城の見どころは...', '日本')).toBe('姫路城の見どころは...');
    expect(strip('「日本」にある。姫路城の見どころは...', '日本')).toBe('姫路城の見どころは...');
  });

  it('応答が国名プレフィックスで始まらない場合は変更しない', () => {
    const strip = loadFn();
    const original = '姫路城は兵庫県姫路市にある世界遺産です。「日本」にある城の中でも特に有名です。';
    expect(strip(original, '日本')).toBe(original);
  });

  it('countryName が空/未指定の場合は何もしない', () => {
    const strip = loadFn();
    const original = '「日本」にある姫路城は名城です。';
    expect(strip(original, '')).toBe(original);
    expect(strip(original, undefined as unknown as string)).toBe(original);
  });

  it('プレフィックスが本文の途中にしか現れない場合、先頭ではないので削らない(誤爆防止)', () => {
    const strip = loadFn();
    const text = 'この城は要塞として建てられました。「日本」にある他の城とは異なる特徴があります。';
    expect(strip(text, '日本')).toBe(text);
  });
});

describe('askAI/askAICached: 応答表示前にストリップ処理を適用する', () => {
  const html = buildPage();

  it('askAI が data.response をそのまま表示せず stripCountryContextPrefix を経由する', () => {
    const idx = html.indexOf('function askAI(heritageName, topic, countryName, onComplete)');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('stripCountryContextPrefix(');
  });

  it('askAICached が data.answer をそのまま表示せず stripCountryContextPrefix を経由する(キャッシュ再表示時も復唱を除去する)', () => {
    const idx = html.indexOf('function askAICached(heritageName, topic, countryName, shareId)');
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('stripCountryContextPrefix(');
  });
});
