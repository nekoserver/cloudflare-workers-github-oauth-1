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
}
