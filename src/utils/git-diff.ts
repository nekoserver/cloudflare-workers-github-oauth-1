export interface HunkInfo {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  addedLines: number;
  deletedLines: number;
}

export interface FunctionDiff {
  linesAdded: number;
  linesDeleted: number;
}

/** unified diff 文字列から @@ ハンクを解析する */
export function parseHunks(diff: string): HunkInfo[] {
  const hunks: HunkInfo[] = [];
  let current: HunkInfo | null = null;

  for (const line of diff.split('\n')) {
    const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      if (current) hunks.push(current);
      current = {
        oldStart:    parseInt(m[1], 10),
        oldCount:    m[2] !== undefined ? parseInt(m[2], 10) : 1,
        newStart:    parseInt(m[3], 10),
        newCount:    m[4] !== undefined ? parseInt(m[4], 10) : 1,
        addedLines:   0,
        deletedLines: 0,
      };
    } else if (current) {
      if (line.startsWith('+')) current.addedLines++;
      else if (line.startsWith('-')) current.deletedLines++;
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

/**
 * 関数の行範囲 [startLine, endLine] に関係するハンクの
 * lines_added / lines_deleted を集計する。
 *
 * 追加行は新ファイル上の位置で判定、削除行は newStart を基準に判定する
 * （純粋削除ハンクは newCount=0 で newStart が削除位置を示す）。
 */
export function diffForRange(
  hunks: HunkInfo[],
  startLine: number,
  endLine: number,
): FunctionDiff {
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const h of hunks) {
    const newEnd = h.newStart + Math.max(h.newCount - 1, 0);
    const overlapsNew = h.newStart <= endLine && newEnd >= startLine;

    // 純粋削除ハンク（newCount=0）は newStart が関数範囲に含まれるか確認
    const pureDel = h.newCount === 0 && h.newStart >= startLine && h.newStart <= endLine;

    if (overlapsNew || pureDel) {
      linesAdded   += h.addedLines;
      linesDeleted += h.deletedLines;
    }
  }
  return { linesAdded, linesDeleted };
}
