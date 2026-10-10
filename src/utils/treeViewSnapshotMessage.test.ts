import { describe, it, expect } from 'vitest';
import { buildSnapshotRepoNotSupportedMessage } from './treeViewSnapshotMessage';

describe('buildSnapshotRepoNotSupportedMessage', () => {
  it('拒否されたリポジトリ名・原因・対処・表示可能な一覧を含む', () => {
    const msg = buildSnapshotRepoNotSupportedMessage('nekoserver/rails-root', ['nekoserver/a', 'nekoserver/b']);
    expect(msg).toContain('nekoserver/rails-root');
    expect(msg).toContain('未登録');
    expect(msg).toContain('対処');
    expect(msg).toContain('nekoserver/a, nekoserver/b');
  });
  it('repoName未指定では指定方法を案内する', () => {
    expect(buildSnapshotRepoNotSupportedMessage('', ['x/y'])).toContain('owner/repo');
  });
});
