import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const interactionsBlock = (() => {
  const idx = src.indexOf("app.post('/slack/interactions'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe('POST /slack/interactions', () => {
  it('署名・トークンをhandleSlackInteractionに渡す', () => {
    expect(interactionsBlock).toContain('signingSecret: c.env.SLACK_SIGNING_SECRET');
    expect(interactionsBlock).toContain('slackToken: c.env.SLACK_OAUTH_TOKEN');
    expect(interactionsBlock).toContain('verifySignature: verifySlackSignature');
  });

  it('署名検証失敗(401)の場合は本文なしで401を返す', () => {
    expect(interactionsBlock).toMatch(/if \(result\.status === 401\) \{\s*return c\.text\('', 401\);/);
  });

  it('aiReplyTaskが返ってきた場合はwaitUntilでdispatchSlackAiReplyへ渡す（3秒ACK制限をブロックしない）', () => {
    expect(interactionsBlock).toContain('if (result.aiReplyTask) {');
    expect(interactionsBlock).toContain('safeWaitUntil(c, dispatchSlackAiReply(c.env, result.aiReplyTask));');
  });

  it('それ以外は本文なしで200を返す', () => {
    expect(interactionsBlock).toContain("return c.text('', 200);");
  });
});
