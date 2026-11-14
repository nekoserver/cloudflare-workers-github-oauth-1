// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://inq.test/muse-inquiries"}
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getMuseInquiriesPage, MUSE_INQUIRIES_SCRIPT } from './museInquiries';

// ユーザー指定(2026-11-07): Museとの協議内容をカンバン形式で表示するページ。
// 列はフェーズ。各列に提案・協議内容などのパネルを並べ、パネルから詳細モーダルを開く。ケースごとの提案数なども出す。
type Script = { initMuseInquiriesPage(deps: unknown): Promise<void> };
const script = new Function(`${MUSE_INQUIRIES_SCRIPT}\nreturn { initMuseInquiriesPage };`)() as Script;

const CASE_ID = 'bridge-jobs-queue-20261107';
const BOARD = {
  cases: [
    { id: CASE_ID, goal: '<img src=x onerror=alert(1)>キューを読む', status: 'open', stage: 'plan', entries: 2, openKeys: 1, blockingOpenKeys: 1, proposed: 1, durationSeconds: 313, lastAskedAt: '2026-11-07T20:30:00Z', createdAt: '2026-11-07T19:50:00Z', resolvedAt: null },
    { id: 'nix-packages-20261107', goal: 'Nixの一覧', status: 'resolved', stage: null, entries: 20, openKeys: 0, blockingOpenKeys: 0, proposed: 0, durationSeconds: 2000, lastAskedAt: null, createdAt: '2026-11-07T01:00:00Z', resolvedAt: '2026-11-07T05:00:00Z' },
  ],
  phases: [
    { key: 'inquiry', label: '協議（問い合わせ）', panels: [
      { type: 'entry', caseId: CASE_ID, seq: 2, title: '協議する', summary: '<b>役割を分ける</b>', status: 'answered', durationSeconds: 145, createdAt: '2026-11-07T20:30:00Z', agent: 'muse' },
      { type: 'entry', caseId: 'nix-packages-20261107', seq: 1, title: 'Nix', summary: '一覧', status: 'answered', durationSeconds: 60, createdAt: '2026-11-07T02:00:00Z', agent: 'muse' },
    ] },
    { key: 'open-keys', label: '未解決の論点', panels: [{ type: 'key', caseId: CASE_ID, id: 'k1', kind: 'pitfall', title: '排他が無い', blocking: true, mutating: true }] },
    { key: 'proposed', label: '提案（採否待ち）', panels: [{ type: 'proposal', caseId: CASE_ID, id: 'p1', title: 'renameで排他', status: 'proposed', reason: '利用者が決める', proposedBy: 'muse', entryId: CASE_ID + '-e2' }] },
    { key: 'adopted', label: '採用・実施中', panels: [] },
    { key: 'done', label: '完了', panels: [] },
    { key: 'rejected', label: '不採用', panels: [] },
  ],
};
const DETAIL = {
  case: BOARD.cases[0],
  entries: [
    { id: CASE_ID + '-e1', seq: 1, clue: '読み方', askedBy: 'claude-code', agent: 'muse', askId: 'muse-1', question: '質問1', answer: '回答1', info: '要約1', progress: '前進1', status: 'answered', durationSeconds: 168, createdAt: '2026-11-07T19:55:00Z' },
    { id: CASE_ID + '-e2', seq: 2, clue: '協議する', askedBy: 'claude-code', agent: 'muse', askId: 'muse-2', question: '質問2', answer: '<script>bad()</script>回答2', info: '要約2', progress: '前進2', status: 'answered', durationSeconds: 145, createdAt: '2026-11-07T20:30:00Z' },
  ],
  keys: [{ id: 'k1', kind: 'pitfall', text: '排他が無い', status: 'open', blocking: true, mutating: true }],
  proposals: [{ id: 'p1', proposedBy: 'muse', text: 'renameで排他', status: 'proposed', reason: '利用者が決める', entryId: CASE_ID + '-e2' }],
};

const LAYOUT_COOKIE = 'inq_board_layout';
function loadBody() {
  document.cookie = LAYOUT_COOKIE + '=; Path=/muse-inquiries; Secure; Max-Age=0';
  const html = getMuseInquiriesPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>', html.indexOf('<body>')));
}
const api = () => vi.fn(async (url: string) => (url === '/api/muse-inquiries/board' ? BOARD : DETAIL));
const modal = () => document.getElementById('inq-modal')!;

