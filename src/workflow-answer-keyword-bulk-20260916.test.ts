import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getWorkflowPage, type WorkflowStep, type WorkflowSummary } from './views/workflow';

const migration = readFileSync(
  resolve(__dirname, '../migrations/0143_register_answer_keyword_bulk_workflow.sql'),
  'utf-8',
);

describe('/workflow: 回答文のベクタ化から未登録キーワード一括登録まで', () => {
  it('通し番号0014でanswer-graphのワークフローを登録する', () => {
    expect(migration).toContain("'0014'");
    expect(migration).toContain("'回答文のベクタ化から未登録キーワード一括登録'");
    expect(migration).toContain("'/answer-graph'");
  });

  it('ベクタ化・未登録判定・一括登録を実行順に記録する', () => {
    const vectorizeIndex = migration.indexOf("'POST', '/api/aichat/vectorize-answer'");
    const unregisteredIndex = migration.indexOf('登録件数が0件');
    const searchIndex = migration.indexOf("'GET', '/api/aichat/shares/search'");
    const candidatesIndex = migration.indexOf("'POST', '/api/aichat/search-log/open-modal'");
    const approveIndex = migration.indexOf("'POST', '/api/aichat/search-log/approve'");

    expect(vectorizeIndex).toBeGreaterThan(-1);
    expect(unregisteredIndex).toBeGreaterThan(vectorizeIndex);
    expect(searchIndex).toBeGreaterThan(unregisteredIndex);
    expect(candidatesIndex).toBeGreaterThan(searchIndex);
    expect(approveIndex).toBeGreaterThan(candidatesIndex);
  });

  it('抽出元回答の補完と、項目単位の失敗継続を説明する', () => {
    expect(migration).toContain('抽出元の回答文は検索結果に含まれなくても必ず登録対象');
    expect(migration).toContain('失敗したキーワードは未登録のまま残し');
    expect(migration).toContain('他のキーワードの処理は継続');
  });

  it('workflowページでAPI階層を含む処理段階として表示できる', () => {
    const workflow: WorkflowSummary = {
      workflow_no: '0014',
      title: '回答文のベクタ化から未登録キーワード一括登録',
      page_path: '/answer-graph',
      summary: '回答文のベクタ化、キーワード抽出、未登録キーワードの一括登録',
    };
    const steps: WorkflowStep[] = [
      { step_order: 2, stage_title: '回答文とキーワードをベクタ化', api_method: 'POST', api_path: '/api/aichat/vectorize-answer', note: null, indent_level: 1 },
      { step_order: 7, stage_title: 'キーワードを一括自動登録', api_method: 'POST', api_path: '/api/aichat/search-log/approve', note: null, indent_level: 1 },
    ];
    const html = getWorkflowPage('test-user', [workflow], { workflow, steps });

    expect(html).toContain('#0014');
    expect(html).toContain('回答文のベクタ化から未登録キーワード一括登録');
    expect(html).toContain('/api/aichat/vectorize-answer');
    expect(html).toContain('/api/aichat/search-log/approve');
    expect(html).toContain('margin-left:24px');
  });
});
