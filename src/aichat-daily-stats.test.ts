import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// カレンダー欄の 📈 ボタン
// ===========================================================
describe('日次統計グラフ: カレンダー内の📈ボタン', () => {
  it('dailyStatsBtn ボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="dailyStatsBtn"');
  });

  it('📈 ボタンが cal-head 内にある (calPrev/calNext の近く)', () => {
    const html = buildPage();
    const calHeadIdx = html.indexOf('class="cal-head"');
    expect(calHeadIdx).toBeGreaterThan(-1);
    const snippet = html.slice(calHeadIdx, calHeadIdx + 600);
    expect(snippet).toContain('dailyStatsBtn');
    expect(snippet).toContain('calPrev');
  });
});

// ===========================================================
// モーダル HTML
// ===========================================================
describe('日次統計グラフ: モーダルHTML', () => {
  it('dailyStatsModal が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="dailyStatsModal"');
  });

  it('dailyStatsBody が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="dailyStatsBody"');
  });

  it('dailyStatsClose ボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="dailyStatsClose"');
  });

  it('dailyStatsPrev / dailyStatsNext ボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="dailyStatsPrev"');
    expect(html).toContain('id="dailyStatsNext"');
  });

  it('dailyStatsTitle が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="dailyStatsTitle"');
  });
});

// ===========================================================
// JS: renderDailyStatsChart 関数
// ===========================================================
describe('日次統計グラフ: renderDailyStatsChart 関数', () => {
  it('renderDailyStatsChart 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function renderDailyStatsChart');
  });

  it('/api/aichat/daily-stats を fetch する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('/api/aichat/daily-stats');
  });

  it('SVG polyline (折れ線) を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 18000);
    expect(fn).toContain('polyline');
  });

  it('SVG rect (棒グラフ) を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 18000);
    expect(fn).toContain('<rect ');
  });

  it('kw_count を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 10000);
    expect(fn).toContain('kw_count');
  });

  it('models (モデル別質問数) を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 10000);
    expect(fn).toContain('d.models');
  });
});

// ===========================================================
// JS: 月ナビ・開閉
// ===========================================================
describe('日次統計グラフ: 月ナビ・開閉', () => {
  it('dailyStatsBtn クリックで dailyStatsModal を open にする', () => {
    const html = buildPage();
    const idx = html.indexOf("dailyStatsBtn.addEventListener");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain("classList.add('open')");
  });

  it('dailyStatsClose クリックで open を削除する', () => {
    const html = buildPage();
    const idx = html.indexOf("dailyStatsClose.addEventListener");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain("classList.remove('open')");
  });

  it('dailyStatsPrev クリックで前月に移動する', () => {
    const html = buildPage();
    const idx = html.indexOf("'dailyStatsPrev'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('setMonth');
  });

  it('dailyStatsCurrentMonth 変数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('dailyStatsCurrentMonth');
  });

  it('getNextZ() で z-index を設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('dailyStatsModal.style.zIndex');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 60);
    expect(snippet).toContain('getNextZ()');
  });
});

// ===========================================================
// JS: staticZDefaults に dailyStatsModal が登録されている
// ===========================================================
describe('日次統計グラフ: staticZDefaults 登録', () => {
  it('staticZDefaults に dailyStatsModal が含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('dailyStatsModal');
  });
});

// ===========================================================
// backend: /api/aichat/daily-stats エンドポイント
// ===========================================================
describe('日次統計グラフ: backend API', () => {
  it('index.ts に /api/aichat/daily-stats エンドポイントがある', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain('/api/aichat/daily-stats');
  });

  it('daily-stats が aichat_search_history を参照する', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 800);
    expect(snippet).toContain('aichat_search_history');
  });

  it('daily-stats が ai_chat_shares を参照する', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 1200);
    expect(snippet).toContain('ai_chat_shares');
  });

  it('daily-stats レスポンスに models キーが含まれる', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain('models');
  });

  it('daily-stats レスポンスに kw_count が含まれる', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain('kw_count');
  });

  it('daily-stats レスポンスに apiModelTotals が含まれる', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain('apiModelTotals');
  });

  it("daily-stats が source='api' で絞り込む", () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain("source='api'");
  });
});

// ===========================================================
// 左パネル: API経由 モデル別円グラフ
// ===========================================================
describe('日次統計グラフ: API経由モデル別円グラフ', () => {
  it('apiModelTotals をレスポンスから取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 16000);
    expect(fn).toContain('apiModelTotals');
  });

  it('API経由 というラベルが左パネルに出力される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 16000);
    expect(fn).toContain('API経由');
  });

  it('apiModelTotals 用の SVG path（円グラフ）が生成される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 18000);
    const apiIdx = fn.indexOf('apiModelTotals');
    expect(apiIdx).toBeGreaterThan(-1);
    const afterApi = fn.slice(apiIdx, apiIdx + 6000);
    expect(afterApi).toContain('<path ');
  });
});

