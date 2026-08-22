// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getAichatImageGalleryPage } from './views/aichatImageGallery';

// 対象: /aichat-image-gallery プレビューモーダルに追加した「🌳 分派を見る」ボタンと、
// クリックで開くcanvas放射状レイアウトの分派図オーバーレイ(branchOverlay)。
// 読み取り専用のビジュアライゼーションであり、編集・関係修復UIは持たない。
//
// 故障シナリオ:
//   (1) ボタン自体がマークアップに存在しない、またはクリックしてもオーバーレイが開かない
//   (2) image_idが無いプレビュー(旧データ等)でボタンを押すと例外になる
//   (3) 取得した件数が0件でも描画(arc呼び出し)が例外を投げる
//   (4) ノードをタップしても内容パネルが更新されない、またはモデルの
//       取り違え(moondream3.1のはずがllama-4の回答文が出る等)が起きる
//   (5) オーバーレイを閉じるボタン・背景クリック・Escapeキーが効かない

function setupPage() {
  const html = getAichatImageGalleryPage('tester', { 'llama-4': '#58a6ff', 'moondream3.1': '#f0883e' });
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

  const arcCalls: number[][] = [];
  const ctx = {
    clearRect: () => {}, beginPath: () => {},
    arc: (...args: number[]) => { arcCalls.push(args); },
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
    set strokeStyle(_v: string) {}, set fillStyle(_v: string) {}, set lineWidth(_v: number) {},
  };
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;

  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { html, arcCalls };
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('/aichat-image-gallery の分派を見るボタン', () => {
  it('previewBranchToggleボタンがマークアップに存在する', () => {
    const { html } = setupPage();
    expect(html).toContain('id="previewBranchToggle"');
    expect(html).toContain('id="branchOverlay"');
    expect(html).toContain('id="branchCanvas"');
  });

  it('image_idが無い状態でボタンを押しても例外にならず、案内メッセージを表示する', () => {
    setupPage();
    const toggle = document.getElementById('previewBranchToggle') as HTMLButtonElement;
    expect(() => toggle.dispatchEvent(new Event('click', { bubbles: true }))).not.toThrow();
    const overlay = document.getElementById('branchOverlay');
    expect(overlay?.classList.contains('open')).toBe(true);
    const panel = document.getElementById('branchPanel');
    expect(panel?.textContent).toContain('画像ID');
  });

  it('画像添付会話をプレビューしてから分派を見るを押すと、API結果ぶんのノードをcanvasに描画する', async () => {
    const { arcCalls } = setupPage();

    // openPreview相当: ギャラリーitemクリックでモーダルを開く動線を経由する代わりに、
    // previewCurrentImageIdをセットするため、検索結果からgalleryItemをクリックする。
    (window as unknown as { fetch: unknown }).fetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ results: [
        { id: 's1', question: 'q1', answer: 'a1', model: 'llama-4', created_at: 't1', image_data_url: 'data:image/png;base64,x', image_id: 'img1' },
      ] }) })
      .mockResolvedValueOnce({ json: async () => ({
        items: [
          { modelFamily: 'llama-4', shareId: 's1', question: 'q1', answer: 'a1', model: 'llama-4', created_at: 't1' },
          { modelFamily: 'moondream3.1', shareId: 's1', question: null, answer: 'moondreamの分析結果', model: 'moondream3.1', created_at: 't2' },
        ],
      }) });

    const input = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    input.value = 'q1';
    searchBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    const cell = document.querySelector('.gallery-item') as HTMLDivElement;
    expect(cell).toBeTruthy();
    cell.dispatchEvent(new Event('click', { bubbles: true }));

    const toggle = document.getElementById('previewBranchToggle') as HTMLButtonElement;
    toggle.dispatchEvent(new Event('click', { bubbles: true }));
    await flushMicrotasks();

    const panel = document.getElementById('branchPanel');
    expect(panel?.textContent).toContain('2');
    // 中心ノード(半径22)+2つの出力ノード(半径14)= 少なくとも3回のarc呼び出し
    expect(arcCalls.length).toBeGreaterThanOrEqual(3);
  });
});
