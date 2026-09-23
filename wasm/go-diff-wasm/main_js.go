//go:build js && wasm

// js/wasm専用のJSブリッジ。ネイティブ`go test`ではビルド対象外になる
// (syscall/jsはjs/wasm以外のGOOS/GOARCHでは存在しない)。
package main

import (
	"syscall/js"
)

// jsGoDiffText: 2つのテキストの行単位差分をMarkdown(```diff フェンス付き)で返す。
func jsGoDiffText(this js.Value, args []js.Value) any {
	if len(args) != 2 {
		return "ERROR: goDiffText expects exactly 2 arguments"
	}
	return DiffText(args[0].String(), args[1].String())
}

func main() {
	js.Global().Set("goDiffText", js.FuncOf(jsGoDiffText))
	// Goのgoroutineスケジューラを止めないため、mainはブロックしたままにする
	// (wasm_exec.jsの仕様: mainがreturnするとWASMインスタンスがterminateし、
	// グローバルへ登録した関数も呼べなくなる)。
	select {}
}
