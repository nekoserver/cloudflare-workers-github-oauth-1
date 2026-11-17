# NOTICE: Apache httpd の構成と、lib SSI へのプロキシ失敗（ECONNREFUSED）の切り分け（2026-11-18）

日付: 2026-11-18（JST）
**対象**: demo コンテナの Apache httpd（`containers/demo/Dockerfile`、`apache-demo.conf`、`apache-lib.conf`、`entrypoint.sh`）と、Worker の管理者プロキシから lib の SSI ダッシュボードへ届く経路。

## 版の状態

- Dockerfile の APACHE_VERSION は 2.4.71（2.4.70 から更新）。脆弱性対応の判定（vuln-watch）では、このピンを根拠に demo の httpd 行を対応済みとした。
- 稼働中コンテナが実際に 2.4.71 で動いているかは、コンテナの版一覧（container-versions.md）の更新で確認するものであり、ピンの更新だけでは実測の裏付けにならない。

## lib SSI の配信経路（Apache の VirtualHost 構成）

- 8443: demo 用。cloudflared のトンネルから届く側で、/lib は拒否する（apache-demo.conf）。
- 8444: Redmine 用（127.0.0.1 のみ）。
- 8445: lib の SSI 用（127.0.0.1 のみ、apache-lib.conf）。DocumentRoot は /var/www/html で、/var/www/html/lib には entrypoint.sh が /root/lib を bind mount する。lib 本体はイメージに入れない方針のため、/root/lib が無いコンテナでは lib SSI は使えない（その旨が起動ログに出る）。
- 8445 へ外部から直接は届かない。到達経路は Worker の管理者プロキシ（/cf-containers/proxy/*、authMiddleware + cfDashboardAdminMiddleware を通過した管理者だけ）→ コンテナの server.js（/lib をそのまま転送）→ 8445 の1本だけである。ダッシュボードの URL は /cf-containers/proxy/lib/muse/dashboard/index.shtml。
- VirtualHost の有効化は、Dockerfile のビルド時に a2ensite 000-demo 010-lib で行う。Apache の起動は entrypoint.sh が apache2ctl で行い、失敗してもコンテナの起動は続け、ログに WARN を残す。

## 2026-11-18 の事象: プロキシ失敗 ECONNREFUSED

/cf-containers/proxy/lib/muse/dashboard/index.shtml を開くと、server.js が `{"error":"libへのプロキシに失敗しました: ECONNREFUSED"}` を返した。

意味: server.js は応答しているので、Worker のプロキシとコンテナと server.js は生きている。接続を拒否したのはコンテナ内の 127.0.0.1:8445 であり、その時点で Apache の lib 用 VirtualHost が待ち受けていなかった。

候補（この時点では未確定）:
- 起動したコンテナが、lib 用 VirtualHost（010-lib）を入れる前の古いイメージで作られている。
- Apache の起動自体が失敗している（configtest の失敗を含む）。

切り分けの場所（本体側）:
- コンテナの起動ログにある「apache2 started」か「WARN: apache2 configtest/start failed」の行。
- コンテナ内の /tmp/apache-configtest.log と /tmp/apache.log。
- コンテナ内で 8445 が待ち受けているか（ss -ltnp）。
- あわせて、/root/lib の bind mount ができているか（起動ログの「lib: mounted /root/lib on /var/www/html/lib」か WARN の行）。mount が無い場合は ECONNREFUSED ではなく 404 になるので、症状で区別できる。

## アクセス制御の要点

- /lib は 8443 側に出さない。管理者プロキシ経由だけが到達経路である。
- ファイル単位のアクセス制限はこの構成では効かないため、ページ内の項目ごとの出し分けはファイルの制限に頼らない。例: lib の tailnet ヘルスチェックの節は、正規ユーザー名（REMOTE_USER）を SetEnvIfExpr で照合したフラグがある場合にだけ内容を出し、それ以外は拒否表示にする（nekoserver/lib PR #152、SPEC.lib.tailnet-health.shtml 版2）。フラグの設定が無い環境では全員に拒否表示になる（fail-closed）。
