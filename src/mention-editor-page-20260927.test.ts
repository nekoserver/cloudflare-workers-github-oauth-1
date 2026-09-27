import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getMentionEditorPage } from './views/mentionEditor';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: 新規ページ /mention-editor（src/views/mentionEditor.ts の getMentionEditorPage）。
// dynamicneko の Slash Command Input を設定値で組み立てる編集ページ。
// テキストエリアの縦横サイズ(ch/rows/px)・トリガーキー(/ か @)・候補リストの
// 出現位置(上/下)・タブ名・各タブの候補を編集し、結果をJSONで出力/読込する。
//
// 故障シナリオ:
//   (1) 読み込んだJSONが壊れている・型が違う → 握りつぶさず errorCode 付きで失敗を返す
//   (2) サイズが0・負数・NaN・極端に大きい → 範囲外として拒否する
//   (3) タブ0件・タブ名空・候補0件・候補にタブや改行を含む → 拒否する
//   (4) トリガーが / @ 以外 → 拒否する
//   (5) template literal 内のエスケープで <script> が構文エラーになる
//   (6) username を画面に表示しない。タブ名のプレビューは textContent のみ
//   (7) 候補選択時の動作(default/typewriter)は Cookie で永続化する。Cookie未設定・
//       壊れた値(過去仕様の値含む)は既定の default として扱う(握りつぶさず正規化する)
//   (8) typewriter モードで候補を選ぶと、入力欄には反映せず、選んだ値を
//       Typewriter Text 相当の別領域へ1回だけ表示する(繰り返し再生はしない)

function loadFn<T>(name: string): T {
  const html = getMentionEditorPage('tester');
  const src = extractFunctionSource(html, name);
  expect(src, name + ' が生成HTMLから見つからない').toBeTruthy();
  return new Function(`${src}\nreturn ${name};`)() as T;
}

type NormalizeResult =
  | { ok: true; value: any }
  | { ok: false; errorCode: string; detail: string };

const valid = () => ({
  version: 1,
  trigger: '/',
  position: 'top',
  textarea: { width: { value: 40, unit: 'ch' }, height: { value: 15, unit: 'rows' } },
  tabs: [
    { label: 'テキスト', items: ['bold', 'italic'] },
    { label: 'AI', items: ['summarize'] },
  ],
});

