// @vitest-environment jsdom
/**
 * /wasm-modulesページ(パネル/リスト表示切替、ソース閲覧モーダル)の構造・挙動テスト
 *
 * 対象: src/views/wasmModules.ts。パネルモードは従来通り各モジュールの説明を
 * 直接表示し、リストモードはID/バイナリ/ソース/サイズ/起動時に読み込む/最終更新日時/
 * 最新ビルド日時をthに集約したテーブルで、行(空白部分)クリックで詳細モーダルを開く。
 * いずれのモードでも「ソース」リンクをクリックすると行番号付き・シンタックスハイライト
 * 付きのソース閲覧モーダルを最上位レイヤーで開く。
 *
 * 故障シナリオ:
 *   (1) パネル/リスト切替ボタンが存在しない、またはクリックしても表示が切り替わらない
 *   (2) リストモードのth見出しがID/バイナリ/ソース/サイズ/起動時に読み込む/最終更新日時/
 *       最新ビルド日時の7列に集約されていない(各行に重複してラベルが出てしまう)
 *   (3) リストモードで行の空白部分をクリックしても詳細モーダルが開かない、
 *       またはチェックボックス/ソースリンクのクリックでも詳細モーダルが開いてしまう(誤爆)
 *   (4) ソースリンクをクリックしてもソース閲覧モーダルが開かない、または行番号が付かない
 *   (5) テンプレートリテラル内の正規表現リテラル・エスケープが壊れて構文エラーになる
 *       (CLAUDE.mdルール29: \\bや\\dが壊れる典型パターン)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getWasmModulesPage } from './views/wasmModules';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

describe('GET /wasm-modules', () => {
  it('認証済みの場合はHTMLページを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/wasm-modules',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('WASMモジュール一覧');
  });
});

describe('getWasmModulesPage', () => {
  const html = getWasmModulesPage('tester');

  it('パネル/リスト表示の切替ボタンを含む', () => {
    expect(html).toContain('id="modePanelBtn"');
    expect(html).toContain('id="modeListBtn"');
  });

  it('リストモードのth見出しはID/バイナリ/ソース/サイズ/⬜︎(起動時に読み込む)/最終更新日時/最新ビルド日時の7列に集約され、行末の「:」は付かない', () => {
    const idx = html.indexOf('<thead>');
    const endIdx = html.indexOf('</thead>');
    const thead = html.slice(idx, endIdx);
    expect(thead).toContain('>ID<');
    expect(thead).toContain('>バイナリ<');
    expect(thead).toContain('>ソース<');
    expect(thead).toContain('>サイズ<');
    expect(thead).toContain('⬜︎');
    expect(thead).toContain('>最終更新日時<');
    expect(thead).toContain('>最新ビルド日時<');
    expect(thead).not.toContain('ID:');
    expect(thead).not.toContain('起動時に読み込む:');
    expect((thead.match(/<th[ >]/g) || []).length).toBe(7);
  });

  it('リストモードのthは中央寄せで、データ列はソート可能なdata-sort-keyを持つ', () => {
    const idx = html.indexOf('<thead>');
    const endIdx = html.indexOf('</thead>');
    const thead = html.slice(idx, endIdx);
    expect(html).toContain(".wasm-table th { color: var(--text-muted); font-weight: 600; background: var(--bg-secondary); text-align: center;");
    expect(thead).toContain('data-sort-key="id"');
    expect(thead).toContain('data-sort-key="wasmPath"');
    expect(thead).toContain('data-sort-key="sourceFile"');
    expect(thead).toContain('data-sort-key="approxSize"');
    expect(thead).toContain('data-sort-key="sourceUpdatedAt"');
    expect(thead).toContain('data-sort-key="wasmBuiltAt"');
  });

  it('起動時に読み込むth(⬜︎)にはツールチップ要素があり、旧「note」文言(コールドスタート説明)を含む', () => {
    expect(html).toContain('id="enabledThTooltip"');
    expect(html).toContain('コールドスタート');
    expect(html).not.toContain('class="note"');
  });

  it('ファイルシステム一覧取得APIに関する旧note文言は削除されている', () => {
    expect(html).not.toContain('ファイルシステムの一覧取得APIが無いため');
  });

  it('ソースリンクにアンダーラインを付けない', () => {
    expect(html).toContain("text-decoration: none;");
    const sourceLinkCss = html.slice(html.indexOf('.source-link {'), html.indexOf('.source-link {') + 300);
    expect(sourceLinkCss).not.toContain('text-decoration: underline;');
  });

  it('ソース閲覧モーダル・詳細モーダルの要素を含む', () => {
    expect(html).toContain('id="sourceModalOverlay"');
    expect(html).toContain('id="sourceModalCode"');
    expect(html).toContain('id="detailModalOverlay"');
    expect(html).toContain('id="detailModalBody"');
  });

  it('テンプレートリテラル起因のエスケープ崩れがない(単引用符エスケープ・&#39;連続なし)', () => {
    expect(html).not.toContain("\\'");
    expect(html).not.toContain('&#39;&#39;');
  });
});

describe('/wasm-modules ページ: パネル/リスト切替・詳細モーダル・ソース閲覧モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const MODULES = [
    {
      id: 'sha256', name: 'SHA-256 (Rust)', description: 'SHA-256ハッシュを計算する',
      wasmPath: 'public/wasm/sha256_bg.wasm', sourceDir: 'wasm/sha256-wasm', sourceFile: 'wasm/sha256-wasm/src/lib.rs',
      approxSize: '約25KB', enabled: true, updatedAt: null, updatedBy: null,
      sourceUpdatedAt: '2026-08-18T12:00:00Z', wasmBuiltAt: '2026-08-18T12:00:00Z',
    },
    {
      id: 'factor', name: 'factor (Rust)', description: '素因数分解する',
      wasmPath: 'public/wasm/factor_bg.wasm', sourceDir: 'wasm/factor-wasm', sourceFile: 'wasm/factor-wasm/src/lib.rs',
      approxSize: '約21KB', enabled: false, updatedAt: null, updatedBy: null,
      sourceUpdatedAt: null, wasmBuiltAt: null,
    },
  ];

  async function setup() {
    const html = getWasmModulesPage('tester');
    const bodyIdx = html.indexOf('<body>') + 6;
    const scriptIdx = html.indexOf('<script>', bodyIdx);
    document.body.innerHTML = html.slice(bodyIdx, scriptIdx);
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('/api/wasm-modules/source')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ path: 'wasm/sha256-wasm/src/lib.rs', content: 'pub fn sha256_hex(input: &str) -> String {\n    // hash it\n    42\n}', githubUrl: 'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/blob/main/wasm/sha256-wasm/src/lib.rs' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ modules: MODULES }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const scriptSrc = html.slice(scriptIdx + 8, html.indexOf('</script>', scriptIdx));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { fetchMock };
  }

  it('初期表示はパネルモードで、モジュールごとのカードに説明文が直接表示される', async () => {
    await setup();
    const cards = document.querySelectorAll('.module-card');
    expect(cards.length).toBe(2);
    expect(document.getElementById('moduleList')!.textContent).toContain('SHA-256ハッシュを計算する');
    expect((document.getElementById('wasmTableWrap') as HTMLElement).style.display).toBe('none');
  });

  it('リストモードに切り替えるとテーブル行にはID等の値のみが並び、説明文はどこにも表示されない', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    expect((document.getElementById('moduleList') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('wasmTableWrap') as HTMLElement).style.display).not.toBe('none');
    const rows = document.querySelectorAll('#wasmTableBody .wasm-row');
    expect(rows.length).toBe(2);
    expect(document.getElementById('wasmTableBody')!.textContent).not.toContain('SHA-256ハッシュを計算する');
  });

  it('リストモードで行の空白部分をクリックすると詳細モーダルが開き説明文が表示される', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    const row = document.querySelector('#wasmTableBody .wasm-row[data-module-id="sha256"]') as HTMLElement;
    row.click();
    const overlay = document.getElementById('detailModalOverlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    expect(document.getElementById('detailModalBody')!.textContent).toContain('SHA-256ハッシュを計算する');
  });

  it('リストモードでチェックボックスをクリックしても詳細モーダルは開かない(誤爆しない)', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    const checkbox = document.querySelector('#wasmTableBody .wasm-row[data-module-id="sha256"] .module-toggle') as HTMLInputElement;
    checkbox.click();
    expect(document.getElementById('detailModalOverlay')!.classList.contains('open')).toBe(false);
  });

  it('ソースリンクをクリックするとソース閲覧モーダルが開き、行番号付きでハイライトされたコードが表示される', async () => {
    await setup();
    const sourceBtn = document.querySelector('[data-source-open="sha256"]') as HTMLButtonElement;
    sourceBtn.click();
    const overlay = document.getElementById('sourceModalOverlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const code = document.getElementById('sourceModalCode')!;
    const lines = code.querySelectorAll('.src-line');
    expect(lines.length).toBe(4);
    expect(code.querySelector('.src-lineno')!.textContent).toBe('1');
    expect(code.innerHTML).toContain('tok-kw');
    expect(code.innerHTML).toContain('tok-com');
  });

  it('リストモードの行からもソースリンクをクリックするとソース閲覧モーダルが開く', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    const sourceBtn = document.querySelector('#wasmTableBody [data-source-open="factor"]') as HTMLButtonElement;
    sourceBtn.click();
    expect(document.getElementById('sourceModalOverlay')!.classList.contains('open')).toBe(true);
  });

  it('リストモードのバイナリ列は「public/wasm/」プレフィックスを除いて表示する', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    const cell = document.querySelector('#wasmTableBody .wasm-row[data-module-id="sha256"] td:nth-child(2)')!;
    expect(cell.textContent).toBe('sha256_bg.wasm');
    expect(cell.textContent).not.toContain('public/wasm/');
  });

  it('IDのthをクリックすると昇順に並び替わり、もう一度クリックすると降順になる', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    var idTh = document.querySelector('.wasm-table th[data-sort-key="id"]') as HTMLElement;
    idTh.click();
    var rowsAsc = Array.from(document.querySelectorAll('#wasmTableBody .wasm-row')).map(function(r) { return r.getAttribute('data-module-id'); });
    expect(rowsAsc).toEqual(['factor', 'sha256']);

    idTh.click();
    var rowsDesc = Array.from(document.querySelectorAll('#wasmTableBody .wasm-row')).map(function(r) { return r.getAttribute('data-module-id'); });
    expect(rowsDesc).toEqual(['sha256', 'factor']);
  });

  it('⬜︎(起動時に読み込む)thをクリックしてもソートされず、ツールチップが開閉する', async () => {
    await setup();
    (document.getElementById('modeListBtn') as HTMLButtonElement).click();
    var rowsBefore = Array.from(document.querySelectorAll('#wasmTableBody .wasm-row')).map(function(r) { return r.getAttribute('data-module-id'); });
    var enabledTh = document.getElementById('enabledTh') as HTMLElement;
    var tooltip = document.getElementById('enabledThTooltip')!;
    expect(tooltip.classList.contains('open')).toBe(false);

    enabledTh.click();
    expect(tooltip.classList.contains('open')).toBe(true);
    var rowsAfter = Array.from(document.querySelectorAll('#wasmTableBody .wasm-row')).map(function(r) { return r.getAttribute('data-module-id'); });
    expect(rowsAfter).toEqual(rowsBefore);

    enabledTh.click();
    expect(tooltip.classList.contains('open')).toBe(false);
  });
});
