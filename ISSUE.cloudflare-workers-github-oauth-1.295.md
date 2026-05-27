# ISSUE: /status ER図テーブルヘッダータップでモーダルが開かない

**リポジトリ**: `nekoserver/cloudflare-workers-github-oauth-1`
**解決PR**: [#295](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/295)
**発生期間**: PR #292 マージ後 〜 PR #295 マージまで

---

## 概要

`/status` ページの ER 図モーダル内でテーブルヘッダーをタップ（クリック）しても、
テーブルの保存データを表示するモーダルが開かなかった。

---

## 機能の経緯

| PR | 内容 |
|---|---|
| [#292](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/292) | ER図テーブルヘッダータップでデータプレビューモーダルを表示する機能を追加 |
| [#293](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/293) | 設定ページ（`/settings`）にヘッダータップ機能の ON/OFF トグルを追加 |
| [#294](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/294) | z-index 衝突の修正（後述「原因1」） |
| [#295](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/295) | mouseup ベースのタップ検知を click リスナーに変更（後述「原因2」） |

---

## 調査過程

### 原因1: z-index の重なり順序による視覚的な隠蔽（PR #294 で修正）

**コミット**: [`f3604b1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f3604b1)

#### 問題の構造

`/status` ページには複数の `.modal-backdrop` が存在し、すべて同じ `z-index: 2000` を持つ。
CSS の z-index が同値の場合、DOM 上で後に現れた要素が前面に表示される（後勝ちルール）。

```text
行 1699: <div class="modal-backdrop" id="statusDetailModal">  ← z-index:2000, DOM順:先（背後）
行 1714: <div class="modal-backdrop" id="umlModal">           ← z-index:2000, DOM順:後（前面）
```

`openTablePreview()` が `statusDetailModal` を `classList.add('show')` で表示しても、
すでに表示中の `umlModal`（ER 図モーダル）が前面に重なって `statusDetailModal` が見えない状態だった。

#### 修正内容

`openStatusModal()` 内で `statusDetailModal` を表示する直前に `style.zIndex = '3000'` を動的に設定し、
`closeStatusModal()` でリセットする。

```javascript
function openStatusModal(...) {
  ...
  elements.modal.style.zIndex = '3000';  // 追加: umlModal(2000)より高く
  elements.modal.classList.add('show');
}

function closeStatusModal() {
  ...
  elements.modal.style.zIndex = '';      // 追加: 閉じるときリセット
}
```

**この修正後もモーダルは開かなかった** → 根本原因は別にあった。

---

### 原因2: document の mouseup イベントが信頼性を欠いていた（PR #295 で修正）

**コミット**: [`3bd8832`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3bd8832)

#### 元の実装（PR #292 の方式）

PR #292 では、タップとドラッグを区別するために以下の仕組みを採用していた。

```javascript
// mousedown: ヘッダーをクリックした開始を記録
container.addEventListener('mousedown', function(e) {
  dragTarget = tableName;
  dragStartIsHeader = !!e.target.closest('.uml-table-header');
  hasDragged = false;
  e.preventDefault();   // ← テキスト選択・フォーカス移動を防止
});

// mousemove: 4px 以上動いたらドラッグとみなす
document.addEventListener('mousemove', function(e) {
  if (Math.sqrt(dx*dx + dy*dy) > 4) hasDragged = true;
});

// mouseup: 条件が揃えば openTablePreview を呼ぶ
document.addEventListener('mouseup', function() {
  if (dragTarget && dragStartIsHeader && !hasDragged) {
    openTablePreview(tName);
  }
  dragTarget = null;
});
```

#### なぜ動かなかったか

`document` レベルの `mouseup` ハンドラが期待どおりに発火しないケースがあった。
原因として考えられる要因を以下に列挙する。

| 要因 | 詳細 |
|---|---|
| `overflow: auto` コンテナ | `umlWrapper`（`.uml-canvas-wrapper`）は `overflow: auto` のスクロール可能な要素。スクロール可能なコンテナ内でのマウスイベントは、ブラウザのスクロール処理と競合する場合がある |
| `e.preventDefault()` on mousedown | `mousedown` で `preventDefault()` を呼ぶと、ブラウザによっては後続イベントの挙動が変わる可能性がある。とくに合成イベント（click 等）の発火タイミングに影響するケースが報告されている |
| `document` レベルへの伝播 | 複数の IIFE（即時実行関数）がそれぞれ独立したスコープで `document.addEventListener` を登録しており、イベント処理の干渉が発生していた可能性がある |
| タッチイベントの未対応 | `touchstart` で `e.preventDefault()` を呼ぶと、iOS/Android では合成 click イベントが抑制される。タッチデバイスでは `touchend` での判定が必要であり、実装が不完全だった |

#### 修正内容

`document` の `mouseup` に依存するのをやめ、各ヘッダー要素に**直接 `click` リスナーを追加**する方式に変更した。

```javascript
// カード生成時にヘッダーへ直接バインド
header.addEventListener('click', function(e) {
  if (hasDragged) return;    // ドラッグ後の誤発火を防止
  var hName = e.currentTarget.parentElement.getAttribute('data-uml-table');
  if (!hName) return;
  ...
  if (tapMode !== 'off') openTablePreview(hName);
});
```

**テーブル名の取得方法**: ループ変数 `tbl.name` をクロージャでキャプチャすると
`for (var t = 0; ...)` の最後の値に束縛されるバグが発生するため、
`e.currentTarget.parentElement.getAttribute('data-uml-table')` で
クリック時に DOM から読み取る方式を採用。

**タッチデバイス対応**: `touchstart` が `e.preventDefault()` を呼ぶため合成 click が抑制される。
`touchend` ハンドラで `dragStartIsHeader && !hasDragged` の判定を行い、
`openTablePreview` を呼ぶ仕組みを別途維持。

```javascript
document.addEventListener('touchend', function(e) {
  if (e.touches.length < 2) pinchStartDist = 0;
  if (dragTarget && dragStartIsHeader && !hasDragged) {
    ...
    if (tapMode !== 'off') openTablePreview(tName);
    return;
  }
  dragTarget = null;
});
```

---

## 修正後のイベント処理フロー

### デスクトップ（マウス）

```text
mousedown(container)
  → dragTarget = tblName
  → hasDragged = false

mousemove(document) ← 4px 以上動いた場合のみ
  → hasDragged = true

mouseup(document)
  → dragTarget = null

click(header) ← mouseup 後に発火
  → hasDragged が false なら openTablePreview(tblName)
```

### モバイル（タッチ）

```text
touchstart(container)
  → dragTarget = tblName
  → dragStartIsHeader = true
  → hasDragged = false
  → e.preventDefault() ← 合成 click を抑制

touchmove(document) ← 4px 以上動いた場合のみ
  → hasDragged = true

touchend(document)
  → dragStartIsHeader && !hasDragged なら openTablePreview(tblName)
  → dragTarget = null
```

---

## 教訓

1. **`document.addEventListener` のイベント検知は `overflow: auto` コンテナ内では不安定** — 可能な限り対象要素に直接リスナーをバインドする
2. **ループ変数のクロージャキャプチャに注意** — `var` による `for` ループでは最後の値が束縛される。DOM 属性から取得するか `let` を使う
3. **マウスとタッチのイベントモデルは異なる** — `touchstart.preventDefault()` は合成 click を抑制するため、タッチデバイスでは独立した `touchend` ハンドラが必要
4. **z-index は DOM 順序に依存する** — 同 z-index では後に現れる要素が前面に表示される。動的に `style.zIndex` を設定して制御する

---

## 関連ファイル

| ファイル | 変更内容 |
|---|---|
| `src/views/status.ts` | ヘッダー要素への click リスナー追加、mouseup ハンドラの簡略化、z-index の動的制御、touchend でのタップ判定 |
| `src/views/settings.ts` | ER 図ヘッダータップ機能の ON/OFF トグル（`er_header_tap_mode` クッキー） |
