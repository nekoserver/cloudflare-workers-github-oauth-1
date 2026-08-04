import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
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

  it('renderHeritageInner は都市の国コード(data-cc)ではなく、各世界遺産自身の国名(h.country_name)をAIパネルへ渡す', () => {
    // 1つの都市の近隣世界遺産一覧には、距離だけで拾われた他国の遺産も
    // 含まれ得るため、都市の所在国ではなく世界遺産自身の行頭国旗が表す国
    // (h.country_name)を使わないと「○○(都市の国)にある××(実際は別の国の
    // 遺産)」という誤りを含む問い合わせ文になってしまう。
    const idx = html.indexOf('function renderHeritageInner(');
    const block = html.slice(idx, idx + 1800);
    expect(block).toContain('h.country_name');
    expect(block).toContain('buildAiPanel(h.heritage_name, heritageCountryName)');
    expect(block).not.toContain('accTr.previousElementSibling');
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

describe('DOM回帰テスト: 都市の所在国と異なる国の世界遺産が近隣に含まれる場合、AI質問補完は世界遺産自身の国を使う', () => {
  function extractMainScript(html: string): string {
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let best = '';
    while ((m = re.exec(html)) !== null) {
      if (m[1].indexOf('function openAccordion(') !== -1) {
        best = m[1];
        break;
      }
    }
    if (!best) throw new Error('openAccordion を含む <script> が見つかりません');
    return best;
  }

  async function flush(times = 20): Promise<void> {
    for (let i = 0; i < times; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  it('フランスの都市アコーディオンにイタリアの世界遺産(距離だけで含まれる)が含まれる場合、その遺産のAIボタンのdata-countryは「イタリア」になる(「フランス」にはならない)', async () => {
    const html = getHeritageAccessPage('tester');
    const script = extractMainScript(html);
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
    const window: any = dom.window;

    window.fetch = (url: string) => {
      const u = String(url);
      if (u.indexOf('/api/city-all-heritages') !== -1) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({
            heritages: [
              // ヴェネツィアはイタリアの世界遺産だが、フランスの都市から
              // 距離だけで近隣として拾われている、という状況を再現する
              { heritage_name: 'ヴェネツィアとその潟', distance_km: 300, country_flag: '🇮🇹', country_name: 'イタリア' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    };

    window.eval(script);

    const document = window.document;
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-city', 'Paris');
    tr.setAttribute('data-lat', '48.85');
    tr.setAttribute('data-lon', '2.35');
    tr.setAttribute('data-cc', 'FR');
    tr.innerHTML = '<td>1</td><td>2</td><td>3</td>';
    tbody.appendChild(tr);
    table.appendChild(tbody);
    document.body.appendChild(table);
    window.openAccordion(tr);
    await flush();

    const btn = document.querySelector('.acc-ai-btn[data-heritage="ヴェネツィアとその潟"]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-country')).toBe('イタリア');
    expect(btn.getAttribute('data-country')).not.toBe('フランス');
  });
});
