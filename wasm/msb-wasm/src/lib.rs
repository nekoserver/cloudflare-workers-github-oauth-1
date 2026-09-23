//! microsandbox(https://github.com/microsandbox/microsandbox)のCLI `msb` の
//! ヘルプ・コマンドツリー表示だけをRustで再実装したもの。
//!
//! `msb` 本体はKVM/libkrun/Apple Silicon仮想化/Windows Hypervisor Platformに
//! 依存するmicroVMランタイムであり、これらはWASM(ブラウザ/Workers)からは
//! 実行できない。このクレートはサンドボックスの実行そのものは一切行わず、
//! 公式README(Apache-2.0)に列挙されているコマンド一覧を元にした
//! 静的なヘルプ・ツリー出力のみを提供する。
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

/// (コマンドパス, 説明) の一覧。
/// パスはスペース区切りでサブコマンドを表す(例: "snap create")。
/// 出典: https://github.com/microsandbox/microsandbox の README。
const COMMANDS: &[(&str, &str)] = &[
    ("run", "サンドボックス内でコマンドを実行する"),
    ("create", "名前付きサンドボックスを作成する"),
    ("exec", "既存のサンドボックス内でコマンドを実行する"),
    ("branch", "実行中のサンドボックスを独立したコピーへ分岐する"),
    ("snap create", "サンドボックスの状態をスナップショットとして保存する"),
    ("snap restore", "保存済みスナップショットからサンドボックスを再開する"),
    ("stop", "実行中のサンドボックスを停止する"),
    ("start", "停止中のサンドボックスを再開する"),
    ("rm", "サンドボックスを削除する"),
    ("pull", "レジストリからイメージを取得する"),
    ("image ls", "キャッシュ済みイメージを一覧表示する"),
    ("image rm", "キャッシュ済みイメージを削除する"),
    ("ls", "すべてのサンドボックスを一覧表示する"),
    ("ps", "サンドボックスの状態を表示する"),
    ("inspect", "サンドボックスの詳細情報を表示する"),
    ("metrics", "CPU・メモリ・ネットワークのライブ統計を表示する"),
    ("install", "サンドボックスをシステムコマンドとして登録する"),
    ("uninstall", "登録済みのサンドボックスコマンドを解除する"),
];

fn matches_query(path: &str, desc: &str, query: &str) -> bool {
    query.is_empty()
        || path.to_lowercase().contains(&query.to_lowercase())
        || desc.contains(query)
}

fn format_help_impl(query: &str) -> String {
    let mut lines = vec!["- `msb --help` で表示されるコマンド一覧(WASM再現版)".to_string()];
    for (path, desc) in COMMANDS {
        if matches_query(path, desc, query) {
            lines.push(format!("- `msb {path}` — {desc}"));
        }
    }
    lines.join("\n")
}

#[derive(Default)]
struct Node {
    desc: Option<&'static str>,
    children: BTreeMap<&'static str, Node>,
}

fn build_tree(query: &str) -> Node {
    let mut root = Node::default();
    for (path, desc) in COMMANDS {
        if !matches_query(path, desc, query) {
            continue;
        }
        let parts: Vec<&str> = path.split(' ').collect();
        let mut current = &mut root;
        for (index, part) in parts.iter().enumerate() {
            current = current.children.entry(part).or_default();
            if index + 1 == parts.len() {
                current.desc = Some(desc);
            }
        }
    }
    root
}

fn render_tree(node: &Node, depth: u32, output: &mut Vec<String>) {
    for (name, child) in &node.children {
        let suffix = child.desc.map(|d| format!(" — {d}")).unwrap_or_default();
        output.push(format!("{}- `{name}`{suffix}", "  ".repeat(depth as usize)));
        render_tree(child, depth + 1, output);
    }
}

fn format_tree_impl(query: &str) -> String {
    let root = build_tree(query);
    let mut output = vec!["- `msb`".to_string()];
    render_tree(&root, 1, &mut output);
    output.join("\n")
}

fn format_command_help_impl(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    let hits: Vec<_> = COMMANDS
        .iter()
        .filter(|(path, _)| *path == trimmed || path.starts_with(&format!("{trimmed} ")))
        .collect();
    if hits.is_empty() {
        return Err(format!("`msb {trimmed}` というコマンドは見つかりません"));
    }
    let mut lines = vec![format!("- `msb {trimmed} --help`(WASM再現版)")];
    for (path, desc) in hits {
        lines.push(format!("- `msb {path}` — {desc}"));
    }
    lines.push(
        "  実際のサンドボックス起動にはKVM(Linux)/Apple Silicon仮想化(macOS)/WHP(Windows)が必要で、WASM上では実行できません".to_string(),
    );
    Ok(lines.join("\n"))
}

/// `msb --help` 相当のフラットな一覧をMarkdownで返す。
/// `query` が空でなければコマンドパス・説明を部分一致(大小無視)でフィルタする。
#[wasm_bindgen]
pub fn msb_help(query: &str) -> String {
    format_help_impl(query)
}

/// `msb --tree` 相当のコマンド階層をMarkdownの入れ子リストで返す。
#[wasm_bindgen]
pub fn msb_tree(query: &str) -> String {
    format_tree_impl(query)
}

/// `msb <command> --help` 相当。該当コマンドが無ければエラーを返す。
#[wasm_bindgen]
pub fn msb_command_help(name: &str) -> Result<String, JsValue> {
    format_command_help_impl(name).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 全件のヘルプ一覧を返す() {
        let out = format_help_impl("");
        assert!(out.contains("- `msb run` — サンドボックス内でコマンドを実行する"));
        assert!(out.contains("- `msb snap create`"));
        assert_eq!(out.lines().count(), COMMANDS.len() + 1);
    }

    #[test]
    fn クエリでコマンド名と説明の両方を絞り込む() {
        let out = format_help_impl("snap");
        assert!(out.contains("snap create"));
        assert!(out.contains("snap restore"));
        assert!(!out.contains("- `msb run`"));

        let out = format_help_impl("削除");
        assert!(out.contains("- `msb rm`"));
        assert!(out.contains("- `msb image rm`"));
        assert!(!out.contains("- `msb run`"));
    }

    #[test]
    fn ツリーはスペース区切りのサブコマンドを入れ子にする() {
        let out = format_tree_impl("");
        assert_eq!(
            out.lines().next().unwrap(),
            "- `msb`"
        );
        assert!(out.contains("  - `snap`"));
        assert!(out.contains("    - `create` — サンドボックスの状態をスナップショットとして保存する"));
        assert!(out.contains("    - `restore` — 保存済みスナップショットからサンドボックスを再開する"));
        assert!(out.contains("  - `image`"));
        assert!(out.contains("    - `ls` — キャッシュ済みイメージを一覧表示する"));
    }

    #[test]
    fn ツリーもクエリで絞り込める() {
        let out = format_tree_impl("image");
        assert!(out.contains("  - `image`"));
        assert!(!out.contains("  - `snap`"));
    }

    #[test]
    fn コマンド単位のヘルプはサブコマンドをまとめて返す() {
        let out = format_command_help_impl("snap").unwrap();
        assert!(out.contains("`msb snap create`"));
        assert!(out.contains("`msb snap restore`"));
        assert!(out.contains("KVM"));
    }

    #[test]
    fn 存在しないコマンドはエラーになる() {
        assert!(format_command_help_impl("nope").is_err());
    }
}
