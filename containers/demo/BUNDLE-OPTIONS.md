# 用途に応じた同梱設定

Dockerfileを増やさず、`wrangler.toml` の `[[containers]].image_vars` で非秘密のビルド引数を指定する。

| 引数 | 既定 | 内容 |
|---|---|---|
| INSTALL_DOCKER | false | Docker CLI・内部dockerd |
| INSTALL_VITEST | true | グローバルVitest |
| INSTALL_TYPESCRIPT | true | グローバルTypeScript |
| INSTALL_WRANGLER | true | グローバルWrangler |

値は文字列 `"true"` / `"false"` のみ。現在利用している開発ツールは維持し、使っていない内部Dockerを既定で外す。共通のNode、Claude、Codex、Apache、SSH、Tunnel等は維持する。Tailscale、gh、jjのビルドステージ分離は今回の対象外。

通常の開発用途（現在の設定）:

```toml
image_vars = { INSTALL_DOCKER = "false", INSTALL_VITEST = "true", INSTALL_TYPESCRIPT = "true", INSTALL_WRANGLER = "true" }
```

内部Dockerも必要な用途は `INSTALL_DOCKER = "true"`。コンテナ内での開発・デプロイを行わない用途は、不要と確認できたVitest、TypeScript、Wranglerをそれぞれfalseにする。

- これは次のイメージ生成時の指定であり、稼働中コンテナからのアンインストールではない。
- 実行時の環境変数では省略したツールを追加できない。`/etc/container-features.json` に選択結果が残り、`/health` のfeaturesで確認できる。Dockerを省略した場合は管理ページでも「未同梱（構成指定）」と表示する。
- ARGは該当インストール直前に宣言し、後段の選択変更でそれ以前のベースパッケージ層まで無駄にキャッシュ無効化しない。
- `scripts/check-cf-containers.sh` は従来どおり開発CLIを含む既定構成を検証する。独自の省略構成は、その選択に対応した起動・CLI確認が別途必要。
- このコンテナ上でのDockerビルド禁止は継続する。ここで行ったのはソース編集・軽量テストのみ。容量・時間の削減量は未実測。
