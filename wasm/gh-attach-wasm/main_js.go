//go:build js && wasm

// js/wasm専用のJSブリッジ。ネイティブ`go test`ではビルド対象外になる
// (syscall/jsはjs/wasm以外のGOOS/GOARCHでは存在しない)。
package main

import (
	"encoding/json"
	"syscall/js"
)

// jsBuildAttachedMarkdown: JSから呼ぶエントリポイント。
// 引数1個(JSON文字列)を取り、結果のMarkdown文字列を返す。
// 入力が不正なJSONの場合はエラーメッセージを "ERROR: " 接頭辞付きで返す
// (例外を投げるとjs.FuncOf経由の呼び出し側でのハンドリングが煩雑になるため、
// 呼び出し元が戻り値の接頭辞を見て分岐できるようにする)。
func jsBuildAttachedMarkdown(this js.Value, args []js.Value) any {
	if len(args) != 1 {
		return "ERROR: buildAttachedMarkdown expects exactly 1 argument"
	}
	var req buildRequest
	if err := json.Unmarshal([]byte(args[0].String()), &req); err != nil {
		return "ERROR: invalid JSON: " + err.Error()
	}
	return buildAttachedMarkdown(req.Body, req.Attachments)
}

func main() {
	js.Global().Set("ghAttachBuildMarkdown", js.FuncOf(jsBuildAttachedMarkdown))
	// Goのgoroutineスケジューラを止めないため、mainはブロックしたままにする
	// (wasm_exec.jsの仕様: mainがreturnするとWASMインスタンスがterminateし、
	// グローバルへ登録した関数も呼べなくなる)。
	select {}
}
