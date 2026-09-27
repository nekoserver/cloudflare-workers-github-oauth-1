import { describe, it, expect } from 'vitest';
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
//   (3) タブ0件・タブ名空・候補0件・候補に空白を含む → 拒否する
//       (候補は空白区切りのトークンで照合するため空白入りは選べなくなる)
//   (4) トリガーが / @ 以外 → 拒否する
//   (5) template literal 内のエスケープで <script> が構文エラーになる
//   (6) username やタブ名経由のXSS → username はエスケープ、プレビューは textContent のみ

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
    for (const id of ['widthValue', 'widthUnit', 'heightValue', 'heightUnit', 'triggerKey', 'position', 'tabsEditor', 'addTab', 'jsonOut', 'btnCopy', 'btnDownload', 'btnImport', 'previewInput', 'previewArea']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain('<option value="/">');
    expect(html).toContain('<option value="@">');
    expect(html).toContain('<option value="top">');
    expect(html).toContain('<option value="bottom">');
    expect(html).toContain('<option value="ch">');
    expect(html).toContain('<option value="rows">');
  });

  it('usernameをエスケープする', () => {
    const x = getMentionEditorPage('<script>alert(1)</script>');
    expect(x).not.toContain('<script>alert(1)</script>');
    expect(x).toContain('&lt;script&gt;');
  });

  it('script内のJSに構文エラーがなく、innerHTMLを使わない', () => {
    const m = /<script>([\s\S]*?)<\/script>/.exec(html);
    expect(m).toBeTruthy();
    expect(() => new Function(m![1])).not.toThrow();
    expect(m![1]).not.toContain('innerHTML');
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

  it('候補0件・空白入り候補は BAD_ITEMS', () => {
    const c: any = valid();
    c.tabs[0].items = [];
    expect(normalizeConfig(c)).toMatchObject({ ok: false, errorCode: 'BAD_ITEMS' });
    const d: any = valid();
    d.tabs[0].items = ['has space'];
    expect(normalizeConfig(d)).toMatchObject({ ok: false, errorCode: 'BAD_ITEMS' });
  });

  it('失敗時は detail に理由が入る(空文字にならない)', () => {
    const r = normalizeConfig(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail.length).toBeGreaterThan(0);
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
