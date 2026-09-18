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
