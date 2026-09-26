#!/usr/bin/env npx tsx
/**
 * 全テーブル判断材料スコアリングスクリプト
 *
 * src/index.ts の全マイグレーションから `CREATE TABLE IF NOT EXISTS` 定義を
 * すべて抽出し(ALTER TABLE・CREATE INDEXのみのマイグレーションは対象外)、
 * 判断材料A〜L(12問、チャットでの合意事項)を1テーブルにつき12問、Jev API
 * (`callJevApi`、`src/utils/jevEvaluation.ts`と同じエンドポイント・形式)へ
 * 問い合わせ、結果を`jev_table_pattern_scores`へ書き込むSQLを標準出力へ出す。
 *
 * DDL(カラム名・型)だけでは「このテーブルがどんなデータモデルを構成する
 * ために用意されたか」という目的が読み取れないため、`STATUS_TABLE_DEFINITIONS`
 * に登録済みの説明文(`description`)があればDDLの前に付けてJevへ渡す。
 *
 * 使い方:
 *   JEV_API_KEY=xxx npx tsx scripts/evaluate-table-pattern-scores.ts > table-pattern-scores.sql
 *   (生成されたSQLをD1コンソールまたは wrangler d1 execute で実行する)
 *
 * オプション:
 *   --limit=N       先頭N件のテーブルだけを対象にする(動作確認・コスト見積り用)
 *   --only=a,b,c    指定したテーブル名だけを対象にする(カンマ区切り)
 *
 * 前提:
 *   - `jev_table_pattern_scores` テーブル(migration案 '0164'、SPEC参照)が
 *     作成済みであること
 *   - Jev API呼び出しは有償のため、まず --limit=3 等で少数テーブルに対して
 *     動作確認してから全件実行すること
 *
 * このSQLは自動アップロード対象外(CLAUDE.md「自動アップロード対象の区別」参照)。
 * 標準出力へ書くだけで、リポジトリにもartifactsディレクトリにも置かない。
 */

import * as fs from 'fs';
import * as path from 'path';
import { callJevApi, type JevLabel, type JevFetch } from '../src/utils/jevEvaluation';

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_TS_PATH = path.join(REPO_ROOT, 'src/index.ts');

export type TableSchema = { tableName: string; ddl: string };

/**
 * src/index.ts のソース全体から `CREATE TABLE IF NOT EXISTS <name> ( ... );`
 * ブロックをすべて抽出する純粋関数。ALTER TABLE ADD COLUMN・CREATE INDEXのみの
 * マイグレーションはこの正規表現にマッチしないため、自然に除外される。
 *
 * 同じテーブル名が複数マイグレーションで再宣言されている場合(実例:
 * api_endpoint_stats・keyword_category_groups・ts_function_callers、
 * いずれも後から定義を更新するため`CREATE TABLE IF NOT EXISTS`が再度
 * 書かれている)は、ソース内で最後に出現した定義(最新のスキーマ)だけを残す。
 * 重複除去しないと同一テーブルへJevを2回問い合わせてしまい、無駄な課金と
 * 上書きだけのUPSERTが発生する。
 */
export function extractTableSchemas(source: string): TableSchema[] {
  const byName = new Map<string, TableSchema>();
  const re = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const [, tableName, body] = match;
    byName.set(tableName, { tableName, ddl: `CREATE TABLE ${tableName} (${body}\n);` });
  }
  return [...byName.values()];
}

/**
 * `src/index.ts`の`STATUS_TABLE_DEFINITIONS`配列から、テーブル名→人間が書いた
 * 説明文(`description`)のマップを抽出する純粋関数。DDLだけではカラム名・型
 * しか分からず「このテーブルがどんなデータモデルを構成するために用意された
 * のか」という目的が読み取れないため、Jevへ渡す前にこの説明文を補う。
 * `STATUS_TABLE_DEFINITIONS`に登録の無いテーブルは対象外(DDLのみで評価する)。
 */
