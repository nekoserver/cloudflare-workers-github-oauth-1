---
id: SPEC.lib.tailnet-health.shtml
repo: nekoserver/lib
status: draft（出典: 2026-11-18、メインチャットで Okiraku が「lib内にtsノードのヘルスチェック用ssiページを作って」と指示。版2の出典: 同日、Okiraku が「SetEnvIfかなんかで正規ユーザー名からのアクセスかどうかを判定して動的にアクセス拒否を行えるようにすべき」と指示。版3の出典: 同日、Okiraku が「workers.devのほうでテストを進められるようにして」と指示し、保証できる範囲を3層に区切ることを決定した。版4の出典: 2026-11-19、再作成したコンテナで再び `(access denied)` に戻ったことを受け、Okiraku が「恒常化用のコミットしといて。SPECもまとめて」「TIPSもあったほうがいいかも」と指示した）
version: 4
created: 2026-11-18
updated: 2026-11-19
---

# SPEC.lib.tailnet-health.shtml

## 目的と範囲

目的: muse-vm の Tailscale ノード（以下、ノード）のヘルスを、lib の muse ダッシュボードの SSI 断片として表示する。表示する項目は、tailscaled の稼働、ノードの状態と自身の IP、レシーバー（:8090）と API Bridge（:8080）の /health である。既存の断片（status.shtml が常駐物、ports.shtml が待ち受けポート）にはノード自身の状態と IP が無く、ノードが tailnet に参加できているかをダッシュボードから確認できないため、その確認用に分ける。

対象:
- `muse/tailnet-health.sh`（表示内容を作る読み取り専用スクリプト）
- `muse/dashboard/tailnet.shtml`（断片）
- `muse/dashboard/index.shtml` への読み取り区画の追加
- `muse/README.md`、`muse/SPEC.scripts.md`、`muse/dashboard/README.md` の表への追加
- `test/muse_scripts_test.py` の読み取り用スクリプト一覧への追加と、スクリプトのテスト追加
- 版2: 正規ユーザー名による動的アクセス拒否（スクリプトのフラグ確認と、`muse/dashboard/README.md` の Apache 側の前提への SetEnvIfExpr の設定サンプル）
- 版3: フラグの照合対象の切替（`REMOTE_USER` から、Worker プロキシ経路が渡す `X-Forwarded-User` ヘッダへ）と、保証範囲の明記。切替先の経路の仕様は SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity 版8の REQ-LP-001〜003 に従う
- 版4: フラグを立てる SetEnvIf の行の恒常化。本番の行は、本体ワーカー（nekoserver/cloudflare-workers-github-oauth-1）の `containers/demo/apache-lib.conf` の lib VirtualHost 内に実名で置き、コンテナイメージに含める（REQ-TH-014）。あわせて、lib vhost の応答に charset を付ける要求（REQ-TH-015）と、運用TIPSの節を加える。本 SPEC は版4から2つのリポジトリにまたがる（断片とスクリプトは nekoserver/lib、本番設定は本体ワーカー）

対象外:
- ダッシュボードの配信サーバーの起動（配信は本体ワーカーのプロキシ経路で再開済み。前提 P5 を参照）
- ノードの修復操作（状態の破棄、再ログイン、tailscaled の再起動）。このページは表示のみであり、実行の経路を持たない
- 他ノード（本体ワーカーのノード、muse-monitor のノード）の状態表示。このページが読めるのは、この VM 上の tailscaled の LocalAPI と loopback の /health だけである

## 用語

- SSI: Server Side Includes。Apache の mod_include が処理する仕組みを指す。
- 断片: index.shtml に include される .shtml ファイル。`<!--#exec cmd="..." -->` でスクリプトを実行し、出力を埋め込む。
- LocalAPI: tailscaled が unix ソケット経由で出す管理用 API。本 SPEC では `/localapi/v0/status` の GET だけを使う。
- レシーバー: muse-vm の :8090 で動く受信側（lib の `muse/samples/receiver.py`）。

## 前提

