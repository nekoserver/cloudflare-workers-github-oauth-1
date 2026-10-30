# Codex・T3 のログイン状態を、コンテナの作り直しをまたいで引き継ぐ設計 (再設計)

作成日: 2026-10-30 JST

この文書は、Codex・T3 まわりを仕様から作り直すための土台である。実装済みのものは何もない。確認できた事実と、推測と、決める必要のあることを分けて書く。

## 1. 背景と、確認できた事実

**対象**: demo コンテナ内の Codex CLI(`~/.codex`)、T3 Code(`~/.t3`)、Tailscale、SSH 公開鍵 — コンテナを作り直すたびにログインやペアリングをやり直している現状を整理する。

| 事実 | 状態 | 根拠 |
|---|---|---|
| コンテナを作り直すと `~/.codex` と `~/.t3` が消え、Codex のサインインと T3 のペアリングをやり直すことになる | 確認済み | 利用者の操作で再現。T3 の `Invalid session token signature` も同じ原因と読んでいる |
| 作り直し後、PWA は古い T3 が発行したセッションを送り続け、T3 が `Invalid session token signature` で拒否する | 確認済み(ログ) | コンテナの `/tmp/t3.log` に、数秒おきに同じ行が繰り返されていた |
| T3 のセッション署名鍵は `~/.t3/userdata/secrets/server-signing-key.bin` にあり、作り直しで変わる | 部分的に確認 | `t3-pwa-auth.cjs` がこのファイルを読んでいる。作り直しで鍵が変わることは、ログの症状と矛盾しない |
| 同じコンテナの端末で Codex にログイン済みでも、T3 が Codex のサインインを認識しない | 未解決 | 原因を特定していない。T3 の画面で再ログインが必要になる |
| T3 の初回セットアップ(ペアリング・リポジトリ選択・Codex ログインの 3 段階)の画面の動線が分かりにくい | 利用者の報告 | 画面は作者の都合で変わるため、頼りたくない |
| Tailscale が落ちる | 未解決 | `tailscale-up.sh` のログ出力待ち |
| SSH 公開鍵は、コンテナを作り直すたびに /cf-containers のページで登録し直す | 確認済み | 利用者の操作 |

## 2. 要件

**対象**: 上の問題を解消するための要件 — 利用者の要望を、検証できる形に直す。

| 番号 | 要件 | 出どころ |
|---|---|---|
| R1 | コンテナを作り直しても、Codex のサインインと T3 のセッションが残り、やり直しが要らない | 利用者の要望 |
| R2 | 初回のセットアップ(ペアリング・リポジトリ指定・Codex ログイン)を、UI ではなく CLI/TUI で完結できる | 「作者の都合で変わる UI に振り回されたくない」 |
| R3 | 秘密情報(認証トークン・署名鍵)を、D1・Git・ログ・公開環境変数に平文で置かない | CLAUDE.md のルール |
| R4 | 保存・復元の失敗を、利用者が気づける形で記録し、通知する | CLAUDE.md ルール 8 |
| R5 | 復元に失敗しても、既存のコンテナの機能(server.js・管理 API・Apache)の起動を止めない | `SPEC.cloudflare-workers-github-oauth-1.20261020.container-t3.md` の要件 9 |
| R6 | 復元で、既にある正常なファイルを空や壊れた内容で上書きしない | 故障想定チェックリスト |
| R7 | 新しい環境変数・設定スイッチは、利用者の承認を得てから追加する | CLAUDE.md ルール 37 |

## 3. 状態の分類

**対象**: コンテナ内で作り直しをまたいで残したい状態 — 何を、どこに、どう保存し、どう復元するかを決める表。

| 状態 | 秘密か | 保存する理由 | 復元の方法 |
|---|---|---|---|
| `~/.codex/auth.json` | 秘密 | Codex のサインインを残す | 起動時に、無いときだけ書き戻す(権限 0600) |
| `~/.codex/config.toml` | 秘密ではない | ネットワーク許可などの設定 | 既存の設定を残し、無いときだけ書き戻す |
| `~/.t3/userdata/secrets/server-signing-key.bin` | 秘密 | PWA に残る T3 のセッションを、作り直し後も有効にする | T3 を起動する前に書き戻す(権限 0600) |
| `~/.t3/userdata/environment-id` | 秘密ではない | 署名鍵と対にして、環境の同一性を保つ | 署名鍵と同時に書き戻す |
| T3 のデータベースと会話履歴 | 会話内容を含む | 履歴を残す | 暗号化して保存し、T3 起動前に書き戻す |
| Tailscale の状態 | 秘密 | 認証し直しを減らす | 範囲は未決(7 章) |
| SSH の公開鍵 | 秘密ではない | 登録し直しをなくす | 起動時に `authorized_keys` へ書き戻す |

