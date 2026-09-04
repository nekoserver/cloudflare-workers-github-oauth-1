/**
 * seeds/wine_initial_vectors_v83.csv(= src/data/wineVectors.ts の WINE_VECTOR_SEED)から
 * wine_details への一括INSERT用SQLを再生成する。
 *
 * 根本原因(修正対象): 従来は
 *   INSERT INTO wine_details (wine_id, ...) VALUES ((SELECT id FROM wine_embeddings WHERE wine_name = 'X'), ...)
 * という「VALUES句のサブクエリ」形式で生成していた。wine_embeddings側に該当銘柄が
 * まだ登録されていない場合、このサブクエリはNULLを返すが、wine_details.wine_idは
 * INTEGER PRIMARY KEY(SQLiteのrowid別名)であり、かつD1は既定でPRAGMA foreign_keysが
 * OFFのため外部キー制約違反にもならず、「NULLをINTEGER PRIMARY KEYへINSERTすると
 * 新しいrowidが自動採番される」というSQLiteの仕様により、無関係なwine_idを持つ
 * ゴミ行がエラーも出さずに616件ぶん静かに作られてしまっていた(CLAUDE.mdルール8の
 * 「握りつぶし」に該当する重大なバグ)。
 *
 * 対策: VALUES句ではなく `INSERT INTO ... SELECT e.id, ... FROM wine_embeddings e
 * WHERE e.wine_name = 'X'` という「INSERT-SELECT」形式に変更する。この形式なら
 * wine_nameが一致する行が無ければSELECTが0行を返し、INSERT自体も0行になる
 * (=対応するwine_embeddingsの登録が先に完了していない銘柄は静かにスキップされ、
 * 誤ったwine_idを持つ行は絶対に作られない)。実行順序(bulk-register未実行のまま
 * このSQLだけ流した場合等)に依存しない安全な生成方式にする。
 */
import { WINE_VECTOR_SEED, type WineSeedRow } from '../src/data/wineVectors';

const DETAIL_COLUMNS: (keyof Omit<WineSeedRow, 'wine'>)[] = [
  'pairing_count', 'source_linked_count', 'source_rate', 'reliability',
  'fat', 'sweet', 'acid', 'salt', 'spice', 'umami', 'bitter', 'richness',
  'raw', 'fried', 'grilled_smoked', 'creamy_butter', 'tomato', 'herbal_green',
  'seafood', 'shellfish', 'white_fish', 'oily_fish', 'sushi', 'red_meat',
  'poultry', 'pork', 'lamb', 'dairy', 'mushroom_truffle', 'vegetable', 'dessert',
];

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function buildInsert(row: WineSeedRow): string {
  const cols = ['wine_id', ...DETAIL_COLUMNS, 'created_at', 'updated_at'];
  const selectValues = [
    'e.id',
    ...DETAIL_COLUMNS.map((c) => String(row[c])),
    "datetime('now')",
    "datetime('now')",
  ];
  const updateSet = DETAIL_COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ') + ', updated_at = excluded.updated_at';
  return `INSERT INTO wine_details (${cols.join(', ')}) SELECT ${selectValues.join(', ')} FROM wine_embeddings e WHERE e.wine_name = ${sqlString(row.wine)} ON CONFLICT(wine_id) DO UPDATE SET ${updateSet};`;
}

const lines = WINE_VECTOR_SEED.map(buildInsert);
process.stdout.write(lines.join('\n') + '\n');
