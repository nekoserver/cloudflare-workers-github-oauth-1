# ネットワーク設定・ログの再構築と確認

更新: 2026-10-22（UTC）。対象は本リポジトリの `containers/demo` と、この作業で確認したコンテナ。設定変更の正本はDockerfile・設定ファイル・起動スクリプトとし、この文書はその反映・確認手順を補足する。

反映状況は [DEPLOYMENT-STATE.md](../../DEPLOYMENT-STATE.md) を先に確認する。元の環境構築手順は別リポジトリ `cf-container` の `SETTING.cf-container.md`。当日の配置は `/var/www/html/lib`、ビルド時のアプリ配置は `/app` であり、そのまま置き換えられるものではない。古い文書のOS・ホスト・配置先を現在の実測値と混同しない。

## 1. 経路と設定の所在

| 経路・役割 | 設定の正本 | 確認点 |
|---|---|---|
| 管理用HTTP・コンテナヘルスチェック | `server.js`、Workerの管理プロキシ | ポート8080。公開ストリームと管理診断の経路を区別する |
| TunnelからApacheへのHTTP/WebSocket/SSE | `cloudflared-ingress.yml.template`、`apache-demo.conf` | `https://127.0.0.1:8443` → Apache → `http://127.0.0.1:8080` |
| SSHのTunnel中継 | 同テンプレート、`entrypoint.sh` | `/ssh` → `ssh://127.0.0.1:2222` |
| DNS・TLS・sshd・フィルター・ログ収集の起動 | `entrypoint.sh` | ファイルを変更しただけでは稼働プロセスに反映されない |
| パッケージ・アセット・Apacheモジュール | `Dockerfile` | 再作成後の再現にはイメージへの反映が必要 |
| AIチャットの接続先候補 | `src/utils/conversationStreamHosts.ts` | `mygw`、`mynw`、`stream.test.cfc` の認証・状態はそれぞれ独立 |

本体nekorootの `mygw.nekomaneki.work` と、CFCの `stream.test.cfc.nekomaneki.work` のTunnel・トークンを混用しない。管理Workerの `test.cfc.nekomaneki.work` と配信用Tunnelのホストも区別する。DNS・Routes・カスタムドメインの切替は `cf-container/NOTICE.custom-domain-tunnel-routing.md` と `REPORT.stream-dns-routing.md` に従い、この補足手順で変更しない。

```sh
cat /etc/os-release
ss -lntp
ip -4 route
ip -6 route
dig +time=2 +tries=1 controlplane.tailscale.com
dig +time=2 +tries=1 @1.1.1.1 controlplane.tailscale.com
```

ポートがLISTENしていること、Tunnelがreadyであること、公開URLが認証付きで利用できることを別々に確認する。`EXPOSE 8080` はアクセス制御ではない。Apacheの待受は設定上 `Listen 8443` であり、127.0.0.1専用と決めつけない。

## 2. DNS・TLS・長時間接続

- 起動処理はIPv4 DNSの `1.1.1.1`、`1.0.0.1` を先頭に置き、書き込み不可ならbind mountを試す。30秒ごとの再確認結果は `/tmp/dns.log`。この対処は当該環境でIPv6 DNSが引けなかったことに対応するもので、別環境では経路を実測して判断する。
- Apache証明書・秘密鍵は `/etc/apache2/tls/nekoroot.crt` と `nekoroot.key`。`entrypoint.sh` が証明書未作成時に自己署名証明書を生成する。鍵は0600。
- このテンプレートのcloudflaredはローカルオリジンに `noTLSVerify: true` を使用する。公開側の証明書検証まで無効化する設定ではない。他ホストへの接続にこの設定を広げない。
- WebSocketはUpgradeのプロキシ設定、SSEはchunked転送・無圧縮・長時間接続を確認する。接続テストのために全起動スクリプトを再実行しない。

## 3. Apacheのアクセス元IP

Dockerfileで `a2enmod ... remoteip` を実行し、VirtualHostに以下を配置する。

```apache
RemoteIPHeader CF-Connecting-IP
RemoteIPTrustedProxy 127.0.0.1 ::1
LogFormat "%a %l %u %t \"%r\" %>s %O \"%{Referer}i\" \"%{User-Agent}i\" peer=%{c}a" nekoroot_combined
CustomLog /var/log/apache2/nekoroot-access.log nekoroot_combined
```

