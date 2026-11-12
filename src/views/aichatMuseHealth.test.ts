import { spawnSync } from 'node:child_process';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AICHAT_MUSE_HEALTH_SCRIPT, AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS } from './aichatMuseHealth';
import { getAiChatPage } from './aichat';

type Watch = { setModel(model: string): void; checkIfDue(): void; applySettings(): void };
type Settings = { enabled: boolean; intervalSeconds: number };
type Script = {
  createMuseHealthWatch(options: unknown): Watch;
  readMuseSignalSettings(cookie: string): Settings;
  openMuseSignalModal(options: unknown): void;
};

const script = new Function(`${AICHAT_MUSE_HEALTH_SCRIPT}\nreturn { createMuseHealthWatch, readMuseSignalSettings, openMuseSignalModal };`)() as Script;
const DEFAULT_MS = AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS * 1000;

function setup(health: () => Promise<boolean>) {
  const state = { border: 'unset', hidden: false, settings: { enabled: true, intervalSeconds: AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS } };
  const fetchHealth = vi.fn(health);
  const watch = script.createMuseHealthWatch({
    fetchHealth,
    getColor: () => '#3b82f6',
    setBorderColor: (color: string) => { state.border = color; },
    isHidden: () => state.hidden,
    getSettings: () => state.settings,
  });
  return { watch, state, fetchHealth };
}

