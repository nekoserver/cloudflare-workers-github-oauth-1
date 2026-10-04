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

export type PushSummaryInput = {
  title: string;
  description: string;
};

/**
 * pushイベントからAI要約(runSummaryPipeline)への入力(title/description)を
 * 組み立てる純粋関数。
 *
 * 背景(2026-10-04): push通知はテキスト(buildPushNotificationText)を
 * Slack/Altワーカーへ転送するだけで、ai_summary_logへのAI要約の記録を
 * 一切行っていなかった。そのためrails-root等、PRを経由せず直接pushされる
 * リポジトリは、cf-auth側の/wspaceメインフィード(ai_summary_logをrepo_full_name
 * で絞り込むだけの既存ロジック)に「要約」が永久に出てこなかった
 * (ingestログとしての生テキストは別PRで読めるようにしたが、それは
 * 「要約」とは別物)。
 *
 * diff本体は取得しない(push 1件ごとにGitHub APIでcompare差分を取得する
 * コスト・失敗シナリオを増やさないため)。コミットメッセージの一覧だけを
 * AIに渡し、何が行われたかの要約を生成する。
 */
export function buildPushSummaryInput(payload: GitHubWebhookPushPayload): PushSummaryInput | null {
  if (payload.deleted) return null;

  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  const messages = commits
    .map((c) => (typeof c.message === 'string' ? c.message.trim() : ''))
    .filter((m) => m !== '');
  if (messages.length === 0) return null;

  const ref = payload.ref ?? '';
  const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref || '(不明)';

  return {
    title: `${branch}ブランチへのpush(${messages.length}件のコミット)`,
    description: messages.map((m) => `- ${m}`).join('\n'),
  };
}
