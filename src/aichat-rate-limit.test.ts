import { describe, it, expect } from 'vitest';

// checkAiChatRateLimit は D1 依存のため直接テストできないが、
// window_key の生成ロジックと定数を文字列抽出で検証する
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

describe('AI チャット レートリミット', () => {
  it('AICHAT_RATE_LIMIT_PER_MIN が定義されている', () => {
    expect(src).toContain('AICHAT_RATE_LIMIT_PER_MIN');
  });

  it('checkAiChatRateLimit が定義されている', () => {
    expect(src).toContain('function checkAiChatRateLimit');
  });

  it('aichat_rate_limit テーブルへの INSERT OR CONFLICT 処理が存在する', () => {
    expect(src).toContain('aichat_rate_limit');
    expect(src).toContain('ON CONFLICT(user_id, window_key)');
  });

  it('429 レスポンスが存在する', () => {
    expect(src).toContain('429');
    expect(src).toContain('リクエストが多すぎます');
  });

  it('DB がない場合は制限しない（安全側フォールバック）', () => {
    const fnStart = src.indexOf('async function checkAiChatRateLimit');
    const fnBody = src.slice(fnStart, fnStart + 600);
    expect(fnBody).toContain('if (!db) return false');
  });

  it('window_key が 1 分単位のスライス（16文字 = YYYY-MM-DDTHH:MM）を使っている', () => {
    const fnStart = src.indexOf('async function checkAiChatRateLimit');
    const fnBody = src.slice(fnStart, fnStart + 600);
    expect(fnBody).toContain('.slice(0, 16)');
  });
});
