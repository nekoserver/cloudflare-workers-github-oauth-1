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