export function extractTableDescriptions(source: string): Map<string, string> {
  const descriptions = new Map<string, string>();
  const re = /\{ name: '([^']+)',[^}]*?description: '((?:[^'\\]|\\.)*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const [, tableName, description] = match;
    descriptions.set(tableName, description.replace(/\\'/g, "'"));
  }
  return descriptions;
}

/**
 * テーブルDDLから、Jevへ渡す評価対象テキスト(state)を組み立てる純粋関数。
 * `description`(`STATUS_TABLE_DEFINITIONS`由来、「このテーブルがどんな
 * データモデルを構成するために用意されたか」の人間が書いた説明)が分かって
 * いれば、DDLの前に付けてJevへの文脈として渡す。説明が無いテーブルは
 * DDLのみで評価する(判断材料はカラム定義からも大半は判定できるため、
 * 説明の欠如でスキップはしない)。
 */
export function buildStateForTable(schema: TableSchema, description?: string): string {
  const purpose = description ? `\n\n用途: ${description}` : '';
  return `テーブル名: ${schema.tableName}${purpose}\n\n${schema.ddl}`;
}

/**
 * 判断材料A〜L(12問)。jev_labelsテーブル(AIチャット回答評価用)とは無関係の
 * このスクリプト専用の質問セットで、id(1〜12)はJev APIへの問い合わせキーに
 * のみ使い、判断材料コード(A〜L)と1対1で対応させる。
 */
export const JUDGMENT_LABELS: (JevLabel & { code: string })[] = [
  { id: 1, code: 'A', question_text: 'このテーブルには連続値(距離・日時・金額・件数など)型のカラムが含まれるか。', criteria: ['いいえ', 'はい'] },
  { id: 2, code: 'B', question_text: 'このテーブルには自由記述の文字列で、完全一致では意図した検索が成立しないカラムが含まれるか。', criteria: ['いいえ', 'はい'] },
  { id: 3, code: 'C', question_text: 'このテーブルにはUNIQUE制約またはPRIMARY KEYが設定されたカラムが含まれるか(複合主キーの単一カラムのみは除く)。', criteria: ['いいえ', 'はい'] },
  { id: 4, code: 'D', question_text: 'このテーブルにはスキーマ上NULLを許容するカラムが含まれるか。', criteria: ['いいえ', 'はい'] },
  { id: 5, code: 'E', question_text: 'このテーブルのNULL許容カラムは、実際にNULL値が入りうる設計だと読み取れるか(デフォルト値なし、かつ後から埋まる性質の列など)。', criteria: ['いいえ', 'はい'] },
  { id: 6, code: 'F', question_text: 'このテーブルには、2件以上の離散的な候補値でIN句検索が有効に働きそうなカラム(ステータス・種別・カテゴリ等)が含まれるか。', criteria: ['いいえ', 'はい'] },
  { id: 7, code: 'G', question_text: 'このテーブルのカラムのうち、IN句で使うと候補値の個数が無制限に近くなりうる(数十件以上)ものが含まれるか。', criteria: ['いいえ', 'はい'] },
  { id: 8, code: 'H', question_text: 'このテーブルは、件数集計や合計・平均など、GROUP BYによる集計が意味を持つ性質のログ・履歴データか。', criteria: ['いいえ', 'はい'] },
  { id: 9, code: 'I', question_text: 'このテーブルを何らかのカラムでGROUP BYした場合、複数(2件以上)のグループが生じる見込みか。', criteria: ['いいえ', 'はい'] },
  { id: 10, code: 'J', question_text: 'このテーブルに対する典型的な絞り込みクエリは、0件にも全件にもならない実用的な件数を返す見込みか。', criteria: ['いいえ', 'はい'] },
  { id: 11, code: 'K', question_text: 'このテーブルは、1件だけを確実に特定する(主キー・一意キーで引き当てる)使われ方が主な用途か。', criteria: ['いいえ', 'はい'] },
  { id: 12, code: 'L', question_text: 'このテーブルは、複数件を一覧として取得する使われ方が主な用途か。', criteria: ['いいえ', 'はい'] },
];

export type TableScoreRow = { tableName: string; code: string; score: number };

/** 1テーブル分の評価結果を `jev_table_pattern_scores` へのSQLへ変換する。 */
export function toInsertSql(rows: TableScoreRow[]): string {
  return rows
    .map(
      (r) =>
        `INSERT INTO jev_table_pattern_scores (table_name, judgment_code, score) VALUES ('${r.tableName.replace(/'/g, "''")}', '${r.code}', ${r.score}) ON CONFLICT(table_name, judgment_code) DO UPDATE SET score = excluded.score, evaluated_at = datetime('now');`,
    )
    .join('\n');
}

function parseArgs(argv: string[]): { limit: number | null; only: string[] | null } {
  let limit: number | null = null;
  let only: string[] | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length));
    if (arg.startsWith('--only=')) only = arg.slice('--only='.length).split(',').filter(Boolean);
  }
  return { limit, only };
}

async function main() {
  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey) {
    console.error('JEV_API_KEY環境変数が設定されていません。');
    process.exitCode = 1;
    return;
  }

  const source = fs.readFileSync(INDEX_TS_PATH, 'utf-8');
  let schemas = extractTableSchemas(source);
  const descriptions = extractTableDescriptions(source);

  const { limit, only } = parseArgs(process.argv.slice(2));
  if (only) schemas = schemas.filter((s) => only.includes(s.tableName));
  if (limit !== null) schemas = schemas.slice(0, limit);

  const withDescription = schemas.filter((s) => descriptions.has(s.tableName)).length;
  console.error(
    `対象テーブル数: ${schemas.length}件(うち用途説明あり${withDescription}件)、1テーブルあたり${JUDGMENT_LABELS.length}問`,
  );

  const fetchImpl: JevFetch = fetch as unknown as JevFetch;
  let successCount = 0;
  let failureCount = 0;

  for (const schema of schemas) {
    const state = buildStateForTable(schema, descriptions.get(schema.tableName));
    const result = await callJevApi({ apiKey, state, labels: JUDGMENT_LABELS, fetchImpl });

    if (!result.ok) {
      console.error(`[失敗] ${schema.tableName}: ${result.errorCode} ${result.detail}`);
      failureCount++;
      continue;
    }

    const codeById = new Map(JUDGMENT_LABELS.map((l) => [l.id, l.code]));
    const rows: TableScoreRow[] = result.scores.map((s) => ({
      tableName: schema.tableName,
      code: codeById.get(s.labelId) ?? String(s.labelId),
      score: s.value,
    }));
    console.log(toInsertSql(rows));
    successCount++;
  }

  console.error(`完了: 成功${successCount}件、失敗${failureCount}件(1テーブル単位で独立して失敗しても他のテーブルには影響しない)`);
}

if (require.main === module) {
  main();
}
