import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// T3の挙動の契約。私たちのコード(プロキシ・PWAのクライアント)は、T3の次の挙動に頼っている。
// どれも、T3 0.1.7 の公式リリース(t3-0.1.7-linux-x64.tar.gz、SHA256SUMSと照合済み)とタグ v0.1.7(322f6544)のソースで確かめた(2026-11-06)。
// 0.1.9(タグ v0.1.9、24e77473)のソースで各項目の根拠の箇所を確かめ直した(2026-11-11)。getSessionState・selectRequestCredential・resolveSessionCookieName・
// DEFAULT_ONE_TIME_TOKEN_TTL_MINUTES・takePairingTokenFromUrl・waitForAuthenticatedSessionAfterBootstrap は 0.1.7 と同じ。pairingCredential は
// access:write が要るのは同じで、任意の access(MCPクライアント向け)が足されただけ。公式リリース t3-0.1.9-linux-x64.tar.gz は SHA256SUMS にある。
// 0.1.10(タグ v0.1.10、7d32075e)のソースで全9項目を確かめ直した(2026-11-18)。全項目とも 0.1.9 と同じ。置き場所の変化だけ:
// resolveSessionCookieName は auth/utils.ts。takePairingTokenFromUrl の下に peekPairingTokenFromUrl が足され、take は peek+除去に再構成された。
// 同名クッキーの先勝ちは T3 本体でなく effect 4.1.3(T3 の pnpm-lock で固定)の Cookies.parseHeader が決める: キーが無ければ代入する形で、
// npm の tarball のソースで確かめた。公式リリース t3-0.1.10-linux-x64.tar.gz は SHA256SUMS にある(9bea9d36…)。
// 画面以外は、別のポートと状態ディレクトリで起動した実物でも確かめた。0.1.7 で GET /api/auth/clients は無くなった(このリポジトリは使っていない)。
// T3の版を上げるときは、テストを先に直す: 新しい版のソースで下の各項目を確かめ直し、CONTRACT_VERIFIED_VERSION を上げてから、
// Dockerfile の T3_VERSION を上げる。確かめないまま版だけ上げると、このテストが失敗する。
// 0.1.11(タグ v0.1.11、59651c17)のソースで全9項目を確かめ直した(2026-11-21)。全項目とも 0.1.10 と同じ: getSessionState・selectRequestCredential・
// EnvironmentAuthenticatedAuth(packages/contracts/src/environmentHttp.ts)・resolveSessionCookieName(auth/utils.ts は差分なし)・pairingCredential(access:write)・
// DEFAULT_ONE_TIME_TOKEN_TTL_MINUTES = minutes(5)・getPairingTokenFromUrl(packages/shared/src/remote.ts)・takePairingTokenFromUrl/peekPairingTokenFromUrl・
// waitForAuthenticatedSessionAfterBootstrap(2秒・100ms)。effect は pnpm-lock で 4.1.3 のまま。違いは、画面の文言が多言語化された(m(msg(...)))ことだけで、
// 9番目の失敗メッセージの文字列は、表示の言語によって変わりうる(挙動は同じ。このリポジトリのコードは、その文字列に頼っていない)。
const CONTRACT_VERIFIED_VERSION = '0.1.11';
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
