---
id: SPEC.cloudflare-workers-github-oauth-1.lib-apache-wiring
repo: nekoserver/cloudflare-workers-github-oauth-1
source: 2026-11-18 Okiraku 指示（lib 経路の配線を前提テストで炙り出せるようにし、その仕様の要件を Lint 化する）
status: draft
version: 3
created: 2026-11-18
updated: 2026-11-18
---

# SPEC.cloudflare-workers-github-oauth-1.lib-apache-wiring

## 目的と範囲

対象は、demo コンテナ内部の Apache 配線 — server.js の lib 内部プロキシ先、apache-lib.conf の VirtualHost、Dockerfile でのサイト配置と有効化（a2ensite）とモジュール有効化（a2enmod）、apache-demo.conf（トンネル側 8443）の /lib 拒否 — である。

結論（should-be）: この配線の一致は、実リポジトリのファイル同士を突き合わせる前提チェックで固定しなければならない。片方だけが変わる変更（プロキシ先ポートだけを変える、サイトを置いて有効化し忘れる、モジュールを外す、公開側の拒否を外す）は、実稼働ではなくテストで落ちなければならない。

動機となった実例（2026-11-18）: 版の不一致（CLAUDE_NATIVE_SHA256）を直した新イメージでコンテナを再作成した後も、/cf-containers/proxy/lib/* が `{"error":"libへのプロキシに失敗しました: ECONNREFUSED"}` を返した。server.js のプロキシ先（8445）で待ち受ける VirtualHost が稼働インスタンスで有効でなく、Apache が 8443 で動いていても lib だけが届かなかった。

位置付け: ポート・経路の正本管理は SPEC.cloudflare-workers-github-oauth-1.port-route-registry（REQ-PR、正本ファイルは未決）が担い、経路全体の段階確認は SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity の REQ-LP-010 が担う。本 SPEC はその間の「コンテナ内部の Apache 配線の静的な一致」に限る。

### テスト対象

| ID | 対象 | 実体 | テストの置き場所 |
|----|------|------|------------------|
| T1 | server.js のプロキシ先と apache-lib.conf の待ち受けの一致 | `containers/demo/server.js`、`containers/demo/apache-lib.conf` | repo のテスト（`src/cf-containers-lib-route-wiring.test.ts`） |
| T2 | Dockerfile のサイト配置・有効化とモジュール有効化 | `containers/demo/Dockerfile`、`containers/demo/apache-lib.conf`、`containers/demo/apache-demo.conf` | 同上 |
| T3 | トンネル側 vhost の /lib 拒否の維持 | `containers/demo/apache-demo.conf` | 同上 |

### 対象外

- 稼働中インスタンスの実態（8445 が実際に待ち受けているか）。これはイメージ内配線の正しさでは証明できず、REQ-LP-010 の段階確認とインスタンス再作成後の `apache2ctl -S` 確認が担当する。本 SPEC の受け入れ条件に実経路の成功を含めない。
- ポート番号の値そのものの選定（8443/8445 の是非）。本 SPEC が固定するのは値ではなく一致である。
- 正本ファイル（routes.json 等）への移行。REQ-PR 側の未決事項であり、本 SPEC のチェックは正本が決まったらそちらへ寄せる。

## 用語

- 前提チェック: フィクスチャではなく実リポジトリの実ファイルを読んで突き合わせるテスト。イメージロックの前提チェック（2026-11-18、PR #2649）と同じ方式。
- 配線: 繋ぎ込む前提で値が一致しなければならない設定の組（ポート、配置先パス、有効化対象、モジュール名）。

## 前提

| ID | 前提 | 検証状態 |
|----|------|----------|
| P1 | Dockerfile は Workers Builds がイメージを作る際の実レシピであり、COPY と RUN（a2ensite / a2enmod）は最終ステージの /etc/apache2 に効く | 2026-11-18 に Dockerfile 実読で確認（COPY apache-lib.conf → sites-available/010-lib.conf、同一 RUN で a2ensite 000-demo 010-lib） |
| P2 | a2ensite / a2enmod の意味は Debian の apache2 パッケージの通り（sites-enabled / mods-enabled への symlink 作成） | 一般に知られた挙動。イメージ内での実行結果そのものは未実測（対象外の実経路側） |
| P3 | server.js の LIB_PORT が lib への内部プロキシの唯一の接続先ポートである | 2026-11-18 に server.js 実読で確認（proxyToLib は LIB_PORT を既定値とし、呼び出し側はポートを上書きしない） |
| P4 | lib の VirtualHost が要るモジュールは、その conf が使うディレクティブから決まる（INCLUDES フィルタ→include、cgi-script ハンドラ→cgid） | conf 実読で確認。MPM はスレッド型（mpm_event）のため CGI は cgid であることも Dockerfile のモジュール存在チェック行で確認 |

## 要件

- REQ-LW-001: server.js の LIB_PORT と、apache-lib.conf の Listen のポートと VirtualHost のポートは、一致しなければならない。
- REQ-LW-002: lib の VirtualHost は 127.0.0.1 でのみ待ち受けなければならず、ワイルドカードの Listen を持ってはならない。
- REQ-LW-003: apache-lib.conf の /var/www/html/lib の Directory は、SSI（+Includes と INCLUDES フィルタ）と CGI（+ExecCGI と cgi-script ハンドラ）を許可し、Require local に絞らなければならない。
- REQ-LW-004: Dockerfile は apache-lib.conf を /etc/apache2/sites-available/010-lib.conf に、apache-demo.conf を 000-demo.conf に配置しなければならない。
- REQ-LW-005: Dockerfile の最終ステージは、REQ-LW-004 の配置の後に、a2ensite で 000-demo と 010-lib の両方を有効化しなければならない。
- REQ-LW-006: Dockerfile の最終ステージの a2enmod は、各 VirtualHost が使うモジュールを含まなければならない。lib 側は include と cgid、demo 側は ssl・proxy・proxy_http・proxy_wstunnel・rewrite・remoteip。要否の根拠（conf 側の使用箇所）は、同じテストで固定しなければならない。
- REQ-LW-007: apache-demo.conf は /lib を含む LocationMatch で Require all denied を維持しなければならず、その Listen（8443）は lib のポートと重なってはならない。
- REQ-LW-008: REQ-LW-001〜007 のチェックは、ガードスイート（npx vitest run src/cf-containers）で、フィクスチャではなく実リポジトリのファイルに対して実行されなければならない。
- REQ-LW-009: コンテナのヘルス（server.js の /health）と /cf-containers のヘルスチェック表は、Apache を 8443 と lib 専用ポート（REQ-LW-001 のポート）で別々に探査し、別カラムで表示しなければならない。片方だけの判定で Apache 全体の状態としてはならない。lib 専用ポートの値を返さない旧イメージに対しては、その欄を NG ではなく不明と表示しなければならない。
- REQ-LW-010: demo 側 VirtualHost の TLS 証明書（/etc/apache2/tls/nekoroot.crt と鍵）は、起動時に毎回生成するのではなく、イメージのビルド時に生成して焼き込まなければならない。証明書は自己署名で検証もされないため、起動時生成は失敗の分岐だけを生む。entrypoint の生成処理は、証明書が無い場合の予備として残す（存在チェックのガードを外してはならない）。さらに、最終ステージは REQ-LW-005 のサイト有効化の後に、最終形の設定で apache2 -t（configtest）を実行しなければならず、落ちる設定はビルドの失敗として表に出なければならない（ビルドが失敗すればイメージ選択側のフォールバックで旧イメージが使われ、壊れた Apache のイメージが稼働に置き換わることはない）。

## 例外

- E1: ポート番号の変更は、関係する全ファイルで同時に行う限り許される。チェックは値ではなく一致を固定する。
- E2: a2enmod に REQ-LW-006 の必須分を超えるモジュールを足すことは許される。チェックは含有を固定し、集合の完全一致は固定しない。
- E3: Debian の apache2 パッケージが既定で有効化するモジュール（mpm_event 等）は、a2enmod の引数に現れなくても REQ-LW-006 の違反としない。

## 失敗の広がり

| ID | 失敗 | 影響範囲 | 緩和 |
|----|------|----------|------|
| F1 | プロキシ先ポートと Listen がずれる | lib 経路だけが ECONNREFUSED になり、8443 側は正常に見えるため切り分けが遅れる | REQ-LW-001 の突き合わせでテストが落とす |
| F2 | サイトを配置したが有効化していない | イメージは作れるが、そのポートでは何も待ち受けない（2026-11-18 の実例） | REQ-LW-005 |
| F3 | モジュールの有効化漏れ | configtest は通っても SSI が素通りする・CGI が 500 になる等、起動後にしか見えない形で壊れる | REQ-LW-006 |
| F4 | 8443 側の /lib 拒否が外れる | トンネル（公開面）から管理用の SSI/CGI に到達できるようになる | REQ-LW-007 |

## 受け入れ条件

- AC-LW-001: REQ-LW-001〜008 に対応するテストが、main の実ファイルに対して全て通る。
- AC-LW-002: 故障注入で該当テストが落ちることを確認する。注入は最低限、(a) LIB_PORT をずらす、(b) a2ensite から 010-lib を外す、(c) 8443 の /lib 拒否を外す、(d) a2enmod から include を外す、(e) a2enmod から cgid を外す、の5通り。
- AC-LW-003: ガードスイート全体で、この追加による新規の失敗が無い（既知の失敗は除く）。
- AC-LW-004: REQ-LW-010 について、(a) Dockerfile がビルド時に証明書を生成していること、(b) 証明書生成と最終形 configtest がサイト有効化より後にあること、(c) entrypoint の存在チェックのガードが残っていること、を前提チェックで固定する。ビルド時の configtest が実際に落ちる設定を弾くことは、Workers Builds の実ビルドで確認する（デプロイ後の実経路確認に含める）。

## 中止条件とロールバック

- 中止条件: チェックの前提（P1〜P4）と稼働系の実測が矛盾したら、チェック側を正として押し通さず、その時点で止めて前提を再検証する。実測（稼働インスタンスの `apache2ctl -S` 等）が証拠として優先する。
- ロールバック: 本 SPEC に対応する変更はテストのみであり、復帰先はその PR の revert。稼働系への影響はない。

## 未決事項

- 正本ファイル（routes.json 等）へチェックを寄せるかどうかは REQ-PR 側の決定に従う。決まれば本 SPEC のチェックは正本との照合に置き換える。
- entrypoint の起動時にサイト有効化を保証する案（a2ensite を起動側でも冪等に実行する）は、2026-11-18 に提示済みで未決定。決まれば REQ-LW-005 の保証箇所がビルド時と起動時の二重になる。

## 版履歴

- 版1（2026-11-18）: 初版。Okiraku の指示（前提テストの実装と、その要件の Lint 化）による。実装は PR #2653（src/cf-containers-lib-route-wiring.test.ts、10件）。
- 版2（2026-11-18）: REQ-LW-009 を追加（ヘルスの Apache 欄を 8443 / lib 専用ポートの2カラムに分ける。Okiraku の指示「cf-containerのapache欄も8443/8445の両カラムに分けてヘルスチェックして」）。実装は別 PR（src/cf-containers-apache-health-split.test.ts、6件）。
- 版3（2026-11-18）: REQ-LW-010 と AC-LW-004 を追加（証明書のビルド時焼き込みと、最終形 configtest のビルド時実行。Okiraku の指摘「証明書もオレオレでどうせチェックもしないんだし毎回作成しなくてもいいんじゃないの？」による。背景: 2026-11-18 の Apache 起動失敗について、Ubuntu 26.04 の忠実再現では設定が無罪と実証され、残る候補の一つが起動時の証明書生成だった）。
