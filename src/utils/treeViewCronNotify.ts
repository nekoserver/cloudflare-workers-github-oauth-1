import { postSlackMessage, type SlackPostResult } from './slack';
import { buildFreeTextSlackBlocks } from './freeTextSlackPost';
import { getNextTreeViewCronAt } from './treeViewCronCountdown';

export type TreeViewCronSyncResult = {
  synced: string[];
  skipped: string[];
  failed: { repoName: string; error: string }[];
};

/** tree-view同期完了後、tsubuyakiと同じインタラクティブ形式でSlackに投稿する。 */
export async function notifyTreeViewCronUpdate(
  env: { SOT?: string; SLACK_CHANNEL_ID?: string },
  result: TreeViewCronSyncResult,
  completedAt = new Date(),
  nextUpdateAt = getNextTreeViewCronAt(completedAt),
): Promise<SlackPostResult> {
  if (!env.SOT || !env.SLACK_CHANNEL_ID) {
    return { ok: false, error: 'SOT / SLACK_CHANNEL_ID が未設定です' };
  }
  const time = completedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
  const nextTime = new Date(nextUpdateAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
  const text = 'tree-view cronトリガーの更新処理が完了しました。\n更新時間: ' + time + '（日本時間）'
    + '\n次回予定: ' + nextTime + '（日本時間）'
    + '\n更新: ' + result.synced.length + '件 / 変更なし: ' + result.skipped.length
    + '件 / 失敗: ' + result.failed.length + '件'
    + result.failed.map(({ repoName, error }) => '\n失敗理由: ' + repoName + ': ' + error).join('');
  try {
    return await postSlackMessage({
      token: env.SOT, channel: env.SLACK_CHANNEL_ID,
      text: 'cronトリガー更新通知\n' + text,
      blocks: buildFreeTextSlackBlocks('tree-view cron', text, 'interactive_sample'),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Slack通知に失敗しました' };
  }
}
