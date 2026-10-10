// PRマージ/push・commit-summary-externalの3箇所で取得したdiffから、
// 変更ファイル一覧をai_summary_filesへ保存するための共通関数。
// saveSummaryKeywords(aiSummaryKeywords.ts)と同じ方針:
// request_id経由でsummary_log_idを引き、呼び出し元はINSERT後のlastRowIdを
// 持ち歩かない。filePathsが空なら何もしない。

import { fileExtension } from './diffFileList';

export async function saveSummaryFiles(
  db: D1Database,
  requestId: string,
  filePaths: string[],
  nowIso: string,
): Promise<void> {
  if (filePaths.length === 0) return;
  await db.batch(filePaths.map((filePath) => db.prepare(
    `INSERT OR IGNORE INTO ai_summary_files (summary_log_id, file_path, file_ext, created_at)
     SELECT id, ?, ?, ? FROM ai_summary_log WHERE request_id = ?`
  ).bind(filePath, fileExtension(filePath), nowIso, requestId)));
}
