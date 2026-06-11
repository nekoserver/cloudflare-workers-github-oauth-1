import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runKeywordAutoClassification } from './index';

// ===========================================================
// バグ: 検索窓に未分類キーワードを入力してもAIラベル分類を経ずに
// いきなり未分類に分類される。インクリメント入力時に
// 「登録済みか」「分類済みか」をチェックし、未分類ならAI分類に
// 処理を渡すフローをサーバー・クライアント両面で保証する
// ===========================================================

function sliceIndexTs(): string {
  return fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');
}

function sliceRepoTs(): string {
  return fs.readFileSync(path.join(__dirname, 'views', 'repositories.ts'), 'utf-8');
}

interface MockCall {
  sql: string;
  args: unknown[];
}

function makeMockDb(opts?: { failUpdate?: boolean; userLabels?: string[] }) {
  const calls: MockCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          calls.push({ sql, args });
          return {
            async run() {
              if (opts?.failUpdate && sql.startsWith('UPDATE')) throw new Error('update failed');
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: (opts?.userLabels ?? []).map((l) => ({ label: l })) };
            },
            async first() {
              return null;
            },
          };
        },
        async all() {
          return { results: (opts?.userLabels ?? []).map((l) => ({ label: l })) };
        },
      };
    },
  };
  return { db, calls };
}

function makeMockAi(response: string) {
  return {
    run: async () => ({ response }),
  };
}

describe('runKeywordAutoClassification: AI分類ロジックの単体テスト', () => {
  it('AIバインディングが無い場合は uncategorized を返す（空文字やnullにならない）', async () => {
    const { db } = makeMockDb();
    const result = await runKeywordAutoClassification(
      { AI: undefined, DB: db as never, AI_MODEL: undefined },
      'user1', 'テストキーワード', false
    );
    expect(result.autoLabel).toBe('uncategorized');
    expect(result.autoLabel).not.toBe('');
    expect(result.autoLabel).not.toBeNull();
  });

  it('AIが既存カテゴリを返した場合はそのラベルが採用されDBに保存される', async () => {
    const { db, calls } = makeMockDb();
    const result = await runKeywordAutoClassification(
      { AI: makeMockAi('feature') as never, DB: db as never, AI_MODEL: undefined },
      'user1', 'new feature keyword', false
    );
    expect(result.autoLabel).toBe('feature');
    const updateCall = calls.find((c) => c.sql.startsWith('UPDATE'));
    expect(updateCall).toBeDefined();
    expect(updateCall!.args[0]).toBe('feature');
  });

  it('AIが存在しないカテゴリを提案した場合は uncategorized に強制される', async () => {
    const { db } = makeMockDb();
    const result = await runKeywordAutoClassification(
      { AI: makeMockAi('存在しないカテゴリXYZ') as never, DB: db as never, AI_MODEL: undefined },
      'user1', 'strange keyword', false
    );
    expect(result.autoLabel).toBe('uncategorized');
  });

  it('DB保存が全段失敗した場合は uncategorized にフォールバックする（握りつぶし禁止: 戻り値で確認可能）', async () => {
    const { db } = makeMockDb({ failUpdate: true });
    const result = await runKeywordAutoClassification(
      { AI: makeMockAi('feature') as never, DB: db as never, AI_MODEL: undefined },
      'user1', 'kw', false
    );
    expect(result.autoLabel).toBe('uncategorized');
  });

  it('classifyDebug有効時はデバッグ情報を返す', async () => {
    const { db } = makeMockDb();
    const result = await runKeywordAutoClassification(
      { AI: makeMockAi('ui') as never, DB: db as never, AI_MODEL: undefined },
      'user1', 'design keyword', true
    );
    expect(result.classifyDebug).not.toBeNull();
    expect(result.classifyDebug!.resolvedLabel).toBe('ui');
  });
});

describe('index.ts: keyword-classify-check エンドポイント', () => {
  it('GET /api/repositories/search/keyword-classify-check が登録されている', () => {
    const src = sliceIndexTs();
    expect(src).toContain("app.get('/api/repositories/search/keyword-classify-check'");
  });

  it('エンドポイントが shouldReclassifyKeyword で分類済み判定を行う', () => {
    const src = sliceIndexTs();
    const idx = src.indexOf("app.get('/api/repositories/search/keyword-classify-check'");
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, idx + 3000);
    expect(body).toContain('shouldReclassifyKeyword');
  });

  it('エンドポイントが runKeywordAutoClassification を呼んでAI分類に処理を渡す', () => {
    const src = sliceIndexTs();
    const idx = src.indexOf("app.get('/api/repositories/search/keyword-classify-check'");
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, idx + 3000);
    expect(body).toContain('runKeywordAutoClassification');
  });

  it('検索エンドポイントも共通の runKeywordAutoClassification を使う（ロジック重複排除）', () => {
    const src = sliceIndexTs();
    const matches = src.match(/runKeywordAutoClassification\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('repositories.ts: インクリメント入力時の分類チェックフロー', () => {
  it('hSearchInput の input ハンドラがデバウンス付きで keyword-classify-check を呼ぶ', () => {
    const src = sliceRepoTs();
    expect(src).toContain('keyword-classify-check');
    const idx = src.indexOf('runIncrementalClassifyCheck');
    expect(idx).toBeGreaterThan(-1);
    expect(src).toContain('incrClassifyTimer');
  });

  it('分類済みスキップのトーストは info、AI分類実行のトーストは success で色を区別する', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function runIncrementalClassifyCheck');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 2000);
    expect(fn).toContain('AIラベル分類をスキップ');
    expect(fn).toMatch(/AIラベル分類をスキップ[^;]*'info'/);
    expect(fn).toMatch(/自動ラベル分類[^;]*'success'/);
  });

  it('チェックAPI失敗時に error トーストで通知する（握りつぶし禁止）', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function runIncrementalClassifyCheck');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 2000);
    expect(fn).toMatch(/分類チェックに失敗[^;]*'error'/);
  });

  it('AI分類実行後は __pendingAutoLabel をセットして履歴を再読込する', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function runIncrementalClassifyCheck');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 2000);
    expect(fn).toContain('__pendingAutoLabel');
    expect(fn).toContain('__reloadSearchHistory');
  });
});

describe('repositories.ts: 存在しないカテゴリ提案時の強制未分類ガード', () => {
  it('ensureAutoLabelCategoryExists 関数が定義されている', () => {
    const src = sliceRepoTs();
    expect(src).toContain('function ensureAutoLabelCategoryExists');
  });

  it('指定文言「AIは今現在存在しないカテゴリ◯への分類を提案していましたが未分類に分類します」を表示する', () => {
    const src = sliceRepoTs();
    expect(src).toContain('AIは今現在存在しないカテゴリ「');
    expect(src).toContain('への分類を提案していましたが未分類に分類します');
  });

  it('強制未分類時に keyword-label API で DB も未分類に更新する', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function ensureAutoLabelCategoryExists');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1500);
    expect(fn).toContain('keyword-label');
    expect(fn).toContain("'uncategorized'");
  });

  it('__pendingAutoLabel を処理する2箇所の両方でガードを通す', () => {
    const src = sliceRepoTs();
    const matches = src.match(/ensureAutoLabelCategoryExists\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('ガードは getAllCategoryLabels（現在のバッジ一覧）でカテゴリ存在を確認する', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function ensureAutoLabelCategoryExists');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1500);
    expect(fn).toContain('getAllCategoryLabels()');
  });
});
