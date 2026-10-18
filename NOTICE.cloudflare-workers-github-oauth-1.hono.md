# Honoの既知脆弱性と更新状況

確認日: 2026-10-18 UTC  
対象リポジトリ: `nekoserver/cloudflare-workers-github-oauth-1`  
更新前: Hono 4.11.9  
ローカル更新後: Hono 4.13.13

## 概要

依存監査で、Hono 4.11.9を影響対象とする複数の既知脆弱性を検出した。以下は代表的な5件であり、検出したアドバイザリすべての一覧ではない。

影響対象のバージョンを使用していることと、アプリケーションで実際に悪用可能であることは区別する。各脆弱性の成立には、対象機能と該当する設定・入力経路の使用が必要。

## 脆弱性の概要・修正版・公開日

下表の日付は修正版パッケージのnpm公開日（UTC）。改修コミットの作成日や、本Workerへの適用・デプロイ日とは異なる。アドバイザリはHono公式リポジトリの情報を参照した。

| 問題 | 深刻度 | 影響対象 | 修正版 | 修正版公開日（UTC） |
| --- | --- | --- | --- | --- |
| 静的ファイルの認証回避 | High | 4.12.4未満 | 4.12.4 | 2026-03-03 |
| 認証情報付きCORSのOrigin制限不備 | High | 4.12.25未満 | 4.12.25 | 2026-06-09 |
| JWT日時クレームの検証不備 | Low | 4.12.18未満 | 4.12.18 | 2026-05-06 |
| CORSヘッダー処理によるDoS | Moderate | 4.12.34未満 | 4.12.34 | 2026-08-03 |
| JSXサーバー描画時のXSS | Moderate | 4.13.7未満 | 4.13.7 | 2026-09-04 |

### 静的ファイルの認証回避

CVE-2026-29045 / GHSA-q5qw-h33p-qvwr。

ルーターと `serveStatic` でURLのデコード方法が異なるため、特定のエンコードを含むパスでルート単位の認証ミドルウェアを回避し、保護された静的ファイルを閲覧できる問題。ルート単位の認証と、同じ静的ルートを使う `serveStatic` の併用が条件となる。静的ルートの外にある任意のファイルを読み取れる問題ではない。

公式情報: [GHSA-q5qw-h33p-qvwr](https://github.com/honojs/hono/security/advisories/GHSA-q5qw-h33p-qvwr)。

### 認証情報付きCORSのOrigin制限不備

CVE-2026-54290 / GHSA-88fw-hqm2-52qc。

`credentials: true` を指定し、`origin` を未設定またはワイルドカードとした構成で、リクエストのOriginを反映して許可してしまう問題。悪意ある別サイトから、ログイン済みユーザーのCookie付きAPI応答を読み取ったり、状態変更要求を行ったりできる場合がある。

公式情報: [GHSA-88fw-hqm2-52qc](https://github.com/honojs/hono/security/advisories/GHSA-88fw-hqm2-52qc)。

### JWT日時クレームの検証不備

CVE-2026-44459 / GHSA-hm8q-7f3q-5f36。

HonoのJWT検証で `exp`、`nbf`、`iat` の型や値の確認が不十分なため、不正な日時クレームを持つ署名済みトークンが期限などの検証を通過する場合がある。

匿名の攻撃者が署名を偽造できる問題ではない。不正なクレームを持つトークンをアプリ自身が発行する、または署名鍵を攻撃者が扱えるなどの条件が必要。正常なクレームを発行し、署名鍵を保護している構成は、この問題の影響を受けない。

公式情報: [GHSA-hm8q-7f3q-5f36](https://github.com/honojs/hono/security/advisories/GHSA-hm8q-7f3q-5f36)。

### CORSヘッダー処理によるDoS

CVE-2026-69207 / GHSA-8j4g-w8fx-2239。

CORSのプリフライト要求を処理する際、細工した `Access-Control-Request-Headers` に対する正規表現処理が大量のCPU時間を消費する問題。応答の遅延・サービス妨害につながる。`allowHeaders` が未設定または空の場合が対象で、非空の許可ヘッダーを明示した構成は該当処理へ到達しない。

公式情報: [GHSA-8j4g-w8fx-2239](https://github.com/honojs/hono/security/advisories/GHSA-8j4g-w8fx-2239)。

### JSXサーバー描画時のXSS

GHSA-hxh3-vqpv-xpqv。確認時点のアドバイザリにCVE番号の記載はない。

`Suspense`、`ErrorBoundary`、`Context.Provider`、一部のサーバーレンダリングAPIで、文字列が適切にHTMLエスケープされない問題。攻撃者が制御できる文字列を該当箇所へ渡した場合、HTML注入・XSSにつながる。すべてのJSX描画が無条件に影響するわけではない。

公式情報: [GHSA-hxh3-vqpv-xpqv](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv)。

## 本Workerへの影響の切り分け

[src/index.ts](src/index.ts) のCORS設定は、許可リストに一致するOriginだけを返し、`allowHeaders: ['Content-Type', 'Authorization']` を明示している。

このため、上記のCORS Origin制限不備とCORS DoSについては、確認した設定がそれぞれの成立条件に該当しない。依存監査のHigh判定を、そのまま「本Workerで認証回避・情報漏えいが成立する」とは扱わない。

主要なJWT生成・検証には [src/utils/jwt.ts](src/utils/jwt.ts) の独自Web Crypto実装を使用している。HonoのJWTヘルパーに対するアドバイザリを、独自実装の問題と同一視しない。静的ファイル・JSX等については、個別の入力経路まで含めた悪用可能性の評価を完了していない。実際の侵害・悪用は今回の調査では確認していない。

## 更新と検証の状態

- `package.json` のHono指定を `^4.13.13` に更新し、lockfileの解決版は4.13.13とした。同版のnpm公開日は2026-10-04 UTC。
- 更新後の `npm audit` は開発依存を含めて0件。ただし、監査結果は未知の問題やアプリ独自の問題がないことを保証しない。
- Hono更新で生じたURLパラメーターの型互換性について、必須値の検証を追加した。
- 関連11ファイル・70テストが成功。更新で増えた型エラー26件は解消し、更新前と同じ46件の型エラーが残ることを確認した。
- 変更は `fix/container-security-updates` ブランチで管理する。本番Workerの再デプロイはしていない。
- Dockerビルドはこのコンテナ上では実行禁止。Claude Code Web上でOpus 5.5以上を使用する場合にのみ実行するというユーザー指定を維持する。

更新・未検証範囲の詳細: [更新REPORT](REPORT.cloudflare-workers-github-oauth-1.CONTAINER-SECURITY-UPDATES.20261018.md)。

公開日の確認元: [npm公式レジストリのHono公開履歴](https://registry.npmjs.org/hono)。
