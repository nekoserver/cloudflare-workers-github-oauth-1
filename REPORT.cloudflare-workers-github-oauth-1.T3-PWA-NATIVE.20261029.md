# 最新状態: 利用者の実機ではPairing継続。未解決。

自動試験の成功と、実機での解決を混同した案内を訂正。原因は未確定。

# T3 PWA: 開発用native認証アダプター

**一般利用は承認不可。開発環境限定の例外対応。**

確認日時: 2026-10-29T11:48:23+00:00。現稼働環境に反映済み。iPhone実機での最終確認は未実施。

## 変更と位置付け

別タブはログイン済みだが、Tree View PWAの通常iframeと切り出しウィンドウはともにPairingへ戻る問題に対応。Cookie共有やStorage Accessによる引き継ぎは撤回し、native T3 0.1.3の正式なscoped bearer sessionと短寿命wsTicketを使う独自アダプターを実装した。承認仲介とfetch/WebSocketへの適用は独自コードであり、公式推奨のPWA方式とは扱わない。利用者は懸念を示した上で開発時には必要との意向を示した。

PWAが256bitの端末secretで5分の申請を作成し、既存の別タブCookieでnative認証した利用者が比較コードを見比べて明示承認する。一回のclaimだけがnative CLIで最大24時間の専用Bearerを発行。scopeは承認元の範囲と固定許可リストの積集合。単なるread-only loginはdelegation不可。access:writeまたはnative設計で管理相当のterminal/agent操作権限を必要とする。terminal/agent権限は強い権限で、24時間期限をコンテナ操作の隔離境界とは説明しない。

HTTPはAuthorization、WSはnative APIの短寿命ticket。長期資格情報を親Tree View、URL、サーバー台帳、D1設計ログへ送らない。端末のT3 originの保存領域に専用Bearerを保持し、再読込のたびnativeで確認する。

## 正とする状態

- 認証と失効の正本: native T3。native DBへ直接INSERTしない。発行・失効は公式CLIを使用。
- 申請・発行・利用確認の台帳: `/root/.t3/userdata/pwa-handoff/state.sqlite`。secret/bearerはハッシュのみ。state遷移と監査を同じSQLite transactionで確定。
- 設定: `/root/.t3/userdata/pwa-handoff/config.json`。`enabled=true`かつ`developmentOnly=true`が必要。設定ファイル世代、native環境IDと署名鍵metadataの世代を確認。OFF・世代変更の未消費申請は利用不可。
- 作業・設計の記録: 本体D1 `workers-github-oauth.t3_setup_log_entries`、run_id=`20261029-t3-pwa-auth`。既設の本体D1 t3_pwa_* は以前の未実装案のテーブルで、今回のnative session発行台帳ではない。

## 現稼働への反映

release SHA-256: `b35ce53d0c9d5d0f89c83df7c4b3d71c2ad72022bd78183074d86a1ff25c3f30`。不変release directory: `/root/.local/state/t3-pwa-native-auth/releases/b35ce53d0c9d5d0f89c83df7c4b3d71c2ad72022bd78183074d86a1ff25c3f30`。`/usr/local/libexec/t3-embed-proxy.cjs`から同releaseのstartを実行。中継だけを監視ループから再起動し、Dynamicneko Worker・コンテナimage・既存native利用者sessionを更新/失効していない。バックアップ: `/root/.local/state/t3-pwa-native-auth/20261029T113651Z`。最初の変更前launcherは `/root/.local/state/t3-pwa-native-auth/20261029T113219Z/launcher-before.cjs`。

導入: `python3 scripts/install-t3-pwa-auth.py --enable-development`。新しい申請の停止: 同scriptの`--disable`。停止は発行済みnative tokenの強制失効を意味せず、既存sessionは元の期限・native失効に従う。個別失効はnative `t3 auth session revoke <id>`。

ソースDockerfileのCOPYは更新したが、AGENTS.mdの「このコンテナ上ではDockerビルドを行わない」に従い、imageビルド・更新は未実施。コンテナ再作成でlocal release/configが失われる場合の恒久反映は別途必要。ソースは作業ツリーに保存しておりcommit/pushは未実施。

## 検証と限界

Node 22の認証・失敗系16件、ログ伏せ字/追記保護3件、既存T3配線10件成功。実native T3に対する隔離ブラウザー試験をChromium/WebKitで実施し、公開URLでも全Cookie除去下の承認・実UI・アプリWS受信・再読込の再承認不要・元の別タブCookie認証維持を確認。モデル呼び出しはしていない。

ローカルChromeのLNA遮断は試験環境限定の許可で解消。公開bootstrap queryの不一致はpath-based entryへ修正。WebKit WSSのDevTools frame件数不足はアプリ側MessageEventとnative last-connected metadataで検証を補強。公開試験は親originを試験ブラウザー内のHTMLで差し替えて実native iframeへ接続したもので、親サイトの実React操作全体の実機検証ではない。

iPhone実機のホーム画面PWA、OSによる終了/再開、全メディア・provider OAuth、モデルへの実質問は未検証。T3 version更新時には独自transportとの互換性を再検証する。

## ログを読み返す

`/status`のテーブル一覧にt3_setup_log_entriesを登録済み。`python3 scripts/t3-setup-log.py read --topic t3-log`で進捗、`--kind lesson`で設計上の注意点を検索。伏せ字版log原本と確定/推測/未確認を分けて追記する。原本アーカイブは `/root/t3-setup-logs/` のroot専用フォルダーへ保持し、DBには資格情報を入れない。

参考: [T3 0.1.3公式の認証境界](https://github.com/pingdotgg/t3code/blob/v0.1.3/docs/internals/environment-auth.md)。
