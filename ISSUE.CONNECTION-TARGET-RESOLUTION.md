# 課題: 接続先候補の一元管理と用途別の稼働確認

**リポジトリ**: `nekoserver/cloudflare-workers-github-oauth-1`
**状態**: 未着手

## 概要

接続先ホストが用途ごとの実装に分散しているため、配信先を切り替える際に修正漏れが起きる。候補ホストと各用途のURLを一か所で定義し、用途ごとに実際の接続可否を確認した結果を解決済み接続先として各処理へ渡す。

現状、会話ストリーム候補は `src/utils/conversationStreamHosts.ts` にある一方、Dockerダッシュボードは `src/utils/dockerDashboardProxy.ts` にホストを直書きしている。tunnels APIの既定URLは `src/utils/tunnelSignerAsk.ts` でストリームURLから別に組み立てられている。ストリームのヘルスチェックが確認するのは埋め込みHTMLだけであり、同じホストのtunnels APIやDocker APIの稼働確認にはならない。

## 対応内容

- 選択可能な候補ホストと、ストリーム・tunnels API・Dockerダッシュボードなど用途ごとのパスを一元定義する。
- 用途ごとに必要な実リクエストで候補先を確認する。HTTPステータスだけでなく、HTML/API応答の形式も確認する。
- 確認結果から用途別の解決済みURL（例: `streamEmbedUrl`、`tunnelsApiUrl`、`dockerDashboardOrigin`）を作り、各利用箇所はその値を参照する。
- 自動選択と明示的な候補選択の両方で、確認済み候補だけを使う。確認失敗は用途別に分かる形で返す。
- 確認結果には短い有効期間を設け、同時の確認要求をまとめる。書き込みや質問送信の失敗時に、処理を別ホストへ自動再送しない。
- CSPやpostMessageの許可originも同じ候補定義から生成し、接続先一覧との不整合を防ぐ。

## 完了条件

- 接続先の変更時に、ホスト名を複数の利用コードへ重複して書き換える必要がない。
- ストリームHTML、tunnels API、Dockerダッシュボードの可否を個別に判定し、ある用途の成功を別用途の成功として扱わない。
- 自動選択時は利用可能な候補を選び、手動選択時は選択先の用途別状態を表示できる。
- API・Worker向けの接続先は許可済み候補に限定し、任意URLを受け付けない。
- 既存の認証、署名、Origin検証、CSP、postMessageのorigin検証を維持する。
- 候補の一部が停止・応答異常でも、用途別の失敗状態と選択結果がテストで確認できる。

## 対象箇所

- `src/utils/conversationStreamHosts.ts`
- `src/utils/conversationStreamHealth.ts`
- `src/utils/tunnelSignerAsk.ts`
- `src/utils/dockerDashboardProxy.ts`
- `src/views/conversationStreamPanel.ts`
- `src/index.ts` のストリーム状態APIと各接続先の注入箇所
- `wrangler.toml` の接続先設定、およびCSPのorigin一覧

## 対象外

- 候補ホストをDNSや外部サービスから自動発見する仕組み。
- ブラウザが任意の接続先URLを入力できる機能。
- 送信済み処理を別候補へ自動再試行する機能。
- 他リポジトリの接続先設定まで含む横断的な共通ライブラリ化。
