# コンテナ・Worker依存の更新報告

作業日: 2026-10-18 UTC  
対象: `nekoserver/cloudflare-workers-github-oauth-1`  
作業元: `main` の `e2417d06`  
作業ブランチ: `fix/container-security-updates`

## 現在の状態

Dockerfile、Worker依存、公開診断経路の設定をローカルで更新した。稼働コンテナの既定Node/npm、Claude専用CLI、Python配信依存も更新した。変更は `fix/container-security-updates` ブランチで管理し、本体Workerのデプロイと新イメージへの置き換えは行っていない。

Dockerビルドはメモリ懸念によりユーザー指示で中止した。その後、ユーザーから検証継続の指示があり、Dockerビルドを伴わない検証を単独・順次実行した。**このコンテナ上ではDockerビルドを行わない**ことを `AGENT.md` と `AGENTS.md` に明記した。

## 1. 更新の根拠

- OSはapt一覧更新後のシミュレーションで、更新0件・保留0件だった。
- `npm audit` はHigh 4、Moderate 2の計6パッケージを検出。本番依存のみではHonoが対象だった。
- システムNode 18は上流EOL。別配置のNode 22.20.0にも後続のセキュリティリリースが存在した。
- Claude CLI、websockets、pipに更新候補があった。
- ローカルのCaddy/Node経由では、認証なしで `/debug/logs` のJSONログを取得できた。公開ホストの応答は200でも本文が空で、外部へのログ本文漏えいは確認していない。

詳細な評価は [Dockerfile再評価書](EVAL.cloudflare-workers-github-oauth-1.Dockerfile.20261018.md) を参照。

## 2. 本リポジトリ内の変更

### Dockerfile

対象: [containers/demo/Dockerfile](containers/demo/Dockerfile)

| 対象 | 更新前 | 更新後 |
| --- | --- | --- |
| Node | aptの18系と別配置22.20.0 | 22.23.3を `/opt/node22` に配置し、PATHの先頭で使用 |
| npm | apt版とNode同梱版 | 11.19.1に固定 |
| Codex CLI | npm最新版を都度取得 | 0.163.0に固定 |
| Claude CLI | npm最新版を都度取得 | 2.1.302に固定 |
| cloudflared | GitHubのlatest | 2026.10.1とSHA-256を固定 |
| Tailscale | 最新インストールスクリプト、失敗時WARNで続行 | 1.104.1の配布アーカイブとSHA-256を固定、失敗はビルド失敗 |
| GitHub CLI | 未導入 | aptインストール対象に `gh` を追加 |

Nodeにも固定SHA-256による検証を追加した。Codex/Claudeはnpmの配布整合性検証を利用する。バイナリやライブラリをまとめて巨大レイヤーに戻さず、既存のレイヤー分割を維持した。

Apacheの `ServerTokens Prod` / `ServerSignature Off` をビルド設定へ追加し、エラーページの製品署名と詳細バージョンの表示を抑制した。`gh` は初回起動時点で導入済みにするが、認証情報をイメージに埋め込まない。

### Workerのnpm依存

対象: [package.json](package.json)、[package-lock.json](package-lock.json)

| パッケージ | 更新前 | lockfile更新後 |
| --- | --- | --- |
| hono | 4.11.9 | 4.13.13 |
| vitest | 4.1.9 | 4.1.12 |
| postcss | 8.5.15 | 8.5.30 |
| nanoid | 3.3.15 | 3.3.20 |
| source-map-js | 1.2.1 | 1.2.2 |
| @vitest/mocker | Vitestの旧間接依存 | Vitestと整合する修正版 |

`package.json` はHonoを `^4.13.13`、Vitestを `^4.1.11` とした。依存解決後の全体監査は、Info/Low/Moderate/High/Criticalすべて0件。`npm audit fix --force` によるメジャー更新は行っていない。

最初のnpm 10系ではpeer依存の解決中に `edgesOut` の内部エラーが発生した。npm 11.19.1で依存解決と `npm ci` をやり直し、lockfileと監査結果を確認した。

### Hono更新に伴う型互換性

更新前のソース・元のlockfileを別worktreeで確認したところ、型エラーは46件だった。更新後は72件で、増えた26件はHonoのURLパラメーターが `string | undefined` として扱われる変更に対応していなかった。

[src/utils/routeParam.ts](src/utils/routeParam.ts) に必須パラメーターの検証を追加し、[src/index.ts](src/index.ts) の該当箇所で使用するよう修正した。未指定や空値を文字列必須の処理・DB問い合わせへ渡さず400で拒否する。[回帰テスト](src/utils/routeParam.test.ts) は、正常な値の保持、未指定時の400、空値の拒否を確認する。