| ID | 前提 | 検証状態 |
|---|---|---|
| P1 | tailscaled は `--tun=userspace-networking --statedir=/home/hatch/.local/state/tailscale` で起動し、LocalAPI の unix ソケットは既定の `/var/run/tailscale/tailscaled.sock` にある | 実測で確認済み（2026-11-18、この VM で ps の起動引数とソケットの存在を確認） |
| P2 | LocalAPI の `/localapi/v0/status` の応答は `Version`、`BackendState`、`TailscaleIPs`、`Self`（`HostName`、`DNSName`、`Online`）を含む | 実測で確認済み（2026-11-18、この VM の tailscale 1.104.5 で curl により取得して確認） |
| P3 | レシーバーの `/health` は認証なしで `{"status": "ok"}` を返し、API Bridge の `/health` も認証なしで応答する | 実測で確認済み（2026-11-18、この VM で curl により確認）。レシーバー側の根拠は NOTICE.lib.20261118.receiver-gate.md（2026-11-18）の正とした実装 |
| P4 | SSI の `#exec cmd` の作業ディレクトリは断片ファイルのあるディレクトリであり、スクリプトは相対パス `../` で参照する。スクリプトには実行権限（git で 100755）が要る | 文書のみ（`muse/dashboard/README.md` の前提と既存断片の実績） |
| P5 | ダッシュボードは本体ワーカーのプロキシ経路（Worker → コンテナ server.js → Apache 8445）で配信されており、SSI 経由の表示が実経路で確認できる | 実測で確認済み（2026-11-18 夜〜2026-11-19、ブラウザ経由で断片の内容表示と `(access denied)` の双方を確認）。版3までの「配信サーバー停止中」の記述は版4で置き換える |
| P6 | Apache の実行ユーザから LocalAPI のソケットへ接続し、`/localapi/v0/status` を取得できる | 未確認（配信サーバー停止中のため Apache 経由では確認できない。この VM のソケットの権限は 0666 であることは実測で確認済み）。REQ-TH-004 はこの前提に依拠し、取得できない場合は REQ-TH-006 の表示に倒れる |
| P7 | 配信層が認証を行い、認証されたユーザー名が `REMOTE_USER` として Apache に渡り、SetEnvIfExpr で立てた環境変数が SSI の `#exec` の実行環境に渡る | 版3で不成立と確定（2026-11-18、Worker プロキシ経路では `REMOTE_USER` が渡らないことを実測で確認）。版3では P8〜P11 に置き換える |
| P8 | Worker は、認証済み JWT の `sub` から `X-Forwarded-User` ヘッダを設定し、ブラウザ由来の同名ヘッダを必ず除去する（SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity 版8の REQ-LP-001） | コードで確認済み（2026-11-18、`src/utils/proxyIdentity.ts` とその呼び出し側を読んで確認。PR #2637 でマージ済み） |
| P9 | コンテナの server.js は `/lib` へのプロキシで要求ヘッダをそのまま Apache（127.0.0.1:8445）へ転送する | コードで確認済み（2026-11-18、`containers/demo/server.js` の `proxyToLib` が `headers: req.headers` で転送することを確認） |
| P10 | lib vhost の Apache 設定で `SetEnvIf X-Forwarded-User ^<正規ユーザー名>$ MUSE_TAILNET_HEALTH_OK=1` と書くと、ヘッダが一致した場合にだけ環境変数が立ち、SSI の実行環境（`#printenv` および `#exec`）に渡る | 実測で確認済み（2026-11-18、再現環境: 実物 Apache 2.4.71 バイナリにリポジトリの conf を verbatim で組み、SetEnvIf の行を追加した構成。一致ヘッダで `MUSE_TAILNET_HEALTH_OK=1` が SSI 環境に現れ、ヘッダ無し・別ユーザーでは現れなかった。再現環境の APR ライブラリは Ubuntu 24.04 の deb 由来であり、本番コンテナそのものではない） |
| P11 | 本番コンテナの Apache 設定に、実名を入れた SetEnvIf の行が配置されている | 版3時点では未確認（配置は Okiraku の手元作業であり、実名はリポジトリに書かない。こちらからは配置の有無を確認できない）。REQ-TH-011 と REQ-TH-012 はこの前提に依拠し、成立しない場合はフラグが誰にも立たず全員が拒否される（fail-closed）。版4ではこの前提を P12 に置き換える |
| P12 | フラグを立てる SetEnvIf の行は、本体ワーカーの `containers/demo/apache-lib.conf`（非公開リポジトリのため実名を書ける）の lib VirtualHost 内にあり、コンテナイメージに含まれて再作成後も残る | 前提テストで確認する（AC-TH-008、本体ワーカーのリポジトリで apache-lib.conf の実物を読む）。イメージに焼かれた行が再作成後の実機で効くことは AC-TH-009（次回再作成後の実経路）で確認するまで未確認 |
| P13 | lib の配置（bind mount）では、配置の過程でスクリプトの実行権限が落ちることがある | 実測で確認済み（2026-11-18、配置された tailnet-health.sh が `-rw-r--r--` になっており、断片が空行になった。chmod +x で復旧）。git 上のモードは 100755 であり（AC-TH-003）、落ちるのは配置後の実ファイルである。配置は運用側の作業であり、本 SPEC の保証範囲には含めない（TIPS に切り分けを書く） |