describe('Museとの協議のカンバン', () => {
  beforeEach(() => { sessionStorage.clear(); loadBody(); });

  it('フェーズごとの列に件数とパネルを並べる。文字列はHTMLとして解釈しない', async () => {
    const fetchJson = api();
    await script.initMuseInquiriesPage({ document, fetchJson });
    expect(fetchJson).toHaveBeenCalledWith('/api/muse-inquiries/board');
    expect([...document.querySelectorAll('[data-phase]')].map((c) => c.getAttribute('data-phase'))).toEqual(['inquiry', 'open-keys', 'proposed', 'adopted', 'done', 'rejected']);
    const inquiry = document.querySelector('[data-phase="inquiry"]')!;
    expect(inquiry.querySelector('[data-field="label"]')!.textContent).toBe('協議（問い合わせ）');
    expect(inquiry.querySelector('[data-field="count"]')!.textContent).toBe('2');
    expect(inquiry.textContent).toContain('<b>役割を分ける</b>');
    expect(inquiry.querySelector('b')).toBeNull();
    expect(document.querySelector('[data-phase="open-keys"] .inq-blocking')).not.toBeNull();
    expect(document.querySelector('[data-phase="done"] [data-field="empty"]')!.textContent).toContain('ありません');
  });

  it('上部の固定ヘッダに4種類の状態フィルタを置き、すべてを初期選択する', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-status-filter]')];
    expect(buttons.map((b) => b.dataset.statusFilter)).toEqual(['all', 'discussing', 'pending', 'done']);
    expect(buttons.map((b) => b.querySelector('[data-filter-label]')?.textContent)).toEqual(['すべて', '協議中', '採否待ち', '完了']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    expect(buttons.every((b) => b.closest('#inq-header'))).toBe(true);
    expect(getMuseInquiriesPage()).toMatch(/\.inq-header \{[^}]*position: sticky; top: 0;/);
  });

  it('状態ごとのカード件数を表示し、繰り返し押しても該当フェーズだけを表示する', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((phase) => {
      if (!['adopted', 'done', 'rejected'].includes(phase.key)) return phase;
      return { ...phase, panels: [{ type: 'proposal', caseId: CASE_ID, id: phase.key, title: phase.label, status: phase.key, reason: null, proposedBy: 'muse', entryId: null }] };
    }) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    const button = (key: string) => document.querySelector<HTMLButtonElement>('[data-status-filter="' + key + '"]')!;
    const phases = () => [...document.querySelectorAll('[data-phase]')].map((p) => p.getAttribute('data-phase'));
    expect(['all', 'discussing', 'pending', 'done'].map((key) => button(key).querySelector('[data-filter-count]')?.textContent)).toEqual(['7', '2', '1', '4']);
    button('pending').click();
    expect(phases()).toEqual(['proposed']);
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(1);
    expect(button('pending').getAttribute('aria-pressed')).toBe('true');
    expect(button('all').getAttribute('aria-pressed')).toBe('false');
    button('pending').click();
    expect(phases()).toEqual(['proposed']);
    button('done').click();
    expect(phases()).toEqual(['inquiry', 'done', 'rejected']);
    button('discussing').click();
    expect(phases()).toEqual(['open-keys', 'adopted']);
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(2);
    button('all').click();
    expect(phases()).toEqual(BOARD.phases.map((p) => p.key));
  });

  it('状態フィルタとケース選択を併用し、件数を更新して再読み込みでも状態を維持する', async () => {
    const fetchJson = api();
    await script.initMuseInquiriesPage({ document, fetchJson });
    const filter = document.getElementById('inq-case-filter') as HTMLSelectElement;
    filter.value = 'nix-packages-20261107';
    filter.dispatchEvent(new Event('change'));
    const button = (key: string) => document.querySelector<HTMLButtonElement>('[data-status-filter="' + key + '"]')!;
    expect(button('all').querySelector('[data-filter-count]')!.textContent).toBe('1');
    expect(button('pending').querySelector('[data-filter-count]')!.textContent).toBe('0');
    button('pending').click();
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(0);
    expect(document.getElementById('inq-filter-result')!.textContent).toContain('採否待ち: 0件');
    (document.getElementById('inq-refresh') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(2));
    expect(filter.value).toBe('nix-packages-20261107');
    expect(button('pending').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-phase]')).toHaveLength(0);
    filter.value = '';
    filter.dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(1);
    expect(button('pending').querySelector('[data-filter-count]')!.textContent).toBe('1');
  });

  it('全カードに種類と状態を付け、回答済みと失敗を完了として分類する', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'inquiry' ? { ...p, panels: [...p.panels, { ...p.panels[0], seq: 3, status: 'failed', title: '' }] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    const cards = [...document.querySelectorAll('#inq-board [data-panel]')];
    expect(cards.every((card) => card.querySelector('[data-card-type]')?.textContent?.trim())).toBe(true);
    expect(cards.every((card) => card.querySelector('[data-card-status]')?.textContent?.trim())).toBe(true);
    const answered = cards.find((card) => card.textContent?.includes('協議する'))!;
    expect(answered.querySelector('[data-card-status]')!.textContent).toBe('完了');
    expect(answered.textContent).toContain('回答済み');
    const failed = cards.find((card) => card.getAttribute('data-card-key')?.endsWith(':3'))!;
    expect(failed.textContent).toContain('失敗');
    expect(failed.querySelector('.inq-panel-title')!.textContent).toBe('無題の問い合わせ');
    (document.querySelector('[data-status-filter="discussing"]') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#inq-board [data-panel="entry"]')).toHaveLength(0);
    (document.querySelector('[data-status-filter="done"]') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#inq-board [data-panel="entry"]')).toHaveLength(3);
  });

  it('同一カードIDの重複だけを除き、別IDの似た提案は残して件数も一致させる', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'proposed' ? { ...p, panels: [p.panels[0], p.panels[0], { ...p.panels[0], id: 'p-other' }] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    (document.querySelector('[data-status-filter="pending"]') as HTMLButtonElement).click();
    const cards = document.querySelectorAll('#inq-board [data-panel]');
    expect(cards).toHaveLength(2);
    expect(new Set([...cards].map((card) => card.getAttribute('data-card-key'))).size).toBe(2);
    expect(document.querySelector('[data-status-filter="pending"] [data-filter-count]')!.textContent).toBe('2');
    (cards[0] as HTMLButtonElement).click();
    expect(modal().textContent).toContain('renameで排他');
  });

  it('ケース一覧を区別して折りたたみ、各カードで長いケース名を繰り返さない', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    expect(document.getElementById('inq-case-content')!.hidden).toBe(true);
    expect(document.getElementById('inq-case-toggle')!.textContent).toContain('ケース一覧');
    const footer = document.querySelector('#inq-board .inq-panel-case')!;
    expect(footer.textContent).toBe('ケース: ' + CASE_ID);
    expect(footer.getAttribute('title')).toBe(BOARD.cases[0].goal);
  });

  it('完了カードをボードに残したまま末尾の表にも新しい順で並べ、元の会話を開ける', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'done' ? { ...p, panels: [
      { type: 'proposal', caseId: CASE_ID, id: 'p-done-old', title: '前の提案', status: 'done', proposedBy: 'muse', reason: null, entryId: CASE_ID + '-e1', createdAt: '2026-11-06T00:00:00Z', sourceEntry: { id: CASE_ID + '-e1', seq: 1, title: '読み方' } },
      { type: 'proposal', caseId: CASE_ID, id: 'p-done-new', title: '新しい提案', status: 'done', proposedBy: 'muse', reason: null, entryId: CASE_ID + '-e2', createdAt: '2026-11-08T00:00:00Z', sourceEntry: { id: CASE_ID + '-e2', seq: 2, title: '協議する' } },
    ] } : p) };
    const fetchJson = vi.fn(async (url: string) => url === '/api/muse-inquiries/board' ? board : DETAIL);
    await script.initMuseInquiriesPage({ document, fetchJson });
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(6);
    const section = document.getElementById('inq-completed')!;
    expect(section.compareDocumentPosition(document.getElementById('inq-board')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    const rows = [...section.querySelectorAll('tbody tr')];
    expect(rows.map((r) => r.getAttribute('data-history-key'))).toEqual([
      'proposal:' + CASE_ID + ':p-done-new', 'entry:' + CASE_ID + ':2', 'entry:nix-packages-20261107:1', 'proposal:' + CASE_ID + ':p-done-old',
    ]);
    expect(document.querySelector('[data-status-filter="all"] [data-filter-count]')!.textContent).toBe('6');
    expect(document.querySelector('[data-status-filter="done"] [data-filter-count]')!.textContent).toBe('4');
    const origin = rows[0].querySelector<HTMLAnchorElement>('[data-action="open-origin"]')!;
    expect(origin.textContent).toContain('#2 協議する');
    expect(origin.getAttribute('href')).toContain('inq-record-');
    origin.click();
    await vi.waitFor(() => expect(modal().textContent).toContain('質問2'));
    (document.getElementById('inq-modal-close') as HTMLButtonElement).click();
    (document.querySelector('[data-status-filter="pending"]') as HTMLButtonElement).click();
    expect((section as HTMLElement).hidden).toBe(true);
    (document.querySelector('[data-status-filter="done"]') as HTMLButtonElement).click();
    expect((section as HTMLElement).hidden).toBe(false);
    expect(section.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(4);
  });

  // ユーザー指定(2026-11-08): 表やカードにMarkdownの記号(バッククォート・コードブロックの囲み・見出しの#・太字の**)がそのまま出て、3行で切れてコードブロックも崩れていた。
  // 一覧は記号を外した平文で出し、詳細のモーダルは従来どおりMarkdownとして描く。
  // ユーザー指定(2026-11-08): 構想段階の議題がどう肉付けされたかを追える「経緯」をケースの詳細に置く。
  // Muse(muse-2f4d62a8)の案: 1行=1問い合わせでseq順。論点は開いた・閉じた行、提案は発端の行にバッジで出す。要約(info・progress)だけを出し、全文は展開で読む。
  it('ケースの詳細で「項目別」と「経緯」を切り替え、経緯では問い合わせ順に要約と、開いた・閉じた論点、出た提案を並べる', async () => {
    const BT = String.fromCharCode(96);
    const detail = {
      ...DETAIL,
      entries: [
        { ...DETAIL.entries[1], info: '', progress: '', answer: '# 見出し' + String.fromCharCode(10) + BT + 'outcome' + BT + 'を足す' + String.fromCharCode(10) + '二行目' + String.fromCharCode(10) + '三行目' },
        DETAIL.entries[0],
      ],
      keys: [
        { id: 'k1', kind: 'unknown', text: '読めるか', status: 'closed', blocking: false, mutating: false, openedByEntryId: CASE_ID + '-e1', closedByEntryId: CASE_ID + '-e2' },
        { id: 'k9', kind: 'pitfall', text: '結び先なし', status: 'open', blocking: false, mutating: false, openedByEntryId: null, closedByEntryId: null },
      ],
      proposals: [{ id: 'p1', proposedBy: 'muse', text: 'renameで**排他**', status: 'adopted', reason: null, entryId: CASE_ID + '-e2', createdAt: '2026-11-07T20:31:00Z' }],
    };
    const fetchJson = vi.fn(async (url: string) => url === '/api/muse-inquiries/board' ? BOARD : detail);
    await script.initMuseInquiriesPage({ document, fetchJson });
    (document.querySelector('[data-case-summary="' + CASE_ID + '"]') as HTMLElement).click();
    await vi.waitFor(() => expect(modal().querySelector('[data-detail-view="timeline"]')).not.toBeNull());
    const byItem = modal().querySelector<HTMLButtonElement>('[data-detail-view="items"]')!;
    const timelineButton = modal().querySelector<HTMLButtonElement>('[data-detail-view="timeline"]')!;
    expect(byItem.getAttribute('aria-pressed')).toBe('true');
    expect((modal().querySelector('[data-detail-panel="timeline"]') as HTMLElement).hidden).toBe(true);
    timelineButton.click();
    expect(timelineButton.getAttribute('aria-pressed')).toBe('true');
    expect((modal().querySelector('[data-detail-panel="items"]') as HTMLElement).hidden).toBe(true);
    const rows = [...modal().querySelectorAll('[data-timeline-entry]')];
    expect(rows.map((r) => r.getAttribute('data-timeline-entry'))).toEqual(['1', '2']);
    expect(rows[0].textContent).toContain('前進1');
    expect(rows[0].querySelector('[data-timeline-key="opened"]')!.textContent).toContain('読めるか');
    expect(rows[1].querySelector('[data-timeline-key="closed"]')!.textContent).toContain('読めるか');
    const proposal = rows[1].querySelector('[data-timeline-proposal]')!;
    expect(proposal.textContent).toContain('renameで排他');
    expect(proposal.textContent).toContain('採用');
    const summary = rows[1].querySelector('.inq-timeline-summary')!.textContent || '';
    expect(summary).toBe('見出し outcomeを足す');
    expect(summary).not.toContain(BT);
    expect(rows[1].querySelector('details .inq-markdown')).not.toBeNull();
    expect(modal().querySelector('[data-timeline-unlinked]')!.textContent).toContain('結び先なし');
  });

  it('完了表とカードではMarkdownの記号を外した平文を出し、詳細ではMarkdownとして描く', async () => {
    const BT = String.fromCharCode(96);
    const md = ['# レビューの見出し', '', '- ' + BT + 'outcome' + BT + 'を**足す**', BT + BT + BT + 'sql', 'SELECT 1;', BT + BT + BT, '> 引用の行'].join(String.fromCharCode(10));
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'done' ? { ...p, panels: [
      { type: 'proposal', caseId: CASE_ID, id: 'p-md', title: md, status: 'done', proposedBy: 'codex', reason: null, entryId: null, createdAt: '2026-11-08T00:00:00Z', sourceEntry: null },
    ] } : p) };
    const fetchJson = vi.fn(async (url: string) => url === '/api/muse-inquiries/board' ? board : DETAIL);
    await script.initMuseInquiriesPage({ document, fetchJson });
    const row = document.querySelector('[data-history-key="proposal:' + CASE_ID + ':p-md"]')!;
    const cell = row.querySelector('.inq-history-title')!;
    const card = document.querySelector('#inq-board [data-panel] .inq-panel-title');
    const cardTitles = [...document.querySelectorAll('#inq-board .inq-panel-title')].map((n) => n.textContent || '');
    const cardText = cardTitles.find((t) => t.includes('レビューの見出し'))!;
    for (const text of [cell.textContent || '', cardText]) {
      expect(text).toBe('レビューの見出し outcomeを足す SELECT 1; 引用の行');
    }
    expect(card).not.toBeNull();
    (cell as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().querySelector('.inq-markdown code')).not.toBeNull());
    expect(modal().querySelector('.inq-markdown pre')!.textContent).toContain('SELECT 1;');
  });

  it('完了表でも同一IDを重ねず、日時や発端のない記録は推測せず表示する', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'done' ? { ...p, panels: [
      { type: 'proposal', caseId: CASE_ID, id: 'no-origin', title: '<img src=x>単独の提案', status: 'done', proposedBy: 'muse', reason: null, entryId: null },
      { type: 'proposal', caseId: CASE_ID, id: 'no-origin', title: '<img src=x>単独の提案', status: 'done', proposedBy: 'muse', reason: null, entryId: null },
    ] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    const rows = [...document.querySelectorAll('#inq-completed tbody tr')];
    expect(rows).toHaveLength(3);
    expect(rows.at(-1)!.textContent).toContain('日時不明');
    expect(rows.at(-1)!.textContent).toContain('関連付けなし');
    expect(rows.at(-1)!.querySelector('img')).toBeNull();
    const filter = document.getElementById('inq-case-filter') as HTMLSelectElement;
    filter.value = 'nix-packages-20261107'; filter.dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('#inq-completed tbody tr')).toHaveLength(1);
  });

  it('ケース一覧は初期リスト形式で、開閉ボタンと選択状態を連動させる', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    const cases = document.getElementById('inq-cases')!;
    const content = document.getElementById('inq-case-content')!;
    const toggle = document.getElementById('inq-case-toggle') as HTMLButtonElement;
    expect(cases.dataset.view).toBe('list');
    expect(document.querySelector('[data-case-view="list"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-case-view="panel"]')!.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(content.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(content.hidden).toBe(true);
    toggle.click();
    expect(content.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toContain('閉じる');
    toggle.click();
    expect(content.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('開く');
  });

  it('リストとパネルを独立して切り替え、ケースの内容・詳細操作と再読み込み時の選択を保つ', async () => {
    const fetchJson = api();
    await script.initMuseInquiriesPage({ document, fetchJson });
    const toggle = document.getElementById('inq-case-toggle') as HTMLButtonElement;
    const cases = document.getElementById('inq-cases')!;
    const content = document.getElementById('inq-case-content')!;
    const panel = document.querySelector('[data-case-view="panel"]') as HTMLButtonElement;
    const list = document.querySelector('[data-case-view="list"]') as HTMLButtonElement;
    const titles = () => [...cases.querySelectorAll('.inq-panel-title')].map((e) => e.textContent);
    const original = titles();
    panel.click();
    expect(content.hidden).toBe(true);
    expect(cases.dataset.view).toBe('panel');
    expect(panel.getAttribute('aria-pressed')).toBe('true');
    expect(list.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    expect(titles()).toEqual(original);
    (cases.querySelector('[data-case-summary]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().textContent).toContain('質問1'));
    (document.getElementById('inq-modal-close') as HTMLButtonElement).click();
    (document.getElementById('inq-refresh') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(fetchJson.mock.calls.filter(([url]) => url === '/api/muse-inquiries/board')).toHaveLength(2));
    expect(content.hidden).toBe(false);
    expect(cases.dataset.view).toBe('panel');
    expect(panel.getAttribute('aria-pressed')).toBe('true');
    list.click();
    expect(cases.dataset.view).toBe('list');
    expect(list.getAttribute('aria-pressed')).toBe('true');
    expect(titles()).toEqual(original);
  });

  it('ケースのパネルに提案数・問い合わせ数・未解決の論点・所要時間を出し、ケースで絞り込める', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    const summary = document.querySelector(`[data-case-summary="${CASE_ID}"]`)!;
    expect(summary.textContent).toContain('<img src=x onerror=alert(1)>キューを読む');
    expect(summary.querySelector('img')).toBeNull();
    expect(summary.textContent).toContain('提案 1');
    expect(summary.textContent).toContain('問い合わせ 2');
    expect(summary.textContent).toContain('未解決 1');
    expect(summary.textContent).toContain('5分13秒');
    const filter = document.getElementById('inq-case-filter') as unknown as HTMLSelectElement;
    filter.value = CASE_ID;
    filter.dispatchEvent(new Event('change'));
    expect(document.querySelector('[data-phase="inquiry"] [data-field="count"]')!.textContent).toBe('1');
    expect(document.querySelectorAll('[data-phase="inquiry"] [data-panel]')).toHaveLength(1);
  });

  it('協議のパネルから詳細モーダルを最上位で開き、質問と回答の全文を文字として表示する', async () => {
    const fetchJson = api();
    await script.initMuseInquiriesPage({ document, fetchJson });
    (document.querySelector('[data-phase="inquiry"] [data-panel]') as HTMLElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    expect(fetchJson).toHaveBeenCalledWith('/api/muse-inquiries/cases/' + CASE_ID);
    expect(Number(modal().style.zIndex)).toBeGreaterThan(0);
    await vi.waitFor(() => expect(modal().textContent).toContain('質問2'));
    expect(modal().textContent).toContain('<script>bad()</script>回答2');
    expect(modal().querySelector('script')).toBeNull();
    expect(modal().textContent).toContain('2分25秒');
    (document.getElementById('inq-modal-close') as HTMLButtonElement).click();
    expect(modal().hidden).toBe(true);
  });

  it('提案のパネルからは提案の詳細を開き、発端の問い合わせへ移れる。ケースのパネルからはケース全体を開く', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    (document.querySelector('[data-phase="proposed"] [data-panel]') as HTMLElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    expect(modal().textContent).toContain('renameで排他');
    expect(modal().textContent).toContain('利用者が決める');
    (modal().querySelector('[data-action="open-entry"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().textContent).toContain('質問2'));
    (document.getElementById('inq-modal-close') as HTMLButtonElement).click();
    (document.querySelector(`[data-case-summary="${CASE_ID}"]`) as HTMLElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    expect(modal().textContent).toContain('質問1');
    expect(modal().textContent).toContain('排他が無い');
    expect(modal().textContent).toContain('renameで排他');
  });

  it('詳細のMarkdownを見出し・表・リスト・コードとして表示し、生HTMLと危険なリンクを実行しない', async () => {
    const answer = ['# 設計', '', '**重要**', '', '- 永続化', '- 再試行', '', '| 項目 | 方針 |', '|---|---|', '| 保存 | D1 |', '', '```sql', 'SELECT 1;', '<script>bad()</script>', '```', '', '[資料](https://example.com/docs)', '[危険](javascript:alert(1))', '<img src=x onerror=bad()>'].join('\n');
    const detail = { ...DETAIL, entries: DETAIL.entries.map((e) => e.seq === 2 ? { ...e, answer } : e) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async (url: string) => url === '/api/muse-inquiries/board' ? BOARD : detail) });
    (document.querySelector('[data-phase="inquiry"] [data-panel]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().querySelector('.inq-markdown h1')?.textContent).toBe('設計'));
    expect(modal().querySelector('.inq-markdown strong')?.textContent).toBe('重要');
    expect(modal().querySelectorAll('.inq-markdown li')).toHaveLength(2);
    expect(modal().querySelector('.inq-markdown td')?.textContent).toBe('保存');
    expect(modal().querySelector('.inq-markdown pre code')?.textContent).toContain('SELECT 1;');
    expect(modal().querySelector('.inq-markdown pre code')?.textContent).toContain('<script>bad()</script>');
    expect(modal().querySelector('script, img, [onerror]')).toBeNull();
    expect(modal().querySelector('a[href^="javascript:"]')).toBeNull();
    expect(modal().querySelector('a[href="https://example.com/docs"]')?.getAttribute('rel')).toContain('noopener');
  });

  it('提案の直接表示とケース全体表示でもMarkdownを表示する', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'proposed' ? { ...p, panels: [{ ...p.panels[0], title: '## 提案見出し', reason: '**理由**' }] } : p) };
    const detail = { ...DETAIL, proposals: [{ ...DETAIL.proposals[0], text: '## ケース内の提案' }], keys: [{ ...DETAIL.keys[0], text: '**論点**' }] };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async (url: string) => url === '/api/muse-inquiries/board' ? board : detail) });
    (document.querySelector('[data-phase="proposed"] [data-panel]') as HTMLButtonElement).click();
    expect(modal().querySelector('.inq-markdown h2')?.textContent).toBe('提案見出し');
    expect(modal().querySelector('.inq-markdown strong')?.textContent).toBe('理由');
    (document.querySelector('[data-case-summary]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().querySelector('.inq-markdown h2')?.textContent).toBe('ケース内の提案'));
    expect(modal().querySelector('.inq-markdown strong')?.textContent).toBe('論点');
  });

  it('提案者別に全提案・協議中・完了を集計し、表記揺れと同一IDの二重計上を防ぐ', async () => {
    const proposal = BOARD.phases.find((p) => p.key === 'proposed')!.panels[0];
    const board = { ...BOARD, phases: BOARD.phases.map((p) => {
      if (p.key === 'proposed') return { ...p, panels: [proposal, proposal, { ...proposal, id: 'p-alias', proposedBy: ' Muse ', caseId: 'nix-packages-20261107' }] };
      if (p.key === 'adopted') return { ...p, panels: [{ ...proposal, id: 'p-active', status: 'adopted', proposedBy: 'Muse' }] };
      if (p.key === 'done') return { ...p, panels: [{ ...proposal, id: 'p-finished', status: 'done', proposedBy: 'codex' }] };
      if (p.key === 'rejected') return { ...p, panels: [{ ...proposal, id: 'p-unknown', status: 'rejected', proposedBy: '' }] };
      return p;
    }) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    const counts = (name: string) => {
      const card = [...document.querySelectorAll('[data-proposer]')].find((e) => e.getAttribute('data-proposer') === name)!;
      return [...card.querySelectorAll('[data-proposer-count]')].map((e) => e.textContent);
    };
    expect(document.querySelectorAll('[data-proposer]')).toHaveLength(3);
    expect(counts('Muse')).toEqual(['3', '1', '0']);
    expect(counts('Codex')).toEqual(['1', '0', '1']);
    expect(counts('提案者未設定')).toEqual(['1', '0', '1']);
    expect([...document.querySelectorAll('[data-proposer="Muse"] [data-proposer-label]')].map((e) => e.textContent)).toEqual(['提案', '協議中', '完了']);
    const filter = document.getElementById('inq-case-filter') as HTMLSelectElement;
    filter.value = CASE_ID; filter.dispatchEvent(new Event('change'));
    expect(counts('Muse')).toEqual(['2', '1', '0']);
    (document.querySelector('[data-status-filter="done"]') as HTMLButtonElement).click();
    expect(counts('Muse')).toEqual(['2', '1', '0']);
  });

  // ユーザー指定(2026-11-08): 採否待ちの提案を見つけやすくする。枠を点滅させる。
  it('採否待ちの提案のカードだけに点滅の印を付け、採用・完了・不採用の提案や問い合わせ・論点には付けない', async () => {
    const decided = (id: string, status: string) => ({ type: 'proposal', caseId: CASE_ID, id, title: id, status, reason: null, proposedBy: 'codex', entryId: null });
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'adopted' ? { ...p, panels: [decided('pa', 'adopted')] }
      : p.key === 'done' ? { ...p, panels: [decided('pd', 'done')] } : p.key === 'rejected' ? { ...p, panels: [decided('pr', 'rejected')] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    const pending = [...document.querySelectorAll('#inq-board .inq-panel-pending')];
    expect(pending.map((card) => card.getAttribute('data-card-key'))).toEqual(['proposal:' + CASE_ID + ':p1']);
    expect(pending[0].getAttribute('data-attention')).toBe('pending');
    for (const id of ['pa', 'pd', 'pr']) {
      expect(document.querySelector(`[data-card-key="proposal:${CASE_ID}:${id}"]`)!.classList.contains('inq-panel-pending')).toBe(false);
    }
    expect(document.querySelector('#inq-board [data-panel="entry"].inq-panel-pending, #inq-board [data-panel="key"].inq-panel-pending')).toBeNull();
    (document.querySelector('[data-status-filter="pending"]') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#inq-board .inq-panel-pending')).toHaveLength(1);
  });

  it('提案がない場合は提案者別の空状態を示す', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => ({ ...p, panels: p.panels.filter((panel) => panel.type !== 'proposal') })) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board) });
    expect(document.querySelectorAll('[data-proposer]')).toHaveLength(0);
    expect(document.getElementById('inq-proposers')!.textContent).toContain('提案はまだありません');
  });

  it('取得に失敗したら理由を表示し、空にしない', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => { throw new Error('HTTP 503'); }) });
    expect(document.getElementById('inq-notice')!.textContent).toContain('HTTP 503');
    expect(document.getElementById('inq-notice')!.hidden).toBe(false);
  });
});

