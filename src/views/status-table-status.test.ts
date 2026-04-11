/**
 * /status テーブル一覧のステータス表示テスト
 *
 * CLAUDE.md ルール23 に基づき、3状態を厳密に区別することを保証する:
 *   OK（緑）: exists=true, rowCount=数値
 *   NG（赤背景）: exists=true, rowCount=null
 *   未作成（赤文字）: exists=false
 */
import { describe, it, expect } from 'vitest';
import { resolveTableStatus, renderTableStatusBadge, type TableStatusState } from './status';

describe('resolveTableStatus', () => {
  it('テーブル存在＋読出し成功 → ok', () => {
    expect(resolveTableStatus({ exists: true, rowCount: 42 })).toBe('ok');
  });

  it('テーブル存在＋行数0でも読出し成功 → ok', () => {
    expect(resolveTableStatus({ exists: true, rowCount: 0 })).toBe('ok');
  });

  it('テーブル存在＋読出し失敗(rowCount=null) → ng', () => {
    expect(resolveTableStatus({ exists: true, rowCount: null })).toBe('ng');
  });

  it('テーブル不在 → missing', () => {
    expect(resolveTableStatus({ exists: false, rowCount: null })).toBe('missing');
  });

  it('テーブル不在＋rowCount=null → missing（existsが優先）', () => {
    expect(resolveTableStatus({ exists: false, rowCount: null })).toBe('missing');
  });
});

describe('renderTableStatusBadge', () => {
  it('ok → status-ok クラスのspan、テキスト "OK"', () => {
    const html = renderTableStatusBadge('ok');
    expect(html).toContain('class="status-ok"');
    expect(html).toContain('OK');
    expect(html).not.toContain('NG');
    expect(html).not.toContain('未作成');
  });

  it('ng → status-ng クラスのspan、テキスト "NG"', () => {
    const html = renderTableStatusBadge('ng');
    expect(html).toContain('class="status-ng"');
    expect(html).toContain('NG');
    expect(html).not.toContain('status-ok');
  });

  it('missing → status-missing クラスのspan、テキスト "未作成"', () => {
    const html = renderTableStatusBadge('missing');
    expect(html).toContain('class="status-missing"');
    expect(html).toContain('未作成');
    expect(html).not.toContain('status-ok');
  });
});

describe('3状態の排他性', () => {
  const cases: { label: string; input: { exists: boolean; rowCount: number | null }; expected: TableStatusState }[] = [
    { label: 'exists=true, rowCount=100', input: { exists: true, rowCount: 100 }, expected: 'ok' },
    { label: 'exists=true, rowCount=0',   input: { exists: true, rowCount: 0 },   expected: 'ok' },
    { label: 'exists=true, rowCount=null', input: { exists: true, rowCount: null }, expected: 'ng' },
    { label: 'exists=false, rowCount=null', input: { exists: false, rowCount: null }, expected: 'missing' },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.expected}`, () => {
      const state = resolveTableStatus(c.input);
      expect(state).toBe(c.expected);

      const badge = renderTableStatusBadge(state);
      if (c.expected === 'ok') {
        expect(badge).toContain('status-ok');
        expect(badge).not.toContain('status-ng');
        expect(badge).not.toContain('status-missing');
      } else if (c.expected === 'ng') {
        expect(badge).toContain('status-ng');
        expect(badge).not.toContain('status-ok');
        expect(badge).not.toContain('status-missing');
      } else {
        expect(badge).toContain('status-missing');
        expect(badge).not.toContain('status-ok');
        expect(badge).not.toContain('status-ng');
      }
    });
  }
});
