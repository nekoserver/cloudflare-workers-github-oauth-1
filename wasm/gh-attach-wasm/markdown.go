// gh-attach-wasm: GitHub CLI(cli/cli) の `gh issue create --attach` が実装する
// Markdown組み立てロジック(internal/attachments/attach.go, userasset.go)を
// ブラウザ実行(js/wasm)向けに移植したもの。
//
// 移植範囲: 実ファイルI/O(os.Open)とHTTP送信(net/http)はブラウザWASMでは
// 動かせないため対象外とし、「本文Markdown中の既存参照を書き換え、未参照の
// 添付は末尾に追記する」という純粋な文字列組み立て部分のみを移植する。
// 実際のアップロード(GitHubへのバイト送信)とIssue作成はCloudflare Workers側
// (サーバー)がユーザーのOAuthトークンで行い、アップロード済みURLが揃った後に
// このWASM関数へ渡す。
//
// cli/cliのreferences.go(goldmarkベースの本格的なMarkdownパーサー、810行)は
// 移植範囲に含めない。ここでの参照検出は「`](filename)` という文字列」を
// 素朴に探す簡易実装であり、ネストした画像リンクやコードブロック内の
// 見せかけの参照など、goldmark実装が正しく除外するエッジケースは扱わない。
//
// このファイルはGOOS/GOARCHに依存しない純粋ロジックのみを置く
// (syscall/jsを使うjs/wasm専用のブリッジ部分はmain_js.goに分離してあり、
// `go test`をネイティブ環境でそのまま実行できるようにするため)。
package main

import (
	"regexp"
	"strings"
)

type attachmentIn struct {
	Filename string `json:"filename"`
	Alt      string `json:"alt"`
	URL      string `json:"url"`
	IsVideo  bool   `json:"isVideo"`
}

type buildRequest struct {
	Body        string         `json:"body"`
	Attachments []attachmentIn `json:"attachments"`
}

// altEscaper: cli/cli internal/attachments/userasset.go の altEscaper と同じ。
// alt text中の `]` `[` `\` や改行がMarkdown画像構文を壊して意図しないURLへ
// リンクを漏らすのを防ぐ。
var altEscaper = strings.NewReplacer(
	`\`, `\\`,
	`[`, `\[`,
	`]`, `\]`,
	"\n", " ",
	"\r", " ",
)

func escapeAlt(s string) string {
	return altEscaper.Replace(s)
}

func imageMarkdown(alt, url string) string {
	return "![" + escapeAlt(alt) + "](" + url + ")"
}

// videoMarkdown: cli/cliのvideoAsset.markdownと同じくbare URLのみ
// (Markdownに動画プレイヤー構文が無いため、GitHub側がURL単体の段落を
// プレイヤーへ昇格させる仕様に合わせる)。
func videoMarkdown(url string) string {
	return url
}

func appendParagraph(body, addition string) string {
	if addition == "" {
		return body
	}
	trimmed := strings.TrimRight(body, " \t\r\n")
	if trimmed == "" {
		return addition
	}
	return trimmed + "\n\n" + addition
}

// buildReferenceRe: `![alt](filename)` 形式の参照を検出する。filenameは
// regexp.QuoteMetaしてから埋め込む。alt部分はキャプチャして書き換え後も
// 利用者が書いたalt textを保持する(cli/cliの「本文にある![alt](./login.png)は
// alt textを保ったままアップロード後のURLに差し替わる」という挙動に合わせる)。
func buildReferenceRe(filename string) *regexp.Regexp {
	return regexp.MustCompile(`!\[([^\]]*)\]\(` + regexp.QuoteMeta(filename) + `\)`)
}

func buildAttachedMarkdown(body string, attachments []attachmentIn) string {
	rewritten := body
	var unreferenced []attachmentIn

	for _, a := range attachments {
		re := buildReferenceRe(a.Filename)
		if !re.MatchString(rewritten) {
			unreferenced = append(unreferenced, a)
			continue
		}
		rewritten = re.ReplaceAllStringFunc(rewritten, func(match string) string {
			sub := re.FindStringSubmatch(match)
			alt := a.Alt
			if len(sub) > 1 && sub[1] != "" {
				alt = sub[1]
			}
			if a.IsVideo {
				return videoMarkdown(a.URL)
			}
			return imageMarkdown(alt, a.URL)
		})
	}

	out := rewritten
	for _, a := range unreferenced {
		if a.IsVideo {
			out = appendParagraph(out, videoMarkdown(a.URL))
		} else {
			out = appendParagraph(out, imageMarkdown(a.Alt, a.URL))
		}
	}
	return out
}