describe('getMentionEditorPage: HTML構造', () => {
  const html = getMentionEditorPage('tester');

  it('編集項目(サイズ・単位・トリガー・位置・タブ編集)とJSON出力欄がある', () => {
    for (const id of ['widthValue', 'widthUnit', 'heightValue', 'heightUnit', 'triggerKey', 'position', 'tabsEditor', 'addTab', 'jsonOut', 'btnCopy', 'btnDownload', 'btnImport', 'btnRunRuby', 'btnParseRuby', 'btnClearRuby', 'btnSave', 'rubyParseStatus', 'savedDocuments', 'btnLoadSaved', 'saveModal', 'saveTitle', 'saveActions', 'btnCancelSave', 'btnConfirmSave', 'previewInput', 'previewSlashButton', 'previewArea', 'copyModeToggle', 'typewriterOutput', 'typewriterText']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain('<option value="/">');
    expect(html).toContain('<option value="@">');
    expect(html).toContain('<option value="top">');
    expect(html).toContain('<option value="bottom">');
    expect(html).toContain('<option value="ch">');
    expect(html).toContain('<option value="rows">');
  });

  it('usernameやユーザー表記を画面に表示しない', () => {
    const x = getMentionEditorPage('<script>alert(1)</script>');
    expect(x).not.toContain('<script>alert(1)</script>');
    expect(x).not.toContain('&lt;script&gt;');
    expect(x).not.toContain('ユーザー:');
  });

  it('タブと候補のセクションをドラッグして並べ替えられる', () => {
    expect(html).toContain("handle.addEventListener('pointerdown'");
    expect(html).toContain('setTimeout(activateTabDrag, 450)');
    expect(html).toContain("draggedTab.classList.add('dragging')");
    expect(html).toContain("tabsEditor.insertBefore(draggedTab");
    expect(html).toMatch(/\.tab-edit\.dragging\s*\{\s*border: 2px dashed var\(--danger\)/);
  });

  it('実行結果の表示先を本文エリアの直後に用意し、モード切替だけをプレビュー見出しの右端に置く', () => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const result = document.getElementById('nekoResult')!;
    const inputRow = document.getElementById('previewAnchor')!;
    const heading = document.querySelector('.panel-heading')!;
    const toggle = document.getElementById('copyModeToggle')!;
    const visibleDocument = document.cloneNode(true) as Document;
    visibleDocument.querySelectorAll('script, style').forEach((element) => element.remove());
    const visibleText = visibleDocument.body.textContent;

    expect(result.nextElementSibling).toBe(inputRow);
    expect(heading.firstElementChild?.textContent).toBe('プレビュー');
    expect(heading.lastElementChild).toBe(toggle);
    expect(visibleText).not.toContain('候補選択時の動作');
    expect(visibleText).not.toContain('入力欄へそのままコピー');
    expect(visibleText).not.toContain('表示後、タップして入力欄へコピー');
  });

  it('script内のJSに構文エラーがなく、API応答はMarkdown、Ruby出力は空白を変形しないテキストとして描画する', () => {
    const m = /<script>([\s\S]*?)<\/script>/.exec(html);
    expect(m).toBeTruthy();
    expect(() => new Function(m![1])).not.toThrow();
    expect(m![1].match(/innerHTML/g)).toHaveLength(1);
    expect(m![1]).toContain('resultArea.innerHTML = parseMd(markdown)');
    expect(m![1]).toContain("resultArea.className = 'preview-area ruby-output'");
    expect(m![1]).toContain('resultArea.textContent = result.output');
    expect(html).toMatch(/#nekoResult\.ruby-output\s*\{[^}]*white-space: pre;/s);
    expect(html).toMatch(/#nekoResult\.ruby-output\s*\{[^}]*font-family: ui-monospace/s);
  });

  it('本文をファイル名付きで保存し /neko ruby からRuby/WASM実行できる配線を持つ', () => {
    expect(html).toContain('placeholder="ここにコードを入力し、hello.rb のような名前で保存します"');
    expect(html).toContain("var rubyPrefix = '/neko ruby '");
    expect(html).toContain('executeSavedRuby(command.slice(rubyPrefix.length).trim())');
    expect(html).toContain('documentData.config.content');
    expect(html).toContain('loadRubyWasmVm(');
  });

  it('Ruby本文の入力後だけパースでき、構文成功後に保存モーダルと重複確認済みの決定操作を出す', () => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    expect((document.getElementById('btnParseRuby') as HTMLButtonElement).hidden).toBe(true);
    expect((document.getElementById('btnSave') as HTMLButtonElement).hidden).toBe(true);
    expect((document.getElementById('btnRunRuby') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('saveModal') as HTMLDivElement).hidden).toBe(true);
    expect((document.getElementById('saveActions') as HTMLDivElement).hidden).toBe(true);
    expect(document.getElementById('btnParseRuby')?.textContent).toBe('パース');
    expect(document.getElementById('btnRunRuby')?.textContent).toBe('🔲');
    expect(document.getElementById('btnSave')?.textContent).toBe('保存');
    expect(document.getElementById('btnCancelSave')?.textContent).toBe('キャンセル');
    expect(document.getElementById('btnConfirmSave')?.textContent).toBe('決定');
    expect(html).toContain("RubyVM::InstructionSequence.compile(");
    expect(html).toContain('parsedRubySource = previewArea.value');
    expect(html).toContain("$('btnSave').hidden = !hasCode || parsedRubySource !== previewArea.value");
    expect(html).toContain('openSaveModal();');
    expect(html).toContain('loadSavedDocuments().then(function(loaded)');
    expect(html).toContain('既存のファイル名を確認できませんでした');
    expect(html).toContain("$('saveActions').hidden = Boolean(error)");
  });

  it('実行ボタンをパースボタンの左に置き、構文成功後だけ再生表示にして現在のコードを実行する', () => {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const runButton = document.getElementById('btnRunRuby') as HTMLButtonElement;
    const parseButton = document.getElementById('btnParseRuby') as HTMLButtonElement;

    expect(runButton.nextElementSibling).toBe(parseButton);
    expect(runButton.getAttribute('aria-label')).toBe('Rubyコードを実行');
    expect(html).toContain("$('btnRunRuby').textContent = parsedRubySource === previewArea.value ? '▶︎' : '🔲'");
    expect(html).toContain("$('btnRunRuby').disabled = parsedRubySource !== previewArea.value");
    expect(html).toContain('var result = runRubyCode(previewArea.value)');
    expect(html).toContain('displayRubyResult(resultArea, result)');
  });

  it('パース後はパースボタンの右にクリアボタンを表示し、本文を未入力に戻す', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/mention-editor' });
    const document = dom.window.document;
    const area = document.getElementById('previewArea') as HTMLTextAreaElement;
    const commandInput = document.getElementById('previewInput') as HTMLInputElement;
    const parseButton = document.getElementById('btnParseRuby') as HTMLButtonElement;
    const clearButton = document.getElementById('btnClearRuby') as HTMLButtonElement;

    expect(parseButton.nextElementSibling).toBe(clearButton);
    expect(clearButton.textContent).toBe('クリア');
    expect(clearButton.hidden).toBe(true);

    area.value = 'puts "hello"';
    commandInput.value = '/neko ruby hello.rb';
    area.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    parseButton.click();
    expect(clearButton.hidden).toBe(false);

    clearButton.click();
    expect(area.value).toBe('');
    expect(commandInput.value).toBe('/neko ruby hello.rb');
    expect(JSON.parse((document.getElementById('jsonOut') as HTMLTextAreaElement).value).content).toBe('');
    expect(clearButton.hidden).toBe(true);
    expect(parseButton.hidden).toBe(true);
    expect(document.activeElement).toBe(area);
  });
});

describe('プレビュー入力のスラッシュボタン', () => {
  function loadPage() {
    return new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = (() => Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) })) as any;
      },
    });
  }

  it('入力窓が空の間は非表示で、入力されると左側に表示する', () => {
    const dom = loadPage();
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const button = dom.window.document.getElementById('previewSlashButton') as HTMLButtonElement;

    expect(button.hidden).toBe(true);
    input.value = 'command';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(button.hidden).toBe(false);
    expect(button.nextElementSibling).toBe(input);
  });

  it('ボタンを押すと入力窓をスラッシュだけに置き換える', () => {
    const dom = loadPage();
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const button = dom.window.document.getElementById('previewSlashButton') as HTMLButtonElement;
    input.value = 'before';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    button.click();

    expect(input.value).toBe('/');
    expect(dom.window.document.activeElement).toBe(input);
    expect(button.hidden).toBe(false);
  });

  it('/nekoをEnterで確定するとAIチャットAPIで解釈し、結果をMarkdown表示する', async () => {
    const calls: Array<[unknown, RequestInit | undefined]> = [];
    const dom = new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = ((url: unknown, init?: RequestInit) => {
          calls.push([url, init]);
          if (url === '/api/aichat') {
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ response: '## rubyver\n\n- Ruby/WASMバージョン取得成功', usedModel: 'local/neko' })) });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) });
        }) as any;
      },
    });
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const result = dom.window.document.getElementById('nekoResult') as HTMLDivElement;
    input.value = '/neko rubyver';
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    const apiCall = calls.find(([url]) => url === '/api/aichat');
    expect(apiCall).toBeTruthy();
    expect(JSON.parse(String(apiCall![1]?.body))).toEqual({ message: '/neko rubyver', source: 'textbox' });
    expect(apiCall![1]?.headers).toEqual({ 'Content-Type': 'application/json', 'Accept': 'application/json' });
    expect(result.hidden).toBe(false);
    expect(result.querySelector('h2')?.textContent).toBe('rubyver');
    expect(result.querySelector('li')?.textContent).toBe('Ruby/WASMバージョン取得成功');
    expect(result.textContent).not.toContain('<h2>');
    expect(result.parentElement?.id).toBe('previewBody');
    expect(result.parentElement?.classList.contains('result-visible')).toBe(true);
  });

  it('出現位置が下の場合は実行結果を本文エリアとは別に表示する', async () => {
    const dom = new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = ((url: unknown) => url === '/api/aichat'
          ? Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ response: 'result' })) })
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) })) as any;
      },
    });
    const position = dom.window.document.getElementById('position') as unknown as HTMLSelectElement;
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const result = dom.window.document.getElementById('nekoResult') as HTMLDivElement;
    position.value = 'bottom';
    position.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    input.value = '/neko rubyver';
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(result.parentElement?.id).not.toBe('previewBody');
    expect(dom.window.document.getElementById('previewArea')?.getAttribute('style')).toContain('width');
  });

  it('APIがJSON以外を返した場合はHTTPステータス付きで原因を表示する', async () => {
    const dom = new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = ((url: unknown) => url === '/api/aichat'
          ? Promise.resolve({ ok: false, status: 502, text: () => Promise.resolve('Bad gateway') })
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) })) as any;
      },
    });
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const result = dom.window.document.getElementById('nekoResult') as HTMLDivElement;
    input.value = '/neko rubyver';
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(result.classList.contains('error')).toBe(true);
    expect(result.textContent).toContain('HTTP 502');
    expect(result.textContent).not.toBe('実行に失敗しました: Load failed');
  });

  it('/neko以外の入力はEnterを押してもAIチャットAPIへ送信しない', async () => {
    const calls: unknown[] = [];
    const dom = new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = ((url: unknown) => {
          calls.push(url);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) });
        }) as any;
      },
    });
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    input.value = '/bold';
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    // 初期化時の保存済み設定取得だけで、AIチャットへの送信は行わない。
    expect(calls).toEqual(['/api/mention-editor/documents']);
  });
});

