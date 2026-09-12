import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTsuruNoNiwaPage } from './tsuruNoNiwa';

describe('鶴の庭ページ', () => {
  const html = getTsuruNoNiwaPage();

  it('7段階の折り工程と操作UIを備える', () => {
    expect(html).toContain('id="origami"');
    expect(html).toContain('id="foldButton"');
    expect(html).toContain('id="unfoldButton"');
    expect(html).toContain('aria-valuemax="6"');
    expect(html.match(/data-step="\d"/g)).toHaveLength(7);
  });

  it('自動折りと一工程ずつの操作を提供する', () => {
    expect(html).toContain('function setStep');
    expect(html).toContain('function startFolding');
    expect(html).toContain("addEventListener('keydown'");
  });

  it('埋め込みJavaScriptに構文エラーがない', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    scripts.forEach((script) => expect(() => new Function(script[1])).not.toThrow());
  });

  it('認証付きの /tsuru-no-niwa ルートへ登録される', () => {
    const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(source).toContain("app.get('/tsuru-no-niwa', authMiddleware");
    expect(source).toContain('getTsuruNoNiwaPage()');
  });
});
