import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const getBlock = (() => {
  const idx = src.indexOf("app.get('/tsubuyaki'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

const postBlock = (() => {
  const idx = src.indexOf("app.post('/api/tsubuyaki'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

const slashCommandBlock = (() => {
  const idx = src.indexOf("app.post('/slack/commands'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe('GET /tsubuyaki', () => {
  it('authMiddleware で保護されている', () => {
    expect(getBlock).toContain('authMiddleware');
  });

  it('getTsubuyakiPage にログインユーザー名を渡してHTMLを返す', () => {
    expect(getBlock).toContain('getTsubuyakiPage(user.sub)');
  });
});

describe('POST /api/tsubuyaki', () => {
  it('authMiddleware で保護されている', () => {
    expect(postBlock).toContain('authMiddleware');
  });

  it('validateFreeText で本文を検証し、不正な場合は400を返す', () => {
    expect(postBlock).toContain('validateFreeText(body?.text)');
    expect(postBlock).toContain("return c.json({ ok: false, error: validated.error }, 400);");
  });

  it('Slack連携が未設定の場合は503でエラー内容を返す（記録＝戻り値、通知＝UI表示）', () => {
    expect(postBlock).toContain('SLACK_OAUTH_TOKEN');
    expect(postBlock).toContain('SLACK_CHANNEL_ID');
    expect(postBlock).toMatch(/if \(!slackToken \|\| !slackChannel\) \{\s*return c\.json\(\{ ok: false, error:/);
  });

  it('postSlackMessage の失敗時は502でエラー内容を返す（握りつぶさない）', () => {
    expect(postBlock).toContain('const result = await postSlackMessage(');
    expect(postBlock).toMatch(/if \(!result\.ok\) \{\s*return c\.json\(\{ ok: false, error: result\.error/);
  });

  it('成功時は ok:true を返す', () => {
    expect(postBlock).toContain('return c.json({ ok: true });');
  });

  it('buildFreeTextSlackMessage に表示名(name優先・無ければsub)と本文を渡す', () => {
    expect(postBlock).toContain('const displayName = user.name || user.sub;');
    expect(postBlock).toContain('buildFreeTextSlackMessage(displayName, validated.text)');
  });
});

describe('POST /slack/commands', () => {
  it('command フィールドで /pts にディスパッチする', () => {
    expect(slashCommandBlock).toContain("command === '/pts'");
    expect(slashCommandBlock).toContain('handleTsubuyakiSlashCommand(');
  });

  it('署名・トークン・チャンネルを handleTsubuyakiSlashCommand に渡す', () => {
    expect(slashCommandBlock).toContain('timestamp: c.req.header(');
    expect(slashCommandBlock).toContain('signature: c.req.header(');
    expect(slashCommandBlock).toContain('signingSecret: c.env.SLACK_SIGNING_SECRET');
    expect(slashCommandBlock).toContain('slackToken: c.env.SLACK_OAUTH_TOKEN');
    expect(slashCommandBlock).toContain('slackChannel: c.env.SLACK_CHANNEL_ID');
    expect(slashCommandBlock).toContain('verifySignature: verifySlackSignature');
    expect(slashCommandBlock).toContain('postMessage: postSlackMessage');
  });

  it('body が null（署名検証失敗）の場合は401を返す', () => {
    expect(slashCommandBlock).toMatch(/if \(!result\.body\) \{\s*return c\.text\('', 401\);/);
  });

  it('未対応のコマンドにはephemeralで案内メッセージを返す(200)', () => {
    expect(slashCommandBlock).toContain("response_type: 'ephemeral'");
    expect(slashCommandBlock).toContain('未対応のコマンドです');
  });

  it('/pts f1 (text=f1) は handleF1ScheduleSlashCommand にディスパッチする', () => {
    expect(slashCommandBlock).toContain("text.toLowerCase() === 'f1'");
    expect(slashCommandBlock).toContain('handleF1ScheduleSlashCommand(');
  });

  it('F1コマンドの分岐は text判定より前に handleTsubuyakiSlashCommand を呼ばない', () => {
    const f1Idx = slashCommandBlock.indexOf('handleF1ScheduleSlashCommand(');
    const tsubuyakiIdx = slashCommandBlock.indexOf('handleTsubuyakiSlashCommand(');
    expect(f1Idx).toBeGreaterThan(-1);
    expect(tsubuyakiIdx).toBeGreaterThan(f1Idx);
  });

  it('F1コマンドにも署名・トークン・チャンネル・巡回データ・現在時刻を渡す', () => {
    const f1Idx = slashCommandBlock.indexOf('handleF1ScheduleSlashCommand(');
    const block = slashCommandBlock.slice(f1Idx, f1Idx + 500);
    expect(block).toContain('signingSecret: c.env.SLACK_SIGNING_SECRET');
    expect(block).toContain('slackToken: c.env.SLACK_OAUTH_TOKEN');
    expect(block).toContain('slackChannel: c.env.SLACK_CHANNEL_ID');
    expect(block).toContain('circuits: F1_CIRCUITS');
    expect(block).toContain('now: new Date()');
    expect(block).toContain('verifySignature: verifySlackSignature');
    expect(block).toContain('postMessage: postSlackMessage');
  });
});
