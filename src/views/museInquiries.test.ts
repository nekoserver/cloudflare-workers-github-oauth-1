// @vitest-environment jsdom
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
    { id: CASE_ID, goal: '<img src=x onerror=alert(1)>キューを読む', status: 'open', entries: 2, openKeys: 1, blockingOpenKeys: 1, proposed: 1, durationSeconds: 313, lastAskedAt: '2026-11-07T20:30:00Z', createdAt: '2026-11-07T19:50:00Z', resolvedAt: null },
    { id: 'nix-packages-20261107', goal: 'Nixの一覧', status: 'resolved', entries: 20, openKeys: 0, blockingOpenKeys: 0, proposed: 0, durationSeconds: 2000, lastAskedAt: null, createdAt: '2026-11-07T01:00:00Z', resolvedAt: '2026-11-07T05:00:00Z' },
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

function loadBody() {
  const html = getMuseInquiriesPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>', html.indexOf('<body>')));
}
const api = () => vi.fn(async (url: string) => (url === '/api/muse-inquiries/board' ? BOARD : DETAIL));
const modal = () => document.getElementById('inq-modal')!;

describe('Museとの協議のカンバン', () => {
  beforeEach(loadBody);

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
    expect(['all', 'discussing', 'pending', 'done'].map((key) => button(key).querySelector('[data-filter-count]')?.textContent)).toEqual(['7', '4', '1', '1']);
    button('pending').click();
    expect(phases()).toEqual(['proposed']);
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(1);
    expect(button('pending').getAttribute('aria-pressed')).toBe('true');
    expect(button('all').getAttribute('aria-pressed')).toBe('false');
    button('pending').click();
    expect(phases()).toEqual(['proposed']);
    button('done').click();
    expect(phases()).toEqual(['done']);
    button('discussing').click();
    expect(phases()).toEqual(['inquiry', 'open-keys', 'adopted']);
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(4);
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
    expect(document.querySelectorAll('[data-phase]')).toHaveLength(1);
    filter.value = '';
    filter.dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('#inq-board [data-panel]')).toHaveLength(1);
    expect(button('pending').querySelector('[data-filter-count]')!.textContent).toBe('1');
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

  it('取得に失敗したら理由を表示し、空にしない', async () => {
    await script.initMuseInquiriesPage({ document, fetchJson: vi.fn(async () => { throw new Error('HTTP 503'); }) });
    expect(document.getElementById('inq-notice')!.textContent).toContain('HTTP 503');
    expect(document.getElementById('inq-notice')!.hidden).toBe(false);
  });
});

describe('Museとの協議のカンバン: ページとルート', () => {
  it('生成HTMLの全scriptがnode --checkに通り、上部の帯は高さ44pxで固定', () => {
    const html = getMuseInquiriesPage();
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(() => execFileSync(process.execPath, ['--check'], { input: s })).not.toThrow();
    expect(html).toMatch(/\.inq-nav \{[^}]*position: sticky; top: 0;[^}]*height: 44px;/);
  });
  it('管理者だけが見られ、INQUIRY_DBのバインディングで読む', () => {
    const index = readFileSync('src/index.ts', 'utf8');
    expect(index).toContain("app.get('/muse-inquiries', authMiddleware, cfDashboardAdminMiddleware,");
    expect(index).toContain("app.get('/api/muse-inquiries/board', authMiddleware, cfDashboardAdminMiddleware,");
    expect(index).toContain("app.get('/api/muse-inquiries/cases/:caseId', authMiddleware, cfDashboardAdminMiddleware,");
    const toml = readFileSync('wrangler.toml', 'utf8');
    expect(toml).toMatch(/\[\[d1_databases\]\]\nbinding = "INQUIRY_DB"\ndatabase_name = "agent-inquiries"\ndatabase_id = "ab65ff96-6333-4673-9ad4-4324be622184"/);
    expect(readFileSync('src/types.ts', 'utf8')).toContain('INQUIRY_DB?: D1Database;');
  });
});