`%a` は採用したアクセス元IP、`peer=%{c}a` は実際のTCP接続元。ローカルcloudflaredのヘッダーだけを信頼し、外部からの任意ヘッダーを採用しない。ローカルプロセスは信頼範囲に含まれる。

反映前に `apache2ctl configtest` を実行し、モジュール有効化とVirtualHostを一緒に反映する。再読込後、ヘッダーなし・ローカル中継のIPv4/IPv6・非信頼接続元の偽装ヘッダーで確認する。`mod_remoteip` はログだけでなくIPによる認可やアプリが参照するクライアントIPにも影響するため、HMACゲートとIP許可設定の正常・拒否動作も確認する。

当日の隔離Apacheでは上記のIP採用と偽装拒否を確認済み。稼働Apacheへこの設定を反映済みという意味ではない。過去の127.0.0.1記録から元IPを復元することはできない。

## 4. SSHの日時・接続元・ログイン履歴

sshdはポート2222、rootの公開鍵認証、パスワード認証無効。今回の起動スクリプトでは `sshd -D -e` の標準エラーにUTC日時・ホスト名・`sshd:` を付け、0600の `/tmp/sshd.log` に追記する。

```text
2026-10-22T09:30:00Z hostname sshd: Accepted publickey for root from ...
```

この形式はsshguardのパーサーで認証失敗を認識できることを確認した。sshguardは同じファイルを `tail -F` で監視し、状態・エラーは `/tmp/sshguard.log` に残す。

- 日時を付ける前のログには接続日時がない。ファイルのmtimeを各ログイン時刻として扱わない。
- SSHのTunnel中継ではsshdが見る接続元は127.0.0.1になる。HTTPの `CF-Connecting-IP` をsshdへ適用することはできない。
- その経路のsshguardも実送信元を見分けられない。同一公開鍵の指紋は認証鍵の識別であり、人・端末・実IPの特定ではない。
- syslogサービスを新設したわけではない。今回の日時付与はファイルへの直接記録であり、rsyslogやjournaldの動作を意味しない。
- Ubuntu 26.04向けDockerfileには `wtmpdb` と `libpam-wtmpdb` を追加した。`last` はwtmpdbの実体へリンクされる。別OSでは提供パッケージを確認する。履歴の書き込み方式・PAM・端末割当も確認し、`last` が空という理由だけでログインなしと判断しない。

```sh
/usr/sbin/sshd -t
/usr/sbin/sshd -T -p 2222
command -v last
last -Fai
```

sshd再起動で現在の接続を失わないよう、接続手段を確保したうえで反映する。新しいSSH日時形式とlast導入は作業ツリー上の変更であり、当日の稼働sshdへの適用・既存履歴の復元は行っていない。

## 5. ファイアウォールとカーネル機能の判定

所有するテーブルは `inet filter`。Dockerの `ip/ip6 filter`・`nat` とsshguardのテーブルは別管理である。**`nft flush ruleset` で全消去しない。** 変更前に現在のルールを権限を制限したファイルへ保存し、当該テーブルだけを復元できるようにする。

現行ポリシーは、INPUTでループバックを許可、非ループバックIPv6とinvalidを破棄、残るIPv4のestablished/related/newを許可する。FORWARDはIPv6を破棄し、それ以外は許可する。IPv6の受信・転送を止める方針はIPv6接続が必要な環境へ無条件に持ち込まない。

`entrypoint.sh` はテーブル定義全体を一時ファイルに作り、`nft -c -f` で確認してからトランザクションとして反映する。ログ付き定義を検証できなければ `limit rate ... log ...` 行を除き、カウンター方式の定義を再検証する。再検証・適用失敗時は既存ルールを残し、モードを `failed` と記録する。

2026-10-22の実測では通常カウンターと動的送信元別カウンターが利用可能で、`limit`・`log`・NFLOGの `log group` は `No such file or directory` になった。nftablesパッケージが入っていてもカーネル機能の利用可能性は別であり、Dockerfileだけで解消したと扱わない。

