# NOTICE.cloudflare-workers-github-oauth-1.20261008

## `/access-verify` が「Access JWTの有無 → 不合格」になる典型パターン

**対象**: `/access-verify` ページ（`src/views/cfAccessVerify.ts` / `src/utils/cfAccessVerify.ts`）。
Cloudflare WARP/Zero Trust Access ならびに Tunnel を経由した正規ユーザーのログインかどうかを
JWT署名で検証するページ。合否判定結果が実環境のCloudflareダッシュボード設定に強く依存するため、
典型的な「不合格になる原因」を一般化して記録する。

### 前提: 3つの層は独立している

Cloudflare Tunnel（`cloudflared`）・Workers Route（公開URLの振り分け先）・Zero Trust Access
（身元検証のゲート）は互いに独立したレイヤーである。TunnelやRouteが正しく設定されていても、
**Access Applicationが対象ホスト/パスに明示的に紐付けられていない限り、Access JWTは一切発行されない**。
この3層の関係を混同し、「Tunnelは繋がっているのに何故JWTが無いのか」という誤った前提で調査を始めないこと。

### 不合格になる典型パターン

1. **`*.workers.dev` へ直接アクセスしている**
   Workers Route・Tunnel・Accessのいずれも経由しないため、JWTが存在しないのは正常な挙動。
   `/access-verify` は「正規ルートを経由していない」ことを正しく検出できている。

2. **Workers Route/カスタムドメイン/サブドメインを変更・切替した**
   運用中に使用ホスト名を変更した場合（例: 旧ホスト名から別ホスト名へ切替、あるいは逆に戻す場合）、
   Zero Trust Access側のApplication設定は**ホスト名に紐付けられたまま自動追従しない**。
   新しいホスト名に対して個別にApplicationを作り直す・向け先を変更する作業が別途必要になる。
   「ルートを元に戻した/変更した」だけでは合格にならない。

3. **Access Applicationがそもそも対象ホスト/パスに関連付けられていない、または設定が不完全**
   - Zero Trust ダッシュボードでApplication自体が未作成
   - Applicationは存在するが対象のホスト名/パスが異なる（別ドメイン・別パス向けに作られている）
   - ポリシーのActionが「Bypass」になっている（この場合は身元確認自体がスキップされ、JWTが発行されない。
     JWT発行には「Allow」ポリシーが必須）

### 対処の一般原則

- ホスト名・ルート構成を変更した／元に戻した場合は、**変更後の実際のホスト名に対して**
  Zero Trust ダッシュボードでAccess Applicationが存在し、ポリシーのActionが「Allow」になっているかを
  都度確認する。ルート設定とAccess設定は別々に管理されているため、片方だけ直しても揃わない。
- 本番運用中のWorkerが同時にWebhook/OAuth callback等の**未認証であるべきエンドポイント**を
  提供している場合、ホスト全体にAccess Applicationを紐付けると未認証トラフィックまで巻き込んで
  壊れる。パス指定でApplicationをスコープする（対象パスのみに適用する）か、検証専用の別サブドメインを
  用意するほうが安全。
- この種の切替作業はCloudflareダッシュボード側の操作であり、本セッション（`CLOUDFLARE_API_TOKEN`
  未設定・デプロイ不可）からは実行できない。コード側は正しく動いていても、ダッシュボード設定が
  整うまで `/access-verify` は不合格のままになるのが仕様通りの挙動である。
