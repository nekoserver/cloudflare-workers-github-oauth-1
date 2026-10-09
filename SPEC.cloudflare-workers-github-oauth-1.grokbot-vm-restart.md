# GrokBotのVM再起動・環境復元仕様

確認日: 2026-10-09。リポジトリの基準: `main` の `2f3be917`。
対象は現在アクセスできるGrokBotのBox環境。本書は起動スクリプト、永続領域の復元スクリプト、既存ログを読み取った記録であり、VM再起動やサービス再起動を実施した結果ではない。

## 1. 再起動時に何が起こるか

処理は「Boxの標準起動」と「ユーザーが追加したサービスの復元」に分かれる。

| 層 | 主な処理 | 確認できた根拠 |
|---|---|---|
| GrokBot／Box標準起動 | 保存データの復元、実行デーモン・ホスト・デスクトップ・監視の起動、健全性診断 | `/usr/local/bin/start-sand-box`、`/tmp/box-doctor.log` |
| 追加サービスの復元 | SSH、Apache／Passenger、Cloudflare Tunnel、CGI、Redmine、CLI補助の再配置と起動確認 | `/home/box/bin/restore-edge.sh`、既存の復元ログ |
| 追加サービスの簡易起動 | 既に配置済みのサービスとTunnel監視を起動し、状態を確認 | `/home/box/usr/local/sbin/start-all-local.sh` |

**`restore-edge.sh` の再起動時の自動呼び出しは未確認。** 調べた標準entrypoint、シェル初期化ファイル、標準のホストコードにはこのスクリプトの呼び出しが見つからなかった。復元ログがあることは実行された証拠だが、毎回の再起動でGrokBotが自動実行する証拠ではない。外部のRoutine、起動フック、エージェントへの指示による実行かどうかは、この調査では確定できない。

## 2. 通常再起動とBox更新を区別する

`/home/box/reference/app-ui.md` と `debugging-the-box.md` は、アプリ自体の更新、Boxの更新、スナップショットへのリセットを別操作としている。

- 通常の再起動: プロセスは失われるため再起動が必要。どのディレクトリ・パッケージが保持されるかはランタイムに依存する。
- `Update Bot's Computer`: 新しいBoxへ移し、ファイルとログインを保持する復旧操作。インストール済みソフトウェアは引き継がれないと環境ガイドに記載されている。
- `Reset Bot's Computer`: 最後の保存スナップショットから復元する操作。直近の未同期作業を失う可能性がある。

`restore-edge.sh` は `/etc` やパッケージが失われたBox交換も想定し、`/home/box` 側の資材を使って環境を組み直す。単なるサービス再起動だけのスクリプトではない。

## 3. Boxの標準起動

`/usr/local/bin/start-sand-box` から確認できる主な処理は以下の通り。条件分岐が多く、すべてのBoxで全機能が有効になるわけではない。

1. 起動段階・失敗情報を記録し、ユーザー／権限、ログ、デーモン、実行環境を準備する。
2. 実行デーモン、ブラウザ関連のルーター・セッション同期・Cookie保持などの補助プロセスを立ち上げる。
3. 設定されたBoxストアから保存データをcopy-inする。復元失敗時にはsnapshot-outを無効にし、未復元の空の状態でホストが提供されないようホストを停止したままにする。実行デーモンとデスクトップは診断用に残る。
4. CLI認証補助の `persist-cli-auth retire-mirror` とBoxタイムゾーンの適用を行う。
5. Box内のsupervisorを起動し、デスクトップを起動する。machine-idを整備し、X displayの応答を最大約30秒待つ。
6. `box-doctor` をバックグラウンド実行し、`/tmp/box-doctor.log` に出力する。
7. 有効ならメモリ監視と終了監視を起動する。終了監視がない場合はライフサイクル所有プロセスの終了を待ち、終了時にBoxを終了する。

デスクトップの起動とブラウザの起動は別。起動直後にChromeプロセスがないだけでは故障と判定しない。

## 4. `restore-edge.sh` が復元するもの

スクリプトは `set -euo pipefail` を使う。ただし多くの個別処理は `|| true` またはWARN表示で継続するため、最後の `done` だけで全機能の復元成功とは断定できない。

