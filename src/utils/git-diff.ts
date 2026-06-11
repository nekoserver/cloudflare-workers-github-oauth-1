export interface FunctionSnapshot {
  name: string;
  startLine: number;
  endLine: number;
}

export interface FunctionChange {
  name: string;
  changeType: 'add' | 'modify' | 'delete';
  linesAdded: number;
  linesDeleted: number;
  newStartLine: number | null;
  newEndLine: number | null;
}

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

/**
 * 直前バージョン・現行バージョンの関数スナップショットと diff ハンクから、
 * 各関数の変更種別（add / modify / delete）と行差分を求める。
 *
 * - add    : 前バージョンに存在しない関数（新規追加）
 * - modify : 前バージョンにも存在し、かつ diff が 1 行以上ある関数
 * - delete : 前バージョンに存在したが現行では消えた関数
 *
 * diff のない既存関数（コミットに触れられていない関数）は結果に含まれない。
 */
export function classifyFunctionChanges(
  prevFuncs: FunctionSnapshot[],
  currFuncs: FunctionSnapshot[],
  hunks: HunkInfo[],
): FunctionChange[] {
  const prevMap = new Map(prevFuncs.map(f => [f.name, f]));
  const currMap = new Map(currFuncs.map(f => [f.name, f]));
  const results: FunctionChange[] = [];

  for (const fn of currFuncs) {
    const d = diffForRange(hunks, fn.startLine, fn.endLine);
    if (!prevMap.has(fn.name)) {
      results.push({
        name: fn.name,
        changeType: 'add',
        linesAdded:   d.linesAdded > 0 ? d.linesAdded : fn.endLine - fn.startLine + 1,
        linesDeleted: d.linesDeleted,
        newStartLine: fn.startLine,
        newEndLine:   fn.endLine,
      });
    } else if (d.linesAdded > 0 || d.linesDeleted > 0) {
      results.push({
        name: fn.name,
        changeType: 'modify',
        linesAdded:   d.linesAdded,
        linesDeleted: d.linesDeleted,
        newStartLine: fn.startLine,
        newEndLine:   fn.endLine,
      });
    }
  }

  for (const fn of prevFuncs) {
    if (!currMap.has(fn.name)) {
      results.push({
        name: fn.name,
        changeType: 'delete',
        linesAdded:   0,
        linesDeleted: fn.endLine - fn.startLine + 1,
        newStartLine: null,
        newEndLine:   null,
      });
    }
  }

  return results;
}
