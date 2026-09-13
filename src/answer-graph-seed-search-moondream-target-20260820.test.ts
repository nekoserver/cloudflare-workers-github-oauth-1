// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの起点検索(doSeedSearch)に追加した検索対象
// ドロップダウン(#seedSearchTarget)。/aichat-image-gallery ページと同様に
// llama-4(質問・回答)/moondream3.1(画像分析結果)を切り替えられるようにし、
// /api/aichat/shares/search へ target パラメータとして渡す。
//
// 故障シナリオ:
//   (1) ドロップダウン自体がマークアップに存在しない
//   (2) target を指定してもfetchのクエリパラメータに反映されない
//   (3) target未選択(デフォルト)時にllama-4以外の値が送られ、
//       既存の挙動(質問文・回答文検索)が壊れる
//   (4) ドロップダウンをmoondream3.1に切り替えても、既に入力済みの
//       キーワードで再検索されない(入力欄が空のまま何も起きないのは正常)
//   (5) 検索結果テーブルの行クリックでのグラフ読み込み(loadGraph)が
//       moondream3.1経由の結果(id=ai_chat_shares.id)でも同様に機能する

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

describe('/api/aichat/shares/search: target=moondream3.1 の振り分け(index.ts バックエンド)', () => {
  it('target=moondream3.1のときsearchAichatMoondreamAnalysesを呼び、それ以外(未指定含む)はsearchAiChatSharesを呼ぶ', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/shares/search'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 2400);
    expect(snippet).toContain("=== 'moondream3.1'");
    expect(snippet).toContain('searchAichatMoondreamAnalyses(db, user.sub, q)');
    expect(snippet).toContain('searchAiChatShares(db, user.sub, q)');
  });
});

describe('/answer-graph 起点検索の検索対象ドロップダウン(マークアップ)', () => {
  it('#seedSearchTarget にllama-4/moondream3.1の選択肢を持つ', () => {
    const html = buildPage();
    expect(html).toContain('id="seedSearchTarget"');
    expect(html).toContain('<option value="llama-4" selected>');
    expect(html).toContain('<option value="moondream3.1">');
  });

  it('doSeedSearchはfetchのクエリパラメータに選択中のtargetを含める', () => {
    const html = buildPage();
    const idx = html.indexOf('function doSeedSearch');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 600);
    expect(snippet).toContain('var target = seedSearchTarget.value;');
    expect(snippet).toContain("'/api/aichat/shares/search?q=' + encodeURIComponent(q) + '&target=' + encodeURIComponent(target)");
  });

  it('ドロップダウンのchangeイベントで(キーワード入力済みなら)再検索する', () => {
    const html = buildPage();
    expect(html).toContain("seedSearchTarget.addEventListener('change'");
  });
});

describe('/answer-graph 起点検索の検索対象ドロップダウン(DOM実動作)', () => {
  function setup() {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const fetchMock = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ results: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    return { fetchMock };
  }

  afterEach(() => { vi.unstubAllGlobals(); });

  it('デフォルト(未操作)ではtarget=llama-4でfetchする', async () => {
    const { fetchMock } = setup();
    const input = document.getElementById('seedSearchInput') as HTMLInputElement;
    input.value = 'ねこ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('target=llama-4'),
      expect.objectContaining({ credentials: 'same-origin' })
    );
  });

  it('ドロップダウンをmoondream3.1に切り替えると、入力済みキーワードでtarget=moondream3.1として再検索する', async () => {
    const { fetchMock } = setup();
    const input = document.getElementById('seedSearchInput') as HTMLInputElement;
    const targetSelect = document.getElementById('seedSearchTarget') as unknown as HTMLSelectElement;
    input.value = 'ねこ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    fetchMock.mockClear();

    targetSelect.value = 'moondream3.1';
    targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('target=moondream3.1'),
      expect.objectContaining({ credentials: 'same-origin' })
    );
  });

  it('検索キーワードが未入力の状態でドロップダウンを切り替えても再検索(fetch)しない', () => {
    const { fetchMock } = setup();
    fetchMock.mockClear();
    const targetSelect = document.getElementById('seedSearchTarget') as unknown as HTMLSelectElement;
    targetSelect.value = 'moondream3.1';
    targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const searchCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).includes('/api/aichat/shares/search'));
    expect(searchCalls.length).toBe(0);
  });
});
