# DRAFT: 管理者モード(admin mode)構想メモ

**ステータス**: 構想段階。積極的な検討・実装はまだ行わない。
本ファイルはアイデアを失わないための記録であり、承認された設計ではない。

**2026-11-14 改訂**: 2026-08-15の初版の前提(管理者の概念が無い)が古くなったため、現状に合わせて書き直した。初版で未決定とした4点のうち、判定と昇格・降格は実装で決まっている。残る論点は範囲と監査。協議はD1`agent-inquiries`の議題`admin-mode-draft-20261114`。

## 背景

APIキー機能のセキュリティ警告(Slack通知)まわりの議論の中で、
「特定の挙動(例: セキュリティ警告のON/OFF)を管理者権限でポリシーとして
制御できるようにすべきではないか」という提案が出た(2026-08-15)。

初版の時点では「管理者」と「一般ユーザー」を区別する仕組みが無かった。
その後、2026-09-21に[`1fb6a448`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1fb6a448)(Restrict Cloudflare dashboard to admins)で管理者の判定が入り、今は次のとおり使われている(2026-11-14にコードで確認)。

| 項目 | 現状 |
|---|---|
| 判定 | `src/middleware/auth.ts`の`isCfDashboardAdmin`。Workerの設定`CF_DASHBOARD_ADMIN_GITHUB_IDS`(カンマ区切り)に書いたGitHubの**数値ID**と、ログイン中のユーザーの`github_id`を比べる。変更できるlogin名は使わない |
| 設定の誤り | 空要素や数値以外を含む設定なら、誰にも開かない(fail closed)。設定が無ければ`cfDashboardAdminMiddleware`は503 |
| 昇格・降格 | DBのフラグではなくWorkerの設定で持つ。変えられるのはデプロイできる人だけ |
| 使っている所 | `cfDashboardAdminMiddleware`を`src/index.ts`の57か所で使い、`/cf-containers`・`/muse-inquiries`・`/muse-status`などを管理者だけにしている。`isCfDashboardAdmin`を直接呼んで、表示や設定の一部だけを管理者に出す所もある(例: AIチャットのコンテナの状態、`/neko askgk`の待ち時間の設定) |
| 関連 | 本体コンテナの`/lib`は、2026-11-11の利用者の判断で管理者だけ(公開側は403、管理用のプロキシ:8080経由) |

## 初版の未決定4点の今

| 初版の論点 | 今 |
|---|---|
| 誰が管理者かの判定 | **決まった**。上の`CF_DASHBOARD_ADMIN_GITHUB_IDS`(数値ID、fail closed) |
| 昇格・降格の本人確認 | **決まった**。DBではなくWorkerの設定で持ち、デプロイを通してだけ変わる。DBに書ける人が自分を管理者にすることはできない |
| 権限が及ぶ範囲 | **未決定**。範囲はコードに散らばった`cfDashboardAdminMiddleware`・`isCfDashboardAdmin`の適用箇所だけで決まっていて、一覧が無い |
| 管理者操作の監査ログ | **未決定**。まとまった仕組みは無い。例外として`/muse-inquiries`の採決は、理由の欄の先頭に「［時刻 誰が/muse-inquiriesで採用］」を残す |

## 想定される利用場面

1. **Slackセキュリティ警告のON/OFFポリシー**
   - `authMiddleware`の「無効なJWTトークンによるアクセス試行」
     「revoke済みセッションによるアクセス試行」通知(`src/middleware/auth.ts`)。
   - 実際に発生した誤検知の例: 未対応エンドポイントにAPIキー(`nkapi_...`)を
     渡すと、正当なAPIキーであっても「無効なJWTトークン」としてSlackに
     警告が飛んでしまった(2026-08-15、`/api/aichat`がまだAPIキー未対応
     だった時点)。
   - 2026-11-14時点で、ON/OFFの切り替え(`SLACK_SECURITY_ALERTS_ENABLED`など)は無い。
     新しい環境変数・設定スイッチは利用者の承認なしに足さない(CLAUDE.md ルール37)。
     管理者の判定がある今は、環境変数ではなく管理者だけが変えられる設定にする案もとれる。

2. **APIキー認証失敗の内部監査ログとレスポンスの最小化**(2026-11-14時点で未対応)
   - 次の2か所が、APIキーの認証失敗の理由(`not_found`/`revoked`/`expired`/
     `account_revoked`)を401の応答にそのまま返している。
     - `GET /`(`src/index.ts`のAPIキーでのログイン確認): `{ loggedIn: false, reason }`
     - `aichatAuthMiddleware`(`src/middleware/auth.ts`、`/api/aichat`など): `{ error: 'APIキーが無効です', reason }`
   - 理由の区別は、キーやアカウントの存在・状態を外から推測する手がかりになる
     (Museの評価は危険度「中〜高」、議題`admin-mode-draft-20261114`)。
     外部の応答は汎用の401にし、理由は内部の監査ログにだけ残すべき。
   - 直すときの注意: `src/apiKeys-feature-20260815.test.ts`が、ソースに
     `loggedIn: false, reason: result.reason`が含まれることを確かめており、
     今の動きをテストで固定している。直す前にこのテストを新しい仕様へ書き換える。
     画面側(`src/views/`・`public/`)でこの理由を使っている箇所は見つからなかった。
   - 内部に区別して記録すべき理由:
     - キー自体は有効だが(未対応エンドポイント等の理由で)拒否された
     - 有効期限切れで拒否された
     - revoke済みで拒否された
     - 発行者アカウント自体が無効化されていて拒否された
     - 存在しないキーでアクセスされた(他人のキーを類推しようとした可能性)
   - 実装案: `api_key_access_log`のような監査テーブルを新設し、
     `checkApiKeyAuth`(`src/utils/apiKeys.ts`)の呼び出し元で判定結果ごとに1行記録する。
     閲覧は管理者だけ(`cfDashboardAdminMiddleware`)にできる。
     エンドポイント別の利用数(`recordApiKeyEndpointAccess`、`src/utils/apiKeyStats.ts`)は既にある。

## 正式なSPECに上げるときに足りないもの(2026-11-14、Museと協議)

- **範囲の一覧**: 管理者だけの箇所(ルート・表示・設定)を一覧にし、新しく管理者だけにするときは一覧への追記を必須にする。
- **監査**: まずは変更を伴う管理者操作だけを、時刻・GitHub数値ID・操作・対象・結果の統一形式で残す。参照の監査は後。
- **自分の判定を確かめる表示**: 管理者が「自分が管理者か」「どの数値IDで判定されたか」「設定が有効か」を確かめられる表示。ID一覧そのものは出さない。設定の誤りでfail closedになり全員が締め出されたとき、原因が分かるようにする。
- **運用の手順**: 追加・削除はデプロイを通してだけ行うこと、緊急時に外す手順。
- **テスト**: 未設定・空・数値以外の混入・一致・不一致で、fail closedになることを固定する。

## 次のステップ

- 上の「足りないもの」を議題`admin-mode-draft-20261114`で採否し、採用されたものから正式なSPECへ移す。
- それまでは新しい構想・気づきをこのファイルに追記していく。
