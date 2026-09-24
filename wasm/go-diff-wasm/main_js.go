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
	// サーバー側(Cloudflare Workers)からの利用向け: go.run(instance)はmain()が
	// returnするまで解決しないPromiseを返すため、呼び出し元(JS)はgoDiffText等の
	// グローバル関数がまだ登録されていないタイミングで呼んでしまう恐れがある。
	// JS側が`globalThis.__goDiffWasmReady`に関数を用意していれば、登録完了直後に
	// 呼び出して合図する(ブラウザページ側はこのグローバルを定義しないため、
	// Type()がFuncでない場合は何もしない後方互換の分岐)。
	ready := js.Global().Get("__goDiffWasmReady")
	if ready.Type() == js.TypeFunction {
		ready.Invoke()
	}
	// Goのgoroutineスケジューラを止めないため、mainはブロックしたままにする
	// (wasm_exec.jsの仕様: mainがreturnするとWASMインスタンスがterminateし、
	// グローバルへ登録した関数も呼べなくなる)。
	select {}
}
