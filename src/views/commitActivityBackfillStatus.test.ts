import { describe, expect, it } from 'vitest';
import { getCommitActivityBackfillStatusPage } from './commitActivityBackfillStatus';

describe('getCommitActivityBackfillStatusPage', () => {
  it('リポジトリを比率の高い順に並べて表示する', () => {
    const html = getCommitActivityBackfillStatusPage({
      generatedAt: '2026-10-15T00:00:00Z',
      repos: [
        { repoName: 'nekoserver/a', totalCommits: 10, committedAtFilled: 1, ratio: 0.1 },
        { repoName: 'nekoserver/b', totalCommits: 10, committedAtFilled: 9, ratio: 0.9 },
      ],
    });
    const indexA = html.indexOf('nekoserver/a');
    const indexB = html.indexOf('nekoserver/b');
    expect(indexB).toBeLessThan(indexA);
    expect(html).toContain('90.0%');
    expect(html).toContain('10.0%');
  });

  it('データが無い場合は空状態の文言を表示する', () => {
    const html = getCommitActivityBackfillStatusPage({ generatedAt: '2026-10-15T00:00:00Z', repos: [] });
    expect(html).toContain('repo_commit_indexにデータがありません');
  });

  it('repoNameをHTMLエスケープする(XSS対策)', () => {
    const html = getCommitActivityBackfillStatusPage({
      generatedAt: '2026-10-15T00:00:00Z',
      repos: [{ repoName: '<script>alert(1)</script>', totalCommits: 1, committedAtFilled: 1, ratio: 1 }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
