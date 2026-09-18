import { describe, expect, it } from 'vitest';
import { getApiKeysPage } from './views/apiKeys';

/**
 * 対象: 🔑キー管理ページ(/api-keys)の「📊 統計」ボタン・使用統計モーダル。
 * GET /api/api-keys/:id/stats(api_key_endpoint_stats集計)を表示する。
 *
 * 故障シナリオ:
 *   (1) 統計ボタンから正しいエンドポイントを叩かない
 *   (2) モーダルがgetNextZ()を使わず固定z-indexで開いてしまう(ルール26)
 *   (3) エンドポイント別・月別・日別のいずれかの区画が抜け落ちる
 *   (4) データが0件のときに空のまま何も表示しない(「データがありません」を
 *       出さない)
 */
describe('🔑キー管理ページ: 使用統計モーダル', () => {
  const html = getApiKeysPage({ name: 'テストユーザー', username: 'testuser' });

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('各行に「📊 統計」ボタンがあり、GET /api/api-keys/:id/statsを叩く', () => {
    expect(html).toContain('📊 統計');
    expect(html).toContain("onclick=\"showStats(&#39;' + item.id + '&#39;)\"");
    expect(html).toContain("fetch('/api/api-keys/' + encodeURIComponent(id) + '/stats'");
  });

  it('統計モーダルはgetNextZ()でz-indexを算出してから開く(ルール26)', () => {
    const idx = html.indexOf('function showStats(id)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('modal.style.zIndex = String(getNextZ())');
    expect(block).toContain("modal.classList.add('show')");
    expect(html).toContain('statsModal: 2000');
  });

  it('エンドポイント別・月別・日別の3区画をすべて描画する', () => {
    expect(html).toContain("renderStatsBarSection('よく使われているエンドポイント', data.byEndpoint");
    expect(html).toContain("renderStatsBarSection('月別(直近)', data.byMonth");
    expect(html).toContain("renderStatsBarSection('日別(直近30日)', recentDays");
  });

  it('データが0件の区画には「データがありません」を表示する(空のまま黙らない)', () => {
    const idx = html.indexOf('function renderStatsBarSection(');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('データがありません');
  });
});