### 公開診断経路

対象: [containers/demo/apache-demo.conf](containers/demo/apache-demo.conf)

公開TLS経路の `/debug` と `/debug/*` をApacheで拒否する設定を追加した。管理者用Workerプロキシが使用するNodeの8080番にはこの制限を追加しておらず、管理用の既存診断経路を維持する。

### ビルド検証スクリプト

対象: [scripts/check-cf-containers.sh](scripts/check-cf-containers.sh)

- `gh --version`、Codex/Claudeの実起動、Node 22以上の使用、Codex補助バイナリの存在確認を追加。
- 公開TLS経路の診断URLが403になることを確認する処理を追加。
- 必須ランタイムを削除した別イメージで検証していた `--offline` は、明示的なエラーに変更。

**このスクリプトの全体実行にはDockerビルドが含まれるため、このコンテナでは実行しない。** ビルドとイメージ起動後の検証は、十分なリソースがある別環境で行う。

## 3. 稼働コンテナへ適用した変更

| 対象 | 適用内容 |
| --- | --- |
| 既定Node | 22.23.3。取得アーカイブのSHA-256を確認 |
| 既定npm | 11.19.1 |
| Claude CLI | 2.1.302。通常PATHと `/opt/claude-web/claude` の専用実行先を更新 |
| Python websockets | 17.1 → 17.2 |
| Python pip | 24.0 → 26.2.1 |
| Caddy | `/debug` と `/debug/*` を404で拒否 |
| Apacheバックエンド | 同じ診断経路を拒否 |

配信とobserverを再起動し、更新したPython依存を反映した。CaddyとApacheの設定も再読み込みした。すでに起動していたNodeサーバープロセスは停止しておらず、新ランタイムでの起動には再起動が必要。

UbuntuのApache/OpenSSL/OpenSSH/Caddy等はaptの候補と一致していた。CaddyはUbuntuセキュリティ修正版を維持し、上流の版番号だけを理由に別配布版へ置き換えていない。Codex/cloudflared/Tailscaleも確認時点の最新版と一致していたため、稼働中バイナリの更新は不要だった。

Python依存の固定値は別リポジトリ `/var/www/html/lib/ops/chat-websocket-requirements.txt` でも更新した。この変更や稼働中のCaddy設定・専用CLI配置は、このWorkerリポジトリのDockerfileへすべて組み込まれたわけではない。

## 4. 検証結果

確認済み:

- 更新後の `npm audit` は開発依存を含めて0件。
- shellの構文チェックと `git diff --check` が成功。
- libのJavaScript 32件、Python配信29件、ワーカー20件、Ruby4件が成功。
- 隔離環境からNode 22.23.3、Claude 2.1.302の起動が成功。
- 公開URL経由で、正常HMACの200、不正鍵の401、Secure/HttpOnly Cookie、署名付きGETのクエリ保持・結果取得を確認。
- WebSocket/SSE/NDJSON/JSON-seqで、認証後の会話本文と継続更新を受信。
- Caddyの `/debug`、`/debug/logs`、`/debug/net?probe=1` は404、埋め込みHTMLは200。
- 全体テストでタイムアウトしたairlineNetworkの1件を単独実行したところ成功（1 passed、他66件は対象外）。

追加確認結果:

- コンテナ・JWT・セッション・必須URLパラメーターの11ファイル・70テストが成功。
- Hono更新で増えた26件の型エラーは解消。再チェックは更新前と同じ46件で、新規エラーは0件。残る46件の内容も更新前と一致することを確認した。型チェック全体が成功したという意味ではない。

中止・未確認:

- Dockerビルドはユーザー指示で中止。ビルド成功、イメージサイズ、レイヤー上限、新規イメージの起動は未確認。
- 全体Vitestは途中停止しており、全テスト成功は未確認。単独再実行の成功を全体成功とは扱わない。
- Workerの再デプロイ、新しいイメージでのコンテナ再作成、Claude認証後の実際の回答取得は未実施。

## 5. 残る作業と反映範囲

1. 更新前から存在する型エラー46件を解消し、全体テストを完了する。
2. 別環境で完全ビルド、レイヤーサイズ、新規起動と公開経路の拒否・正常動作を検証する。
3. デプロイ前に、Caddy/Ruby CGI/ワーカー/observer/認証供給の再構築手順をイメージ側へ統合する。今回のバージョン更新だけでは、これまで手動復旧した全機能は再現されない。
4. Claudeの専用ユーザー認証を完了し、APIからの回答取得を確認する。

秘密鍵、HMAC鍵、署名、トークン、会話本文、診断ログ本文はこの報告へ含めていない。
