// go-diff-wasm: github.com/sergi/go-diff(Googleのdiff-match-patchアルゴリズムの
// Go移植)を使い、2つのテキストの行単位の差分を統一diff風のMarkdownへ
// 整形する。
//
// 移植範囲: テキスト同士の差分計算・整形のみ。go-diff本体が持つ文字単位の
// パッチ生成・適用(patch_make/patch_apply)、あいまい一致(match_main)は
// このリポジトリでは使わない(SPEC/NOTICEファイルやPR本文の「何が変わったか」
// を見るための表示専用ツールのため)。
//
// このファイルはGOOS/GOARCHに依存しない純粋ロジックのみを置く
// (syscall/jsを使うjs/wasm専用のブリッジ部分はmain_js.goに分離してあり、
// `go test`をネイティブ環境でそのまま実行できるようにするため。sqlc-wasm
// と同じ構成)。
package main

import (
	"fmt"
	"strings"

	"github.com/sergi/go-diff/diffmatchpatch"
)

// DiffText: aとbを行単位で比較し、`+`/`-`/`  `(変更なし)を先頭に付けた
// 統一diff風の本文を ```diff フェンス付きコードブロックへ入れて返す。
// 罫線・ツリー文字は使わない(CLAUDE.mdルール16のMarkdown統一方針)。
// 冒頭には追加・削除行数のサマリを付ける。
func DiffText(a, b string) string {
	dmp := diffmatchpatch.New()
	aChars, bChars, lines := dmp.DiffLinesToChars(a, b)
	diffs := dmp.DiffMain(aChars, bChars, false)
	diffs = dmp.DiffCharsToLines(diffs, lines)

	var body strings.Builder
	insertions, deletions := 0, 0
	for _, d := range diffs {
		if d.Text == "" {
			continue
		}
		segLines := strings.Split(strings.TrimSuffix(d.Text, "\n"), "\n")
		var prefix string
		switch d.Type {
		case diffmatchpatch.DiffInsert:
			prefix = "+ "
			insertions += len(segLines)
		case diffmatchpatch.DiffDelete:
			prefix = "- "
			deletions += len(segLines)
		default:
			prefix = "  "
		}
		for _, line := range segLines {
			body.WriteString(prefix)
			body.WriteString(line)
			body.WriteString("\n")
		}
	}

	summary := fmt.Sprintf("%d行追加, %d行削除", insertions, deletions)
	if insertions == 0 && deletions == 0 {
		summary = "差分なし"
	}
	return summary + "\n\n```diff\n" + strings.TrimRight(body.String(), "\n") + "\n```"
}
