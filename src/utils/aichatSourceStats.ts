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
