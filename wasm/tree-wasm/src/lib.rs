use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[derive(Default)]
struct Node {
    is_file: bool,
    children: BTreeMap<String, Node>,
}

fn insert_path(root: &mut Node, path: &str, is_file: bool) -> Result<(), String> {
    let path = path.trim_matches('/');
    if path.is_empty() {
        return Err("空のパスは指定できません".to_string());
    }
    let mut current = root;
    let mut parts = path.split('/').peekable();
    while let Some(part) = parts.next() {
        if part.is_empty() || part == "." || part == ".." {
            return Err(format!("不正なパスです: {path}"));
        }
        current = current.children.entry(part.to_string()).or_default();
        if parts.peek().is_none() {
            current.is_file = is_file;
        }
    }
    Ok(())
}

fn render_children(node: &Node, depth: u32, max_depth: u32, output: &mut Vec<String>) {
    if depth > max_depth {
        return;
    }
    for (name, child) in &node.children {
        output.push(format!(
            "{}- {}{}",
            "  ".repeat(depth as usize),
            name,
            if child.is_file { "" } else { "/" }
        ));
        if !child.is_file {
            render_children(child, depth + 1, max_depth, output);
        }
    }
}

/// GitHub Trees API由来のTSV (`path\ttree|blob`) を、Markdownの入れ子リストへ整形する。
/// ネットワークアクセスとOAuthはWorker側が担当し、WASMは純粋なツリー構築だけを担う。
fn tree_format_impl(
    entries: &str,
    root_label: &str,
    max_depth: u32,
    show_hidden: bool,
) -> Result<String, String> {
    if root_label.trim().is_empty() {
        return Err("ルート名は空にできません".to_string());
    }
    let mut root = Node::default();
    for line in entries.lines().filter(|line| !line.trim().is_empty()) {
        let (path, kind) = line
            .split_once('\t')
            .ok_or_else(|| format!("不正なエントリです: {line}"))?;
        if path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        {
            return Err(format!("不正なパスです: {path}"));
        }
        if !show_hidden && path.split('/').any(|part| part.starts_with('.')) {
            continue;
        }
        let is_file = match kind {
            "blob" | "commit" => true,
            "tree" => false,
            _ => return Err(format!("不正な種別です: {kind}")),
        };
        insert_path(&mut root, path, is_file)?;
    }
    let mut output = vec![format!("- {}/", root_label.trim_end_matches('/'))];
    render_children(&root, 1, max_depth, &mut output);
    Ok(output.join("\n"))
}

#[wasm_bindgen]
pub fn tree_format(
    entries: &str,
    root_label: &str,
    max_depth: u32,
    show_hidden: bool,
) -> Result<String, JsValue> {
    tree_format_impl(entries, root_label, max_depth, show_hidden)
        .map_err(|error| JsValue::from_str(&error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn パス一覧を名前順のmarkdownツリーへ変換する() {
        let input = "src/index.ts\tblob\nREADME.md\tblob\nsrc\ttree";
        assert_eq!(
            tree_format_impl(input, "owner/repo", 10, false).unwrap(),
            "- owner/repo/\n  - README.md\n  - src/\n    - index.ts"
        );
    }

    #[test]
    fn 深さと隠しファイルを制御できる() {
        let input = ".github\ttree\n.github/workflows/ci.yml\tblob\nsrc\ttree\nsrc/lib.rs\tblob";
        assert_eq!(
            tree_format_impl(input, "repo", 1, false).unwrap(),
            "- repo/\n  - src/"
        );
        assert!(tree_format_impl(input, "repo", 3, true)
            .unwrap()
            .contains(".github/"));
    }

    #[test]
    fn 不正な入力を拒否する() {
        assert!(tree_format_impl("README.md\tunknown", "repo", 2, false).is_err());
        assert!(tree_format_impl("../secret\tblob", "repo", 2, false).is_err());
    }
}
