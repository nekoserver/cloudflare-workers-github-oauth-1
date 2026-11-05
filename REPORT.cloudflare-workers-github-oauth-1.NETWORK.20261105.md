# ネットワーク設定と同一会話ストリーム検証（2026-11-05 UTC）


## 同一会話投稿の最終確認（後続ターン）

キューへ投入したテスト投稿を、この同じ会話で実際に受信し、assistantが `STREAM_POST_OK_20261105` を返答した。公開mygwの認証済みストリームでも投稿とassistantの応答を確認した。observerの会話IDは現在ENVと一致し、native queueの該当待機件数は0。新しい投稿・fork・会話切替は行っていない。**同一会話への投稿受付→既存writer取り込み→assistant応答→公開observer配信まで成功。** 根拠は41-single-thread-delivery.log。以下に残る「検証時点で未確認」は初回検証時点の履歴で、この後続検証により解消した。実ブラウザのパネル操作は引き続き未実施。

## 結果と境界

現コンテナに `/root/lib` と `/root/cf-container/ops/network` を配置し、tunnels.rb、WebSocket/SSE/NDJSON/JSON-seq、App Server、observer、LLM worker、Apache CGI/SSIを構成した。既存ENVを優先し、秘密値・Cookie・会話全文は本REPORTと検証ログに記録していない。Dockerビルド、Workerデプロイ、イメージ更新、パッケージアップグレード、Git pushは実施していない。

**会話は一本化する。** ENVのCODEX_THREAD_IDと今回の依頼本文をread APIで照合し、その固定会話をobserverの参照先にした。新しいforkは作成せず、過去の投稿用forkへの切替も行っていない。過去の分岐履歴の削除・自動マージもしていない。

最初の直接投稿は409 console_in_useだった。ユーザーによる一本化方針の再確認後、既存writerを維持して同じ会話のnative queueへ入力する経路を追加した。公開console POSTは200、accepted=true、queued=true。同じENV会話のqueue/listに一致する投稿が1件だけあることを確認した。**既存writerによる取り込みとassistant応答は検証時点で未確認。投稿の全行程完了とは報告しない。** ログイン済み本体画面での実ブラウザ操作も未実施。フォームテストは実際のsubmitハンドラーをVMで実行したもので、ブラウザ操作ではない。

Cloudflare一覧は現在ENVのトークンの権限不足で取得できない。mygw/r8のAPIは200でもauth=error/no_api_token。streamホストは530、Redmine専用r9は502。したがって全トンネル復旧完了ではない。

## 変更した内容

- 再配置用ApacheテンプレートにlibのAlias、SSI INCLUDESフィルター、CGIを追加。非公開ディレクトリ・ドットファイル・ソース/運用ファイルの拒否を維持した。実際に有効な000-demo.confへ配置し、configtest成功後にgraceful適用。
- 現コンテナのlibにある旧VMのRuby絶対パスを、実在する `/usr/local/bin/ruby` に置換。date.shtml、ruby_-v.shtml、api/tunnels.shtmlの子CGIの展開を検証。
- 公開配信プロセスはwww-data、127.0.0.1:8091/8092。実プロセスENVで現在HMACの一致と管理API/GitHub資格情報の非継承を確認。
- `/run/lib-chat-app/app-server.sock` の親0700、ソケット実体0600。Codexが作成したroot専用実体へのsymlink。`/run/lib-chat-observer/observer.sock` と `/run/lib-codex/worker.sock` はroot:www-data 0660、親0750。source.jsonはroot専用ディレクトリ内0600。
- Codex/Claudeの既存導入済みバイナリを専用パスへ配置。Claudeの初回実行失敗は未配置だった呼出先を配置して再検証し、実応答成功。Claudeバイナリのコピー元/先SHA256は一致。Codex実行用の既存認証を専用ユーザーの非公開領域へ配置し、bubblewrapの読み取り専用マウントと非root実行を使用。
- 起動スクリプト、cron、現在のentrypointに起動経路を配置。現在ENVをCGI/配信へ引き継ぎ、cron用のCloudflare設定はroot専用0600で保存。再実行後も各サービスの稼働を検証。イメージ再作成後の復元は未検証。
- UIはHTTP200に加えてaccepted=trueを確認する。accepted=falseで成功表示する不具合を先行テストで再現して修正。queued=trueは「この会話の送信待ち」と表示する。fingerprint付き資産を生成・配置し、公開認証済みHTML/JSの内容とnode --checkを確認。
- writer競合時だけ `thread/queue/add` を同一IDへ1回呼ぶ。queuedSubmissionのID・clientUserMessageId・inputが期待どおりでなければ受付扱いにしない。自動再試行・fork・queue登録後のturn/startはしない。観測クライアントは書き込みAPIを拒否する。

