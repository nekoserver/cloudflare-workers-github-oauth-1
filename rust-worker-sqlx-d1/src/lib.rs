use serde::Serialize;
use sqlx_d1::{query_as, D1Connection, FromRow};
use worker::*;

#[derive(Debug, Serialize, FromRow)]
struct CommitLogRow {
    commit_sha: String,
    commit_message: String,
}

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let d1 = env.d1("DB")?;
    let conn = D1Connection::new(d1);

    match req.path().as_str() {
        "/ping" => Response::ok("ok"),
        "/commit-log/recent" => {
            let rows: Vec<CommitLogRow> = query_as(
                "SELECT commit_sha, commit_message FROM commit_agent_log ORDER BY created_at DESC LIMIT 10",
            )
            .fetch_all(&conn)
            .await
            .map_err(|e| worker::Error::RustError(e.to_string()))?;
            Response::from_json(&rows)
        }
        _ => Response::error("not found", 404),
    }
}
