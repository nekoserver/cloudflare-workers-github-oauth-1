// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';
import {
  CHESS_QXG7_SAC_ID,
  CHESS_QXG7_SAC_INITIAL,
  CHESS_QXG7_SAC_MOVE_TEXT,
} from './data/chessQxg7Sac';

// 対象: /chess-tsume-17te ページの対局選択に追加する
// 「15.Qxg7+ Kxg7 16.Nxd5+ Kh6」のクイーン捨て駒プリセットと、
// 画面下に固定表示する再生速度スライダー。
// 故障シナリオ:
//   (1) カスタム開始局面(CHESS_QXG7_SAC_INITIAL)からのSAN解析で、
//       曖昧さ解決(Kxg7がどちらのキング/駒の動きか等)を誤る
//   (2) 対局選択でこのプリセットを選んでも開始局面がSTANDARD_STARTや
//       TSUME_INITIAL等のままになり、「読み込んで再生」がエラーになる
//   (3) スライダーを動かしても実際のsetInterval間隔(state.playIntervalMs)に
//       反映されない(表示だけ変わって実際の速度は変わらない)
//   (4) 再生中にスライダーを動かした場合、次の1手からではなく最後まで
//       古い速度のまま固定されてしまう(タイマーの再起動漏れ)
//   (5) スライダーの初期値がPLAY_INTERVAL_MSの既定値とズレている
function extractEngineBlock(html: string): string {
  const start = html.indexOf('var TSUME_INITIAL');
  const end = html.indexOf('\nvar state = {', start);
  if (start === -1 || end === -1) throw new Error('engine block が生成HTMLから見つからない');
  return html.slice(start, end);
}

function loadEngine(html: string) {
  const src = extractEngineBlock(html);
  const fn = new Function(
    `${src}\nreturn { QXG7_SAC: typeof QXG7_SAC !== 'undefined' ? QXG7_SAC : null, applySanMove: applySanMove, parseGameText: parseGameText, buildPositions: buildPositions };`
  );
  return fn();
}

describe('QXG7_SAC プリセットのSAN解析(15.Qxg7+ Kxg7 16.Nxd5+ Kh6)', () => {
  it('QXG7_SACのデータ(初期配置・棋譜)が生成HTMLに埋め込まれている', () => {
    const html = getChessTsumePage();
    const { QXG7_SAC } = loadEngine(html);
    expect(QXG7_SAC).not.toBeNull();
    expect(QXG7_SAC.id).toBe(CHESS_QXG7_SAC_ID);
    expect(QXG7_SAC.moveText).toBe(CHESS_QXG7_SAC_MOVE_TEXT);
  });

  it('4手すべてが解析でき、from/toマスが実際の駒の動きと一致する', () => {
    const html = getChessTsumePage();
    const { parseGameText } = loadEngine(html);
    const parsed = parseGameText(CHESS_QXG7_SAC_MOVE_TEXT, CHESS_QXG7_SAC_INITIAL);
    expect(parsed.moves).toHaveLength(4);
    expect(parsed.moves[0]).toMatchObject({ from: 'd4', to: 'g7', san: 'Qxg7+', check: true });
    expect(parsed.moves[1]).toMatchObject({ from: 'g8', to: 'g7', san: 'Kxg7' });
    expect(parsed.moves[2]).toMatchObject({ from: 'c3', to: 'd5', san: 'Nxd5+', check: true });
    expect(parsed.moves[3]).toMatchObject({ from: 'g7', to: 'h6', san: 'Kh6' });
  });

  it('4手再生した最終局面が、白クイーン消滅・黒ビショップ&ナイト消滅・黒キングh6という検証済みの局面と一致する', () => {
    const html = getChessTsumePage();
    const { parseGameText, buildPositions } = loadEngine(html);
    const parsed = parseGameText(CHESS_QXG7_SAC_MOVE_TEXT, CHESS_QXG7_SAC_INITIAL);
    const positions = buildPositions(CHESS_QXG7_SAC_INITIAL, parsed.moves);
    const final = positions[positions.length - 1];
    expect(final).toEqual({
      a8: 'bR', d8: 'bQ', f8: 'bR', h6: 'bK',
      a7: 'bP', f7: 'bP', h7: 'bP',
      b6: 'bP', e6: 'bP', g6: 'bP',
      d5: 'wN',
      b3: 'wP', g3: 'wP',
      a2: 'wP', b2: 'wB', e2: 'wP', f2: 'wP', g2: 'wK', h2: 'wP',
      a1: 'wR', d1: 'wR',
    });
  });

  it('対局選択のドロップダウンにプリセットの選択肢が追加されている', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function populateKifuSelect');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('QXG7_SAC.id');
    expect(block).toContain('QXG7_SAC.title');
  });

  it('プリセット選択時に棋譜欄へ差し替えて自動再生する分岐がある', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function onKifuSelectChange');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1600);
    expect(block).toContain('val === QXG7_SAC.id');
    expect(block).toContain('QXG7_SAC.moveText');
  });

  it('「読み込んで再生」がプリセット選択中はQXG7_SAC.initialを開始局面に使う', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function loadFromKifuInput');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('QXG7_SAC.initial');
  });
});

