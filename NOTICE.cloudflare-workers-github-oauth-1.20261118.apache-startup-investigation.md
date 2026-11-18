# NOTICE: Apache 起動失敗の切り分けと、証明書の焼き込み・最終形 configtest のビルド時実行

日付: 2026-11-18
対象: containers/demo（Dockerfile、Apache 配線）
仕様: SPEC.cloudflare-workers-github-oauth-1.lib-apache-wiring 版3（REQ-LW-010、AC-LW-004）

## 経緯

- CLAUDE_NATIVE_SHA256 の不一致を直した新イメージ（PR #2652）で再作成したインスタンスでは、Apache は 8443 で動くが lib の VirtualHost（8445）が待ち受けず、/cf-containers/proxy/lib/* が ECONNREFUSED を返した。
- その後（PR #2654 / #2655 のイメージ）では、Apache 自体が起動しなくなった。ページ上は mod_vhost_alias が「導入済み・非有効化」と表示される。

## 切り分け（忠実再現）と結果

Ubuntu 26.04 の apache2 パッケージ（2.4.66-2ubuntu2）の deb から骨格を展開し、パッケージ postinst の既定有効化（モジュール・conf）まで再現した上で、Dockerfile の操作（tarball の Apache 2.4.71 でバイナリとモジュールを置換、apache-demo.conf / apache-lib.conf の配置、a2enmod・a2ensite・security.conf の sed）、container_setup.py の container-ssi.conf、entrypoint 式の自己署名証明書をすべて入れた状態で検証した。

- configtest は Syntax OK、`apache2 -S` で両 VirtualHost（*:8443 demo / 127.0.0.1:8445 lib）が表示され、実際に起動して 8443・8445 の両方が応答した。
- mod_vhost_alias は再現側でも有効化していない（Dockerfile の a2enmod に無い）が、その状態で起動した。リポジトリ内のどの設定も vhost_alias のディレクティブ（VirtualDocumentRoot 等）を使っていない。したがって vhost_alias の非有効化は起動失敗の原因ではない。
- 構造的な穴が1つ見つかった。Dockerfile のビルド時 `apache2 -t`（apache 置換の手順内）は、サイトの COPY と a2ensite より前で実行されるため、既定設定しか検証しておらず、最終形の設定はビルド時に一度も検証されていなかった。

結論: リポジトリの設定とイメージの組み立ては無罪であり、原因は実コンテナの実行時側にある。残る候補は (1) entrypoint の証明書生成が実機で失敗し、証明書不在で configtest が落ちる、(2) configtest は通るが start が落ちる、(3) ビルド時の apt 取得分のずれで実機の /etc/apache2 が再現と食い違う、のいずれか。決定証拠は実機の /tmp/apache-configtest.log と /tmp/apache.log（entrypoint が起動のたびに残す。/debug/logs で管理者セッションから読める）で、未読である。

## 本変更（REQ-LW-010）

- TLS 証明書を起動時生成からビルド時生成（イメージへの焼き込み）に変えた。自己署名で検証もされない証明書であり、起動時生成は失敗の分岐だけを生んでいた（候補 (1) の解消）。entrypoint の生成処理は、証明書が無い場合の予備として、存在チェック付きで残してある。
- 最終形の設定に対する `apache2 -t` を、サイト有効化と証明書配置の後にビルド時実行するよう足した。落ちる設定はビルドの失敗として表に出て、イメージ選択のフォールバックにより旧イメージが使われるため、壊れた Apache のイメージが稼働に置き換わることはなくなる。
- 前提チェックを src/cf-containers-lib-route-wiring.test.ts に3件追加した（証明書生成の存在、a2ensite より後という順序、entrypoint の存在チェックの維持）。実装前に2件の失敗を確認済み。

## 検証と未検証

- テストで確認: 追加した前提チェック3件を含む同ファイルの全件、およびガードスイート（新規の失敗なし、既知の2件を除く）。
- 未検証: 本変更が現在の起動失敗そのものを直すかどうかは、実機ログ（上記）が未読のため断定しない。デプロイ後の実経路確認は、Apache の起動、`apache2ctl -S`、8445 の待ち受け、lib の SSI 実行である。Docker ビルド自体はこの環境では実行していない（リポジトリの規則により Workers Builds 側で確認する）。
