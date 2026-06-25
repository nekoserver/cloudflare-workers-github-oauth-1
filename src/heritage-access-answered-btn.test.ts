import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
const view = readFileSync(new URL('./views/heritageAccess.ts', import.meta.url).pathname, 'utf-8');

describe('/api/aichat/check-heritage-questions エンドポイント', () => {
  it('エンドポイントが定義されている', () => {
    expect(src).toContain('/api/aichat/check-heritage-questions');
  });

  it('4つのトピックすべてが定義されている', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 800);
    expect(block).toContain('交通手段');
    expect(block).toContain('見どころ');
    expect(block).toContain('最寄り空港');
    expect(block).toContain('鉄道でのアクセス');
  });

  it('ai_chat_shares テーブルから question を検索している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 800);
    expect(block).toContain('ai_chat_shares');
    expect(block).toContain('question');
  });

  it('answered マップを返している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 800);
    expect(block).toContain('answered');
  });

  it('user_id でフィルタしている（他ユーザーの履歴を返さない）', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 800);
    expect(block).toContain('user_id');
  });

  it('deleted_at IS NULL で論理削除を除外している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 800);
    expect(block).toContain('deleted_at IS NULL');
  });
});

describe('heritageAccess ビュー — 回答済みボタン着色', () => {
  it('.acc-ai-btn.answered スタイルが定義されている', () => {
    expect(view).toContain('.acc-ai-btn.answered');
  });

  it('answered クラスに緑系の色が設定されている', () => {
    const idx = view.indexOf('.acc-ai-btn.answered');
    const block = view.slice(idx, idx + 100);
    expect(block).toMatch(/#[02][ea][0-9a-f]/i);
  });

  it('パネル表示時に check-heritage-questions API を呼んでいる', () => {
    expect(view).toContain('check-heritage-questions');
  });

  it('answered[topic] が true のとき classList.add("answered") している', () => {
    expect(view).toContain('classList.add(\'answered\')');
  });

  it('answered[topic] が false のとき classList.remove("answered") している', () => {
    expect(view).toContain('classList.remove(\'answered\')');
  });
});

describe('buildAiPanel — ボタン属性', () => {
  it('data-topic 属性がボタンに付いている', () => {
    expect(view).toContain('data-topic');
  });

  it('data-heritage 属性がボタンに付いている', () => {
    expect(view).toContain('data-heritage');
  });
});