| 順序 | 対象 | 処理 |
|---|---|---|
| 1 | 永続ディレクトリ・権限 | `/home/box` 側の資材ディレクトリを作り、www-dataの通過権限を調整 |
| 2 | Webルート・Tunnel設定 | `/var/www/html` を永続Webルートへ接続。永続Tunnel設定を `/etc/cloudflared` へroot所有・600で配置 |
| 3 | 不足パッケージ | OpenSSH、Apache、libyaml、Python、cryptographyを確認し、不足時だけaptで導入 |
| 4 | SSH | 永続sshd設定を `/etc/ssh` へ接続し、構文検査後、ローカル22番未待受なら直接起動 |
| 5 | ローカルTLS | CA・サーバー証明書がなければ生成。127.0.0.1のSANがなければサーバー証明書を再生成し、Apacheとローカル信頼ストアへ配置 |
| 6 | Access認証補助 | `cf-access-map` をroot所有・755で配置。ない場合はWARN |
| 7 | 起動・監視ヘルパー | `start-*.sh`、`check-local-services.sh`、`tunnel-stuck-watch.sh` を `/usr/local/sbin` へ配置 |
| 8 | TCP設定 | 永続sysctl設定を配置・適用し、切れたTunnel接続の検出を早める |
| 9 | `/lib` CGI・ダッシュボード | 必要な場合だけ `nekoserver/lib` をclone。askディレクトリの権限、ハードウェア情報、dashリンク、D1増加量スナップショットの閲覧権限を整える |
| 10 | CLI実行・署名補助 | `codex-exec-prompt`、`claude-exec-prompt`、Tunnel一覧・署名秘密値取得等のヘルパーとcf CLIを配置。sudoersを検証して配置 |
| 11 | 保護設定 | 永続領域からHMAC・Webhook設定を権限制限付きで配置。秘密値そのものはログへ表示しない |
| 12 | Redmineゲートウェイ | CGI／WSGI、保護設定、nonce保存ディレクトリを配置 |
| 13 | Apache／Passenger | Ruby 4.0.7／Passenger 6.2.0の永続資材を参照。443のRedmine・8443のRails、CGI・Access判定等の設定を生成し、有効化・構文確認・起動／再読込 |
| 14 | Cloudflare Tunnel | バイナリがなければ永続コピーから配置し、それもなければダウンロード。設定を使いHTTP/2で起動 |
| 15 | Rails／Redmine依存 | rails-root、rails-root-b、redmineで `bundle check`。不足時に `bundle install` |
| 16 | Redmine環境 | 環境変数ローダーを配置。変更時に `tmp/restart.txt` を更新。Rails runnerでREST APIを確認し、無効なら有効化 |
| 17 | CLI・認証前提 | `~/.local/bin/codex` / `claude` の存在とGHK export設定を確認。欠落はWARNであり、この処理でCLIをインストール・再ログインするわけではない |
| 18 | 疎通・権限確認 | 待受ポート、ローカルHTTPS、プロセス、TLS検証、CGI、Redmine API、ask処理、www-dataの書込とsudo許可を確認 |

### 設定の更新と再実行時の注意

Tunnel設定や一部ヘルパーでは、配置済みコピーが永続コピーより新しく内容も違えば、永続側へ逆同期する。その他の設定は毎回生成・上書きするものもある。「すべての永続設定を一方向にコピーするだけ」ではない。

Apacheが起動済みならgracefulを試すが、CGIソケットがなければfull restartを使う。既存プロセスがある場合に必ずスキップするわけではない。

Cloudflare edge名のDNSが `198.18.0.0/15` の偽IPまたは未解決なら、候補edgeへのTCP 7844到達を調べ、到達可能なIPを `--edge` に指定する。稼働中のcloudflaredが固定edge指定なしなら、条件付きで停止・起動する。すでにプロセスが存在するという判定だけでは、外からの到達性は保証しない。

現在のスクリプトにはRedmineゲートウェイの配置処理とApache設定に重複箇所があり、設定ファイル候補も複数ある。後段の配置が前段を上書きしうる。これは確認した現状の記録で、本書の追加では変更していない。

## 5. 簡易起動とTunnel監視

`start-all-local.sh` は配置済み環境を前提に、sysctl適用 → sshd → cloudflared → Apache → Tunnel watchdog → 状態確認の順で実行する。パッケージやTLS・CGI・Redmine設定を復元する完全復元スクリプトとは用途が異なる。

`restore-edge.sh` はwatchdogを**配置**するが、直接 `--daemon` で起動する呼び出しはない。`start-all-local.sh` は起動する。この違いから、完全復元の完了だけでwatchdogが稼働すると判断しない。

