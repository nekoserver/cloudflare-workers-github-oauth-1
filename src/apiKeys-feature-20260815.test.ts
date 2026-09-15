import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { getApiKeysPage } from './views/apiKeys';

// 対象: 🔑キー管理ページ(/api-keys)・関連API(/api/api-keys 系)・
// トップページ(GET /)のAPIキーによるログイン判定機能、および各ページの
// 右上ドロップダウンメニューへの「🔑 キー管理」導線追加。
//
// 背景: トップページにAPIキー付きでアクセスして、正式なユーザーかどうか
// (キー自体の失効・期限切れ、およびキー発行者アカウント自体の無効化)を
// 判定してログイン判定する機能を追加した。生キーはDBに保存せずSHA-256の
// ハッシュ値のみ保存し、発行時に一度だけ画面に表示する。
//
// 故障シナリオ:
//   (1) DEFAULT_AICHAT_MODELS等と同様、フロントエンド(ドロップダウン導線・
//       キー管理ページ)だけ追加してサーバー側APIエンドポイントへの
//       登録漏れが起きる
//   (2) /status ページのテーブル一覧(STATUS_TABLE_DEFINITIONS)・PK/FK/UK/IDX
//       バッジ用のTABLE_COLUMN_KEYS等への登録漏れ(CLAUDE.mdルール23)
//   (3) GET / のAPIキー判定分岐が、セッションJWTのBearerトークンと
//       誤って混同してしまう(APIキーはnkapi_プレフィックスで判別する)
//   (4) 新規追加した🔑キー管理ページのドロップダウンに、他ページと異なる
//       項目セットが入ってしまう(ページ間でナビが食い違う)

const DROPDOWN_FILES = [
  'welcome.ts',
  'aichat.ts',
  'repositories.ts',
  'settings.ts',
  'status.ts',
  'tsubuyaki.ts',
  'userinfo.ts',
  'apiKeys.ts',
];

describe('各ページのドロップダウンメニューに🔑キー管理への導線が追加されている', () => {
  DROPDOWN_FILES.forEach((file) => {
    it(`${file} のドロップダウンに /api-keys リンクが含まれる`, () => {
      const src = readFileSync(resolve(__dirname, 'views', file), 'utf-8');
      expect(src).toContain('<a href="/api-keys" class="dropdown-item">🔑 キー管理</a>');
    });
  });
});

