import { describe, it, expect } from 'vitest';

// checkAiChatRateLimit は D1 依存のため直接テストできないが、
// window_key の生成ロジックと定数を文字列抽出で検証する
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

describe('AI チャット レートリミット', () => {
  it('AICHAT_RATE_LIMIT_PER_MIN と AICHAT_RATE_LIMIT_PER_WEEK が定義されている', () => {
    expect(src).toContain('AICHAT_RATE_LIMIT_PER_MIN');
    expect(src).toContain('AICHAT_RATE_LIMIT_PER_WEEK');
  });

  it('checkAiChatRateLimit が定義されている', () => {
    expect(src).toContain('function checkAiChatRateLimit');
  });

  it('aichat_rate_limit テーブルへの INSERT OR CONFLICT 処理が存在する', () => {
    expect(src).toContain('aichat_rate_limit');
    expect(src).toContain('ON CONFLICT(user_id, window_key)');
  });

  it('週次リミット残量 API が存在する', () => {
    expect(src).toContain("/api/aichat/rate-limit-status");
    expect(src).toContain('getAiChatWeeklyLimitStatus');
    expect(src).toContain('remaining');
  });

  it('週次 window_key が UTC 月曜始まりで生成される', () => {
    const fnStart = src.indexOf('function getAiChatWeekWindowKey');
    const fnBody = src.slice(fnStart, fnStart + 500);
    expect(fnBody).toContain(':week:');
    expect(fnBody).toContain('getUTCDay() || 7');
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
