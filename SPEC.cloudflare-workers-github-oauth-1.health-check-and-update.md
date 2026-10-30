# SPEC: ヘルスチェックと、パッケージの更新のルール

## 1. 用語

**対象**: `/cf-containers` ページのヘルスチェック、「新版あり」の表示、demo コンテナの Dockerfile(`containers/demo/Dockerfile`)で固定しているバージョン、D1 に残す確認の記録 — この文書で使う言葉を、先にそろえる。

| 言葉 | 意味 |
|---|---|
| ヘルスチェック | `/cf-containers` の「コンテナ内部の状態を確認」ボタン。コンテナの `/health` を呼び、各デーモン・CLI の実際の版を取得する |
| 実際の版 | 動いているコンテナで、コマンドを実行して得た版(`node --version` など) |
| 想定の版 | Dockerfile で固定した版(`/etc/image-versions.json` に書き出される) |
| 最新版 | 配布元(npm・GitHub のリリース・nodejs.org など)で公開されている最新の版 |
| 新版あり | 最新版が、導入版(最後に記録された実際の版)より新しいこと。「導入版」と「最新版」を、数値の並びで比べて判定する |
| 現在の状態 | D1 の `cf_container_package_release_status`。パッケージごとに1行。確認のたびに上書きする |
| 履歴 | D1 の `cf_container_package_release_history`。確認のたびに行を追記する(上書き・削除しない) |

## 2. 「新版あり」の判定

**対象**: `src/utils/latestToolVersions.ts`(最新版の取得)、`src/utils/cfContainerPackageReleaseStatus.ts`(導入版との照合)、`/api/cf-containers/latest-versions`、`/api/cf-containers/package-release-status/check` — どのパッケージを、どこで調べた最新版と、どう比べるか。

| パッケージ | 最新版の取得元 | 注意 |
|---|---|---|
| node | nodejs.org の `dist/index.json` | **同じメジャー内の最新**。別のメジャーへ上げるかは、別に判断する |
| codex | npm の `@openai/codex` | `dist-tags.latest` |
| claude | npm の `@anthropic-ai/claude-code` | 現在のイメージには入っていない(2026-10-17 に外した) |
| gh | GitHub の `cli/cli` の `releases/latest` | |
| cloudflared | GitHub の `cloudflare/cloudflared` の `releases/latest` | |
| tailscale | GitHub の `tailscale/tailscale` の `releases/latest` | |
| jj | crates.io の `jj-cli` | |
| ruby | ruby-lang.org のリリース一覧 | |
| openssl・openssh | OS(Ubuntu)が提供する版。Dockerfile では固定していない | OS を更新しない限り、上げられない |

- 導入版との比較は、数字の並びとして行う(`compareVersions`)。最新版が上回れば `update_available`(新版あり)、同じか下回れば `current_or_ahead`。
- 導入版を取得できないときは `not_detected`、導入版の記録が無いときは `unknown`、最新版を取得できないときは `latest_unavailable`、対象外は `unsupported`。**取得できないことを、「最新である」とは扱わない。**
- 最新版の取得結果は、Cloudflare のキャッシュに **6 時間**保存する(配布元への問い合わせを減らすため)。ヘルスチェックを何度行っても、最新版が最大 6 時間古い場合がある。

## 3. パッケージの更新のルール

**対象**: `containers/demo/Dockerfile` の `ARG`(バージョンとチェックサム)、固定値を確認するテスト(`src/cf-containers-*.test.ts`)、更新の PR — 「新版あり」のパッケージを、安全に最新版へ上げるときの手順と、守ること。

### 3.1 更新の対象

「新版あり」と出るもののうち、**Dockerfile で固定しているもの**を更新する。

| パッケージ | Dockerfile の ARG | チェックサム |
|---|---|---|
| Node | `NODE_VERSION` | `NODE_SHA256` |
| Codex | `CODEX_VERSION` | なし |
| gh | `GH_VERSION` | なし(Go のモジュールで取得) |
| cloudflared | `CLOUDFLARED_VERSION` | `CLOUDFLARED_SHA256` |
| Tailscale | `TAILSCALE_VERSION` | なし(Go のモジュールで取得) |
| jj | `JJ_VERSION` | なし(Rust のクレートで取得) |
| Ruby | `RUBY_VERSION` | `RUBY_SHA256` |

次のものは、「新版あり」と出ても、更新しない(または別の判断にする)。

