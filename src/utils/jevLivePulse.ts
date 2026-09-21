export type JevLivePulseRow = {
  jev_label_id: number;
  label_text: string;
  recent_average: number | null;
  baseline_average: number | null;
  recent_count: number;
};

export type JevLivePulseItem = {
  labelId: number;
  label: string;
  average: number;
  delta: number | null;
  sampleCount: number;
};

/**
 * D1の時間窓集計を、ライブ表示用の「変化が大きい順」に整形する。
 * baselineが無い新規ラベルも捨てず、delta=nullとして末尾に残す。
 */
export function buildJevLivePulse(rows: JevLivePulseRow[], limit = 5): JevLivePulseItem[] {
  return rows
    .filter((row) => row.recent_count > 0 && row.recent_average !== null)
    .map((row) => ({
      labelId: row.jev_label_id,
      label: row.label_text,
      average: Number(row.recent_average),
      delta: row.baseline_average === null
        ? null
        : Number(row.recent_average) - Number(row.baseline_average),
      sampleCount: row.recent_count,
    }))
    .sort((a, b) => {
      if (a.delta === null) return b.delta === null ? a.labelId - b.labelId : 1;
      if (b.delta === null) return -1;
      return Math.abs(b.delta) - Math.abs(a.delta) || a.labelId - b.labelId;
    })
    .slice(0, Math.max(0, limit));
}
