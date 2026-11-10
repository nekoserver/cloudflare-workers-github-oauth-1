# Museへの優先協議依頼（2026-11-09）

利用者指定により既存の開いた論点30件を選び、関連する9議題にまとめてMuse workerへ送信した。SecureMine関連を先頭に置いた。全問い合わせへSSI比較案を要求。別途、鍵一元管理・自動ローテーションの追加協議と、マイクロカーネルVMの新議題を記録した。

## 優先30論点

| 優先 | 論点ID | 内容 |
|---:|---|---|
| 1 | smri-k2 | 接続口は3系統: SecureMine→redmineProxy(本人のAPIキー、redmine-v1)、/r9-status→r9Gateway(R9_HMAC_SECRET、r9-v1、GET /のみ)、Redmine画面への直接リンク |
| 2 | smri-k3 | redmineProxyの鍵はORIGIN_HMAC_SECRET→HMAC_SECRET→REDMINE_HMAC_SECRETの順で解決する。ここを変えるとCLAUDE.mdのルール45・46の大規模改修になる |
| 3 | trm-k2 | SPEC案のoutboxはref_idがNULL可で、UNIQUE(case_id, kind, ref_id)があってもopenを何件でも積める(メモリ内SQLiteで再現)。claim・lease・tokenも無い |
| 4 | trm-k3 | 検索→作成→D1保存が別操作で、途中で止まると二重作成・注記の二重追加が起こる。出来事IDをRedmine側にも残して照合する必要がある |
| 5 | trm-k4 | 試験運用への遷移時にその場でRedmineへ作る案(Muse)では、R9が止まっている間は試験運用へ進めない |
| 6 | trm-k5 | r9Gatewayのr9-v1署名はredmineProxyのredmine-v1と互換がなく、書き込みには使えない |
| 7 | trm-k6 | R9の所在(このコンテナでは待ち受けていない)と、/loginが500を返す原因 |
| 8 | side-chat-workflow-20261109-states | 受付・待機・取り込み・応答・拒否を識別できるIDとイベントの契約 |
| 9 | side-chat-workflow-20261109-authority | 本人の承認付き依頼と、外部データ由来の直接指示を区別する受け入れ条件 |
| 10 | side-chat-workflow-20261109-terminal | 拒否や未接続を未応答にしない終端通知と、取消・重複防止の契約 |
| 11 | side-chat-workflow-20261109-roles | 起草・Muse協議・別エージェントのレビューを維持する最小の合意ワークフロー |
| 12 | muse-bridge-injection-20261109-job | 該当ジョブIDと時刻、および今回の実通信テストとの対応 |
| 13 | muse-bridge-injection-20261109-rule | プロンプトインジェクション判定の実行主体・成立条件・今回該当した根拠 |
| 14 | muse-bridge-injection-20261109-silence | 拒否をblocked/rejectedとして返さず未応答にした理由 |
| 15 | muse-bridge-injection-20261109-mitigation | 検知を無効にせず正当な依頼の誤検知と無限待ちを防ぐ方法 |
| 16 | ce-k9 | 認証の体系的な抜け(CWE-294): Worker→tunnels、HTTPストリーム3形式、CF-Worker+HMACにnonceの使い捨てが無く、時刻の幅(±300秒)の中なら同じ署名の再送が通る。redmine-v1(gateway.wsgi)だけはSQLiteでnonceの重複を拒む。直すのはORIGIN_HMAC_SECRETの署名に触れるのでルール45の一括改修の対象 |
| 17 | ce-k10 | 認証の体系的な抜け(CWE-324に近い): tunnels、WebSocket、redmine-v1、CF-Workerに鍵ID・新旧の鍵の併存・個別の失効が無い。旧名へのフォールバックは入れ替えの手順ではない。ルール45の台帳(SUGGEST.20261104)とつなげる |
| 18 | ce-k11 | 認証の体系的な抜け(CWE-778): 7つの接続口すべてで、認証の失敗を主体・対象・理由とともに残す専用の記録が無い(401等の応答はある) |
| 19 | ce-k12 | 認証の試しで未確認: r9-v1の受け側の実装(両リポジトリに無い)、Museの物差しにありCodexが見ていない4工程(発行の強度、失敗の回数制限、通信路の保護、失敗時の既定の拒否) |
| 20 | ce-k4 | 出典の論点を消すとsource_key_idがNULLになり、inquiry_case_reviewの分類(avoidable_next_time/avoidable_now)が変わる。証跡をCASCADE・SET NULLで失わない設計が要る |
| 21 | bar-k1 | load()に実行中のガード・応答の世代管理が無く、周期・手動・採否後の取得が重なると古い応答が新しい一覧を上書きしうる |
| 22 | bar-k2 | 開いている詳細モーダルはload()で更新されない。描き直すと採否メモの入力や開いたdetailsを失う |
| 23 | umb-k4 | 既存の協議のAPIは管理者認証。チャットの利用者に送らせる権限の範囲を決める必要がある |
| 24 | umb-k6 | Museの案の「発言の一意キーをinquiry_keysに保存」は、inquiry_keys(論点の表)の用途と合わない。一意キーは問い合わせ側か別の表に持つ |
| 25 | crc-k1 | statusのresolvedは協議の終了で、目的の達成を表さない(NOTICE「議題の段階」)。完了を読み取る欄が無い |
| 26 | crc-k2 | マイグレーション0010〜0012(inquiry_case_steps、貢献の台帳、ルールの点検)はPRがマージ済みでも本番D1に無い。0013は先に0010〜0012の適用が要る |
| 27 | crc-k3 | 解決済み5件(nix-packages、muse-vm-dashboard、job-queue-design、proposal-rule、muse-vm-reboots)の達成度と、残る提案10件・論点9件の扱い |
| 28 | crc-k4 | inquiry_keys.blockingに基準も根拠の記録も無い。何の段を止めるのか、誰がなぜ付けたかが読めない |
| 29 | tcl-k3 | repo_commit_indexはcommit_hash単独の主キーで、同じSHAを複数のリポジトリで持てない |
| 30 | tcl-k4 | コミットと結ばれただけで提案を完了にしない。マージ・本番反映・動作確認は別の事実 |

