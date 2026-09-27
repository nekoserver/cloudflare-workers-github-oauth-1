import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getQueryBuilderPage } from './views/queryBuilderPage';

// 対象: /query-builder ページ(src/views/queryBuilderPage.ts)。
// テーブル一覧はサーバー側から渡され、カラム一覧・実行結果はfetch経由で
// 取得する。クライアント側は選択式のUIしか持たず、SQL文字列を自由入力
// させる欄は無い。
//
// 故障シナリオ:
//   (1) template literal 内のエスケープで <script> が構文エラーになる
//   (2) テーブル定義の説明文にHTMLやscript終端記号が含まれていてもページが壊れない
//   (3) カラム取得前に「実行」を押しても壊れない(currentColumnsが空のまま)
//   (4) モード切替(一覧/集計)でUIの表示・非表示が正しく切り替わる

const TABLES = [
  { name: 'user_sessions', description: 'ユーザーセッション</script><script>alert(1)</script>' },
  { name: 'api_endpoint_stats', description: 'APIエンドポイント統計' },
];

function loadPage(fetchImpl?: (input: unknown, init?: unknown) => Promise<{ ok: boolean; json: () => Promise<unknown> }>) {
  return new JSDOM(getQueryBuilderPage(TABLES), {
    runScripts: 'dangerously',
    url: 'https://example.com/query-builder',
    beforeParse(window) {
      window.fetch = (fetchImpl ?? (() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))) as any;
    },
  });
}

describe('getQueryBuilderPage: HTML構造', () => {
  const html = getQueryBuilderPage(TABLES);

  it('テーブル選択・モード切替・条件追加・実行・結果表示の要素がある', () => {
    for (const id of ['tableSelect', 'modeRows', 'modeAggregate', 'columnsGrid', 'orderByColumn', 'groupByColumn', 'havingOp', 'filtersEditor', 'addFilter', 'limitValue', 'btnRun', 'generatedSql', 'resultTable', 'resultJson', 'btnCopyJson', 'btnDownloadJson']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });

  it('自由入力のSQLテキストエリアは無く、JSONはハイライト可能な読み取り専用領域に表示する', () => {
    const textareaIds = [...html.matchAll(/<textarea id="([^"]+)"/g)].map((m) => m[1]);
    expect(textareaIds).toEqual(['generatedSql']);
    expect(html).toContain('<pre id="resultJson"');
    expect(html).toContain('id="resultJsonCode"');
    expect(html).not.toContain('id="sqlInput"');
    expect(html).not.toContain('id="rawSql"');
  });

  it('JSON領域はビューポートに合わせた高さ・スクロール・手動リサイズを備える', () => {
    expect(html).toContain('height: clamp(260px, 48vh, 620px)');
    expect(html).toContain('max-height: 75vh');
    expect(html).toContain('overflow: auto; resize: vertical');
  });

  it('JSONをRuby/WASMへ渡す右肩ボタンとシンタックスハイライトを備える', () => {
    expect(html).toContain('id="btnReadWithRuby"');
    expect(html).toContain('rubyから読み出す');
    expect(html).toContain("sessionStorage.setItem('queryBuilderRubyJson', resultJsonText)");
    expect(html).toContain("window.location.href = '/ruby-wasm?source=query-builder'");
    for (const token of ['json-key', 'json-string', 'json-number', 'json-literal']) expect(html).toContain(token);
  });

  it('テーブル一覧は</script>を含んでいてもscriptタグを閉じない(エスケープ済み)', () => {
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('\\u003c/script>');
  });

  it('script内のJSに構文エラーがない', () => {
    const m = /<script>([\s\S]*?)<\/script>/.exec(html);
    expect(m).toBeTruthy();
    expect(() => new Function(m![1])).not.toThrow();
  });
});

describe('テーブル選択とカラム取得', () => {
  it('テーブルを選ぶとカラム一覧をfetchし、チェックボックスとして表示する', async () => {
    const dom = loadPage(async (input: unknown) => {
      expect(String(input)).toContain('/api/query-builder/columns?table=user_sessions');
      return {
        ok: true,
        json: async () => ({
          table: 'user_sessions',
          columns: [
            { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true },
            { name: 'user_id', type: 'TEXT', notNull: true, primaryKey: false },
          ],
        }),
      };
    });
    const window = dom.window as any;
    const select = window.document.getElementById('tableSelect') as HTMLSelectElement;
    select.value = 'user_sessions';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const grid = window.document.getElementById('columnsGrid') as HTMLElement;
    const boxes = grid.querySelectorAll('.column-checkbox');
    expect(boxes.length).toBe(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect(grid.textContent).toContain('id');
    expect(grid.textContent).toContain('PK');
    expect(window.document.getElementById('modePanel').hidden).toBe(false);
  });

  it('カラム取得に失敗したらエラーを表示し、モードパネルは開かない', async () => {
    const dom = loadPage(async () => ({ ok: false, json: async () => ({ error: 'テーブル x は許可されていません' }) }));
    const window = dom.window as any;
    const select = window.document.getElementById('tableSelect') as HTMLSelectElement;
    select.value = 'user_sessions';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.document.getElementById('status').textContent).toContain('許可されていません');
    expect(window.document.getElementById('modePanel').hidden).toBe(true);
  });
});

describe('モード切替(一覧/集計)', () => {
  it('既定は一覧表示、集計を選ぶとGROUP BY欄が表示され一覧欄が隠れる', () => {
    const dom = loadPage();
    const window = dom.window as any;
    const rowsSection = window.document.getElementById('rowsSection');
    const aggregateSection = window.document.getElementById('aggregateSection');
    expect(rowsSection.hidden).toBe(false);
    expect(aggregateSection.hidden).toBe(true);

    const modeAggregate = window.document.getElementById('modeAggregate') as HTMLInputElement;
    modeAggregate.checked = true;
    modeAggregate.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(rowsSection.hidden).toBe(true);
    expect(aggregateSection.hidden).toBe(false);
  });
});

describe('絞り込み条件の追加', () => {
  it('カラム取得前は「条件を追加」を押しても行が増えない', () => {
    const dom = loadPage();
    const window = dom.window as any;
    (window.document.getElementById('addFilter') as HTMLButtonElement).click();
    expect(window.document.querySelectorAll('.filter-row').length).toBe(0);
  });

  it('カラム取得後は条件行を追加でき、演算子に応じて値欄が切り替わる', async () => {
    const dom = loadPage(async () => ({
      ok: true,
      json: async () => ({ table: 'user_sessions', columns: [{ name: 'id', type: 'INTEGER', notNull: true, primaryKey: true }] }),
    }));
    const window = dom.window as any;
    const select = window.document.getElementById('tableSelect') as HTMLSelectElement;
    select.value = 'user_sessions';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    (window.document.getElementById('addFilter') as HTMLButtonElement).click();
    const row = window.document.querySelector('.filter-row');
    expect(row).toBeTruthy();
    expect(row.querySelector('.filter-value')).toBeTruthy();

    const opSelect = row.querySelector('.filter-op') as HTMLSelectElement;
    opSelect.value = 'in';
    opSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(row.querySelector('.filter-value')).toBeTruthy();

    opSelect.value = 'is_null';
    opSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(row.querySelector('.filter-value')).toBeNull();
  });
});