describe('タブのポインタードラッグ', () => {
  function fire(window: any, target: Element, type: string, init: Record<string, number>) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(init)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
  }

  function loadPage() {
    const dom = new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = (() => Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) })) as any;
      },
    });
    const boxes = Array.from(dom.window.document.querySelectorAll('.tab-edit')) as HTMLElement[];
    boxes.forEach((box, index) => {
      box.setPointerCapture = () => undefined;
      box.getBoundingClientRect = () => ({ x: 0, y: index * 100, top: index * 100, bottom: index * 100 + 80, left: 0, right: 400, width: 400, height: 80, toJSON() {} });
    });
    return { dom, boxes };
  }

  it('ハンドルを押して別セクションへ動かすと赤枠を表示して並べ替える', () => {
    const { dom, boxes } = loadPage();
    const handle = boxes[0].querySelector('.drag-handle')!;
    fire(dom.window, handle, 'pointerdown', { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    expect(boxes[0].classList.contains('dragging')).toBe(true);
    fire(dom.window, boxes[1], 'pointermove', { pointerId: 1, clientX: 10, clientY: 170 });
    expect(boxes[1].classList.contains('drop-after')).toBe(true);
    fire(dom.window, boxes[1], 'pointerup', { pointerId: 1, clientX: 10, clientY: 170 });
    expect((dom.window.document.querySelectorAll('.tab-label')[1] as HTMLInputElement).value).toBe('テキスト');
  });

  it('セクション内を長押しすると赤いドラッグ枠を表示する', async () => {
    const { dom, boxes } = loadPage();
    const items = boxes[0].querySelector('.tab-items')!;
    fire(dom.window, items, 'pointerdown', { pointerId: 2, button: 0, clientX: 300, clientY: 70 });
    await new Promise((resolve) => dom.window.setTimeout(resolve, 470));
    expect(boxes[0].classList.contains('dragging')).toBe(true);
    fire(dom.window, boxes[0], 'pointercancel', { pointerId: 2, clientX: 300, clientY: 70 });
  });

  it('長押しドラッグ中は入力欄からフォーカスを外し、赤枠をポインターに追従させる', async () => {
    const { dom, boxes } = loadPage();
    const items = boxes[0].querySelector('.tab-items') as HTMLTextAreaElement;
    items.focus();
    fire(dom.window, items, 'pointerdown', { pointerId: 3, button: 0, clientX: 30, clientY: 40 });
    await new Promise((resolve) => dom.window.setTimeout(resolve, 470));

    expect(dom.window.document.activeElement).not.toBe(items);
    fire(dom.window, boxes[0], 'pointermove', { pointerId: 3, clientX: 85, clientY: 125 });
    expect(boxes[0].classList.contains('dragging')).toBe(true);
    expect(boxes[0].style.transform).toBe('translate(55px, 85px)');

    fire(dom.window, boxes[0], 'pointerup', { pointerId: 3, clientX: 85, clientY: 125 });
    expect(boxes[0].style.transform).toBe('');
  });
});

