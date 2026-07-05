import type { F1Circuit } from '../data/f1Circuits';

function formatF1Date(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

/**
 * 本日(now)以降のF1開催日程を、日付昇順の箇条書きSlackメッセージに組み立てる。
 * 罫線文字は使わず「• 」の箇条書きで表現する（CLAUDE.mdルール16）。
 */
export function buildF1ScheduleMessage(circuits: F1Circuit[], now: Date): string {
  const todayStr = now.toISOString().slice(0, 10);
  const upcoming = circuits
    .filter((c) => c.date >= todayStr)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (upcoming.length === 0) {
    return '📅 本日以降のF1開催予定はありません';
  }

  const lines = upcoming.map((c) => `• ${formatF1Date(c.date)}　${c.flag} ${c.circuit}（${c.gp}）`);
  return ['📅 *F1 開催予定*', ...lines].join('\n');
}

export type SlashCommandResponse = {
  status: number;
  body: { response_type: 'ephemeral'; text: string } | null;
};

export type F1ScheduleSlashCommandDeps = {
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  signingSecret: string | undefined;
  slackToken: string | undefined;
  slackChannel: string | undefined;
  circuits: F1Circuit[];
  now: Date;
  verifySignature: (
    rawBody: string,
    timestamp: string | undefined,
    signature: string | undefined,
    signingSecret: string
  ) => Promise<{ success: boolean; reason?: string }>;
  postMessage: (params: { token: string; channel: string; text: string }) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Slack スラッシュコマンド `/pts f1` を処理する。
 * 署名検証に失敗した場合のみ 401・本文なしを返す（Slack以外からの偽装リクエストを拒否するため）。
 * それ以外（設定不備・Slack API失敗・成功）はすべて200 + ephemeralメッセージで返す。
 */
export async function handleF1ScheduleSlashCommand(deps: F1ScheduleSlashCommandDeps): Promise<SlashCommandResponse> {
  if (!deps.signingSecret) {
    return { status: 200, body: { response_type: 'ephemeral', text: '❌ Slack連携の署名鍵（SLACK_SIGNING_SECRET）が設定されていません' } };
  }

  const verification = await deps.verifySignature(deps.rawBody, deps.timestamp, deps.signature, deps.signingSecret);
  if (!verification.success) {
    return { status: 401, body: null };
  }

  if (!deps.slackToken || !deps.slackChannel) {
    return { status: 200, body: { response_type: 'ephemeral', text: '❌ Slack連携が設定されていません（SLACK_OAUTH_TOKEN / SLACK_CHANNEL_ID が未設定）' } };
  }

  const message = buildF1ScheduleMessage(deps.circuits, deps.now);
  const result = await deps.postMessage({ token: deps.slackToken, channel: deps.slackChannel, text: message });
  if (!result.ok) {
    return { status: 200, body: { response_type: 'ephemeral', text: `❌ 投稿に失敗しました: ${result.error || '不明なエラー'}` } };
  }

  return { status: 200, body: { response_type: 'ephemeral', text: '✅ Slackに投稿しました' } };
}
