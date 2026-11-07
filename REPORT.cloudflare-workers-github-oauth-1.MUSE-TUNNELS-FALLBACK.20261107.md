# Museの通常入力とtunnelsフォールバック（2026-11-07 UTC）

## 最終仕様

通常の入力では初期（要求時）モデルがMuseなら、本文を/askmuseや/nekoコマンドへ変換せず直接Museへ渡す。直前に本体コンテナのTailscale Runningと宛先muse-vm onlineを確認する。

- Tailscale接続可：tunnels設定にかかわらず直接Museへ送る。
- Tailscale接続不可/確認不可、tunnels OFF：送らず接続エラーを表示。
- Tailscale接続不可/確認不可、tunnels ON：この場合だけ/neko askgk muse_prompt="本文"へ変換し、既存tunnels経路へ一度送る。

MuseのHTTP/認証/実行エラーや直接送信後のタイムアウトではtunnelsへ再送しない。接続確認の失敗時に経路を決め、推論送信の重複を避ける。明示プレフィックスとCodex/Claudeの既存経路は維持。言語モデルスイッチ自体を書き換えない。

## 設定と実行箇所

Museの⚙のモーダルに「Tailscale未接続時に tunnels を使う（初期OFF）」を追加した。ブラウザごとのCookie aichat_muse_tunnelsで保存し、リセットするとOFF。シグナル送信とは独立。APIでCookieを読むため、通常投稿と再質問は同じ設定を使う。APIのmuseTunnelsFallbackが明示された場合はboolean trueだけON、それ以外はOFFとしてCookieより優先する。未指定かつCookieなしの初期状態はOFF。

src/index.tsで初期Muse/通常入力に限ってフォールバックを判断。接続確認で停止したMuseを再び同じpreflightで拒否しないよう、許可済みフォールバックだけ既存署名中継を呼ぶ。その他の明示askgkの接続確認は維持する。通常の直接入力はinterpretMusePromptで本文をそのまま処理し、/askmuseに包まない。フォールバックした回答もMuseとして本文で保存しfallbackUsed=trueを返す。X-Muse-Tailscaleはunavailableのままで、フォールバック成功をTailscale接続成功と混同しない。

## 検証と反映状態

artifacts/muse-tunnels-fallback-20261107/before.logに先行失敗（フォールバック経路と設定UI）を保存。after.logで269件、追加条件を含むfinal.logで関連6ファイル273テスト成功。git diff --check成功。生成/aichat HTMLのinline scriptをnode --checkに渡す検査も成功。

対象はaichat-askmuse-integration、aichatMuseHealth、museTailscalePreflight、museDirectAsk、aichatSlashCommand、codexAskgkQuestion。初期OFF/無効値OFF、Cookie保存・再表示・初期化、API明示OFF優先、未接続+ONだけ中継、接続中+ONも直接、直接失敗で再送なし、初期Muse以外に影響しない、明示プレフィックスの維持、本文の引用符/改行と保存を確認。

変更後の実画面と本番Workerは未反映。Dockerビルド・Workerデプロイ・push・全体テストは行っていない。先行ターンのコンテナ→Tailscale→Muse実応答成功を、新しいフォールバック経路の本番成功としては扱わない。現tunnelsのLLM workerはMuse非対応と先行作業で確認されているため、ONでもunsupported_engineが返る可能性が残る。今回の実モデル再要求は行っていない。

最終ファイアウォールログ/nftは作業コンテナの/root/cloudflare-workers-github-oauth-1/artifacts/muse-tunnels-fallback-20261107/firewall-manifest.jsonにUTC・終了コード・SHA256付きで保存。これら運用ログはPRに含めない。検証ログbefore.log/after.log/final.logのみ同名artifacts配下へ含める。

## PR用ブランチでの再確認

最新origin/main（4769d9b8）から独立ブランチfix/muse-direct-tunnels-fallback-20261107を作成。関連6ファイル273テストと生成HTML scriptの構文検査を再確認済み。根拠はartifacts/muse-tunnels-fallback-20261107/pr-validation.log。Apacheの先行変更とファイアウォール等の運用ログはこのPRに含めない。Dockerビルド・Workerデプロイは行わない。
