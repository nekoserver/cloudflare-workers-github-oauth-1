import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const eventBlock = (() => {
  const idx = src.indexOf("app.post('/slack/event'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe("POST /slack/event", () => {
  it('署名・タイムスタンプ・シークレットをhandleSlackEventに渡す', () => {
    expect(eventBlock).toContain('timestamp: c.req.header(');
    expect(eventBlock).toContain('signature: c.req.header(');
    expect(eventBlock).toContain('signingSecret: c.env.SLACK_SIGNING_SECRET');
    expect(eventBlock).toContain('verifySignature: verifySlackSignature');
  });

  it('署名検証失敗(401)の場合は本文なしで401を返す', () => {
    expect(eventBlock).toMatch(/if \(result\.status === 401\) \{\s*return c\.text\('', 401\);/);
  });

  it('不正なJSON(400)の場合は本文なしで400を返す', () => {
    expect(eventBlock).toMatch(/if \(result\.status === 400\) \{\s*return c\.text\('', 400\);/);
  });

  it('url_verificationのchallengeが返ってきた場合はJSONとしてそのまま返す', () => {
    expect(eventBlock).toMatch(/if \(result\.body\) \{\s*return c\.json\(result\.body, 200\);/);
  });

  it('それ以外は本文なしで200を返す(確認応答)', () => {
    expect(eventBlock).toContain("return c.text('', 200);");
  });
});
