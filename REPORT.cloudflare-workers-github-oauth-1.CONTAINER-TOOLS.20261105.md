# 次回イメージのCLI更新と版チェック（2026-11-05）

## 完了したソース変更

| ツール | 次回イメージの版 | 根拠 |
| --- | --- | --- |
| preprint | 0.1.2を追加 | npm最新タグ・SHA512と取得物SHA256を照合 |
| cloudflared | 2026.10.6 → 2026.10.7 | 公式GitHubリリース・Linux debのSHA256 |
| Tailscale | 1.104.4 → 1.104.5 | 公式stable tarballと.sha256。ソースビルドから公式バイナリへ変更 |
| Claude Code CLI | 2.1.309 → 2.1.318 | npm最新と公式リリースが一致。npmネイティブバイナリが公式配布物と同じSHA256 |
| jj | 0.46.0 → 0.47.1 | 公式リリースasset digestと取得物SHA256 |
| Google Chrome | 157.0.8103.38-1を追加 | preprint用。公式Debian Packages記載SHA256と照合 |

preprintはネイティブCLIが--version未対応のため、実際のインストール済みnpmパッケージ版を返すアダプターを追加。ほかの引数は元CLIへそのまま渡す。既存ENVのブラウザ指定と引数を維持し、rootではChromeの起動要件に合わせ--no-sandboxを追加。ブラウザの隔離保証を追加したとは扱わない。

`/cf-containers` の実版取得へpreprint/T3 Codeを追加し、配布元のnpm最新版と公開日を取得する。apt自体はAPTツール表へ追加し、dpkgの完全な導入版とapt-cache Candidateを比較する。T3 Codeは**最新版チェックのみ追加**し、導入版は契約確認済み0.1.3のまま。調査時のnpm最新は0.1.7。

jjの元アーカイブは `containers/demo/packages/jj-v0.47.1-x86_64-unknown-linux-musl.tar.gz` に保持。SHA256SUMSと配布元・ライセンスの説明を付け、DockerfileはそのファイルをCOPYして照合後に使用する。再ビルド時にjjを再取得・コンパイルしない。

## 検証

ログ: `artifacts/container-tools-20261105/`。

- 変更前に新仕様のテストが失敗することを確認。
- 最終Vitest: **37ファイル・272件成功、既存ブラウザ検証1件スキップ**（Chrome/Playwright実行環境未準備）。17-all-with-t3.log。
- 実配布CLIのversion/help、利用オプション、隔離したjjリポジトリの作成・statusの13チェック成功。04-native-contracts.log。
- 退避jjのSHA256、各配布物のSHA256、npm preprintのSHA512、npm/公式Claudeのバイナリ一致を確認。
- 最新版取得ユーティリティの型検査、server.js/アダプターの構文、Docker RUNのshell構文、git diff whitespaceを確認。
- 広い検証の初回はHono未導入、その後は一時依存の解決経路不足で1スイートが読めなかった。lockfileのintegrityを確認した一時テスト依存を用意して再実行し、最終結果は上記のとおり。package.json/lockfileの変更なし。
- 検証補助コマンドで一度jjの相対パス、TypeScript 7の--ignoreConfig指定を誤り、それぞれ修正して成功を確認。初回ログも保持。

Dockerビルド・Workerデプロイ・稼働CLIのアップグレードは実施していない。Chromeの実起動とpreprintの完全なブラウザ操作は未検証。Chrome依存ライブラリは次回DockerのAPTインストールで導入し、headless about:blankの起動検査をDockerfileへ組み込んだ。今回のローカルでのCLIヘルプ検証を、実イメージの検証の代わりにしない。

以前追加したLIB_NETWORK_REVISIONは引き続き必須。lib側未公開修正の公開と、修正を含む固定コミット指定も実ビルド前の前提。ページ側の最新版取得にはWorkerデプロイ、実版取得には新イメージの起動が必要。

## 自動反映の扱い

[自動反映SPEC](SPEC.cloudflare-workers-github-oauth-1.CONTAINER-UPDATE-REFLECTION.20261105.md) と [コンテナ間調整PLAN](PLAN.cloudflare-workers-github-oauth-1.CONTAINER-UPDATE-REFLECTION.20261105.md) を保存。

ページ表示時は候補収集・記録まで。将来の反映タイミングは明示ビルド開始後・Dockerビルド直前を基本案とする。**他コンテナとの関係が明らかになるまで自動反映の実装は保留。** 自動Dockerfile書換え・commit/push・ビルド起動は追加していない。

## 公式配布元

- https://registry.npmjs.org/@supermemory/preprint
- https://github.com/cloudflare/cloudflared/releases/tag/2026.10.7
- https://pkgs.tailscale.com/stable/
- https://github.com/anthropics/claude-code/releases/tag/v2.1.318
- https://github.com/jj-vcs/jj/releases/tag/v0.47.1
- https://dl.google.com/linux/chrome/deb/dists/stable/main/binary-amd64/Packages.gz
- https://registry.npmjs.org/t3

今回新たなソースビルドを追加していない。ツール更新をCVE修正や全脆弱性解消と断定していない。最終検証後のファイアウォールログとnft rulesetも同じartifactsディレクトリへ取得する。既存counters-only収集であり、パケット単位のカーネルログではない。
