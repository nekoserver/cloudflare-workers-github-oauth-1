# NOTICE: TypeScript 型注釈を HTML 埋め込み JS に書くと SyntaxError で全機能が死ぬ

調査日: 2026-06-06

---

## 1. 何が起きたか

`getAiChatPage()` が返す HTML 文字列の `<script>` ブロック内に、
TypeScript 専用の型注釈を含む関数 `getNextZ()` を書いた結果、
ブラウザが **SyntaxError** を起こしてスクリプトブロック全体の実行を停止した。

具体的に問題になったコード：

```javascript
// NG: TypeScript 構文がそのまま埋め込まれる
var z = parseInt((el as HTMLElement).style.zIndex) || 0;
//                   ^^^^^^^^^^^^ TypeScript のみ有効

var staticZDefaults: Record<string, number> = { ... };
//                 ^^^^^^^^^^^^^^^^^^^^^^^ TypeScript のみ有効
```

ブラウザはこれらを構文エラーとして検出し、`<script>` タグ全体の実行をスキップした。

---

## 2. 症状

SyntaxError が起きると、同じ `<script>` ブロック内のコードがすべて実行されなくなる。
このため、一見まったく無関係に見える複数の機能が一度に壊れる。

今回の事例：

| 壊れた機能 | 原因 |
|---|---|
| サイドバー開閉ボタンが反応しない | イベントリスナーが登録されなかった |
| ナビバーのモデルカラードットが灰色 | `applyModelColor()` が呼ばれなかった |
| モーダルが開かない | モーダル開閉の各関数が登録されなかった |

SyntaxError の場合、**どこか 1 箇所の型注釈がページ全体のすべての JS を殺す**。

---

## 3. なぜ起きるか

`getAiChatPage()` のような関数は、テンプレートリテラルで HTML 文字列を生成し、
その中に JavaScript を文字列として埋め込む。

```typescript
export function getAiChatPage(...): string {
  return `
    <script>
      function getNextZ() {
        // ここは TypeScript コンパイラが処理する JS コードではなく
        // 文字列として出力されるだけ
      }
    </script>
  `;
}
```

このテンプレートリテラルの中身は **TypeScript コンパイラが構文チェックも型除去もしない**。
単なる文字列として HTML に出力される。そのため TypeScript 型注釈がブラウザに届く。

ブラウザは TypeScript を理解しないので SyntaxError になる。

---

## 4. 正しい書き方

**HTML に埋め込む JavaScript は必ずプレーン JavaScript で書く。**

```javascript
// OK: プレーン JavaScript
var z = parseInt(el.style.zIndex) || 0;

var staticZDefaults = {
  linkedQuestionsOverlay: 700,
  impressionsSubqueryModal: 800,
};
```

禁止する TypeScript 構文：

| 禁止 | 内容 |
|---|---|
| `value as TypeName` | 型アサーション |
| `varName: TypeName = ...` | 変数の型注釈 |
| `function f(x: string)` | 引数の型注釈 |
| `Record<K, V>` / `Array<T>` 等 | ジェネリック型 |
| `interface` / `type` キーワード | 型定義 |

---

## 5. 検出方法

`npx vitest run` では検出できない。テストは HTML 文字列として処理するため
TypeScript 型注釈が文字列に含まれていても文字列マッチングテストはパスする。

手動チェックとして：

```bash
# <script> ブロック内に TypeScript 型注釈がないか確認
awk 'NR>=<script開始行> && NR<=<script終了行>' src/views/aichat.ts \
  | grep -n " as [A-Z]\|: Record<\|: Array<\|: [A-Z][a-zA-Z]*;"
```

または、コードレビュー時に「この関数は HTML に埋め込まれるか？」を意識する。

---

## 6. 今回の修正コミット

| コミット | 内容 |
|---|---|
| [`a23dd8e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a23dd8e) | getNextZ() を実装（TypeScript 型注釈を含む — バグあり） |
| [`f906be1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f906be1) | TypeScript 型注釈を除去して修正 |

---

## 7. 予防ルール

