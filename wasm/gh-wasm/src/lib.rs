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
///
/// 「URL」列は廃止し、「No.」列にプルリク番号自体をPR本体へのMarkdownリンク
/// (`[番号](https://github.com/owner/repo/pull/番号)`)として埋め込む。
/// リンク先URLはGitHub APIが返すhtml_urlをそのまま使わず、検証済みの
/// repo_full_nameと番号から組み立てる(APIレスポンスの信頼性に依存しない)。
///
/// mask_authorがtrueの場合、作成者列は実際のユーザー名の代わりに常に"***"を
/// 表示する(設定ページの「スラッシュコマンドからのプルリク応答で作成者を
/// 伏せる」トグルに対応、デフォルトON)。
fn format_pr_list_impl(repo_full_name: &str, json: &str, mask_author: bool) -> Result<String, String> {
    let repo_full_name = validate_repo_impl(repo_full_name).map_err(|_| "owner/repo形式が不正です".to_string())?;
    let prs: Vec<PullRequest> =
        serde_json::from_str(json).map_err(|e| format!("GitHub APIレスポンスの解析に失敗しました: {e}"))?;

    if prs.is_empty() {
        return Ok("## Pulls 一覧(Draft : 0/Open : 0)\nオープン中のプルリクエストはありません".to_string());
    }

    let draft_count = prs.iter().filter(|pr| pr.draft).count();
    let open_count = prs.len() - draft_count;

    // 列揃えはMarkdownの区切り行記法(:---=左, ---:=右, :---:=中央)で指定する。
    // No.は6桁ゼロ埋め・右寄せ、作成者は中央寄せにする(利用者からの要望)。
    // 状態(open/draft)列はMarkdown単体では色付きバッジにできないため、
    // ブラウザ側(aichat.tsのstyleGhPrListBubble)でこの列のテキストを
    // GitHub準拠の色バッジへ置き換える。ここではプレーンテキストのまま出力する。
    let mut lines = vec![
        format!("## Pulls 一覧(Draft : {draft_count}/Open : {open_count})"),
        "| No. | タイトル | 作成者 | 状態 |".to_string(),
        "|---:|---|:---:|---|".to_string(),
    ];
    for pr in &prs {
        let author = if mask_author {
            "***".to_string()
        } else {
            escape_cell(pr.user.as_ref().map(|u| u.login.as_str()).unwrap_or("(不明)"))
        };
        let state = if pr.draft {
            "draft".to_string()
        } else {
            escape_cell(&pr.state)
        };
        let no_link = format!(
            "[{:06}](https://github.com/{}/pull/{})",
            pr.number, repo_full_name, pr.number
        );
        lines.push(format!(
            "| {} | {} | {} | {} |",
            no_link,
            escape_cell(&pr.title),
            author,
            state
        ));
    }
    Ok(lines.join("\n"))
}

#[wasm_bindgen]
pub fn format_pr_list(repo_full_name: &str, json: &str, mask_author: bool) -> Result<String, JsValue> {
    format_pr_list_impl(repo_full_name, json, mask_author).map_err(|message| JsValue::from_str(&message))
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
    fn pr一覧をmarkdownテーブルへ整形する_作成者マスクなし() {
        let json = r#"[
            {"number":42,"title":"Fix bug","html_url":"https://github.com/o/r/pull/42","state":"open","draft":false,"user":{"login":"alice"}},
            {"number":43,"title":"WIP | feature","html_url":"https://github.com/o/r/pull/43","state":"open","draft":true,"user":{"login":"bob"}}
        ]"#;
        let output = format_pr_list_impl("o/r", json, false).unwrap();
        assert!(output.contains("## Pulls 一覧(Draft : 1/Open : 1)"));
        assert!(output.contains("| No. | タイトル | 作成者 | 状態 |"));
        assert!(!output.contains("URL"));
        // 列揃え: No.は右寄せ(6桁ゼロ埋めのリンクラベル、URL自体は非パディング)、作成者は中央寄せ
        assert!(output.contains("|---:|---|:---:|---|"));
        assert!(output.contains("| [000042](https://github.com/o/r/pull/42) | Fix bug | alice | open |"));
        assert!(output.contains("| [000043](https://github.com/o/r/pull/43) | WIP \\| feature | bob | draft |"));
    }

    #[test]
    fn pr一覧をmarkdownテーブルへ整形する_作成者マスクあり() {
        let json = r#"[{"number":42,"title":"Fix bug","html_url":"https://github.com/o/r/pull/42","state":"open","draft":false,"user":{"login":"alice"}}]"#;
        let output = format_pr_list_impl("o/r", json, true).unwrap();
        assert!(output.contains("| [000042](https://github.com/o/r/pull/42) | Fix bug | *** | open |"));
        assert!(!output.contains("alice"));
    }

    #[test]
    fn pr0件は該当メッセージを返す() {
        let output = format_pr_list_impl("o/r", "[]", true).unwrap();
        assert!(output.contains("オープン中のプルリクエストはありません"));
        assert!(output.contains("## Pulls 一覧(Draft : 0/Open : 0)"));
    }

    #[test]
    fn draft_openの件数を見出しに表示する() {
        let json = r#"[
            {"number":1,"title":"a","html_url":"https://github.com/o/r/pull/1","state":"open","draft":true,"user":{"login":"a"}},
            {"number":2,"title":"b","html_url":"https://github.com/o/r/pull/2","state":"open","draft":true,"user":{"login":"b"}},
            {"number":3,"title":"c","html_url":"https://github.com/o/r/pull/3","state":"open","draft":false,"user":{"login":"c"}},
            {"number":4,"title":"d","html_url":"https://github.com/o/r/pull/4","state":"open","draft":false,"user":{"login":"d"}},
            {"number":5,"title":"e","html_url":"https://github.com/o/r/pull/5","state":"open","draft":false,"user":{"login":"e"}}
        ]"#;
        let output = format_pr_list_impl("o/r", json, false).unwrap();
        assert!(output.contains("## Pulls 一覧(Draft : 2/Open : 3)"));
    }

    #[test]
    fn userが欠損している場合は不明として扱う_マスクなし() {
        let json = r#"[{"number":1,"title":"t","html_url":"https://github.com/o/r/pull/1","state":"open","draft":false,"user":null}]"#;
        let output = format_pr_list_impl("o/r", json, false).unwrap();
        assert!(output.contains("| [000001](https://github.com/o/r/pull/1) | t | (不明) | open |"));
    }

    #[test]
    fn pr番号が6桁を超える場合はそのまま桁数を保つ() {
        let json = r#"[{"number":1234567,"title":"t","html_url":"https://github.com/o/r/pull/1234567","state":"open","draft":false,"user":{"login":"a"}}]"#;
        let output = format_pr_list_impl("o/r", json, false).unwrap();
        assert!(output.contains("[1234567](https://github.com/o/r/pull/1234567)"));
    }

    #[test]
    fn 不正なjsonはエラーを返す() {
        let error = format_pr_list_impl("o/r", "not json", true).unwrap_err();
        assert!(error.contains("GitHub APIレスポンスの解析に失敗しました"));
    }

    #[test]
    fn owner_repo形式が不正なら弾く() {
        assert!(format_pr_list_impl("invalid", "[]", true).is_err());
    }
}