// ユーザー指定(2026-11-08): カンバンの変更が即座に反映されない。Codexの案(bar-p1、board-auto-refresh-20261108)で周期取得にする。
// 取得が終わってから次を予約し、古い応答で上書きせず、裏のタブでは止め、詳細を開いている間は描き直さず「更新あり」を出し、失敗したら間隔を延ばす。
describe('Museとの協議のカンバン: 自動の読み直し', () => {
  beforeEach(() => { sessionStorage.clear(); loadBody(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  function timers() {
    const queue: Array<{ fn: () => void; ms: number }> = [];
    return { queue, setTimeout: (fn: () => void, ms: number) => { queue.push({ fn, ms }); return queue.length; }, clearTimeout: () => {} };
  }
  const board2 = { ...BOARD, cases: [{ ...BOARD.cases[0], goal: '更新後の目的' }, BOARD.cases[1]] };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('読み込みが終わってから30秒後に次を予約し、届いた新しい一覧で描き直す', async () => {
    const t = timers();
    let n = 0;
    const fetchJson = vi.fn(async (url: string) => (url === '/api/muse-inquiries/board' ? (n++ === 0 ? BOARD : board2) : DETAIL));
    await script.initMuseInquiriesPage({ document, fetchJson, setTimeout: t.setTimeout, clearTimeout: t.clearTimeout });
    expect(t.queue.at(-1)!.ms).toBe(30000);
    t.queue.at(-1)!.fn(); await flush(); await flush();
    expect(document.getElementById('inq-cases')!.textContent).toContain('更新後の目的');
    expect(t.queue.at(-1)!.ms).toBe(30000);
  });

  it('後から届いた古い応答で、新しい一覧を上書きしない', async () => {
    const t = timers();
    const resolvers: Array<(v: unknown) => void> = [];
    let first = true;
    const fetchJson = vi.fn((url: string) => {
      if (url !== '/api/muse-inquiries/board') return Promise.resolve(DETAIL);
      if (first) { first = false; return Promise.resolve(BOARD); }
      return new Promise((r) => resolvers.push(r));
    });
    await script.initMuseInquiriesPage({ document, fetchJson, setTimeout: t.setTimeout, clearTimeout: t.clearTimeout });
    (document.getElementById('inq-refresh') as HTMLButtonElement).click();
    (document.getElementById('inq-refresh') as HTMLButtonElement).click();
    resolvers[1](board2); await flush();
    resolvers[0](BOARD); await flush();
    expect(document.getElementById('inq-cases')!.textContent).toContain('更新後の目的');
  });

  it('タブが裏にある間は取得せず、表に戻ったら1回読み直す', async () => {
    const t = timers();
    const fetchJson = vi.fn(async (url: string) => (url === '/api/muse-inquiries/board' ? BOARD : DETAIL));
    await script.initMuseInquiriesPage({ document, fetchJson, setTimeout: t.setTimeout, clearTimeout: t.clearTimeout });
    const boardCalls = () => fetchJson.mock.calls.filter((c) => c[0] === '/api/muse-inquiries/board').length;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    t.queue.at(-1)!.fn(); await flush();
    expect(boardCalls()).toBe(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange')); await flush();
    expect(boardCalls()).toBe(2);
  });

  it('詳細を開いている間は描き直さず「更新あり」を出し、閉じたら反映する', async () => {
    const t = timers();
    let n = 0;
    const fetchJson = vi.fn(async (url: string) => (url === '/api/muse-inquiries/board' ? (n++ === 0 ? BOARD : board2) : DETAIL));
    await script.initMuseInquiriesPage({ document, fetchJson, setTimeout: t.setTimeout, clearTimeout: t.clearTimeout });
    (document.querySelector('[data-case-summary="' + CASE_ID + '"]') as HTMLElement).click();
    await flush();
    t.queue.at(-1)!.fn(); await flush(); await flush();
    expect(document.getElementById('inq-cases')!.textContent).not.toContain('更新後の目的');
    expect(document.getElementById('inq-notice')!.textContent).toContain('更新あり');
    (document.getElementById('inq-modal-close') as HTMLButtonElement).click(); await flush();
    expect(document.getElementById('inq-cases')!.textContent).toContain('更新後の目的');
  });

  it('取得に失敗したら間隔を倍にし、上限は5分', async () => {
    const t = timers();
    let n = 0;
    const fetchJson = vi.fn(async (url: string) => { if (url === '/api/muse-inquiries/board' && n++ > 0) throw new Error('503'); return url === '/api/muse-inquiries/board' ? BOARD : DETAIL; });
    await script.initMuseInquiriesPage({ document, fetchJson, setTimeout: t.setTimeout, clearTimeout: t.clearTimeout });
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) { t.queue.at(-1)!.fn(); await flush(); await flush(); seen.push(t.queue.at(-1)!.ms); }
    expect(seen).toEqual([60000, 120000, 240000, 300000, 300000, 300000]);
  });
});

describe('Museとの協議のカンバン: ページとルート', () => {
  beforeEach(() => { sessionStorage.clear(); loadBody(); });
  it('生成HTMLの全scriptがnode --checkに通り、上部の帯は高さ44pxで固定', () => {
    const html = getMuseInquiriesPage();
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(() => execFileSync(process.execPath, ['--check'], { input: s })).not.toThrow();
    expect(html).toMatch(/\.inq-nav \{[^}]*position: sticky; top: 0;[^}]*height: 44px;/);
  });
  it('採否待ちの印は外枠をテーマの色で点滅させ、動きを減らす設定では点滅をやめて太い枠だけにする', () => {
    const html = getMuseInquiriesPage();
    expect(html).toMatch(/\.inq-panel-pending \{[^}]*animation: inq-pending-blink [^;]*infinite;/);
    expect(html).toMatch(/@keyframes inq-pending-blink \{[^@]*var\(--accent-color\)/);
    expect(html).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.inq-panel-pending \{[^}]*animation: none;[^}]*var\(--accent-color\)/);
    const rules = html.match(/\.inq-panel-pending \{[^}]*\}|@keyframes inq-pending-blink \{[\s\S]*?\}\s*\}/g) ?? [];
    for (const rule of rules) expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
  // ユーザー指定(2026-11-08): 議題を段階(構想・計画・実装・試験運用)で区別する。
  it('ケースの一覧と詳細に段階を出し、未設定は「段階未設定」と出す', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    const stage = (id: string) => document.querySelector(`[data-case-summary="${id}"] [data-case-stage]`);
    expect(stage(CASE_ID)!.textContent).toBe('計画');
    expect(stage(CASE_ID)!.getAttribute('data-case-stage')).toBe('plan');
    expect(stage('nix-packages-20261107')!.textContent).toBe('段階未設定');
    (document.querySelector(`[data-case-summary="${CASE_ID}"]`) as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().textContent).toContain(CASE_ID + ' / 協議中 / 計画 / 開始'));
  });

  // ユーザー指定(2026-11-08): 採否待ちの提案のモーダルから、その場で採用・不採用を伝える。
  it('採否待ちの提案のモーダルに採用・不採用のボタンを出し、押すと記録して一覧を読み直す', async () => {
    const fetchJson = api();
    const postJson = vi.fn(async () => ({ ok: true, status: 'adopted' }));
    await script.initMuseInquiriesPage({ document, fetchJson, postJson });
    (document.querySelector('#inq-board [data-panel="proposal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    expect(modal().textContent).toContain('実行は始めません');
    (modal().querySelector('[data-field="decision-note"]') as HTMLTextAreaElement).value = 'これで進める';
    (modal().querySelector('[data-action="decide-adopted"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().querySelector('[data-field="decision-result"]')!.textContent).toBe('採用として記録しました'));
    expect(postJson).toHaveBeenCalledWith('/api/muse-inquiries/proposals/p1/decision', { decision: 'adopted', note: 'これで進める' });
    expect(fetchJson.mock.calls.filter((c) => c[0] === '/api/muse-inquiries/board').length).toBe(2);
    expect(modal().querySelector('[data-action="decide-adopted"]')).toBeNull();
  });
  // ユーザー指定(2026-11-14): 採決したらウィンドウを閉じる。採決して消えたパネルが、再読み込みで採否待ちに戻らないようにする。
  it('採決に成功したらモーダルを閉じ、読み直しが古い採否待ちを返しても採用の列に置く', async () => {
    sessionStorage.clear();
    const fetchJson = api();
    const postJson = vi.fn(async () => ({ ok: true, status: 'adopted' }));
    await script.initMuseInquiriesPage({ document, fetchJson, postJson });
    (document.querySelector('#inq-board [data-panel="proposal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    (modal().querySelector('[data-action="decide-adopted"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(true));
    await vi.waitFor(() => expect(fetchJson.mock.calls.filter((c) => c[0] === '/api/muse-inquiries/board').length).toBe(2));
    const card = () => document.querySelector('#inq-board [data-card-key="proposal:' + CASE_ID + ':p1"]') as HTMLElement;
    await vi.waitFor(() => expect(card().closest('[data-phase]')!.getAttribute('data-phase')).toBe('adopted'));
    expect(document.querySelector('#inq-board [data-phase="proposed"] [data-card-key="proposal:' + CASE_ID + ':p1"]')).toBeNull();
  });
  it('再読み込みしても、直近に採決した提案を古い採否待ちに戻さない。サーバーが採否を返したら覚えた分を消す', async () => {
    sessionStorage.clear();
    const postJson = vi.fn(async () => ({ ok: true, status: 'rejected' }));
    await script.initMuseInquiriesPage({ document, fetchJson: api(), postJson });
    (document.querySelector('#inq-board [data-panel="proposal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    (modal().querySelector('[data-action="decide-rejected"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(true));
    // 再読み込み: ページを作り直し、サーバーはまだ古い採否待ちを返す
    loadBody();
    await script.initMuseInquiriesPage({ document, fetchJson: api(), postJson: vi.fn() });
    const phaseOf = () => document.querySelector('#inq-board [data-card-key="proposal:' + CASE_ID + ':p1"]')!.closest('[data-phase]')!.getAttribute('data-phase');
    expect(phaseOf()).toBe('rejected');
    expect(document.querySelector('#inq-board [data-card-key="proposal:' + CASE_ID + ':p1"] [data-pending-mark]')).toBeNull();
    // サーバーが不採用を返すようになったら、覚えた分は消える
    const settled = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'proposed' ? { ...p, panels: [] } : p.key === 'rejected' ? { ...p, panels: [{ ...BOARD.phases[2].panels[0], status: 'rejected' }] } : p) };
    loadBody();
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => settled), postJson: vi.fn() });
    expect(phaseOf()).toBe('rejected');
    expect(sessionStorage.getItem('inq_recent_decisions') || '{}').toBe('{}');
  });
  it('記録に失敗したら理由を出し、ボタンを押せる状態に戻す', async () => {
    const postJson = vi.fn(async () => { throw new Error('この提案はもう採否待ちではありません'); });
    await script.initMuseInquiriesPage({ document, fetchJson: api(), postJson });
    (document.querySelector('#inq-board [data-panel="proposal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    (modal().querySelector('[data-action="decide-rejected"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().querySelector('[data-field="decision-result"]')!.textContent).toContain('記録できませんでした: この提案はもう採否待ちではありません'));
    expect((modal().querySelector('[data-action="decide-rejected"]') as HTMLButtonElement).disabled).toBe(false);
    expect(postJson).toHaveBeenCalledWith('/api/muse-inquiries/proposals/p1/decision', { decision: 'rejected', note: '' });
  });

  // ユーザー指定(2026-11-14): 採否の判断材料(利点・副作用・破壊的変更・元に戻せるか)をテンプレートとして見られるようにする。
  it('提案のモーダルに「採否の判断材料」を出し、利点・副作用・破壊的変更・元に戻せるかを色付きで、未記入は「未記入」と出す', async () => {
    const withAssessment = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'proposed' ? { ...p, panels: [{ ...p.panels[0], benefits: '採決の手間が減る', sideEffects: '表が1つ増える', breakingChange: 'yes', reversible: null }] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => withAssessment), postJson: vi.fn() });
    (document.querySelector('#inq-board [data-panel="proposal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    const box = modal().querySelector('[data-field="assessment"]') as HTMLElement;
    expect(box.textContent).toContain('採否の判断材料');
    expect(box.querySelector('[data-assessment="benefits"]')!.textContent).toContain('採決の手間が減る');
    expect(box.querySelector('[data-assessment="side-effects"]')!.textContent).toContain('表が1つ増える');
    const breaking = box.querySelector('[data-assessment="breaking-change"]') as HTMLElement;
    expect(breaking.textContent).toContain('あり');
    expect(breaking.getAttribute('data-level')).toBe('danger');
    const reversible = box.querySelector('[data-assessment="reversible"]') as HTMLElement;
    expect(reversible.textContent).toContain('未記入');
    expect(reversible.getAttribute('data-level')).toBe('unset');
  });
  it('破壊的変更が「あり」「ありうる」の提案はカードに印を付け、「なし」や未記入には付けない', async () => {
    const mk = (id: string, breakingChange: string | null) => ({ ...BOARD.phases[2].panels[0], id, breakingChange });
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'proposed' ? { ...p, panels: [mk('b-yes', 'yes'), mk('b-possible', 'possible'), mk('b-none', 'none'), mk('b-unset', null)] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board), postJson: vi.fn() });
    const mark = (id: string) => document.querySelector(`#inq-board [data-card-key="proposal:${CASE_ID}:${id}"] [data-breaking-mark]`);
    expect(mark('b-yes')!.textContent).toContain('破壊的変更');
    expect(mark('b-possible')!.textContent).toContain('破壊的変更');
    expect(mark('b-none')).toBeNull();
    expect(mark('b-unset')).toBeNull();
  });
  it('採否待ちでない提案にはボタンを出さない', async () => {
    const board = { ...BOARD, phases: BOARD.phases.map((p) => p.key === 'adopted' ? { ...p, panels: [{ ...BOARD.phases[2].panels[0], id: 'p9', status: 'adopted' }] } : p) };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => board), postJson: vi.fn() });
    (document.querySelector('#inq-board [data-card-key="proposal:' + CASE_ID + ':p9"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().hidden).toBe(false));
    expect(modal().querySelector('[data-action^="decide-"]')).toBeNull();
  });

  // ユーザー指定(2026-11-08): 利用者(user)の表示名は「🙄 User」にする。
  it('提案者・問い合わせの相手と依頼者がuserなら「🙄 User」と表示する', async () => {
    const proposal = BOARD.phases.find((p) => p.key === 'proposed')!.panels[0];
    const entry = BOARD.phases[0].panels[0];
    const board = { ...BOARD, phases: BOARD.phases.map((p) => {
      if (p.key === 'proposed') return { ...p, panels: [{ ...proposal, proposedBy: 'user' }] };
      if (p.key === 'inquiry') return { ...p, panels: [{ ...entry, agent: 'User' }] };
      return p;
    }) };
    const detail = { ...DETAIL, entries: [{ ...DETAIL.entries[1], agent: 'user', askedBy: 'user' }] };
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async (url: string) => (url === '/api/muse-inquiries/board' ? board : detail)) });
    const proposer = [...document.querySelectorAll('[data-proposer]')].find((e) => e.getAttribute('data-proposer') === '🙄 User');
    expect(proposer?.querySelector('h3')?.textContent).toBe('🙄 User');
    const card = document.querySelector('#inq-board [data-panel="entry"]')!;
    expect(card.textContent).toContain('#2 🙄 User / 所要');
    (document.querySelector('#inq-board [data-panel="proposal"]') as HTMLButtonElement).click();
    expect(modal().textContent).toContain('提案者🙄 User');
    (card as HTMLButtonElement).click();
    await vi.waitFor(() => expect(modal().textContent).toContain('#2 🙄 User / 🙄 User / '));
  });

  // ユーザー指定(2026-11-08): 俯瞰モードではボードを画面の幅いっぱいに収め、通常モードは列の幅を保って横スクロールにする。
  it('ボードの表示を通常と俯瞰で切り替える。既定は通常', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    const boardEl = document.getElementById('inq-board')!;
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-board-layout]')];
    expect(buttons.map((b) => [b.getAttribute('data-board-layout'), b.textContent, b.getAttribute('aria-pressed')])).toEqual([['normal', '通常', 'true'], ['overview', '俯瞰', 'false']]);
    expect(boardEl.getAttribute('data-layout')).toBe('normal');
    buttons[1].click();
    expect(boardEl.getAttribute('data-layout')).toBe('overview');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    (document.querySelector('[data-status-filter="pending"]') as HTMLButtonElement).click();
    expect(boardEl.getAttribute('data-layout')).toBe('overview');
    buttons[0].click();
    expect(boardEl.getAttribute('data-layout')).toBe('normal');
  });
  // ユーザー指定(2026-11-08): 通常・俯瞰の選択をCookieで保ち、開き直しても同じ表示にする。
  it('通常・俯瞰の選択をCookieに保存し、開き直すとその表示で始まる。知らない値は通常に戻す', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    (document.querySelector('[data-board-layout="overview"]') as HTMLButtonElement).click();
    expect(document.cookie).toContain(LAYOUT_COOKIE + '=overview');
    document.body.innerHTML = '';
    const html = getMuseInquiriesPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>', html.indexOf('<body>')));
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    expect(document.getElementById('inq-board')!.getAttribute('data-layout')).toBe('overview');
    expect([...document.querySelectorAll('[data-board-layout]')].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    (document.querySelector('[data-board-layout="normal"]') as HTMLButtonElement).click();
    expect(document.cookie).toContain(LAYOUT_COOKIE + '=normal');
    loadBody();
    document.cookie = LAYOUT_COOKIE + '=<b>; Path=/muse-inquiries; Secure';
    await script.initMuseInquiriesPage({ document, fetchJson: api() });
    expect(document.getElementById('inq-board')!.getAttribute('data-layout')).toBe('normal');
    expect([...document.querySelectorAll('[data-board-layout]')].map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });
  it('レイアウトのCookieはテーマと同じくSecure・SameSite=Lax・1年で、Pathをこのページに絞る', () => {
    expect(MUSE_INQUIRIES_SCRIPT).toContain("'; Path=/muse-inquiries; Secure; SameSite=Lax; Max-Age=31536000'");
  });

  it('通常は列の最小幅を保って横スクロール、俯瞰は列を画面の幅に収めて横スクロールしない', () => {
    const html = getMuseInquiriesPage();
    expect(html).toMatch(/\.inq-board \{[^}]*grid-auto-columns: minmax\(260px, 1fr\);[^}]*overflow-x: auto;/);
    expect(html).toMatch(/\.inq-board\[data-layout="overview"\] \{[^}]*grid-auto-columns: minmax\(0, 1fr\);[^}]*overflow-x: visible;/);
  });

  it('管理者だけが見られ、INQUIRY_DBのバインディングで読む', () => {
    const index = readFileSync('src/index.ts', 'utf8');
    expect(index).toContain("app.get('/muse-inquiries', authMiddleware, cfDashboardAdminMiddleware,");
    expect(index).toContain("app.get('/api/muse-inquiries/board', authMiddleware, cfDashboardAdminMiddleware,");
    expect(index).toContain("app.get('/api/muse-inquiries/cases/:caseId', authMiddleware, cfDashboardAdminMiddleware,");
    // 採否の記録は管理者だけ、同じオリジンからだけ受け付ける(2026-11-08)。
    const route = index.slice(index.indexOf("app.post('/api/muse-inquiries/proposals/:proposalId/decision', authMiddleware, cfDashboardAdminMiddleware,"));
    expect(route.length).toBeGreaterThan(0);
    expect(route.slice(0, 600)).toContain("c.req.header('Origin') !== new URL(c.req.url).origin");
    const toml = readFileSync('wrangler.toml', 'utf8');
    expect(toml).toMatch(/\[\[d1_databases\]\]\nbinding = "INQUIRY_DB"\ndatabase_name = "agent-inquiries"\ndatabase_id = "ab65ff96-6333-4673-9ad4-4324be622184"/);
    expect(readFileSync('src/types.ts', 'utf8')).toContain('INQUIRY_DB?: D1Database;');
  });
});
