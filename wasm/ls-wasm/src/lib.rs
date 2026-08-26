use wasm_bindgen::prelude::*;

/// 呼び出し側(JS)から渡す1エントリ分の情報。Workers上には実ファイルシステムが
/// 無いため、一覧対象(名前・種別・サイズ・更新日)はすべて呼び出し側が用意した
/// 仮想データ(例: WASM_MODULE_REGISTRY)から組み立てる。
struct Entry {
    name: String,
    is_dir: bool,
    size: u64,
    mtime: String,
}

/// TSV1行("name\ttype\tsize\tmtime")をEntryへ変換する。typeは'd'(ディレクトリ)
/// または'-'(通常ファイル)のみを許可し、想定外の値は明示的にエラーにする
/// (呼び出し側のバグを握りつぶさず早期に検出するため)。
fn parse_entry_line(line: &str) -> Result<Entry, String> {
    let fields: Vec<&str> = line.split('\t').collect();
    if fields.len() != 4 {
        return Err(format!(
            "不正なエントリ行です(name\\ttype\\tsize\\mtimeの4フィールド必須): {}",
            line
        ));
    }
    let name = fields[0].to_string();
    let is_dir = match fields[1] {
        "d" => true,
        "-" => false,
        other => return Err(format!("種別は'd'または'-'である必要があります: {}", other)),
    };
    let size: u64 = fields[2]
        .parse()
        .map_err(|_| format!("サイズが数値ではありません: {}", fields[2]))?;
    let mtime = fields[3].to_string();
    if name.is_empty() {
        return Err("名前が空のエントリがあります".to_string());
    }
    Ok(Entry { name, is_dir, size, mtime })
}

/// 改行区切りのTSV全体をパースする。空行は無視する。
fn parse_entries(input: &str) -> Result<Vec<Entry>, String> {
    input
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(parse_entry_line)
        .collect()
}

/// GNU coreutilsのlsコマンドと同じく、名前が'.'で始まるエントリは
/// show_all(-a相当)が指定されない限り一覧から除外する。
fn visible_entries(entries: Vec<Entry>, show_all: bool) -> Vec<Entry> {
    if show_all {
        entries
    } else {
        entries.into_iter().filter(|e| !e.name.starts_with('.')).collect()
    }
}

/// GNU coreutilsのls -lと同じ形式(パーミッション風の固定表記 リンク数 所有者 グループ
/// サイズ 更新日 名前)で長形式出力を組み立てる。このディレクトリは実ファイルシステム
/// 由来ではないため、パーミッション・リンク数・所有者・グループは実データを持たず
/// 固定のプレースホルダ("neko")を使う(実在するかのように装う数値を捏造しない)。
fn format_long(entries: &[Entry]) -> String {
    let size_width = entries
        .iter()
        .map(|e| e.size.to_string().len())
        .max()
        .unwrap_or(1);
    entries
        .iter()
        .map(|e| {
            let perm = if e.is_dir { "drwxr-xr-x" } else { "-rw-r--r--" };
            format!(
                "{} 1 neko neko {:>width$} {} {}",
                perm,
                e.size,
                e.mtime,
                e.name,
                width = size_width
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// 短形式(オプション無し)出力。ttyではない出力(パイプ/コードブロック埋め込み等)に
/// 対するGNU lsのデフォルト書式と同じく、1行1エントリで名前だけを列挙する。
fn format_short(entries: &[Entry]) -> String {
    entries.iter().map(|e| e.name.clone()).collect::<Vec<_>>().join("\n")
}

/// ls_format()の実処理。JsValueに依存しない純Rust関数にすることで、
/// wasm-bindgenの型をネイティブの`cargo test`から直接呼べるようにする
/// (JsValueはwasm32ターゲット向けの外部参照であり、ネイティブテストバイナリで
/// 生成するとabortする)。
fn ls_format_impl(entries: &str, long: bool, show_all: bool) -> Result<String, String> {
    let parsed = parse_entries(entries)?;
    let mut visible = visible_entries(parsed, show_all);
    visible.sort_by(|a, b| a.name.cmp(&b.name));
    if visible.is_empty() {
        return Ok(String::new());
    }
    Ok(if long { format_long(&visible) } else { format_short(&visible) })
}

/// GNU coreutilsのlsコマンドを模した一覧整形。entriesは
/// "name\ttype\tsize\tmtime" 形式のTSVを改行区切りで並べたもの
/// (typeは'd'または'-')。長さ0件(全件が-aで除外された場合含む)なら空文字列を返す。
#[wasm_bindgen]
pub fn ls_format(entries: &str, long: bool, show_all: bool) -> Result<String, JsValue> {
    ls_format_impl(entries, long, show_all).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 短形式は名前のみを名前順に1行ずつ返す() {
        let input = "b.wasm\t-\t100\t2026-08-20\na.wasm\t-\t200\t2026-08-20";
        let out = ls_format_impl(input, false, false).unwrap();
        assert_eq!(out, "a.wasm\nb.wasm");
    }

    #[test]
    fn 長形式はパーミッション風表記_サイズ_更新日_名前を含む() {
        let input = "sha256_bg.wasm\t-\t25600\t2026-08-20";
        let out = ls_format_impl(input, true, false).unwrap();
        assert!(out.starts_with("-rw-r--r-- 1 neko neko 25600 2026-08-20 sha256_bg.wasm"));
    }

    #[test]
    fn ディレクトリはd始まりのパーミッション表記になる() {
        let input = "wasm\td\t0\t2026-08-20";
        let out = ls_format_impl(input, true, false).unwrap();
        assert!(out.starts_with("drwxr-xr-x"));
    }

    #[test]
    fn ドット始まりの名前はshow_all未指定なら除外される() {
        let input = ".hidden\t-\t1\t2026-08-20\nvisible\t-\t1\t2026-08-20";
        let out = ls_format_impl(input, false, false).unwrap();
        assert_eq!(out, "visible");
    }

    #[test]
    fn show_all指定でドット始まりの名前も含まれる() {
        let input = ".hidden\t-\t1\t2026-08-20\nvisible\t-\t1\t2026-08-20";
        let out = ls_format_impl(input, false, true).unwrap();
        assert_eq!(out, ".hidden\nvisible");
    }

    #[test]
    fn 空行だけの入力は空文字列を返す() {
        let out = ls_format_impl("", false, false).unwrap();
        assert_eq!(out, "");
    }

    #[test]
    fn フィールド数が不正な行はエラーになる() {
        let err = ls_format_impl("bad-line-without-tabs", false, false);
        assert!(err.is_err());
    }

    #[test]
    fn 種別が不正な行はエラーになる() {
        let err = ls_format_impl("name\tx\t1\t2026-08-20", false, false);
        assert!(err.is_err());
    }

    #[test]
    fn 長形式のサイズ列はエントリ内最大桁数で右揃えされる() {
        let input = "a\t-\t5\t2026-08-20\nb\t-\t12345\t2026-08-20";
        let out = ls_format_impl(input, true, false).unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("neko     5 2026-08-20 a"));
        assert!(lines[1].contains("neko 12345 2026-08-20 b"));
    }
}
