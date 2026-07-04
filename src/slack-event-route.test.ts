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

  it('app_mentionイベント(bot自身の発言を除く)をhandleSlackAppMentionへディスパッチする', () => {
    expect(eventBlock).toContain("mentionEvent.type === 'app_mention'");
    expect(eventBlock).toContain('!mentionEvent.bot_id');
    expect(eventBlock).toContain('handleSlackAppMention({');
  });

  it('waitUntilでバックグラウンド実行し、Slackへの200応答をブロックしない', () => {
    expect(eventBlock).toContain('c.executionCtx?.waitUntil(');
  });

  it('スレッド返信のため thread_ts(無ければts)をスレッドIDとして渡す', () => {
    expect(eventBlock).toContain('threadTs: mentionEvent.thread_ts ?? mentionEvent.ts');
  });

  it('AIバインディング未設定時はaiRunが分かりやすいエラーで拒否する', () => {
    expect(eventBlock).toContain("Promise.reject(new Error('AI バインディングが未設定です'))");
  });

  it('返信投稿に失敗した場合はエラーをログに記録する（握りつぶさない）', () => {
    expect(eventBlock).toMatch(/if \(!mentionResult\.posted\) \{\s*logger\.error\('Slack app_mention reply failed'/);
  });

  it('Slackトークンの解決はslack_installations(D1)を優先しSLACK_OAUTH_TOKENにフォールバックする', () => {
    expect(eventBlock).toContain('let slackToken = env.SLACK_OAUTH_TOKEN;');
    expect(eventBlock).toContain('SELECT access_token FROM slack_installations WHERE team_id = ?');
    expect(eventBlock).toContain('slackToken = row.access_token;');
  });

  it('D1参照に失敗してもフォールバックして処理を継続する（握りつぶさずログに記録）', () => {
    expect(eventBlock).toMatch(/catch \(dbError\) \{\s*logger\.warn\('Failed to look up Slack installation token, falling back to env'/);
  });
});