署名鍵を残すことが、`Invalid session token signature` を根本から解消する筋である。古いセッションを後から削除する対処(本体 #2494)は、鍵が変わってしまった場合の保険として残す。

## 4. 保存先の案

**対象**: 秘密を含む状態の保存先 — 候補と、推奨を示す。

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| A (推奨) | R2 のバケットに、暗号化した状態を 1 項目 1 オブジェクトで置く。D1 にはメタデータだけを置く | 容量に余裕があり、Worker から扱える。秘密が D1 に入らない | 暗号鍵の保管場所が要る。バケットの新規作成が要る |
| B | Durable Object のストレージに置く | Worker と同じ境界で扱える | 1 値あたりの大きさに上限がある。T3 のデータベースには向かない |
| C | D1 に暗号化した値を置く | 追加の資源が要らない | 「秘密を D1 に置かない」という方針に反する。大きさにも不向き |

案 A の暗号化は、項目ごとにランダムな鍵で暗号化し、その鍵を Worker のシークレットの鍵で包む形(封筒暗号)にする。包む鍵を変えても、項目の再暗号化だけで済む。

**利用者の承認が要ること**(ルール 37): R2 バケットの新規作成と、包む鍵を入れる Worker のシークレットの追加。承認が出るまで実装しない。

## 5. D1 のメタデータの設計案

**対象**: D1 に置くのはメタデータだけ — 保存した項目の一覧、保存・復元の履歴、初回セットアップの進み具合。秘密の値そのものは入れない。

番号は仮である(`0191` は本体 #2492 が使うため、`0192` から)。コメントは入れない(ルール 6)。

```sql
CREATE TABLE IF NOT EXISTS cf_container_state_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('codex_auth','codex_config','t3_signing_key','t3_environment_id','t3_database','tailscale_state','ssh_authorized_keys')),
  sensitive INTEGER NOT NULL CHECK (sensitive IN (0, 1)),
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  wrapped_key_version INTEGER NOT NULL,
  saved_at TEXT NOT NULL,
  restored_at TEXT,
  UNIQUE (container_key, item_key)
);
CREATE TABLE IF NOT EXISTS cf_container_state_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES cf_container_state_items(id),
  container_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('saved','restored','skipped','failed')),
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_container_state_events_item ON cf_container_state_events(container_key, item_key, created_at);
CREATE TABLE IF NOT EXISTS cf_container_setup_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_key TEXT NOT NULL,
  step TEXT NOT NULL CHECK (step IN ('pairing','repository','codex_login','tailscale','ssh_key')),
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','failed')),
  detail TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (container_key, step)
);
```

| 設計上の決め | 理由 |
|---|---|
| `detail` に秘密を入れない。長さを制限し、書き込む前に、トークンらしい文字列を伏せる | R3 |
| `sha256` は暗号化前の内容のハッシュ。復元後に照合して、壊れた内容を書き込まない | R6 |
| 状態の項目は `(container_key, item_key)` で一意にする | 複数コンテナに対応する |
| `/status` のテーブル一覧に載せる | ルール 17 と 23。`TABLE_COLUMN_KEYS`・`TABLE_GROUP_MAP`・`COLUMN_FK_TARGETS`・`STATUS_MIGRATION_SQL` の登録が要る |

## 6. 初回セットアップを CLI/TUI で完結させる

**対象**: コンテナ内の CLI `container-setup`(案) — ペアリング・リポジトリ指定・Codex ログイン・SSH 公開鍵の登録を、UI に頼らず順に行う。

| 手順 | 内容 | 終わったと判断する条件 |
|---|---|---|
| 1. 復元 | 保存済みの状態があれば書き戻す | 項目ごとの結果を表示する |
| 2. Codex | `codex login status` で確認する。未ログインなら、ログインを案内する | `codex login status` が成功する |
| 3. T3 のペアリング | T3 の CLI で、ペアリング用の資格情報を発行する | T3 の `/api/auth/session` が認証済みを返す |
| 4. リポジトリ | 指定のリポジトリを `git clone`、あるいは既存のものを確認する | 指定のパスに存在する |
| 5. 保存 | 完了した状態を保存する | 保存の記録が D1 に残る |

各手順は `cf_container_setup_runs` に記録する。途中で失敗したら、失敗した手順と理由を表示し、続きから再開できるようにする。T3 が Codex のサインインを認識しない原因は、この設計の前に調べる必要がある(7 章)。

## 7. 決めてもらう必要のあること / 先に調べること

| 項目 | 内容 | 状態 |
|---|---|---|
| 保存先の承認 | 4 章の案 A(R2 と、包む鍵のシークレットの追加) | 利用者の承認待ち |
| 会話履歴の扱い | T3 のデータベースを保存対象に含めるか。会話内容を暗号化して R2 に置くことになる | 利用者の判断待ち |
| Tailscale の状態 | 保存するか。まず落ちる原因を調べる | `tailscale-up.sh` と `tailscaled` のログ待ち |
| T3 が Codex のサインインを認識しない原因 | T3 のプロセスの `HOME`・`CODEX_HOME`、`codex login status` の結果を確認する | 調査が必要 |
| 署名鍵を残して、セッションが有効なまま続くか | T3 の仕様として確認する | 未確認 |

## 8. テストの設計

**対象**: 実装前に先に書くテスト — 故障シナリオごとに、失敗を検出できるものにする。

| 故障シナリオ | 検証 |
|---|---|
| 暗号化と復号の往復 | 元の内容に戻る。改ざんすると復号に失敗する。別の包む鍵では復号できない |
| 保存先(R2)が応答しない | 復元は失敗として記録し、既存のファイルを触らない。コンテナの起動は止めない |
| 保存された内容が壊れている(ハッシュ不一致) | 書き込まず、`failed` を記録する |
| 復元先に正常なファイルが既にある | 上書きしない(`skipped`) |
| 保存対象のファイルが無い・空 | 空の内容を保存しない |
| `detail` に秘密が混ざる | 伏せられる |
| マイグレーションが適用できる | `node:sqlite` で実際の SQL を適用し、外部キーと CHECK 制約が効く |
| 秘密が D1 に入らない | 保存処理の後で、D1 の全列を検索しても、秘密の値が見つからない |
| ファイルの権限 | 復元した秘密のファイルが 0600 になる |

実機でしか確認できないもの(iOS の PWA、本番の T3 の挙動、Tailscale)は、確認済みと書かず、手順と期待値を別に残す。

## 9. 段階的な進め方

| 段階 | 内容 | 前提 |
|---|---|---|
| 1 | 7 章の調査(T3 が Codex を認識しない原因、Tailscale の落ちる原因) | なし |
| 2 | 暗号化・ハッシュ・復元判定の純粋関数と、そのテスト | なし |
| 3 | D1 のマイグレーションと `/status` への登録 | 利用者が SQL を実行 |
| 4 | R2 とシークレットの追加、保存・復元の API | 4 章の承認 |
| 5 | コンテナ側の `container-state` と `container-setup` | 段階 2〜4 |
| 6 | `scripts/check-cf-containers.sh` で、ビルドと起動を確認 | 段階 5 |

## 10. 関連

- 本体 [#2494](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2494): 拒否された古い T3 セッションのクッキーを、中継で削除する。署名鍵が変わった場合の保険として残す。
- 本体 [#2485](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2485): Codex の認証を、状態ファイルから復元する。保存先が決まっていないため、この設計に統合する。
- 既存の仕様: [`SPEC.cloudflare-workers-github-oauth-1.20261020.container-t3.md`](SPEC.cloudflare-workers-github-oauth-1.20261020.container-t3.md)、[`SPEC.cloudflare-workers-github-oauth-1.T3-PWA-AUTH-HANDOFF.20261029.md`](SPEC.cloudflare-workers-github-oauth-1.T3-PWA-AUTH-HANDOFF.20261029.md)
