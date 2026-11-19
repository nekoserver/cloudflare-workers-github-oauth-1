# EVAL: cursor-agentの横断まとめ（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)（2026-11-19の改訂版、SHA256 `628bc82fceac1cf7e9cb6c5b513e74da7b6f24e22346d4075b0eb3cbdd02415a`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md`](EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md)にはモデル名が無い）

---

## 総合

**対象**: 0〜6節（実装済み）、7・8節（今後追加）、10節（診断）、11節（テスト資産）。

本書の「実装済み」と「未実装」の区別は、今のコードと一致する。テスト資産のうち1ファイル（7件）が、このコンテナのNode 26で落ちる。

| 節 | 判定 | 根拠 |
|---|---|---|
| 0〜6（起動・チャンク・キャッシュ・検索・D1・UI） | 充足 | エンドポイントが`src/index.ts`にある。テスト資産7ファイル194件が通過 |
| 7（AIチャット入力窓） | 本書のとおり | `/neko csearch`は実装済み、`/neko cursor`・`/neko cursor-past`は未実装 |
| 8（ダイナミックワーカー） | 本書のとおり（未実装） | 外部向けの3本のAPIと`CURSOR_AGENT_EXTERNAL_SECRET`が無い |
| 10（診断の`searchError`） | 充足 | [`EVAL.cursor-agent.opus-5.5.20261119.md`](EVAL.cursor-agent.opus-5.5.20261119.md) |
| 11（テスト資産） | 一部 | `src/aichat-neko-csearch-modal.test.ts`の7件が落ちる（`localStorage`が`undefined`。Node 26の`localStorage`がjsdomのものより先に見えているとみられる。推測） |

---

## 提案（未実施）

**対象**: 次の作業。

1. `src/aichat-neko-csearch-modal.test.ts`の落ちる原因を確かめる。Node 26の`localStorage`が原因なら、テストの準備でjsdomの`window.localStorage`を`globalThis.localStorage`に当てる（ほかのDOMテストにも同じ問題があるかを`localStorage`で探す）。
2. 8節の外部向けのAPIを作るときは、`CLAUDE.md`ルール38（`CF-Worker`ヘッダー＋HMAC）に合わせる。本書の「Bearer secret」の案はルール38より前のもの。

---

## 確かめていないこと

**対象**: 範囲外。

- 実際のCursor APIでの起動と応答。
- 上の`localStorage`の原因（推測のまま）。
