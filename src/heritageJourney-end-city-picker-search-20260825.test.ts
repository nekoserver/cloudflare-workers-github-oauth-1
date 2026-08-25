// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) })));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  document.getElementById('end-city-picker-btn')!.click();
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('heritage-journeyページ: 到着地選択モーダルのインクリメントサーチ', () => {
  it('入力するたびに日本語の都市表示名で候補行を絞り込む', () => {
    setupPage();
    const input = document.getElementById('end-city-picker-search') as HTMLInputElement;
    const body = document.getElementById('end-city-picker-table-body')!;

    input.value = 'ロン';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const rows = Array.from(body.querySelectorAll('[data-city-name]'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => (row.textContent || '').includes('ロン'))).toBe(true);
    expect(body.querySelector('[data-city-name="London"]')).not.toBeNull();
    expect(body.querySelector('[data-city-name="Rome"]')).toBeNull();
  });

  it('英語の内部名も大文字・小文字を区別せず検索し、空欄に戻すと全候補を復元する', () => {
    setupPage();
    const input = document.getElementById('end-city-picker-search') as HTMLInputElement;
    const body = document.getElementById('end-city-picker-table-body')!;
    const initialCount = body.querySelectorAll('[data-city-name]').length;

    input.value = 'LoNDoN';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(body.querySelectorAll('[data-city-name]')).toHaveLength(1);
    expect(body.querySelector('[data-city-name="London"]')).not.toBeNull();

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(body.querySelectorAll('[data-city-name]')).toHaveLength(initialCount);
  });
});
