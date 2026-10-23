///| Workers Builds のログ(BuildKit の plain 出力)を解析し、ステップごとの
/// 処理名・状態・秒数を JSON 文字列で返す。
/// 1つの RUN 命令は、中のシェルコマンドをまとめて1ステップとして数える。
/// 失敗は例外ではなく {"ok":false,"errorCode":...} で返す(呼び出し元の
/// TypeScript が errorCode で分岐する)。

///|
/// JS の Number() と同じ規則で秒数を数値にする(JS バックエンド専用)。
extern "js" fn js_number(s : String) -> Double = "(s) => Number(s)"

///|
let placeholder : String = "（処理名未取得）"

///|
let max_safe_integer : Int64 = 9007199254740991L

///|
let max_steps : Int = 500

///|
let max_label : Int = 1500

///|
priv struct Step {
  id : Int64
  mut label : String
  mut state : String
  mut seconds : Double?
}

///|
priv enum LineResult {
  Continue
  Reused
}

///|
fn is_digit(c : Int) -> Bool {
  c >= 48 && c <= 57
}

///|
fn is_alpha(c : Int) -> Bool {
  (c >= 65 && c <= 90) || (c >= 97 && c <= 122)
}

///|
fn is_word(c : Int) -> Bool {
  is_digit(c) || is_alpha(c) || c == 95
}

///|
/// JS の正規表現 \s と String.prototype.trim が対象にする空白
fn is_space(c : Int) -> Bool {
  match c {
    9 | 10 | 11 | 12 | 13 | 32 | 0xA0 | 0x1680 | 0x2028 | 0x2029 | 0x202F
    | 0x205F | 0x3000 | 0xFEFF => true
    _ => c >= 0x2000 && c <= 0x200A
  }
}

///|
fn cu(s : String, i : Int) -> Int {
  s.code_unit_at(i).to_int()
}

///|
fn slice(s : String, start : Int, end : Int) -> String {
  s.view(start_offset=start, end_offset=end).to_owned()
}

///|
/// ESC [ 数字;... 英字 のエスケープシーケンスを取り除く
fn strip_ansi(s : String) -> String {
  let b = StringBuilder::new()
  let n = s.length()
  let mut i = 0
  while i < n {
    if cu(s, i) == 0x1B && i + 1 < n && cu(s, i + 1) == 91 {
      let mut j = i + 2
      while j < n && (is_digit(cu(s, j)) || cu(s, j) == 59) {
        j += 1
      }
      if j < n && is_alpha(cu(s, j)) {
        i = j + 1
        continue
      }
    }
    b.write_string(slice(s, i, i + 1))
    i += 1
  }
  b.to_string()
}

///|
fn trim(s : String) -> String {
  let mut start = 0
  let mut end = s.length()
  while start < end && is_space(cu(s, start)) {
    start += 1
  }
  while end > start && is_space(cu(s, end - 1)) {
    end -= 1
  }
  slice(s, start, end)
}

///|
/// 改行(\r\n・\n・\r)で行に分ける
fn split_lines(log : String) -> Array[String] {
  let lines = []
  let n = log.length()
  let mut start = 0
  let mut i = 0
  while i < n {
    let c = cu(log, i)
    if c == 13 || c == 10 {
      lines.push(slice(log, start, i))
      if c == 13 && i + 1 < n && cu(log, i + 1) == 10 {
        i += 1
      }
      start = i + 1
    }
    i += 1
  }
  lines.push(slice(log, start, n))
  lines
}

///|
fn starts_with(s : String, prefix : String) -> Bool {
  s.length() >= prefix.length() && slice(s, 0, prefix.length()) == prefix
}

///|
/// prefix で始まり、その直後が単語の境界(英数字・_ 以外か末尾)であるか
fn starts_with_word(s : String, prefix : String) -> Bool {
  starts_with(s, prefix) &&
  (s.length() == prefix.length() || !is_word(cu(s, prefix.length())))
}

///|
/// 行頭の任意のタイムスタンプ(2026-10-22T00:00:00.000Z など)の後ろの位置。無ければ None
fn skip_timestamp(s : String) -> Int? {
  let n = s.length()
  if n < 11 {
    return None
  }
  for k in [0, 1, 2, 3, 5, 6, 8, 9] {
    if !is_digit(cu(s, k)) {
      return None
    }
  }
  if cu(s, 4) != 45 || cu(s, 7) != 45 {
    return None
  }
  let sep = cu(s, 10)
  if sep != 84 && sep != 32 {
    return None
  }
  let mut i = 11
  while i < n && (is_digit(cu(s, i)) || cu(s, i) == 58 || cu(s, i) == 46) {
    i += 1
  }
  if i == 11 {
    return None
  }
  if i < n && cu(s, i) == 90 {
    i += 1
  }
  let ws = i
  while i < n && is_space(cu(s, i)) {
    i += 1
  }
  if i == ws {
    None
  } else {
    Some(i)
  }
}

///|
/// "#番号 本文" を (番号, 本文) にする。番号が大きすぎる行は None
fn parse_step_line(line : String) -> (Int64, String)? {
  let n = line.length()
  let candidates = [0]
  match skip_timestamp(line) {
    Some(p) => candidates.push(p)
    None => ()
  }
  for start in candidates {
    if start >= n || cu(line, start) != 35 {
      continue
    }
    let mut i = start + 1
    let mut id = 0L
    let mut overflow = false
    while i < n && is_digit(cu(line, i)) {
      if id > max_safe_integer {
        overflow = true
      } else {
        id = id * 10L + (cu(line, i) - 48).to_int64()
      }
      i += 1
    }
    if i == start + 1 {
      continue
    }
    let ws = i
    while i < n && is_space(cu(line, i)) {
      i += 1
    }
    if i == ws || i >= n {
      continue
    }
    if overflow || id > max_safe_integer {
      return None
    }
    return Some((id, slice(line, i, n)))
  }
  None
}