- **HTML 埋め込み JS を書くときは「ここは TypeScript ではなくブラウザが実行する」と意識する**
- `as TypeName` / `: TypeName` を書いた瞬間に止まる
- 型情報が必要な場合はコメントで書く（`// @type {number}`）
- 埋め込み JS のコードブロックは IDE で TypeScript として補完されることがあるが、
  型補完をそのまま出力に含めてはいけない

---

## 付記: ブラウザによるインラインスタイル正規化

### 関連バグ（2026-06-06 発見）

`element.style.cssText = 'position:fixed;z-index:100'` のように設定しても、
ブラウザは CSS を正規化して `position: fixed; z-index: 100` のように
**コロンとセミコロンの後にスペースを挿入**する。

そのため `div[style*="position:fixed"]`（スペースなし）で要素を検索すると
**マッチしない**。

```javascript
// 設定:
overlay.style.cssText = 'position:fixed;z-index:800;';

// ブラウザが保持する値:
// element.getAttribute('style') → 'position: fixed; z-index: 800;'

// NG: マッチしない
document.querySelectorAll('div[style*="position:fixed"]');

// OK: data 属性で識別する
overlay.setAttribute('data-overlay', '');
document.querySelectorAll('div[data-overlay]');
```

### 教訓

動的に作成した要素を CSS セレクタで後から検索する必要がある場合は、
インラインスタイルのテキストマッチングではなく
**専用の属性（`data-*`）やクラスを付与して識別する**。

---

## 付記: 動的オーバーレイの中から別モーダルを開く場合は z-index を明示的に渡す

### 関連バグ（2026-06-06 発見）

動的生成オーバーレイ（`data-overlay` 付き `div`）の中のボタンから
別のモーダルを開こうとしたとき、`getNextZ()` だけに頼ると
**新しいモーダルが親オーバーレイの裏に入る**場合がある。

発生した具体的なケース：
- `openReAskResponseModal` が生成した response overlay（z=800）の中に
  `appendAiResponseRow` が配置した「追加質問を登録する」ボタン
- ボタン押下 → `openAddSubqueryModal()` → `getNextZ()` が親 overlay を
  走査して z=800 を検出 → `addSubqueryModal` に z=900 をセット
- 理論上は正しいが、`stopPropagation()` 未設定やブラウザの処理タイミングによって
  z-index が意図通り反映されないケースが生じた

---

### 正しい実装パターン

**モーダルを開くボタンが動的オーバーレイの中にある場合は、親の z-index を明示的に渡す。**

```javascript
// NG: getNextZ() だけに頼る（タイミング依存で裏に入ることがある）
addBtn.onclick = function() {
  openAddSubqueryModal();
};

// OK: stopPropagation + 親 data-overlay の z-index を渡す
addBtn.onclick = function(e) {
  e.stopPropagation();
  var p = container;
  var parentZ = 0;
  while (p && p !== document.body) {
    if (p.getAttribute && p.getAttribute('data-overlay')) {
      parentZ = parseInt(p.style.zIndex) || 0;
      break;
    }
    p = p.parentNode;
  }
  openAddSubqueryModal(parentZ || undefined);
};
```

モーダルを開く関数側は `baseZ` 引数を受け取り、渡された場合は `baseZ + 100` を使う：

```javascript
function openAddSubqueryModal(baseZ) {
  var z = (baseZ && baseZ > 0) ? baseZ + 100 : getNextZ();
  modal.style.zIndex = String(z);
  modal.classList.add('open');
}
```

---

### 予防ルール

| 状況 | 対処 |
|---|---|
| 静的 HTML モーダル同士の重なり | `getNextZ()` を呼ぶだけでよい |
| 動的オーバーレイの中からモーダルを開く | `parentNode` を辿って親 `data-overlay` の z-index を取得し、モーダル関数に `baseZ` として渡す |
| どちらかわからない場合 | `baseZ` パターンを適用しておく（フォールバックで `getNextZ()` が動くため副作用なし）|

また、モーダルを開くボタンには **必ず `e.stopPropagation()` を付ける**。
付け忘れると click イベントが親要素へ伝播し、予期しない挙動（親モーダルが閉じる等）を引き起こす。

### 関連コミット

| コミット | 内容 |
|---|---|
| [`246d85f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/246d85f) | appendAiResponseRow の追加質問ボタンに stopPropagation・baseZ 渡しを実装 |
