# NOTICE: demo コンテナの Codex と gh の版上げ（2026-11-18）

稼働中コンテナの版一覧で Codex と gh に新版が出ていたため、Dockerfile の pin を上げた記録。

| パッケージ | 変更前 | 変更後 | 確認方法 |
|---|---|---|---|
| Codex（@openai/codex） | 0.169.1 | 0.170.0 | 隔離 prefix へ導入し、`codex --version` が `codex-cli 0.170.0` を返すこと、`app-server --help` が動作することを実物で確認 |
| gh（cli/cli） | 2.104.0 | 2.105.0 | 公式の gh_2.105.0_checksums.txt と取得した tar.gz の sha256 が一致すること（79e7ab5d…）、展開した実物が `gh version 2.105.0 (2026-11-17)` を返すことを確認 |

npm registry の integrity:

- @openai/codex@0.170.0: sha512-dwoughgqjiik++CFaNkjQ5y6pJO6LUzu5P1z8Hy4LUeJ+aIYcX/QO1P5rOQnHmBG4agOM7Y+hc4LtVo/a4GFiw==

## 稼働イメージとの関係

本 PR は Dockerfile 側の pin のみを進める。稼働イメージへの反映は、Workers Builds のビルド（select-demo-container-image）とコンテナの再作成が別途必要であり、Dockerfile の変更でコンテキストハッシュが変わるため、image.lock.json の前提チェックは新しいイメージの digest が記録されるまで落ち続けるのが正しい姿。

## テスト

- 契約テスト（codex-cf-contract、prebuilt-binaries）を新しい版で先に書き換え、実物で確認した値と一致させた。
- Docker ビルドはこの環境では行わない（リポジトリの規則）。イメージへの反映確認は再ビルド後に main 側で行う。
