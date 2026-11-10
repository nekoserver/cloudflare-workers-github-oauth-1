# ネットワーク復旧の協議結果（2026-11-09）

Cloudflare/stream、r9/Claude、Muse復元の3担当で読み取り調査し、親が反論を照合した。以下は推奨方針で、ユーザー承認・資格情報・復元検証を済ませた実装とは区別する。

## 合意した順序

1. 現在動くmygwとMuse lib経路を維持する。Museの実回答成功はNETWORK REPORTの実測を根拠にする。
2. 対象ゾーンDNS Read・対象Tunnel Readだけを付与した資格情報で、DNS targetとremote configを読む。既存トークンはactiveでアカウント一致だが、対象資源の読み取りを拒否された。変更権限は必要になってから分離して付与する。
3. 正規streamはstream.test.cfc.nekomaneki.work。DNS解決可能で公開応答は530/error1033。別CFC用途なのでmygwへ向け直さない。未参照のstream.nekomaneki.workのDNS失敗を復旧対象とした先の説明は訂正する。意図的な停止かを確認し、停止中cfc-tunnelを勝手に起動しない。現autoPriorityはmygwのみ。
4. r9はRedmine用途を保持。2026-10-24のDB dumpを発見し、隣接メタデータとSHA256一致。現在の復元試験と最新性は未確認。外部保全、最新バックアップ・添付・設定の探索、非公開ポートと別名DBへの隔離復元、データと認証の検証後に切り替える。空DB作成を復旧と扱わない。認証データを含むGit追跡済みdumpの保管方法も要改善だが、履歴削除は別判断とする。
5. Museの再作成対策はlib独立復元へ集約。現イメージは意図的にlib自動配置を撤去しており、残存post_installを修正するだけでは効かない。固定revisionのrelease配置、設定・secretの外部供給、原子的切替・旧release保持を設計する。現在のroot専用キーは再作成を越える保管元ではない。
6. worker置換はroot専用のstatus/drainと共有flockで直列化する。JSON走査後のkillは新規submitと競合するため恒常手順にはしない。drain未実装では自動置換せずrestart_requiredを明示する。設定保存だけで有効化完了にしない。
7. Claudeは専用ユーザーのauth statusで未認証を確認。既存契約の認証方式で復元する。課金の異なるAPIキー方式へ無断変更しない。sandbox内の認証確認と公開claude_promptの実回答確認を別々に行う。

## SSIを活用する比較案（利用者追加指定）

独立libの読み取り画面をApache SSIで構成し、共通ヘッダ・運用状態・復元手順へのリンクをサーバー側で組み立てる。秘密や資格情報ファイルをincludeせず、外部データをコマンドとして解釈しない。認証・認可、状態の正本、書き込みとジョブ実行は既存Worker/API/非公開workerが担う。SSIだけで認証や整合性を保証する案は採らない。

利点はページ構成変更をWorkerデプロイから切り離せること。制約はApache/コンテナ停止時に表示できず、動的状態は取得失敗と古い値を区別する必要があること。Worker配信の最小障害案内・既存mygwルートとの責務を決め、キャッシュの利用者分離、no-store対象、CSP/frame originsを検証する。SecureMine/Redmineの画面案もMuseへの優先30論点の問い合わせに含めた。これは設計候補で、実装・採用決定は未実施。

## 残る入力と確認

- Cloudflareの対象資源読み取り権限。
- CFCの停止が意図的かどうか。
- lib release・設定・secretを再作成後に供給する保管元と起動フック。
- r9の最新バックアップと添付・設定の所在。
- Claude認証の既存契約方式。

Dockerビルド、全体テスト、ソースビルド、DNS変更、r9復元、Claude認証の変更はこの協議では実施していない。
