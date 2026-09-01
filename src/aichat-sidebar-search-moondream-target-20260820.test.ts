// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットページ左サイドバーの検索窓(#sidebarSearch)。
// /answer-graph・/aichat-image-gallery ページと同様に、検索対象を
// llama-4(質問・回答)/moondream3.1(画像分析)/kimi-gemma(kimi-codeの
// Gemmaレビュー結果)で切り替えられるトグルボタン(#sidebarSearchTargetBtn)。
// サイドバーは幅が狭い(260px)ため、他ページのようなドロップダウンではなく
// 1個のアイコントグルボタンで3値を順に切り替える形で表現する。
//
// 故障シナリオ:
//   (1) トグルボタン自体がマークアップに存在しない
//   (2) doSearchがfetchのクエリパラメータにtargetを含めない
//   (3) デフォルト(未操作)でllama-4以外の値が送られ、既存の挙動が壊れる
//   (4) トグルを押しても検索中(キーワード入力済み)なら再検索されない
//   (5) トグルを押した際、キーワード未入力なら余計なfetchが発生する
//   (6) kimi-gemmaへの切り替えがアイコン+ツールチップのみで視認性が低く、
//       ユーザーがllama-4のまま検索して0件になる(実際に発生した不具合)。
//       検索欄のplaceholderに現在の検索対象名を常時表示することで防ぐ

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('AIチャットサイドバー検索: 検索対象トグルボタン(マークアップ)', () => {
  it('#sidebarSearchTargetBtn が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="sidebarSearchTargetBtn"');
  });

  it('doSearchはfetchのクエリパラメータにsidebarSearchTargetを含める', () => {
    const html = buildPage();
    const idx = html.indexOf('function doSearch(q)');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain("'&target=' + encodeURIComponent(sidebarSearchTarget)");
  });

  it('トグルボタンのclickハンドラでsidebarSearchTargetをllama-4→moondream3.1→kimi-gemmaの順で切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf('sidebarSearchTargetBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain('SIDEBAR_SEARCH_TARGET_CYCLE[(idx + 1) % SIDEBAR_SEARCH_TARGET_CYCLE.length]');
    expect(snippet).toContain('if (q && currentMode === \'search\') doSearch(q);');
    expect(html).toContain("['llama-4', 'moondream3.1', 'kimi-gemma']");
  });
});

describe('AIチャットサイドバー検索: 検索対象トグルボタン(DOM実動作)', () => {
  function setup() {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
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
    const input = document.getElementById('sidebarSearch') as HTMLInputElement;
    input.value = 'ねこ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const searchCall = fetchMock.mock.calls.find((c: unknown[]) => String(c[0]).indexOf('/api/aichat/shares/search') === 0);
    expect(searchCall).toBeDefined();
    expect(String((searchCall as unknown as unknown[])[0])).toContain('target=llama-4');
  });

  it('トグルボタンを押すと検索中のキーワードでtarget=moondream3.1として再検索する', async () => {
    const { fetchMock } = setup();
    const input = document.getElementById('sidebarSearch') as HTMLInputElement;
    input.value = 'ねこ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    fetchMock.mockClear();

    const toggleBtn = document.getElementById('sidebarSearchTargetBtn') as HTMLButtonElement;
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const searchCall = fetchMock.mock.calls.find((c: unknown[]) => String(c[0]).indexOf('/api/aichat/shares/search') === 0);
    expect(searchCall).toBeDefined();
    expect(String((searchCall as unknown as unknown[])[0])).toContain('target=moondream3.1');
    expect(toggleBtn.classList.contains('active')).toBe(true);
  });

  it('キーワード未入力の状態でトグルを押しても再検索(fetch)しない', () => {
    const { fetchMock } = setup();
    fetchMock.mockClear();
    const toggleBtn = document.getElementById('sidebarSearchTargetBtn') as HTMLButtonElement;
    toggleBtn.click();
    const searchCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).indexOf('/api/aichat/shares/search') === 0);
    expect(searchCalls.length).toBe(0);
  });

  it('2回押すとtarget=kimi-gemmaとして再検索する', async () => {
    const { fetchMock } = setup();
    const input = document.getElementById('sidebarSearch') as HTMLInputElement;
    input.value = 'ねこ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const toggleBtn = document.getElementById('sidebarSearchTargetBtn') as HTMLButtonElement;
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockClear();

    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const searchCall = fetchMock.mock.calls.find((c: unknown[]) => String(c[0]).indexOf('/api/aichat/shares/search') === 0);
    expect(searchCall).toBeDefined();
    expect(String((searchCall as unknown as unknown[])[0])).toContain('target=kimi-gemma');
    expect(toggleBtn.classList.contains('active')).toBe(true);
  });

  it('3回押すとllama-4に戻り、activeクラスが外れ、検索欄のplaceholderも(llama-4)に戻る', async () => {
    const { fetchMock } = setup();
    const input = document.getElementById('sidebarSearch') as HTMLInputElement;
    input.value = 'ねこ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const toggleBtn = document.getElementById('sidebarSearchTargetBtn') as HTMLButtonElement;
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockClear();

    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const searchCall = fetchMock.mock.calls.find((c: unknown[]) => String(c[0]).indexOf('/api/aichat/shares/search') === 0);
    expect(searchCall).toBeDefined();
    expect(String((searchCall as unknown as unknown[])[0])).toContain('target=llama-4');
    expect(toggleBtn.classList.contains('active')).toBe(false);
    expect(input.placeholder).toContain('(llama-4)');
  });

  it('kimi-gemmaに切り替えると検索欄のplaceholderに(kimi-gemma)が表示される', async () => {
    setup();
    const toggleBtn = document.getElementById('sidebarSearchTargetBtn') as HTMLButtonElement;
    const input = document.getElementById('sidebarSearch') as HTMLInputElement;
    toggleBtn.click();
    toggleBtn.click();
    expect(input.placeholder).toContain('(kimi-gemma)');
  });
});
