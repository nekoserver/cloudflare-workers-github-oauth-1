/**
 * POST /api/aichat/vectorize-answer の統合テスト
 *
 * 対象: answer-graphの回答モーダル「ベクタ化する」ボタンで、埋め込みモデルを
 * 選択できるようにした変更。
 *   1. bodyのmodelを検証し(KEYWORD_EMBEDDING_MODELSに存在するもののみ許可)、
 *      指定された埋め込みモデルを実際のベクタ化処理に使う
 *   2. 予備知識キーワード抽出(gemma-4-26b-a4b-it)が長時間応答しない場合、
 *      Cloudflare側の内部タイムアウトを待たずに一定時間で見切りをつけて
 *      エラーとして返す(「ベクタ化処理が終わらない」症状の対処)
 *
 * 故障シナリオ:
 *   (1) 未知のmodelを指定してもエラーにならず、サーバー側で意図しない
 *       モデルへ問い合わせてしまう
 *   (2) modelが未指定の場合に従来のデフォルト(plamo-embedding-1b)から
 *       挙動が変わってしまう
 *   (3) 予備知識抽出のAI呼び出しが長時間応答しない場合、リクエスト全体が
 *       ハングしたままレスポンスが返らない(ユーザーからは「ベクタ化処理が
 *       終わらない」ように見える)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { PLAMO_EMBEDDING_MODEL, PREREQUISITE_TERMS_TIMEOUT_MS } from './index';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeDb(shareRow: { id: string; answer: string } | null) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('user_sessions')) {
        return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }) };
      }
      if (sql.includes('SELECT id, answer FROM ai_chat_shares')) {
        return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(shareRow) }) };
      }
      if (sql.includes('SELECT vector FROM aichat_answer_vectors')) {
        return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }) };
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };
    }),
  };
}

function makeEnv(db: unknown, ai: unknown) {
  return { DB: db, AI: ai, JWT_SECRET };
}

describe('POST /api/aichat/vectorize-answer: 埋め込みモデル選択', () => {
  it('未知のmodelを指定すると400で拒否され、AIは呼ばれない', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const ai = { run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] }) };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1', model: '@cf/unknown/not-a-real-model' }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(400);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('modelを指定するとその埋め込みモデルで問い合わせ、レスポンスのmodelにも反映される', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const ai = {
      run: vi.fn().mockImplementation((model: string) => {
        if (model === '@cf/baai/bge-m3') return Promise.resolve({ data: [[0.1, 0.2, 0.3]] });
        return Promise.resolve({ response: '用語1\n用語2' });
      }),
    };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1', model: '@cf/baai/bge-m3' }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(200);
    const bodyJson = await res.json() as {
      model: string;
      keywordVectorization: Array<{ keyword: string; similarityScore?: number }>;
    };
    expect(bodyJson.model).toBe('@cf/baai/bge-m3');
    expect(bodyJson.keywordVectorization).toEqual([
      { keyword: '用語1', alreadyRegistered: false, similarityScore: 1 },
      { keyword: '用語2', alreadyRegistered: false, similarityScore: 1 },
    ]);
    expect(ai.run).toHaveBeenCalledWith('@cf/baai/bge-m3', expect.anything());
  });

  it('forcePlamo=trueの場合、未知のmodelを指定しても400にならず強制的にplamo-embedding-1bで問い合わせる(AIチャット✂️ボタン専用フラグ)', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const ai = {
      run: vi.fn().mockImplementation((model: string) => {
        if (model === PLAMO_EMBEDDING_MODEL) return Promise.resolve({ data: [[0.1, 0.2, 0.3]] });
        return Promise.resolve({ response: '' });
      }),
    };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', forcePlamo: true }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(200);
    const bodyJson = await res.json() as { model: string; vectorized: boolean };
    expect(bodyJson.vectorized).toBe(true);
    expect(bodyJson.model).toBe(PLAMO_EMBEDDING_MODEL);
    expect(ai.run).toHaveBeenCalledWith(PLAMO_EMBEDDING_MODEL, expect.anything());
  });

  it('forcePlamoが無い(またはfalse)場合は、従来通り未知のmodelは400で拒否される(answer-graphのモデル選択への影響なし)', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const ai = { run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] }) };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1', model: '@cf/unknown/not-a-real-model', forcePlamo: false }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(400);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('model未指定時は従来通りplamo-embedding-1bがデフォルトになる', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const ai = {
      run: vi.fn().mockImplementation((model: string) => {
        if (model === PLAMO_EMBEDDING_MODEL) return Promise.resolve({ data: [[0.1, 0.2, 0.3]] });
        return Promise.resolve({ response: '' });
      }),
    };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(200);
    const bodyJson = await res.json() as { model: string };
    expect(bodyJson.model).toBe(PLAMO_EMBEDDING_MODEL);
  });
});

describe('POST /api/aichat/vectorize-answer: 予備知識キーワード抽出が失敗してもベクタ化自体は成功扱いのまま', () => {
  it('gemmaの呼び出しが失敗しても、ベクタ化は成功しキーワードは空配列・_keywordsWarningにエラー理由が入る', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const ai = {
      run: vi.fn().mockImplementation((model: string) => {
        if (model === PLAMO_EMBEDDING_MODEL) return Promise.resolve({ data: [[0.1, 0.2, 0.3]] });
        return Promise.reject(new Error('3046: Request timeout'));
      }),
    };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(200);
    const bodyJson = await res.json() as { vectorized: boolean; keywords: string[]; _keywordsWarning: string | null };
    expect(bodyJson.vectorized).toBe(true);
    expect(bodyJson.keywords).toEqual([]);
    expect(bodyJson._keywordsWarning).toContain('3046: Request timeout');
  });
});

describe('POST /api/aichat/vectorize-answer: 意味の薄い予備知識キーワードの事前排除', () => {
  it('英数字だけの語・ひらがなカタカナ1文字の語はレスポンスにもベクタ化対象にも含まれない', async () => {
    const auth = await makeAuthHeader();
    const db = makeDb({ id: 's1', answer: 'テスト回答' });
    const embedCalls: string[] = [];
    const ai = {
      run: vi.fn().mockImplementation((model: string, params: { messages?: { content: string }[] }) => {
        if (model === PLAMO_EMBEDDING_MODEL && params.messages) {
          // vectorizeAnswerKeywordsの個別キーワード埋め込み呼び出しを記録
          embedCalls.push(params.messages[0].content);
          return Promise.resolve({ data: [[0.1, 0.2]] });
        }
        if (model === PLAMO_EMBEDDING_MODEL) return Promise.resolve({ data: [[0.1, 0.2, 0.3]] });
        return Promise.resolve({ response: '新幹線\nA\nGPT4\nあ\n改札' });
      }),
    };

    const res = await app.request('/api/aichat/vectorize-answer', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(200);
    const bodyJson = await res.json() as { keywords: string[] };
    expect(bodyJson.keywords).toEqual(['新幹線', '改札']);
  });
});

describe('withTimeout', () => {
  it('元のPromiseが規定時間内に解決すればその値をそのまま返す', async () => {
    const { withTimeout } = await import('./index');
    const result = await withTimeout(Promise.resolve('ok'), 1000, 'timeout');
    expect(result).toBe('ok');
  });

  it('元のPromiseが規定時間内に解決しない場合は指定メッセージで拒否する(ハングしない)', async () => {
    vi.useFakeTimers();
    const { withTimeout } = await import('./index');
    const neverResolves = new Promise<string>(() => {});

    const resultPromise = withTimeout(neverResolves, PREREQUISITE_TERMS_TIMEOUT_MS, 'タイムアウトしました');
    const assertion = expect(resultPromise).rejects.toThrow('タイムアウトしました');
    await vi.advanceTimersByTimeAsync(PREREQUISITE_TERMS_TIMEOUT_MS);
    await assertion;
    vi.useRealTimers();
  });
});
