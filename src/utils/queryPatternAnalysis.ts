import { callJevApi, type JevLabel, type JevFetch, type JevApiResult } from './jevEvaluation';

/**
 * テーブルの判断材料A〜Lスコアリング(クエリパターン分析ページ・
 * scripts/evaluate-table-pattern-scores.ts の両方から使う共有ロジック)。
 *
 * ここに置く関数は「SQLテキストの集合からテーブル定義を取り出す」
 * 「Jevへの評価対象テキストを組み立てる」「判断材料の質問セット」
 * 「スコアリング結果をSQLへ変換する」という、実行環境(Workerランタイム/
 * Node CLI)を問わない純粋な部分だけを持つ。ファイルシステムアクセスは
 * scripts/側(Node専用)に残し、このファイルはWorkerからimportしても
 * 安全なようにNode組み込みモジュールを一切使わない。
 */

export type TableSchema = { tableName: string; ddl: string };

/**
 * SQLテキスト(生の`src/index.ts`全体でも、`STATUS_MIGRATION_SQL`の全値を
 * 連結したものでも良い)から `CREATE TABLE IF NOT EXISTS <name> ( ... );`
 * ブロックをすべて抽出する純粋関数。ALTER TABLE ADD COLUMN・CREATE INDEX
 * のみのマイグレーションはこの正規表現にマッチしないため、自然に除外される。
 *
 * 同じテーブル名が複数マイグレーションで再宣言されている場合(実例:
 * api_endpoint_stats・keyword_category_groups・ts_function_callers、
 * いずれも後から定義を更新するため`CREATE TABLE IF NOT EXISTS`が再度
 * 書かれている)は、最後に出現した定義(最新のスキーマ)だけを残す。
 * 重複除去しないと同一テーブルへJevを2回問い合わせてしまい、無駄な課金と
 * 上書きだけのUPSERTが発生する。
 */
export function extractTableSchemasFromSql(sqlSource: string): TableSchema[] {
  const byName = new Map<string, TableSchema>();
  const re = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sqlSource)) !== null) {
    const [, tableName, body] = match;
    byName.set(tableName, { tableName, ddl: `CREATE TABLE ${tableName} (${body}\n);` });
  }
  return [...byName.values()];
}

/**
 * テーブルDDLから、Jevへ渡す評価対象テキスト(state)を組み立てる純粋関数。
 * `description`(「このテーブルがどんなデータモデルを構成するために
 * 用意されたか」の人間が書いた説明、`STATUS_TABLE_DEFINITIONS`由来)が
 * 分かっていれば、DDLの前に付けてJevへの文脈として渡す。説明が無い
 * テーブルはDDLのみで評価する(判断材料はカラム定義からも大半は判定
 * できるため、説明の欠如でスキップはしない)。
 */
export function buildStateForTable(schema: TableSchema, description?: string): string {
  const purpose = description ? `\n\n用途: ${description}` : '';
  return `テーブル名: ${schema.tableName}${purpose}\n\n${schema.ddl}`;
}

/**
 * 判断材料A〜L(12問)。jev_labelsテーブル(AIチャット回答評価用)とは無関係の
 * この分析専用の質問セットで、id(1〜12)はJev APIへの問い合わせキーにのみ
 * 使い、判断材料コード(A〜L)と1対1で対応させる。
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

const LABEL_CODE_BY_ID = new Map(JUDGMENT_LABELS.map((l) => [l.id, l.code]));

export type TableScoreRow = { tableName: string; code: string; score: number };

/** 1テーブル分の評価結果を `jev_table_pattern_scores` へのUPSERT SQLへ変換する。 */
export function toInsertSql(rows: TableScoreRow[]): string {
  return rows
    .map(
      (r) =>
        `INSERT INTO jev_table_pattern_scores (table_name, judgment_code, score) VALUES ('${r.tableName.replace(/'/g, "''")}', '${r.code}', ${r.score}) ON CONFLICT(table_name, judgment_code) DO UPDATE SET score = excluded.score, evaluated_at = datetime('now');`,
    )
    .join('\n');
}

/**
 * Jev APIの生の結果(`labelId`キー)を、判断材料コード(A〜L)キーの
 * `TableScoreRow[]`へ変換する。呼び出し元(Workerルート・CLIスクリプト
 * 双方)で同じ変換を重複させないための共通処理。
 */
export function toTableScoreRows(tableName: string, jevResult: Extract<JevApiResult, { ok: true }>): TableScoreRow[] {
  return jevResult.scores.map((s) => ({
    tableName,
    code: LABEL_CODE_BY_ID.get(s.labelId) ?? String(s.labelId),
    score: s.value,
  }));
}

/**
 * 1テーブル分の判断材料A〜LをJev APIへ問い合わせる。Workerルート・CLI
 * スクリプトの双方から同じ形で呼べるよう、fetch実装を注入する
 * (`callJevApi`の既存方針を踏襲)。
 */
export async function evaluateTable(params: {
  apiKey: string;
  schema: TableSchema;
  description?: string;
  fetchImpl: JevFetch;
}): Promise<JevApiResult> {
  const { apiKey, schema, description, fetchImpl } = params;
  const state = buildStateForTable(schema, description);
  return callJevApi({ apiKey, state, labels: JUDGMENT_LABELS, fetchImpl });
}
