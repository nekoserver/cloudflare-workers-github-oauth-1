import { describe, it, expect } from 'vitest';
import { buildPreviewQueryFromTemplate } from './index';

describe('buildPreviewQueryFromTemplate', () => {
  it('{USER_ID} を ? に展開してパラメータに追加する', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t WHERE user_id = {USER_ID} LIMIT 20',
      'user-abc',
      null,
      null,
    );
    expect(result.sql).toBe('SELECT * FROM t WHERE user_id = ? LIMIT 20');
    expect(result.params).toEqual(['user-abc']);
  });

  it('{WORKSPACE_ID} を ? に展開してパラメータに追加する', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t WHERE workspace_id = {WORKSPACE_ID} LIMIT 20',
      'user-abc',
      'ws-xyz',
      null,
    );
    expect(result.sql).toBe('SELECT * FROM t WHERE workspace_id = ? LIMIT 20');
    expect(result.params).toEqual(['ws-xyz']);
  });

  it('{TEAM_ID} を ? に展開してパラメータに追加する', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t WHERE id = {TEAM_ID} LIMIT 20',
      'user-abc',
      null,
      'team-123',
    );
    expect(result.sql).toBe('SELECT * FROM t WHERE id = ? LIMIT 20');
    expect(result.params).toEqual(['team-123']);
  });

  it('複数プレースホルダーを出現順にパラメータへ追加する', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t WHERE ws = {WORKSPACE_ID} OR owner = {USER_ID} LIMIT 20',
      'user-abc',
      'ws-xyz',
      null,
    );
    expect(result.sql).toBe('SELECT * FROM t WHERE ws = ? OR owner = ? LIMIT 20');
    expect(result.params).toEqual(['ws-xyz', 'user-abc']);
  });

  it('プレースホルダーがない場合はそのままの SQL を返す', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t ORDER BY id DESC LIMIT 20',
      'user-abc',
      null,
      null,
    );
    expect(result.sql).toBe('SELECT * FROM t ORDER BY id DESC LIMIT 20');
    expect(result.params).toEqual([]);
  });

  it('workspaceId が null の場合は空文字をパラメータに渡す', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t WHERE workspace_id = {WORKSPACE_ID} LIMIT 20',
      'user-abc',
      null,
      null,
    );
    expect(result.params).toEqual(['']);
  });

  it('teamId が null の場合は空文字をパラメータに渡す', () => {
    const result = buildPreviewQueryFromTemplate(
      'SELECT * FROM t WHERE team_id = {TEAM_ID} LIMIT 20',
      'user-abc',
      null,
      null,
    );
    expect(result.params).toEqual(['']);
  });
});