| 対象 | 理由 |
|---|---|
| T3(`T3_VERSION`) | ヘルスチェックの対象外。T3 の PWA 関連の実装(本体 #2488 の開発用アダプター)が、0.1.3 を前提にしている。上げるときは、互換性を再検証する |
| Claude(`CLAUDE_VERSION`) | イメージに入っていない |
| npm・vitest・typescript | ヘルスチェックの対象外。上げるときは、別に判断する |
| Node の別メジャー | 「同じメジャー内」の更新だけを、この手順で行う |
| OpenSSL・OpenSSH・apt のツール | OS の提供する版。固定していない。ビルドのたびに、そのときの候補版が入る(ビルドのキャッシュが効くと、古いままになることがある) |

### 3.2 更新の手順

1. **対象を決める。** `/cf-containers` のヘルスチェックで「新版あり」を確認する(または第4章の履歴で、新版ありのものを調べる)。
2. **最新版を、配布元で確認する。** 外部へのアクセスは、**1 リクエストずつ、間隔を 1 秒以上あけて**行う(連続して送らない)。
   - npm のパッケージ: `npm view <パッケージ> version`
   - Node: `https://nodejs.org/dist/index.json` の、同じメジャーの最新
   - GitHub のリリース: `releases/latest`。API を使えない環境では、`git ls-remote --tags` でタグを調べる。タグは、公開されたリリースと一致するとは限らないので、実際に取得できることを次の手順で確かめる
   - jj: crates.io、Ruby: ruby-lang.org
3. **取得できることを確かめる。** Go のモジュール(gh・Tailscale)は、`https://proxy.golang.org/<モジュール>/@v/v<版>.info` で、その版が解決できることを確認する。
4. **チェックサムを、配布元から取得する(推測や、前の版の値の流用は禁止)。**
   - Node: 公式の `https://nodejs.org/dist/v<版>/SHASUMS256.txt` の、`node-v<版>-linux-x64.tar.xz` の行
   - cloudflared: 実際に `.deb` を取得し、`dpkg-deb --info` で `Package`・`Version`・`Architecture`(amd64)が想定どおりであることを確かめてから、`sha256sum` で計算する
   - Ruby: ruby-lang.org のダウンロード一覧に載っている sha256
   - **チェックサムを取得できないものは、更新しない。**
5. **Dockerfile を変更する。** `ARG` の値(と、チェックサム)だけを変える。ほかの変更を混ぜない。
6. **固定値を確認するテストを、同時に更新する。** たとえば `src/cf-containers-ruby.test.ts` は、`CODEX_VERSION` の値を確認している。
7. **テストを実行する。** `npx vitest run src/cf-containers`。
8. **PR を作る。** 日本語で、変更前後の表、最新版とチェックサムの確認元、変更していないものとその理由、未確認のこと(イメージのビルド)を書く。
9. **マージ後に確認する。**
   - `/cf-containers` の「最新ビルドのログを取得」で、`Failed:` が無いこと(PR のビルドはイメージをビルドしないため、マージ後の本番ビルドで初めて分かる)。
   - ヘルスチェックで、実際の版が想定の版と一致していること、「新版あり」が消えていること。
   - 履歴に、その確認の行が追記されていること(第4章)。

### 3.3 守ること

- 確認できていないことを、確認したように書かない。イメージのビルドを実行していなければ、PR に「未確認」と書く。
- `scripts/check-cf-containers.sh` で、レイヤーの大きさ(1 レイヤー 800MB 以下)と、イメージ全体の大きさを確認する(CLAUDE.md のルール 39・40)。実行できなかったときは、その旨を書く。
- 版を上げて問題が出たら、`ARG` を前の値(チェックサムも)へ戻す。
- 自動更新は行わない。人が「新版あり」を見て、更新を依頼する。更新の頻度は、決めていない。

## 4. 履歴の蓄積

**対象**: D1 の `cf_container_package_release_history` テーブル(マイグレーション `0191`)、`POST /api/cf-containers/package-release-status/check`、`/cf-containers` ページのヘルスチェック — ヘルスチェックを行うたびに、パッケージ名・最新版・確認日時と、各コンテナの対応状況を、履歴として蓄積する。

### 4.1 背景

これまでは、「現在の状態」(`cf_container_package_release_status`)を、パッケージごとに 1 行、上書きして持つだけで、最新版がいつ公開され、いつから「新版あり」だったかが、残らなかった。また、記録はページを開いたときだけで、ヘルスチェックのたびではなかった。

### 4.2 記録のタイミング

| 契機(`trigger_kind`) | いつ |
|---|---|
| `health_check` | ヘルスチェックのボタンを押し、スナップショットの記録が終わったあと |
| `page_load` | `/cf-containers` ページを開いたとき |

ヘルスチェックでは、先にその時点の実際の版をスナップショットに記録し、その**あとに**照合する。そのため、履歴の導入版は、直前のヘルスチェックの結果になる。

6 時間ごとの定期レポート(cron)は、コンテナを起動せず、最後に記録された版を使うため、この履歴の対象にしていない。

### 4.3 記録する内容(1 回の確認で、パッケージごとに 1 行)

| 列 | 内容 |
|---|---|
| `container_key` | コンテナの識別子(現在は `demo`) |
| `package_name` | パッケージ名(`node`・`codex`・`gh` など) |
| `installed_version`・`installed_status` | 導入版と、その取得の状態(`installed`・`not_detected`・`not_recorded`・`no_snapshot`) |
| `latest_version`・`latest_release_at` | 最新版と、その公開日時 |
| `current_release_at` | 導入版の公開日時 |
| `release_status` | 最新版の取得の状態(`available`・`failed`・`unsupported`) |
| `update_status` | **対応状況**。`update_available`・`current_or_ahead`・`latest_unavailable`・`unsupported`・`not_detected`・`unknown` |
| `source`・`error` | 最新版の取得元と、失敗したときの理由 |
| `installed_snapshot_id`・`installed_snapshot_at` | 導入版の元になったスナップショット |
| `trigger_kind` | 確認の契機(4.2) |
| `checked_at` | **確認日時**(UTC) |

- 最新版を取得できなかった確認も、履歴に残す(`latest_version` は NULL、`error` に理由)。「現在の状態」は、取得に失敗したとき、前回の最新版を残すが、履歴は、そのときの実際の結果を残す。
- 同じコンテナ・パッケージ・確認日時・契機の行は、重複して追記しない(再送しても増えない)。
- 「現在の状態」の更新と、履歴の追記は、**同じバッチ**で確定する。片方だけが反映されることはない。

### 4.4 失敗したとき

- 記録に失敗した場合、ヘルスチェックの結果の表示は妨げない。ページの「版の記録」の欄に、エラーを表示する(`D1記録エラー: …`)。
- テーブルが無い場合は、エラーに「migration 0188・0191 を適用してください」と出る。
- API の応答に、`historyRecorded`(追記した行数)と `trigger` を含める。

### 4.5 保持

自動では削除しない。1 回の確認で、約 10〜13 行(パッケージの数)増える。増え方が気になったら、古い行の削除を、別に決める(現在は決めていない)。

### 4.6 履歴の見方(SQL の例)

パッケージの最新版の推移:

```sql
SELECT checked_at, latest_version, installed_version, update_status
FROM cf_container_package_release_history
WHERE container_key = 'demo' AND package_name = 'node'
ORDER BY checked_at DESC
LIMIT 50;
```

直近の確認で、新版ありのもの:

```sql
SELECT package_name, installed_version, latest_version, checked_at
FROM cf_container_package_release_history
WHERE container_key = 'demo'
  AND update_status = 'update_available'
  AND checked_at = (SELECT MAX(checked_at) FROM cf_container_package_release_history WHERE container_key = 'demo')
ORDER BY package_name;
```

### 4.7 適用する SQL(マイグレーション 0191)

`wrangler d1 execute` で、そのまま実行できる(コメントなし)。

```sql
CREATE TABLE IF NOT EXISTS cf_container_package_release_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_key TEXT NOT NULL,
  package_name TEXT NOT NULL,
  installed_version TEXT,
  installed_status TEXT NOT NULL CHECK(installed_status IN ('installed','not_detected','not_recorded','no_snapshot')),
  latest_version TEXT,
  latest_release_at TEXT,
  current_release_at TEXT,
  release_status TEXT NOT NULL CHECK(release_status IN ('available','failed','unsupported')),
  update_status TEXT NOT NULL CHECK(update_status IN ('update_available','current_or_ahead','latest_unavailable','unsupported','not_detected','unknown')),
  source TEXT,
  error TEXT,
  installed_snapshot_id INTEGER REFERENCES cf_container_snapshots(id),
  installed_snapshot_at TEXT,
  trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('health_check','page_load')),
  checked_at TEXT NOT NULL,
  UNIQUE(container_key, package_name, checked_at, trigger_kind)
);
CREATE INDEX IF NOT EXISTS idx_cf_container_package_release_history_package
  ON cf_container_package_release_history(container_key, package_name, checked_at);
CREATE INDEX IF NOT EXISTS idx_cf_container_package_release_history_checked
  ON cf_container_package_release_history(checked_at);
```

### 4.8 全コンテナの更新情報の確認(`/cf-containers`)

**対象**: `/cf-containers` の「全コンテナのパッケージ更新情報」セクション、`GET /api/cf-containers/package-release-status/overview`、`GET /api/cf-containers/package-release-status/history` — 記録されている全コンテナについて、現在の対応状況と、パッケージごとの履歴を、一つの画面で確認する。

| 項目 | 内容 |
|---|---|
| 一覧(overview) | `cf_container_package_release_status` から、`container_key` ごとに、パッケージ数・新版ありの件数・最新版取得失敗の件数・最終確認日時と、パッケージの一覧(導入版・最新版・対応状況・確認日時・最新版の取得元)を返す。新版ありのパッケージを先頭にする |
| 履歴(history) | `cf_container_package_release_history` から、コンテナ名・パッケージ名で絞り、確認日時の新しい順に返す。`containerKey`・`packageName` は英数字と `_ . -` の 1〜64 文字、`limit` は既定 50、1〜200 に収める。不正な値は 400 |
| 画面 | コンテナごとに、新版あり件数・全件数・最終確認を見出しにした表を出す。パッケージの「履歴」を押すと、その行の下に、確認のたびの推移(確認日時・導入版・最新版・対応状況・契機・取得失敗の理由)を展開する。ページを開いたとき、ヘルスチェックのあとの記録のたび、「読み込む」ボタンで更新する |
| 認証 | `/cf-containers` の他の API と同じ(ログインと管理者の確認)。読み取りだけで、記録は行わない |

**注意(範囲)**: 表示できるのは、**版を記録しているコンテナだけ**。現在、このワーカーが版を記録しているのは `demo` コンテナだけで、他のコンテナは、一覧に出ない。他のコンテナを加えるには、そのコンテナの導入版を、このワーカーへ記録する仕組み(版の報告の API と、`container_key` の割り当て)が別に必要で、現在は作っていない。

## 5. 履歴の対象にならないもの

- apt で入れたツール(rg・ag・dig など)の最新版(`apt-cache policy` の候補版)は、ヘルスチェックのバージョン表に別に表示されるが、この履歴には記録しない。記録するのは、`latestToolVersions.ts` が調べる配布元の最新版と、スナップショットに記録された導入版が、名前で対応するもの。
- 履歴の `package_name` は、最新版を調べるパッケージの名前と、スナップショットに記録された版の名前の、両方の和集合。

## 6. 検証の状況

| 項目 | 状況 |
|---|---|
| 履歴の記録(追記・重複なし・一緒に確定・取得失敗の記録・コンテナ別) | 実際のマイグレーション SQL を、Node の SQLite に適用して検証した(外部キーも有効) |
| ページのヘルスチェックが、履歴の記録を呼ぶこと | ページの出力に、呼び出しが含まれることを検証した。ページのスクリプトは `node --check` で構文を確認した |
| `/status` への登録(定義・マイグレーション SQL・列のキー・グループ・外部キー) | 文字列で検証した |
| 全コンテナの確認(4.8)の画面 | 偽の API の応答を返して、実際のブラウザ(Chromium)で、コンテナ2つの表示・新版あり件数・履歴の展開・取得の順序・ページのエラーが無いことを確認した。実際の D1 の値での表示は、未確認 |
| 実際の D1 での動作、`/cf-containers` を開いてのヘルスチェックから履歴が追記されること | **未確認**。マイグレーション 0191 の適用後に、確認が必要 |
| 更新の手順(第3章) | 2026-10-30 の更新(PR #2491。作成時点ではマージ前)で、Node・Codex・gh・cloudflared・Tailscale を、この手順で上げた。イメージのビルドは、未確認 |

## 7. 未決事項

- 6 時間 cron の確認を、履歴に含めるか。
- 履歴の保持期間と、古い行の削除。
- 他のコンテナの導入版を、このワーカーへ記録する仕組み(4.8 の注意)。
- 更新の頻度と、自動で更新を提案する仕組み。
- apt のツールの最新版を、履歴に含めるか。
- ビルドのキャッシュが効いて、apt のツールが古いままになる場合の扱い。
