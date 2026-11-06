// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

describe('Codexのモデル色丸選択', () => {
  it.each(['codex', 'claude'])('%sをクリックするとモデル値・色丸・選択表示が切り替わり、別モデルにも戻せる', (model) => {
    const html = getAiChatPage({ username: 'test', aiChatModel: 'other', modelColors: { other: '#4f46e5', [model]: '#0ea5e9' } });
    const select = html.match(/<select[^>]*id="modelSelect"[\s\S]*?<\/select>/)![0];
    document.body.innerHTML = select + '<span id="modelColorDot"></span><div id="modelDotDropdown"></div>';
    const colors = JSON.parse(html.match(/var MODEL_COLORS = (.*);/)![1]);
    const list = JSON.parse(html.match(/var MODEL_LIST = (.*);/)![1]);
    const apply = html.slice(html.indexOf('    function applyModelColor('), html.indexOf('    var modelSelect ='));
    const build = html.slice(html.indexOf('    function buildModelDotDropdown()'), html.indexOf('    // モデルごとのパラメータ調整値'));
    const fixedModelDotColors: Record<string, string> = { claude: '#f97316', muse: '#2563eb' };
    const bindings = {
      document, MODEL_COLORS: colors, MODEL_LIST: list, AICHAT_TUNABLE_MODEL_CONFIG: {},
      getModelDotColor: (modelId: string) => fixedModelDotColors[modelId] || colors[modelId] || '',
      modelColorDot: document.getElementById('modelColorDot'), modelSelect: document.getElementById('modelSelect'),
      modelDotDropdown: document.getElementById('modelDotDropdown'), closeModelDotDropdown() {},
    };
    const state = new Function(...Object.keys(bindings), 'var lastModel = "other";\n' + apply + build + '\nbuildModelDotDropdown(); return { model: function() { return lastModel; }, rebuild: buildModelDotDropdown };')(...Object.values(bindings));
    const find = (label: string) => [...document.querySelectorAll<HTMLElement>('.model-dot-dropdown-item')].find(item => item.querySelector('.model-dot-dropdown-item-label')?.textContent === label)!;
    find(model).click();
    expect(state.model()).toBe(model);
    expect((bindings.modelSelect as HTMLSelectElement).value).toBe(model);
    expect(bindings.modelColorDot!.style.background).toBe(model === 'claude' ? 'rgb(249, 115, 22)' : 'rgb(14, 165, 233)');
    state.rebuild();
    expect(find(model).classList.contains('selected')).toBe(true);
    find('other').click();
    expect(state.model()).toBe('other');
    expect(bindings.modelColorDot!.style.background).toBe('rgb(79, 70, 229)');
  });
});
