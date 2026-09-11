# NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md

**対象**: 新しいリポジトリ/Workerをこのエコシステム(本体Worker・cf-auth・dynamicneko)に組み込むときに必要な一連の手順と確認事項。2026-09-11のセッションで`nekoserver/dynamicneko`を実際に組み込む過程で得た知見をまとめる。次に別の新リポジトリを追加するときは、この手順をそのままチェックリストとして使うこと。

---

## 0. 前提: このエコシステムの構成要素

| Worker/リポジトリ | 役割 |
|---|---|
| `nekoserver/cloudflare-workers-github-oauth-1`(本体Worker) | GitHub OAuthログイン、AI要約、D1データストア一式 |
| `nekoserver/cf-auth` | cf-authログイン(GitHub/Google OAuth)を扱う別Worker。`/wspace`でコミット/PR要約フィードを閲覧できる |
| `nekoserver/dynamicneko` | AIチャット等の実験用Worker。**`cf-auth`とは別の実在リポジトリ**(過去のNOTICEファイルに「`nekoserver/dynamicneko`の`cf-auth`」という表記があり、これを「dynamicneko = cf-authの通称」と誤読して取り違えた実績がある。両者を同一視しないこと) |

D1は3つのWorkerで共有(`workers-github-oauth`、UUID: `abbe590b-f7ff-4b98-b61c-17c8cb18c8cf`)。cf-authは読み取り専用でこのD1を直接クエリして`/wspace`を描画する。

---

## 1. リポジトリをセッションに追加する

```
add_repo owner=nekoserver repo=<新リポジトリ名>
```

- 既にクローン済みなら`git -C /home/user/<repo> rev-parse HEAD`で確認するだけでよい(再クローン不要)
- `register_repo_root`でCLAUDE.md/skillsを読み込ませる
- コミット履歴を扱う場合(後述7節)は**shallow cloneのままだと`git rev-list --count`が実際と食い違う**ので、`git fetch --depth=1000 origin main`等で完全な履歴を取得してから作業すること([`NOTICE.cloudflare-workers-github-oauth-1.20260906.md`](NOTICE.cloudflare-workers-github-oauth-1.20260906.md)参照)

---

## 2. GitHub App / Webhookの向き先を確認する

**ここが最大の落とし穴。** このエコシステムには似た名前のエンドポイントが2つあり、目的が全く違う。

| エンドポイント | 用途 | 認証 |
|---|---|---|
| `POST /webhook/github` | GitHub App由来のPR/pushイベントを受けてAI要約(`ai_summary_log`)・`installation_permissions`を更新する | `GITHUB_WEBHOOK_SECRET`(全リポジトリ共通の単一値) |
| `POST /webhook/cf-auth` | cf-authのログイン通知**専用**。cf-auth WorkerからService Binding経由の内部呼び出しでのみ使う | `CF_AUTH_WEBHOOK_SECRET` |

**新しいリポジトリのGitHub webhook設定(またはGitHub Appの配信先)は、必ず`/webhook/github`を向くこと。** `/webhook/cf-auth`を外部リポジトリのGitHub webhook設定に使ってはいけない(署名検証は通っても、PR要約処理が一切行われず、`ai_summary_log`に何も記録されない)。

確認手順:
1. 対象リポジトリの GitHub Settings → Integrations → GitHub Apps に該当Appが表示され、Repository accessに含まれているか
2. リポジトリまたはApp側のWebhook設定画面で、配信先URLの末尾が`/webhook/github`になっているか(`/webhook/cf-auth`になっていたら要修正)

---

## 3. シークレットの整合性を確認する

`GITHUB_WEBHOOK_SECRET`は**本体Worker全体で1つの値を共有**する。新しいリポジトリのwebhook側にも、既存の(動いている)リポジトリと同じ値を設定する必要がある。

**注意**: GitHubは一度保存したwebhook Secretを画面上で再表示できない(上書きのみ可能)。値の記録が手元に無い場合、新リポジトリ側だけ値を変えても本体Worker側の値と一致せず401になる。記録が無ければ、`wrangler secret put GITHUB_WEBHOOK_SECRET`で値を作り直し、**既存の動いている全リポジトリのwebhook設定も新しい値に更新し直す**必要がある(片方だけ変えると今まで動いていた方が壊れる)。

診断手順(推測せずログで確認、CLAUDE.mdルール12):

```sql
SELECT id, event_type, status, error, received_at FROM webhook_log WHERE source = 'github' AND status = 'rejected' ORDER BY id DESC LIMIT 5
```

`error`が`Signature mismatch`ならシークレット不一致、`Missing X-Hub-Signature-256 header`ならヘッダー自体が届いていない(配信先URL自体が違う可能性)。

