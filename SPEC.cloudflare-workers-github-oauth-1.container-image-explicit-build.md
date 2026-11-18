---
id: SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build
repo: nekoserver/cloudflare-workers-github-oauth-1
status: draft（出典: 2026-11-18、Okiraku の指示「じゃあそうしようか」— wrangler の変更判定を経由しない明示ビルドへの介入に合意。U1 は同日、候補A に決定）
version: 2
created: 2026-11-18
updated: 2026-11-18
---

# デモコンテナイメージの明示ビルドと digest 固定

## 目的と範囲

目的: wrangler deploy の変更判定に依存せず、デモコンテナのイメージを現在の入力（containers/demo/Dockerfile と containers/demo/packages/）から明示的にビルドして適用する。版が上がらない問題（2026-11-18 に実証）の恒常対策である。

対象: containers/demo のイメージのビルド・push・固定・再記録の手順と、wrangler.toml の containers image の持ち方。
対象外: パッケージ自体の版上げ（ピン変更は従来どおりの PR 手順）、コンテナ内アプリケーションの変更、Workers Builds の発火条件そのものの変更。

## 前提

- P1（実証済み）: wrangler deploy はイメージを作り直さないことがある。2026-11-18 14:28 のデプロイログ: Dockerfile が現行ピンと異なるのにコンテナは「no changes」で、2026-11-11 ビルドの digest（c945ea026afa3e0c1d3446535fa019c96ef50ba21e25a17d75aabdaa162dee83）を再利用した。
- P2（実証済み）: containers/demo/image.lock.json の digest は実デプロイの digest と一致する（同ログで照合済み）。したがってロックと入力の乖離はテストで判別できる。
- P3（規則）: この VM では Docker ビルド不可（リポジトリ規則）。GitHub Actions は使用禁止（利用者指示、2026-11-18 再確認）。
- P4（規則）: 既存のコンテナインスタンスは起動中イメージを保持し続ける。新イメージの適用はインスタンス再作成時である。

## 要求

- REQ-EI-001: イメージの更新は明示的なビルドと registry への push を経由しなければならない。wrangler deploy の変更判定に依存してはならない。
- REQ-EI-002: wrangler.toml の containers の image は digest で固定しなければならない。デプロイはその digest をそのまま使わなければならない。
- REQ-EI-003: ビルドと push の成功後、scripts/demo-image-lock.mjs --write で image.lock.json を再記録しなければならない。更新完了の条件は scripts/demo-image-lock.mjs --check が終了コード 0 であることとする。
- REQ-EI-004: 更新手順は単一の手順（スクリプトまたは手順書）に固定しなければならない。deploy 任せでイメージが変わる経路を残してはならない。
- REQ-EI-005: 適用完了の判定には、前提チェック（ロック照合テスト、PR #2649）が緑であることを含めなければならない。

## 例外

- E1: ビルド失敗時は中止する。wrangler.toml と image.lock.json は旧 digest のまま変更しない。
- E2: push 成功後にデプロイが失敗した場合、ロックは新 digest・実デプロイは旧 digest になり得る。再デプロイで回復する。--check の緑を実適用の証拠に代用してはならない（AC-EI-002 で別に確認する）。
- E3: digest 固定後は、入力が変わっていない限り wrangler deploy がコンテナを「no changes」と出すのは正常である。

## 故障モードと影響範囲

- FM1: 明示ビルドが失敗する。影響範囲: イメージは旧版のまま。ワーカーのデプロイには影響しない。中止条件により構成は変わらない。
- FM2: push は成功したがデプロイが失敗し、ロックと実デプロイが乖離する。影響範囲: 前提チェックは緑でも実コンテナは旧版のままになる。AC-EI-002 の実経路確認でのみ検出できる。
- FM3: 誤った digest を固定する。影響範囲: コンテナが起動不能または旧版で起動する。ロールバック（旧 digest への差し戻し）で復旧する。

## 決定事項

- U1（決定済み、2026-11-18、Okiraku）: ビルドの実行場所は候補A — Workers Builds のビルドコマンドに明示ビルド工程を追加する。ビルドコマンドは `bash scripts/deploy-with-container-build.sh` とし、スクリプト側でタグ判定・ビルド・digest 固定・ロック再記録・deploy を一貫して行う。ビルドコマンドの設定変更そのものはダッシュボード側の操作（Okiraku の手）。

## 中止条件とロールバック

- 中止条件: ビルドまたは push の失敗。その時点で旧 digest の構成に戻し、それ以上進めない。
- ロールバック先: 最後に実経路で確認できたイメージ = image.lock.json が記録する digest（現時点では c945ea026afa3e0c1d3446535fa019c96ef50ba21e25a17d75aabdaa162dee83）。
- ロールバック手順: wrangler.toml の image と image.lock.json を旧 digest へ戻してデプロイし、コンテナを再作成する。既存のロック機構の範囲内にある。

## 状態を持つ対象の復旧手順（ digest 固定後の不整合）

1. 検知: 前提チェックの赤、またはコンテナの報告版とピンの不一致で検知する。
2. 切り分け: image.lock.json の digest、wrangler.toml の固定 digest、デプロイログの digest の3者を照合し、乖離している箇所を特定する。
3. 復旧: 乖離に応じて再デプロイ、再記録（--write）、またはロールバックを行う。
4. 確認基準: AC-EI-001〜003 をすべて満たすこと。

## 受け入れ条件

- AC-EI-001: scripts/demo-image-lock.mjs --check が終了コード 0 で終わる。（REQ-EI-003、REQ-EI-005）
- AC-EI-002: 再作成後のコンテナが報告する版が現行ピン（httpd 2.4.71 / Node.js 26.13.1 / git 2.56.1 等）と一致する。実経路確認である。（REQ-EI-001、REQ-EI-002）
- AC-EI-003: mygw.nekomaneki.work が 502 / 530 でなく応答する。Apache 起動の確認を含む。（REQ-EI-002）