```sh
nft list table inet filter
cat /run/nekoroot-firewall-mode
cat /run/nekoroot-firewall-counter-epoch
tail -n 30 /tmp/nftables.log
```

`rate-limited-log` はログ付きルール適用、`counters-only` はカウンター付きルール適用、`failed` は今回の更新失敗を意味する。ログ付き定義のエラーが `/tmp/nftables.log` に残っていても、代替定義が適用されたかをモード・実際のテーブルで確認する。モードファイルだけで判定しない。

別環境で機能を切り分けるときは、例えば次のdry-runを使う。テスト用テーブル・ルールは実際には作成しない。

```sh
python3 - <<'PY'
import subprocess
for name, expression in [('counter', 'counter'), ('limit', 'limit rate 10/second counter'),
                         ('log', 'log prefix "nft-probe "'), ('nflog', 'log group 20 prefix "nft-probe "')]:
    rules = 'table inet network_capability_probe {\nchain probe {\n' + expression + '\n}\n}\n'
    result = subprocess.run(['nft', '-c', '-f', '-'], input=rules, text=True, capture_output=True)
    print(name, 'OK' if result.returncode == 0 else result.stderr.strip())
PY
```

## 6. ファイアウォールの継続ログ

Dockerfileは `python3`・`util-linux`・`nftables` を導入し、`firewall-stats.py` と `firewall-log.py` を `/app` に配置する。起動スクリプトがルール適用後にログ収集を起動する。

| ファイル | 内容 |
|---|---|
| `/tmp/firewall.log` | UTC日時・ホスト名付きのルール状態、遮断記録、生存記録、取得エラー |
| `/tmp/firewall-collector.log` | 収集プロセス自身の標準出力・標準エラー |
| `/tmp/nftables.log` | nftの検証・適用時の診断。個々の通信履歴ではない |
| `/run/nekoroot-firewall-mode` | 今回適用したルールのモード |
| `/run/nekoroot-firewall-counter-epoch` | ルール適用に伴うカウンター区間の開始日時 |

`firewall-log.py` の動作:

1. 10秒ごとに `nft -j list table inet filter` を読み、送信元別・ルール別の遮断カウンター増分を記録する。DNS/PTR/WHOIS問い合わせをこの収集ループでは行わない。
2. 増分が0なら遮断イベントを重複出力しない。ルール再適用・送信元要素の失効によるリセットを考慮する。送信元セットは各65536件が上限で、要素は最終更新から1日で失効する。完全な通信監査ではない。
3. 約1分ごとに `collector healthy` を記録し、読み取り失敗と復旧も記録する。生存記録を「遮断なし」と読み替えない。
4. `rate-limited-log` のときは `dmesg --follow-new --notime` で新しい `nft-drop` メッセージも読む。共有カーネルバッファを消去しない。読み取り不可・終了時は記録し、カウンター収集を続ける。
5. `/tmp/firewall.log` は0600。約5MiBでローテーションし、現在ファイルと `.1`～`.3` を保持する。SSHログなど他のファイルにも同じローテーションが設定されたという意味ではない。

以下は書式例であり、実際の通信記録ではない。

```text
2026-10-22T10:10:00Z hostname firewall: DROP_COUNTER SRC=192.0.2.1 packets_delta=2 bytes_delta=120 packets_total=5
```

日時は**収集時刻**。個々のパケットの発生時刻・宛先・ポート・payloadを復元する記録ではない。送信元別とルール別の行は同じ遮断の別集計であり、双方を足して総件数にしない。過去の未記録期間を埋め戻さない。

### 起動後・復旧後の確認

```sh
pgrep -af '[f]irewall-log.py'
stat -c '%n %a %s bytes %y' /tmp/firewall.log /tmp/firewall-collector.log
tail -n 20 /tmp/firewall.log
tail -n 20 /tmp/firewall-collector.log
nft -j list table inet filter
```

1分程度の間隔で再確認し、生存記録の日時が進むことを確認する。実際に遮断カウンターが増えたとき、その増分が記録されることも確認する。確認用の架空カウンターやテスト通信を本番ログに実通信として混ぜない。