## 保証範囲（版3で決定、2026-11-18、Okiraku の指示）

保証は3層に区切る。層を混ぜて報告してはならない。

- テストで保証する（このリポジトリ内で完結）: README サンプルの形（照合対象が `X-Forwarded-User` ヘッダ、フラグは `MUSE_TAILNET_HEALTH_OK=1`、ユーザー名はプレースホルダ）、スクリプトの振る舞い（フラグが `1` のときだけ表示、それ以外は `(access denied)` のみ・終了コード 0・外部コマンドを呼ばない）、本 SPEC・README・テストの3者の一致。
- 再現環境で確認する（実物 Apache 2.4.71、ただし本番ではない）: SetEnvIf の行が環境変数を立て、それが SSI の実行環境まで届くこと（前提 P10）。
- 保証しない: イメージに焼かれた実名入りの行が、再作成後の実機で実際に効くこと（前提 P12 の後半。AC-TH-009 で次回再作成後に確認するまで未確認）。配置後の実ファイルの実行権限が保たれること（前提 P13、配置は運用側の作業）。稼働中の Worker からコンテナ実機までの実経路でヘッダが届くこと（コードでは P8・P9 で確認済みだが、実測は管理者セッションでしかできない）。ヘッダの偽装耐性そのもの（信頼は「Worker がブラウザ由来を除去する」「lib vhost が loopback 限定で `Require local`」という経路設計によるもので、8445 に直接届くローカルプロセスは偽装できる。帰属表示レベルの前提として扱う）。

版4での変更: 版3では「保証しない」に置いていた本番設定の配置を、本体ワーカーのリポジトリの前提テストで保証する層へ移した（REQ-TH-014、AC-TH-008）。残る未保証は、焼かれた行が再作成後の実機で効くことの実経路確認（AC-TH-009）だけである。

## 要求

