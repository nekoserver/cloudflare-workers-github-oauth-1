/**
 * チーム・ワークスペース管理ユーティリティ
 * ログイン時にデフォルトチーム＋ワークスペースを自動プロビジョニングし、
 * データのネームスペース分離を担保する
 */
import * as logger from './logger';

export interface WorkspaceInfo {
  workspaceId: string;
  workspaceName: string;
  teamId: string;
  teamName: string;
}

/**
 * ユーザーの現在のワークスペースを取得する
 * current_workspace_id が設定されていない場合は null を返す
 */
export async function getCurrentWorkspace(
  db: D1Database,
  userId: string
): Promise<WorkspaceInfo | null> {
  try {
    const row = await db.prepare(`
      SELECT w.id AS workspace_id, w.name AS workspace_name,
             t.id AS team_id, t.name AS team_name
      FROM user_sessions us
      JOIN workspaces w ON us.current_workspace_id = w.id
      JOIN teams t ON w.team_id = t.id
      WHERE us.user_id = ? AND us.current_workspace_id IS NOT NULL
    `).bind(userId).first<{
      workspace_id: string;
      workspace_name: string;
      team_id: string;
      team_name: string;
    }>();

    if (!row) return null;

    return {
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      teamId: row.team_id,
      teamName: row.team_name,
    };
  } catch (error) {
    logger.warn('Failed to get current workspace', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * ユーザーが所属する全ワークスペースを取得する
 */
export async function getUserWorkspaces(
  db: D1Database,
  userId: string
): Promise<WorkspaceInfo[]> {
  try {
    const rows = await db.prepare(`
      SELECT w.id AS workspace_id, w.name AS workspace_name,
             t.id AS team_id, t.name AS team_name
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN workspaces w ON w.team_id = t.id
      WHERE tm.user_id = ?
      ORDER BY t.created_at, w.created_at
    `).bind(userId).all<{
      workspace_id: string;
      workspace_name: string;
      team_id: string;
      team_name: string;
    }>();

    return (rows.results ?? []).map(r => ({
      workspaceId: r.workspace_id,
      workspaceName: r.workspace_name,
      teamId: r.team_id,
      teamName: r.team_name,
    }));
  } catch (error) {
    logger.warn('Failed to get user workspaces', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * ユーザーのデフォルトチーム＋ワークスペースを自動プロビジョニングする
 * すでに所属チームがある場合は何もしない
 *
 * @returns プロビジョニングされた（または既存の）ワークスペースID
 */
export async function ensureDefaultWorkspace(
  db: D1Database,
  userId: string
): Promise<string | null> {
  try {
    // すでにチームに所属しているか確認
    const existing = await db.prepare(
      'SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1'
    ).bind(userId).first<{ team_id: string }>();

    if (existing) {
      // すでにチームに所属している → 既存のワークスペースを返す
      const ws = await db.prepare(
        'SELECT id FROM workspaces WHERE team_id = ? ORDER BY created_at LIMIT 1'
      ).bind(existing.team_id).first<{ id: string }>();

      if (ws) {
        // current_workspace_id が未設定なら設定する
        await db.prepare(
          'UPDATE user_sessions SET current_workspace_id = COALESCE(current_workspace_id, ?) WHERE user_id = ?'
        ).bind(ws.id, userId).run();
        return ws.id;
      }
    }

    const now = new Date().toISOString();
    const teamId = generateId('team');
    const workspaceId = generateId('ws');

    // チーム作成
    await db.prepare(
      'INSERT INTO teams (id, name, created_at) VALUES (?, ?, ?)'
    ).bind(teamId, `${userId}`, now).run();

    // ワークスペース作成
    await db.prepare(
      'INSERT INTO workspaces (id, team_id, name, created_at) VALUES (?, ?, ?, ?)'
    ).bind(workspaceId, teamId, 'default', now).run();

    // チームメンバーとして追加
    await db.prepare(
      'INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).bind(teamId, userId, 'owner', now).run();

    // current_workspace_id を設定
    await db.prepare(
      'UPDATE user_sessions SET current_workspace_id = ? WHERE user_id = ?'
    ).bind(workspaceId, userId).run();

    logger.info('Provisioned default team and workspace', {
      userId,
      teamId,
      workspaceId,
    });

    return workspaceId;
  } catch (error) {
    logger.error('Failed to provision default workspace', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * ワークスペースを切り替える
 * 対象ワークスペースにユーザーがアクセス権を持っているか検証する
 */
export async function switchWorkspace(
  db: D1Database,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  try {
    // ユーザーがこのワークスペースにアクセスできるか確認
    const access = await db.prepare(`
      SELECT 1 FROM workspaces w
      JOIN team_members tm ON tm.team_id = w.team_id
      WHERE w.id = ? AND tm.user_id = ?
    `).bind(workspaceId, userId).first();

    if (!access) {
      logger.warn('Workspace access denied', { userId, workspaceId });
      return false;
    }

    await db.prepare(
      'UPDATE user_sessions SET current_workspace_id = ? WHERE user_id = ?'
    ).bind(workspaceId, userId).run();

    return true;
  } catch (error) {
    logger.error('Failed to switch workspace', {
      userId,
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * 短いランダムIDを生成する（プレフィックス付き）
 */
function generateId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}
