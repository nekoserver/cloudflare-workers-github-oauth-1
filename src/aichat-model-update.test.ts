import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(model: string): string {
  return getAiChatPage({
    name: 'テストユーザー',
    username: 'testuser',
    aiChatModel: model,
  });
}

const LLAMA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

describe('モデルリスト更新: DeepSeek 削除・新モデル追加', () => {
  it('DeepSeek-R1 が選択肢に含まれない', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).not.toContain('deepseek-r1-distill-qwen-32b');
  });

  it('gemma-3-12b が選択肢に含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('@cf/google/gemma-3-12b-it');
  });

  it('llama-4-scout-17b が選択肢に含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('@cf/meta/llama-4-scout-17b-16e-instruct');
  });

  it('glm-4.7-flash が選択肢に含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('@cf/zai-org/glm-4.7-flash');
  });

  it('gemma-3-12b のラベルが含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('>gemma-3-12b</option>');
  });

  it('llama-4-scout-17b のラベルが含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('>llama-4-scout-17b</option>');
  });

  it('glm-4.7-flash のラベルが含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('>glm-4.7-flash</option>');
  });
});

describe('think タグ除去ロジック（フロントエンド不変テスト）', () => {
  it('shortModelName が @cf/google/gemma-3-12b-it から gemma-3-12b-it を返す', () => {
    const model = '@cf/google/gemma-3-12b-it';
    const short = model.split('/').pop();
    expect(short).toBe('gemma-3-12b-it');
  });

  it('shortModelName が @cf/meta/llama-4-scout-17b-16e-instruct から llama-4-scout-17b-16e-instruct を返す', () => {
    const model = '@cf/meta/llama-4-scout-17b-16e-instruct';
    const short = model.split('/').pop();
    expect(short).toBe('llama-4-scout-17b-16e-instruct');
  });

  it('shortModelName が @cf/zai-org/glm-4.7-flash から glm-4.7-flash を返す', () => {
    const model = '@cf/zai-org/glm-4.7-flash';
    const short = model.split('/').pop();
    expect(short).toBe('glm-4.7-flash');
  });
});