watchdogの既定値:

- 対象はTCPの宛先ポート7844、確認間隔30秒。
- Send-Qが正、再送backoffが正、最後のACKから60秒以上の接続を候補にする。
- 3秒後にも同じ接続が該当した場合だけ `ss -K` でそのソケットを切る。
- cloudflaredが該当接続を再確立する。プロセス全体を定期的に再起動する処理ではない。
- PIDは `/run/tunnel-stuck-watch.pid`、ログは `/var/log/tunnel-stuck-watch.log`。
- `--check` は候補表示のみ。`--once` は切断を実行しうる。

## 6. 残っていた実行記録

2026-10-09の調査時点で以下のログを確認した。ファイル名・内容から自動起動の呼出元や再起動イベントとの対応までは確定できない。

| ログ | 確認できた内容 |
|---|---|
| `/tmp/box-doctor.log` | 10 checks、0 failed。machine-id、Chrome、egress、時計、D-Bus、X、VNC、noVNC、デスクトップ等を確認。実行中プロセス消滅による `/proc/.../cmdline` の読取エラー行もある |
| `/tmp/restore-0853.log` | openssh-server／apache2／libyamlを導入。ローカル443・8443は200、TLS検証値0、各プロセスup、tunnelsは200、未認証Redmine本人APIは401、hardware問合せdone |
| `/tmp/restore-rerun.log` | DNSの偽IP検出と固定edge候補を記録。bundleは既に充足、ローカルHTTPS・CGI・Redmine本人API等の確認結果を記録 |

これらはローカル疎通の証拠であり、Cloudflare経由の外部到達、Accessログイン、署名付きWorker要求、Codex／Claudeへの質問の成功をまとめて保証しない。

## 7. 再起動後に確認する項目

1. Box標準起動は `/tmp/box-doctor.log`、`/tmp/start-desktop.log`、`/tmp/sand-copy-in.log`、supervisor／exec-daemonログで確認する。
2. 追加サービスはプロセスだけでなく待受ポート、HTTP応答、TLS検証結果を確認する。
3. `check-local-services.sh` はローカルサービス用。Tunnel edge接続4本、tcp_retries2=8、watchdogのPID／コマンドも確認するが、HTTP 200または403を正常扱いするためアプリの業務動作確認とは異なる。
4. 外部HTTPS／SSH、Access認証、Worker→署名経路、Codex／Claudeの応答はそれぞれ別に確認する。
5. `restore-edge.sh` の自動実行を仕様として確定するには、Routine／外部起動フックの設定と再起動イベント・実行時刻の対応を追加確認する。

完全復元スクリプトの再実行はapt導入、設定上書き、サービス再起動、Redmine設定変更を伴う。調査だけのためには実行せず、まずコードと既存ログを読む。

## 8. 参照と検証範囲

現行スクリプトのSHA-256（調査時点）:

```text
start-sand-box: 855653bd968842cbbd7b5f01e339bc4aea1b8c2c9c7008b1f68cc23c2cddfff8
restore-edge.sh: 8cf49b90eed3e39f1611c9fd9e595dbe967f5dbd28ac09f87fd656dab969145d
```

一次資料はVM内の以下のファイル。リポジトリに収録されていないため、将来のBox交換や設定変更後には差分確認が必要。

- `/usr/local/bin/start-sand-box`
- `/home/box/reference/app-ui.md`、`/home/box/reference/debugging-the-box.md`
- `/home/box/bin/restore-edge.sh`
- `/home/box/usr/local/sbin/start-all-local.sh`、`start-sshd-local.sh`、`start-nekoroot-tunnel.sh`、`start-apache2-local.sh`
- `/home/box/usr/local/sbin/tunnel-stuck-watch.sh`、`check-local-services.sh`
- 前節の標準起動診断・復元ログ

関連する本体側の仕様・経緯:

- [AIチャットのCodex／Claude対応](SPEC.cloudflare-workers-github-oauth-1.aichat-codex-claude.md)
- [Cursor／Redmine／Worker接続の記録](NOTICE.cloudflare-workers-github-oauth-1.cursor-redmine-workers.md)

本書作成時はコードと既存ログの読取、`bash -n` による復元・簡易起動・watchdogの構文確認のみを行った。VMの再起動、完全復元の再実行、外部CLI呼出し、サービス設定変更は行っていない。
