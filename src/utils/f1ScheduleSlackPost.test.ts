import { describe, it, expect, vi } from 'vitest';
import { buildF1ScheduleMessage, handleF1ScheduleSlashCommand } from './f1ScheduleSlackPost';
import type { F1Circuit } from '../data/f1Circuits';

const CIRCUITS: F1Circuit[] = [
  { gp: '過去GP', circuit: '過去サーキット', flag: '🏁', country: '過去国', date: '2026-01-01', lat: 0, lon: 0 },
  { gp: 'イギリスGP', circuit: 'シルバーストン・サーキット', flag: '🇬🇧', country: 'イギリス', date: '2026-07-05', lat: 52.0786, lon: -1.0169 },
  { gp: 'ベルギーGP', circuit: 'スパ・フランコルシャン・サーキット', flag: '🇧🇪', country: 'ベルギー', date: '2026-07-19', lat: 50.4372, lon: 5.9714 },
  { gp: 'ハンガリーGP', circuit: 'ハンガロリンク', flag: '🇭🇺', country: 'ハンガリー', date: '2026-07-26', lat: 47.5789, lon: 19.2486 },
];

describe('buildF1ScheduleMessage', () => {
  it('本日以降のレースのみを日付昇順で含める（過去のレースは除外）', () => {
    const msg = buildF1ScheduleMessage(CIRCUITS, new Date('2026-07-10T00:00:00Z'));
    expect(msg).not.toContain('過去サーキット');
    const belgiumIdx = msg.indexOf('スパ・フランコルシャン・サーキット');
    const hungaryIdx = msg.indexOf('ハンガロリンク');
    expect(belgiumIdx).toBeGreaterThan(-1);
    expect(hungaryIdx).toBeGreaterThan(belgiumIdx);
  });

  it('本日開催のレースも含める（当日を除外しない）', () => {
    const msg = buildF1ScheduleMessage(CIRCUITS, new Date('2026-07-05T00:00:00Z'));
    expect(msg).toContain('シルバーストン・サーキット');
  });

  it('開催日・国旗・サーキット名・GP名を含む', () => {
    const msg = buildF1ScheduleMessage(CIRCUITS, new Date('2026-07-01T00:00:00Z'));
    expect(msg).toContain('2026/7/5');
    expect(msg).toContain('🇬🇧');
    expect(msg).toContain('シルバーストン・サーキット');
    expect(msg).toContain('イギリスGP');
  });

  it('罫線・ツリー文字を使わず箇条書き(•)で表現する（CLAUDE.mdルール16）', () => {
    const msg = buildF1ScheduleMessage(CIRCUITS, new Date('2026-07-01T00:00:00Z'));
    expect(msg).toContain('• ');
    expect(msg).not.toMatch(/[├└│─┼]/);
  });

  it('本日以降のレースがない場合はその旨のメッセージを返す', () => {
    const msg = buildF1ScheduleMessage(CIRCUITS, new Date('2027-01-01T00:00:00Z'));
    expect(msg).toContain('本日以降のF1開催予定はありません');
  });
});

describe('handleF1ScheduleSlashCommand', () => {
  const baseDeps = () => ({
    rawBody: 'command=%2Fpts&text=f1',
    timestamp: '1700000000',
    signature: 'v0=dummy',
    signingSecret: 'secret',
    slackToken: 'xoxb-token',
    slackChannel: 'C12345',
    circuits: CIRCUITS,
    now: new Date('2026-07-01T00:00:00Z'),
    verifySignature: vi.fn().mockResolvedValue({ success: true }),
    postMessage: vi.fn().mockResolvedValue({ ok: true }),
  });

  it('SLACK_SIGNING_SECRET が未設定なら署名検証を行わず200+エラーメッセージを返す', async () => {
    const deps = baseDeps();
    deps.signingSecret = undefined as unknown as string;
    const result = await handleF1ScheduleSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('SLACK_SIGNING_SECRET');
    expect(deps.verifySignature).not.toHaveBeenCalled();
  });

  it('署名検証に失敗した場合は401・本文なしを返す（偽装リクエストの拒否）', async () => {
    const deps = baseDeps();
    deps.verifySignature = vi.fn().mockResolvedValue({ success: false, reason: 'bad sig' });
    const result = await handleF1ScheduleSlashCommand(deps);
    expect(result.status).toBe(401);
    expect(result.body).toBeNull();
    expect(deps.postMessage).not.toHaveBeenCalled();
  });

  it('SLACK_OAUTH_TOKEN/SLACK_CHANNEL_ID が未設定なら投稿せずエラーメッセージを返す', async () => {
    const deps = baseDeps();
    deps.slackToken = undefined as unknown as string;
    const result = await handleF1ScheduleSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('SLACK_OAUTH_TOKEN');
    expect(deps.postMessage).not.toHaveBeenCalled();
  });

  it('postMessage が失敗した場合はエラー内容を含めて返す（握りつぶさない）', async () => {
    const deps = baseDeps();
    deps.postMessage = vi.fn().mockResolvedValue({ ok: false, error: 'channel_not_found' });
    const result = await handleF1ScheduleSlashCommand(deps);
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('channel_not_found');
  });

  it('成功時はF1開催予定をpostMessageでチャンネルに投稿し、ephemeralで完了報告する', async () => {
    const deps = baseDeps();
    const result = await handleF1ScheduleSlashCommand(deps);
    expect(deps.postMessage).toHaveBeenCalledWith({
      token: 'xoxb-token',
      channel: 'C12345',
      text: expect.stringContaining('シルバーストン・サーキット'),
    });
    expect(result.status).toBe(200);
    expect(result.body?.text).toContain('✅');
  });
});
