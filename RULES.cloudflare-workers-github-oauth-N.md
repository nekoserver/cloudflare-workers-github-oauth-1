# RULES.cloudflare-workers-github-oauth-N.md

## Monodoc スタイル定義

本ワークフローの手順書 HTML は **Monodoc**（単一 HTML 自己完結ドキュメント）形式で出力する。
外部 CSS・JS への依存は持たず、1 ファイルで完結する。

---

### 1. レイアウト

| 項目 | ルール |
|---|---|
| 左ペイン（`nav`）幅 | `--nav-width: 240px` 固定。この値を変更してはならない |
| メインコンテンツ | `margin-left: var(--nav-width)` で左ペイン分オフセット |
| レスポンシブ | `@media (max-width: 800px)` で `nav` を非表示、`main` の margin を解除 |

### 2. 見出しの折りたたみ

すべての大見出し（`<h2>`）は `<details class="phase-details">` + `<summary>` で折りたたみ可能にする。

```html
<section id="phase-a">
<details class="phase-details" open>
<summary><h2>A. セクションタイトル</h2></summary>
<!-- コンテンツ -->
</details>
</section>
```

- デフォルトは `open`（展開状態）
- 折りたたみ三角形は CSS 疑似要素（`▶` / 90° 回転）で表現する
- ブラウザ標準の `::marker` / `::-webkit-details-marker` は非表示にする

### 3. ステップブロック（`[A-Z].[0-9]` 小見出し）

各フェーズ内の小見出し（`A-1`, `B-2`, `T-3` など `[A-Z]-[0-9]` 形式）は
`.step-block` で囲んだ領域として表現する。

```html
<div class="step-block" tabindex="0" id="a1">
<h3>A-1. ステップタイトル</h3>
<p>内容...</p>
</div>
```

#### step-block の振る舞い

| 状態 | 見た目 |
|---|---|
| 非アクティブ | 背景 `--step-bg`、テキスト `--step-text-muted`（薄く表示） |
| アクティブ（クリック / フォーカス時） | 背景 `--step-highlight-bg`、ボーダー `--step-highlight-border`、box-shadow 付き |

- 同時にアクティブにできる step-block は **1 つだけ**
- step-block 外をクリックすると全非アクティブに戻る
- `tabindex="0"` でキーボードフォーカス可能にする

### 4. 左ペイン（nav）構造

```
nav
├── h1（ドキュメントタイトル）
├── nav-phase（大見出しリンク） + check-count（進捗）
│   └── nav-step（小見出しリンク）
├── nav-divider（区切り線）
└── ...繰り返し
```

- `nav-phase`: フェーズレベルのリンク。`font-weight: 600`、左ボーダー付きホバー
- `nav-step`: ステップレベルのリンク。インデント深め（`padding-left: 32px`）、小フォント
- `check-count`: 各フェーズの進捗を `checked/total` で表示。全完了時に `--success` 色

### 5. テーマ（CSS カスタムプロパティ）

ライト / ダーク両対応を `:root` と `@media (prefers-color-scheme: dark)` で管理する。

必須の CSS 変数:

```
--nav-width, --bg, --bg-nav, --border, --accent, --accent-light,
--text, --text-muted, --danger, --success, --warn-bg, --warn-border,
--code-bg, --step-bg, --step-border, --step-text-muted,
--step-highlight-bg, --step-highlight-border, --step-highlight-shadow
```

### 6. インタラクション（JavaScript）

以下の機能を `<script>` で実装する:

1. **step-block フォーカス管理** — クリック / focus で 1 つだけアクティブ化
2. **チェックリスト進捗追跡** — checkbox の変更を検知し nav の `check-count` を更新
3. **スクロール連動ナビハイライト** — 現在表示中のセクションに対応する nav リンクに `.active` 付与
4. **localStorage 永続化** — 変数表の入力値、チェック状態、折りたたみ状態を保存・復元
5. **nav クリックで折りたたみ展開** — 閉じたセクションへの nav リンククリック時に自動展開

### 7. コンポーネント一覧

| クラス / 要素 | 用途 |
|---|---|
| `.warn` | 警告ボックス（黄背景、赤太字の `<strong>`） |
| `.ref` | 文書内相互参照リンク（点線下線、アクセント色） |
| `.checklist` | チェックリスト（`list-style: none`、checkbox 付き） |
| `.var` | 変数プレースホルダー（`{N}` など。アクセント背景、monospace） |
| `.deprecated` | 廃止された手順（取り消し線） |
| `.deprecated-note` | 廃止理由の説明（赤太字） |
| `pre > code` | コマンドブロック（背景色付き、角丸、横スクロール） |

### 8. 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| セクション id | `phase-{小文字アルファベット}` | `phase-a`, `phase-b` |
| ステップ id | `{小文字アルファベット}{数字}` | `a1`, `b2`, `t3` |
| チェックリスト | `data-phase="{小文字アルファベット}"` | `data-phase="a"` |
| nav 進捗表示 | `data-phase="{小文字アルファベット}"` | 同上 |

---

## 禁止事項

- `--nav-width` を `240px` 以外に変更すること
- 外部 CDN や外部ファイルへの依存を追加すること
- `<h2>` を `<details>` で囲まずにそのまま配置すること
- step-block を使わずに `[A-Z]-[0-9]` ステップを記述すること
- ダークモード非対応のハードコードされた色値を使用すること
