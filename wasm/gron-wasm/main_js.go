//go:build js && wasm

// js/wasm専用のJSブリッジ。ネイティブ`go test`ではビルド対象外になる
// (syscall/jsはjs/wasm以外のGOOS/GOARCHでは存在しない)。
package main

import (
	"syscall/js"
)

// jsGronToGron: JSON文字列をgron形式の代入文へ変換する。
func jsGronToGron(this js.Value, args []js.Value) any {
	if len(args) != 1 {
		return "ERROR: gronToGron expects exactly 1 argument"
	}
	result, err := ToGron(args[0].String())
	if err != nil {
		return "ERROR: " + err.Error()
	}
	return result
}

// jsGronFromGron: gron形式の代入文からJSON文字列を復元する(ungron)。
func jsGronFromGron(this js.Value, args []js.Value) any {
	if len(args) != 1 {
		return "ERROR: gronFromGron expects exactly 1 argument"
	}
	result, err := FromGron(args[0].String())
	if err != nil {
		return "ERROR: " + err.Error()
	}
	return result
}

func main() {
	js.Global().Set("gronToGron", js.FuncOf(jsGronToGron))
	js.Global().Set("gronFromGron", js.FuncOf(jsGronFromGron))
	// Goのgoroutineスケジューラを止めないため、mainはブロックしたままにする
	// (wasm_exec.jsの仕様: mainがreturnするとWASMインスタンスがterminateし、
	// グローバルへ登録した関数も呼べなくなる)。
	select {}
}
