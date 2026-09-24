import { describe, it, expect } from 'vitest';
import { getAiChatPage, DEFAULT_AICHAT_MODELS } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('DEFAULT_AICHAT_MODELS のエクスポート', () => {
  it('DEFAULT_AICHAT_MODELS がエクスポートされている', () => {
    expect(Array.isArray(DEFAULT_AICHAT_MODELS)).toBe(true);
  });

  it('DEFAULT_AICHAT_MODELS が value と label を持つ要素を含む', () => {
    expect(DEFAULT_AICHAT_MODELS.length).toBeGreaterThan(0);
    DEFAULT_AICHAT_MODELS.forEach(m => {
      expect(typeof m.value).toBe('string');
      expect(typeof m.label).toBe('string');
    });
  });
});

describe('別のモデルに質問: openHistoryModelSelectModal が MODEL_LIST を使う', () => {
  it('openHistoryModelSelectModal 関数が定義されている', () => {
    expect(buildPage()).toContain('function openHistoryModelSelectModal(');
  });

  it('openHistoryModelSelectModal が MODEL_LIST を反復する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHistoryModelSelectModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('MODEL_LIST.forEach');
  });

  it('openHistoryModelSelectModal が Object.keys(MODEL_COLORS) を使わない', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHistoryModelSelectModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).not.toContain('Object.keys(MODEL_COLORS)');
  });

  it('openHistoryModelSelectModal 内で entry.value でモデル値を取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHistoryModelSelectModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('entry.value');
  });
});

describe('/apis ページ: /api/aichat の modelSelect が DEFAULT_AICHAT_MODELS と一致する', () => {
  it('DEFAULT_AICHAT_MODELS の全モデル value が apis.ts の modelSelect に含まれる', async () => {
    const { getApisPage } = await import('./views/apis');
    const html = getApisPage();
    DEFAULT_AICHAT_MODELS.forEach(m => {
      expect(html).toContain(m.value);
    });
  });

  it('DEFAULT_AICHAT_MODELS の全モデル label が apis.ts の modelSelect に含まれる', async () => {
    const { getApisPage } = await import('./views/apis');
    const html = getApisPage();
    DEFAULT_AICHAT_MODELS.forEach(m => {
      expect(html).toContain(m.label);
    });
  });

  it('/api/aichat の説明に /neko ローカルコマンドの挙動が明記されている', async () => {
    const { getApisPage } = await import('./views/apis');
    const html = getApisPage();
    const idx = html.indexOf("path:'/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const entry = html.slice(idx, idx + 400);
    expect(entry).toContain('/neko');
    expect(entry).toContain('/neko help');
    expect(entry).not.toContain('/neko hms');
    expect(entry).not.toContain('/neko clog');
  });

  it('/api/aichat のレスポンス例が実際のフィールド名(response/usedModel)と一致する（answer/ok/tokenUsageという存在しないフィールドを使わない）', async () => {
    const { getApisPage } = await import('./views/apis');
    const html = getApisPage();
    const idx = html.indexOf("path:'/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const entry = html.slice(idx, idx + 1600);
    expect(entry).toContain('response:');
    expect(entry).toContain('usedModel:');
    expect(entry).not.toContain('tokenUsage');
    expect(entry).not.toContain("answer:'Cloudflare");
  });
});
