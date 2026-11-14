export type AichatSourceKey = 'slack' | 'textbox' | 'api' | 'dynamicneko';

export const AICHAT_SOURCE_LABELS: Readonly<Record<AichatSourceKey, string>> = {
  slack: 'Slack',
  textbox: 'AIチャット入力窓',
  api: '回答伝播ページ',
  dynamicneko: 'ダイナミックワーカー',
};

function normalizeAichatSource(rawSource: string | null | undefined): AichatSourceKey {
  if (rawSource === 'slack') return 'slack';
  if (rawSource === 'textbox') return 'textbox';
  if (rawSource === 'dynamicneko') return 'dynamicneko';
  return 'api';
}

/**
 * ai_chat_sharesのsourceカラム別件数を、日ごとキーワード数・質問数モーダルの
 * 円グラフ表示用に正規化する。sourceが未設定(NULL)の既存レコードは
 * 従来のリクエスト元判定(index.tsのrawSource分岐)と同様にapi扱いにする。
 * dynamicneko(saveDynamicnekoAiShareが保存するsource)はapiとは別枠で
 * 集計する。
 */
export function buildAichatSourceTotals(
  rows: Array<{ source: string | null | undefined; q_count: number }>
): Record<AichatSourceKey, number> {
  const totals: Record<AichatSourceKey, number> = { slack: 0, textbox: 0, api: 0, dynamicneko: 0 };
  for (const row of rows) {
    const key = normalizeAichatSource(row.source);
    totals[key] += row.q_count;
  }
  return totals;
}

/**
 * /muse-wasm-test から積まれた要望(INQUIRY_DB の bridge_jobs、origin='muse-wasm-test')の件数を、
 * 日ごとキーワード数・質問数モーダルのリクエスト元別に出すために数える。ai_chat_shares には保存されないため、
 * buildAichatSourceTotals とは別に数える。月は ai_chat_shares の集計と同じく UTC の暦月(created_at はUNIX秒)。
 * INQUIRY_DB が無い・問い合わせに失敗した・月の形が違うときは null を返し、件数0と区別する。
 */
export async function countMuseWasmTestRequests(
  db: D1Database | undefined,
  userSub: string,
  month: string
): Promise<number | null> {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!db || !m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  const start = Date.UTC(year, monthIndex, 1) / 1000;
  const end = Date.UTC(year, monthIndex + 1, 1) / 1000;
  try {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM bridge_jobs WHERE created_by = ? AND origin = ? AND created_at >= ? AND created_at < ?')
      .bind(userSub, 'muse-wasm-test', start, end)
      .first<{ n: number }>();
    return row ? Number(row.n) : 0;
  } catch {
    return null;
  }
}
