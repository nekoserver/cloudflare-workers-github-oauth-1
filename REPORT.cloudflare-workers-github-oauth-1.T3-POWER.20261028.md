# tree-view T3 Code電源ボタンの実装・検証

## 実装

既存の本体`DEMO_CONTAINER`（キーdemo）に対し、署名付きの`/api/tree-view/t3-power-external`を追加。短寿命userTokenの検証とowner限定の判定を本体でも行う。状態確認はgetStateだけを使用しコンテナを起動しない。

DemoContainer.setRunningは既存start/stop/restartと同じDOロックの中で状態確認と操作をまとめる。希望状態を明示するため、同じ要求で二重起動せず、失われた応答の後に再操作しても反転しない。実行後の状態を返し、停止処理中・不明・失敗を完了と区別する。監査には起点・実行者・状態を記録し、no-opとpendingは起動回数・停止済み集計へ含めない。

UIと中継は`/root/dynamicneko`のfeat/tree-view-t3-powerブランチに実装。再接続ボタンの直前に配置し、確認できた稼働状態で起動/停止の文言を変える。連打と古い状態応答を抑止し、停止中・状態不明・非表示ではiframeを外す。

## 検証できた範囲

- 本体の新規API/DOテスト11件成功。署名・期限・owner認可、状態参照による非起動、明示的start/stop、冪等性、既存管理操作との排他、途中失敗からのロック解放、停止途中、未確認の起動の失敗扱い、監査保存失敗を検証。
- 既存の管理API・状態・署名テスト40件、secret更新時のrestartテスト3件成功。
- dynamicnekoの新規ブラウザ7件成功。既存T3タブ2件も成功。状態遷移、停止直後のiframe除去、同一イベント間の連打、HTTP 200内のエラー、古い応答、タブ再表示、外部停止途中を確認。
- dynamicnekoの署名付き中継と既存T3設定のNodeテスト成功。dynamicnekoの型チェック、本体の変更対象API/DOの厳格型チェック、差分チェック成功。
- 本体全体の型チェックは既存箇所と旧constructor型などのエラーで失敗した。constructorはSDKの型から取得する形に修正し、変更対象2モジュールの型チェックは成功。リポジトリ全体の型チェック成功とは扱わない。

## 全体テストの制約

`npx vitest run --maxWorkers=1 --bail=1 --reporter=verbose`は1,178件成功後、未変更の`src/heritageJourney-page.test.ts`の「各目的地には所属国の国旗(flag)が付与され、全件が空文字にならない」が20秒タイムアウトで失敗。837ファイルのうち15ファイルまでで停止しており、全件検証は未完了。該当ケースの単独実行は18.18秒で成功した。原因の全範囲やT3変更の無関係性を、時間超過の観測だけで保証しない。

初回に失敗した既存AIチャットテスト3件は、固定文字数の切り出しを関数/リスナー境界へ直し268件成功を確認。航空ネットワークの保存状態テストは、検証対象外の全行CSS計算を固定し、選択状態の検証は維持してタイムアウト値を変えず成功させた。実行した全体テストではこのケースも成功した。

本体のTESTPOLICYによるpush制約について、ユーザーが2026-10-28にこの失敗を明記したドラフトPR作成を承認した。失敗の除外やタイムアウト値の緩和はしていない。

## 本番

Cloudflare設定メタデータではmainのDYNAMICNEKO_WORKER_HMAC_SECRET、dynamicnekoのCF_WORKER_SECRET_MAIN、TREE_VIEW_CONTAINER_ORIGINは未設定。共有鍵2つには同じ値、originには実T3のHTTPS originが必要。秘密値を取得・変更していない。Worker配備、Dockerビルド、実コンテナの起動・停止、実T3の応答確認は未実施。
