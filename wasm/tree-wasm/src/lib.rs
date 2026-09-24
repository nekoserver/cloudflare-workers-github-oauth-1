use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[derive(Default)]
struct Node {
    is_file: bool,
    timestamp: Option<i64>,
    children: BTreeMap<String, Node>,
}

#[derive(Default)]
struct Options<'a> {
    pattern: Option<&'a str>,
    files_only: bool,
    directories_only: bool,
    include_hidden: bool,
    sort_time: bool,
    reverse: bool,
}

fn wildcard_matches(pattern: &str, value: &str) -> bool {
    // `/neko tree --pattern MCP` is also used as a case-insensitive keyword
    // filter.  Keep the tree(1)-style whole-name matching only when an actual
    // wildcard was supplied (the TypeScript parity adapter follows the same
    // contract).
    if !pattern.as_bytes().iter().any(|byte| matches!(byte, b'*' | b'?')) {
        return value.to_lowercase().contains(&pattern.to_lowercase());
    }
    let (p, v) = (pattern.as_bytes(), value.as_bytes());
    let (mut pi, mut vi, mut star, mut retry) = (0, 0, None, 0);
    while vi < v.len() {
        if pi < p.len() && (p[pi] == b'?' || p[pi].eq_ignore_ascii_case(&v[vi])) {
            pi += 1;
            vi += 1;
        } else if pi < p.len() && p[pi] == b'*' {
            star = Some(pi);
            pi += 1;
            retry = vi;
        } else if let Some(si) = star {
            pi = si + 1;
            retry += 1;
            vi = retry;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == b'*' {
        pi += 1;
    }
    pi == p.len()
}

fn has_match(node: &Node, options: &Options, files_only: bool) -> bool {
    node.children.iter().any(|(name, child)| {
        ((!files_only || child.is_file)
            && options.pattern.map_or(true, |p| wildcard_matches(p, name)))
            || (!child.is_file && has_match(child, options, files_only))
    })
}

fn render_children(
    node: &Node,
    depth: u32,
    max_depth: u32,
    options: &Options,
    output: &mut Vec<String>,
) {
    if depth > max_depth {
        return;
    }
    let mut children: Vec<_> = node
        .children
        .iter()
        .filter(|(name, child)| {
            if options.files_only && !child.is_file && !has_match(child, options, true) {
                return false;
            }
            if options.directories_only && child.is_file {
                return false;
            }
            options.pattern.map_or(true, |p| wildcard_matches(p, name))
                || (!child.is_file && has_match(child, options, options.files_only))
        })
        .collect();
    children.sort_by(|(an, a), (bn, b)| {
        let order = if options.sort_time {
            b.timestamp
                .unwrap_or(i64::MIN)
                .cmp(&a.timestamp.unwrap_or(i64::MIN))
                .then_with(|| an.cmp(bn))
        } else {
            an.cmp(bn)
        };
        if options.reverse {
            order.reverse()
        } else {
            order
        }
    });
    for (name, child) in children {
        output.push(format!(
            "{}- {}{}",
            "  ".repeat(depth as usize),
            name,
            if child.is_file { "" } else { "/" }
        ));
        if !child.is_file {
            render_children(child, depth + 1, max_depth, options, output);
        }
    }
}

fn tree_format_impl(
    entries: &str,
    root_label: &str,
    max_depth: u32,
    options: &Options,
) -> Result<String, String> {
    if root_label.trim().is_empty() {
        return Err("ルート名は空にできません".into());
    }
    if options.files_only && options.directories_only {
        return Err("--files-only と --dirs-only は同時に指定できません".into());
    }
    let mut root = Node::default();
    for line in entries.lines().filter(|line| !line.trim().is_empty()) {
        let fields: Vec<_> = line.split('\t').collect();
        if !(2..=3).contains(&fields.len()) {
            return Err(format!("不正なエントリです: {line}"));
        }
        let (path, kind) = (fields[0], fields[1]);
        let parts: Vec<_> = path.split('/').collect();
        if parts
            .iter()
            .any(|part| part.is_empty() || *part == "." || *part == "..")
        {
            return Err(format!("不正なパスです: {path}"));
        }
        if !options.include_hidden && parts.iter().any(|part| part.starts_with('.')) {
            continue;
        }
        let is_file = match kind {
            "blob" | "commit" => true,
            "tree" => false,
            _ => return Err(format!("不正な種別です: {kind}")),
        };
        let timestamp = if fields.len() == 3 && !fields[2].is_empty() {
            Some(
                fields[2]
                    .parse::<i64>()
                    .map_err(|_| format!("不正なタイムスタンプです: {}", fields[2]))?,
            )
        } else {
            None
        };
        let mut current = &mut root;
        for (index, part) in parts.iter().enumerate() {
            current = current.children.entry((*part).to_string()).or_default();
            if index + 1 == parts.len() {
                current.is_file = is_file;
                current.timestamp = timestamp;
            }
        }
    }
    let mut output = vec![format!("- {}/", root_label.trim_end_matches('/'))];
    render_children(&root, 1, max_depth, options, &mut output);
    Ok(output.join("\n"))
}

#[wasm_bindgen]
pub fn tree_format(entries: &str, root_label: &str, max_depth: u32) -> Result<String, JsValue> {
    tree_format_impl(entries, root_label, max_depth, &Options::default())
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn tree_format_with_options(
    entries: &str,
    root_label: &str,
    max_depth: u32,
    pattern: &str,
    files_only: bool,
    directories_only: bool,
    include_hidden: bool,
    sort_time: bool,
    reverse: bool,
) -> Result<String, JsValue> {
    let options = Options {
        pattern: if pattern.is_empty() {
            None
        } else {
            Some(pattern)
        },
        files_only,
        directories_only,
        include_hidden,
        sort_time,
        reverse,
    };
    tree_format_impl(entries, root_label, max_depth, &options).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn 名前順のmarkdownツリーへ変換する() {
        let input = "src/index.ts\tblob\nREADME.md\tblob\nsrc\ttree";
        assert_eq!(
            tree_format_impl(input, "owner/repo", 10, &Options::default()).unwrap(),
            "- owner/repo/\n  - README.md\n  - src/\n    - index.ts"
        );
    }
    #[test]
    fn フィルタとファイル限定を適用する() {
        let input = "src\ttree\nsrc/lib.rs\tblob\nsrc/app.ts\tblob\nREADME.md\tblob";
        let options = Options {
            pattern: Some("*.rs"),
            files_only: true,
            ..Options::default()
        };
        assert_eq!(
            tree_format_impl(input, "repo", 3, &options).unwrap(),
            "- repo/\n  - src/\n    - lib.rs"
        );
    }
    #[test]
    fn タイムスタンプの新しい順と逆順に並べる() {
        let input = "old.txt\tblob\t10\nnew.txt\tblob\t20";
        let options = Options {
            sort_time: true,
            ..Options::default()
        };
        assert!(
            tree_format_impl(input, "repo", 1, &options)
                .unwrap()
                .find("new.txt")
                < tree_format_impl(input, "repo", 1, &options)
                    .unwrap()
                    .find("old.txt")
        );
        let reverse = Options {
            sort_time: true,
            reverse: true,
            ..Options::default()
        };
        assert!(
            tree_format_impl(input, "repo", 1, &reverse)
                .unwrap()
                .find("old.txt")
                < tree_format_impl(input, "repo", 1, &reverse)
                    .unwrap()
                    .find("new.txt")
        );
    }
    #[test]
    fn 隠しファイルの表示を選べる() {
        let input = ".env\tblob\nsrc\ttree";
        assert!(!tree_format_impl(input, "repo", 2, &Options::default())
            .unwrap()
            .contains(".env"));
        let options = Options {
            include_hidden: true,
            ..Options::default()
        };
        assert!(tree_format_impl(input, "repo", 2, &options)
            .unwrap()
            .contains(".env"));
    }

    #[test]
    fn ワイルドカードなしのパターンは大文字小文字を無視して部分一致する() {
        let input = "docs\ttree\ndocs/MCP-guide.md\tblob\ndocs/other.md\tblob";
        let options = Options {
            pattern: Some("mcp"),
            files_only: true,
            ..Options::default()
        };
        assert_eq!(
            tree_format_impl(input, "repo", 3, &options).unwrap(),
            "- repo/\n  - docs/\n    - MCP-guide.md"
        );
    }

    #[test]
    fn 不正入力と排他的オプションを拒否する() {
        for input in ["../secret\tblob", "a//b\tblob", "file\tunknown", "file\tblob\tnow"] {
            assert!(tree_format_impl(input, "repo", 2, &Options::default()).is_err());
        }
        let options = Options {
            files_only: true,
            directories_only: true,
            ..Options::default()
        };
        assert!(tree_format_impl("file\tblob", "repo", 2, &options).is_err());
    }
}
