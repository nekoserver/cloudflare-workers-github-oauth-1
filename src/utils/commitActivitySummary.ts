export interface CommitActivityDailyRow {
  date: string;
  commitCount: number;
  fileChangeCount: number;
  topics: string[];
}

export interface CommitCountRow {
  date: string;
  commitCount: number;
}

export interface FileChangeCountRow {
  date: string;
  fileChangeCount: number;
}

export interface TopicRow {
  date: string;
  topic: string;
}

/**
 * SPEC.cloudflare-workers-github-oauth-1.20261015.commit-activity-dashboard.md
 * 参照。repo_commit_index(日別コミット数)・commit_file_changes(日別変更
 * ファイル数)・commit_summary_topics経由(日別Topic)の3つの別々のクエリ結果を、
 * 日付をキーに1本の配列へ統合する純粋関数。
 *
 * 3つのクエリはそれぞれ別のテーブルを日付でGROUP BYしているため、
 * 同じ日付がどのクエリにも存在するとは限らない(例: コミットはあるが
 * commit_file_changesはまだバックフィルされていない日)。日付の和集合を取り、
 * 存在しない軸は0件/空配列として埋める。
 */
export function mergeCommitActivityDaily(
  commitRows: readonly CommitCountRow[],
  fileChangeRows: readonly FileChangeCountRow[],
  topicRows: readonly TopicRow[]
): CommitActivityDailyRow[] {
  const commitByDate = new Map(commitRows.map((r) => [r.date, r.commitCount]));
  const fileChangeByDate = new Map(fileChangeRows.map((r) => [r.date, r.fileChangeCount]));
  const topicsByDate = new Map<string, string[]>();
  for (const row of topicRows) {
    const existing = topicsByDate.get(row.date);
    if (existing) {
      if (!existing.includes(row.topic)) existing.push(row.topic);
    } else {
      topicsByDate.set(row.date, [row.topic]);
    }
  }

  const allDates = new Set<string>([...commitByDate.keys(), ...fileChangeByDate.keys(), ...topicsByDate.keys()]);

  return Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      commitCount: commitByDate.get(date) ?? 0,
      fileChangeCount: fileChangeByDate.get(date) ?? 0,
      topics: topicsByDate.get(date) ?? [],
    }));
}
