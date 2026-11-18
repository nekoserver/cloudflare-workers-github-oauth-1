# 本体コンテナのCodex・Cloudflare CLI更新（2026-11-13）

npm registryのlatestを確認し、Codex CLIを0.167.2から0.169.0へ更新した。公式Cloudflare CLIのcfは1.0.0-beta.31がlatestであり、既存の版固定を維持した。cf/cloudflareの両コマンドをSSHから使えるよう/usr/local/binへリンクし、Dockerfileの導入直後にCodexとcfの版を完全一致で照合する。

## 根拠と契約

- `npm view @openai/codex version`: 0.169.0。
- `npm view cf version`: 1.0.0-beta.31。パッケージのrepositoryはcloudflare/cf、binはcfとcloudflare。Node 26では^26.12.0を要求し、Dockerfileの26.13.1は範囲内。
- Codexのnpm配布物はプラットフォーム別の公式コンパイル済みoptional dependencyを使用。ソースビルドは追加しない。
- npm公開メタデータのCodex tarball integrityは `sha512-KhzYlkKPxoNssR8CEm45IjqnFWn7UtlF4CiD3tOJPea51xBs7MaHy0UQG9GSbCqk6Lrjn5QdJDV0QD1/FgWlGw==`、cfは `sha512-FWMvGTDQ74yQpAvheQFiMSVFXXV/DuRgzGbkoiGKJhr93sPZQrM/nVB6DA8/Hlod3bEzOw85SPj6n5ko2XwmjQ==`。npmの通常の配布物整合性検証を使用し、未公開のSHA256値を計算して上流の値と称することはしない。
- `src/cf-containers-codex-cf-contract.test.ts` と既存のCLI版検査を先に変更し、3失敗を確認後にDockerfileを変更した。
- Codex 0.169.0を隔離したprefixへ導入し、`codex --version`、`app-server --help`、hooks stable trueを確認。認証・推論・既存グローバルCodexの更新は行っていない。
- cfは既存配置の1.0.0-beta.31で `cf --version` を確認。今回のcf用の再導入は不要。

## 検証と未実施

CLI契約・版固定・cf配置・関連ブラウザの4ファイル12件成功。コンテナ関連全体の初回は375件成功、1件がテスト用Chromiumの固定パス不在で失敗。既存Chromeをそのテスト用パスへ接続し、該当試験を再実行して成功した。テストコードのスキップや失敗判定の緩和は行っていない。最終のコンテナ関連一式はPRの検証欄に記録する。

Dockerビルド・イメージ更新・再起動は実行していない。現コンテナのグローバルCodexが0.169.0へ更新されたという意味ではない。Dockerfileの変更をイメージへ含めるため、許可された環境で再ビルド・再起動が必要。全プロジェクトのテストはこの環境の規定に従い実行しない。

最終push前検証: コンテナ関連と会話中継・Muse/T3・tailscaleページを含む50ファイル378テストがすべて成功（`--maxWorkers=2`、約37秒）。Codex日本語hookの6テストも成功。Dockerビルドは行っていない。
