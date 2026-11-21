# NOTICE: demoコンテナの Codex 0.171.0 / Claude 2.1.330 / T3 0.1.11 / Ruby 4.0.10 へ版上げ(2026-11-21)

**対象**: `containers/demo/Dockerfile` の `CODEX_VERSION`・`CLAUDE_VERSION`・`CLAUDE_NATIVE_SHA256`・`T3_VERSION`・`RUBY_VERSION`・`RUBY_SHA256` と、版を固定しているテスト。

## 版と確認(2026-11-21)

| ツール | 旧 | 新 | 確認したこと |
|---|---|---|---|
| Codex CLI | 0.170.0 | 0.171.0 | npm の最新。隔離した prefix に入れ、`codex --version` が `codex-cli 0.171.0`、`codex app-server --help` が動くことを確認 |
| Claude Code | 2.1.327 | 2.1.330 | npm の最新。`@anthropic-ai/claude-code-linux-x64@2.1.330` の tarball を registry の integrity(sha512)と照合してから、中の `claude` の sha256(`f390eaa0…`)を出した。そのバイナリの `--version` が `2.1.330 (Claude Code)` |
| T3 Code | 0.1.10 | 0.1.11 | npm の最新。契約テストの9項目を、タグ v0.1.11 のソースで確かめ直した(下) |
| Ruby | 4.0.9 | 4.0.10 | 2026-11-18公開。sha256(`b53eef33…`)が、リリースノートの値と、取得物の両方で一致 |

## T3 0.1.11 の契約の確認

`src/cf-containers-t3-contract.test.ts` の9項目を、タグ v0.1.10(7d32075e)と v0.1.11(59651c17)のソースで比べた。全項目とも同じ。

- `getSessionState`・`selectRequestCredential`(`apps/server/src/auth/EnvironmentAuth.ts`): 関数の本体が一字一句同じ。
- `EnvironmentAuthenticatedAuth`(`packages/contracts/src/environmentHttp.ts`): 定義が同じ。
- `resolveSessionCookieName`(`apps/server/src/auth/utils.ts`): ファイルに差分なし。
- `pairingCredential`(`apps/server/src/auth/http.ts`): access:write を要求する部分が同じ。
- `DEFAULT_ONE_TIME_TOKEN_TTL_MINUTES = Duration.minutes(5)`: 同じ。
- `getPairingTokenFromUrl`(`packages/shared/src/remote.ts`): 同じ。`takePairingTokenFromUrl`・`peekPairingTokenFromUrl` も同じ。
- `waitForAuthenticatedSessionAfterBootstrap`: 2秒・100msごとで同じ。
- 同名クッキーの先勝ちを決める effect は、pnpm-lock で 4.1.3 のまま。

**違い**: 画面の文言が多言語化された(`m(msg(...))`)。9番目の項目の失敗メッセージ(「Timed out waiting for authenticated session after bootstrap.」)は、表示の言語によって変わりうる。挙動は同じで、このリポジトリのコードは、その文字列に頼っていない(`containers/demo/*.js`・`*.cjs` に、その文字列は無い)。

## 知らないと損すること

- Ruby の最新版の判定で、`cache.ruby-lang.org/pub/ruby/index.txt` の末尾の行を最新とみなすと誤る(4.0.10 の行は、4.0.9 の行より前にある)。版番号で比べること。
- Ruby は、公式の Docker イメージ(`ruby:4.0.10-slim-trixie` など)が出ている。このDockerfileは、許可した形(`src/cf-containers-source-build-allowlist.test.ts`)でソースからビルドしているので、今回はその形のまま版を上げた。公式イメージへ替えるかは、別に決める(Debian のイメージから Ubuntu 26.04 へ持ってくると、共有ライブラリの版がずれうる)。
- T3 の GitHub への API・codeload は、このサンドボックスからは 403 だった。`git clone --filter=blob:none` で取り、必要なファイルだけ `git show` すると速い(`git grep` はファイルを1つずつ取りにいくので遅い)。

## 未確認

- **コンテナのイメージのビルドはしていない**(ルール42: ビルドは実行前に利用者の許可が要る。このサンドボックスには Docker デーモンも無い)。`scripts/check-cf-containers.sh` も実行していない。ビルド・起動の確認は、本番のビルドか、許可を得た環境で行う。
- `containers/demo/image.lock.json` は更新していない(イメージを作り直していないため)。`src/cf-containers-image-lock.test.ts` の「ロックと現在の入力の一致」は、この変更の前から失敗している(main と同じ)。
