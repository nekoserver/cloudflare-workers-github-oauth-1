// sqlc-wasm: sqlc (https://sqlc.dev/) の「クエリアノテーション」構文
// (`-- name: GetAuthor :one` のような、SQLファイル中のクエリ1つ1つに
// 名前とコマンド種別を付与するコメント記法。sqlcの`internal/metadata`パッケージが
// 定義する仕様)をパースする部分だけを移植したもの。
//
// 移植範囲: sqlc本体はこのアノテーションを手がかりに、実際のSQL文をPostgreSQL/
// MySQL/SQLiteパーサーで構文解析し、スキーマ情報(カラム型等)と突き合わせて
// Goの構造体・クエリ関数を生成する。データベース接続やSQL方言ごとの構文解析器は
// このブラウザ実行のWASMには含めず、「アノテーション行を検出し、名前・コマンド・
// 行番号を抽出して検証する」というテキスト処理部分のみを移植範囲とする。
//
// このファイルはGOOS/GOARCHに依存しない純粋ロジックのみを置く
// (syscall/jsを使うjs/wasm専用のブリッジ部分はmain_js.goに分離してあり、
// `go test`をネイティブ環境でそのまま実行できるようにするため)。
package main

import (
	"regexp"
	"strings"
)

// validCommands: sqlcのquery annotationが受け付けるコマンド種別
// (https://docs.sqlc.dev/en/latest/reference/query-annotations.html)。
var validCommands = map[string]bool{
	"exec":       true,
	"execrows":   true,
	"execlastid": true,
	"execresult": true,
	"many":       true,
	"one":        true,
	"batchexec":  true,
	"batchmany":  true,
	"batchone":   true,
	"copyfrom":   true,
}

// annotationLineRe: `-- name: <identifier> :<command>` を検出する。
// 前後の空白は許容し、アノテーション行自体の検出は緩く行い、name/cmdの妥当性は
// 別途validateQueryで検証する(不正な行も「アノテーションらしき行」として
// エラー報告できるようにするため)。
var annotationLineRe = regexp.MustCompile(`^--\s*name:\s*(\S*)\s*:(\S*)\s*$`)

// identifierRe: sqlcが要求するクエリ名の形式(Goの識別子として妥当な文字列)。
var identifierRe = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

type queryAnnotation struct {
	Name    string `json:"name"`
	Command string `json:"command"`
	Line    int    `json:"line"`
	SQL     string `json:"sql"`
}

type annotationError struct {
	Line    int    `json:"line"`
	Message string `json:"message"`
}

type parseResult struct {
	Queries []queryAnnotation `json:"queries"`
	Errors  []annotationError `json:"errors"`
}

// parseQueryAnnotations: SQLファイル全体のテキストを受け取り、`-- name: ... :...`
// 行ごとにクエリを分割する。1つのクエリのSQL本体は、そのアノテーション行の次の行
// から、次のアノテーション行の直前(またはファイル末尾)までとし、前後の空行を
// トリムする。
func parseQueryAnnotations(input string) parseResult {
	lines := strings.Split(strings.ReplaceAll(input, "\r\n", "\n"), "\n")

	type pending struct {
		name    string
		cmd     string
		line    int
		bodyBeg int
	}

	var cur *pending
	var result parseResult
	seenNames := map[string]int{}

	flush := func(bodyEnd int) {
		if cur == nil {
			return
		}
		body := strings.TrimSpace(strings.Join(lines[cur.bodyBeg:bodyEnd], "\n"))
		result.Queries = append(result.Queries, queryAnnotation{
			Name:    cur.name,
			Command: cur.cmd,
			Line:    cur.line,
			SQL:     body,
		})
		cur = nil
	}

	for i, raw := range lines {
		trimmed := strings.TrimRight(raw, " \t")
		if !strings.HasPrefix(strings.TrimSpace(trimmed), "-- name:") {
			continue
		}

		lineNo := i + 1
		m := annotationLineRe.FindStringSubmatch(trimmed)
		if m == nil {
			flush(i)
			result.Errors = append(result.Errors, annotationError{
				Line:    lineNo,
				Message: "アノテーションの形式が不正です(`-- name: <名前> :<コマンド>` である必要があります)",
			})
			continue
		}

		name, cmd := m[1], m[2]
		flush(i)

		if name == "" {
			result.Errors = append(result.Errors, annotationError{Line: lineNo, Message: "クエリ名が空です"})
			continue
		}
		if !identifierRe.MatchString(name) {
			result.Errors = append(result.Errors, annotationError{Line: lineNo, Message: "クエリ名 " + name + " は識別子として不正です"})
			continue
		}
		if prevLine, dup := seenNames[name]; dup {
			result.Errors = append(result.Errors, annotationError{Line: lineNo, Message: "クエリ名 " + name + " は" + itoa(prevLine) + "行目と重複しています"})
			continue
		}
		if !validCommands[cmd] {
			result.Errors = append(result.Errors, annotationError{Line: lineNo, Message: "コマンド :" + cmd + " は不明です"})
			continue
		}

		seenNames[name] = lineNo
		cur = &pending{name: name, cmd: cmd, line: lineNo, bodyBeg: i + 1}
	}
	flush(len(lines))

	if result.Queries == nil {
		result.Queries = []queryAnnotation{}
	}
	if result.Errors == nil {
		result.Errors = []annotationError{}
	}
	return result
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf []byte
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

// escapeCell: Markdownテーブルのセル内で`|`と改行が表を壊すのを防ぐ
// (CLAUDE.mdルール16: 罫線・ツリー文字を使わずMarkdownテーブルで統一する)。
func escapeCell(s string) string {
	s = strings.ReplaceAll(s, "|", `\|`)
	s = strings.ReplaceAll(s, "\n", " ")
	return s
}

// formatResultMarkdown: parseResultをMarkdownテーブルへ整形する。
func formatResultMarkdown(r parseResult) string {
	var b strings.Builder
	b.WriteString("| 行 | 名前 | コマンド | SQL |\n")
	b.WriteString("|---|---|---|---|\n")
	for _, q := range r.Queries {
		sqlOneLine := strings.Join(strings.Fields(q.SQL), " ")
		b.WriteString("| ")
		b.WriteString(itoa(q.Line))
		b.WriteString(" | ")
		b.WriteString(escapeCell(q.Name))
		b.WriteString(" | :")
		b.WriteString(escapeCell(q.Command))
		b.WriteString(" | ")
		b.WriteString(escapeCell(sqlOneLine))
		b.WriteString(" |\n")
	}
	if len(r.Errors) > 0 {
		b.WriteString("\nエラー:\n\n")
		b.WriteString("| 行 | 内容 |\n")
		b.WriteString("|---|---|\n")
		for _, e := range r.Errors {
			b.WriteString("| ")
			b.WriteString(itoa(e.Line))
			b.WriteString(" | ")
			b.WriteString(escapeCell(e.Message))
			b.WriteString(" |\n")
		}
	}
	return b.String()
}
