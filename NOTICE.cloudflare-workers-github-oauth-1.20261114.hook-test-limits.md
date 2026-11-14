# NOTICE: テストから受けるフックの制約

日付: 2026-11-14

**対象**: Claude Codeのフック（`scripts/claude-full-test-guard.js`・`scripts/claude-japanese-guard.js`・`scripts/claude-push-guard.js`）に見本の入力を流して分かった、止まらない入力と試せない範囲。議題はD1 `agent-inquiries`の`agent-guard-hooks-20261108`（問い合わせ`e20`・`e21`、提案A〜F）。

## 要点

- **`pnpm test`・`yarn test`は全体テストのガードで止まらない。** `npm test`・`npx vitest run`などは止まる。このコンテナにはpnpm・yarnが入っていないため今は実害が無いが、入れた時点で全体テストの禁止をすり抜ける。
- **壊れた入力ではガードは止めない（意図した動き）。** 空の入力・不正なJSON・`command`の無い入力では、全体テストのガードも日本語のガードも終了コード0で通す。日本語のガードは「作業を妨げないため、記録が読めない・壊れているときは止めない」とコメントで決めている。Museも維持でよいと評価した。煙試験ではこれを期待値0として固定する。
- **コードを含む英文は日本語のガードで止まらない。** 英文だけの応答は止まる（2）が、`` Fixed `restore-claude-host.sh` and `tunnels.claude.rb`; see PR #146. `` のようにインラインコードを含む英文は通った。
- **push前の検査（`claude-push-guard.js`）は、そのままでは試験できない。** `git push`を含む入力を渡すと、実際に差分を調べてテストを走らせる。見本の入力では試していない。
- **構文の検査は判定の検査ではない。** `node --check`が通っても、止めるべきものを通す誤りは見つからない。lib側の`restore-claude-hooks.sh`は2026-11-14の時点で構文の検査だけを行う。
- **全体テストのガードは、フックの入力の`cwd`を使っていない。** `tool_input.command`だけを見るため、どのリポジトリで実行したかを区別できない。

## 実測の結果（2026-11-14、このコンテナ）

`{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"…"},"cwd":"/root/cloudflare-workers-github-oauth-1"}`を標準入力で渡し、終了コードを見た。

| 入力のコマンド | 終了コード | 期待 |
|---|---|---|
| `npx vitest run`、`npx vitest`、`npm test`、`npm run test` | 2 | 2 |
| `npx vitest run --run`、`npx vitest run .` | 2 | 2 |
| `cd ~/cloudflare-workers-github-oauth-1 && npx vitest run`、`ls; npx vitest run`、`bash -c "npx vitest run"` | 2 | 2 |
| **`pnpm test`、`yarn test`** | **0** | **2** |
| `npx vitest run src/foo.test.ts`、`npx tsc --noEmit`、`git log --oneline -3` | 0 | 0 |
| `echo npx vitest run`、`grep -n "vitest run" README.md` | 0 | 0 |
| 空の入力、`{broken`、`{"tool_input":{}}` | 0 | 0（壊れた入力は通す） |

日本語のガード（`hook_event_name: Stop`、`transcript_path`に応答1件の記録を置く）:

| 最終の応答 | 終了コード |
|---|---|
| `Done. All tests passed and the service is restored.` | 2 |
| `完了しました。テストはすべて通りました。` | 0 |
| **`` Fixed `restore-claude-host.sh` and `tunnels.claude.rb`; see PR #146. ``** | **0** |
| 空の入力、不正なJSON | 0 |

## 提案と採否（2026-11-14時点）

