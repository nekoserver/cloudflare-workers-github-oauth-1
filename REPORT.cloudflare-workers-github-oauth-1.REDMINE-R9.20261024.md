# Redmineのr9割り当てと公開疎通確認

確認日時: 2026-10-24 10:53 UTC。

`https://r9.nekomaneki.work` をRedmineへ割り当て、公開経路でログイン画面・アセット配信・管理者ログインを確認した。管理者は初回パスワード変更画面へ進む。既存データの移行ではなく、このコンテナでの新規構成である。

## 構成と変更

リポジトリの `cf-container/railway/redmine`（7.0.2）を `/opt/redmine` に配置。既存DB・database.yml・secret_token.rbはこのコンテナになく、資料にあった旧mynwホストも名前解決できなかった。DB/バックアップの保存先を照会し、指定がなかったため新規構成として進めた。

Ruby4.0.9、Rails8.1.4、Puma8.0.2、PostgreSQL18.6を使用。Redmine7.0とRuby4.0の対応は[公式インストール資料](https://www.redmine.org/projects/redmine/wiki/RedmineInstall)を確認した。専用nologinユーザーredmineでアプリを起動し、PostgreSQLはTCP待受なし・Unixソケットpeer認証でDB/user redmineへ接続する。

既存リモートTunnel/DNS/トークンは変更せず、r9の転送先 `https://127.0.0.1:10443` を維持。Apache10443をlibの8443 VirtualHostから分離し、r9専用VirtualHost → Puma `127.0.0.1:3009` へ接続する。HTTPS情報を上流へ固定し、RedmineのHost許可とHTTPS設定も適用した。

ログイン必須・自己登録無効・日本語・REST API有効・初回管理者パスワード変更必須。新規管理者パスワードは `/root/redmine-admin-password`（root:root、0600）に保存し、値はログ・Gitへ記録していない。ログイン名はadmin。アプリのDB設定とsecret_token.rbはroot:redmine、0640。

起動スクリプト `/usr/local/sbin/start-redmine`、毎分の復帰cron、entrypointの最終exec前の呼び出しを配置。起動時はflockで排他化し、再実行時に既存Pumaを維持する。DB初期化を再起動処理に含めない。

## 実測

| 公開経路・対象 | 結果 |
| --- | --- |
| r9 `/` | 302で同じr9のHTTPSログイン画面へ移動、最終200 |
| r9 `/login` | 200、Redmineのユーザー名・パスワードフォームを確認 |
| ページ参照のアイコン・CSS | 200、適切なContent-Type |
| 未認証 `/projects` | ログイン画面へ移動、最終200 |
| 未認証 `/issues.json` | 401 |
| 公開TLS経由で新規管理者ログイン | 認証成功、`/my/password` が200、初回変更要求を確認。パスワード変更は未実施 |
| mygw・stream・r8 の署名付きlib API | 各200、一覧2件 |
| mygwの未認証会話HTML | 401を維持 |
| Apache・起動シェル構文 | 成功 |
| 待受 | Redmine3009とTLS10443はループバックのみ。PostgreSQLのTCP待受なし |

素のPython urllib User-Agentでは公開側403だった。curlでは200。公開チェックに明示の `Redmine-Routing-Check/1.0` を指定して、表の各経路を確認した。Cloudflareの拒否規則は変更していない。403の原因をRedmineと断定していない。

## 構築中の不具合と復旧

Rubyネイティブ拡張に必要なzlib/gmp開発ライブラリを補い、bundle install完了（96gems）。本ソースはproductionのeager loadでnet/ldapを必要とするため、ldapグループの除外を解除した。

導入済みActiveSupport8.1.4のxml_mini.rb先頭に余分な `+++` がありSyntaxErrorとなった。ダウンロード済みgemを別ディレクトリへ展開した内容、および[公式タグの同ファイル](https://raw.githubusercontent.com/rails/rails/v8.1.4/activesupport/lib/active_support/xml_mini.rb)と照合し、余分な3文字以外は一致することを確認して復元した。復元後はgem展開内容との全ファイル比較に差分なし。原因や改変主体は不明で、セキュリティ脆弱性とは断定しない。公式ファイルSHA256は `4b8bf307da6a91eb74ba48a12eabfc4ff65c5bb18a4d9b4cc11558a368972e9e`。

マイグレーション後のschema.rb出力権限も補正し、再実行を成功させた。管理者初期化、日本語データ投入、アセット生成は成功。失敗した初回コマンドを成功扱いしていない。

## 復元と残る範囲

非秘密の設定・起動手順・初期化の新規DBガード・公開チェックを `cf-container/ops/redmine/` に保存。Apache旧設定・初期DBのpg_dump・必要な設定とlockfileをroot専用 `/var/backups/redmine-r9-20261024/` に保存した。これは同一コンテナ内のバックアップであり、外部永続保存ではない。添付filesディレクトリは今回新規・空。今後のDB/添付変更は今回の初期バックアップには含まれない。

課題の作成・編集、メール送信、ブラウザ実操作、再作成後の復元は未検証。Dockerビルド・Workerデプロイ・commit/pushは実施していない。コンテナ内での構成・公開疎通確認まで完了。
