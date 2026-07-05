import { describe, it, expect, vi } from 'vitest';
import { validateFreeText, buildFreeTextSlackMessage, handleTsubuyakiSlashCommand } from './freeTextSlackPost';

describe('validateFreeText', () => {
  it('通常の文字列を受け付ける', () => {
    const result = validateFreeText('こんにちは');
    expect(result).toEqual({ ok: true, text: 'こんにちは' });
  });

  it('前後の空白をトリムする', () => {
    const result = validateFreeText('  hello  ');
    expect(result).toEqual({ ok: true, text: 'hello' });
  });

  it('空文字列を拒否する', () => {
    const result = validateFreeText('');
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('空');
  });

  it('空白のみの文字列を拒否する', () => {
    const result = validateFreeText('   \n\t  ');
    expect(result.ok).toBe(false);
  });

  it('文字列以外の入力を拒否する（戻り値が空文字やnullにならないことを保証）', () => {
    expect(validateFreeText(undefined).ok).toBe(false);
    expect(validateFreeText(null).ok).toBe(false);
    expect(validateFreeText(123).ok).toBe(false);
    expect(validateFreeText({}).ok).toBe(false);
  });

  it('3000文字を超える本文を拒否する', () => {
    const longText = 'あ'.repeat(3001);
    const result = validateFreeText(longText);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('長すぎます');
  });

  it('ちょうど3000文字は許可する', () => {
    const text = 'あ'.repeat(3000);
    const result = validateFreeText(text);
    expect(result).toEqual({ ok: true, text });
  });
});

describe('buildFreeTextSlackMessage', () => {
  it('表示名と本文を含むSlackメッセージを組み立てる', () => {
    const msg = buildFreeTextSlackMessage('octocat', 'テスト投稿です');
    expect(msg).toContain('octocat');
    expect(msg).toContain('テスト投稿です');
  });
});

describe('handleTsubuyakiSlashCommand', () => {
  const baseDeps = () => ({
    rawBody: 'command=%2Fpts&text=hello&user_name=octocat',
    timestamp: '1700000000',
    signature: 'v0=dummy',
    signingSecret: 'secret',
    verifySignature: vi.fn().mockResolvedValue({ success: true }),
    sendNotification: vi.fn().mockResolvedValue({ ok: true }),
  });

  it('SLACK_SIGNING_SECRET が未設定なら署名検証を行わず200+エラーメッセージを返す', async () => {
    const deps = baseDeps();
    deps.signingSecret = undefined;
    const result = await handleTsubuyakiSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('SLACK_SIGNING_SECRET');
    expect(deps.verifySignature).not.toHaveBeenCalled();
  });

  it('署名検証に失敗した場合は401・本文なしを返す（偽装リクエストの拒否）', async () => {
    const deps = baseDeps();
    deps.verifySignature = vi.fn().mockResolvedValue({ success: false, reason: 'bad sig' });
    const result = await handleTsubuyakiSlashCommand(deps);
    expect(result.status).toBe(401);
    expect(result.body).toBeNull();
    expect(deps.sendNotification).not.toHaveBeenCalled();
  });

  it('text が空の場合は投稿せずエラーメッセージを返す', async () => {
    const deps = baseDeps();
    deps.rawBody = 'command=%2Fpts&text=&user_name=octocat';
    const result = await handleTsubuyakiSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('❌');
    expect(deps.sendNotification).not.toHaveBeenCalled();
  });

  it('通知先が未設定(sendNotificationがエラーを返す)の場合はその理由を含むエラーメッセージを返す', async () => {
    const deps = baseDeps();
    deps.sendNotification = vi.fn().mockResolvedValue({ ok: false, error: 'Slack連携が設定されていません（SLACK_OAUTH_TOKEN / SLACK_CHANNEL_ID が未設定）' });
    const result = await handleTsubuyakiSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('SLACK_OAUTH_TOKEN');
  });

  it('sendNotification が失敗した場合はエラー内容を含めて返す（握りつぶさない）', async () => {
    const deps = baseDeps();
    deps.sendNotification = vi.fn().mockResolvedValue({ ok: false, error: 'channel_not_found' });
    const result = await handleTsubuyakiSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('channel_not_found');
  });

  it('成功時はuser_nameを含む本文でsendNotificationを呼び、成功メッセージを返す', async () => {
    const deps = baseDeps();
    const result = await handleTsubuyakiSlashCommand(deps);
    expect(deps.sendNotification).toHaveBeenCalledWith({ text: expect.stringContaining('octocat') });
    expect(deps.sendNotification).toHaveBeenCalledWith({ text: expect.stringContaining('hello') });
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('✅');
  });

  it('user_name が無い場合は unknown を差出人として使う', async () => {
    const deps = baseDeps();
    deps.rawBody = 'command=%2Fpts&text=hello';
    await handleTsubuyakiSlashCommand(deps);
    expect(deps.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('unknown') })
    );
  });
});
