import { describe, it, expect } from 'vitest';
import {
  buildAiMessages,
  SYSTEM_PROMPT_JA,
  USER_PREFIX_JA,
  ALLOWED_MODES,
} from './utils/buildAiMessages';

const MSG = 'テスト質問';

describe('buildAiMessages — A案（system ロール、デフォルト）', () => {
  it('mode省略時は A案になる', () => {
    const msgs = buildAiMessages(MSG);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('mode="a" で system ロールが先頭に入る', () => {
    const msgs = buildAiMessages(MSG, 'a');
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toBe(SYSTEM_PROMPT_JA);
  });

  it('mode="a" で user ロールに元メッセージが入る', () => {
    const msgs = buildAiMessages(MSG, 'a');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe(MSG);
  });

  it('SYSTEM_PROMPT_JA は「日本語で回答」を含む', () => {
    expect(SYSTEM_PROMPT_JA).toContain('日本語で回答');
  });
});

describe('buildAiMessages — B案（ユーザーメッセージにプレフィックス）', () => {
  it('mode="b" でメッセージが1件のみ', () => {
    const msgs = buildAiMessages(MSG, 'b');
    expect(msgs).toHaveLength(1);
  });

  it('mode="b" でプレフィックスがメッセージの先頭に付く', () => {
    const msgs = buildAiMessages(MSG, 'b');
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe(USER_PREFIX_JA + MSG);
  });

  it('mode="b" で system ロールは含まれない', () => {
    const msgs = buildAiMessages(MSG, 'b');
    expect(msgs.every(m => m.role !== 'system')).toBe(true);
  });
});

describe('buildAiMessages — C案（指示なし）', () => {
  it('mode="c" でメッセージが1件のみ', () => {
    const msgs = buildAiMessages(MSG, 'c');
    expect(msgs).toHaveLength(1);
  });

  it('mode="c" で元メッセージがそのまま入る', () => {
    const msgs = buildAiMessages(MSG, 'c');
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe(MSG);
  });

  it('mode="c" で system ロールもプレフィックスも含まれない', () => {
    const msgs = buildAiMessages(MSG, 'c');
    expect(msgs.every(m => m.role !== 'system')).toBe(true);
    expect(msgs[0].content).not.toContain('日本語');
  });
});

describe('ALLOWED_MODES', () => {
  it('a, b, c の3種が定義されている', () => {
    expect(ALLOWED_MODES.has('a')).toBe(true);
    expect(ALLOWED_MODES.has('b')).toBe(true);
    expect(ALLOWED_MODES.has('c')).toBe(true);
  });

  it('不正値は含まれない', () => {
    expect(ALLOWED_MODES.has('d')).toBe(false);
    expect(ALLOWED_MODES.has('')).toBe(false);
  });
});
