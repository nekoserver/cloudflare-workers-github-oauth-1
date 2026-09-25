import { describe, expect, it } from 'vitest';
import app from './index';

// 対象: POST /webhook/github が webhook_log へ記録するpayload。
//
// 背景: rust-worker-sqlx-d1の/webhook-logページ等、個別リポジトリ向けに
// `payload LIKE '%<repo>%'` で絞り込むページが常に0件になるという報告があった。
// 調査の結果、logWebhookEvent()へ渡すpayloadが { action, deliveryId } のみで
// repository.full_nameを一切含んでおらず、絞り込みが原理的にヒットしようが
// ない状態だったことが判明した(webhook_logへの記録自体は行われていた)。
//
// このテストは、webhook_logへ実際に書き込まれるSQLのbind引数を捕捉し、
// payload(JSON文字列)にrepository.full_nameが含まれることを実データフローで
// 検証する(payload組み立てロジックをソーステキストのgrepではなく、
// 実際にHTTPリクエストをapp.requestへ投げてD1書き込み引数を確認する)。
//
// 故障シナリオ:
//   (1) payloadにrepositoryフィールドが含まれず、個別リポジトリ向けページの
//       LIKE絞り込みが今後も常に空になる(今回のバグの再発)
//   (2) repositoryが存在するイベントで、full_nameではなく別のプロパティ
//       (name等)を誤って参照し、意図しない値が入る
//   (3) installation等repositoryを持たないイベントでリクエスト自体が
//       例外を投げてしまう(repositoryが無いケースの後方互換崩れ)

const secret = 'test-github-webhook-secret';

async function signBody(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

interface BindCall {
  sql: string;
  args: unknown[];
}

function createRecordingDb() {
  const calls: BindCall[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => {
        calls.push({ sql, args });
        return {
          run: () => Promise.resolve({ success: true }),
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] }),
        };
      },
    }),
  };
  return { db, calls };
}

async function postGithubWebhook(body: string, env: Record<string, unknown>) {
  const signature = await signBody(body);
  return app.request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': 'delivery-test-1',
      },
      body,
    },
    env
  );
}

function findWebhookLogInsert(calls: BindCall[]): BindCall | undefined {
  return calls.find((call) => call.sql.includes('INSERT INTO webhook_log'));
}

describe('POST /webhook/github: webhook_logへの記録にrepositoryが含まれる', () => {
  it('repository付きイベント(push)で、記録されるpayloadにrepository.full_nameが含まれる', async () => {
    const { db, calls } = createRecordingDb();
    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rust-worker-sqlx-d1', full_name: 'nekoserver/rust-worker-sqlx-d1', private: false },
      commits: [],
    });

    const response = await postGithubWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db });
    expect(response.status).toBe(200);

    const insertCall = findWebhookLogInsert(calls);
    expect(insertCall).toBeDefined();
    // INSERT INTO webhook_log (source, event_type, status, payload, error, received_at)
    const payloadArg = insertCall!.args[3] as string;
    expect(payloadArg).toBeTypeOf('string');
    const parsedPayload = JSON.parse(payloadArg);
    expect(parsedPayload.repository).toBe('nekoserver/rust-worker-sqlx-d1');
  });

  it('repositoryを持たないイベント(installation)でも例外にならず、repositoryはnullとして記録される', async () => {
    const { db, calls } = createRecordingDb();
    const body = JSON.stringify({
      action: 'created',
      installation: { id: 123 },
    });

    const signature = await signBody(body);
    const response = await app.request(
      '/webhook/github',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Event': 'installation',
          'X-GitHub-Delivery': 'delivery-test-2',
        },
        body,
      },
      { GITHUB_WEBHOOK_SECRET: secret, DB: db }
    );
    expect(response.status).toBe(200);

    const insertCall = findWebhookLogInsert(calls);
    expect(insertCall).toBeDefined();
    const payloadArg = insertCall!.args[3] as string;
    const parsedPayload = JSON.parse(payloadArg);
    expect(parsedPayload.repository).toBeNull();
  });
});