- REQ-TH-001: 断片は `muse/dashboard/tailnet.shtml` とし、既存断片と同じ形（`<!--#exec cmd="..." -->` が1件、スクリプト出力の HTML エスケープと行末への `<br>` 付加）でなければならない。
- REQ-TH-002: 実体は `muse/tailnet-health.sh` とし、POSIX sh（先頭 `#!/bin/sh`、`set -u`）の読み取り専用スクリプトでなければならない。状態を変えるコマンドと、tailscale CLI を呼んではならない。
- REQ-TH-003: tailscaled の節では、pgrep と ps で PID と開始時刻を表示しなければならない。プロセスが無い場合は `not running` と表示しなければならない。
- REQ-TH-004: ノードの節では、LocalAPI（`/var/run/tailscale/tailscaled.sock` の `/localapi/v0/status`）を curl で取得し、`BackendState`、tailscale の版、自身の IPv4、ホスト名、DNS 名、Online の真偽を表示しなければならない。本要求は前提 P6 に依拠する。
- REQ-TH-005: 自身の IPv4 は `TailscaleIPs` のうち IPv4 形式の最初の1つとしなければならない。IPv4 が無い場合は `(no IPv4)` と表示しなければならない。
- REQ-TH-006: LocalAPI を取得できない場合（ソケットが無い、curl が失敗する、応答が JSON として読めない、python3 が無い）は、ノードの節に `(local API unavailable)` と表示し、スクリプトは終了コード 0 で終わらなければならない。
- REQ-TH-007: レシーバーの節では `http://127.0.0.1:8090/health` の本文を表示しなければならない。応答が無い場合は `(no response)` と表示しなければならない。
- REQ-TH-008: API Bridge の節では `http://127.0.0.1:8080/health` の本文を表示しなければならない。応答が無い場合は `(no response)` と表示しなければならない。
- REQ-TH-009: LocalAPI の応答の JSON 全文を出力してはならない。表示する項目は REQ-TH-003〜REQ-TH-008 に列挙したものに限らなければならない。鍵の値とノードの公開鍵を出力してはならない。
- REQ-TH-010: `muse/dashboard/index.shtml` に読み取り区画として追加し、`muse/README.md` と `muse/SPEC.scripts.md` の表に行を追加しなければならない。
- REQ-TH-011: スクリプトは、環境変数 `MUSE_TAILNET_HEALTH_OK` が `1` の場合にだけ、REQ-TH-003〜REQ-TH-008 の内容を表示しなければならない。それ以外の場合（フラグが未設定、`1` 以外、認証されていない）は `(access denied)` の1行だけを表示し、ノード情報（PID、開始時刻、状態、版、IP、ホスト名、DNS 名、/health の本文）を一切出力してはならず、終了コード 0 で終わらなければならない（fail-closed）。本要求は前提 P8〜P11 に依拠する（フラグを立てるのは配信側であり、スクリプトはフラグの有無だけを見る）。スクリプト自体は版2から変更しない。
- REQ-TH-012: フラグは、配信側の Apache 設定が `SetEnvIf` で要求ヘッダ `X-Forwarded-User` を正規ユーザー名と照合して立てなければならない。設定サンプルは `SetEnvIf X-Forwarded-User ^REGULAR_USER$ MUSE_TAILNET_HEALTH_OK=1` の形とし、正規ユーザー名の実名はリポジトリに書いてはならず、プレースホルダで示し、`muse/dashboard/README.md` の「Apache 側の前提」に置かなければならない。版2の `REMOTE_USER` 照合のサンプルは置き換え、残してはならない。
- REQ-TH-013: `index.shtml` への組み込みは維持しなければならない。断片自体は認証の有無で変わらず、拒否はスクリプトがフラグを見て動的に行う。ファイル単位のアクセス制限が効かない配信形態でも、内容は正規ユーザー以外に出ない形とするための判断である。
- REQ-TH-014: 本番でフラグを立てる SetEnvIf の行は、本体ワーカー（nekoserver/cloudflare-workers-github-oauth-1）の `containers/demo/apache-lib.conf` の lib VirtualHost 内に、正規ユーザー名の実名で置き、コンテナイメージに含めなければならない。行の形は `SetEnvIf X-Forwarded-User ^<実名>$ MUSE_TAILNET_HEALTH_OK=1` とする。稼働中インスタンスへのその場の挿入（アドホック対応）だけで済ませてはならない。再作成で消えるためである。lib 側の README サンプル（REQ-TH-012、プレースホルダ）とは役割が異なり、両方を維持する。本要求は前提 P12 に依拠する。
- REQ-TH-015: lib vhost の応答には、文字コード utf-8 を示す charset が付かなければならない。断片（.shtml）は文書ではないため断片側に宣言を置けず、付ける場所は配信側の応答ヘッダとする。具体形は `containers/demo/apache-lib.conf` の lib VirtualHost 内の `AddDefaultCharset utf-8` とする（2026-11-19、PR #2659 で実装しマージ済み。前提テストは AC-TH-008 と同じファイルで判定する）。

## 例外ケース

- フラグが立っていない場合（未設定、`1` 以外、未認証）: `(access denied)` の1行だけを表示し、以下の各節の表示には進まない。スクリプトは終了コード 0 で終わる。以後の例外は、フラグが立っている場合のものである。
- tailscaled が動いていない場合: tailscaled の節は `not running`、ノードの節は `(local API unavailable)`、レシーバーと API Bridge の節は各自の取得結果を表示する。スクリプトは終了コード 0 で終わる。
- LocalAPI のソケットが無い場合: REQ-TH-006 の表示に倒れる。他の節は影響を受けない。
- curl が無い場合: ノード、レシーバー、API Bridge の各節に `curl not found` と表示する（muse-status.sh と同じ流儀）。
- python3 が無い場合: ノードの節は `(local API unavailable)` と表示する。他の節は影響を受けない。
- レシーバーまたは API Bridge が止まっている場合: その節は `(no response)` と表示する。他の節は影響を受けない。
- LocalAPI の応答の形が前提 P2 と違う場合: 読めない項目は `unknown` と表示し、IPv4 が読めなければ `(no IPv4)` と表示する。応答全体が JSON として読めない場合は REQ-TH-006 の表示に倒れる。

## 故障モードと影響範囲