## 手順と境界

D1の既存全議題を読み、マイクロカーネル関連キーも検索して重複未発見のため、利用者指定の新議題microkernel-secure-vm-20261109を発議した。鍵管理は既存contribution-evaluation議題の続きとした。新規発議を30件増やしたものではない。

plannedは未送信、sentはMuse受付済み、answeredは回答全文をD1へ保存して読み戻したもの。回答受領だけでキーを閉じたり、提案を採用・完了にはしない。実装や設定変更も依頼していない。

候補の読み取り時点では、予定/送信中entryは0件、開いた論点56件と採否待ち提案2件だった。全期間の議題29件から既存論点を選択した。利用者の「100超」は/muse-inquiriesボード全体を指すことを確認済み。

## 最初のSecureMine回答への親レビュー

推奨候補は、用途別の認証境界を保ちながら送信処理・応答扱い・画面導線を共通化する案。SSIは読み取り画面構成へ適用し、認証済み断片の利用者分離、失敗表示、CSP、キャッシュを検証する。既存smri-p1は利用者が2026-11-08に採用済みで、今回の回答を新しい採否決定とは扱わない。smri-p2の現行URLへの文書修正も2026-11-09に採用済み。

反論: Museは鍵名のフォールバック順を「移行の仕組み」と説明したが、これだけでは新旧鍵の同時受理・配布世代・個別失効は保証されず、自動ローテーションの根拠にはならない。追加の鍵管理協議で区別を要求する。また、冒頭の「確認済み」は提供文脈の再述を含むため、実コード・実測での確認済みとは扱わない。既存smri-p1/p2の提案全文は初回の文脈に無かったため、親が採用済みの内容を読み戻した。送信処理の共用・鍵解決順維持と、現行URLへの文書修正が既決事項である。未採用へ戻さず、その実装・検証の不足を次に照合する。

## 記録

選定: artifacts/inquiry-muse-top30-20261109/selected.json。受付・回答状態: manifest.json と supplement-manifest.json。Muse回答全文は各*-result.jsonとD1 inquiry_entriesに保存する。秘密値は含めない。