キューの根拠は [公式CLI reference](https://learn.chatgpt.com/docs/cli/reference#codex-queue) と、導入済みCodex 0.166.0の `app-server generate-json-schema --experimental`。公開ドキュメントのCLI仕様と、実バイナリから得たRPCスキーマを区別した。契約の版・フィールド・スキーマSHA256は37-codex-queue-contract.jsonに記録。キュー受付は永続化までの確認であり、writerの継続稼働・取り込み時期・モデル応答・通信断後の手動再送の重複排除を保証しない。

## 各作業のテスト結果

ログはすべて [artifacts/network-20261105](artifacts/network-20261105/) に保存。以下の自動テストは合計138件成功。実通信検証と未完了条件は別表とした。リポジトリ全件検証ではない。

| 作業 | 最終結果 | ログ |
| --- | --- | --- |
| SSI配置テンプレート | 1件成功。変更前に失敗を確認 | 01-ssi-before.log、38-ssi-final.log |
| ENV優先・資格情報非継承・失敗時キャッシュ保持 | 8件成功 | 06-network-settings.log |
| 実配置のソケット権限・非公開パス・SSI/Ruby/子CGI | 4件成功。配置前の失敗も保存 | 03-runtime-before.log、34-runtime-single-thread.log |
| Python chat/observer/HTTP/WebSocket/同一会話queue | 52件成功 | 30-queue-before.log、31-queue-after.log、32-chat-python-final.log |
| LLM worker | 21件成功 | 09-llm-worker.log |
| Rubyのquoted prompt解析など | 16件、69 assertions成功 | 10-prompt-ruby.log |
| Node stream/socket/reconnect/theme/実フォームハンドラー | 36件成功。accepted=falseの失敗を先に再現 | 17-console-form.log、33-chat-node-final.log |

| 実通信・運用項目 | 結果 | ログ |
| --- | --- | --- |
| mygw WebSocket | challenge HMAC認証と実conversationを受信 | 35-public-streams-final.log |
| mygw SSE/NDJSON/JSON-seq | 3方式すべて署名認証と実conversationを受信 | 同上 |
| 未署名AI入力 | 拒否を確認 | 同上 |
| `codex_prompt=“…”` | done、固有の実assistant応答と完全一致 | 15-public-prompt.log |
| `claude_prompt=“…”` | 初回失敗後、バイナリ配置でdone・実応答完全一致 | 22-claude-live.log、26-claude-binary.log、27-claude-live-after.log |
| 投稿API・会話一本化 | 初回409。その後200 accepted/queued。同じ会話で投稿受信・assistant応答・公開observer配信・キュー消費を確認し成功 | 16-public-console.log、36-single-thread-post.log、41-single-thread-delivery.log |
| 公開HTML/生成JS | accepted検証とqueued表示を配信、構文成功 | 40-public-assets-final.log |
| Cloudflare ingress・SSH構文 | 成功。cloudflared接続3、Tailscale Running・peer 2件 | 24-network-diagnostics.log |
| Tunnel一覧更新 | 権限不足。別トークンに自動切替せず不完全キャッシュ保存を拒否 | 13-tunnel-refresh.log、19-restart-idempotence.log |
| r8 | API200 auth=error/no_api_token、SSI展開200 | 23-other-hosts.log |
| stream | API/SSI 530。外部設定の読み取り権限がなく未復旧 | 同上 |
| r9 | API502。Redmine専用割当を維持しlibへ転用していない | 同上 |
| ファイアウォール | 最終検証後20:34:57 UTCにログとnft rulesetを採取 | firewall.log、nft-ruleset.txt、firewall-manifest.json |

39の検証補助コードは途中で閉じたHTTPセッションを再利用する誤りがあり、公開資産検証部分は失敗した。修正して40で再検証し成功。39に保存済みの応答未確認・native queue待機1件という結果は、その時点の実測である。

## セキュリティ更新

apt-get update成功後、upgradeのシミュレーションとapt-cache policyを実行。インストール済みパッケージで候補差分は次の1件。更新自体は実施していない。

| パッケージ | 現在 | securityポケットの更新候補 |
| --- | --- | --- |
| ca-certificates | 20260816ubuntu0.26.04.1 | 20260816ubuntu0.26.04.2 |

[Ubuntu公式 USN-9001-1](https://ubuntu.com/security/notices/USN-9001-1)（2026-11-05公開）の修正版と一致。システムCA一覧から削除された証明書がJKSから除去されない同期不具合を修正する更新。apache2、openssh-server、openssl、libpcre2-8-0、bind9-libsは今回のapt情報で導入版と候補版が一致。これは脆弱性がないという保証ではない。根拠は11-apt-update.log、12-upgrade-candidates.log、25-security-policy.log。

既存originは自己署名TLS/noTLSVerify。ローカル検証のみ証明書検証を無効化し、公開mygwは通常のHTTPS検証で通信した。origin証明書の信頼構成の更新は今回実施していない。

## ファイアウォールと残る作業

採取したログは既存のcounters-only収集プロセスによるDROP_COUNTERの増分・累計・採取時刻であり、パケット単位のカーネル本文ログではない。nft採取exit=0。サイズ・SHA256とUTC日時をmanifestに保存。

同一会話キューのwriter取り込みと実応答は後続ターンで確認済み。未完了は、実ブラウザの本体ストリームパネル操作、現在ENVトークンによるTunnel読み取り権限、stream530/r9 502の外部経路、外部SSHログイン、コンテナ再作成後の復元。起動成功・HTTP200・受付だけでこれらを完了と扱わない。

同一会話配信の後続検証完了後、2026-11-05T20:37:25.792125+00:00 にファイアウォールログとnftを再採取した。初回スナップショットはbefore-delivery-*として保持した。