describe('Museの死活確認(入力窓の枠色)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('既定の間隔は10分(600秒)', () => {
    expect(AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS).toBe(600);
  });

  it('Muse選択中に稼働中なら、Museに割り当てられた色を枠に付ける', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchHealth).toHaveBeenCalledTimes(1);
    expect(state.border).toBe('#3b82f6');
  });

  it('稼働中でなければ枠の色を既定に戻す', async () => {
    const { watch, state } = setup(async () => false);
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(0);
    expect(state.border).toBe('');
  });

  it('確認に失敗したら、稼働中の色を残さない', async () => {
    let healthy = true;
    const { watch, state } = setup(async () => { if (!healthy) throw new Error('network'); return true; });
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(0);
    expect(state.border).toBe('#3b82f6');
    healthy = false;
    await vi.advanceTimersByTimeAsync(DEFAULT_MS);
    expect(state.border).toBe('');
  });

  it('一定時間ごとに確認し、落ちたら色が消え、戻れば色が付く', async () => {
    let healthy = true;
    const { watch, state, fetchHealth } = setup(async () => healthy);
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(0);
    healthy = false;
    await vi.advanceTimersByTimeAsync(DEFAULT_MS);
    expect(fetchHealth).toHaveBeenCalledTimes(2);
    expect(state.border).toBe('');
    healthy = true;
    await vi.advanceTimersByTimeAsync(DEFAULT_MS);
    expect(fetchHealth).toHaveBeenCalledTimes(3);
    expect(state.border).toBe('#3b82f6');
  });

  it('Muse以外を選んでいる間は確認を送らない', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    watch.setModel('claude');
    await vi.advanceTimersByTimeAsync(DEFAULT_MS * 3);
    expect(fetchHealth).not.toHaveBeenCalled();
    expect(state.border).toBe('');
  });

  it('Museから切り替えたら色を消し、確認を止める', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(0);
    watch.setModel('claude');
    expect(state.border).toBe('');
    await vi.advanceTimersByTimeAsync(DEFAULT_MS * 3);
    expect(fetchHealth).toHaveBeenCalledTimes(1);
  });

  // 故障想定: 確認の応答を待つ間に切り替えると、Muse以外の選択中に稼働中の色が付く。
  it('切り替えより後に届いた応答では色を付けない', async () => {
    let resolve: (value: boolean) => void = () => {};
    const { watch, state } = setup(() => new Promise<boolean>((r) => { resolve = r; }));
    watch.setModel('muse');
    watch.setModel('claude');
    resolve(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.border).toBe('');
  });

  it('同じモデルを選び直しても、確認を増やさず色も消さない', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(0);
    watch.setModel('muse');
    expect(state.border).toBe('#3b82f6');
    await vi.advanceTimersByTimeAsync(DEFAULT_MS);
    expect(fetchHealth).toHaveBeenCalledTimes(2);
  });

  it('タブが隠れている間は送らず、表示に戻ったら確認する', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    state.hidden = true;
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(DEFAULT_MS * 2);
    expect(fetchHealth).not.toHaveBeenCalled();
    state.hidden = false;
    watch.checkIfDue();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchHealth).toHaveBeenCalledTimes(1);
    expect(state.border).toBe('#3b82f6');
  });

  it('Muse以外の選択中はタブを戻しても確認しない', async () => {
    const { watch, fetchHealth } = setup(async () => true);
    watch.setModel('claude');
    watch.checkIfDue();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchHealth).not.toHaveBeenCalled();
  });

  // 故障想定: タブを行き来するたびに信号が飛び、10分刻みにならない。
  it('タブが表示に戻っても、前回から間隔が空いていなければ送らない', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(DEFAULT_MS - 1000);
    expect(fetchHealth).toHaveBeenCalledTimes(1);
    watch.checkIfDue();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchHealth).toHaveBeenCalledTimes(1);
    state.hidden = true;
    await vi.advanceTimersByTimeAsync(DEFAULT_MS * 2);
    expect(fetchHealth).toHaveBeenCalledTimes(1);
    state.hidden = false;
    watch.checkIfDue();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchHealth).toHaveBeenCalledTimes(2);
  });

  it('シグナル送信がOFFなら、Muse選択中でも信号を送らず枠も付けない', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    state.settings = { enabled: false, intervalSeconds: 600 };
    watch.setModel('muse');
    await vi.advanceTimersByTimeAsync(DEFAULT_MS * 3);
    watch.checkIfDue();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchHealth).not.toHaveBeenCalled();
    expect(state.border).toBe('');
  });

  it('OFFへ変えたら止めて枠を戻し、応答待ちの結果も捨てる', async () => {
    let resolve: (value: boolean) => void = () => {};
    const { watch, state, fetchHealth } = setup(() => new Promise<boolean>((r) => { resolve = r; }));
    watch.setModel('muse');
    state.settings = { enabled: false, intervalSeconds: 600 };
    watch.applySettings();
    resolve(true);
    await vi.advanceTimersByTimeAsync(DEFAULT_MS * 2);
    expect(state.border).toBe('');
    expect(fetchHealth).toHaveBeenCalledTimes(1);
  });

  it('ONへ戻したらすぐ確認し、新しい間隔で送る', async () => {
    const { watch, state, fetchHealth } = setup(async () => true);
    state.settings = { enabled: false, intervalSeconds: 600 };
    watch.setModel('muse');
    state.settings = { enabled: true, intervalSeconds: 120 };
    watch.applySettings();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.border).toBe('#3b82f6');
    expect(fetchHealth).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchHealth).toHaveBeenCalledTimes(2);
  });
});

describe('シグナル送信の設定の読み取り', () => {
  const cookie = (value: unknown) => 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify(value));

  it('未設定なら、有効で600秒', () => {
    expect(script.readMuseSignalSettings('')).toEqual({ transport: 'container', enabled: true, intervalSeconds: 600 });
  });

  // 故障想定: 他のCookieの後ろにあると読めず、OFFにしても次の読み込みでONへ戻る。
  it('他のCookieの後ろにあっても読める', () => {
    expect(script.readMuseSignalSettings('a=1; ' + cookie({ enabled: false, intervalSeconds: 900 }) + '; b=2')).toEqual({ transport: 'container', enabled: false, intervalSeconds: 900 });
  });

  it.each([
    ['壊れたJSON', 'aichat_muse_signal=%7Bbroken'],
    ['値が不正な形', cookie('x')],
  ])('%sなら既定値を使う', (_name, text) => {
    expect(script.readMuseSignalSettings(text)).toEqual({ transport: 'container', enabled: true, intervalSeconds: 600 });
  });

  it.each([[59], [86401], [60.5], ['600'], [null]])('間隔が%sなら既定の600秒を使い、ON/OFFは保つ', (intervalSeconds) => {
    expect(script.readMuseSignalSettings(cookie({ enabled: false, intervalSeconds }))).toEqual({ transport: 'container', enabled: false, intervalSeconds: 600 });
  });
});

