export type AichatSourceKey = 'slack' | 'textbox' | 'api';

export const AICHAT_SOURCE_LABELS: Readonly<Record<AichatSourceKey, string>> = {
  slack: 'Slack',
  textbox: 'AIチャット入力窓',
  api: '回答伝播ページ',
};

function normalizeAichatSource(rawSource: string | null | undefined): AichatSourceKey {
  if (rawSource === 'slack') return 'slack';
  if (rawSource === 'textbox') return 'textbox';
  return 'api';
}

/**
 * ai_chat_sharesのsourceカラム別件数を、日ごとキーワード数・質問数モーダルの
 * 円グラフ表示用に正規化する。sourceが未設定(NULL)の既存レコードは
 * 従来のリクエスト元判定(index.tsのrawSource分岐)と同様にapi扱いにする。
 */
export function buildAichatSourceTotals(
  rows: Array<{ source: string | null | undefined; q_count: number }>
): Record<AichatSourceKey, number> {
  const totals: Record<AichatSourceKey, number> = { slack: 0, textbox: 0, api: 0 };
  for (const row of rows) {
    const key = normalizeAichatSource(row.source);
    totals[key] += row.q_count;
  }
  return totals;
}
