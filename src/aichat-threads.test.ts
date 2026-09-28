import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildThreadGrowthWindow,
  createThreadId,
  isThreadId,
  parseGrowingThreadLimit,
} from './utils/aichatThreads';

describe('AI chat thread identifiers', () => {
  it('creates an opaque 128-bit hexadecimal identifier', () => {
    const first = createThreadId();
    const second = createThreadId();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
    expect(isThreadId(first)).toBe(true);
    expect(isThreadId('not-a-thread')).toBe(false);
  });
});

describe('growing thread query parameters', () => {
  it('uses a bounded default limit', () => {
    expect(parseGrowingThreadLimit(undefined)).toBe(20);
    expect(parseGrowingThreadLimit('100')).toBe(100);
    expect(() => parseGrowingThreadLimit('0')).toThrow();
    expect(() => parseGrowingThreadLimit('101')).toThrow();
    expect(() => parseGrowingThreadLimit('2.5')).toThrow();
  });

  it('builds adjacent half-open 24-hour windows', () => {
    expect(buildThreadGrowthWindow(new Date('2026-09-28T12:00:00.000Z'))).toEqual({
      previousFrom: '2026-09-26T12:00:00.000Z',
      recentFrom: '2026-09-27T12:00:00.000Z',
      until: '2026-09-28T12:00:00.000Z',
    });
  });
});

describe('thread persistence and growth API wiring', () => {
  const root = path.resolve(__dirname, '..');
  const indexSource = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
  const pageSource = fs.readFileSync(path.join(root, 'src/views/aichat.ts'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'migrations/0165_add_thread_id_to_ai_chat_shares.sql'), 'utf8');

  it('keeps legacy rows nullable and adds the owner/thread/time index', () => {
    expect(migration).toContain('ADD COLUMN thread_id TEXT');
    expect(migration).toContain('ai_chat_shares(user_id, thread_id, created_at)');
    expect(migration).not.toContain('NOT NULL');
  });

  it('uses owner-scoped, non-deleted rows and deterministic growth ordering', () => {
    const route = indexSource.slice(indexSource.indexOf("app.get('/api/aichat/threads/growing'"));
    expect(route).toContain('WHERE user_id = ?');
    expect(route).toContain('thread_id IS NOT NULL');
    expect(route).toContain('deleted_at IS NULL');
    expect(route).toContain('WHERE recent_count >= 2');
    expect(route).toContain('ORDER BY growth DESC, recent_count DESC, latest_activity_at DESC, thread_id ASC');
  });

  it('returns and reuses the server-issued thread id for later page turns', () => {
    expect(indexSource).toContain('question_hash, input_tokens, output_tokens, total_tokens, source, image_id, thread_id)');
    expect(indexSource).toContain('指定されたスレッドは存在しません');
    expect(pageSource).toContain('threadId: currentThreadId');
    expect(pageSource).toContain('if (data.threadId) currentThreadId = data.threadId');
  });
});