| 故障モード | 影響範囲 |
|---|---|
| tailscale の版上げで LocalAPI の応答の形が変わる | ノードの節が `(local API unavailable)` または `unknown` の表示になる。他の節とダッシュボードの他の区画は影響を受けない。復旧するまでノードの状態と IP はこのページで確認できない。版を上げるときは前提 P2 を実測し直す |
| Apache の実行ユーザがソケットへ接続できない（前提 P6 の不成立） | ノードの節が常時 `(local API unavailable)` になる。tailscaled の節と /health の節は表示できる。ノード自体の稼働には影響しない |
| スクリプトの出力に想定外の項目（公開鍵）が混ざる | ダッシュボードを見られる範囲にノードの公開鍵が出る。公開鍵は秘密ではないが、表示項目を REQ-TH-009 で限定し、テスト（AC-TH-002）で混入を検査する |
| SetEnvIfExpr の照合条件の誤りでフラグが全員に立つ | ノード情報（状態、IP、/health の本文）がダッシュボードを開ける全員に出る。緩和: 設定サンプルはプレースホルダのままであり、置く側が実名に置き換えて照合を書かない限りフラグは誰にも立たない。照合式の実物確認は配信側の設定の責任範囲であり、本リポジトリでは行えない |
| フラグが正規ユーザーにも立たない（前提 P7 の不成立: 認証が `REMOTE_USER` を渡さない、環境変数が #exec に渡らない） | 正規ユーザーにも `(access denied)` になる（fail-closed で安全側）。ノード自体の稼働には影響せず、確認はホストのシェルでスクリプトにフラグを渡して直接実行することで代替できる |
| README サンプルだけが版3に更新され、本番コンテナの設定に実名入りの行が配置されない（前提 P11 の不成立） | 正規ユーザーにも `(access denied)` のままになる（fail-closed で安全側、情報は漏れない）。テストは全て通るため、リポジトリ側だけでは検出できない。検出は本番での表示確認（管理者セッション）でのみ可能。版4で REQ-TH-014 により解消する（行をイメージ側に置き、前提テストで検出可能にした） |
| 行を稼働中インスタンスへその場で挿入しただけで、イメージ側に入っていない | 次の再作成で行が消え、正規ユーザーにも `(access denied)` に戻る。fail-closed で情報は漏れない。恒常化は REQ-TH-014 のとおりイメージ側のリポジトリに入れて初めて完了とする。実績（2026-11-18〜19）: 18日夜に実機切り分けの中で稼働中インスタンスの /etc/apache2 へ手挿入して開通し、ブラウザ表示まで確認した。19日 09:29、本体側の通常作業である PR #2462（会話ストリームの接続先の作り直し）のマージでビルドとデプロイが走り、コンテナが再作成されて行が消え、10:50 に deny の再発が報告された。行の存在はどちらのリポジトリにも記録が無かったため、本体側の作業からは行が見えず、消えた理由の記録も生まれなかった。恒常化の理由はこの点にある: 再作成で消えること自体よりも、変更が記録の外にあって他の作業から見えないことが問題だった |
| 配置の過程でスクリプトの実行権限が落ちる（前提 P13） | 断片が空行になる（実行エラーがパイプラインの sed 側に流れず、SSI のエラー表示も出ないため）。`(access denied)` とは症状が異なるので、切り分けは TIPS に従う。ダッシュボードの他の区画は影響を受けない |
| 8445 に直接届くローカルプロセスが `X-Forwarded-User` を偽装する | そのプロセスからは正規ユーザーとして表示が開く。影響は表示（ノードの状態、IP、/health の本文）の範囲に限られ、実行経路はこのページに存在しない。緩和は経路設計（Worker がブラウザ由来のヘッダを除去すること、vhost が loopback 限定で `Require local` であること）であり、このヘッダを帰属表示の根拠として扱い、実行可否の根拠にはしない |

## 受け入れ条件

