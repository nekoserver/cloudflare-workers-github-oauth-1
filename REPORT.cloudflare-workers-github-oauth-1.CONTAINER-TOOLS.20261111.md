# REPORT 2026-11-11: demoコンテナのCodex CLI・Claude CLIの版上げ

**対象**: `containers/demo/Dockerfile` の `CODEX_VERSION`・`CLAUDE_VERSION`・`CLAUDE_NATIVE_SHA256`、契約テスト `src/cf-containers-tool-updates.test.ts`・`src/cf-containers-ruby.test.ts` — ユーザー指定でCodex CLIとClaude CLIを最新にする。

| ツール | 版 | 確かめたこと |
|---|---|---|
| Codex CLI (`@openai/codex`) | 0.166.0 → 0.167.1 | npmの `dist-tags.latest` が0.167.1(2026-11-10公開)。0.166.0と同じく `@openai/codex-linux-x64` を optionalDependencies に持つ。`engines.node` は `>=16`(Node 26.13.0で満たす)。入れ方は従来どおり版の指定だけ |
| Claude CLI (`@anthropic-ai/claude-code`) | 2.1.318 → 2.1.322 | npmの `dist-tags.latest` が2.1.322(2026-11-10公開)。`engines.node` は `>=22.0.0`(Node 26.13.0で満たす) |
| jq | 変更なし | すでにaptで入っている(`containers/demo/Dockerfile` 81行目) |

## Claudeのネイティブバイナリのsha256

前回(2026-11-05)と同じ手順で、npmのネイティブバイナリが公式GitHubリリースの配布物と同じであることを確かめた。

1. `@anthropic-ai/claude-code-linux-x64@2.1.322` のtarballを取得し、npmが公開している `dist.integrity` と照合した。一致: `sha512-0DoaNAXLWCYYIGachWBCkTUsS8dOOgvk4R2fFKdrLejO9XlRTwaWUMD9ONdDmv0csdpwxj4qLUN6zWMaG2Sz6g==`
2. 中の `package/claude` のsha256: `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`
3. 公式GitHubリリース `https://github.com/anthropics/claude-code/releases/download/v2.1.322/claude-linux-x64.tar.gz`(157,379,500バイト、sha256 `3d2bc5ae54d4d4cd63510e9fcca5b6d48d2b18806708df8c8f691aa486c5dca8`)から取り出した `claude` のsha256も `bfb3703a…c478` で一致した

**確かめていないこと**: GitHubがリリースの配布物に付けて公開しているdigestとの照合。このセッションではGitHub APIが使えず、リリースにチェックサムのファイル(`SHA256SUMS` など)も無かった(404)。npmの公開ハッシュと、公式リリースの配布物の中身の一致で代えた。

## 未実施

- Dockerビルド(AGENT.mdの実行条件とユーザーの許可が必要)。コンテナで `codex --version`・`claude --version` が通ることは、ビルドで確かめる
- 全体テスト(AGENT.md、このコンテナでは実行しない)。`npx vitest run src/cf-containers` の307件は合格
