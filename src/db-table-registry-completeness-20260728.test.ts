import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  STATUS_TABLE_DEFINITIONS,
  STATUS_MIGRATION_SQL,
  TABLE_COLUMN_KEYS,
  TABLE_GROUP_MAP,
} from './index';

// 対象: migrations/*.sql の CREATE TABLE 文と、src/index.ts の5つのD1テーブル
// レジストリ(STATUS_TABLE_DEFINITIONS, TABLE_COLUMN_KEYS, TABLE_GROUP_MAP,
// STATUS_MIGRATION_SQL, および STATUS_TABLE_DEFINITIONS の migration 番号が
// 参照する STATUS_MIGRATION_SQL のエントリ)の整合性。
//
// 背景: heritage_ai_question_masters(0065)・heritage_question_view_log(0066)・
// heritage_area_boxes(0072)・heritage_area_items(0073) の4テーブルが、
// マイグレーションファイルとしては存在するのに一部のレジストリへの登録が
// 漏れていた(最大4種類のレジストリのうち1〜4個が未登録)。「新しいテーブルを
// 作ったら関連レジストリへの登録を手作業で思い出す」というエージェント/人間の
// 記憶に依存した運用では再発を防げないため、CI・pre-push で機械的に検知できる
// テストとして固定する(詳細は SPEC.cloudflare-workers-github-oauth-1.20260728.Harness.md
// を参照)。
//
// 故障シナリオ:
//   (1) 新しいmigrationファイルでCREATE TABLEしたが、STATUS_TABLE_DEFINITIONS/
//       TABLE_COLUMN_KEYS/TABLE_GROUP_MAPのいずれかへの追加を忘れる
//   (2) STATUS_TABLE_DEFINITIONSにmigration番号を書いたが、対応するSQL文を
//       STATUS_MIGRATION_SQLへ追加し忘れる(/status の「このSQLを実行」機能が
//       404を返す原因になる)
//   (3) STATUS_MIGRATION_SQL内でmigration番号のキーが重複し、片方が
//       サイレントに上書きされて永久に参照不能になる(TypeScriptオブジェクト
//       リテラルの仕様上、実行時オブジェクトからは重複を検知できないため、
//       ソースコードのテキストを直接走査して検知する)

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const INDEX_TS_PATH = path.resolve(__dirname, 'index.ts');

function listCreatedTables(): Map<string, string> {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const tableToMigration = new Map<string, string>();
  for (const f of files) {
    const migration = f.slice(0, 4);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
    const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      if (!tableToMigration.has(m[1])) {
        tableToMigration.set(m[1], migration);
      }
    }
  }
  return tableToMigration;
}

describe('D1テーブルレジストリの完全性(migrations/*.sql との突き合わせ)', () => {
  const createdTables = listCreatedTables();

  it('前提: migrationsディレクトリから60件以上のCREATE TABLEを検出できる(抽出ロジック自体の健全性確認)', () => {
    expect(createdTables.size).toBeGreaterThan(60);
  });

  it('全てのCREATE TABLE対象がSTATUS_TABLE_DEFINITIONSに登録されている', () => {
    const defined = new Set(STATUS_TABLE_DEFINITIONS.map((d) => d.name));
    const missing = [...createdTables.keys()].filter((name) => !defined.has(name));
    expect(missing, `STATUS_TABLE_DEFINITIONS未登録: ${missing.join(', ')}`).toEqual([]);
  });

  it('全てのCREATE TABLE対象がTABLE_COLUMN_KEYSに登録されている', () => {
    const missing = [...createdTables.keys()].filter((name) => !(name in TABLE_COLUMN_KEYS));
    expect(missing, `TABLE_COLUMN_KEYS未登録: ${missing.join(', ')}`).toEqual([]);
  });

  it('全てのCREATE TABLE対象がTABLE_GROUP_MAPに登録されている', () => {
    const missing = [...createdTables.keys()].filter((name) => !(name in TABLE_GROUP_MAP));
    expect(missing, `TABLE_GROUP_MAP未登録: ${missing.join(', ')}`).toEqual([]);
  });

  it('STATUS_TABLE_DEFINITIONSが参照する数字migration番号は全てSTATUS_MIGRATION_SQLにSQL文を持つ', () => {
    const numericMigrations = new Set(
      STATUS_TABLE_DEFINITIONS.map((d) => d.migration).filter((m) => /^\d{4}$/.test(m))
    );
    const missing = [...numericMigrations].filter((m) => !(m in STATUS_MIGRATION_SQL));
    expect(missing, `STATUS_MIGRATION_SQL未登録のmigration番号: ${missing.join(', ')}`).toEqual([]);
  });

  it('src/index.ts のソーステキスト上でSTATUS_MIGRATION_SQLのキー(4桁migration番号)が重複していない', () => {
    const src = fs.readFileSync(INDEX_TS_PATH, 'utf-8');
    const start = src.indexOf('STATUS_MIGRATION_SQL: Record<string, string> = {');
    expect(start, 'STATUS_MIGRATION_SQL の定義が見つからない').toBeGreaterThan(-1);
    const end = src.indexOf('\n};', start);
    const block = src.slice(start, end);
    const keys = [...block.matchAll(/'(\d{4})':\s*`/g)].map((m) => m[1]);
    const uniqueKeys = new Set(keys);
    expect(keys.length, `重複キー: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`).toBe(uniqueKeys.size);
  });
});
