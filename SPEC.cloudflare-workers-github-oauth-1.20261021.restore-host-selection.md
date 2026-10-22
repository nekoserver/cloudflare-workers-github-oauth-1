# 本体コンテナのmygw維持と配信先選択の復元

ユーザー指示により、本体nekorootコンテナはmygwの構成を維持する。
CFC用接続トークンをnekoroot用として扱わず、CFC専用トンネルへの統一方針を撤回する。
この決定は同日付のCFC統一SPECより優先する。

- nekorootの公開ホストはmygw、SSH `/ssh` → `127.0.0.1:2222`、HTTPS → `127.0.0.1:8443` に統一。ビルド元のSSH中継先22を実際のsshdと同じ2222へ修正。
- 本体API署名先・Dockerプロキシの既定接続先をmygwへ戻す。
- 本体WorkerのNEKOROOT_HOSTNAME・ASKGK_TUNNELS_URLをmygwへ戻す。
- 会話パネルでmygw・mynw・CFCを個別に選択できるようにし、CSPと死活確認も同じ候補に揃える。
- 自動選択は稼働中の候補だけを使用する。ホスト変更時はiframeを切り替え、postMessageの送信元とoriginの確認を維持する。
- Secretの書換え・コンテナ再起動・イメージ更新は実施しない。CFC用トークンから元のnekoroot用トークンを復元できるとは扱わない。

ソースの変更と公開ホストの復旧は別。mynwのDNS未登録、CFCの530/1033は選択肢の復元だけでは解消しない。

検証: 関連8ファイル・71テスト成功（死活確認テストのモック修正後の再実行を含む）。entrypointのbash構文・git diff --check成功。Dockerビルド・デプロイ・コンテナ再起動は未実施。
