/**
 * /ai-summary/:id ルートの統合テスト
 *
 * このテストは以下の保証チェーンを形成する:
 *   テストA (aiSummary.test.ts): モーダルのリンクが /ai-summary/{id} を指す
 *   テストB (このファイル):       /ai-summary/{id} がHTMLを返す
 *   A + B = 「リンクをクリックしたらHTMLページが表示される」ことの保証
 *
 * テストAだけではリンク先が存在するか不明。
 * テストBだけではリンクが正しいURL先を指しているか不明。
 * 両方揃って初めて end-to-end の動作が保証される。
 */
import { describe, it, expect, vi } from 'vitest';
import app from '../index';
import { WORKER_BASE_URL, buildSummaryModal, type SummaryModalRow } from '../utils/aiSummary';

const sampleRow = {
  request_id: 'test-uuid-001',
  daily_seq: 3,
  event_date: '2026-03-28',
  repo_full_name: 'owner/repo',
  pr_number: 42,
  pr_action: 'opened',
  pr_url: 'https://github.com/owner/repo/pull/42',
  model: '@cf/google/gemma-4-26b-a4b-it',
  summary: '概要: テスト要約\n変更点: 認証修正',
  diff_length: 500,
  created_at: '2026-03-28T10:00:00Z',
};

function mockDb(row: Record<string, unknown> | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: vi.fn().mockResolvedValue(row),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    }),
  };
}

function makeEnv(row: Record<string, unknown> | null = sampleRow) {
  return {
    DB: mockDb(row),
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    JWT_SECRET: 'test-secret',
    ANALYTICS: undefined,
  };
}

describe('/ai-summary/:id ルート統合テスト', () => {
  it('正常系: 200とHTML(text/html)を返す', async () => {
    const res = await app.request('/ai-summary/test-uuid-001', {}, makeEnv());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('正常系: HTMLに要約テキストが含まれる', async () => {
    const res = await app.request('/ai-summary/test-uuid-001', {}, makeEnv());
    const html = await res.text();

    expect(html).toContain('テスト要約');
    expect(html).toContain('認証修正');
  });

  it('正常系: HTMLにメタ情報（リポジトリ名・PR番号・モデル名）が含まれる', async () => {
    const res = await app.request('/ai-summary/test-uuid-001', {}, makeEnv());
    const html = await res.text();

    expect(html).toContain('owner/repo');
    expect(html).toContain('#42');
    expect(html).toContain('gemma-4-26b-a4b-it');
  });

  it('正常系: HTMLが<!DOCTYPE html>で始まる有効なHTML文書である', async () => {
    const res = await app.request('/ai-summary/test-uuid-001', {}, makeEnv());
    const html = await res.text();

    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  it('異常系: DBにレコードがない場合は404を返す', async () => {
    const res = await app.request('/ai-summary/nonexistent-id', {}, makeEnv(null));

    expect(res.status).toBe(404);
  });

  it('異常系: DBバインディングがない場合は500を返す', async () => {
    const env = { ...makeEnv(), DB: undefined };
    const res = await app.request('/ai-summary/test-uuid-001', {}, env);

    expect(res.status).toBe(500);
  });

  it('正常系: 罫線文字がサニタイズされている', async () => {
    const rowWithBox = { ...sampleRow, summary: '├── 概要: テスト\n└── 影響: なし' };
    const res = await app.request('/ai-summary/test-uuid-001', {}, makeEnv(rowWithBox));
    const html = await res.text();

    expect(html).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(html).toContain('概要: テスト');
  });

  it('正常系: summaryがnullの場合「要約なし」と表示される', async () => {
    const rowNoSummary = { ...sampleRow, summary: null };
    const res = await app.request('/ai-summary/test-uuid-001', {}, makeEnv(rowNoSummary));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('要約なし');
  });
});

describe('保証チェーン: モーダルリンク → ルート到達', () => {
  // モーダルが生成するURLパターンと、ルートが受け付けるURLパターンが一致することを保証する。
  // これが壊れると「リンクを押しても404」になる。

  it('モーダルのHTMLで表示リンクのURLが /ai-summary/:id ルートに到達する', async () => {
    const modalRow: SummaryModalRow = {
      request_id: 'chain-test-001',
      daily_seq: 1,
      event_date: '2026-03-28',
      repo_full_name: 'owner/repo',
      pr_number: 10,
      pr_action: 'opened',
      pr_url: 'https://github.com/owner/repo/pull/10',
      model: '@cf/google/gemma-4-26b-a4b-it',
      summary: 'チェーンテスト用要約',
      diff_length: 100,
      created_at: '2026-03-28T12:00:00Z',
    };

    // Step 1: モーダルからURLを抽出
    const modal = buildSummaryModal(modalRow);
    const allText = JSON.stringify(modal.blocks);
    const urlMatch = allText.match(/https:\/\/[^|>\\]+\/ai-summary\/[^|>\\]+/);
    expect(urlMatch, 'モーダル内にHTMLで表示のURLが見つからない').toBeTruthy();

    // Step 2: 抽出したURLからパスを取り出す
    const fullUrl = urlMatch![0];
    const path = fullUrl.replace(WORKER_BASE_URL, '');
    expect(path).toBe(`/ai-summary/${modalRow.request_id}`);

    // Step 3: そのパスでルートにリクエストし、200が返ることを確認
    const dbRow = { ...sampleRow, request_id: modalRow.request_id, summary: modalRow.summary };
    const res = await app.request(path, {}, makeEnv(dbRow));

    expect(res.status, `${path} が200を返さない`).toBe(200);
    const html = await res.text();
    expect(html, 'レスポンスに要約が含まれない').toContain('チェーンテスト用要約');
  });
});
