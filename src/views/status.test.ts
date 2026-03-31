/**
 * /status ページの保存データモーダル関連テスト
 *
 * - formatCellValue: ai_summary_log.request_id と ai_summary_reviews.summary_request_id の
 *   /ai-summary/{id} リンク化
 * - renderColumnKeyBadge: PK/FK バッジのHTML生成
 * - renderStatusTablePreview: columnKeyInfo を使ったヘッダーバッジ表示
 */
import { describe, it, expect } from 'vitest';
import { getCacheStatusPage, type CacheStatusData } from './status';

const minimalData: CacheStatusData = {
  commitCache: { totalEntries: 0, totalCommits: 0, repos: [], byMonth: [], byMonthByRepo: [], entries: [] },
  repoColors: [],
  repoGroups: [],
  installationPerms: { totalEntries: 0, entries: [] },
  cacheStats: { totalGithubFetch: 0, totalCacheSave: 0, totalCacheLookup: 0, totalCacheHit: 0, entries: [] },
  tables: [],
  tableGroupMap: {},
  unclassifiedAutoDetectedTables: [],
  groupLabels: {},
  userContext: { teamName: null, teamId: null, workspaceName: null, workspaceId: null, role: null, allWorkspaces: [] },
};

const minimalUser = { username: 'testuser' };

describe('/status ページの formatCellValue リンク化', () => {
  it('ai_summary_log の request_id を /ai-summary/ リンクに変換するロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain("column === 'request_id'");
    expect(html).toContain('isCommitRelatedTable(tableName)');
    expect(html).toContain('/ai-summary/');
  });

  it('commit_agent_log を含む commit系テーブルの request_id を /ai-summary/ リンクに変換するロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain("return tableName.indexOf('commit_') === 0");
    expect(html).toContain("tableName === 'commit_agent_log'");
  });

  it('ai_summary_reviews の summary_request_id を /ai-summary/ リンクに変換するロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain("column === 'summary_request_id' && tableName === 'ai_summary_reviews'");
  });

  it('renderStatusTablePreview が formatCellValue にカラム名とテーブル名を渡している', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('formatCellValue(column, row[column], tableName)');
  });
});

describe('/status ページの PK/FK バッジ表示', () => {
  it('renderColumnKeyBadge 関数が存在し pk/fk/pk+fk を処理する', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('function renderColumnKeyBadge(keyType)');
    expect(html).toContain("keyType === 'pk'");
    expect(html).toContain("keyType === 'fk'");
    expect(html).toContain("keyType === 'pk+fk'");
  });

  it('PKバッジの配色がER図と一致する（bg=#e53e3e）', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('background:#e53e3e');
  });

  it('FKバッジの配色がER図と一致する（bg=#ed8936）', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('background:#ed8936');
  });

  it('renderStatusTablePreview が columnKeyInfo を受け取りヘッダーにバッジを埋め込む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('renderColumnKeyBadge(keyInfo[column])');
  });

  it('openTablePreview が data.columnKeyInfo を renderStatusTablePreview に渡す', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('data.columnKeyInfo');
  });
});

describe('/status ページの thフィルタ機能', () => {
  it('renderStatusTablePreview が filterableColumns を受け取る', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('filterableColumns');
  });

  it('th-filter-select クラスのセレクトメニューを生成するロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('th-filter-select');
  });

  it('getUniqueValues 関数で行データからユニーク値を抽出する', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('function getUniqueValues(rows, columnName)');
  });

  it('フィルタ変更時に applyFilters で行の表示/非表示を切り替える', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('applyFilters');
  });

  it('openTablePreview が data.filterableColumns を渡す', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('data.filterableColumns');
  });
});

describe('/status ページの script安全性', () => {
  it('JavaScript文字列内に </script> リテラルが含まれない（HTMLパーサー破壊防止）', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    const scriptBlocks = html.match(/<script[\s>][\s\S]*?<\/script>/gi) || [];
    for (const block of scriptBlocks) {
      const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
      expect(inner).not.toContain('</script>');
    }
  });

  it('bindFilterSelects 関数がinnerHTML後にフィルタをバインドする', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('function bindFilterSelects(tableId)');
    expect(html).toContain('bindFilterSelects(tableId)');
  });
});

describe('/status ページの 未分類テーブル注意トースト', () => {
  it('未分類テーブルがある場合に注意トースト表示ロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, {
      ...minimalData,
      unclassifiedAutoDetectedTables: ['mystery_table'],
    });
    expect(html).toContain('unclassifiedTableToast');
    expect(html).toContain('showUnclassifiedTableToast');
    expect(html).toContain('未分類テーブルがあります（グループID: 0）');
  });
});

describe('/status ページの グループER図モーダル', () => {
  it('openGroupEr 関数が存在する', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('function openGroupEr(tableName)');
  });

  it('renderGroupErDiagram 関数が存在する', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('function renderGroupErDiagram(erData)');
  });

  it('モーダル上部にグループER図ボタンが配置される', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('このテーブルが属するグループのテーブル構造を確認する');
  });

  it('group-er APIエンドポイントを呼び出す', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);
    expect(html).toContain('/group-er');
  });
});
