---
id: SPEC.cloudflare-workers-github-oauth-1.port-route-registry
repo: nekoserver/cloudflare-workers-github-oauth-1
source: 2026-11-18 Okiraku 指示（「繋ぎ込む前提で入出力ポートを一致させなければならない」ものを一元管理できないと気持ち悪い。cloudflared の振り分けも同じ。SPEC を書くことを同日に承認）
status: draft
version: 4
created: 2026-11-18
updated: 2026-11-19
---

# SPEC.cloudflare-workers-github-oauth-1.port-route-registry

改訂: 2026-11-19、opus-5.5（Claude Opus 5.5、Claude Code）。版3（draft）の要求は変えず、実装の状態（末尾の「実装の現状」）を足した
評価: [`EVAL.cloudflare-workers-github-oauth-1.port-route-registry.opus-5.5.20261119.md`](EVAL.cloudflare-workers-github-oauth-1.port-route-registry.opus-5.5.20261119.md)
定期的な見直し: このSPECは[`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順で、定期的に実情に合わせて改訂し、評価し直す

## 目的と範囲

対象は、本体コンテナ（demo コンテナ）にまつわる固定配線 — cloudflared の振り分け、Apache の VirtualHost、コンテナ内 server.js の待ち受けと内部プロキシ先、sshd、本体ワーカーのプロキシ経路の着地点 — のポートと経路の対応である。

結論（should-be）: 繋ぎ込む前提で入出力ポートが一致しなければならない配線については、対応の正本を repo 内の1ファイルに置き、各コンポーネントの設定はその正本とテストで照合されなければならない。片方だけが変わる変更は、実稼働ではなくテストで落ちること。あわせて、稼働中の実態（どの hop が待ち受けていないか）は、末端の不透明なエラー（ECONNREFUSED）ではなく、その hop の名前で画面に見えること。

動機となった実例（2026-11-18）: lib へのプロキシが `{"error":"libへのプロキシに失敗しました: ECONNREFUSED"}` を返し続けた。Apache は落ちていたが、その事実は経路の末端のエラーからは読み取れず、ポートの対応（8443/8444/8445、server.js の 8080 と LIB_PORT）も各ファイルの直書きを辿らなければ分からなかった。

### テスト対象

| ID | 対象 | 実体 | テストの置き場所 |
|----|------|------|------------------|
| T1 | 正本ファイルと各コンポーネントの照合 | `containers/demo/routes.json`（正本、名称は未決事項）、`containers/demo/server.js`、`containers/demo/apache-*.conf`、`containers/demo/cloudflared-ingress.yml.template`、`containers/demo/entrypoint.sh` | repo のテスト（`src/cf-containers` 系の vitest） |
| T2 | 起動後経路確認とヘルスチェック表の期待値 | 本体ワーカーの経路確認（SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity の REQ-LP-010）と /cf-containers の表 | 同上 |

### 対象外

- バージョンの正本との一致確認。バージョン側の正本は `containers/demo/image.lock.json` であり、稼働イメージがそれと一致しているかの確認は、container-versions の自動送信（SPEC.cloudflare-workers-github-oauth-1.container-versions.auto-send）と REQ-LP-010 の枠組みで扱う。本 SPEC はポート・経路だけを扱う。
- muse-vm 側の receiver（:8090）や API Bridge（:8080）の配線。これらは別システムであり、正本はそれぞれの側に置く。server.js から muse-vm へ届く hop は、正本では「外部システムへの参照」として名前だけを記録し、ポートの正は持たない。
- 相手が固定されていない配線（REQ-PR-006）。

## 前提とプラットフォーム特性

| ID | 前提 | 検証状態 |
|----|------|----------|
| P1 | 現在、ポートの対応は server.js（待ち受け 8080、LIB_PORT 8445、Redmine 8444、8443 の probe）、apache-demo.conf（8443）、apache-redmine.conf（127.0.0.1:8444）、apache-lib.conf（127.0.0.1:8445）、cloudflared-ingress.yml.template（/ssh → 2222、それ以外 → 8443）、entrypoint.sh に散らばって直書きされている | 実測で確認済み（2026-11-18、clone の実読） |
| P2 | repo のテストは push の経路で実行され、落ちれば push が止まる（push guard が `npx vitest run src/cf-containers` を回す） | repo の運用で確認済み（2026-11-18 の PR #2637 で実際に動作） |
| P3 | cloudflared の実設定は、entrypoint.sh が repo 内のテンプレート（cloudflared-ingress.yml.template）のホスト名を置換して生成する | 実測で確認済み（テンプレート冒頭のコメントと entrypoint の実装） |
| P4 | 稼働コンテナの待ち受けポートの実態は main 側でしか取れない。この VM からは実測できない | 未実測。そのため本 SPEC の照合は repo 内の記述同士の一致までを担保し、実稼働の証明は REQ-LP-010 の実経路確認に分離する（REQ-PR-007） |
| P5 | REQ-PR-005 のヘルスチェックの表は /cf-containers（管理者ページ）に出るものであり、ログイン済みの管理者にだけ提供されるのが設計である（lib-proxy-identity SPEC の P6 と同じ）。未認証の位置から表が見えないことは欠陥ではない | 2026-11-18 の再評価で確認（lib-proxy-identity SPEC 版8） |

## 用語

- 正本: ポートと経路の対応を列挙した repo 内の単一ファイル。各 hop について、名前、入口（プロトコル・ホスト・パス条件）、接続先（ホストとポート）、担うコンポーネントのファイルを記録する。
- hop: 配線の1区間。例: cloudflared → Apache 8443、server.js → Apache 8445（lib）。
- 固定配線: 両端のコンポーネントが決まっていて、ポートが一致しなければ成立しない配線。

## 要求

- REQ-PR-001: 固定配線の対応を列挙した正本ファイルを、repo 内の1か所に置かなければならない。列挙の範囲は、cloudflared の振り分け（ingress テンプレート）、Apache の全 VirtualHost、server.js の待ち受けと内部プロキシ先、sshd、本体ワーカーのプロキシ経路の着地点（server.js の待ち受け）とする。各 hop には、名前・入口・接続先・担うコンポーネントのファイルを記録しなければならない。対象: T1。
- REQ-PR-002: ポートを直書きしている各コンポーネントの設定とコードは、テストで正本と照合しなければならない。照合の対象は少なくとも、server.js の待ち受けポート・LIB_PORT・Redmine へのプロキシ先・probe 対象ポート、apache-*.conf の Listen と VirtualHost、cloudflared-ingress.yml.template の service の接続先、entrypoint.sh が前提とするポートとする。照合は repo の既存のテスト実行に組み込み、正本と食い違う変更はテストが落ちて push が止まらなければならない。対象: T1。
- REQ-PR-003: ポートを変える変更は、正本とコンポーネントを同じ PR で変えなければならない。正本だけ、またはコンポーネントだけの変更は、REQ-PR-002 の照合で落とす。対象: T1。
- REQ-PR-004: 起動後の経路確認（lib-proxy-identity SPEC の REQ-LP-010）は、期待する hop とポートを正本から読まなければならない。経路確認の側に独自の定数を持ってはならない。対象: T2。
- REQ-PR-005: コンテナのヘルスチェックの表には、正本の hop ごとに「期待（正本の接続先）」と「実際」を出さなければならない。「実際」は層で区別して出すこと: コンテナ自体が落ちている／コンテナは動いているがその hop のプロセスが待ち受けていない／待ち受けているが応答が実行エラー（HTTP 5xx 等）／正常。待ち受けていない hop は、その hop の名前で見えなければならない（末端の ECONNREFUSED のような、どの hop が落ちたか分からないエラーのままにしてはならない）。段階の名前と切り分け方は、lib-proxy-identity SPEC の REQ-LP-010 の段階確認と揃えること。対象: T2。
- REQ-PR-006: 正本に書くのは固定配線だけとする。空いているところを狙って起動する類（テスト用サーバー、動的に決まるポートなど、相手が固定されていないもの）は正本の対象外とし、対象外であることを正本に明記しなければならない。対象: T1。
- REQ-PR-007: repo の外で実体化する設定（cloudflared の実トンネル設定、稼働イメージ内の設定ファイル）については、repo 内のテンプレートと生成元を照合の対象とし、実体との一致は REQ-LP-010 の実経路確認が担うものとする。正本は repo 内の記述の正しさを担保するものであり、実稼働の証明ではない。この位置づけを正本ファイルの冒頭に明記しなければならない（image.lock.json が「過去ビルドの入力の記録」であって稼働版の証明ではないのと同じ扱い）。対象: T1、T2。

## 例外・禁止事項

- 正本を経由せずに、新しい固定配線のポート直書きを足してはならない（REQ-PR-002 の照合対象に含めること）。
- 正本に秘密（トンネルのトークン、鍵の値）を書いてはならない。書くのは名前・ポート・パスの対応だけとする。
- 稼働コンテナの実測値を正本に書き写してはならない。正本は「あるべき対応」であり、実態は REQ-PR-005 の表が別に出す。

## 故障モードと影響の範囲

| ID | 故障 | 影響の範囲 | 緩和 |
|----|------|-----------|------|
| F1 | 正本とコンポーネントの片方だけが変わる | 経路が黙って壊れ、末端の不透明なエラーでしか分からない（2026-11-18 の実例） | REQ-PR-002・003（テストで落とす） |
| F2 | repo 外で実体化した設定が正本とずれる | repo 内の照合では検出できない。実経路が壊れる | REQ-PR-007（実体との一致は REQ-LP-010 の実経路確認と REQ-PR-005 の表が受け持つ） |
| F3 | 正本そのものの誤記 | 全 hop の照合が誤った期待で通ってしまう | 正本の変更は PR のレビューを通す。REQ-PR-005 の実測表示で、期待と実態の差が人間の目に見える |
| F4 | 照合テストの不備（直書きの見落とし） | 見落とした箇所だけ F1 が再発する | AC-PR-002（わざとずらす変更でテストが落ちることを確認する） |

## 受け入れ条件

- AC-PR-001（REQ-PR-001 に対応）: 正本ファイルが repo に存在し、前提 P1 に挙げた全 hop（cloudflared の2振り分け、Apache の3 vhost、server.js の待ち受けと2つの内部プロキシ先、sshd）が、名前・入口・接続先・担当ファイル付きで列挙されていることを実読で確認する。
- AC-PR-002（REQ-PR-002、REQ-PR-003 に対応）: テストで、正本と各コンポーネントの照合が通り、かつ、コンポーネント側のポートを1つだけわざとずらした変更で照合テストが落ちること（変異の確認）を確認する。
- AC-PR-003（REQ-PR-004 に対応）: 経路確認の実装が正本を読むことをコードの実読で確認し、経路確認の側にポートの定数が残っていないことを grep で確認する。
- AC-PR-004（REQ-PR-005 に対応）: デプロイ後、/cf-containers のヘルスチェックの表に hop ごとの期待と実際が出ることを実物で確認する。Apache が落ちている状態では、落ちている hop がその名前で見えること（2026-11-18 の状態が再現できる間に確認するのが望ましい）。
- AC-PR-005（REQ-PR-006、REQ-PR-007 に対応）: 正本の冒頭に、対象外（固定されていない配線）と位置づけ（実稼働の証明ではない）が明記されていることを実読で確認する。

## 実施記録と今後の変更の規則

- 中止条件: 照合できないコンポーネントが見つかり、その hop を「repo 外・実経路確認のみ（REQ-PR-007）」として正本に記録できない場合は、その hop の実装を中止する。実経路の確認（AC-PR-004）が通らない変更は中止する。
- 復帰先: 正本ファイルと照合テストの追加が中心であり、既存の設定ファイルの値を変えない限り、戻しは追加分の revert で足りる。値そのものを変える変更（ポートの付け替え）を含む場合は、その直前に実経路で動作確認できた状態を復帰先とする。

## 未決事項

- 正本ファイルの名前と形式: JSON（`containers/demo/routes.json`）を提案する。判断者は Okiraku。
- 正本から各設定を生成する方式まで踏み込むか: 初期は照合のみ（生成はしない）を提案する。生成は既存の設定ファイルの書き換えを伴い、影響が大きい。判断者は Okiraku。
- T3 のサーバー／プロキシのポート（server.js 内の定数）を正本に含めるか: 固定配線であるため含めることを提案する。判断者は Okiraku。

## 変更履歴

- 版1: 初版（2026-11-18、Okiraku の指示と承認による）。
- 版2: REQ-PR-005 の「実際」を層の区別（コンテナ停止／プロセス未待ち受け／実行エラー／正常）で出すよう改訂し、段階の名前を REQ-LP-010 と揃えることを明記（2026-11-18、Okiraku の指示「問題の切り分けができるようにすべき」による）。
- 版3: 前提 P5 を追加（ヘルスチェックの表は管理者にだけ提供されるのが設計であり、未認証から見えないことは欠陥ではない）。lib-proxy-identity SPEC 版8 の再評価に合わせた整合（2026-11-18）。
- 版4: 2026-11-19、opus-5.5。要求は変えず「実装の現状」を足した（正本は未作成、未決事項は判断待ち）。

## 実装の現状（2026-11-19）

**対象**: REQ-PR-001〜007の、`origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）での状態 — 版3（draft）の要求がどこまで実装されたか。

- **正本は作られていない。** `containers/demo/routes.json`も、ほかの名前の正本も無い（`git grep`）。未決事項の3件（正本の名前と形式、生成まで踏み込むか、T3のポートを含めるか）は、利用者の判断の記録が無いまま。
- 前提P1は今も同じ。ポートは各ファイルに直書きされている: `server.js`（待ち受け8080、probe 8443・`LIB_PORT`、Redmine 8444、T3 3773・3774）、`apache-demo.conf`（`Listen 8443`）、`apache-lib.conf`（`Listen 127.0.0.1:8445`）、`cloudflared-ingress.yml.template`（`ssh://127.0.0.1:2222`、`https://127.0.0.1:8443`）。
- REQ-PR-005に関わる変更として、ヘルスチェックの表のApacheの欄が8443と8445の2つに分かれた（[`5f27297f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5f27297f)、2026-11-18）。hopごとの「期待」と「実際」を層で区別する表示ではない。
- REQ-PR-004は、経路確認（lib-proxy-identityのREQ-LP-010）が未実装のため、まだ適用できない。

## 改訂の記録

| 日付 | モデル | 箇所 | 内容 | 根拠 |
|---|---|---|---|---|
| 2026-11-19 | opus-5.5 | 冒頭・「実装の現状」 | 実装の状態を追加。要求は変えていない | `git grep`、`containers/demo`の実読 |
