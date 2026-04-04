# NOTICE — 2026-04-04

## 1. リポジトリページの「権限を追加」ボタンでできること・できないこと

### 背景

リポジトリページの「有効な権限」モーダルには2種類の権限が表示される:

- **GitHub App インストール権限**: GitHub App がリポジトリに対して持つ権限（contents: read, pull_requests: write 等）
- **OAuth スコープ**: OAuth 認証時にユーザーが付与したスコープ（repo, read:user 等）

これらは管理方法がまったく異なるため、「権限を追加」の挙動も分けて理解する必要がある。

### OAuth スコープ — アプリ側で再認証が可能

| 項目 | 内容 |
|---|---|
| 変更方法 | `/auth/github/reauthorize` で既存 OAuth グラントを取り消し → GitHub の認可画面で再承認 |
| できること | 不足しているスコープ（例: `repo`）を追加して再認証する |
| できないこと | 個別スコープの取り消し（GitHub の認可画面は「全スコープ承認 or 拒否」の二択） |
| 注意点 | 再認証フローでは既存グラントが **DELETE** される。GitHub API の `DELETE /applications/{client_id}/grant` が実行されるため、一時的にアクセストークンが無効化される |

**再認証後のリダイレクト**: `return_to` パラメータに対応済み。リポジトリページからの再認証では `?return_to=/repositories` が付与され、認証完了後にリポジトリページへ戻る。

### GitHub App インストール権限 — アプリ側では変更不可

| 項目 | 内容 |
|---|---|
| 変更方法 | GitHub の [Settings > Installations](https://github.com/settings/installations) から対象アプリのインストール設定を変更する |
| できること（GitHub UI 側） | アプリがアクセスできるリポジトリの追加・削除、インストールの一時停止・削除 |
| できないこと（GitHub UI 側） | 個別権限（contents, pull_requests 等）の粒度変更。これらはアプリのマニフェスト（開発者側）で定義されており、ユーザーは「承認 or アンインストール」の二択 |
| できないこと（アプリ側） | OAuth 再認証をしても GitHub App のインストール権限は一切変わらない。OAuth と GitHub App は独立した認証・認可メカニズム |

### OAuth グラント取り消し（revoke）の影響範囲

アプリ側から `DELETE /applications/{client_id}/grant` を実行すると OAuth グラント全体が取り消される。この操作の影響:

1. **アクセストークンが即座に無効化される** — アプリからの全 GitHub API アクセスが停止
2. **個別スコープの選択的取り消しは不可能** — GitHub OAuth は「全スコープ一括承認」の仕組みであり、「contents だけ取り消す」のような粒度の操作は API 上存在しない
3. **再認証しない限り全機能が停止する** — リポジトリ一覧表示、コミット取得、権限情報取得など GitHub API に依存する全機能が動かなくなる
4. **再認証しても同じスコープが再リクエストされる** — アプリのスコープ設定（`read:user user:email repo`）は固定なので、取り消し→再認証しても結果は同じ

**結論**: 「許可している権限をアプリ側から取り消す」機能を UI に露出するのは現実的ではない。取り消し＝全機能停止であり、ユーザーが影響範囲を予測できないまま実行するリスクが高い。権限の管理は GitHub の [Authorized OAuth Apps](https://github.com/settings/applications) ページに委ねるのが安全。

### よくある誤解

- **「権限を追加」を押せば GitHub App の権限も変わる」** → 変わらない。OAuth スコープのみが対象
- **「禁止中の権限をアプリ側で有効化できる」** → GitHub App 権限の場合はできない。アプリ開発者がマニフェストで権限を追加し、インストール済みユーザーが GitHub UI で承認する必要がある
- **「OAuth 再認証で特定のスコープだけ外せる」** → できない。GitHub の OAuth 認可画面はリクエストされた全スコープを一括承認する仕組み
- **「アプリ側から個別権限を取り消せる」** → できない。`DELETE /applications/{client_id}/grant` はグラント全体の削除であり、個別スコープの取り消し API は存在しない

## 2. ER図モーダルの矢印が表示されない問題の原因

### 根本原因

SVG の `marker-end: url(#id)` による矢印描画が、`position: fixed` モーダル内のスタッキングコンテキストで正しく解決されない（Chrome/Safari の既知の挙動）。

### 追加の原因

- SVG オーバーレイの `z-index: 0` がテーブルカード（`z-index: 1`）より低く、線と矢印がカードの背後に隠れていた
- `normalizeGroupErToUml` の FK 判定が `keyType === "fk"` の厳密比較で `"pk+fk"` を除外しており、一部のリレーションが生成されなかった

### 対処

- SVG `<defs>` + `<marker>` を廃止し、インライン `<polygon>` で矢印を直接描画する方式に変更
- SVG オーバーレイの `z-index` を 2 に引き上げ（`pointer-events: none` 維持）
- FK 判定を `indexOf('fk')` に緩和

### 教訓

モーダル（`position: fixed` + `overflow: hidden`）内の SVG で `url(#id)` 参照を使うと、ブラウザによってはマーカーが描画されない。インライン描画（`<polygon>` / `<path>`）の方が確実。
