import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { computeConversationHash } from './utils/conversationHash';
import { TABLE_COLUMN_KEYS } from './index';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

describe('computeConversationHash', () => {
  it('同じ入力に対して同一ハッシュを返す', async () => {
    const h1 = await computeConversationHash('user1', 'q', 'a', 'model', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('user1', 'q', 'a', 'model', '2024-01-01T00:00:00.000Z');
    expect(h1).toBe(h2);
  });

  it('user_id が異なる場合は異なるハッシュを返す', async () => {
    const h1 = await computeConversationHash('user1', 'q', 'a', 'model', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('user2', 'q', 'a', 'model', '2024-01-01T00:00:00.000Z');
    expect(h1).not.toBe(h2);
  });

  it('question が異なる場合は異なるハッシュを返す', async () => {
    const h1 = await computeConversationHash('u', 'question A', 'a', 'model', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('u', 'question B', 'a', 'model', '2024-01-01T00:00:00.000Z');
    expect(h1).not.toBe(h2);
  });

  it('answer が異なる場合は異なるハッシュを返す', async () => {
    const h1 = await computeConversationHash('u', 'q', 'answer A', 'model', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('u', 'q', 'answer B', 'model', '2024-01-01T00:00:00.000Z');
    expect(h1).not.toBe(h2);
  });

  it('model が異なる場合は異なるハッシュを返す', async () => {
    const h1 = await computeConversationHash('u', 'q', 'a', 'llama-3', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('u', 'q', 'a', 'gemma-4', '2024-01-01T00:00:00.000Z');
    expect(h1).not.toBe(h2);
  });

  it('created_at が異なる場合は異なるハッシュを返す', async () => {
    const h1 = await computeConversationHash('u', 'q', 'a', 'model', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('u', 'q', 'a', 'model', '2024-01-02T00:00:00.000Z');
    expect(h1).not.toBe(h2);
  });

  it('ハッシュは64文字の16進数文字列', async () => {
    const h = await computeConversationHash('u', 'q', 'a', 'model', '2024-01-01T00:00:00.000Z');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('フィールド境界の曖昧性が生じない（\x00セパレータにより）', async () => {
    const h1 = await computeConversationHash('u', 'q|a', 'b', 'model', '2024-01-01T00:00:00.000Z');
    const h2 = await computeConversationHash('u', 'q', 'a|b', 'model', '2024-01-01T00:00:00.000Z');
    expect(h1).not.toBe(h2);
  });
});

describe('TABLE_COLUMN_KEYS ai_chat_shares', () => {
  it('conversation_hash が uk として登録されている', () => {
    expect(TABLE_COLUMN_KEYS['ai_chat_shares']['conversation_hash']).toBe('uk');
  });

  it('id が pk として登録されている', () => {
    expect(TABLE_COLUMN_KEYS['ai_chat_shares']['id']).toBe('pk');
  });
});

describe('マイグレーション 0047', () => {
  it('0047_add_conversation_hash.sql が存在する', () => {
    const file = path.join(MIGRATIONS_DIR, '0047_add_conversation_hash.sql');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('0047 マイグレーションに ALTER TABLE ai_chat_shares ADD COLUMN conversation_hash が含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0047_add_conversation_hash.sql');
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toContain('ALTER TABLE ai_chat_shares ADD COLUMN conversation_hash');
  });
});
