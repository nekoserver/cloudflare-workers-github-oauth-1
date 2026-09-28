import { describe, expect, it } from 'vitest';
import { isDeclaredLogicalFkRelation } from './index';

describe('FK検証で許可する論理FK', () => {
  it('宣言済みの同名カラム関係を許可する', () => {
    expect(isDeclaredLogicalFkRelation(
      'team_members',
      'user_id',
      'user_sessions',
      'user_id',
    )).toBe(true);
  });

  it('参照先カラムを上書きした関係を許可する', () => {
    expect(isDeclaredLogicalFkRelation(
      'commit_calendar_cache',
      'workspace_id',
      'workspaces',
      'id',
    )).toBe(true);
  });

  it('未宣言の関係や誤った参照先カラムを拒否する', () => {
    expect(isDeclaredLogicalFkRelation(
      'user_sessions',
      'user_id',
      'ai_summary_log',
      'request_id',
    )).toBe(false);
    expect(isDeclaredLogicalFkRelation(
      'commit_calendar_cache',
      'workspace_id',
      'workspaces',
      'workspace_id',
    )).toBe(false);
  });
});
