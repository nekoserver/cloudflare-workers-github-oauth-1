import type { GitHubWebhookPushPayload } from '../types';

// GitHub webhookのpushイベントから、dispatchNotification()へ渡す通知本文を
// 組み立てる純粋関数。/webhook/githubはpull_request・installation(_repositories)・
// repository(created)の3種類のイベントしか通知先(Slack/Altワーカー=cf-auth)へ
// 転送しておらず、pushイベント(リポジトリwebhookの既定イベント)はwebhook_log
// テーブルに記録されるだけで通知が一切飛ばない状態だった(2026-10-01、
// rails-rootのpush webhookがcf-authに記録されない報告で判明)。

export function buildPushNotificationText(payload: GitHubWebhookPushPayload): string | null {
  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) return null;

  const ref = payload.ref ?? '';
  const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
  const pusher = payload.pusher?.name ?? payload.sender?.login ?? 'unknown';

  if (payload.deleted) {
    return [
      'GitHubにpushされました(ブランチ削除)',
      `リポジトリ: ${repoFullName}`,
      `ブランチ: ${branch || '(不明)'}`,
      `実行者: ${pusher}`,
    ].join('\n');
  }

  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  const lines = [
    'GitHubにpushされました',
    `リポジトリ: ${repoFullName}`,
    `ブランチ: ${branch || '(不明)'}`,
    `実行者: ${pusher}`,
    `コミット数: ${commits.length}`,
  ];

  const headMessage = payload.head_commit?.message;
  if (headMessage) {
    lines.push(`最新コミット: ${headMessage.split('\n')[0]}`);
  }
  if (payload.compare) {
    lines.push(payload.compare);
  }
  return lines.join('\n');
}