describe('🔑キー管理ページ(/api-keys)のHTML', () => {
  const html = getApiKeysPage({ name: 'テストユーザー', username: 'testuser' });

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('新規発行フォーム(ラベル入力・有効期限選択)が存在する', () => {
    expect(html).toContain('id="newKeyLabel"');
    expect(html).toContain('id="newKeyExpiry"');
    expect(html).toContain('<option value="30">30日</option>');
    expect(html).toContain('<option value="90">90日</option>');
    expect(html).toContain('<option value="null">無期限</option>');
  });

  it('一覧取得・発行・失効のAPI呼び出しが実装されている', () => {
    expect(html).toContain("fetch('/api/api-keys'");
    expect(html).toContain("method: 'POST'");
    expect(html).toContain('/revoke');
  });

  it('生キーは発行直後の一度だけ表示するモーダルを持つ', () => {
    expect(html).toContain('id="rawKeyModal"');
    expect(html).toContain('showRawKeyModal(res.data.rawKey, res.data.countdownNotice, res.data.countdown)');
  });

  it('一覧描画時にラベルやプレフィックスをエスケープしている(XSS対策)', () => {
    expect(html).toContain('function escapeHtmlClient(s)');
    expect(html).toContain('escapeHtmlClient(item.label)');
    expect(html).toContain('escapeHtmlClient(displayKey)');
  });

  it('失効ボタンのonclickは\\\'エスケープではなく&#39;エンティティを使う(CLAUDE.mdルール29)', () => {
    expect(html).not.toMatch(/requestRevoke\(\\'/);
    expect(html).toContain('requestRevoke(&#39;');
  });

  it('一覧表示のキーはtruncateKeyDisplayと同じロジック(前半のみ)で切り詰められる', () => {
    expect(html).toContain('function truncateKeyDisplayClient(keyPrefix)');
    expect(html).toContain('var half = Math.ceil(keyPrefix.length / 2)');
    expect(html).toContain('return keyPrefix.slice(0, half)');
  });

  it('キー表示はテキストエリアに埋め込まれ、右側にコピーボタン・失効ボタンが並ぶ', () => {
    expect(html).toContain('class="key-textarea');
    expect(html).toContain('readonly');
    expect(html).toContain('onclick="copyKeyText(this)"');
    expect(html).toContain('📋 コピー');
    expect(html).toContain('🗑️ 失効');
  });

  it('コピーボタンはClipboard APIでテキストエリアの内容をコピーし、失敗時はフォールバックする', () => {
    expect(html).toContain('function copyKeyText(btn)');
    expect(html).toContain("querySelector('.key-textarea')");
    expect(html).toContain('navigator.clipboard.writeText(text)');
    expect(html).toContain('function fallbackCopy(textarea)');
  });

  it('失効は最上位レイヤーの確認モーダル(いいえ/はい)を経由し、confirm()は使わない', () => {
    expect(html).toContain('id="revokeConfirmModal"');
    expect(html).toContain('このキーの権限を削除しますか');
    expect(html).toContain('>いいえ</button>');
    expect(html).toContain('onclick="confirmRevoke()">はい</button>');
    expect(html).not.toContain('confirm(\'このAPIキーを失効させますか');
  });

  it('確認モーダルはgetNextZ()で動的にz-indexを算出してから表示する(CLAUDE.mdルール26)', () => {
    expect(html).toContain('function getNextZ()');
    expect(html).toContain("staticZDefaults = { rawKeyModal: 2000, revokeConfirmModal: 2000 }");
    const idx = html.indexOf('function requestRevoke(id)');
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("modal.style.zIndex = String(getNextZ())");
    expect(block).toContain("modal.classList.add('show')");
  });

  it('確認モーダルで「はい」を押したときのみ失効APIを呼び、対象IDは保留状態(pendingRevokeId)経由で受け渡す', () => {
    expect(html).toContain('var pendingRevokeId = null');
    expect(html).toContain('function confirmRevoke()');
    const idx = html.indexOf('function confirmRevoke()');
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('/revoke');
  });

  it('ページ読み込み時に失効済みキーはテキストエリアの背景色を薄ピンクにするクラスが付与される', () => {
    expect(html).toContain('key-revoked-bg');
    expect(html).toContain("(revoked ? ' key-revoked-bg' : '')");
    expect(html).toContain('#ffd6e0');
  });
});

describe('index.ts: APIキー関連のサーバー側実装', () => {
  const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');

  it('/api/api-keys のGET(一覧)・POST(発行)エンドポイントがauthMiddlewareで保護されている', () => {
    expect(src).toContain("app.get('/api/api-keys', authMiddleware,");
    expect(src).toContain("app.post('/api/api-keys', authMiddleware,");
  });

  it('/api/api-keys/:id/revoke がauthMiddlewareで保護されている', () => {
    expect(src).toContain("app.post('/api/api-keys/:id/revoke', authMiddleware,");
  });

  it('/api-keys ページルートがauthMiddlewareで保護されている', () => {
    expect(src).toContain("app.get('/api-keys', authMiddleware,");
  });

  it('APIキー発行時に生キーをそのまま保存せずハッシュ化している', () => {
    const idx = src.indexOf("app.post('/api/api-keys', authMiddleware,");
    const block = src.slice(idx, idx + 2000);
    expect(block).toContain('generateApiKeySecret()');
    expect(block).toContain('hashApiKey(rawKey)');
    expect(block).toContain('INSERT INTO api_keys');
  });

  it('失効エンドポイントは自分が発行したキーのみ(user_idで絞り込み)失効させる', () => {
    const idx = src.indexOf("app.post('/api/api-keys/:id/revoke', authMiddleware,");
    const block = src.slice(idx, idx + 1000);
    expect(block).toContain('WHERE id = ? AND user_id = ?');
  });

  it('GET / はAuthorizationヘッダのトークンがAPIキー形式(nkapi_)の場合にセッションJWTと分岐する', () => {
    const idx = src.indexOf("app.get('/', async (c) => {");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 2000);
    expect(block).toContain('extractBearerToken(');
    expect(block).toContain('isApiKeyToken(bearerToken)');
    expect(block).toContain('checkApiKeyAuth(');
    expect(block).toContain('loggedIn: true');
    expect(block).toContain("loggedIn: false, reason: result.reason");
  });

  it('GET / のAPIキー判定はcheckApiKeyAuth経由で発行者アカウント(user_sessions)のrevoke状態も見る(共通ロジックの再利用)', () => {
    const apiKeysSrc = readFileSync(resolve(__dirname, 'utils', 'apiKeys.ts'), 'utf-8');
    const idx = apiKeysSrc.indexOf('export async function checkApiKeyAuth(');
    expect(idx).toBeGreaterThan(-1);
    const block = apiKeysSrc.slice(idx, idx + 700);
    expect(block).toContain('FROM user_sessions WHERE user_id = ?');
    expect(block).toContain('accountRevoked');
  });

  it('/api/aichat はaichatAuthMiddlewareでAPIキーまたはセッションJWTのどちらでも認証できる(他エンドポイントはauthMiddlewareのまま)', () => {
    expect(src).toContain("app.post('/api/aichat', aichatAuthMiddleware,");
    expect(src).toContain("app.get('/api/protected', authMiddleware,");
  });

  it('migration 0103 で api_keys テーブルが作成される(生キーではなくkey_hashのみ保存)', () => {
    const idx = src.indexOf("'0103':");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 700);
    expect(block).toContain('CREATE TABLE IF NOT EXISTS api_keys');
    expect(block).toContain('key_hash TEXT NOT NULL');
    expect(block).not.toContain('raw_key');
    expect(block).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash');
  });

  it('STATUS_TABLE_DEFINITIONS に api_keys(migration 0103)が登録されている', () => {
    expect(src).toContain("{ name: 'api_keys', migration: '0103'");
  });

  it('TABLE_COLUMN_KEYS・TABLE_GROUP_MAP・COLUMN_FK_TARGETS に api_keys が登録されている(CLAUDE.mdルール23)', () => {
    expect(src).toContain("api_keys: { id: 'pk', user_id: 'fk+idx', key_hash: 'uk' }");
    expect(src).toMatch(/team_members: 'auth', api_keys: 'auth'/);
    expect(src).toContain("api_keys: { user_id: 'user_sessions' }");
  });
});
