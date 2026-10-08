# NOTICE.cloudflare-workers-github-oauth-1.20261008

## `/access-verify` を使ったZero Trust設定の確認手順

**対象**: `/access-verify` ページ（`src/views/cfAccessVerify.ts` / `src/utils/cfAccessVerify.ts`）。
Cloudflare WARP/Zero Trust Access ならびに Tunnel を経由した正規ユーザーのログインかどうかを
JWT署名で検証するページ。合否判定結果が実環境のCloudflareダッシュボード設定に強く依存するため、
「不合格」と出たときにダッシュボード側のどこを確認すればよいかを手順として記録する。

### 前提: 3つの層は独立している

Cloudflare Tunnel（`cloudflared`）・Workers Route（公開URLの振り分け先）・Zero Trust Access
（身元検証のゲート）は互いに独立したレイヤーである。TunnelやRouteが正しく設定されていても、
**Access Applicationが対象ホスト/パスに明示的に紐付けられていない限り、Access JWTは一切発行されない**。
この3層の関係を混同し、「Tunnelは繋がっているのに何故JWTが無いのか」という誤った前提で調査を始めないこと。

### 確認手順

`/access-verify` で「Access JWTの有無 → 不合格」と出た場合、以下の順でダッシュボードを確認する。

1. **どのホスト名でアクセスしたかを確認する**
   `*.workers.dev` へ直接アクセスした場合は、Workers Route・Tunnel・Accessのいずれも経由しないため
   JWTが存在しないのは正常な挙動。これは不具合ではなく、「正規ルートを経由していない」ことを
   `/access-verify` が正しく検出できている状態。カスタムドメイン/サブドメイン経由でアクセスした
   うえで次の手順に進む。

2. **そのホスト名が現在のWorkers Route設定と一致しているか確認する**
   運用中にWorkers Routeの向け先（ホスト名）を変更・切替した場合、Zero Trust Access側の
   Application設定は**ホスト名に紐付けられたまま自動追従しない**。アクセスしたホスト名と、
   Access Applicationを設定したホスト名が一致しているかをまず確認する。「ルートを元に戻した/
   変更した」だけでは、Access側の設定が追従しない限り合格にならない。

3. **Zero Trust ダッシュボードでAccess Applicationの存在とポリシーを確認する**
   対象ホスト名に対して以下を確認する。
   - Application自体が作成されているか（未作成なら新規作成する）
   - 対象のホスト名/パスが実際にアクセスした先と一致しているか（別ドメイン・別パス向けに
     作られていないか）
   - ポリシーのActionが「Allow」になっているか（「Bypass」の場合は身元確認自体がスキップされ、
     JWTが発行されない。JWT発行には「Allow」ポリシーが必須）

4. **Webhook/OAuth callback等の未認証エンドポイントを巻き込まないよう設定する**
   本番運用中のWorkerが同時にWebhook/OAuth callback等の**未認証であるべきエンドポイント**を
   提供している場合、ホスト全体にAccess Applicationを紐付けると未認証トラフィックまで巻き込んで
   壊れる。パス指定でApplicationをスコープする（`/access-verify` のみに適用する等）か、検証専用の
   別サブドメインを用意するほうが安全。

### 補足

この一連の確認・設定作業はCloudflareダッシュボード側の操作であり、本セッション
（`CLOUDFLARE_API_TOKEN`未設定・デプロイ不可）からは実行できない。コード側は正しく動いていても、
上記の確認手順がすべて整うまで `/access-verify` は不合格のままになるのが仕様通りの挙動である。

### 2026-10-08時点の運用状況: HTTPS用ゲートが無く効果未確認

現時点でTunnel/Access/WARP経由の接続は**SSHのみ**であり、HTTPS経由でAccessを通した接続が
存在しない。そのため `/access-verify` が実際に合格判定を返すところまでは、HTTPS用のAccess
Applicationを新設しない限り確認できない。SSH経由の接続は現状Access経由で問題なく機能しているため、
これ自体は不具合ではなく「HTTPS側の検証はまだ未着手」というだけの状態。HTTPS用ゲートを新設して
検証した結果は、判明した時点で本ファイルに追記する。