- AC-TH-001（REQ-TH-002、REQ-TH-003、REQ-TH-006、REQ-TH-007、REQ-TH-008）: `test/muse_scripts_test.py` で外部コマンドを偽物に差し替えて判定する。フラグ `MUSE_TAILNET_HEALTH_OK=1` を立てた条件で、tailscaled が無い場合は `not running`、LocalAPI の取得に失敗した場合は `(local API unavailable)`、レシーバーと API Bridge が無応答の場合は `(no response)` が出て、終了コードが 0 で、tailscale CLI が呼ばれていないこと。
- AC-TH-002（REQ-TH-004、REQ-TH-005、REQ-TH-009）: 偽の curl が LocalAPI の JSON（前提 P2 の形）を返す条件で、フラグを立てて判定する。state、版、IPv4、ホスト名、DNS 名、online が抽出して表示され、応答に含めた公開鍵の文字列が表示されないこと。IPv4 を含まない応答では `(no IPv4)` が出ること。
- AC-TH-003（REQ-TH-001、REQ-TH-010）: `test/muse_scripts_test.py` のダッシュボード整合のテストで判定する。断片が実在するスクリプトを指して出力をエスケープすること、index.shtml の区画と `muse/README.md` の表に含まれること、スクリプトが git で 100755 であること。
- AC-TH-004（REQ-TH-004、REQ-TH-007、REQ-TH-008）: 実経路で判定する。この VM の実物に対してスクリプトをフラグを立てて実行し、`BackendState` が Running、IPv4 が 100.86.29.77、レシーバーと API Bridge の節に `{"status": "ok"}` が表示されることを確認する。SSI 経由の表示の実経路判定は、版4で AC-TH-009 に分けた（版3までは前提 P5 の旧状態により判定しなかった）。
- AC-TH-005（REQ-TH-011）: `test/muse_scripts_test.py` で判定する。外部コマンドがすべて成功する条件でも、フラグ未設定の場合と `1` 以外の値の場合に、出力が `(access denied)` の1行だけで、PID、状態、IPv4、/health の本文が一切出ず、外部コマンドが呼ばれず、終了コードが 0 であること。
- AC-TH-006（REQ-TH-012、REQ-TH-013）: `test/muse_scripts_test.py` で判定する。`muse/dashboard/README.md` の、フラグ `MUSE_TAILNET_HEALTH_OK=1` を立てる SetEnvIf の行が、要求ヘッダ `X-Forwarded-User` を照合対象とし、ユーザー名がプレースホルダ `REGULAR_USER` であること。あわせて、その行が `REMOTE_USER` を照合対象としていないこと。判定はフラグを立てる行だけを対象とし、README の説明文中の語の有無では判定しない。
- AC-TH-007（前提 P10）: 再現環境（実物 Apache 2.4.71 バイナリにリポジトリの conf を verbatim で組んだ構成）で判定する。lib vhost に AC-TH-006 のサンプルと同形の SetEnvIf の行を置き、SSI の `#printenv` で環境を出す探査ページに対し、一致する `X-Forwarded-User` ヘッダ付きの要求では `MUSE_TAILNET_HEALTH_OK=1` が環境に現れ、ヘッダ無しと別ユーザーのヘッダでは現れないこと。2026-11-18 に実施し、3条件とも満たした。再現環境は本番コンテナではないため、本番での成立は AC-TH-006 の範囲外であり、前提 P11 と合わせて未決事項で追う。
- AC-TH-008（REQ-TH-014、REQ-TH-015）: 本体ワーカーのリポジトリの前提テスト（`src/cf-containers-lib-route-wiring.test.ts`）で判定する。実物の `containers/demo/apache-lib.conf` の lib VirtualHost 内に、`X-Forwarded-User` を照合して `MUSE_TAILNET_HEALTH_OK=1` を立てる SetEnvIf の行が実名で存在すること。あわせて `AddDefaultCharset utf-8` が存在すること（REQ-TH-015、PR #2659 で追加済みの行の維持もここで判定する）。
- AC-TH-009（REQ-TH-014）: 実経路で判定する。REQ-TH-014 の行を含むイメージで再作成したインスタンスに対し、管理者セッションのブラウザで `/cf-containers/proxy/lib/muse/dashboard/tailnet.shtml` を開き、手作業の挿入なしに正規ユーザーへ内容が表示され、フラグの立たない条件では `(access denied)` になること。判定は再作成のたびではなく、行を含む最初の再作成で1回行う。実施までは未確認として扱う。

## 移行手順

版1:
1. 本 SPEC を書く。
2. `test/muse_scripts_test.py` にテストを先に書き、失敗を確認する。
3. `muse/tailnet-health.sh` と `muse/dashboard/tailnet.shtml` を作り、index.shtml と各 README、SPEC.scripts.md を更新する。
4. テストを実行し、AC-TH-004 の実機確認を行う。
5. 追加と変更を git の index に登録する（スクリプトは 100755）。push はしない。

