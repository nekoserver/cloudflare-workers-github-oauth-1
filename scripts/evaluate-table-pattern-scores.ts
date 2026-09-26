#!/usr/bin/env npx tsx
/**
 * 全テーブル判断材料スコアリングCLIスクリプト
 *
 * 本体Workerに`/query-pattern-analysis`ページ(GET)と
 * `POST /api/query-pattern-analysis/seed`エンドポイントを追加したため、
 * デプロイ済みの環境ではそちらからJEV_API_KEYをローカルに用意せず実行できる。
 * このスクリプトは、デプロイ前の事前見積り・動作確認や、ページ経由では
 * 都合が悪い場合(大量バッチをまとめてSQLファイルに残したい等)のための
 * 代替手段として残している。
 *
 * src/index.ts の全マイグレーションから `CREATE TABLE IF NOT EXISTS` 定義を
 * すべて抽出し(ALTER TABLE・CREATE INDEXのみのマイグレーションは対象外)、
 * 判断材料A〜L(12問、`src/utils/queryPatternAnalysis.ts`で定義)を
 * 1テーブルにつき12問、Jev APIへ問い合わせ、結果を`jev_table_pattern_scores`
 * へ書き込むSQLを標準出力へ出す。
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
 *   - `jev_table_pattern_scores` テーブル(SPEC参照)が作成済みであること
 *   - Jev API呼び出しは有償のため、まず --limit=3 等で少数テーブルに対して
 *     動作確認してから全件実行すること
 *
 * このSQLは自動アップロード対象外(CLAUDE.md「自動アップロード対象の区別」参照)。
 * 標準出力へ書くだけで、リポジトリにもartifactsディレクトリにも置かない。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { JevFetch } from '../src/utils/jevEvaluation';
import {
  extractTableSchemasFromSql,
  buildStateForTable,
  JUDGMENT_LABELS,
  toInsertSql,
  toTableScoreRows,
  evaluateTable,
  type TableSchema,
} from '../src/utils/queryPatternAnalysis';

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_TS_PATH = path.join(REPO_ROOT, 'src/index.ts');

export { extractTableSchemasFromSql as extractTableSchemas, buildStateForTable, JUDGMENT_LABELS, toInsertSql };
export type { TableSchema };

/**
 * `src/index.ts`の`STATUS_TABLE_DEFINITIONS`配列から、テーブル名→人間が書いた
 * 説明文(`description`)のマップを抽出する純粋関数。CLI版はファイルの生テキスト
 * しか持たないためこの正規表現抽出が必要(Worker版は構造化された配列を
 * そのまま持っているため不要、`src/index.ts`のルートハンドラ側を参照)。
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
  let schemas = extractTableSchemasFromSql(source);
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
    const result = await evaluateTable({ apiKey, schema, description: descriptions.get(schema.tableName), fetchImpl });

    if (!result.ok) {
      console.error(`[失敗] ${schema.tableName}: ${result.errorCode} ${result.detail}`);
      failureCount++;
      continue;
    }

    console.log(toInsertSql(toTableScoreRows(schema.tableName, result)));
    successCount++;
  }

  console.error(`完了: 成功${successCount}件、失敗${failureCount}件(1テーブル単位で独立して失敗しても他のテーブルには影響しない)`);
}

if (require.main === module) {
  main();
}
