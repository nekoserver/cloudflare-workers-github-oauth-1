import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

interface CodexQuestionLog {
  has_keywords?: number; id: string; question: string; answer?: string; thread_id: string | null; created_at: string;
}
import { authMiddleware } from '../middleware/auth';
import { getCodexQuestionTreePage } from '../views/codexQuestionTree';
import { formatCodexAskgkQuestion } from '../utils/codexAskgkQuestion';

/** thread-trackerと共通の保存ログを読み取り専用で公開するサンプル。 */
export const codexQuestionTreeRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
codexQuestionTreeRoutes.get('/mcp-codex-tree', authMiddleware, c => c.html(getCodexQuestionTreePage()));
codexQuestionTreeRoutes.get('/api/mcp-sample/codex-questions', authMiddleware, async c => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return c.json({ error: 'Database unavailable' }, 503);
  const before = c.req.query('before');
  let cursor: { createdAt: string; id: string } | null = null;
  if (before !== undefined) {
    try {
      const value = JSON.parse(before);
      if (!value || typeof value.createdAt !== 'string' || !value.createdAt || value.createdAt.length > 64 || typeof value.id !== 'string' || !value.id || value.id.length > 256) throw new Error('Invalid cursor');
      cursor = value;
    } catch { return c.json({ error: 'Invalid cursor' }, 400); }
  }
  const rows = await c.env.DB.prepare(`SELECT id, thread_id, question, created_at,
    EXISTS (SELECT 1 FROM aichat_search_log k WHERE k.user_id = ai_chat_shares.user_id AND k.keyword <> '' AND instr(ai_chat_shares.answer, k.keyword) > 0) AS has_keywords FROM ai_chat_shares
    WHERE user_id = ? AND model = 'codex' AND deleted_at IS NULL ${cursor ? 'AND (created_at < ? OR (created_at = ? AND id < ?))' : ''}
    ORDER BY created_at DESC, id DESC LIMIT 101`).bind(c.get('user').sub, ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : [])).all<CodexQuestionLog>();
  const items = (rows.results || []).slice(0, 100).map((row) => ({ ...row, has_keywords: !!row.has_keywords, question: formatCodexAskgkQuestion(row.question || '') }));
  const last = items[items.length - 1];
  return c.json({ items, nextCursor: rows.results.length > 100 ? JSON.stringify({ createdAt: last.created_at, id: last.id }) : null });
});
codexQuestionTreeRoutes.get('/api/mcp-sample/codex-questions/:id', authMiddleware, async c => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return c.json({ error: 'Database unavailable' }, 503);
  const id = c.req.param('id');
  if (!id || id.length > 256) return c.json({ error: 'Invalid id' }, 400);
  const row = await c.env.DB.prepare("SELECT id, question, answer, thread_id, created_at FROM ai_chat_shares WHERE id = ? AND user_id = ? AND model = 'codex' AND deleted_at IS NULL").bind(id, c.get('user').sub).first<CodexQuestionLog>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ ...row, question: formatCodexAskgkQuestion(row.question || '') });
});

/** 本文に含まれる登録語を、本人の全AI回答での実出現回数順で返す。 */
codexQuestionTreeRoutes.get('/api/mcp-sample/codex-questions/:id/keywords', authMiddleware, async c => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return c.json({ error: 'Database unavailable' }, 503);
  const id = c.req.param('id');
  if (!id || id.length > 256) return c.json({ error: 'Invalid id' }, 400);
  const userId = c.get('user').sub;
  const row = await c.env.DB.prepare("SELECT answer FROM ai_chat_shares WHERE id = ? AND user_id = ? AND model = 'codex' AND deleted_at IS NULL").bind(id, userId).first<{ answer: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const result = await c.env.DB.prepare(`
    WITH keywords AS (
      SELECT DISTINCT keyword FROM aichat_search_log
      WHERE user_id = ? AND keyword <> '' AND instr(?, keyword) > 0
    )
    SELECT k.keyword,
      SUM((length(s.answer) - length(replace(s.answer, k.keyword, ''))) / length(k.keyword)) AS count
    FROM keywords k JOIN ai_chat_shares s ON s.user_id = ? AND s.deleted_at IS NULL AND instr(s.answer, k.keyword) > 0
    GROUP BY k.keyword ORDER BY count DESC, k.keyword ASC
  `).bind(userId, row.answer, userId).all<{ keyword: string; count: number }>();
  return c.json({ keywords: result.results });
});
