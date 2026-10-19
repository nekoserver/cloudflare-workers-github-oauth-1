# Node.js 26・npm 12への更新時のコンテナビルド対応

**対象**: 本体Workerの `containers/demo/Dockerfile`、Node.js 26.12.0・npm 12.2.0・Claude Code 2.1.303。

## 1. Node.js起動前にlibatomic1を導入する

2026-10-19 11:14 UTCの本番ビルドでは、Node.jsの取得とSHA256検証後、`node --version`が`libatomic.so.1`不足でexit 127となった。最初のapt-get installへ`libatomic1`を追加した（[PR #2429](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2429)）。

11:25 UTCの再ビルドログでは`node --version`が`v26.12.0`を返し、npm 12.2.0とCodex CLI 0.163.0の導入も成功している。Node.jsの共有ライブラリ不足は解消した。

## 2. npm 12ではClaudeのpostinstallを明示的に許可する

続くClaude Code導入ではnpmが次を出し、postinstallを実行しなかった。

```text
install scripts blocked because they are not covered by allowScripts
@anthropic-ai/claude-code@2.1.303 (postinstall: node install.cjs)
Error: claude native binary not installed.
```

npmがパッケージを追加できても、ネイティブバイナリを配置する後処理が止まると`claude --version`はexit 1になる。これはNode.jsの起動失敗とは別の問題。

DockerfileのClaudeインストールコマンドに、パッケージを限定した許可を追加する。

```dockerfile
RUN /opt/node22/bin/npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} --allow-scripts=@anthropic-ai/claude-code \
    && ln -sf /opt/node22/bin/claude /usr/local/bin/claude \
    && claude --version \
    && /opt/node22/bin/npm cache clean --force
```

許可はこのグローバルインストールだけに指定する。全パッケージのスクリプト許可やグローバル設定の恒久変更は行わない。バージョン固定、optional依存、`claude --version`による起動確認を維持する。

出典: [npm 12のallow-scripts設定](https://docs.npmjs.com/cli/v12/using-npm/config/#allow-scripts)。

## 3. 検証範囲

**対象**: Dockerfileと本番ビルドの成功判定。

既存の軽量テストと`git diff --check`で確認する。AGENTS.md/AGENT.mdの実行条件に従い、この環境ではDockerビルドを実行していない。Claude導入以降を含むイメージ全体の成功は、修正反映後の本番ビルドログで確認する。PRビルドの成功や「準備完了」の表示だけで本番イメージの成功とは判断しない。
