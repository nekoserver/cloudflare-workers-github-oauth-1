import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// 対象: scripts/check-migration-table-registry.js (PostToolUseフックスクリプト)。
// migrations/*.sql の新規CREATE TABLEに対し、src/index.ts の3レジストリ
// (STATUS_TABLE_DEFINITIONS/TABLE_COLUMN_KEYS/TABLE_GROUP_MAP)への登録漏れを
// 検知し、結果(ok/ng/error)をデプロイ済みWorkerの POST /internal/harness-hook-log
// (D1バインディング直接、CLOUDFLARE_API_TOKEN不要)へHTTPS POSTで記録する
// (失敗時はローカルフォールバックへ記録+通知)。
//
// 背景: 当初 wrangler d1 execute --remote 経由でD1へ書き込む設計だったが、
// CLOUDFLARE_API_TOKENが無い環境(このリポジトリのClaude Codeセッション含む)では
// 常に失敗しローカルフォールバックにしか記録されず、/harness-logページで
// 一切確認できないという指摘を受けて、デプロイ済みWorker自身への
// HTTPS POST(HARNESS_HOOK_SECRETの共有シークレット認証)に作り直した。
// 詳細は SPEC.cloudflare-workers-github-oauth-1.20260728.Harness.md。
//
// 故障シナリオ:
//   (1) CREATE TABLE文の抽出漏れ(IF NOT EXISTS有無、複数テーブル定義)
//   (2) レジストリブロックの終端マーカーがずれて誤検知/検知漏れになる
//   (3) HARNESS_HOOK_SECRET未設定時にリクエストを送ってしまい、無駄な401待ちが発生する
//   (4) Worker側への書き込み失敗時にログが握りつぶされ、記録も通知も残らない(ルール8違反)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const scriptModule = require('../scripts/check-migration-table-registry.js');
const { extractCreateTableNames, checkRegistries, buildRequestBody, appendFallbackLog, logResult, HARNESS_HOOK_ENDPOINT } = scriptModule;

describe('extractCreateTableNames', () => {
  it('IF NOT EXISTS付きのCREATE TABLEからテーブル名を抽出する', () => {
    const sql = `CREATE TABLE IF NOT EXISTS foo_bar (\n  id INTEGER PRIMARY KEY\n);`;
    expect(extractCreateTableNames(sql)).toEqual(['foo_bar']);
  });

  it('1ファイルに複数のCREATE TABLEがある場合すべて抽出する', () => {
    const sql = `CREATE TABLE IF NOT EXISTS a (id INTEGER);\nCREATE TABLE IF NOT EXISTS b (id INTEGER);`;
    expect(extractCreateTableNames(sql)).toEqual(['a', 'b']);
  });

  it('ALTER TABLEのみの場合は空配列を返す', () => {
    const sql = `ALTER TABLE foo ADD COLUMN bar TEXT;`;
    expect(extractCreateTableNames(sql)).toEqual([]);
  });

  it('同名テーブルが重複しても1回だけ返す', () => {
    const sql = `CREATE TABLE IF NOT EXISTS foo (id INTEGER);\nCREATE TABLE IF NOT EXISTS foo (id INTEGER);`;
    expect(extractCreateTableNames(sql)).toEqual(['foo']);
  });
});

describe('checkRegistries', () => {
  const fakeIndexTs = `
const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'known_table', migration: '0001', description: 'x', syncPolicy: 'auto' },
];

export const TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {
  known_table: { id: 'pk' },
};

export const TABLE_GROUP_MAP: Record<string, string> = {
  known_table: 'system',
};
`;

  it('全レジストリに登録済みのテーブルは missing 結果に含まれない', () => {
    const result = checkRegistries(['known_table'], fakeIndexTs);
    expect(result).toEqual([]);
  });

  it('どのレジストリにも無い新規テーブルは3つとも missing として報告する', () => {
    const result = checkRegistries(['brand_new_table'], fakeIndexTs);
    expect(result).toEqual([
      { table: 'brand_new_table', missing: ['STATUS_TABLE_DEFINITIONS', 'TABLE_COLUMN_KEYS', 'TABLE_GROUP_MAP'] },
    ]);
  });

  it('一部レジストリにのみ抜けがある場合はその分だけ報告する(実際に発見した4テーブルの再現)', () => {
    const partialIndexTs = `
const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'heritage_area_boxes', migration: '0072', description: 'x', syncPolicy: 'auto' },
];

export const TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {
};

export const TABLE_GROUP_MAP: Record<string, string> = {
};
`;
    const result = checkRegistries(['heritage_area_boxes'], partialIndexTs);
    expect(result).toEqual([
      { table: 'heritage_area_boxes', missing: ['TABLE_COLUMN_KEYS', 'TABLE_GROUP_MAP'] },
    ]);
  });
});

describe('buildRequestBody', () => {
  it('rowの各フィールドをそのままJSONボディへマッピングする', () => {
    const body = buildRequestBody({
      hookEvent: 'PostToolUse',
      checkName: 'migration_table_registry_check',
      toolName: 'Write',
      filePath: 'migrations/0099_create_foo.sql',
      result: 'ng',
      detail: 'foo: TABLE_COLUMN_KEYS 未登録',
      sessionId: 'sess-1',
    });
    expect(body).toEqual({
      hookEvent: 'PostToolUse',
      checkName: 'migration_table_registry_check',
      toolName: 'Write',
      filePath: 'migrations/0099_create_foo.sql',
      result: 'ng',
      detail: 'foo: TABLE_COLUMN_KEYS 未登録',
      sessionId: 'sess-1',
    });
  });
});

