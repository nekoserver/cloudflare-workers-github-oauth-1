import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getThreadTrackerPage } from './threadTracker';

describe('getThreadTrackerPage', () => {
  const html = getThreadTrackerPage('octocat');

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

  function extractModelRank(): (model: string) => number {
    const source = html.match(/function modelRank\(model\)\{([^}]*)\}/);
    expect(source).not.toBeNull();
    return new Function('model', source![1]) as (model: string) => number;
  }

  it('モデル色丸の表示順はQWEN→GEMMA4→Llama→その他(先に登場した順)になる', () => {
    const modelRank = extractModelRank();
    expect(typeof modelRank).toBe('function');
    const models = [
      '@cf/ibm-granite/granite-4.0-h-micro',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/google/gemma-4-26b-a4b-it',
      '@cf/qwen/qwen3.8-27b',
    ];
    const sorted = [...models].sort((a, b) => modelRank(a) - modelRank(b));
    expect(sorted).toEqual([
      '@cf/qwen/qwen3.8-27b',
      '@cf/google/gemma-4-26b-a4b-it',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/ibm-granite/granite-4.0-h-micro',
    ]);
  });

  it('該当モデルが一部しかなくても相対順序(QWEN→GEMMA4→Llama)は保たれる', () => {
    const modelRank = extractModelRank();
    const sorted = ['@cf/meta/llama-3.1-8b-instruct-fp8', '@cf/qwen/qwen3.8-27b'].sort((a, b) => modelRank(a) - modelRank(b));
    expect(sorted).toEqual(['@cf/qwen/qwen3.8-27b', '@cf/meta/llama-3.1-8b-instruct-fp8']);
  });

  it('「スレッド一覧と選択した質問・回答を並べて表示します」の説明文は削除されている', () => {
    expect(html).not.toContain('スレッド一覧と選択した質問・回答を並べて表示します');
  });

  it('「▦ 3列スタイル」ボタン(threeColumnStyleButton)は撤去されている', () => {
    expect(html).not.toContain('id="threeColumnStyleButton"');
    expect(html).not.toContain('▦ 3列スタイル');
  });

  it('3列スタイルモーダルは左の垂直タブ(threeColumnStyleTab)から開く', () => {
    expect(html).toContain('id="threeColumnStyleTab"');
    expect(html).toContain("styleTab.addEventListener('click'");
  });

  it('ナイトモードボタンは3列スタイルモーダルの中にある', () => {
    const modalMatch = html.match(/<div id="threeColumnStyleModal"[\s\S]*?<\/div>\s*<button id="composerTab"/);
    expect(modalMatch).not.toBeNull();
    expect(modalMatch![0]).toContain('id="nightModeToggle"');
    expect(modalMatch![0]).toContain('id="viewToggle"');
  });

  it('CSS選択ボタンが3列スタイルモーダルの中に存在し、専用モーダルを開く', () => {
    const modalMatch = html.match(/<div id="threeColumnStyleModal"[\s\S]*?<\/div>\s*<button id="composerTab"/);
    expect(modalMatch![0]).toContain('id="cssThemeButton"');
    expect(modalMatch![0]).toContain('aria-controls="cssThemeModal"');
    expect(html).toContain('id="cssThemeModal"');
  });

  it('CSS選択モーダルは3列スタイルモーダルより高いz-indexで最上位レイヤーに表示される', () => {
    const styleBackdropZ = html.match(/\.style-sheet-backdrop\{[^}]*z-index:(\d+)/);
    const cssBackdropZ = html.match(/\.css-theme-backdrop\{[^}]*z-index:(\d+)/);
    expect(styleBackdropZ).not.toBeNull();
    expect(cssBackdropZ).not.toBeNull();
    expect(Number(cssBackdropZ![1])).toBeGreaterThan(Number(styleBackdropZ![1]));
  });

  it('適用ボタンを押すまではプレビューのみで、押すとCookieに保存される', () => {
    expect(html).toContain('id="cssThemeApply"');
    expect(html).toContain('CSS_THEME_COOKIE');
    expect(html).toContain("cssThemeApply.addEventListener('click'");
    expect(html).toMatch(/cssThemeApply\.addEventListener\('click',function\(\)\{[^}]*document\.cookie=CSS_THEME_COOKIE/);
  });

  it('モーダルを適用せずに閉じるとプレビューは保存前の状態に戻る', () => {
    expect(html).toContain('function setCssThemeOpen(');
    expect(html).toMatch(/applyCssTheme\(savedCssKey\)/);
  });

  it('dynamicnekoのai-panel(StylePicker enhanced)と同レベルの選択肢数(色テーマ+画面全体フィルター)を持つ', () => {
    expect(html).toContain('CSS_THEME_PRESETS');
    const presetCount = (html.match(/\{kind:'(?:style|fx)',id:'[a-z-]+',label:/g) || []).length;
    expect(presetCount).toBeGreaterThanOrEqual(29);
  });

  it('dynamicnekoのStylePicker(enhanced)にある色テーマ・画面全体フィルターのidが一通り揃っている', () => {
    const expectedStyleIds = ['minimal', 'paper', 'sunset', 'ember', 'candy', 'ocean', 'terminal', 'matrix', 'neon', 'hologram', 'dracula', 'glitch', 'aurora', 'lined'];
    const expectedFxIds = ['glass', 'mono', 'rounded', 'tracking', 'crosshair', 'blueprint', 'neon-text', 'selection', 'grayscale', 'invert', 'blur', 'hue-rotate'];
    expectedStyleIds.forEach((id) => expect(html).toContain(`{kind:'style',id:'${id}'`));
    expectedFxIds.forEach((id) => expect(html).toContain(`{kind:'fx',id:'${id}'`));
    // sepia・crtはstyle/fx両方に存在するため、kind付きで両方を確認する
    expect(html).toContain("{kind:'style',id:'crt'");
    expect(html).toContain("{kind:'fx',id:'crt'");
    expect(html).toContain("{kind:'fx',id:'sepia'");
  });

  it('色テーマ(style)選択と画面全体フィルター(fx)選択は排他的に切り替わる(dynamicnekoと同じ挙動)', () => {
    expect(html).toContain("document.documentElement.setAttribute('data-css-fx',id)");
    expect(html).toContain("document.documentElement.removeAttribute('data-css-style')");
    expect(html).toContain("document.documentElement.setAttribute('data-css-style',id)");
    expect(html).toContain("document.documentElement.removeAttribute('data-css-fx')");
  });

  it('選択ボタンはテーマ固有の配色を保ち、選択したテーマだけを適用・保存する', () => {
    const dom = openSearchPage();
    const { document } = dom.window;
    document.getElementById('cssThemeButton')!.click();
    const paper = document.querySelector<HTMLElement>('[data-css-kind="style"][data-css-id="paper"]')!;
    const terminal = document.querySelector<HTMLElement>('[data-css-kind="style"][data-css-id="terminal"]')!;
    expect(dom.window.getComputedStyle(paper).getPropertyValue('--bg')).toBe('#f7f1e3');
    expect(dom.window.getComputedStyle(terminal).getPropertyValue('--bg')).toBe('#000');
    paper.click();
    expect(document.documentElement.getAttribute('data-css-style')).toBe('paper');
    const selected = document.querySelector('[data-css-id="paper"]')!;
    expect(selected.getAttribute('aria-checked')).toBe('true');
    expect(dom.window.getComputedStyle(document.querySelector('[data-css-id="terminal"]')!).getPropertyValue('--bg')).toBe('#000');
    document.getElementById('cssThemeApply')!.click();
    expect(document.cookie).toContain('thread_tracker_css_theme=style%3Apaper');
    dom.window.close();
  });

  it('2ペインモード時、検索窓(searchPanel)は画面左の垂直タブ(searchPanelTab)でトグル開閉できる', () => {
    expect(html).toContain('id="searchPanelTab"');
    expect(html).toContain('aria-controls="searchPanel"');
    expect(html).toContain('id="searchPanel"');
    expect(html).toContain("searchPanelTab.addEventListener('click'");
    expect(html).toMatch(/function setSearchPanelOpen\(open\)\{searchPanelEl\.hidden=!open/);
  });

  it('検索窓タブは2ペインモードの時だけ表示される(通常モードでは固定navbarなので不要)', () => {
    expect(html).toMatch(/\.search-panel-tab\{[^}]*display:none/);
    expect(html).toMatch(/\.two-pane-mode \.search-panel-tab\{display:block\}/);
  });

  it('2ペイン状態が解除されている通常モードでは、検索窓はスクロールの影響を受けない固定navbarになる', () => {
    const baseRuleMatch = html.match(/(?<!\.two-pane-mode )\.search-panel\{[^}]*\}/);
    expect(baseRuleMatch).not.toBeNull();
    expect(baseRuleMatch![0]).toContain('position:fixed');
    expect(baseRuleMatch![0]).toContain('top:0');
  });

  it('2ペインモードでも検索窓は画面に固定される', () => {
    expect(html).toMatch(/\.two-pane-mode \.search-panel\{position:fixed/);
  });

  function openSearchPage(position = '{"x":120,"y":160}') {
    return new JSDOM(html, {
      url: 'https://example.com/thread-tracker',
      runScripts: 'dangerously',
      beforeParse(window) {
        window.document.cookie = 'thread_tracker_two_pane=1; Path=/';
        window.document.cookie = 'thread_tracker_search_position=' + encodeURIComponent(position) + '; Path=/';
        Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }) });
        Object.defineProperty(window, 'fetch', { value: async () => ({ ok: true, json: async () => ({ threads: [], items: [] }) }) });
        Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get: () => 520 });
        Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { get: () => 100 });
        window.HTMLElement.prototype.setPointerCapture = () => {};
        window.HTMLElement.prototype.hasPointerCapture = () => false;
      },
    });
  }

  it('スクロール後の再表示とリロードでCookieの画面座標を復元する', () => {
    const dom = openSearchPage();
    const { document } = dom.window;
    const panel = document.getElementById('searchPanel')!;
    const tab = document.getElementById('searchPanelTab')!;
    expect(panel.style.left).toBe('120px');
    expect(panel.style.top).toBe('160px');
    tab.click();
    Object.defineProperty(dom.window, 'scrollY', { value: 1500 });
    tab.click();
    expect(panel.hidden).toBe(false);
    expect(panel.style.top).toBe('160px');
    expect(document.activeElement?.id).toBe('responseSearch');
    const handle = document.getElementById('searchPanelDragHandle')!;
    const pointer = (type: string, x: number, y: number) => {
      const event = new dom.window.MouseEvent(type, { clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      handle.dispatchEvent(event);
    };
    pointer('pointerdown', 130, 170);
    pointer('pointermove', 230, 220);
    pointer('pointerup', 230, 220);
    expect(panel.style.left).toBe('220px');
    expect(panel.style.top).toBe('210px');
    const cookie = document.cookie.split('; ').find(value => value.startsWith('thread_tracker_search_position='))!;
    const restored = openSearchPage(decodeURIComponent(cookie.split('=')[1]));
    expect(restored.window.document.getElementById('searchPanel')!.style.top).toBe('210px');
    dom.window.close();
    restored.window.close();
  });

  it('不正なCookieは初期位置に戻し、画面外の位置はリサイズ時も補正する', () => {
    const invalid = openSearchPage('{"x":"wrong","y":null}');
    expect(invalid.window.document.getElementById('searchPanel')!.style.left).toBe('48px');
    invalid.window.close();
    const dom = openSearchPage('{"x":9999,"y":-100}');
    const panel = dom.window.document.getElementById('searchPanel')!;
    expect(panel.style.left).toBe('496px');
    expect(panel.style.top).toBe('8px');
    Object.defineProperty(dom.window, 'innerWidth', { value: 600 });
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    expect(panel.style.left).toBe('72px');
    dom.window.document.getElementById('viewToggle')!.click();
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('');
    dom.window.close();
  });

  it('ビューモードが切り替わるたびに検索窓は表示状態にリセットされる(閉じたまま固定navbarに取り残されない)', () => {
    expect(html).toMatch(/function applyViewMode\(\)\{[^}]*setSearchPanelOpen\(true\)/);
  });

  // 対象: 「Clefでの評価を追加」ボタン(clefScoreHtml・bindClefScoreButtons)。
  // PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.mdの
  // ステップ④。既存のjevScoreHtml(自動探索・📔ボタン由来のJevスコア表示)
  // とは完全に独立した経路(/api/aichat/clef-score)。
  describe('「Clefでの評価を追加」ボタン', () => {
    it('turn.idがある場合のみ、結果表示用のdiv(data-clef-score-result)とボタン(data-clef-score-btn)を出す', () => {
      expect(html).toContain('function clefScoreHtml(turn){if(!turn.id)return');
      expect(html).toContain('data-clef-score-result="');
      expect(html).toContain('data-clef-score-btn');
      expect(html).toContain('data-share-id="');
      expect(html).toContain('data-model="');
    });

    it('turn.questionClefScores(キャッシュ)が既にある場合は、ボタンを出さずスコアを直接表示する(再評価ボタンが復活しない)', () => {
      const idx = html.indexOf('function clefScoreHtml(turn)');
      expect(idx).toBeGreaterThan(-1);
      const fnEnd = html.indexOf('\n', idx) >= 0 ? html.indexOf('function turnHtml(turn', idx) : -1;
      const fnBody = html.slice(idx, fnEnd > idx ? fnEnd : idx + 700);
      expect(fnBody).toContain('turn.questionClefScores||[]');
      expect(fnBody).toMatch(/if\s*\(\s*scores\.length\s*\)/);
      // data-clef-score-btnはキャッシュ無し(else)の分岐1箇所にしか出てこない
      // (キャッシュ済みの場合にボタンを再描画してしまう不具合の再発防止)。
      const btnOccurrences = fnBody.split('data-clef-score-btn').length - 1;
      expect(btnOccurrences).toBe(1);
    });

    it('キャッシュ済みのClefスコアもscoreColorClassで色分けする(Jevと同じルール)', () => {
      const idx = html.indexOf('function clefScoreHtml(turn)');
      const snippet = html.slice(idx, idx + 400);
      expect(snippet).toContain('scoreColorClass(score.value)');
    });

    it('turnHtmlはjevScoreHtml(turn)の直後にclefScoreHtml(turn)を差し込む(既存のJevスコア表示の並びを壊さない)', () => {
      expect(html).toContain('jevScoreHtml(turn)+clefScoreHtml(turn)+context');
    });

    it('bindActionsはbindTurnDeckの直後にbindClefScoreButtonsを呼ぶ', () => {
      expect(html).toContain('bindTurnDeck(root);bindClefScoreButtons(root);');
    });

    it('ボタン押下はPOST /api/aichat/clef-scoreへshareId・modelを送る(/api/aichat/jev-scoreとは別経路)', () => {
      const idx = html.indexOf('function bindClefScoreButtons(root)');
      expect(idx).toBeGreaterThan(-1);
      const snippet = html.slice(idx, idx + 1200);
      expect(snippet).toContain("fetch('/api/aichat/clef-score'");
      expect(snippet).toContain('JSON.stringify({shareId:shareId,model:model})');
      expect(snippet).not.toContain('/api/aichat/jev-score');
    });

    it('verified!==trueの場合はボタンを再有効化し、resultコンテナにエラーを表示する(黙って成功扱いにしない)', () => {
      const idx = html.indexOf('function bindClefScoreButtons(root)');
      const snippet = html.slice(idx, idx + 1200);
      expect(snippet).toContain('result.data.verified!==true');
      expect(snippet).toContain('btn.disabled=false;btn.textContent=originalText;');
      expect(snippet).toContain("container.textContent='Clef評価に失敗しました: '");
    });

    it('成功時は結果の数値をresultコンテナへ表示し、ボタン自体は取り除く(二重押下を防ぐ)', () => {
      const idx = html.indexOf('function bindClefScoreButtons(root)');
      const snippet = html.slice(idx, idx + 1200);
      expect(snippet).toContain('var className=scoreColorClass(v.value);');
      expect(snippet).toContain('btn.remove();');
    });

    it('成功時(DBへの書き込み完了=verified:true)にshowClefSaveToast()を呼ぶ(失敗時は呼ばない)', () => {
      const idx = html.indexOf('function bindClefScoreButtons(root)');
      const snippet = html.slice(idx, idx + 1200);
      const verifiedCheckIdx = snippet.indexOf('result.data.verified!==true');
      const toastCallIdx = snippet.indexOf('showClefSaveToast();');
      expect(toastCallIdx).toBeGreaterThan(-1);
      expect(toastCallIdx).toBeGreaterThan(verifiedCheckIdx);
      expect(toastCallIdx).toBeLessThan(snippet.indexOf('btn.remove();'));
    });

    it('showClefSaveToast()は「Clefスコア登録完了」のトーストを画面中央に表示し、一定時間後に消える', () => {
      const idx = html.indexOf('function showClefSaveToast()');
      expect(idx).toBeGreaterThan(-1);
      const snippet = html.slice(idx, idx + 400);
      expect(snippet).toContain("toast.textContent='Clefスコア登録完了';");
      expect(snippet).toContain("toast.className='clef-save-toast';");
      expect(snippet).toContain('setTimeout(');
      expect(html).toMatch(/\.clef-save-toast\{[^}]*position:fixed/);
      expect(html).toMatch(/\.clef-save-toast\{[^}]*top:50%/);
      expect(html).toMatch(/\.clef-save-toast\{[^}]*left:50%/);
      expect(html).toMatch(/\.clef-save-toast\{[^}]*background:#c6f6d5/);
    });

    it('ClefのスコアもscoreColorClass(Jevと同じ0.8/0.5の閾値)で色分けする(ユーザー指示、2026-10-12)', () => {
      const idx = html.indexOf('function scoreColorClass(value)');
      expect(idx).toBeGreaterThan(-1);
      const snippet = html.slice(idx, idx + 200);
      expect(snippet).toContain("v>=0.8?'jev-score-high':(v>=0.5?'jev-score-medium':'')");
      // jevScoreHtml・bindClefScoreButtonsの両方がこの共通関数を使う(重複実装しない)。
      const jevIdx = html.indexOf('function jevScoreHtml(turn)');
      expect(html.slice(jevIdx, jevIdx + 300)).toContain('scoreColorClass(score.value)');
      const clefBtnIdx = html.indexOf('function bindClefScoreButtons(root)');
      expect(html.slice(clefBtnIdx, clefBtnIdx + 1200)).toContain('scoreColorClass(v.value)');
    });
  });

  // 対象: 3列スタイルタブ内の「Jev」「Clef」チェックボックス
  // (showJevScoreToggle/showClefScoreToggle)。ユーザー指示(2026-10-12)で、
  // それぞれON/OFFをCookieへ保存し、変更するたびに即時反映する。
  describe('3列スタイルタブの「Jev」「Clef」チェックボックスでスコア表示を切り替える', () => {
    it('showJevScoreToggle・showClefScoreToggleをstyle-sheet-actions内に描画する', () => {
      expect(html).toContain('id="showJevScoreToggle"');
      expect(html).toContain('id="showClefScoreToggle"');
    });

    function openTrackerPage() {
      return new JSDOM(html, {
        url: 'https://example.com/thread-tracker',
        runScripts: 'dangerously',
        beforeParse(window) {
          Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }) });
          Object.defineProperty(window, 'fetch', { value: async () => ({ ok: true, json: async () => ({ threads: [], items: [] }) }) });
        },
      });
    }

    it('デフォルトは両方チェック済みで、hide-jev-score/hide-clef-scoreクラスは付かない(既存の表示を変えない)', () => {
      const dom = openTrackerPage();
      const { document } = dom.window;
      expect((document.getElementById('showJevScoreToggle') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('showClefScoreToggle') as HTMLInputElement).checked).toBe(true);
      expect(document.documentElement.classList.contains('hide-jev-score')).toBe(false);
      expect(document.documentElement.classList.contains('hide-clef-score')).toBe(false);
      dom.window.close();
    });

    it('Jevのチェックを外すとhide-jev-scoreクラスが付き、Cookie(thread_tracker_show_jev_score=off)に保存される', () => {
      const dom = openTrackerPage();
      const { document } = dom.window;
      const toggle = document.getElementById('showJevScoreToggle') as HTMLInputElement;
      toggle.checked = false;
      toggle.dispatchEvent(new dom.window.Event('change'));
      expect(document.documentElement.classList.contains('hide-jev-score')).toBe(true);
      expect(document.cookie).toContain('thread_tracker_show_jev_score=off');
      dom.window.close();
    });

    it('Clefのチェックを外すとhide-clef-scoreクラスが付き、Cookie(thread_tracker_show_clef_score=off)に保存される', () => {
      const dom = openTrackerPage();
      const { document } = dom.window;
      const toggle = document.getElementById('showClefScoreToggle') as HTMLInputElement;
      toggle.checked = false;
      toggle.dispatchEvent(new dom.window.Event('change'));
      expect(document.documentElement.classList.contains('hide-clef-score')).toBe(true);
      expect(document.cookie).toContain('thread_tracker_show_clef_score=off');
      dom.window.close();
    });

    it('次回表示時はCookieの値(off)を読み込み、チェックを外した状態・非表示クラス付きで復元する', () => {
      const dom = new JSDOM(html, {
        url: 'https://example.com/thread-tracker',
        runScripts: 'dangerously',
        beforeParse(window) {
          window.document.cookie = 'thread_tracker_show_jev_score=off; Path=/';
          window.document.cookie = 'thread_tracker_show_clef_score=off; Path=/';
          Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }) });
          Object.defineProperty(window, 'fetch', { value: async () => ({ ok: true, json: async () => ({ threads: [], items: [] }) }) });
        },
      });
      const { document } = dom.window;
      expect((document.getElementById('showJevScoreToggle') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('showClefScoreToggle') as HTMLInputElement).checked).toBe(false);
      expect(document.documentElement.classList.contains('hide-jev-score')).toBe(true);
      expect(document.documentElement.classList.contains('hide-clef-score')).toBe(true);
      dom.window.close();
    });

    it('.hide-jev-score .jev-score・.hide-clef-score .clef-score/.clef-score-add-btnをdisplay:noneにするCSSを持つ', () => {
      expect(html).toContain('.hide-jev-score .jev-score{display:none}');
      expect(html).toContain('.hide-clef-score .clef-score,.hide-clef-score .clef-score-add-btn{display:none}');
    });
  });
});
