/**
 * AIチャットの詳細プレビューモーダル(historyModal)から、表示中の回答バブルの
 * jev_evaluations(jev_label_id=1〜20、いわゆるループA)の評価値を並べて表示する
 * 機能の純粋ロジック。
 */

export type JevValueRow = { jev_label_id: number; value: number };
export type JevLoopValue = { jevLabelId: number; value: number | null };

const LOOP_FROM = 1;
const LOOP_TO = 20;

/**
 * jev_label_id=1〜20(ループA)の順に、対応するjev_evaluations行のvalueを
 * 詰める。行が無いIDはnull(黙って除外せず、20件を必ず返す)。valueでの
 * 並び替えはせず、質問IDの数値順(ループAの順)を維持する。
 */
export function buildJevValuesForLoop(rows: JevValueRow[]): JevLoopValue[] {
  const valueByLabelId = new Map(rows.map((r) => [r.jev_label_id, r.value]));
  const result: JevLoopValue[] = [];
  for (let jevLabelId = LOOP_FROM; jevLabelId <= LOOP_TO; jevLabelId++) {
    result.push({ jevLabelId, value: valueByLabelId.get(jevLabelId) ?? null });
  }
  return result;
}

export type JevButtonState = 'pink' | 'yellow' | 'green';

/**
 * AIチャット詳細プレビューモーダルの📔ボタンの背景色を決める3状態:
 * - pink: 通常のjevテーブル(jev_labels/jev_evaluations)自体がDBに存在しない(未作成・エラー状態)
 * - yellow: テーブルはあるが、この質問+モデルについて評価データが1件も無い(未評価)
 * - green: 1件でも評価データがあれば合格扱い(20件全部揃っている必要はない)
 */
export function computeJevButtonState(values: JevLoopValue[], tableMissing: boolean): JevButtonState {
  if (tableMissing) return 'pink';
  const hasAny = values.some((v) => v.value !== null);
  return hasAny ? 'green' : 'yellow';
}

/**
 * D1/SQLiteのエラーメッセージから「テーブル自体が存在しない」ケースを
 * 判別する(「no such table: jev_evaluations」等)。この文字列判定結果は
 * ユーザーへの表示や成否判定には使わず、computeJevButtonStateへ渡す
 * tableMissingフラグの算出にのみ使う(ルール32の趣旨に反しないよう、
 * 用途をこの1箇所の分類に限定する)。
 */
export function isMissingTableError(message: string): boolean {
  return /no such table/i.test(message);
}
