import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getWorkflowPage, type WorkflowStep, type WorkflowSummary } from './views/workflow';

const migration = readFileSync(
  resolve(__dirname, '../migrations/0142_register_public_key_countdown_workflow.sql'),
  'utf-8',
);

describe('/workflow: 公開鍵登録からカウントダウン登録までのワークフロー', () => {
  it('通し番号0013で/public-keysのワークフローを登録する', () => {
    expect(migration).toContain("'0013'");
    expect(migration).toContain("'公開鍵登録からカウントダウン登録'");
    expect(migration).toContain("'/public-keys'");
  });

  it('一覧取得・公開鍵登録APIとカウントダウン自動登録を順番に記録する', () => {
    const listIndex = migration.indexOf("'GET', '/api/public-keys'");
    const registerIndex = migration.indexOf("'POST', '/api/public-keys'");
    const countdownIndex = migration.indexOf('countdown_events');

    expect(listIndex).toBeGreaterThan(-1);
    expect(registerIndex).toBeGreaterThan(listIndex);
    expect(countdownIndex).toBeGreaterThan(registerIndex);
    expect(migration).toContain('期限付きの場合だけ');
    expect(migration).toContain('無期限の場合は正常にスキップ');
  });

  it('登録結果から/countdownを確認する導線を最後まで記録する', () => {
    expect(migration).toContain('登録済みの場合だけ/countdownへの確認リンク');
    expect(migration).toContain("'カウントダウンを確認'");
    expect(migration).toContain('登録された「PK期限」を確認');
  });

  it('workflowページで階層付きの処理段階として表示できる', () => {
    const workflow: WorkflowSummary = {
      workflow_no: '0013',
      title: '公開鍵登録からカウントダウン登録',
      page_path: '/public-keys',
      summary: '公開鍵の登録と期限カウントダウンの自動登録',
    };
    const steps: WorkflowStep[] = [
      { step_order: 4, stage_title: '公開鍵と有効期限を登録', api_method: 'POST', api_path: '/api/public-keys', note: null, indent_level: 1 },
      { step_order: 5, stage_title: '期限をカウントダウンへ自動登録', api_method: null, api_path: null, note: 'PK期限を追加', indent_level: 2 },
    ];
    const html = getWorkflowPage('test-user', [workflow], { workflow, steps });

    expect(html).toContain('#0013');
    expect(html).toContain('公開鍵登録からカウントダウン登録');
    expect(html).toContain('/api/public-keys');
    expect(html).toContain('期限をカウントダウンへ自動登録');
    expect(html).toContain('margin-left:48px');
  });
});
