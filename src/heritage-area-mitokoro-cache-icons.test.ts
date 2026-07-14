import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの「検索露出ログ検索結果」欄。個別世界遺産名の
// 右側に、gemma-4-26b-a4b-itの「見どころ」キャッシュがあれば👀アイコンを、
// llama-3.3-70b-instruct-fp8-fastの「見どころ」キャッシュがあればさらに
// その右に👁️アイコンを表示し、タップすると最上位レイヤーのモーダルで
// そのキャッシュ内容を表示する(webglHeritage.tsの同種機能と同じAPIを再利用)。
function extractPureFunctions(html: string): string {
  const lines = html.split('\n');
  const prefixes = [
    'const esc=',
    'let gemmaCache=',
    'function distancePrefix(',
    'function mitokoroIconsHtml(',
    'function resultFlagHtml(',
    'function resultNameHtml(',
  ];
  const found = prefixes.map((prefix) => lines.find((line) => line.startsWith(prefix)));
  if (found.some((line) => !line)) {
    throw new Error('必要な関数が生成HTMLから見つからない: ' + JSON.stringify(prefixes.filter((_, i) => !found[i])));
  }
  return found.join('\n');
}

function loadFns(html: string, gemma: Record<string, string>, llama: Record<string, string>) {
  const src = extractPureFunctions(html);
  const fn = new Function(`${src}\nObject.assign(gemmaCache, ${JSON.stringify(gemma)});\nObject.assign(llamaCache, ${JSON.stringify(llama)});\nreturn { resultNameHtml };`);
  return fn();
}

describe('heritage-areaページ: 検索結果欄の見どころキャッシュアイコン(👀/👁️)', () => {
  it('script タグ内のJSに構文エラーがない', () => {
    const html = getHeritageAreaPage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('gemma-4の見どころキャッシュがあれば👀アイコンを名前の右側に付与する', () => {
    const html = getHeritageAreaPage();
    const { resultNameHtml } = loadFns(html, { '姫路城': 'share-abc' }, {});
    const out = resultNameHtml({ item_name: '姫路城' });
    expect(out).toContain('👀');
    expect(out).toContain('data-mitokoro-share="share-abc"');
    expect(out).toContain('data-mitokoro-icon="👀"');
    expect(out.indexOf('姫路城')).toBeLessThan(out.indexOf('👀'));
  });

  it('llama-3.3-70b-instruct-fp8-fastの見どころキャッシュがあれば👁️アイコンを👀のさらに右に付与する', () => {
    const html = getHeritageAreaPage();
    const { resultNameHtml } = loadFns(html, { '姫路城': 'share-abc' }, { '姫路城': 'share-xyz' });
    const out = resultNameHtml({ item_name: '姫路城' });
    expect(out).toContain('👀');
    expect(out).toContain('👁️');
    expect(out.indexOf('👀')).toBeLessThan(out.indexOf('👁️'));
    expect(out).toContain('data-mitokoro-share="share-xyz"');
  });

  it('llamaキャッシュのみある場合は👁️だけ表示し👀は表示しない', () => {
    const html = getHeritageAreaPage();
    const { resultNameHtml } = loadFns(html, {}, { '姫路城': 'share-xyz' });
    const out = resultNameHtml({ item_name: '姫路城' });
    expect(out).not.toContain('👀');
    expect(out).toContain('👁️');
  });

  it('どちらのキャッシュも無ければアイコンを表示しない', () => {
    const html = getHeritageAreaPage();
    const { resultNameHtml } = loadFns(html, {}, {});
    const out = resultNameHtml({ item_name: '姫路城' });
    expect(out).not.toContain('👀');
    expect(out).not.toContain('👁️');
  });

  it('見どころキャッシュのバッチ取得API(/api/aichat/check-heritage-mitokoro-gemma-batch, -llama-batch)を呼ぶ', () => {
    const html = getHeritageAreaPage();
    expect(html).toContain("'/api/aichat/check-heritage-mitokoro-gemma-batch'");
    expect(html).toContain("'/api/aichat/check-heritage-mitokoro-llama-batch'");
    expect(html).toContain('function loadMitokoroCache(');
  });

  it('アイコンタップでopenMitokoroCacheModalを呼び、最上位レイヤー(getNextZ)のモーダルで/api/aichat/shares/:idからキャッシュ内容を取得・Markdown描画する', () => {
    const html = getHeritageAreaPage();
    expect(html).toContain('function openMitokoroCacheModal(');
    expect(html).toContain('function getNextZ(');
    const idx = html.indexOf('function openMitokoroCacheModal(');
    const block = html.slice(idx, idx + 2200);
    expect(block).toContain("z-index:'+getNextZ()");
    expect(block).toContain("fetch('/api/aichat/shares/'+encodeURIComponent(shareId))");
    expect(block).toContain('parseMd(data.answer)');
  });

  it('data-mitokoro-icon属性を持つ要素のクリックをイベント委譲で受けopenMitokoroCacheModalを呼ぶ', () => {
    const html = getHeritageAreaPage();
    expect(html).toContain("closest('[data-mitokoro-icon]')");
    expect(html).toContain('openMitokoroCacheModal(el.dataset.mitokoroIcon,el.dataset.mitokoroName,el.dataset.mitokoroShare)');
  });
});
