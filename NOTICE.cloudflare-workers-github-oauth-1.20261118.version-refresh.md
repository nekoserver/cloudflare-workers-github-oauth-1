# NOTICE: demo コンテナの版の棚卸しと、遅れていた3件の更新（2026-11-18）

本体コンテナの Apache が 2.4.70 のまま起動しない件の切り分けに伴い、Dockerfile の全 pin と上流の最新版を照合した記録。

## 照合結果（2026-11-18、公式の配布元で実測）

最新に一致していたもの（変更なし）: Apache httpd 2.4.71、git 2.56.1、OpenSSH 10.6p2、ruby 4.0.9（4.0 系の最新。4.1 系は別系列として未採用）、Node.js 26.13.1（26 系の最新）、npm 12.2.2、Tailscale 1.104.7、gh 2.104.0、jj 0.47.1、cloudflared 2026.11.1、t3 0.1.10、cf 1.0.0-rc.1、preprint 0.1.2、TypeScript 7.0.2。

遅れていたもの（本 PR で更新）:

| パッケージ | 変更前 | 変更後 | 確認方法 |
|---|---|---|---|
| Codex（@openai/codex） | 0.169.0 | 0.169.1 | 隔離 prefix へ導入し、`codex --version` が `codex-cli 0.169.1` を返すこと、`app-server --help` が動作することを実物で確認 |
| Claude Code（@anthropic-ai/claude-code） | 2.1.326 | 2.1.327 | 隔離 prefix へ導入し、`claude --version` が `2.1.327 (Claude Code)` を返すことを確認 |
| Vitest | 5.0.5 | 5.1.0 | 隔離 prefix へ導入し、`vitest --version` が 5.1.0 を返すことを確認 |

npm registry の integrity（ソースビルド判定の台帳側で使う値）:

- @openai/codex@0.169.1: sha512-2ZP53HuNspqL1lCX9Xc2XfoSq26VjjQ7XC08dTnkpetzH0kkAN1TTM3K1YOSwzAqikCdjQUzMV0haZmdxhPhjg==
- @anthropic-ai/claude-code@2.1.327: sha512-QToNtikIupqVMsxRUdDHUP0nS/uv3Wc43vcbT8YNRo7FtQOE9MvYLqPLQPoVhJ2DQQVPOFMB5PkaBNJbnNYeVg==
- vitest@5.1.0: sha512-MzmNFnrwa8v8lF1bLxw3UJ4EREwVOVb75VqJZmUDRjJ6EluK/x9th7qTbaeDk41WxE1GxWqmTXcdsfobfH5sOA==

## 稼働イメージとの関係

稼働中イメージは `containers/demo/image.lock.json` の記録どおり 2026-11-11 のビルド（builtFrom: main d46051d）で、Apache 2.4.70 と git 2.56.0 を含む。Dockerfile と退避パッケージ（packages/）はその後に 2.4.71 / 2.56.1 へ進んだが、イメージが再ビルドされていないため稼働側へは反映されていない。本 PR は Dockerfile 側を最新の状態にそろえるものであり、復旧には main 側でのイメージ再ビルドとコンテナの再作成が別途必要である。Apache の起動失敗の理由そのものは、コンテナ内の `/tmp/apache-configtest.log`（entrypoint が configtest の出力を残す場所）で確認すること。

## 対象外として記録するもの

`containers/demo/Dockerfile.redmine` は全体が1世代遅れている（tailscale 1.104.1、gh 2.103.0、jj 0.46.0、Node 26.12.1、npm 12.2.0、Codex 0.164.0、Claude 2.1.309、cloudflared 2026.10.1）。Redmine 側はアプリ側の pin（Redmine 7.0.2、Passenger 6.2.1）と組になっているため、本 PR では触らず、遅れている事実だけを記録する。

## テスト

- 対象の4ファイル（codex-cf-contract、tool-updates、ruby、claude-cli）: 16/16 成功。
- `npx vitest run src/cf-containers`: 336/337 成功。失敗1件は `cf-containers-t3-pwa-diagnose-browser.test.ts` で、この環境に Chromium（/opt/pw-browsers）が無いための環境要因であり、本変更とは無関係。
- Docker ビルドはこの環境では行わない（リポジトリの規則）。イメージへの反映確認は再ビルド後に main 側で行う。
