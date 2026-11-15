# NOTICE: node_modules のシンボリックリンク事故と、Claude Code のhookが効かない・止まるときの見分け方(2026-11-15)

---

## 1. node_modules が「自分自身を指すシンボリックリンク」としてリポジトリに入っていた

**対象**: リポジトリ直下の `node_modules`、`.gitignore` — mainを取り出した環境ではどこでも、テスト(vitest)が起動できなくなっていた。

### 何が起きていたか

- `node_modules` は `npm ci` で作るライブラリのフォルダで、本来はリポジトリに登録しない。
- 2026-11-12 のコミット [`fee856be`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fee856be)(Museの待ち時間の変更)に、`node_modules` という名前のシンボリックリンク(ショートカット)が紛れ込んだ。中身は `/root/cloudflare-workers-github-oauth-1/node_modules` の1行で、**自分自身を指している**。
- そのため、mainを取り出すと、ライブラリのフォルダの代わりにこのリンクができる。開こうとすると自分自身を指してループし(`ELOOP` / `Too many levels of symbolic links`)、`npx vitest` が起動できない。
- このとき `npx` は**何も表示せずに終了コード216で終わる**。エラーメッセージが出ないので、原因に気づきにくい。

### なぜ紛れ込んだか(知らないと損する)

- `.gitignore` の `node_modules/` は、**末尾のスラッシュのせいで「フォルダ」にしか効かない**。シンボリックリンクは「ファイル」として扱われるため除外されず、`git add -A` などでそのまま登録される。
- 除外するには、スラッシュ無しの `node_modules` と書く。

### 直し方

- リポジトリ側: [PR #2621](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2621) でリンクを登録から外し、`.gitignore` をスラッシュ無しの `node_modules` にした。`src/repo-node-modules-untracked.test.ts` が再発を検査する。
- 手元の環境: 登録から外しても、手元にあるリンクは消えない。`rm node_modules && npm ci` で入れ直す。
- 最初にリンクを作った処理は、この環境では見つからなかった(コミットした環境は別だった可能性がある)。

---

## 2. push前のガードが止まったとき、hookが壊れたのか、テストが起動できないのかを見分ける

**対象**: `scripts/claude-push-guard.js`(Claude CodeのPreToolUseフック) — コンテナに触れる変更をpushする前に `npx vitest run src/cf-containers` を走らせ、失敗したら止める。

- 1の状態では、ガードは決められたとおりテストを走らせ、テストが起動できなかったので止めていた。hook自体は正しく動いていた。
- ただし表示が「検査が失敗したため、pushを止めました。src/cf-containers のテストを直して」だけで、原因が分からず、hookが壊れたように見えた。
- PR #2621 で、次の2つをガードに足した。
  - `node_modules` がリポジトリに登録されていたら、変更の中身に関わらず止め、外し方(`git rm --cached node_modules`)を出す。
  - テストを起動する前に `node_modules` を調べ、自分自身を指すリンク・無い・vitestが無いときは「テストを起動できませんでした(テストの失敗ではありません)」と原因と直し方(`rm -rf node_modules && npm ci`)を出す。

---

## 3. Claude Code を /root で起動すると、リポジトリのhookが1つも効かない

**対象**: `.claude/settings.json` のhook(push前のガード、全体テストのガード、日本語のガード、マイグレーション登録のチェック、行動指針の差し込み)。

- Claude Code が読むプロジェクト設定は、**起動したディレクトリの `.claude/`** だけ。`/root` で起動すると `/root/.claude/` を読み、リポジトリの `.claude/settings.json` は読まれない。
- このとき、全体テストのガード(AGENT.md で禁止された `npx vitest run` の全体実行を止める)も効かず、2026-11-15 のセッションでは全体テストを止められずに2回走らせてしまった。
- 確実な対処は、**リポジトリのディレクトリで `claude` を起動する**こと。
- `/root` で起動してしまったセッションでは、`/root/.claude/settings.local.json` に、リポジトリへ `cd` してから同じhookを実行する設定を書けば効く(2026-11-15 に設定済み。`/root` で起動したセッションにだけ効く)。
- `/root/lib/claude/ops/restore-claude-hooks.sh` は、コンテナの起動時に `node_modules` の修復とhookのスクリプトの検査を行う。ただし 2026-11-15 のコンテナでは起動ログに `hooks:` の行が無く、動いていなかった。

---

## 4. src/cf-containers のテストには Chromium が要る

**対象**: `src/cf-containers-t3-pwa-diagnose-browser.test.ts`(実ブラウザでPWAの自動診断を確かめるテスト)。

- Chromium が無い環境では `browserType.launch: Failed to launch chromium because executable doesn't exist` で失敗し、push前のガードも止まる。
- `npx playwright install chromium` で入る(playwright 1.61.1 では約114MiB、`/root/.cache/ms-playwright/` に入る)。

---

## 5. 「いちいち質問しない」をhookで差し込む

**対象**: `scripts/claude-self-check-guard.js`(UserPromptSubmit・SessionStart のフック)。

- ユーザー指定(2026-11-15): 自分で決められること(作業の進め方・手順・実装の細部)は確認を求めずに妥当な方を選んで進め、何を選んだかを報告に書く。
- 質問してよいのは、ユーザーにしか決められないこと(取り消しにくい操作、外部への公開、費用がかかること、要件の解釈が分かれて結果が大きく変わること)だけ。
- 2026-11-13 の「こっちに聞く前に自分で確認しろ」と同じフックで、毎回の発言の前に差し込む。`src/claude-self-check-guard.test.ts` が検査する。
- 3のとおり、`/root` で起動したセッションでは `settings.local.json` の設定が無いと差し込まれない。
