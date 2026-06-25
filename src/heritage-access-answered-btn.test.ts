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
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('交通手段');
    expect(block).toContain('見どころ');
    expect(block).toContain('最寄り空港');
    expect(block).toContain('鉄道でのアクセス');
  });

  it('ai_chat_shares テーブルから id と question を取得している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('ai_chat_shares');
    expect(block).toContain('id, question');
  });

  it('answered マップを返している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('answered');
  });

  it('answered の値が shareId (string) または null を返す', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 1100);
    expect(block).toContain('answeredMap');
    expect(block).toContain('?? null');
  });

  it('user_id でフィルタしている（他ユーザーの履歴を返さない）', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('user_id');
  });

  it('deleted_at IS NULL で論理削除を除外している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('deleted_at IS NULL');
  });

  it('ORDER BY created_at DESC で最新の回答を優先している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('created_at DESC');
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

  it('shareId が取れた場合に data-share-id 属性を設定している', () => {
    expect(view).toContain('data-share-id');
    expect(view).toContain('setAttribute(\'data-share-id\'');
  });

  it('shareId がない場合に data-share-id 属性を除去している', () => {
    expect(view).toContain('removeAttribute(\'data-share-id\')');
  });
});

describe('heritageAccess ビュー — キャッシュ済みボタンのモーダル表示', () => {
  it('askAICached 関数が定義されている', () => {
    expect(view).toContain('function askAICached');
  });

  it('askAICached が /api/aichat/shares/ を呼んでいる', () => {
    const idx = view.indexOf('function askAICached');
    const block = view.slice(idx, idx + 400);
    expect(block).toContain('/api/aichat/shares/');
  });

  it('askAICached が data.answer を表示している', () => {
    const idx = view.indexOf('function askAICached');
    const block = view.slice(idx, idx + 400);
    expect(block).toContain('data.answer');
  });

  it('キャッシュバッジ要素が HTML に存在する', () => {
    expect(view).toContain('ai-modal-cache-badge');
  });

  it('キャッシュ表示時はバッジを表示し、新規 AI 呼び出し時は非表示にする', () => {
    expect(view).toContain('isCached');
    const fnIdx = view.indexOf('function openAiModal');
    const block = view.slice(fnIdx, fnIdx + 300);
    expect(block).toContain('aiModalCacheBadge');
  });

  it('data-share-id がある場合は askAICached を呼ぶ', () => {
    expect(view).toContain('askAICached(name, topic, shareId)');
  });

  it('data-share-id がない場合は askAI（新規生成）を呼ぶ', () => {
    expect(view).toContain('askAI(name, topic)');
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