///|
/// 終了行(DONE / DONE 1.2s / CACHED / ERROR: / CANCELED)なら (状態, 秒数の文字列)
fn parse_terminal(text : String) -> (String, String?)? {
  if text == "DONE" {
    return Some(("done", None))
  }
  if text == "CACHED" {
    return Some(("cached", None))
  }
  if text == "CANCELED" {
    return Some(("canceled", None))
  }
  if starts_with(text, "ERROR:") {
    return Some(("error", None))
  }
  if starts_with(text, "DONE") {
    let n = text.length()
    let mut i = 4
    while i < n && is_space(cu(text, i)) {
      i += 1
    }
    if i == 4 || n - i < 2 || cu(text, n - 1) != 115 {
      return None
    }
    for k = i; k < n - 1; k = k + 1 {
      if !(is_digit(cu(text, k)) || cu(text, k) == 46) {
        return None
      }
    }
    return Some(("done", Some(slice(text, i, n - 1))))
  }
  None
}

///|
let skip_words : Array[String] = [
  "transferring", "exporting layers", "exporting manifest", "exporting config",
  "naming to", "unpacking to", "pushing layers", "pushing manifest", "writing image",
]

///|
let step_words : Array[String] = [
  "exporting to image", "exporting cache", "importing cache manifest", "building with",
  "resolve image config", "preparing build context",
]

///|
fn is_instruction(text : String) -> Bool {
  if text.length() > 0 && is_digit(cu(text, 0)) {
    return false
  }
  for w in skip_words {
    if starts_with_word(text, w) {
      return false
    }
  }
  if starts_with(text, "[") {
    return true
  }
  for w in step_words {
    if starts_with_word(text, w) {
      return true
    }
  }
  false
}

///|
fn handle_line(steps : Map[Int64, Step], raw : String) -> LineResult {
  let line = trim(strip_ansi(raw))
  guard parse_step_line(line) is Some((id, text)) else { return Continue }
  match parse_terminal(text) {
    Some((state, seconds_text)) => {
      let step = match steps.get(id) {
        Some(s) => s
        None => {
          let s = { id, label: placeholder, state: "running", seconds: None }
          steps[id] = s
          s
        }
      }
      step.state = state
      step.seconds = match seconds_text {
        Some(t) => {
          let v = js_number(t)
          if v.is_nan() || v.is_inf() {
            None
          } else {
            Some(v)
          }
        }
        None => None
      }
      return Continue
    }
    None => ()
  }
  if !is_instruction(text) {
    return Continue
  }
  let label = if text.length() > max_label {
    slice(text, 0, max_label)
  } else {
    text
  }
  match steps.get(id) {
    Some(step) => {
      // 複数の docker 実行が同じ #N を使うことがあるため、無関係な計測を合算しない
      if step.label != placeholder && step.label != label {
        return Reused
      }
      step.label = label
    }
    None => steps[id] = { id, label, state: "running", seconds: None }
  }
  Continue
}

///|
fn json_string(b : StringBuilder, s : String) -> Unit {
  b.write_char('"')
  for i in 0..<s.length() {
    let c = cu(s, i)
    if c == 34 {
      b.write_string("\\\"")
    } else if c == 92 {
      b.write_string("\\\\")
    } else if c < 32 {
      let hex = "0123456789abcdef"
      b.write_string("\\u00")
      b.write_string(slice(hex, c / 16, c / 16 + 1))
      b.write_string(slice(hex, c % 16, c % 16 + 1))
    } else {
      b.write_string(slice(s, i, i + 1))
    }
  }
  b.write_char('"')
}

///|
fn error_json(code : String, detail : String) -> String {
  let b = StringBuilder::new()
  b.write_string("{\"ok\":false,\"errorCode\":")
  json_string(b, code)
  b.write_string(",\"detail\":")
  json_string(b, detail)
  b.write_string("}")
  b.to_string()
}

///|
/// ログ全体を解析して JSON 文字列を返す。
/// 成功: {"ok":true,"steps":[{"id":1,"label":"...","state":"done","seconds":1.5}, ...]}
/// 失敗: {"ok":false,"errorCode":"step_id_reused"|"too_many_steps","detail":"..."}
pub fn analyze_build_log(log : String) -> String {
  let steps : Map[Int64, Step] = Map([])
  for raw in split_lines(log) {
    match handle_line(steps, raw) {
      Reused =>
        return error_json(
          "step_id_reused", "ステップ番号が再使用されています。複数ビルドのログを分離してください",
        )
      Continue => ()
    }
  }
  if steps.length() > max_steps {
    return error_json("too_many_steps", "ステップ数が500件を超えています")
  }
  let list = []
  for _, step in steps {
    list.push(step)
  }
  list.sort_by_key(fn(s) { s.id })
  let b = StringBuilder::new()
  b.write_string("{\"ok\":true,\"steps\":[")
  for i, step in list {
    if i > 0 {
      b.write_char(',')
    }
    b.write_string("{\"id\":")
    b.write_string(step.id.to_string())
    b.write_string(",\"label\":")
    json_string(b, step.label)
    b.write_string(",\"state\":")
    json_string(b, step.state)
    b.write_string(",\"seconds\":")
    match step.seconds {
      Some(v) => b.write_string(js_number_to_json(v))
      None => b.write_string("null")
    }
    b.write_char('}')
  }
  b.write_string("]}")
  b.to_string()
}

///|
/// 秒数を JS と同じ表記(JSON.stringify と同じ)の文字列にする
extern "js" fn js_number_to_json(v : Double) -> String = "(v) => JSON.stringify(v)"