// ===========================================================
// 左パネル: リクエスト元別円グラフ(Slack/AIチャット入力窓/回答伝播ページ/ダイナミックワーカー)
// ===========================================================
describe('日次統計グラフ: リクエスト元別円グラフ', () => {
  it('sourceTotals をレスポンスから取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 20000);
    expect(fn).toContain('sourceTotals');
  });

  it('Slack・AIチャット入力窓・回答伝播ページ・ダイナミックワーカーの4ラベルが左パネルに出力される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 20000);
    expect(fn).toContain('Slack');
    expect(fn).toContain('AIチャット入力窓');
    expect(fn).toContain('回答伝播ページ');
    expect(fn).toContain('ダイナミックワーカー');
  });

  it('ダイナミックワーカーには他の3種類と異なる色が割り当てられる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 20000);
    const colorsIdx = fn.indexOf('SOURCE_COLORS');
    expect(colorsIdx).toBeGreaterThan(-1);
    const colorsLine = fn.slice(colorsIdx, colorsIdx + 200);
    expect(colorsLine).toContain('dynamicneko');
    expect(colorsLine).not.toContain("dynamicneko: '#611f69'");
    expect(colorsLine).not.toContain("dynamicneko: '#0ea5e9'");
    expect(colorsLine).not.toContain("dynamicneko: '#f59e0b'");
  });

  it('リクエスト元別 というラベルが左パネルに出力される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 20000);
    expect(fn).toContain('リクエスト元別');
  });

  it('sourceTotals 用の SVG path（円グラフ）が生成される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 21000);
    const sourceIdx = fn.indexOf('sourceTotals');
    expect(sourceIdx).toBeGreaterThan(-1);
    const afterSource = fn.slice(sourceIdx, sourceIdx + 3000);
    expect(afterSource).toContain('<path ');
  });
});

// ===========================================================
// backend: /api/aichat/daily-stats エンドポイント sourceTotals
// ===========================================================
describe('日次統計グラフ: backend API sourceTotals', () => {
  it('daily-stats レスポンスに sourceTotals が含まれる', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain('sourceTotals');
  });

  it('daily-stats が source列でGROUP BYして集計する', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain('GROUP BY source');
  });

  it('buildAichatSourceTotalsを呼び出してsourceTotalsを作る', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 3200);
    expect(snippet).toContain('buildAichatSourceTotals(');
  });
});

// ===========================================================
// 折れ線チャート: 日ごと累計
// ===========================================================
describe('日次統計グラフ: 折れ線は日ごと累計KW数', () => {
  it('cumKwByDay 変数が存在する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 14000);
    expect(fn).toContain('cumKwByDay');
  });

  it('累計を cumSum で加算している', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 14000);
    expect(fn).toContain('cumSum');
  });

  it('折れ線描画で cumKwByDay を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 18000);
    const polylineIdx = fn.indexOf('polyline');
    expect(polylineIdx).toBeGreaterThan(-1);
    const aroundLine = fn.slice(Math.max(0, polylineIdx - 600), polylineIdx + 100);
    expect(aroundLine).toContain('cumKwByDay');
  });
});

// ===========================================================
// 左パネル: 総数リスト・パイチャート・比率リスト
// ===========================================================
describe('日次統計グラフ: 左パネル（総数・パイチャート・比率）', () => {
  it('totalsByModel を計算する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('totalsByModel');
  });

  it('モデルを総数降順でソートする', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('sortedModels');
  });

  it('SVG path でパイチャートを描画する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('<path ');
  });

  it('deepseek-r1 をデータ取り込み時に除外する (EXCL 定数)', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('EXCL');
    expect(fn).toContain('deepseek-r1');
  });

  it('比率を toFixed(1) で小数点一桁表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('.toFixed(1)');
  });

  it('比率リストに % を表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain("'%'");
  });

  it('左右2カラムレイアウト (grid-template-columns) を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 18000);
    expect(fn).toContain('grid-template-columns');
  });
});

// ===========================================================
// 埋め込みモデル別 登録済みキーワード率の円グラフ
// ===========================================================
describe('日次統計モーダル: 埋め込みモデル別 登録済みキーワード率', () => {
  it('/api/aichat/keyword-embeddings/model-counts を fetch する(件数取得に一覧APIのLIMIT付きリストは使わない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2500);
    expect(fn).toContain('/api/aichat/keyword-embeddings/model-counts');
  });

  it('buildEmbeddingModelRatioSectionHtml 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function buildEmbeddingModelRatioSectionHtml');
  });

  it('bge-m3・plamo-embedding-1b・embeddinggemma-300mの3モデル分のラベルを含む', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildEmbeddingModelRatioSectionHtml');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('bge-m3');
    expect(fn).toContain('plamo-embedding-1b');
    expect(fn).toContain('embeddinggemma-300m');
  });

  it('登録済みキーワード率というラベルが表示される', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildEmbeddingModelRatioSectionHtml');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('登録済みキーワード率');
  });

  it('SVG path でモデルごとの円グラフを描画する', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildEmbeddingModelRatioSectionHtml');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('<path ');
  });

  it('renderDailyStatsChart内でbuildEmbeddingModelRatioSectionHtmlを呼び出す', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 19000);
    expect(fn).toContain('buildEmbeddingModelRatioSectionHtml(');
  });
});

describe('日次統計モーダル: y軸目盛り数字の文字サイズ', () => {
  it('KW軸（キーワード総数）の目盛り数字が font-size 14 で描画される', () => {
    const html = buildPage();
    expect(html).toContain('font-size="14" fill="var(--text-muted)" text-anchor="end">\' + kwV');
  });

  it('Q軸（質問総数）の目盛り数字が font-size 14 で描画される', () => {
    const html = buildPage();
    expect(html).toContain('font-size="14" fill="var(--text-muted)" text-anchor="end">\' + qV');
  });

  it('KW/Q の軸ラベル自体は従来サイズ (font-size 7) のまま', () => {
    const html = buildPage();
    expect(html).toContain('text-anchor="end">KW</text>');
    expect(html).toContain('text-anchor="end">Q</text>');
    const kwLabelIdx = html.indexOf('text-anchor="end">KW</text>');
    const before = html.slice(kwLabelIdx - 80, kwLabelIdx);
    expect(before).toContain('font-size="7"');
  });
});
