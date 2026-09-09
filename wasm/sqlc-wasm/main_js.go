//go:build js && wasm

// js/wasm専用のJSブリッジ。ネイティブ`go test`ではビルド対象外になる
// (syscall/jsはjs/wasm以外のGOOS/GOARCHでは存在しない)。
package main

import (
	"syscall/js"
)

// jsParseQueryAnnotations: JSから呼ぶエントリポイント。
// 引数1個(SQLファイルのテキスト)を取り、Markdownテーブルに整形した
// 結果を返す。
func jsParseQueryAnnotations(this js.Value, args []js.Value) any {
	if len(args) != 1 {
		return "ERROR: sqlcParseQueryAnnotations expects exactly 1 argument"
	}
	result := parseQueryAnnotations(args[0].String())
	return formatResultMarkdown(result)
}

func main() {
	js.Global().Set("sqlcParseQueryAnnotations", js.FuncOf(jsParseQueryAnnotations))
	// Goのgoroutineスケジューラを止めないため、mainはブロックしたままにする
	// (wasm_exec.jsの仕様: mainがreturnするとWASMインスタンスがterminateし、
	// グローバルへ登録した関数も呼べなくなる)。
	select {}
}