describe('再生速度スライダー: 画面下に固定表示され、実際の再生間隔に反映される', () => {
  it('script タグ内のJSに構文エラーがない', () => {
    const html = getChessTsumePage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('range inputのスライダー要素が存在し、初期値がPLAY_INTERVAL_MSと一致する', () => {
    const html = getChessTsumePage();
    expect(html).toContain('id="speed-slider"');
    expect(html).toContain('type="range"');
    const m = html.match(/var PLAY_INTERVAL_MS = (\d+);/);
    expect(m).not.toBeNull();
    const sliderTagStart = html.indexOf('id="speed-slider"');
    const tagStart = html.lastIndexOf('<input', sliderTagStart);
    const tag = html.slice(tagStart, sliderTagStart + 200);
    expect(tag).toContain('value="' + m![1] + '"');
  });

  it('スライダーのCSSが画面下に固定表示(position:fixed; bottom)される', () => {
    const html = getChessTsumePage();
    const styleBlock = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(styleBlock).toMatch(/\.speed-footer\{[^}]*position:fixed[^}]*\}/);
    expect(styleBlock).toMatch(/\.speed-footer\{[^}]*bottom:0[^}]*\}/);
  });

  it('state.playIntervalMsの初期値がPLAY_INTERVAL_MSと一致する', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('var state = {');
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('playIntervalMs: PLAY_INTERVAL_MS');
  });

  it('startPlayのsetIntervalがstate.playIntervalMsを参照している(ハードコードされた定数ではない)', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function startPlay');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('setInterval(');
    expect(block).toContain('state.playIntervalMs');
  });

  it('スライダーのinputハンドラがstate.playIntervalMsを更新し、表示テキストも更新する', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf("getElementById('speed-slider')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('state.playIntervalMs = ');
    expect(block).toContain("getElementById('speed-value')");
  });

  it('再生中にスライダーを動かすとタイマーが新しい速度で再起動される', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf("getElementById('speed-slider')");
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('state.playDir');
    expect(block).toContain('startPlay(');
  });
});

describe('再生速度スライダー: 実際にタイマー間隔が変わることをfakeTimerで検証', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('スライダーで500msに変更すると、以降の自動再生は500ms間隔でplyが進む', () => {
    vi.useFakeTimers();
    const html = getChessTsumePage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    // eslint-disable-next-line no-new-func
    new Function(scriptMatch![1])();

    const slider = document.getElementById('speed-slider') as HTMLInputElement;
    slider.value = '500';
    slider.dispatchEvent(new Event('input'));

    (document.getElementById('btn-play') as HTMLButtonElement).click();
    vi.advanceTimersByTime(500 * 2);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('2 / 17');
  });
});
