# Node.js 26の共有ライブラリ不足によるイメージビルド失敗を修正

## 背景

**対象**: `containers/demo/Dockerfile`、2026-10-19 11:14 UTCのWorkers Builds。

Node.js 26.12.0のアーカイブ取得とSHA256検証は成功したが、直後の`node --version`が`libatomic.so.1: cannot open shared object file`で終了（exit 127）。最小のUbuntu 26.10イメージにランタイム依存のlibatomic1が含まれていなかった。

## 修正

**対象**: Dockerfileの最初のapt-get install。

`libatomic1`を明示的な依存として追加。Node.jsのバージョン・チェックサム・配置先は維持する。既存の`node --version`でビルド時の起動確認を継続する。

## 検証

**対象**: Dockerfileに関する既存の軽量チェック。

Claude CLIとDocker導入に関する既存テスト、git diff --checkを実施。AGENTS.md/AGENT.mdに従い、この環境ではDockerビルドとデプロイは実施していない。イメージ全体の成功確認は本番再ビルド時に必要。
