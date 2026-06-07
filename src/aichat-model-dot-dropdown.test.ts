import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: {
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
    '@cf/meta/llama-3.1-8b-instruct-fp8': '#10b981',
  },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('色ポッチドロップダウン: HTML 構造', () => {
  it('modelDotDropdown 要素が存在する', () => {
    expect(buildPage()).toContain('id="modelDotDropdown"');
  });

  it('modelDotDropdown が model-dot-dropdown クラスを持つ', () => {
    expect(buildPage()).toContain('class="model-dot-dropdown"');
  });

  it('modelColorDot に title 属性がある', () => {
    expect(buildPage()).toContain('title="モデル切り替え"');
  });
});

describe('色ポッチドロップダウン: CSS', () => {
  it('.model-color-dot に cursor:pointer が設定されている', () => {
    const html = buildPage();
    const idx = html.indexOf('.model-color-dot');
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('cursor: pointer');
  });

  it('.model-dot-dropdown のスタイルが含まれる', () => {
    expect(buildPage()).toContain('.model-dot-dropdown');
  });

  it('.model-dot-dropdown.open のスタイルが含まれる', () => {
    expect(buildPage()).toContain('.model-dot-dropdown.open');
  });

  it('.model-dot-dropdown-item のスタイルが含まれる', () => {
    expect(buildPage()).toContain('.model-dot-dropdown-item');
  });

  it('.model-dot-dropdown-dot のスタイルが含まれる', () => {
    expect(buildPage()).toContain('.model-dot-dropdown-dot');
  });
});

describe('色ポッチドロップダウン: JS ロジック', () => {
  it('MODEL_LIST 変数が埋め込まれている', () => {
    expect(buildPage()).toContain('var MODEL_LIST =');
  });

  it('MODEL_LIST にモデルの value が含まれている', () => {
    expect(buildPage()).toContain('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  });

  it('buildModelDotDropdown 関数が存在する', () => {
    expect(buildPage()).toContain('function buildModelDotDropdown()');
  });

  it('openModelDotDropdown 関数が存在する', () => {
    expect(buildPage()).toContain('function openModelDotDropdown()');
  });

  it('closeModelDotDropdown 関数が存在する', () => {
    expect(buildPage()).toContain('function closeModelDotDropdown()');
  });

  it('modelColorDot に click イベントリスナーが追加されている', () => {
    const html = buildPage();
    expect(html).toContain("modelColorDot.addEventListener('click'");
  });

  it('document に click リスナーで closeModelDotDropdown が呼ばれる', () => {
    const html = buildPage();
    expect(html).toContain('closeModelDotDropdown()');
    expect(html).toContain("document.addEventListener('click'");
  });

  it('openModelDotDropdown で getNextZ() を使って z-index を設定している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openModelDotDropdown()');
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('getNextZ()');
  });

  it('モデル選択時に lastModel と modelSelect.value が更新される', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildModelDotDropdown()');
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain('lastModel = m.value');
    expect(snippet).toContain('modelSelect.value = m.value');
    expect(snippet).toContain('applyModelColor(lastModel)');
  });
});

describe('色ポッチドロップダウン: getNextZ staticZDefaults', () => {
  it('staticZDefaults に modelDotDropdown が登録されている', () => {
    expect(buildPage()).toContain('modelDotDropdown: 700');
  });
});

describe('色ポッチドロップダウン: JS 構文チェック', () => {
  it('script タグ内の JS に構文エラーがない', () => {
    const html = buildPage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const js = m[1];
      expect(() => {
        new Function(`(function(){\n${js}\n})`);
      }).not.toThrow();
    }
  });
});