describe('validateSaveTitle', () => {
  const validateSaveTitle = loadFn<(title: string, documents: Array<{ title: string }>) => string>('validateSaveTitle');

  it('空文字と100文字超を拒否する', () => {
    expect(validateSaveTitle('  ', [])).toContain('1〜100');
    expect(validateSaveTitle('a'.repeat(101), [])).toContain('1〜100');
  });

  it('既存タイトルを大文字小文字を区別せず順に比較して拒否する', () => {
    expect(validateSaveTitle('sample', [{ title: 'first' }, { title: 'Sample' }])).toContain('既に登録');
    expect(validateSaveTitle('new title', [{ title: 'Sample' }])).toBe('');
  });
});

describe('normalizeConfig', () => {
  const normalizeConfig = loadFn<(raw: unknown) => NormalizeResult>('normalizeConfig');

  it('正しい設定を受け入れ、そのまま返す', () => {
    const r = normalizeConfig(valid());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(valid());
  });

  it('@ トリガー・下出し・px指定も受け入れる', () => {
    const c: any = valid();
    c.trigger = '@';
    c.position = 'bottom';
    c.textarea = { width: { value: 480, unit: 'px' }, height: { value: 300, unit: 'px' } };
    expect(normalizeConfig(c).ok).toBe(true);
  });

  it('オブジェクト以外は NOT_OBJECT', () => {
    const r = normalizeConfig('x');
    expect(r).toMatchObject({ ok: false, errorCode: 'NOT_OBJECT' });
  });

  it('トリガーが / @ 以外なら BAD_TRIGGER', () => {
    const c: any = valid();
    c.trigger = '#';
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_TRIGGER' });
  });

  it('位置が top/bottom 以外なら BAD_POSITION', () => {
    const c: any = valid();
    c.position = 'left';
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_POSITION' });
  });

  it.each([0, -3, Number.NaN, 5000])('幅 %s ch は BAD_SIZE', (v) => {
    const c: any = valid();
    c.textarea.width.value = v;
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_SIZE' });
  });

  it('高さの単位が不正なら BAD_SIZE', () => {
    const c: any = valid();
    c.textarea.height.unit = 'ch';
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_SIZE' });
  });

  it('タブ0件は BAD_TABS', () => {
    const c: any = valid();
    c.tabs = [];
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_TABS' });
  });

  it('タブ名が空なら BAD_TAB_LABEL', () => {
    const c: any = valid();
    c.tabs[1].label = '  ';
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_TAB_LABEL' });
  });

  it('候補0件は BAD_ITEMS、半角スペース入り候補は受け入れる', () => {
    const c: any = valid();
    c.tabs[0].items = [];
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_ITEMS' });
    const d: any = valid();
    d.tabs[0].items = ['has space'];
    expect(normalizeConfig(d)).toMatchObject({ ok: true });
  });

  it('候補内のタブと改行は BAD_ITEMS', () => {
    for (const item of ['has\ttab', 'has\nnewline']) {
      const c: any = valid();
      c.tabs[0].items = [item];
      expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_ITEMS' });
    }
  });

  it('失敗時は detail に理由が入る(空文字にならない)', () => {
    const r = normalizeConfig(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail.length).toBeGreaterThan(0);
  });
});