---

## 4. 動作確認: webhookが正しく届くか

1. GitHubのWebhook設定画面の「Recent Deliveries」から**Redeliver**するか、軽くpushする
2. レスポンスが以下の形式で200なら`/webhook/github`に正しく到達している:
   ```json
   {"success":true,"event":"push","action":"unknown"}
   ```
   (`{"result":"OK","user":"..."}`という形式が返ってきたら、それは`/webhook/cf-auth`の応答なので配信先が間違っている)
3. `pull_request`イベント(`opened`または`synchronize`)を実際に1件発生させ(PRを開く/既存PRにpush)、`ai_summary_log`に新しいリポジトリが増えるか確認:
   ```sql
   SELECT repo_full_name, COUNT(*) AS cnt FROM ai_summary_log GROUP BY repo_full_name
   ```

---

## 5. cf-authの`/wspace`で確認する

上記4節で`ai_summary_log`に記録が増えていれば、cf-auth Workerの`/wspace`ページを開くと、サイドバーのチャンネル一覧に`#<owner>/<repo>`が自動で追加され、コミット/PR要約フィードが閲覧できるようになる(cf-auth側は同じD1を読み取り専用でクエリしているだけなので、cf-auth側のコード変更は不要)。

---

## 6. `installation_permissions`テーブルは診断の決め手にならない

`installation`/`installation_repositories`イベント(GitHub Appのインストール・権限変更時のみ発火)を受けて更新されるテーブルだが、2026-09-11時点で**動作中のリポジトリ(`cf-auth`等)を含め全リポジトリ分が空**だった。つまりこのテーブルが空でも他の経路(pushやpull_request)は正常に動作し得るので、「空だから壊れている」と早合点しないこと。

---

## 7. 過去コミットを`repo_commit_index`へ一括投入する(任意)

新リポジトリの過去コミット全件をD1の`repo_commit_index`に載せたい場合は、[`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md`](SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md)の手順に従う。要点:

- `repo_name`は必ず`owner/repo`形式(例: `nekoserver/dynamicneko`)。オーナー名なし表記は別リポジトリとして分裂するので厳禁
- 初回投入時は`SELECT MAX(seq_num) WHERE repo_name = ?`が0件(NULL)になるので`N=0`として`seq_num=1`から開始
- コミットメッセージ中のシングルクォートは`''`にエスケープ、SQLに`--`コメントは入れない(CLAUDE.mdルール6)
- 50件超は50件以下のバッチに分割し、`SendUserFile`でSQLファイルとして渡す(ファイルの文字コードが環境依存で化けることがあるため、化けた場合はチャット本文に直接SQLを貼って再送する方が確実)

この投入自体は`repo_commit_index`が`/status`の保存データプレビューでしか参照されないため、即座に何かの機能が動き出すわけではない(データ整合性を取るだけの作業)。

---

## 8. cf-authログイン時の「cf-auth 期限」自動カウントダウン登録(参考: 既存の別機構)

新リポジトリ追加とは別軸の機能だが、cf-authのアクセス許可判定と絡むため参考として記載する。

- cf-authへログイン → cf-auth `/welcome` → `notifyWelcome()`がService Binding経由で本体Workerの`POST /webhook/cf-auth`を呼ぶ(3節で説明した「本来向けてはいけない」方のエンドポイントだが、これは**cf-auth自身の内部呼び出しとしては正しい用途**)
- 本体Workerは`hasCfAuthAccess(db, username)`(`user_sessions`に行があるか)を判定し、OKなら`upsertCfAuthDeadlineCountdown()`が`countdown_events`へ`label='cf-auth 期限'`、`target_at=ログイン日時+7日`(cf-auth側`SESSION_TTL`)を自動登録・更新する
- **この経路はブラウザに一切何も返さない**(Service Binding経由のサーバー間通信のため)。結果を確認するには別途`/countdown`を開き直す必要がある。「ログイン直後に画面上で確認できるポップアップ」は現状実装されていない(2026-09-11時点でユーザーが探していた「緑色のトースト」の正体は特定できておらず未解決のまま)

---

## 関連ファイル

| ファイル | 内容 |
|---|---|
| [`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md`](SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md) | `repo_commit_index`追記の詳細手順 |
| [`SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md`](SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md) | cf-authログイン連携・自動カウントダウン登録の経緯 |
| [`NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md`](NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md) | GitHub webhook→Slack/Altワーカー通知パイプライン全体像(経路A/B/Cの区別) |
| [`NOTICE.cloudflare-workers-github-oauth-1.20260906.md`](NOTICE.cloudflare-workers-github-oauth-1.20260906.md) | git shallow cloneの罠 |
