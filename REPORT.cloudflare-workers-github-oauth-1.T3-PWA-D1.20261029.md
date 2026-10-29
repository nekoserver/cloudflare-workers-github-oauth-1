# T3 PWA接続要求・ログイン台帳の準備

migration `0190_create_t3_pwa_handoffs.sql` を作成し、既存ENVの資格情報で本体D1へ個別適用した。既存migrationの一括適用やD1既存データの変更はしていない。

作成後の読み取りで3テーブル（t3_pwa_handoffs / t3_pwa_sessions / t3_pwa_handoff_events）、10索引、14トリガーがローカル定義と一致、3テーブルが0件であることを確認。API応答はroot専用 `/var/log/t3-setup/d1-0190-apply.json` と `d1-0190-verify.json` に保存した。既存DBにd1_migrations台帳はなかったため、独自に既存migrationを適用済み登録する操作はしていない。

台帳は発行・初回ログイン確認・最終認証確認・期限・ログアウト・失効日時を分ける。Cookie、pairing credential、device secret、長期Bearerを保存するカラムは設けない。状態更新と監査はDBトリガーで同時保存し、監査失敗時は更新もrollback。保持期間未満の削除、状態再利用、scope変更、ログイン日時の巻き戻し等を拒否する。

`python3 scripts/test_t3_pwa_schema.py` の17件成功。隔離SQLiteを使用し、実際の別接続の同時claim、監査保存失敗、未確認ログイン、失効・ログアウト後の再利用、migration再適用、registry SQL一致を確認。テスト用の承認・セッションを本番D1へ挿入していない。registryチェックとdiffチェック成功。これらはD1本番での同時claimやブラウザ認証の試験ではない。

/statusの5レジストリをソースへ追加し、SPECを3テーブル構成へ更新。[SQL全文・適用手順](SETTING.cloudflare-workers-github-oauth-1.T3-PWA-D1.20261029.md) を用意した。Workerデプロイ・固定ドメイン設定・認証API・native adapter・PWA・保持ジョブは未実施。テーブルは用意できたが、実ログイン日時の記録機能は未接続。

後続UI復元までの作業終了後、ファイアウォールログとnft rulesetをroot専用 `/var/log/lib-network-audit/20261029T032555Z/` へ取得した。
