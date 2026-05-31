# テスト方針 (TESTPOLICY)

**対象リポジトリ**: `cloudflare-workers-github-oauth-1`
**最終更新**: 2026-05-31

このドキュメントはセッションでの失敗から導いたテスト方針を記録する。
CLAUDE.md ルール9の詳細版として参照すること。

---

## 背景: なぜこのドキュメントが必要か

2026-05-31 のセッションで以下の失敗が発生した。

- `repositories.ts` の `<script>` タグ内に JS 構文エラーを含むコードをpushした
- 原因: `onclick="openCategoryGroupEditModal(\''` の `\'` が TypeScript 文字列として処理されると `'` になり、生成後の HTML 内の JS でシングルクォートが文字列を閉じて SyntaxError になった
- 影響: `<script>` ブロック全体が実行不能となり、検索ボタン・ドロップダウン等ページ全体の JS 機能が停止した
- **同時に `npx vitest run` を push 前に実行していなかった**ため、既存テストの失敗（`selectedLabel` → `activeLabels` 変更による4件）も放置していた

件数が多いテストは、検出すべき失敗を検出できなければ意味がない。

---

## 必須チェックリスト（push前）

**`git push` の前に以下を必ず実行すること。**

```bash
npx vitest run
```

- 全テストが green になってから push する
- 1件でも失敗していれば push 禁止
- 「既存の失敗だから無視」は禁止。既存の失敗もその場で直す

---

## テストが検出すべき「本物の失敗」

件数よりも「何を検出するか」が重要。以下を優先して書くこと。

### 1. 生成 HTML の JS 構文チェック（最優先）

`repositories.ts` や他の View ファイルは TypeScript のテンプレートリテラルで HTML を生成し、その中に `<script>` タグが含まれる。**生成された JS が構文的に正しいこと**をテストで保証する。

```typescript
it('script タグ内の JS に構文エラーがない', () => {
  const html = getRepositoriesPage(minimalUser);
  const scriptRe = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const js = m[1];
    expect(() => {
      new Function(`(function(){\n${js}\n})`);
    }).not.toThrow();
  }
});
```

**なぜ重要か**: JS に構文エラーがあると `<script>` ブロック全体が実行されなくなり、ページのすべての UI インタラクションが停止する。これはデプロイ後にしか気づけない致命的な失敗。

**よくある落とし穴**:
- TypeScript の文字列内の `\'` は、生成後の HTML では `'` になる → シングルクォート引用符が文字列を閉じて SyntaxError
- `onclick="fn(\'' + expr + '\')"` のような記述は禁止。代わりに `data-*` 属性 + `addEventListener` を使う
- テンプレートリテラル内で `${}` を使って JS コードを埋め込む場合、展開後の文字列が JS として valid であることを確認する

### 2. 主要 UI 要素の存在確認

ページがレンダリングされたとき、操作に必要な要素が HTML に存在すること。

```typescript
it('検索ボタン (commitSearchBtn) が存在する', () => {
  const html = getRepositoriesPage(minimalUser);
  expect(html).toContain('id="commitSearchBtn"');
});
```

対象: 検索ボタン・ドロップダウン・モーダル・フォーム要素など、変更時に消えると致命的なもの。

### 3. JS ロジックの変数・関数の存在確認

状態管理変数や主要関数が HTML 中の JS に存在すること。ただし、**実装が変わった場合はテストも同時に更新すること**。

**禁止パターン**: 実装を変更したのにテストを更新しないまま push する。  
（例: `selectedLabel` → `activeLabels` に変更したのに `selectedLabel` を検索するテストを残す）

テストが失敗していることは「テストが古い」のではなく「実装が変わった事実」を示している。失敗テストは即座に修正する。

### 4. API エンドポイントの疎通確認

新しいエンドポイントを追加した場合、そのルートが `index.ts` に登録されていることをテストで確認する（可能な場合）。

---

## テストを書いてはいけないもの

- 言語仕様・フレームワーク仕様から確定する挙動（TypeScript の型チェック等）
- モックが正しく返るかだけを確認するテスト（本番挙動を再現しないモック）
- 「このコードが存在する」だけを確認し、「このコードが正しく動く」を確認しないテスト

---

## HTML 生成 View のテスト設計方針

`src/views/*.ts` のような HTML 生成関数は、テストが特に重要。

| チェック項目 | 優先度 | 実装方法 |
|---|---|---|
| JS 構文エラーがない | **最高** | `new Function()` でラップしてパース |
| 主要 UI 要素が存在する | 高 | `html.toContain('id="..."')` |
| JS 関数・変数が存在する | 中 | `html.toContain('function foo(')` |
| 実装変更時にテストを更新する | **義務** | 変更と同じコミットで更新 |

---

## インライン onclick の禁止

TypeScript テンプレートで HTML を生成する際、`onclick` 属性にシングルクォートや変数を埋め込む記述は禁止。

**禁止**:
```typescript
// \' が生成後に ' になり JS 構文エラーを引き起こす
`onclick="fn(\'' + expr + '\')"`
```

**代替**:
```typescript
// data 属性に値を持たせて addEventListener で処理する
`data-target-id="${escHtml(id)}"`
// JS 側:
el.addEventListener('click', function() {
  var id = el.getAttribute('data-target-id');
  fn(id);
});
```

---

## 教訓サマリー

| 教訓 | 具体的ルール |
|---|---|
| テストは push 前に必ず実行する | `npx vitest run` が全 green でなければ push しない |
| 件数よりも検出力 | JS 構文チェックのような「致命的失敗を捕まえる」テストを優先する |
| 実装変更とテスト更新は同一コミット | 変数名・関数名・API が変わったら同じコミットでテストも直す |
| インライン onclick は書かない | TypeScript テンプレート内の引用符エスケープは必ず崩れる |
| 失敗テストを「既存だから」と放置しない | 失敗テストはその場で修正する義務がある |
