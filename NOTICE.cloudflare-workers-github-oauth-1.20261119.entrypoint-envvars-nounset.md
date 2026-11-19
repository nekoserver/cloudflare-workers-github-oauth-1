# NOTICE: entrypoint の set -u が envvars の読み込みを落とし、Apache が起動しなかった（2026-11-19）

## 事象

2026-11-19、デプロイに伴うコンテナの再作成の後、Apache が 8443 と 8445 の両方で待ち受けなくなった。外形は、lib プロキシ経路の `{"error":"libへのプロキシに失敗しました: ECONNREFUSED"}` と、トンネル（mygw）経由の 502。コンテナ自体と server.js、tailscaled は稼働していた。

## 原因

稼働インスタンスの /tmp/apache.log に次が残っていた。

```
/etc/apache2/envvars: line 7: APACHE_CONFDIR: unbound variable
```

entrypoint.sh は `set -u` で動作し、PR #2658（REQ-LW-011）で Apache の起動を `( . /etc/apache2/envvars; /usr/sbin/apache2 -k start )` というサブシェルに変えた。bash のサブシェルは nounset を継承する。envvars の7行目は、まだ設定されていない APACHE_CONFDIR を展開（`${APACHE_CONFDIR##/etc/apache2-}`）するため、読み込みの時点でサブシェルが異常終了し、httpd が実行されなかった。

configtest が通ったのは、apache2ctl が別プロセス（/bin/sh）で entrypoint の nounset を継承しないためである。起動の段だけが落ちるため、configtest の成功は起動可能性の根拠にならない。

## なぜ前提テストで捕まらなかったか

REQ-LW-011 の前提チェックは entrypoint の文字列（直接起動があること、envvars の読み込みが前にあること、起動後の待ち受け確認があること）を固定するものであり、シェルのオプション継承という実行時の意味は対象外だった。欠陥は #2658 の変更自体にあり、テストの分割（前提チェックと振る舞いの検証の混在）の問題でもある。

## 修正

起動のサブシェルで、envvars を読む前に nounset を解除する。

```
( set +u; . /etc/apache2/envvars; /usr/sbin/apache2 -k start )
```

仕様は SPEC.cloudflare-workers-github-oauth-1.lib-apache-wiring 版5（REQ-LW-012、故障モード F6、AC-LW-006、運用TIPS）。前提チェックに、解除が読み込みより前にあることを固定する1件を追加した。故障注入（set +u を外す変異）で該当テストが落ちることを確認済み。

部品レベルの確認として、muse-vm の Apache 2.4.71 再現環境で実物の envvars を set -u の bash から読み、解除なしでは同じ行で同じエラーになること、解除ありでは読み込みが完了することを確認した。

## 手動復旧

稼働中インスタンスでは、同じ形でその場で起動できる（2026-11-19 に実機で復旧を確認）。対話シェルには通常 set -u が無いため、解除なしでも起動することがあるが、それは偶然であり、スクリプト経由では必ず解除が要る。
