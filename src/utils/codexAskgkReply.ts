// 「/neko askgk codex_prompt="..."」の応答を整形する純粋関数群。
//
// Codex CLI(tunnels.rb経由で呼ばれる先方Bot)はセッション開始時に
// 以下のようなメタ情報バナーを出力する(workdir行から始まり、
// reasoning関連の行まで連続する):
//   workdir: /path/to/repo
//   model: ...
//   provider: ...
//   approval: ...
//   sandbox: ...
//   reasoning effort: ...
//   reasoning summaries: ...
// このバナーは毎回同じ内容でノイズになるため画面表示から除去する。
// バナーの後(前後に区切り線が入ることがある)に続く「session id: <値>」行は
// 内部識別子であって回答内容ではないため表示からは除くが、D1には別途保存する
// (2026-10-04、ユーザー要望)。
//
// 実際のCodex CLI出力の正確な書式はこのリポジトリから直接確認できないため、
// 上記の想定に基づく実装である。実際の出力がこれと異なる場合は
// このファイルの正規表現を調整すること。

export type ParsedCodexAskgkReply = {
  /** バナー・区切り線・session id行を除いた、実際の回答本文。 */
  answer: string;
  /** 「session id:」の後ろの値。見つからなければnull。 */
  sessionId: string | null;
};

const BANNER_META_LINE = /^(workdir|model|provider|approval|sandbox|reasoning(?:\s+\w+)?)\s*:/i;
const DIVIDER_LINE = /^[-=_]{3,}$/;
const SESSION_ID_LINE = /session\s*id\s*:\s*(\S+)/i;

function isSkippableDuringBannerScan(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || DIVIDER_LINE.test(trimmed);
}

/**
 * workdir行から始まるメタ情報バナーの範囲([start, end]、両端含む)を探す。
 * バナー内の空行・区切り線は許容し、バナー行でも空行/区切り線でもない行に
 * 到達したら終了とみなす。workdir行が無ければnullを返す。
 */
function findBannerRange(lines: string[]): { start: number; end: number } | null {
  const start = lines.findIndex((l) => BANNER_META_LINE.test(l.trim()) && /^workdir\s*:/i.test(l.trim()));
  if (start === -1) return null;

  let end = start;
  for (let i = start; i < lines.length; i++) {
    if (BANNER_META_LINE.test(lines[i].trim())) {
      end = i;
    } else if (isSkippableDuringBannerScan(lines[i])) {
      continue;
    } else {
      break;
    }
  }
  return { start, end };
}

export function parseCodexAskgkReply(reply: string): ParsedCodexAskgkReply {
  const lines = reply.split(/\r?\n/);

  const bannerRange = findBannerRange(lines);
  let remaining = bannerRange ? [...lines.slice(0, bannerRange.start), ...lines.slice(bannerRange.end + 1)] : lines;

  let sessionId: string | null = null;
  const sessionIdIndex = remaining.findIndex((l) => SESSION_ID_LINE.test(l));
  if (sessionIdIndex !== -1) {
    const match = remaining[sessionIdIndex].match(SESSION_ID_LINE);
    sessionId = match ? match[1] : null;
    remaining = [...remaining.slice(0, sessionIdIndex), ...remaining.slice(sessionIdIndex + 1)];
  }

  const answer = remaining
    .filter((l) => !DIVIDER_LINE.test(l.trim()))
    .join('\n')
    .trim();

  return { answer, sessionId };
}
