import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { extractAiUsage } from './index';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// extractAiUsage: Cloudflare Workers AI レスポンスのトークン数抽出
// ===========================================================
describe('extractAiUsage', () => {
  it('input_tokens / output_tokens / total_tokens をそのまま返す', () => {
    const r = extractAiUsage({ input_tokens: 10, output_tokens: 20, total_tokens: 30 });
    expect(r).toEqual({ input_tokens: 10, output_tokens: 20, total_tokens: 30 });
  });

  it('prompt_tokens を input_tokens、completion_tokens を output_tokens にマップする', () => {
    const r = extractAiUsage({ prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 });
    expect(r.input_tokens).toBe(15);
    expect(r.output_tokens).toBe(25);
    expect(r.total_tokens).toBe(40);
  });

  it('total_tokens が null でも input + output から補完する', () => {
    const r = extractAiUsage({ prompt_tokens: 10, completion_tokens: 20 });
    expect(r.input_tokens).toBe(10);
    expect(r.output_tokens).toBe(20);
    expect(r.total_tokens).toBe(30);
  });

  it('input_tokens と prompt_tokens が両方あるとき input_tokens を優先する', () => {
    const r = extractAiUsage({ input_tokens: 5, prompt_tokens: 99, output_tokens: 6, completion_tokens: 99 });
    expect(r.input_tokens).toBe(5);
    expect(r.output_tokens).toBe(6);
  });

  it('空オブジェクトはすべて null', () => {
    expect(extractAiUsage({})).toEqual({ input_tokens: null, output_tokens: null, total_tokens: null });
  });

  it('null はすべて null', () => {
    expect(extractAiUsage(null)).toEqual({ input_tokens: null, output_tokens: null, total_tokens: null });
  });

  it('数値以外の値は null にする', () => {
    const r = extractAiUsage({ input_tokens: 'abc', output_tokens: true, total_tokens: null });
    expect(r).toEqual({ input_tokens: null, output_tokens: null, total_tokens: null });
  });
});

// ===========================================================
// index.ts: マイグレーション & AI 呼び出し
// ===========================================================
describe('トークン使用量: index.ts バックエンド', () => {
  it('マイグレーション 0050 が input_tokens カラム追加を含む', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf("'0050'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 300);
    expect(snippet).toContain('input_tokens');
    expect(snippet).toContain('output_tokens');
    expect(snippet).toContain('total_tokens');
  });

  it('runAi が extractAiUsage を使って usage を取得するコードを持つ', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('const usage: AiUsage = extractAiUsage(usageObj)');
  });

  it('autoSave が input_tokens / output_tokens / total_tokens を INSERT する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('const autoSave');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1200);
    expect(fn).toContain('input_tokens');
    expect(fn).toContain('output_tokens');
    expect(fn).toContain('total_tokens');
  });

  it('/api/aichat/token-usage エンドポイントが存在する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('/api/aichat/token-usage');
  });

  it('token-usage が model / input_tokens / output_tokens で GROUP BY する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/token-usage');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 1600);
    expect(snippet).toContain('model');
    expect(snippet).toContain('SUM');
    expect(snippet).toContain('GROUP BY');
  });

  // 対象: `/api/aichat/token-usage`のgranularityクエリパラメータ(day/month)。
  // モデル別トークン使用量モーダルで日毎/月毎の切替表示を可能にするため、
  // strftimeのフォーマットとsinceの計算をgranularityで分岐させている。
  //
  // 故障シナリオ:
  //   (1) granularity=dayを指定しても月単位のまま集計されてしまう
  //   (2) granularity未指定時のデフォルト挙動(月単位)が変わってしまう
  //   (3) 不正なgranularity値(想定外の文字列)でSQLエラーや例外になる
  it('granularity=dayのとき日単位(%Y-%m-%d)でstrftimeする', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/token-usage');
    const snippet = src.slice(idx, idx + 1600);
    expect(snippet).toContain("'day'");
    expect(snippet).toContain('%Y-%m-%d');
    expect(snippet).toContain('%Y-%m');
  });

  it('granularity未指定時は従来どおり月(month)がデフォルトになる', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/token-usage');
    const snippet = src.slice(idx, idx + 400);
    expect(snippet).toContain("=== 'day' ? 'day' : 'month'");
  });
});

// ===========================================================
// フロントエンド: サイドバー内グラフボタン
// ===========================================================
describe('トークン使用量: フロントエンド', () => {
  it('カレンダーヘッドにトークングラフボタンがある', () => {
    const html = buildPage();
    expect(html).toContain('tokenUsageBtn');
  });

  it('tokenUsageModal または tokenUsageOverlay が HTML に含まれる', () => {
    const html = buildPage();
    const hasModal = html.includes('tokenUsageModal') || html.includes('tokenUsageOverlay');
    expect(hasModal).toBe(true);
  });

  it('/api/aichat/token-usage を fetch するコードがある', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/token-usage');
  });

  // 対象: モデル別トークン使用量モーダルの日毎/月毎切替ボタン。
  //
  // 故障シナリオ:
  //   (1) 切替ボタン自体がマークアップに存在しない
  //   (2) 切替ボタンを押してもgranularityパラメータ付きでfetchし直されない
  //   (3) 押した側のボタンにactiveクラスが付かない(どちらが選択中か分からない)
  it('日毎/月毎の切替ボタン(#tokenUsageGranMonth・#tokenUsageGranDay)がある', () => {
    const html = buildPage();
    expect(html).toContain('id="tokenUsageGranMonth"');
    expect(html).toContain('id="tokenUsageGranDay"');
    expect(html).toContain("data-granularity=\"month\"");
    expect(html).toContain("data-granularity=\"day\"");
  });

  it('renderTokenUsageGraphがgranularityに応じてクエリパラメータを切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf('renderTokenUsageGraph');
    const snippet = html.slice(idx, idx + 1200);
    expect(snippet).toContain("granularity=day&days=30");
    expect(snippet).toContain("granularity=month&months=6");
  });

  it('SVG またはグラフ描画コードが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('/api/aichat/token-usage');
    expect(idx).toBeGreaterThan(-1);
    const surrounding = html.slice(Math.max(0, idx - 200), idx + 5000);
    const hasSvg = surrounding.includes('svg') || surrounding.includes('SVG') || surrounding.includes('rect') || surrounding.includes('canvas');
    expect(hasSvg).toBe(true);
  });
});