収集プロセスを手動再起動する場合は、上記で対象プロセスを特定してそのPIDだけを停止する。重複起動防止・自動再起動の監督機構はこの収集プログラムにはない。プロセスが消えた場合は診断ログを確認して復旧し、起動コマンドが成功したことだけで継続動作としない。

当日の一時適用では `/root/cloudflare-workers-github-oauth-1/containers/demo/firewall-log.py` を起動し、実際の遮断カウンターの継続記録を確認した。これは `/app` を使う新イメージの起動確認ではない。セッション配下の子プロセスが終了時に回収される環境では、プロセスを分離し標準入出力をログへ接続して起動する必要がある。全entrypointを実行するとSSH鍵・認証関連なども触るため、収集の復旧目的で全体を再実行しない。

ルールが適用済みで、収集プロセスが存在しないことを確認してから、次のように**収集だけ**を再起動できる。引数の `/app` は実際に配置したディレクトリに合わせる。同じ操作を並列実行しない。このコマンドはファイアウォールルールを変更しない。

```sh
python3 - /app <<'PY'
import os
from pathlib import Path
import subprocess
import sys
script = Path(sys.argv[1]) / 'firewall-log.py'
if not script.is_file() or not script.with_name('firewall-stats.py').is_file():
    raise SystemExit('収集プログラムまたは依存ファイルがありません')
fd = os.open('/tmp/firewall-collector.log', os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
os.fchmod(fd, 0o600)
with os.fdopen(fd, 'ab', buffering=0) as diagnostic:
    process = subprocess.Popen(['/usr/bin/python3', str(script)], stdin=subprocess.DEVNULL,
        stdout=diagnostic, stderr=diagnostic, start_new_session=True)
    print('collector pid:', process.pid)
PY
```

その後、PIDの存在とログ更新を前述の手順で再確認する。PIDを取得できただけでは起動成功・継続動作の証拠にならない。

## 7. 管理画面・ストリームの確認

- `/debug/logs` は管理プロキシ経由で確認する。公開Apacheの `/debug` 拒否を維持する。公開URLを開放して診断の代用にしない。
- `server.js` のログ一覧には `/tmp/firewall.log` と `/tmp/firewall-collector.log` を追加済み。ただし稼働server.jsへの反映は未確認。画面から読めなくてもファイル不存在と決めつけない。
- ストリーム生存確認APIは `/api/aichat/conversation-stream/health`。HTMLの応答・埋め込み構造を確認するもので、認証済み・継続ストリーム受信済みとは異なる。認証入力ページも到達可能な候補に含む。
- 「自動」の候補は到達可能なら緑、不可・確認不能ならグレー。緑丸は選択したiframeから正しいOrigin・送信元で応答を確認した接続先に付く。閉じる・切替・候補消失時に解除し、古い死活確認の応答で状態を巻き戻さない。この画面変更はWorker未デプロイ。
- Apache越しのWebSocketとSSE、認証成功・拒否、切断後の復帰を分けて確認する。Apache側の成功ステータスだけで配信内容の継続受信まで成功としない。

## 8. 反映・記録・残る制約

- Dockerビルドの条件は [AGENTS.md](../../AGENTS.md)・[AGENT.md](../../AGENT.md) に従う。このコンテナではDockerビルドを実行していない。
- ビルドを伴わない確認: `bash -n containers/demo/entrypoint.sh`、`node --check containers/demo/server.js`、`python3 -B -m unittest discover -s containers/demo -p test_firewall_log.py`。Apache/SSHの変更はそれぞれの構文・隔離動作も確認する。
- 手動適用、ソース修正、イメージ反映、Worker反映、再作成後の確認をそれぞれ日時付きで記録する。再作成後はOS・起動パス・ルール・収集継続・公開経路を再確認する。
- `/tmp`、コンテナ内の `/var/log`、カーネル内のカウンターは永続保管先として構成していない。再作成・期限切れ・ローテーションで失われる。長期保存・転送・自動復旧は未実装であり、追加するときは保存先・権限・保持期間と障害時の扱いを定める。
- 秘密値、鍵、トークン、会話本文を手順書へ転記しない。`env` 全文、認証ファイル全文、秘密を含むプロセス引数を診断のために表示しない。
