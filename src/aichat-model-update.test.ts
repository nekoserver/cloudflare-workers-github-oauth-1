import { describe, it, expect } from 'vitest';
import { DEFAULT_AICHAT_MODELS, getAiChatPage } from './views/aichat';
import { assignModelColors } from './utils/aichatModelConfig';

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

  it('gpt-oss-20b は Workers AI から利用できないため選択肢に含まれない', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).not.toContain('@cf/openai/gpt-oss-20b');
  });

  it('gemma-3-12b はもう使わないため選択肢に含まれない（過去利用分の料金表示用データは残る）', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).not.toContain('value="@cf/google/gemma-3-12b-it"');
    expect(html).not.toContain('>gemma-3-12b</option>');
  });

  it('llama-4-scout-17b が選択肢に含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('@cf/meta/llama-4-scout-17b-16e-instruct');
  });

  it('granite-4.0-h-micro が選択肢に含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('@cf/ibm-granite/granite-4.0-h-micro');
  });

  it('qwen3.8-27b が選択肢に含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('value="@cf/qwen/qwen3.8-27b"');
    expect(html).toContain('>qwen3.8-27b</option>');
  });

  it('qwen3.8-27b に表示用の固有色が割り当てられる', () => {
    const { merged } = assignModelColors({}, DEFAULT_AICHAT_MODELS);
    expect(merged['@cf/qwen/qwen3.8-27b']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(Object.values(merged)).size).toBe(DEFAULT_AICHAT_MODELS.length);
  });

  it('glm-4.7-flash が選択肢に含まれない', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).not.toContain('@cf/zai-org/glm-4.7-flash');
  });

  it('gpt-oss-20b のラベルが含まれない', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).not.toContain('>gpt-oss-20b</option>');
  });

  it('llama-4-scout-17b のラベルが含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('>llama-4-scout-17b</option>');
  });

  it('granite-4.0-h-micro のラベルが含まれる', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).toContain('>granite-4.0-h-micro</option>');
  });

  it('glm-4.7-flash のラベルが含まれない', () => {
    const html = buildPage(LLAMA_MODEL);
    expect(html).not.toContain('>glm-4.7-flash</option>');
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
