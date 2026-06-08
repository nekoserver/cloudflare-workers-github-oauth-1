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
    const fn = html.slice(idx, idx + 10000);
    expect(fn).toContain('polyline');
  });

  it('SVG rect (棒グラフ) を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 10000);
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
    const snippet = src.slice(idx, idx + 2200);
    expect(snippet).toContain('models');
  });

  it('daily-stats レスポンスに kw_count が含まれる', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/daily-stats');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 2200);
    expect(snippet).toContain('kw_count');
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
    const fn = html.slice(idx, idx + 12000);
    expect(fn).toContain('cumKwByDay');
  });

  it('累計を cumSum で加算している', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 12000);
    expect(fn).toContain('cumSum');
  });

  it('折れ線描画で cumKwByDay を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 12000);
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
    const fn = html.slice(idx, idx + 12000);
    expect(fn).toContain('grid-template-columns');
  });
});