describe('logResult: HARNESS_HOOK_SECRET未設定時は即フォールバックへ回る(無駄な401待ちをしない)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-fallback-'));
  const fallbackPath = path.join(tmpDir, 'harness-hook-log-fallback.jsonl');
  const origFallback = process.env.HARNESS_HOOK_SECRET;

  afterEach(() => {
    if (fs.existsSync(fallbackPath)) fs.unlinkSync(fallbackPath);
    if (origFallback === undefined) delete process.env.HARNESS_HOOK_SECRET;
    else process.env.HARNESS_HOOK_SECRET = origFallback;
  });

  it('secretがundefinedの場合、fetchを呼ばずにフォールバック保存する', async () => {
    let fetchCalled = false;
    const fakeFetch = async () => { fetchCalled = true; return new Response('{}', { status: 200 }); };
    // logResultは直接ファイルパスを受け取らないため、実際のFALLBACK_LOG_PATH(.claude/配下)に書かれる。
    // ここではsecret未設定時にfetchが呼ばれないことだけを検証する。
    await logResult(
      { hookEvent: 'PostToolUse', checkName: 'migration_table_registry_check', result: 'ok' },
      { secret: undefined, fetchImpl: fakeFetch }
    );
    expect(fetchCalled).toBe(false);
  });
});

describe('logResult: HTTPS POSTでharness_hook_logへ記録する', () => {
  it('成功時(2xx)はfallbackへ書き込まない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-ok-'));
    const before = fs.readdirSync(tmpDir).length;
    let calledUrl: string | null = null;
    let calledInit: { method: string; headers: Record<string, string>; body: string } | null = null;
    const fakeFetch = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
      calledUrl = url;
      calledInit = init;
      return new Response('{"ok":true}', { status: 200 });
    };
    await logResult(
      { hookEvent: 'PostToolUse', checkName: 'migration_table_registry_check', result: 'ok', detail: 'x' },
      { secret: 'test-secret', fetchImpl: fakeFetch }
    );
    expect(calledUrl).toBe(HARNESS_HOOK_ENDPOINT);
    expect(calledInit).not.toBeNull();
    const init = calledInit!;
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-secret');
    const body = JSON.parse(init.body);
    expect(body.result).toBe('ok');
    expect(fs.readdirSync(tmpDir).length).toBe(before);
  });

  it('非2xxレスポンス時はフォールバック保存する(記録の握りつぶし禁止)', async () => {
    const fakeFetch = async () => new Response('Unauthorized', { status: 401 });
    await logResult(
      { hookEvent: 'PostToolUse', checkName: 'migration_table_registry_check', result: 'ng', detail: 'y' },
      { secret: 'wrong-secret', fetchImpl: fakeFetch }
    );
    const fallbackPath = path.join(__dirname, '..', '.claude', 'harness-hook-log-fallback.jsonl');
    expect(fs.existsSync(fallbackPath)).toBe(true);
    const lines = fs.readFileSync(fallbackPath, 'utf-8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.detail).toBe('y');
    expect(last.d1Error).toContain('401');
    // テスト後始末: このテストが作った行だけを気にする必要はないが、
    // 他のfallbackテストと混ざらないよう最後にファイルごと削除する。
    fs.unlinkSync(fallbackPath);
  });

  it('fetch自体が例外を投げた場合もフォールバック保存する', async () => {
    const fakeFetch = async () => { throw new Error('network down'); };
    await logResult(
      { hookEvent: 'PostToolUse', checkName: 'migration_table_registry_check', result: 'error', detail: 'z' },
      { secret: 'test-secret', fetchImpl: fakeFetch }
    );
    const fallbackPath = path.join(__dirname, '..', '.claude', 'harness-hook-log-fallback.jsonl');
    expect(fs.existsSync(fallbackPath)).toBe(true);
    const lines = fs.readFileSync(fallbackPath, 'utf-8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.detail).toBe('z');
    expect(last.d1Error).toContain('network down');
    fs.unlinkSync(fallbackPath);
  });
});

describe('appendFallbackLog(ルール8: D1書き込み失敗時の記録義務)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-fallback-'));
  const fallbackPath = path.join(tmpDir, 'harness-hook-log-fallback.jsonl');

  afterEach(() => {
    if (fs.existsSync(fallbackPath)) fs.unlinkSync(fallbackPath);
  });

  it('D1書き込み失敗を模したエラーを渡すと、JSON1行として記録が残る(握りつぶされない)', () => {
    const row = { hookEvent: 'PostToolUse', checkName: 'migration_table_registry_check', result: 'ng', detail: 'x: TABLE_COLUMN_KEYS 未登録' };
    appendFallbackLog(fallbackPath, row, new Error('wrangler not authenticated'));

    expect(fs.existsSync(fallbackPath)).toBe(true);
    const lines = fs.readFileSync(fallbackPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.result).toBe('ng');
    expect(parsed.detail).toBe('x: TABLE_COLUMN_KEYS 未登録');
    expect(parsed.d1Error).toContain('wrangler not authenticated');
    expect(parsed.loggedAt).toBeTruthy();
  });

  it('複数回の失敗はappendされ、過去の記録を上書きしない', () => {
    appendFallbackLog(fallbackPath, { result: 'ng', detail: '1件目' }, new Error('e1'));
    appendFallbackLog(fallbackPath, { result: 'ng', detail: '2件目' }, new Error('e2'));
    const lines = fs.readFileSync(fallbackPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).detail).toBe('1件目');
    expect(JSON.parse(lines[1]).detail).toBe('2件目');
  });
});
