import { describe, expect, it } from 'vitest';
import {
  evaluateInstallationCheck,
  evaluateWebhookDeliveryCheck,
  evaluateCommitBackfillCheck,
} from './repoOnboardingCheck';

// 対象: 新リポジトリオンボーディング確認ページの判定ロジック(①②③)。
//
// 故障シナリオ:
//   (1) installation_permissionsに該当行が無いのにOKと誤判定する
//   (2) repository_selection='all'のケースを個別repo_name一致と取り違える
//   (3) webhook_logが空(未配信)なのと、配信はあるが全て失敗なのを混同する
//   (4) GitHub API取得失敗(githubTotal=null)を「0件一致」と誤判定する
//   (5) D1件数がGitHub側より多い(重複等の異常)ケースをOKと誤判定する

describe('evaluateInstallationCheck', () => {
  it('対象repoの行が無い場合はmissing', () => {
    const result = evaluateInstallationCheck('nekoserver/railway', []);
    expect(result.status).toBe('missing');
  });

  it('対象repoの行がある場合はok', () => {
    const result = evaluateInstallationCheck('nekoserver/railway', [
      { repo_name: 'nekoserver/railway', repository_selection: 'selected', updated_at: '2026-10-12T00:00:00Z' },
    ]);
    expect(result.status).toBe('ok');
  });

  it('repository_selection=allの行(repo_name=null)があればok', () => {
    const result = evaluateInstallationCheck('nekoserver/railway', [
      { repo_name: null, repository_selection: 'all', updated_at: '2026-10-12T00:00:00Z' },
    ]);
    expect(result.status).toBe('ok');
  });

  it('repo_name=nullだがrepository_selection=selectedの行はallとみなさない', () => {
    const result = evaluateInstallationCheck('nekoserver/railway', [
      { repo_name: null, repository_selection: 'selected', updated_at: '2026-10-12T00:00:00Z' },
    ]);
    expect(result.status).toBe('missing');
  });

  it('他リポジトリの行があるだけではokにしない', () => {
    const result = evaluateInstallationCheck('nekoserver/railway', [
      { repo_name: 'nekoserver/dynamicneko', repository_selection: 'selected', updated_at: '2026-10-12T00:00:00Z' },
    ]);
    expect(result.status).toBe('missing');
  });
});

describe('evaluateWebhookDeliveryCheck', () => {
  it('受信履歴が0件ならmissing', () => {
    const result = evaluateWebhookDeliveryCheck([]);
    expect(result.status).toBe('missing');
  });

  it('status=okかつevent_type=pushの行があればok', () => {
    const result = evaluateWebhookDeliveryCheck([
      { event_type: 'push', status: 'ok', received_at: '2026-10-12T07:10:00Z' },
    ]);
    expect(result.status).toBe('ok');
  });

  it('status=okだがevent_type=pingのみの場合はwarning(push未確認)', () => {
    const result = evaluateWebhookDeliveryCheck([
      { event_type: 'ping', status: 'ok', received_at: '2026-10-12T07:00:00Z' },
    ]);
    expect(result.status).toBe('warning');
  });

  it('全てrejectedの場合はwarning', () => {
    const result = evaluateWebhookDeliveryCheck([
      { event_type: null, status: 'rejected', received_at: '2026-10-12T07:00:00Z' },
    ]);
    expect(result.status).toBe('warning');
  });
});

describe('evaluateCommitBackfillCheck', () => {
  it('githubTotalがnull(API取得失敗)の場合はwarningで断定しない', () => {
    const result = evaluateCommitBackfillCheck({ count: 1, maxSeq: 1 }, null);
    expect(result.status).toBe('warning');
  });

  it('D1件数とGitHub件数が一致すればok', () => {
    const result = evaluateCommitBackfillCheck({ count: 2, maxSeq: 2 }, 2);
    expect(result.status).toBe('ok');
  });

  it('D1件数がGitHub件数より少なければmissing(バックフィル漏れ)', () => {
    const result = evaluateCommitBackfillCheck({ count: 1, maxSeq: 1 }, 2);
    expect(result.status).toBe('missing');
    expect(result.summary).toContain('1件');
  });

  it('D1件数がGitHub件数より多ければwarning(異常の疑い)', () => {
    const result = evaluateCommitBackfillCheck({ count: 3, maxSeq: 3 }, 2);
    expect(result.status).toBe('warning');
  });

  it('D1件数0・GitHub件数0ならok(新規リポジトリでコミットが無いだけ)', () => {
    const result = evaluateCommitBackfillCheck({ count: 0, maxSeq: null }, 0);
    expect(result.status).toBe('ok');
  });
});
