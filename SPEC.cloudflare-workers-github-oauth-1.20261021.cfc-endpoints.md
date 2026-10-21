# コンテナ接続先のCFC統一

> 後続のユーザー指示で本体mygwの維持・mynw/mygwの選択復元へ方針変更。最新の方針は `SPEC.cloudflare-workers-github-oauth-1.20261021.restore-host-selection.md` を参照。以下は変更当時の記録。

mygwの公開要求がHTTP530となることを確認し、稼働中のCFCコンテナへ統一。

- コンテナAPI・会話配信・Docker管理のoriginは `https://stream.test.cfc.nekomaneki.work`。
- 親の `https://test.cfc.nekomaneki.work` は管理Workerであり、Tunnelの代用にしない。
- 共通のコード定義は `src/utils/containerEndpoints.ts`。API署名先、Dockerプロキシ、会話配信URLが参照する。
- wranglerの `NEKOROOT_HOSTNAME` と `ASKGK_TUNNELS_URL` も合わせ、テストで一致を確認。
- 会話パネルの候補とCSPからmygw/mynwを除去。dynamicnekoの候補・CSPもCFCのみへ変更。
- 認証済みの会話HTMLと、明示したマーカーを持つキー入力画面の両方を死活確認で認識する。任意のログインHTMLやJSON200は認識しない。
- CFCの配信サーバーで旧ホストのOrigin許可を除去。本体・dynamicnekoの既知の埋め込み元を許可する。キー・Cookieによるページ保護は維持。

検証: 関連6テストファイル64件成功。dynamicnekoの型チェック、CSPテスト、Viteビルド成功。
本体全体の型チェックは別ファイルの型エラーを含み未通過。Dockerビルドは実行しない。
Worker更新時は `wrangler deploy --containers-rollout=none` を使用し、既存イメージ・稼働コンテナを維持する。
公開URLで未認証HTML/JS/CSS401、正常署名でsession200・不正署名401、閲覧Cookieでページ取得、WebSocket実会話受信を確認。

Docker管理画面はCFCの `/lib/docker.html` 自体が404。ルーティング変更で配置不足は解消しないため、Docker管理機能の稼働確認は別途必要。

## 本番反映

- 本体Worker: `a57243b6-0a34-4e36-bb95-b7054e47d4a0`。
- dynamicneko: `ce5ae452-9fd7-495f-9633-d21df9d2f8fe`。
- 本体は`--containers-rollout=none --keep-vars`でWorkerのみ更新。既存Secretの名前集合が反映前後で同じことを確認。
- 本番設定GETで`NEKOROOT_HOSTNAME=stream.test.cfc.nekomaneki.work`と`ASKGK_TUNNELS_URL=https://stream.test.cfc.nekomaneki.work/lib/api/tunnels`を確認。
- 実行中コンテナのイメージ更新・Dockerビルドは行っていない。
- CFCのキー入力HTMLに認証ゲート識別マーカーを反映。未認証アセット401と認証後の取得を維持。
- dynamicnekoの更新にはmainにcommit済みのnekoserver専用アクセス制限も含まれる。
- ソースのpush先（いずれもmainから分岐）:
  - 本体: `fix/cfc-container-endpoints-20261021`
  - dynamicneko: `fix/cfc-stream-host-20261021`
  - lib: `fix/chat-page-access-20261021`
- 本体ブランチは、依存パッケージ・Socket FirewallとCFC接続先変更を別コミットで保持する。Dockerfileの変更はイメージ未ビルド・未反映。