describe('itemTextareaRows', () => {
  const itemTextareaRows = loadFn<(value: string) => number>('itemTextareaRows');

  it('4行までは既定の高さを保ち、超えた行数に合わせて入力窓を広げる', () => {
    expect(itemTextareaRows('one')).toBe(4);
    expect(itemTextareaRows(['1', '2', '3', '4'].join('\n'))).toBe(4);
    expect(itemTextareaRows(['1', '2', '3', '4', '5', '6'].join('\n'))).toBe(6);
  });
});

describe('findTriggerQuery', () => {
  const findTriggerQuery = loadFn<(text: string, trigger: string) => string | null>('findTriggerQuery');

  it('末尾トークンがトリガーで始まればクエリを返す', () => {
    expect(findTriggerQuery('/', '/')).toBe('');
    expect(findTriggerQuery('memo /it', '/')).toBe('it');
    expect(findTriggerQuery('a\n@ne', '@')).toBe('ne');
  });

  it('トリガーが違う・語中・確定後(末尾空白)は null', () => {
    expect(findTriggerQuery('@a', '/')).toBeNull();
    expect(findTriggerQuery('a/b', '/')).toBeNull();
    expect(findTriggerQuery('/bold ', '/')).toBeNull();
    expect(findTriggerQuery('', '/')).toBeNull();
  });
});

