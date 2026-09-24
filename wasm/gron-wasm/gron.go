// gron-wasm: gron(https://github.com/tomnomnom/gron)の中核である
// 「JSON ⇔ 代入文の並び」の相互変換だけを移植したもの。
//
// 移植範囲: `json = {};` / `json.a.b[0] = 1;` のような、パス付き代入文への
// 変換(ToGron)とその逆変換(FromGron)というテキスト処理のみ。gron本体が持つ
// HTTPリクエスト実行(URLを直接fetchしてgronへ変換する機能)、ファイル監視、
// ANSIカラー出力、`grep`との連携を前提にしたCLI引数解析は対象外とする
// (このリポジトリのブラウザ/Workers向けWASMでは、入力はテキストとして
// 渡され、出力もテキストとして返るだけの純粋関数にする)。
//
// このファイルはGOOS/GOARCHに依存しない純粋ロジックのみを置く
// (syscall/jsを使うjs/wasm専用のブリッジ部分はmain_js.goに分離してあり、
// `go test`をネイティブ環境でそのまま実行できるようにするため。sqlc-wasm
// と同じ構成)。
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

func identStartOK(b byte) bool {
	return b == '_' || (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func identCharOK(b byte) bool {
	return identStartOK(b) || (b >= '0' && b <= '9')
}

// isIdent: パスセグメントをドット記法(`json.key`)で書けるキーかどうか。
// 書けない場合(空文字・記号・数字始まり等)はブラケット記法
// (`json["some-key"]`)にフォールバックする。
func isIdent(s string) bool {
	if s == "" || !identStartOK(s[0]) {
		return false
	}
	for i := 1; i < len(s); i++ {
		if !identCharOK(s[i]) {
			return false
		}
	}
	return true
}

func jsonQuote(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func joinKey(path, key string) string {
	if isIdent(key) {
		return path + "." + key
	}
	return path + "[" + jsonQuote(key) + "]"
}

// ToGron: JSON文字列を、gron形式の代入文の並び(1行1代入、末尾`;`付き)へ
// 変換する。オブジェクト・配列はキーをソートして決定的な順序で出力する
// (Goのmapイテレーション順は非決定的なため)。数値は`encoding/json`の
// `UseNumber`で元のテキスト表現のまま保持し、`1.0`が`1`に化ける等の
// 精度劣化を防ぐ。
func ToGron(jsonText string) (string, error) {
	dec := json.NewDecoder(strings.NewReader(jsonText))
	dec.UseNumber()
	var value interface{}
	if err := dec.Decode(&value); err != nil {
		return "", fmt.Errorf("invalid JSON: %w", err)
	}
	var out bytes.Buffer
	writeGron(&out, "json", value)
	return strings.TrimRight(out.String(), "\n"), nil
}

func writeGron(out *bytes.Buffer, path string, value interface{}) {
	switch v := value.(type) {
	case map[string]interface{}:
		fmt.Fprintf(out, "%s = {};\n", path)
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			writeGron(out, joinKey(path, k), v[k])
		}
	case []interface{}:
		fmt.Fprintf(out, "%s = [];\n", path)
		for i, item := range v {
			writeGron(out, fmt.Sprintf("%s[%d]", path, i), item)
		}
	case string:
		fmt.Fprintf(out, "%s = %s;\n", path, jsonQuote(v))
	case json.Number:
		fmt.Fprintf(out, "%s = %s;\n", path, v.String())
	case bool:
		fmt.Fprintf(out, "%s = %t;\n", path, v)
	case nil:
		fmt.Fprintf(out, "%s = null;\n", path)
	}
}

type pathSeg struct {
	key     string
	isIndex bool
	index   int
}

// parsePath: `json.a.b[0]["weird key"]` のようなパス式を、
// ルート名(`json`)とセグメントの列へ分解する。
func parsePath(expr string) (root string, segs []pathSeg, err error) {
	i, n := 0, len(expr)
	start := i
	for i < n && identCharOK(expr[i]) {
		i++
	}
	if i == start {
		return "", nil, fmt.Errorf("invalid path: %q", expr)
	}
	root = expr[start:i]
	for i < n {
		switch expr[i] {
		case '.':
			i++
			start = i
			for i < n && identCharOK(expr[i]) {
				i++
			}
			if i == start {
				return "", nil, fmt.Errorf("invalid path segment in %q", expr)
			}
			segs = append(segs, pathSeg{key: expr[start:i]})
		case '[':
			i++
			if i < n && expr[i] == '"' {
				strStart := i
				i++
				for i < n && expr[i] != '"' {
					if expr[i] == '\\' && i+1 < n {
						i++
					}
					i++
				}
				if i >= n {
					return "", nil, fmt.Errorf("unterminated bracket string in %q", expr)
				}
				raw := expr[strStart : i+1]
				i++
				var key string
				if err := json.Unmarshal([]byte(raw), &key); err != nil {
					return "", nil, fmt.Errorf("invalid bracket key in %q: %w", expr, err)
				}
				if i >= n || expr[i] != ']' {
					return "", nil, fmt.Errorf("expected ']' in %q", expr)
				}
				i++
				segs = append(segs, pathSeg{key: key})
			} else {
				numStart := i
				for i < n && expr[i] >= '0' && expr[i] <= '9' {
					i++
				}
				if i == numStart || i >= n || expr[i] != ']' {
					return "", nil, fmt.Errorf("invalid index in %q", expr)
				}
				idx, convErr := strconv.Atoi(expr[numStart:i])
				if convErr != nil {
					return "", nil, fmt.Errorf("invalid index in %q: %w", expr, convErr)
				}
				i++
				segs = append(segs, pathSeg{isIndex: true, index: idx})
			}
		default:
			return "", nil, fmt.Errorf("unexpected character %q in path %q", string(expr[i]), expr)
		}
	}
	return root, segs, nil
}

// setPath: containerのsegsが指す位置にvalueを設定した結果を返す
// (mapとsliceは参照型だが、sliceは再割り当てが必要な場合があるため
// 新しいcontainerを毎回返す関数型で実装する)。
func setPath(container interface{}, segs []pathSeg, value interface{}) (interface{}, error) {
	seg := segs[0]
	rest := segs[1:]
	if seg.isIndex {
		var arr []interface{}
		switch existing := container.(type) {
		case nil:
			arr = []interface{}{}
		case []interface{}:
			arr = existing
		default:
			return nil, fmt.Errorf("expected array, got %T", container)
		}
		for len(arr) <= seg.index {
			arr = append(arr, nil)
		}
		if len(rest) == 0 {
			arr[seg.index] = value
		} else {
			updated, err := setPath(arr[seg.index], rest, value)
			if err != nil {
				return nil, err
			}
			arr[seg.index] = updated
		}
		return arr, nil
	}
	var obj map[string]interface{}
	switch existing := container.(type) {
	case nil:
		obj = map[string]interface{}{}
	case map[string]interface{}:
		obj = existing
	default:
		return nil, fmt.Errorf("expected object, got %T", container)
	}
	if len(rest) == 0 {
		obj[seg.key] = value
	} else {
		updated, err := setPath(obj[seg.key], rest, value)
		if err != nil {
			return nil, err
		}
		obj[seg.key] = updated
	}
	return obj, nil
}

// FromGron: ToGronの逆変換(ungron)。gron形式の代入文の並びから元のJSONを
// 復元する。入力は通常のgron出力の順序(親のコンテナ宣言が子より先)を
// 前提にする。空行はスキップする。
func FromGron(gronText string) (string, error) {
	var root interface{}
	haveRoot := false
	rootName := ""
	for lineNo, rawLine := range strings.Split(gronText, "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		line = strings.TrimSuffix(line, ";")
		eq := strings.Index(line, " = ")
		if eq < 0 {
			return "", fmt.Errorf("line %d: missing ' = ': %q", lineNo+1, rawLine)
		}
		pathExpr := strings.TrimSpace(line[:eq])
		valueExpr := strings.TrimSpace(line[eq+len(" = "):])
		name, segs, err := parsePath(pathExpr)
		if err != nil {
			return "", fmt.Errorf("line %d: %w", lineNo+1, err)
		}
		if !haveRoot {
			rootName = name
			haveRoot = true
		} else if name != rootName {
			return "", fmt.Errorf("line %d: root name %q does not match %q", lineNo+1, name, rootName)
		}
		dec := json.NewDecoder(strings.NewReader(valueExpr))
		dec.UseNumber()
		var value interface{}
		if err := dec.Decode(&value); err != nil {
			return "", fmt.Errorf("line %d: invalid value %q: %w", lineNo+1, valueExpr, err)
		}
		if len(segs) == 0 {
			root = value
			continue
		}
		updated, err := setPath(root, segs, value)
		if err != nil {
			return "", fmt.Errorf("line %d: %w", lineNo+1, err)
		}
		root = updated
	}
	if !haveRoot {
		return "", fmt.Errorf("no assignments found")
	}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal error: %w", err)
	}
	return string(out), nil
}
