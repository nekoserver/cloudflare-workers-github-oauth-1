import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// T3の挙動の契約。私たちのコード(プロキシ・PWAのクライアント)は、T3の次の挙動に頼っている。
// 0.1.8 の公式リリースアーカイブは GitHub の公開 digest と照合し、タグ v0.1.8 の認証・URL処理ソースを再照合した(2026-11-10)。
// ソース根拠は artifacts/container-cli-update-20261110/t3-contract-verification.json。
// 0.1.8 の完全な配布レイアウトでの実起動・ブラウザ検証は未実施。0.1.7 の実機検証を0.1.8の実機成功と扱わない。
// T3の版を上げるときは、テストを先に直す: 新しい版のソースで下の各項目を確かめ直し、CONTRACT_VERIFIED_VERSION を上げてから、
// Dockerfile の T3_VERSION を上げる。確かめないまま版だけ上げると、このテストが失敗する。
const CONTRACT_VERIFIED_VERSION = '0.1.8';
const CONTRACT = [
  { behavior: '/api/auth/session は、認証に失敗した要求に、401ではなく 200 の { authenticated: false } を返す', source: 'サーバー getSessionState の catchIf(isServerAuthCredentialError)' },
  { behavior: 'ほかの認証付きAPIは、認証に失敗すると 401 を返す', source: 'サーバー EnvironmentAuthenticatedAuth' },
  { behavior: '同じ名前のクッキーが複数あると、最初の1つを使う。クッキーが無いときは Authorization: Bearer を使う', source: 'サーバー selectRequestCredential' },
  { behavior: 'セッションのクッキー名は、--host 127.0.0.1 では t3_session_<port>_<状態ディレクトリのハッシュ> で、作り直しても変わらない', source: 'サーバー resolveSessionCookieName' },
  { behavior: '認証していない状態でも、/api/auth/session の auth.sessionCookieName でクッキー名が分かる', source: 'サーバー getSessionState(auth: descriptor)' },
  { behavior: 'POST /api/auth/pairing-token は、ログイン済み(access:write)のセッションで、1回だけ使えるペアリングの資格情報を発行する', source: 'サーバー handle("pairingCredential")' },
  { behavior: '1回だけ使えるペアリングの資格情報の有効期限は5分', source: 'サーバー DEFAULT_ONE_TIME_TOKEN_TTL_MINUTES = minutes(5)' },
  { behavior: '画面は起動時に、URLの #token= か ?token= を読み、自動でペアリングする(/pair 以外のパス)', source: '画面 environments/primary/auth.ts の takePairingTokenFromUrl、shared/remote.ts の getPairingTokenFromUrl' },
  { behavior: '画面は、トークン交換のあと /api/auth/session を最大2秒、100msごとに読み直し、認証済みにならないと「Timed out waiting for authenticated session after bootstrap.」で失敗する', source: '画面 waitForAuthenticatedSessionAfterBootstrap (AUTH_SESSION_ESTABLISH_TIMEOUT_MS=2_000, STEP_MS=100)' },
];

const dockerfile = readFileSync(new URL('../containers/demo/Dockerfile', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../containers/demo/t3-embed-proxy.cjs', import.meta.url), 'utf8');
const stale = readFileSync(new URL('../containers/demo/t3-stale-session.cjs', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../containers/demo/t3-pwa-auth.cjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../containers/demo/t3-pwa-client.js', import.meta.url), 'utf8');

describe('T3の挙動の契約', () => {
  it('Dockerfileで入れるT3の版は、契約を確かめた版と同じ', () => {
    const version = dockerfile.match(/^ARG T3_VERSION=(\S+)/m)?.[1];
    expect(version, `T3_VERSION=${version} は契約を確かめていない。新しい版のソースで契約を確かめ直し、CONTRACT_VERIFIED_VERSION を上げること`).toBe(CONTRACT_VERIFIED_VERSION);
  });
  it('ワンクリックペアリングとPWA認証も同じ固定版のバイナリを使う', () => {
    const server = readFileSync(new URL('../containers/demo/server.js', import.meta.url), 'utf8');
    const nativePath = `/root/.t3/runtime/versions/${CONTRACT_VERIFIED_VERSION}/t3`;
    expect(server).toContain(`const T3_BINARY = '${nativePath}'`);
    expect(auth).toContain(`const nativeBinary = '${nativePath}'`);
  });
  it('公式release digestと照合したネイティブバイナリをビルド時にも検査する', () => {
    expect(dockerfile).toContain('ARG T3_NATIVE_SHA256=9bb28f51f118ebc881b04859848e8895458e7f26c13d44e07d316442f8422074');
    expect(dockerfile).toContain('${T3_NATIVE_SHA256}  /root/.t3/runtime/versions/${T3_VERSION}/t3');
  });
  it('契約の各項目に、根拠(T3のソースの箇所)がある', () => {
    for (const item of CONTRACT) { expect(item.behavior.length).toBeGreaterThan(0); expect(item.source.length).toBeGreaterThan(0); }
  });
  it('契約に頼っているコードが、契約と同じ場所・形を使っている', () => {
    expect(proxy).toContain("'/api/auth/session'");
    expect(stale).toMatch(/status === 200 && unauthenticated === true/);
    expect(auth).toContain("path: '/api/auth/pairing-token'");
    expect(client).toContain("'/#token='");
  });
});
