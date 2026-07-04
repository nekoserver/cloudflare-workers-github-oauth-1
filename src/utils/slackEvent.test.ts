import { describe, it, expect, vi } from 'vitest';
import { handleSlackEvent, type SlackEventDeps } from './slackEvent';

describe('handleSlackEvent', () => {
  const baseDeps = (): SlackEventDeps => ({
    rawBody: JSON.stringify({ type: 'url_verification', challenge: 'abc123' }),
    timestamp: '1700000000',
    signature: 'v0=dummy',
    signingSecret: 'secret',
    verifySignature: vi.fn().mockResolvedValue({ success: true }),
  });

  it('SLACK_SIGNING_SECRETが未設定なら署名検証を行わず401を返す', async () => {
    const deps = baseDeps();
    deps.signingSecret = undefined;
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(401);
    expect(result.body).toBeNull();
    expect(deps.verifySignature).not.toHaveBeenCalled();
  });

  it('署名検証に失敗した場合は401・本文なしを返す（偽装リクエストの拒否）', async () => {
    const deps = baseDeps();
    deps.verifySignature = vi.fn().mockResolvedValue({ success: false, reason: 'bad sig' });
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(401);
    expect(result.body).toBeNull();
  });

  it('url_verificationイベントの場合は200でchallenge値をそのまま返す', async () => {
    const deps = baseDeps();
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ challenge: 'abc123' });
  });

  it('JSONとして不正な本文の場合は400を返す', async () => {
    const deps = baseDeps();
    deps.rawBody = '{invalid json';
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(400);
    expect(result.body).toBeNull();
  });

  it('event_callbackの場合は200・本文なしで確認応答しつつeventCallbackにパース結果を返す', async () => {
    const deps = baseDeps();
    deps.rawBody = JSON.stringify({ type: 'event_callback', team_id: 'T123', event: { type: 'message', text: 'hi' } });
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
    expect(result.eventCallback).toEqual({ type: 'event_callback', team_id: 'T123', event: { type: 'message', text: 'hi' } });
  });

  it('app_mentionイベントもeventCallbackとして返す（呼び出し元がディスパッチする）', async () => {
    const deps = baseDeps();
    deps.rawBody = JSON.stringify({
      type: 'event_callback',
      event: { type: 'app_mention', text: '<@U1> hello', channel: 'C1', ts: '111.222', user: 'U9' },
    });
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(200);
    expect(result.eventCallback?.event.type).toBe('app_mention');
    expect(result.eventCallback?.event.channel).toBe('C1');
  });

  it('event_callbackだがeventフィールドが無い/不正な場合はeventCallbackをnullにする', async () => {
    const deps = baseDeps();
    deps.rawBody = JSON.stringify({ type: 'event_callback' });
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(200);
    expect(result.eventCallback).toBeNull();
  });

  it('url_verification/event_callback以外のイベントタイプは200・本文なし・eventCallback nullで確認応答する', async () => {
    const deps = baseDeps();
    deps.rawBody = JSON.stringify({ type: 'app_rate_limited' });
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
    expect(result.eventCallback).toBeNull();
  });

  it('challengeフィールドが文字列でない場合はurl_verificationとして扱わない', async () => {
    const deps = baseDeps();
    deps.rawBody = JSON.stringify({ type: 'url_verification', challenge: 12345 });
    const result = await handleSlackEvent(deps);
    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
    expect(result.eventCallback).toBeNull();
  });
});