describe('resolveCopyMode / nextCopyMode', () => {
  const resolveCopyMode = loadFn<(raw: unknown) => 'default' | 'typewriter'>('resolveCopyMode');
  const nextCopyMode = loadFn<(mode: string) => 'default' | 'typewriter'>('nextCopyMode');

  it('typewriter のみ typewriter、それ以外(未設定・壊れた値・過去の値)は default', () => {
    expect(resolveCopyMode('typewriter')).toBe('typewriter');
    for (const raw of [undefined, null, '', 'default', 'Typewriter', 'copy', 123, {}]) {
      expect(resolveCopyMode(raw as any)).toBe('default');
    }
  });

  it('default と typewriter を交互に切り替える', () => {
    expect(nextCopyMode('default')).toBe('typewriter');
    expect(nextCopyMode('typewriter')).toBe('default');
  });
});

describe('typewriterFrames', () => {
  const typewriterFrames = loadFn<(value: string) => string[]>('typewriterFrames');

  it('先頭からの部分文字列を1文字ずつ増やしたコマ割りを返す', () => {
    expect(typewriterFrames('ab')).toEqual(['', 'a', 'ab']);
    expect(typewriterFrames('')).toEqual(['']);
  });
});

describe('候補選択時の動作(default/typewriter)', () => {
  function loadPage(cookie?: string) {
    const dom = new JSDOM(getMentionEditorPage('tester'), {
      runScripts: 'dangerously',
      url: 'https://example.com/mention-editor',
      beforeParse(window) {
        window.fetch = (() => Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) })) as any;
        if (cookie) window.document.cookie = cookie;
      },
    });
    return dom;
  }

  function openSlashAndPick(dom: JSDOM, optionText: string) {
    const window = dom.window as any;
    const input = window.document.getElementById('previewInput') as HTMLInputElement;
    input.value = '/';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    const option = Array.from(window.document.querySelectorAll('[role="option"]')).find(
      (el: any) => el.textContent === optionText
    ) as HTMLButtonElement | undefined;
    expect(option, optionText + ' が候補に見つからない').toBeTruthy();
    option!.click();
  }

  it('既定(Cookie未設定)は入力欄へそのままコピーする(従来どおり)', () => {
    const dom = loadPage();
    openSlashAndPick(dom, '/bold');
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    expect(input.value).toBe('/bold ');
  });

  it('トグルボタンは既定で default を表示し、押すたびに typewriter と切り替わりCookieへ書く', () => {
    const dom = loadPage();
    const toggle = dom.window.document.getElementById('copyModeToggle') as HTMLButtonElement;
    expect(toggle.textContent).toBe('default');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    toggle.click();
    expect(toggle.textContent).toBe('typewriter');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(dom.window.document.cookie).toContain('mentionEditorCopyMode=typewriter');

    toggle.click();
    expect(toggle.textContent).toBe('default');
    expect(dom.window.document.cookie).toContain('mentionEditorCopyMode=default');
  });

  it('Cookieが typewriter のとき、候補選択は入力欄を変えずTypewriter領域へ表示する(1回だけ)', () => {
    const dom = loadPage('mentionEditorCopyMode=typewriter');
    const toggle = dom.window.document.getElementById('copyModeToggle') as HTMLButtonElement;
    expect(toggle.textContent).toBe('typewriter');

    openSlashAndPick(dom, '/bold');
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const box = dom.window.document.getElementById('typewriterOutput') as HTMLElement;
    const textEl = dom.window.document.getElementById('typewriterText') as HTMLElement;

    expect(input.value).toBe('');
    expect(box.hidden).toBe(false);
    expect(textEl.textContent).toBe('');

    return new Promise<void>((resolve) => {
      dom.window.setTimeout(() => {
        expect(textEl.textContent).toBe('/bold ');
        expect(input.value).toBe('');
        resolve();
      }, 60 * '/bold '.length + 30);
    });
  });

  it('Typewriter領域をタップするとコマンド入力欄へコピーし、Typewriter表示を消す', () => {
    const dom = loadPage('mentionEditorCopyMode=typewriter');
    openSlashAndPick(dom, '/bold');
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    const box = dom.window.document.getElementById('typewriterOutput') as HTMLElement;
    const textEl = dom.window.document.getElementById('typewriterText') as HTMLElement;

    box.click();

    expect(input.value).toBe('/bold ');
    expect(dom.window.document.activeElement).toBe(input);
    expect(textEl.textContent).toBe('');
    expect(box.hidden).toBe(true);
  });

  it('Typewriter領域はキーボード操作でも入力欄へコピーできる', () => {
    const dom = loadPage('mentionEditorCopyMode=typewriter');
    openSlashAndPick(dom, '/bold');
    const window = dom.window as any;
    const input = window.document.getElementById('previewInput') as HTMLInputElement;
    const box = window.document.getElementById('typewriterOutput') as HTMLElement;

    box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(input.value).toBe('/bold ');
    expect(box.hidden).toBe(true);
  });

  it('Cookieに過去仕様や壊れた値が入っていても既定(default)として扱う', () => {
    const dom = loadPage('mentionEditorCopyMode=legacy-value');
    const toggle = dom.window.document.getElementById('copyModeToggle') as HTMLButtonElement;
    expect(toggle.textContent).toBe('default');
    openSlashAndPick(dom, '/bold');
    const input = dom.window.document.getElementById('previewInput') as HTMLInputElement;
    expect(input.value).toBe('/bold ');
  });
});

describe('sizeToStyle', () => {
  const sizeToStyle = loadFn<(t: any) => { width: string; height: string; rows: number | null }>('sizeToStyle');

  it('ch と rows は幅を ch、高さを rows 属性で指定する', () => {
    expect(sizeToStyle({ width: { value: 40, unit: 'ch' }, height: { value: 15, unit: 'rows' } }))
      .toEqual({ width: '40ch', height: '', rows: 15 });
  });

  it('px 指定は px の文字列になり rows は null', () => {
    expect(sizeToStyle({ width: { value: 480, unit: 'px' }, height: { value: 300, unit: 'px' } }))
      .toEqual({ width: '480px', height: '300px', rows: null });
  });
});