版2（動的アクセス拒否）:
1. 本 SPEC を版2に改訂する。
2. `test/muse_scripts_test.py` の TailnetHealthTest を書き換え・追加し（内容のテストはフラグありで実行、拒否のテストと README のサンプルのテストを追加）、失敗を確認する。
3. `muse/tailnet-health.sh` にフラグ確認を入れ、`muse/dashboard/README.md` に SetEnvIfExpr の設定サンプルを追加し、`muse/SPEC.scripts.md` の出力形式に拒否表示を追記する。
4. テストを実行し、実機でフラグあり（従来どおり表示）とフラグなし（`(access denied)` のみ）を確認する。配信サーバーは起動しない。
5. 変更を git の index に登録する。push はしない。

版3（照合対象の切替）:
1. 本 SPEC を版3に改訂する（前提 P8〜P11、保証範囲、REQ-TH-011・012 の改訂、AC-TH-006 の改訂と AC-TH-007 の追加）。
2. 前提 P10 を再現環境で実測する（AC-TH-007）。
3. `test/muse_scripts_test.py` の README サンプルのテストを版3の形に書き換え、現行 README（版2の形）に対して失敗することを確認する。
4. Lint EVAL で本 SPEC を判定する。
5. 実装はその後である: `muse/dashboard/README.md` のサンプルを版3の形に差し替え、テストが全て通ることを確認する。スクリプトは変更しない。本番コンテナへの配置（実名入りの行）は Okiraku の手元作業であり、この手順には含めない。

版3の実施記録（2026-11-18）: 手順1〜4を実施し、Lint EVAL は pass（error 0 / warning 0、EVAL.lib.tailnet-health.shtml）。手順5の実装は PR nekoserver/lib#153 で行った。スクリプト本体は無変更だが、`muse/tailnet-health.sh` のアクセス制御コメントの照合対象の記述は README に合わせて更新した（振る舞いは無変更）。TailnetHealthTest 7/7 通過、全スイートは pristine と失敗・エラー一覧が同一であることを確認した。マージと本番配置は未実施。

版4（恒常化）:
1. 本 SPEC を版4に改訂する（前提 P5 の置き換え、P12・P13 の追加、REQ-TH-014・015、AC-TH-008・009、運用TIPS、保証範囲の更新）。
2. Lint EVAL で本 SPEC を判定する。
3. 本体ワーカーのリポジトリで、pristine な main の配線テストとガード一式のベースラインを測る（緑でなければテスト側を先に直す）。
4. `src/cf-containers-lib-route-wiring.test.ts` に AC-TH-008 の前提テストを先に書き、現行の apache-lib.conf に対して失敗することを確認する。
5. `containers/demo/apache-lib.conf` の lib VirtualHost に実名入りの SetEnvIf の行を入れる。
6. 配線テストの通過と、ガード一式がベースラインと同一であることを確認する。あわせて実物 Apache 2.4.71 の再現環境で新 conf の `apache2 -t` を確認する。
7. ブランチを push し、PR を作る。本 SPEC の写しを PR に含める。
8. 実経路の確認（AC-TH-009）は、行を含むイメージでの再作成後に Okiraku の管理者セッションで行う。この手順には含めない。

版4の実施記録（2026-11-19）: 手順1〜7を実施した。Lint EVAL は pass（error 0 / warning 0、EVAL.lib.tailnet-health.shtml 版4補遺）。ベースラインは pristine な main（6f0b99ed）で配線テスト 11/11、ガード一式 385 passed / 2 failed（失敗は image-lock の前提チェック＝意図的に赤、t3 PWA 診断＝環境要因）。AC-TH-008 の前提テストを先に書き、現行 conf に対して失敗を確認してから apache-lib.conf に行を入れた。実装後は配線テスト 12/12、ガード一式 386 passed / 2 failed（ベースラインと同一）。実物 Apache 2.4.71 の再現環境で新 conf の `apache2 -t` が Syntax OK であることも確認した。PR は nekoserver/cloudflare-workers-github-oauth-1#2663（branch fix/lib-tailnet-flag-bake-20261119 @ 8d4f006c）。マージと AC-TH-009 の実経路確認は未実施。

