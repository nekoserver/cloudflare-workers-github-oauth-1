// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地から見た目的地別プラン分布」
// (#nights-dist)。各泊数バケット行(.dist-row)をクリックすると
// そのバケットに属する都市チップ(.dist-city-chip)が展開表示され、
// チップをクリックすると#end-cityにその都市名がセットされ再計算される。
//
// 故障シナリオ:
//   (1) チップクリック時に明示的な scrollIntoView 呼び出しがあり、
//       ユーザーの意図しない自動スクロールが毎回発生する(今回の不具合の
//       直接の原因だった箇所)
//   (2) チップが<button type="button">ではなく、フォーム内で暗黙的に
//       type="submit"として扱われ、送信によるスクロールジャンプが起きる
//   (3) チップが<a href="#">のようなアンカーであり、クリックでページ先頭に
//       スクロールしてしまう

function setupPage(fetchImpl: (input: unknown, init?: unknown) => Promise<{ json: () => Promise<unknown> }> = () =>
  Promise.resolve({ json: () => Promise.resolve({ exists: false }) })) {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// 分布の泊数バケットのうち、実際に都市チップが1件以上ある行を探して
// クリックし、展開されたチップコンテナを返すヘルパー。
// (先頭のバケットは該当都市が0件の場合があり、その場合はチップが
// 描画されないためテストが無意味になってしまう)
function openBucketWithChips(): HTMLElement {
  const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
  for (const row of rows) {
    row.dispatchEvent(new Event('click', { bubbles: true }));
    const idx = row.getAttribute('data-bucket');
    const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
    if (citiesEl.querySelector('.dist-city-chip')) return citiesEl;
  }
  throw new Error('チップを持つバケットが見つかりません(テストデータ側の問題)');
}

describe('heritage-journeyページ: 出発地から見た目的地別プラン分布のチップクリック', () => {
  it('.dist-row展開後、都市チップは<button type="button">として描画される(アンカー/submitではない)', () => {
    setupPage();
    const citiesEl = openBucketWithChips();
    expect(citiesEl.style.display).toBe('flex');
    const chip = citiesEl.querySelector('.dist-city-chip') as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.tagName).toBe('BUTTON');
    expect(chip.getAttribute('type')).toBe('button');
  });

  it('都市チップをクリックしても scrollIntoView は一切呼ばれない(自動スクロール抑止)', () => {
    setupPage();
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const citiesEl = openBucketWithChips();
    const chip = citiesEl.querySelector('.dist-city-chip') as HTMLButtonElement;
    expect(chip).not.toBeNull();

    scrollSpy.mockClear();
    chip.dispatchEvent(new Event('click', { bubbles: true }));
    expect(scrollSpy).not.toHaveBeenCalled();
    expect((document.getElementById('end-city') as unknown as HTMLSelectElement).value).toBe(chip.getAttribute('data-city'));
  });
});