| 提案 | 内容 | 状態 |
|---|---|---|
| A | lib側の`restore-claude-hooks.sh`から`scripts/install-claude-user-hooks.sh`を呼ぶ | 採用 |
| B | 復元のときに見本の入力で終了コード（止める2・通す0）を確かめる煙試験を流す。`check-migration-table-registry.js`はWorkerへ送るため除く | 採用 |
| C | 全体テストのガードをユーザー設定にも入れる。判定は「`cwd`のgitルートが本体リポジトリ」→「環境」の順。環境の主な手がかりはカーネル名の`cloudflare-microvm`、判定できなければ適用しない | 採用。利用者の条件: ハードウェアの制約が多いコンテナのサンドボックスだけで有効、各社のWeb版エージェントには適用しない |
| D | `pnpm test`・`yarn test`も止める（未導入の環境でも） | 採用 |
| E | 日本語のガードで、コード・パス・URLを除いた自然文が英文だけで一定量以上なら止める | 採用（量の基準は提案Kで協議中） |
| F | push前の検査を副作用なく試す | 採用。既存の差し替え口でほぼ満たされている（下記） |

## 環境の手がかり（Cの判定用、このコンテナでの実測）

カーネル名`6.18.56-cloudflare-microvm-2026.10.9`、`nproc`は1、メモリ約4GiB、`CLAUDE_CODE_ENTRYPOINT=cli`、`CLAUDE_CODE_REMOTE`は未設定、`/.dockerenv`は無い。`wrangler.toml`の`instance_type = "standard-1"`はリポジトリの設定で、実行環境の実測ではない。新しい環境変数は利用者の承認なしに足さない（`~/lib/CLAUDE.md`）ため、既存の手がかりで判定する。

## 未確認

- 各社のWeb版エージェントでの上の手がかりの値（Cで「適用しない」側が正しく判定されるか）。
- Eの量の基準と、日本語の説明にコードが多い応答での誤検知。
- push前の検査の判定（Fを実装するまで試していない）。

## 追記: 採用後に分かった食い違い（2026-11-14、問い合わせ`e22`）

- **リポジトリの設定はWeb版にも届く。** `.claude/settings.json`はgitにコミットされているため、全体テストのガードはリポジトリを取得したWeb版のエージェントにも効く。Cの条件（Web版には適用しない）と今の実装は食い違っている。
- **ルール9とAGENT.mdの使い分け。** CLAUDE.mdのルール9は「push直前に全体テスト」、AGENT.mdは「このコンテナでは関係するテストで満たす」。Cの条件どおりなら、Web版はルール9、このコンテナはAGENT.mdに従う。
- **ガードのテストはすでにある。** `src/claude-full-test-guard.test.ts`・`src/claude-japanese-guard.test.ts`・`src/claude-push-guard.test.ts`の3ファイル43件。このコンテナで3ファイルだけ流すと7秒で全部通った。Bは新しい試験を作らず、これを流して見本を足す案（提案H）を協議中。
- **push前の検査には試験用の差し替え口がある。** `PUSH_GUARD_CHANGED`・`PUSH_GUARD_TEST_CMD`で、実際のgit diffとテストを使わずに試せる（既存のテストが使っている）。試されていないのは、差し替えないときのgit diffの経路（`origin/main...HEAD`、失敗時`HEAD~1`）だけ。
- **判定できないときの倒し方が定まっていない。** Museはe21で「判定できなければ通す」、e22で「判定できなければ全体テストだけ止める」と答えた。前者は、イメージの更新でカーネル名が変わるとこのコンテナで禁止が黙って外れる。後者は、Web版を「制約なし」と判定できる手がかり（実際のWeb版での値は未確認）が無いと、Web版でも止まってCの条件に反する。
- **日本語の規則はプロジェクトの規則。** CLAUDE.mdのルール18〜21は、Codexを含むすべてのエージェントにPR・コミットを日本語で書くよう求めている。重複するフックをユーザー設定だけに寄せる案（提案J）は、リポジトリの設定から日本語のガードを外すため、この規則と食い違う。
- **同じフックが2回動く可能性。** 日本語・自分で確認のフックはユーザー設定とリポジトリの設定の両方にあり、リポジトリの中で起動すると2回動くはず。実際に2回動くかは未確認。