describe('シグナル送信のモーダル', () => {
  function open(settings: Settings = { enabled: true, intervalSeconds: 600 }) {
    document.body.innerHTML = '';
    const save = vi.fn();
    const reset = vi.fn();
    script.openMuseSignalModal({ getSettings: () => settings, saveSettings: save, resetSettings: reset, getNextZ: () => 123456 });
    const overlay = document.querySelector<HTMLElement>('[data-overlay]')!;
    const checkbox = overlay.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const interval = overlay.querySelector<HTMLInputElement>('input[type="number"]')!;
    const button = (text: string) => [...overlay.querySelectorAll('button')].find((b) => b.textContent === text)!;
    return { overlay, checkbox, interval, button, save, reset };
  }

  it('最上位の重なり順で開き、既定で有効・600秒を表示する', () => {
    const { overlay, checkbox, interval } = open();
    expect(overlay.style.zIndex).toBe('123456');
    expect(checkbox.checked).toBe(true);
    expect(interval.value).toBe('600');
    expect(interval.disabled).toBe(false);
  });

  // 2026-11-07 ユーザー指定: Muse選択の接頭語なし投稿は常に直接muse-vmへ送るので、tunnelsへの切り替えの設定は出さない。
  it('Tailscale未接続時にtunnelsを使う設定は表示しない', () => {
    const view = open();
    expect(view.overlay.querySelector('[data-muse-tunnels-fallback]')).toBeNull();
    expect(view.overlay.textContent).not.toContain('tunnels');
  });

  it('間隔の入力はチェックボックスに連動する', () => {
    const { checkbox, interval } = open();
    checkbox.click();
    expect(interval.disabled).toBe(true);
    checkbox.click();
    expect(interval.disabled).toBe(false);
  });

  it('OFFの設定で開くと、間隔の入力は無効になっている', () => {
    expect(open({ enabled: false, intervalSeconds: 900 }).interval.disabled).toBe(true);
  });

  it('保存すると設定を渡して閉じる', () => {
    const { checkbox, interval, button, save } = open();
    interval.value = '900';
    checkbox.click();
    button('保存').click();
    expect(save).toHaveBeenCalledWith({ transport: 'container', enabled: false, intervalSeconds: 900 });
    expect(document.querySelector('[data-overlay]')).toBeNull();
  });

  it.each(['59', '86401', '60.5', ''])('間隔が%sなら保存せず、開いたまま理由を出す', (value) => {
    const { overlay, interval, button, save } = open();
    interval.value = value;
    button('保存').click();
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[data-overlay]')).not.toBeNull();
    expect(overlay.textContent).toContain('60〜86400');
  });

  // 故障想定: 間隔の入力が無効で見えない値のせいで、OFFの保存ができない。
  it('OFFなら不正な間隔があっても、元の間隔で保存できる', () => {
    const { checkbox, interval, button, save } = open({ enabled: true, intervalSeconds: 900 });
    interval.value = '1';
    checkbox.click();
    button('保存').click();
    expect(save).toHaveBeenCalledWith({ transport: 'container', enabled: false, intervalSeconds: 900 });
  });

  it('デフォルトに戻すと設定を消して閉じる', () => {
    const { button, reset, save } = open();
    button('デフォルトに戻す').click();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[data-overlay]')).toBeNull();
  });

  it('外側のクリックでは保存せず閉じる', () => {
    const { overlay, save } = open();
    overlay.click();
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[data-overlay]')).toBeNull();
  });
});

