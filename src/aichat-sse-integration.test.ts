import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAiChatPage } from './views/aichat';

const user = { username: 'sse-user', aiChatModel: 'claude-sonnet-4-6', modelColors: {} };

describe('AI chat SSE integration', () => {
  it('生成したインラインスクリプトがブラウザで構文エラーにならない', () => {
    const html = getAiChatPage(user);
    const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi));
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      if (script[1].trim()) expect(() => new Function(script[1])).not.toThrow();
    }
  });

  it('APIは明示的なstream要求だけをSSE化し、JSON互換性を維持する', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
    const route = source.slice(source.indexOf("app.post('/api/aichat'"), source.indexOf("app.post('/api/aichat/moondream-analysis'"));
    expect(route).toContain('if (body.stream)');
    expect(route).toContain("'Content-Type': 'text/event-stream; charset=utf-8'");
    expect(route).toContain("encodeSseEvent('delta'");
    expect(route).toContain("encodeSseEvent('done'");
    expect(route).toContain('autoSave(response, model, usage)');
    expect(route).toContain("return jsonUtf8({ error: 'AI への問い合わせに失敗しました' }, 500)");
  });

  it('メインチャットだけが保存可能なON/OFF設定でstreamを要求し逐次描画する', () => {
    const html = getAiChatPage(user);
    expect(html).toContain('id="aichatStreamToggle"');
    expect(html).toContain("localStorage.getItem('aichat_stream_enabled')");
    expect(html).toContain('stream: aichatStreamToggle.checked');
    expect(html).toContain('function readAichatResponse(res, onDelta)');
    expect(html).toContain("eventName === 'delta'");
    const reask = html.slice(html.indexOf('function openReAskResponseModal'), html.indexOf('function openLinkedQuestionsFilterMaybeLoad'));
    expect(reask).not.toContain('stream:');
  });
});
