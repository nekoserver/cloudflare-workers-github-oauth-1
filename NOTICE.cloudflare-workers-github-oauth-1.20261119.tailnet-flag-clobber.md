# NOTICE: tailnet ヘルス表示フラグの行と前提チェックの欠落（2026-11-19）

## 何が起きたか

PR #2663（8d4f006c）で `containers/demo/apache-lib.conf` に恒常化した
tailnet ヘルス表示のフラグ行
`SetEnvIf X-Forwarded-User ^nekoserver$ MUSE_TAILNET_HEALTH_OK=1`
が、main から消えていた。行が無いため、再作成後のインスタンスでは
tailnet 区画が (access denied) のままになる（SPEC.lib.tailnet-health.shtml
版4 REQ-TH-014 違反）。

## 原因

- conf の行は PR #2665（5bc3bb67）の全体ファイル push で消えた。
  そのブランチの基点が #2663 のマージ前で、ファイル全体を旧内容で
  上書きしたため。
- 行を守る前提チェック（REQ-TH-014）は PR #2664（58c44375）の
  テストファイル全体 push で消えた。同じく基点が古かったため。
- 前提チェック自体が消えていたので、ガード一式は緑のまま欠落を
  検出できなかった。

## 復旧

本 PR で conf の行と前提チェックの両方を復旧した。前提チェックは
復旧前に実際に失敗することを確認済み（15 passed / 1 failed →
復旧後 16/16、ガード一式 390 passed / 2 failed＝既知の基準どおり）。

## 教訓

全体ファイル push を行うブランチは、push 直前に基点を最新 main へ
合わせ、対象ファイルの差分に自分の変更以外の消失が無いことを
確認する。前提チェックの消失は通常の差分確認では目立たないため、
特にテストファイルで注意する。