describe('/aichatページへの組み込み', () => {
  const html = getAiChatPage({ username: 'u', aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', modelColors: { muse: '#3b82f6' } });

  it('投稿時の枠色更新もプレフィックスとモデル選択を混同しない', () => {
    const start = html.indexOf('      var museSubmission =');
    const end = html.indexOf('      if (museSubmission)', start);
    const decide = new Function('currentMsg', 'payload', html.slice(start, end) + ';return museSubmission;');
    expect(decide('質問', { model: 'muse' })).toBe(true);
    expect(decide('/neko askgk codex_prompt="質問"', { model: 'muse' })).toBe(false);
    expect(decide('/neko askgk muse_prompt="質問"', { model: 'claude' })).toBe(true);
    expect(decide('/askmuse prompt="質問"', { model: 'muse' })).toBe(false);
  });

  it('生成HTMLのインラインJavaScriptがnode --checkを通る', () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
    expect(scripts.length).toBeGreaterThan(0);
    for (const source of scripts) {
      const result = spawnSync(process.execPath, ['--check'], { input: source, encoding: 'utf8' });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    }
  });

  it('監視を読み込み、色丸で切り替えるすべての経路が通るapplyModelColorへ接続する', () => {
    expect(html).toContain('function createMuseHealthWatch');
    const apply = html.slice(html.indexOf('function applyModelColor'), html.indexOf('var modelSelect = document.getElementById'));
    expect(apply).toContain('museHealthWatch.setModel(model)');
    expect(html).toContain("/api/aichat/muse-health");
  });

  // 故障想定: 枠色を固定値にすると、言語モデルの色の設定と食い違う。
  it('枠の色は固定値ではなく、Museに割り当てられた色を使う', () => {
    const wiring = html.slice(html.indexOf('createMuseHealthWatch({'));
    expect(wiring).toContain("getModelDotColor('muse')");
  });

  // 故障想定: .chat-input:focusのborder-colorに負け、入力中に色が消える。
  it('枠の色はインラインで付け、フォーカス中のCSSより優先する', () => {
    expect(html).toContain('chatInput.style.borderColor = color');
  });

  // 実際の行の組み立てを動かす。
  function buildRows() {
    const select = html.match(/<select[^>]*id="modelSelect"[\s\S]*?<\/select>/)![0];
    document.body.innerHTML = select + '<span id="modelColorDot"></span><div id="modelDotDropdown"></div>';
    const list = JSON.parse(html.match(/var MODEL_LIST = (.*);/)![1]);
    const build = html.slice(html.indexOf('    function buildModelDotDropdown()'), html.indexOf('    // モデルごとのパラメータ調整値'));
    const openMuseSignalSettings = vi.fn();
    const bindings = {
      document, MODEL_LIST: list, AICHAT_TUNABLE_MODEL_CONFIG: {}, getModelDotColor: () => '', openAichatTuneModal() {},
      modelDotDropdown: document.getElementById('modelDotDropdown'), modelColorDot: null, modelSelect: document.getElementById('modelSelect'),
      closeModelDotDropdown: vi.fn(), applyModelColor() {}, openMuseSignalSettings,
    };
    new Function(...Object.keys(bindings), 'var lastModel = "other";\n' + build + '\nbuildModelDotDropdown();')(...Object.values(bindings));
    const rows = [...document.querySelectorAll<HTMLElement>('.model-dot-dropdown-item')];
    return { rows, bindings, openMuseSignalSettings };
  }

  it('Museの行の行末にだけ⚙があり、開いてもモデルは切り替えない', () => {
    const { rows, bindings, openMuseSignalSettings } = buildRows();
    const withGear = rows.filter((row) => row.querySelector('.model-dot-dropdown-tune-btn'));
    expect(withGear.map((row) => row.textContent)).toEqual(['muse⚙']);
    expect(withGear[0].lastElementChild!.classList.contains('model-dot-dropdown-tune-btn')).toBe(true);
    (withGear[0].lastElementChild as HTMLElement).click();
    expect(openMuseSignalSettings).toHaveBeenCalledTimes(1);
    expect(bindings.closeModelDotDropdown).toHaveBeenCalledTimes(1);
    expect((bindings.modelSelect as unknown as HTMLSelectElement).value).not.toBe('muse');
  });
});
