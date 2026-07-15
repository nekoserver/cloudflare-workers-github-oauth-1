// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「宿泊地の推奨プラン」。
//   (1) 見出しの右に総宿泊数から算出した「(◯泊◯日)」を表示する
//   (2) 表中の「訪問した経由地」カラムの各要素をボタン化し、タップでON/OFFを切り替える
//      (OFF時はボタン背景を薄い灰色にする)
//   (3) タップの都度、state.selectedを更新した上で候補チェックリストと
//      距離・時間の再計算(renderCandidates/recompute)を呼び直す
// 故障シナリオ:
//   (1) 泊数から日数への変換を誤る(X泊Y日のYはX+1が正しい)
//   (2) OFF状態のchipに.offクラスが付かず、見た目上ONのままになる
//   (3) タップしてもstate.selectedが更新されない/2回タップで元に戻らない
//   (4) タップのたびにrecompute等が呼ばれず、距離・時間が再計算されない

function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n\\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

function loadDayPlanFns(html: string) {
  const src = [
    'var state = { selected: {} };',
    "var esc = function(s) { return String(s||'').replace(/[&<>\"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];}); };",
    extractFn(html, 'visitChipHtml', 'name'),
    extractFn(html, 'renderDayPlan', 'ordered, days, availableNights'),
  ].join('\n');

  const renderCandidates = vi.fn();
  const recompute = vi.fn();
  const rankRemovalCandidates = vi.fn().mockReturnValue([]);

  const fn = new Function(
    'renderCandidates', 'recompute', 'rankRemovalCandidates',
    `${src}\nreturn { state: state, renderDayPlan: renderDayPlan, visitChipHtml: visitChipHtml };`
  );
  const api = fn(renderCandidates, recompute, rankRemovalCandidates);
  return { ...api, renderCandidates, recompute };
}

function setupDom() {
  document.body.innerHTML = '<div id="day-plan"></div><span id="day-plan-duration"></span>';
}

describe('宿泊地の推奨プラン: (◯泊◯日)ラベル', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('総宿泊数Xから「X泊(X+1)日」を算出して表示する', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan } = loadDayPlanFns(html);
    const ordered = [{ name: 'パリ' }, { name: 'ローマ' }];
    const days = [
      { city: 'リヨン', km: 400, nights: 1, visits: ['A地点'], isHub: false },
      { city: 'ローマ', km: 400, nights: 0, visits: [], isHub: false },
    ];
    renderDayPlan(ordered, days, null);
    expect(document.getElementById('day-plan-duration')!.textContent).toBe('(1泊2日)');
  });

  it('宿泊数0(日帰り圏)の場合は「0泊1日」と表示する', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan } = loadDayPlanFns(html);
    const ordered = [{ name: 'パリ' }, { name: 'リヨン' }];
    const days = [{ city: 'リヨン', km: 300, nights: 0, visits: [], isHub: false }];
    renderDayPlan(ordered, days, null);
    expect(document.getElementById('day-plan-duration')!.textContent).toBe('(0泊1日)');
  });

  it('ルートが無い場合はラベルを空にする', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan } = loadDayPlanFns(html);
    renderDayPlan([], [], null);
    expect(document.getElementById('day-plan-duration')!.textContent).toBe('');
  });
});

describe('宿泊地の推奨プラン: 訪問した経由地カラムのボタン化・ON/OFFトグル', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('訪問した経由地は各要素がbutton.visit-chipとして描画され、既定はON(offクラス無し)', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan } = loadDayPlanFns(html);
    const ordered = [{ name: 'パリ' }, { name: 'ローマ' }];
    const days = [{ city: 'リヨン', km: 400, nights: 1, visits: ['A地点', 'B地点'], isHub: false }];
    renderDayPlan(ordered, days, null);
    const chips = document.querySelectorAll('.visit-chip');
    expect(chips.length).toBe(2);
    chips.forEach((chip) => { expect(chip.classList.contains('off')).toBe(false); });
    expect(chips[0].getAttribute('data-visit')).toBe('A地点');
  });

  it('chipをタップするとstate.selectedがfalseになり、.offクラスが付与され、' +
    'renderCandidates・recomputeが呼び直される', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan, state, renderCandidates, recompute } = loadDayPlanFns(html);
    const ordered = [{ name: 'パリ' }, { name: 'ローマ' }];
    const days = [{ city: 'リヨン', km: 400, nights: 1, visits: ['A地点'], isHub: false }];
    renderDayPlan(ordered, days, null);
    const chip = document.querySelector('.visit-chip') as HTMLButtonElement;
    chip.click();
    expect(state.selected['A地点']).toBe(false);
    expect(chip.classList.contains('off')).toBe(true);
    expect(renderCandidates).toHaveBeenCalledTimes(1);
    expect(recompute).toHaveBeenCalledTimes(1);
  });

  it('OFFのchipを再度タップするとONに戻る(state.selected=true・offクラス除去)', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan, state } = loadDayPlanFns(html);
    const ordered = [{ name: 'パリ' }, { name: 'ローマ' }];
    const days = [{ city: 'リヨン', km: 400, nights: 1, visits: ['A地点'], isHub: false }];
    renderDayPlan(ordered, days, null);
    const chip = document.querySelector('.visit-chip') as HTMLButtonElement;
    chip.click();
    chip.click();
    expect(state.selected['A地点']).toBe(true);
    expect(chip.classList.contains('off')).toBe(false);
  });

  it('visitChipHtmlはstate.selectedが明示的にfalseの地点をoffクラス付きで描画する', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { visitChipHtml, state } = loadDayPlanFns(html);
    state.selected['除外済み地点'] = false;
    const out = visitChipHtml('除外済み地点');
    expect(out).toContain('class="visit-chip off"');
  });

  it('訪問した経由地が無い日は「-」を表示し、chipは生成しない', () => {
    setupDom();
    const html = getHeritageJourneyPage();
    const { renderDayPlan } = loadDayPlanFns(html);
    const ordered = [{ name: 'パリ' }, { name: 'ローマ' }];
    const days = [{ city: 'ローマ', km: 200, nights: 0, visits: [], isHub: false }];
    renderDayPlan(ordered, days, null);
    expect(document.querySelectorAll('.visit-chip').length).toBe(0);
    expect(document.getElementById('day-plan')!.innerHTML).toContain('-');
  });
});

describe('getHeritageJourneyPage: 新規DOM要素・関数の存在', () => {
  it('day-plan-duration要素とvisitChipHtml/renderDayPlan関数を含む', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="day-plan-duration"');
    expect(html).toContain('function visitChipHtml(');
    expect(html).toContain('class="visit-chip');
  });
});