中止条件: 既存のテストが壊れる場合、または AC-TH-004 の実機確認で REQ-TH-009 に反する項目（公開鍵）が出力される場合は、追加を取りやめる。版2では加えて、フラグなしの実機確認でノード情報が1項目でも出た場合は、版2の変更を取りやめる。版3では加えて、AC-TH-007 の再現確認で一致ヘッダでもフラグが SSI 環境に現れない場合は、切替を取りやめる。版4では加えて、ガード一式にベースラインを超える新規失敗が出た場合は実装を取りやめる。

復帰先: 版1については追加ファイルの削除と、index.shtml、各 README、SPEC.scripts.md の差し戻しである。版2については、スクリプトのフラグ確認の削除と、README の設定サンプルの削除で版1の状態に戻る。版3については、README のサンプルを版2の形（`REMOTE_USER` 照合）に戻し、本 SPEC を版2に戻す。本番へは何も配置していないため、リポジトリの外に影響はない。版4については、PR を revert すれば行がイメージから消え、版3の状態（配置は手作業）に戻る。どちらの状態でも fail-closed であり、情報が漏れる側には倒れない。復帰先のない手順は開始してはならない。

## 復旧手順

この構成要素は状態を持たない（読み取り専用であり、表示のたびに取得し直す）。そのため、保持した状態の復旧手順は存在しない。表示がおかしい場合の切り分けは、ホストのシェルで `muse/tailnet-health.sh` を直接実行し、節ごとに取得の成否を確認することである。確認基準は AC-TH-004 と同じとする。

## 運用TIPS（版4で追加、2026-11-19、Okiraku の指示）

2026-11-18 夜の実機切り分けで得た、次回同じ症状で時間を溶かさないための記録。要求ではない。

- deny と空行は別の故障である。`(access denied)` が出ているならスクリプトは実行されていて、フラグが立っていないだけである（設定の行が無い・照合が合わない）。空行ならスクリプトが実行できていない（実行権限が落ちている状態が該当する）。先に症状で層を分ける。
- 設定は実物の Apache 設定に入れる。README のサンプルは設定ではない。入れたかどうかは、コンテナ側で `grep -R 'MUSE_TAILNET_HEALTH_OK' /etc/apache2/` を実行して実物で確認する（2026-11-18 はサンプル側を編集していて実物に無く、grep の空振りで判明した）。
- シェルの export は SSI の実行環境に届かない。対話シェルでフラグを export して単体実行すると内容が見えるが、それは継承した環境のためであり、本番経路（Apache の SetEnvIf）で立っている証拠にはならない。
- アドホック対応（稼働中インスタンスへのその場の挿入・権限変更）は再作成で消える。消えて困るものは、その場で直して終わりにせず、イメージ側のリポジトリに入れて初めて完了とする。今回の SetEnvIf の行がその実例である（2026-11-18 夜に手挿入し開通、2026-11-19 に本体側の通常作業 PR #2462 のマージ→再作成で行が消えて再発した。行の存在がどちらのリポジトリにも記録されていなかったため、本体側の作業からは見えず、消えた理由の記録も残らなかった）。
- 表示を grep で検査するのは健全性確認の方法として筋が悪い。表示は人向けの射影であり（言い回し、エスケープ、charset で変わる）、grep の不一致は「落ちている」のか「文面が変わった」のか「検査側にフラグが無い」のかを区別できない。確認は /health のようなデータの継ぎ目で行う。

## 未決事項

- ダッシュボードの配信サーバーの再開と、このページの実配置。判断者: Okiraku。期限は定めない。
- 前提 P6（Apache の実行ユーザから LocalAPI が取得できるか）の確認。配信サーバーの再開と一体の確認になる。判断者: Okiraku。期限は定めない。
- 前提 P11（本番コンテナの Apache 設定への実名入りの SetEnvIf の行の配置）と、正規ユーザー名の実名の決定。判断者: Okiraku。期限は定めない。版4で扱いを変更した: 実名は `nekoserver`（2026-11-18 の実機切り分けで Okiraku が使った値）とし、配置先は REQ-TH-014 のとおりイメージ側に移した。残るのは AC-TH-009 の実経路確認のみである。
- 本番の実経路（Worker からコンテナ実機まで）で `X-Forwarded-User` が届き、tailnet 区画が正規ユーザーにだけ表示されることの確認。管理者セッションでしか確認できない。判断者: Okiraku。期限は定めない。経路そのものは 2026-11-19 にブラウザ表示で確認済みであり、版4では AC-TH-009 として、行を含むイメージでの再作成後に再確認する。
