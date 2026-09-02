use serde::Deserialize;
use wasm_bindgen::prelude::*;

fn valid_component(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && !value.starts_with('.')
        && !value.ends_with('.')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn validate_repo_impl(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let mut parts = trimmed.split('/');
    let owner = parts.next().unwrap_or_default();
    let repo = parts.next().unwrap_or_default();
    if parts.next().is_some() || !valid_component(owner) || !valid_component(repo) {
        return Err("リポジトリは owner/repo 形式で指定してください".to_string());
    }
    Ok(format!("{owner}/{repo}"))
}

fn escape_cell(value: &str) -> String {
    value.replace('|', "\\|").replace(['\r', '\n'], " ")
}

#[allow(clippy::too_many_arguments)]
fn format_repo_view_impl(
    full_name: &str,
    description: &str,
    html_url: &str,
    default_branch: &str,
    visibility: &str,
    license: &str,
    stars: u32,
    forks: u32,
    open_issues: u32,
    archived: bool,
) -> Result<String, String> {
    validate_repo_impl(full_name)
        .map_err(|_| "GitHub APIレスポンスのfull_nameが不正です".to_string())?;
    if !html_url.starts_with("https://github.com/")
        || default_branch.is_empty()
        || visibility.is_empty()
    {
        return Err("GitHub APIレスポンスに必須フィールドがありません".to_string());
    }
    let description = if description.trim().is_empty() {
        "(説明なし)"
    } else {
        description.trim()
    };
    Ok([
        format!("## {}", escape_cell(full_name)),
        escape_cell(description),
        String::new(),
        "| 項目 | 値 |".to_string(),
        "|---|---|".to_string(),
        format!("| URL | {} |", escape_cell(html_url)),
        format!("| Visibility | {} |", escape_cell(visibility)),
        format!("| Default branch | {} |", escape_cell(default_branch)),
        format!(
            "| License | {} |",
            escape_cell(if license.is_empty() { "—" } else { license })
        ),
        format!("| Stars | {stars} |"),
        format!("| Forks | {forks} |"),
        format!("| Open issues | {open_issues} |"),
        format!("| Archived | {} |", if archived { "yes" } else { "no" }),
    ]
    .join("\n"))
}

#[derive(Deserialize)]
struct PullRequestUser {
    login: String,
}

#[derive(Deserialize)]
struct PullRequest {
    number: u64,
    title: String,
    html_url: String,
    state: String,
    draft: bool,
    user: Option<PullRequestUser>,
}

/// `/neko gh pr list <owner/repo>` 用。GitHub REST API
/// `GET /repos/{owner}/{repo}/pulls` のJSONレスポンス(配列)をパースし、
/// Markdownテーブルへ整形する。実際のfetch(OAuthトークン付与含む)は
/// Worker/JavaScript側が行い、この関数はレスポンスの検証・整形のみを担う
/// (wasm/README.mdに記載のRust/WASMとWorker/JavaScriptの責務分担を踏襲)。
/// CLAUDE.mdルール16(罫線・ツリー文字禁止)に従いMarkdownテーブルで表現する。
fn format_pr_list_impl(repo_full_name: &str, json: &str) -> Result<String, String> {
    validate_repo_impl(repo_full_name).map_err(|_| "owner/repo形式が不正です".to_string())?;
    let prs: Vec<PullRequest> =
        serde_json::from_str(json).map_err(|e| format!("GitHub APIレスポンスの解析に失敗しました: {e}"))?;

    if prs.is_empty() {
        return Ok(format!(
            "## {} のプルリクエスト一覧\nオープン中のプルリクエストはありません",
            escape_cell(repo_full_name)
        ));
    }

    let mut lines = vec![
        format!("## {} のプルリクエスト一覧", escape_cell(repo_full_name)),
        "| # | タイトル | 作成者 | 状態 | URL |".to_string(),
        "|---|---|---|---|---|".to_string(),
    ];
    for pr in &prs {
        let author = pr
            .user
            .as_ref()
            .map(|u| u.login.as_str())
            .unwrap_or("(不明)");
        let state = if pr.draft {
            "draft".to_string()
        } else {
            escape_cell(&pr.state)
        };
        lines.push(format!(
            "| {} | {} | {} | {} | {} |",
            pr.number,
            escape_cell(&pr.title),
            escape_cell(author),
            state,
            escape_cell(&pr.html_url)
        ));
    }
    Ok(lines.join("\n"))
}

#[wasm_bindgen]
pub fn format_pr_list(repo_full_name: &str, json: &str) -> Result<String, JsValue> {
    format_pr_list_impl(repo_full_name, json).map_err(|message| JsValue::from_str(&message))
}

#[wasm_bindgen]
pub fn validate_repo(value: &str) -> Result<String, JsValue> {
    validate_repo_impl(value).map_err(|message| JsValue::from_str(&message))
}

#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn format_repo_view(
    full_name: &str,
    description: &str,
    html_url: &str,
    default_branch: &str,
    visibility: &str,
    license: &str,
    stars: u32,
    forks: u32,
    open_issues: u32,
    archived: bool,
) -> Result<String, JsValue> {
    format_repo_view_impl(
        full_name,
        description,
        html_url,
        default_branch,
        visibility,
        license,
        stars,
        forks,
        open_issues,
        archived,
    )
    .map_err(|message| JsValue::from_str(&message))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_repoを検証して正規化する() {
        assert_eq!(
            validate_repo_impl(" nekoserver/example ").unwrap(),
            "nekoserver/example"
        );
        assert!(validate_repo_impl("example").is_err());
        assert!(validate_repo_impl("owner/repo/extra").is_err());
        assert!(validate_repo_impl("owner/../repo").is_err());
    }

    #[test]
    fn github_apiデータをmarkdownへ整形する() {
        let output = format_repo_view_impl(
            "nekoserver/example",
            "Rust | WASM",
            "https://github.com/nekoserver/example",
            "main",
            "public",
            "MIT",
            12,
            3,
            2,
            false,
        )
        .unwrap();
        assert!(output.contains("## nekoserver/example"));
        assert!(output.contains("Rust \\| WASM"));
        assert!(output.contains("| Stars | 12 |"));
        assert!(output.contains("| License | MIT |"));
    }

    #[test]
    fn 必須フィールド欠損は明示的なエラーになる() {
        let error =
            format_repo_view_impl("owner/repo", "", "", "", "", "", 0, 0, 0, false).unwrap_err();
        assert!(error.contains("GitHub APIレスポンス"));
    }

    #[test]
    fn pr一覧をmarkdownテーブルへ整形する() {
        let json = r#"[
            {"number":42,"title":"Fix bug","html_url":"https://github.com/o/r/pull/42","state":"open","draft":false,"user":{"login":"alice"}},
            {"number":43,"title":"WIP | feature","html_url":"https://github.com/o/r/pull/43","state":"open","draft":true,"user":{"login":"bob"}}
        ]"#;
        let output = format_pr_list_impl("o/r", json).unwrap();
        assert!(output.contains("## o/r のプルリクエスト一覧"));
        assert!(output.contains("| 42 | Fix bug | alice | open |"));
        assert!(output.contains("| 43 | WIP \\| feature | bob | draft |"));
    }

    #[test]
    fn pr0件は該当メッセージを返す() {
        let output = format_pr_list_impl("o/r", "[]").unwrap();
        assert!(output.contains("オープン中のプルリクエストはありません"));
    }

    #[test]
    fn userが欠損している場合は不明として扱う() {
        let json = r#"[{"number":1,"title":"t","html_url":"https://github.com/o/r/pull/1","state":"open","draft":false,"user":null}]"#;
        let output = format_pr_list_impl("o/r", json).unwrap();
        assert!(output.contains("| 1 | t | (不明) | open |"));
    }

    #[test]
    fn 不正なjsonはエラーを返す() {
        let error = format_pr_list_impl("o/r", "not json").unwrap_err();
        assert!(error.contains("GitHub APIレスポンスの解析に失敗しました"));
    }

    #[test]
    fn owner_repo形式が不正なら弾く() {
        assert!(format_pr_list_impl("invalid", "[]").is_err());
    }
}
