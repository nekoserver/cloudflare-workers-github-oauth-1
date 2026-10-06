import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

interface CodexQuestionLog {
  id: number; question: string; answer?: string; thread_id: string | null; created_at: string;
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
  if (before !== undefined && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) < 1)) return c.json({ error: 'Invalid cursor' }, 400);
  const rows = await c.env.DB.prepare(`SELECT id, thread_id, question, created_at FROM ai_chat_shares
    WHERE user_id = ? AND model = 'codex' AND deleted_at IS NULL ${before ? 'AND id < ?' : ''}
    ORDER BY id DESC LIMIT 101`).bind(c.get('user').sub, ...(before ? [Number(before)] : [])).all<CodexQuestionLog>();
  const items = (rows.results || []).slice(0, 100).map((row) => ({ ...row, question: formatCodexAskgkQuestion(row.question || '') }));
  return c.json({ items, nextCursor: rows.results?.length > 100 ? items[items.length - 1].id : null });
});
codexQuestionTreeRoutes.get('/api/mcp-sample/codex-questions/:id', authMiddleware, async c => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return c.json({ error: 'Database unavailable' }, 503);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'Invalid id' }, 400);
  const row = await c.env.DB.prepare("SELECT id, question, answer, thread_id, created_at FROM ai_chat_shares WHERE id = ? AND user_id = ? AND model = 'codex' AND deleted_at IS NULL").bind(id, c.get('user').sub).first<CodexQuestionLog>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ ...row, question: formatCodexAskgkQuestion(row.question || '') });
});
