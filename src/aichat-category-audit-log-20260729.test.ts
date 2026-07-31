import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

// 対象: AIチャットの分類カテゴリグループ・キーワード分類の作成/更新/削除操作を
// 監査ログとして記録する aichat_category_audit_log テーブルと、recordAichatCategoryAudit
// ヘルパー、および既存6エンドポイントへの配線。
//
// 背景: 調査の過程で aichat_keyword_categories / aichat_keyword_category_map の2テーブルが
// コードでは使われているのにmigrationファイル・レジストリ登録が一切無いことが判明した
// (migrations/0084, 0085で追加)。この2テーブルを土台として、新規に監査ログテーブル
// (migrations/0086)を追加し、既存の6つのCRUDエンドポイントに書き込みフックを追加した。
//
// 故障シナリオ:
//   (1) 監査ログのINSERTが失敗した際に例外がそのまま外へ伝播し、本来のCRUD操作自体が
//       失敗したように見えてしまう(recordAichatCategoryAuditは必ずtry/catchで包み、
//       失敗してもメインの処理を止めてはならない)
//   (2) DB未設定(c.env.DB === undefined)の状態でrecordAichatCategoryAuditが呼ばれ、
//       未定義参照エラーになる
//   (3) INSERT OR IGNORE で実際には重複により何も挿入されなかった(keyword_category_created/
//       keyword_classifiedの場合)のに、監査ログには「作成された」と記録されてしまう
//   (4) 各エンドポイントで action/entityType の値が食い違い、監査ログから元の操作を
//       正しく追跡できなくなる

describe('recordAichatCategoryAudit ヘルパー関数', () => {
  it('関数が定義されている', () => {
    expect(indexSrc).toContain('async function recordAichatCategoryAudit(');
  });

  it('db が未設定(falsy)の場合は即座にreturnする(ガード句)', () => {
    const idx = indexSrc.indexOf('async function recordAichatCategoryAudit(');
    const block = indexSrc.slice(idx, idx + 300);
    expect(block).toMatch(/if \(!db\) return;/);
  });

  it('aichat_category_audit_log へのINSERT文を含む', () => {
    const idx = indexSrc.indexOf('async function recordAichatCategoryAudit(');
    const endIdx = indexSrc.indexOf('\ninterface ClassifyResult', idx);
    const block = indexSrc.slice(idx, endIdx);
    expect(block).toContain('INSERT INTO aichat_category_audit_log');
    expect(block).toContain('user_id, action, entity_type, entity_id, entity_name, detail');
  });

  it('INSERT失敗時はtry/catchで捕捉しlogger.warnで記録する(呼び出し元の処理を止めない)', () => {
    const idx = indexSrc.indexOf('async function recordAichatCategoryAudit(');
    const endIdx = indexSrc.indexOf('\ninterface ClassifyResult', idx);
    const block = indexSrc.slice(idx, endIdx);
    expect(block).toContain('} catch (error) {');
    expect(block).toContain("logger.warn('Failed to record aichat_category_audit_log'");
  });
});

describe('6つのCRUDエンドポイントへの監査ログ配線', () => {
  function getEndpointBlock(routeMarker: string, endMarker: string): string {
    const idx = indexSrc.indexOf(routeMarker);
    expect(idx, routeMarker + ' が見つからない').toBeGreaterThan(-1);
    const endIdx = indexSrc.indexOf(endMarker, idx);
    expect(endIdx, endMarker + ' が見つからない').toBeGreaterThan(idx);
    return indexSrc.slice(idx, endIdx);
  }

  it("POST /api/aichat/category-groups (新規作成) は action='category_group_created' を記録する", () => {
    const block = getEndpointBlock(
      "app.post('/api/aichat/category-groups', authMiddleware",
      "app.post('/api/aichat/category-groups/:id/add-category'"
    );
    expect(block).toContain('recordAichatCategoryAudit(c.env.DB');
    expect(block).toContain("action: 'category_group_created'");
    expect(block).toContain("entityType: 'category_group'");
  });

  it("POST .../add-category は action='category_added_to_group' を記録する", () => {
    const block = getEndpointBlock(
      "app.post('/api/aichat/category-groups/:id/add-category'",
      "app.post('/api/aichat/category-groups/:id/remove-category'"
    );
    expect(block).toContain('recordAichatCategoryAudit(c.env.DB');
    expect(block).toContain("action: 'category_added_to_group'");
  });

  it("POST .../remove-category は action='category_removed_from_group' を記録する", () => {
    const block = getEndpointBlock(
      "app.post('/api/aichat/category-groups/:id/remove-category'",
      "app.delete('/api/aichat/category-groups/:id'"
    );
    expect(block).toContain('recordAichatCategoryAudit(c.env.DB');
    expect(block).toContain("action: 'category_removed_from_group'");
  });

  it("DELETE /api/aichat/category-groups/:id は action='category_group_deleted' を記録する", () => {
    const block = getEndpointBlock(
      "app.delete('/api/aichat/category-groups/:id'",
      "/api/aichat/keyword-categories-summary"
    );
    expect(block).toContain('recordAichatCategoryAudit(c.env.DB');
    expect(block).toContain("action: 'category_group_deleted'");
  });

  it("POST /api/aichat/keyword-categories は wasInserted(実際に新規作成された場合)のみ action='keyword_category_created' を記録する", () => {
    const block = getEndpointBlock(
      "app.post('/api/aichat/keyword-categories', authMiddleware",
      "app.post('/api/aichat/keyword-category-map'"
    );
    expect(block).toContain("action: 'keyword_category_created'");
    expect(block).toMatch(/if \(wasInserted && row\) \{/);
  });

  it("POST /api/aichat/keyword-category-map は inserted>0 または deleted>0 の場合のみ action='keyword_classified' を記録する", () => {
    const block = getEndpointBlock(
      "app.post('/api/aichat/keyword-category-map', authMiddleware",
      "app.post('/api/aichat/share-subquery-links'"
    );
    expect(block).toContain("action: 'keyword_classified'");
    expect(block).toMatch(/if \(inserted > 0 \|\| deleted > 0\) \{/);
  });
});

describe('レジストリ登録(aichat_keyword_categories / aichat_keyword_category_map / aichat_category_audit_log)', () => {
  it('3テーブルすべてがSTATUS_TABLE_DEFINITIONSに登録されている', () => {
    ['aichat_keyword_categories', 'aichat_keyword_category_map', 'aichat_category_audit_log'].forEach((name) => {
      expect(indexSrc).toContain(`name: '${name}'`);
    });
  });

  it('aichat_keyword_category_map.category_id は aichat_keyword_categories への論理FKとして登録されている', () => {
    expect(indexSrc).toContain("aichat_keyword_category_map: { user_id: 'user_sessions', category_id: 'aichat_keyword_categories' }");
  });
});
