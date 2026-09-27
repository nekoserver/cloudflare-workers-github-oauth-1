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
    for (const id of ['widthValue', 'widthUnit', 'heightValue', 'heightUnit', 'triggerKey', 'position', 'tabsEditor', 'addTab', 'jsonOut', 'btnCopy', 'btnDownload', 'btnImport', 'btnSave', 'savedDocuments', 'btnLoadSaved', 'saveModal', 'saveTitle', 'btnConfirmSave', 'previewInput', 'previewArea']) {
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

  it('script内のJSに構文エラーがなく、innerHTMLを使わない', () => {
    const m = /<script>([\s\S]*?)<\/script>/.exec(html);
    expect(m).toBeTruthy();
    expect(() => new Function(m![1])).not.toThrow();
    expect(m![1]).not.toContain('innerHTML');
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
