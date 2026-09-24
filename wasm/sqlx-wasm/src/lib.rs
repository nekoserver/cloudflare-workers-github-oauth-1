//! A small, browser-safe SQLx example.
//!
//! SQLx database connections need sockets and an async runtime, neither of which a
//! browser provides. Query construction, however, is pure Rust. This module keeps
//! that useful part inside WASM and leaves execution to the Worker/D1 boundary.

use serde::{Deserialize, Serialize};
use sqlx::{Postgres, QueryBuilder};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
struct InsertRequest {
    table: String,
    columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize)]
struct BuiltQuery {
    sql: String,
    arguments: Vec<serde_json::Value>,
}

fn identifier(value: &str) -> Result<&str, String> {
    let mut chars = value.chars();
    match chars.next() {
        Some(c) if c == '_' || c.is_ascii_alphabetic() => {}
        _ => return Err(format!("invalid SQL identifier: {value}")),
    }
    if chars.all(|c| c == '_' || c.is_ascii_alphanumeric()) {
        Ok(value)
    } else {
        Err(format!("invalid SQL identifier: {value}"))
    }
}

/// Build a parameterised PostgreSQL INSERT and serialized bind list.
///
/// This Rust API is usable natively as well as through the WASM wrapper.
pub fn build_insert_json(input: &str) -> Result<String, String> {
    let request: InsertRequest = serde_json::from_str(input).map_err(|e| e.to_string())?;
    let table = identifier(&request.table)?;
    if request.columns.is_empty() {
        return Err("columns must not be empty".into());
    }
    let columns = request
        .columns
        .iter()
        .map(|column| identifier(column).map(str::to_owned))
        .collect::<Result<Vec<_>, _>>()?;
    if request.rows.is_empty() {
        return Err("rows must not be empty".into());
    }
    if request.rows.iter().any(|row| row.len() != columns.len()) {
        return Err("every row must have the same number of values as columns".into());
    }

    let mut query = QueryBuilder::<Postgres>::new("INSERT INTO \"");
    query.push(table).push("\" (");
    {
        let mut separated = query.separated(", ");
        for column in &columns {
            separated.push(format!("\"{column}\""));
        }
    }
    query.push(") VALUES ");
    let mut arguments = Vec::new();
    query.push_values(request.rows, |mut row_builder, row| {
        for value in row {
            arguments.push(value.clone());
            // JSON text is used as the portable demonstration value. The returned
            // argument array lets a caller bind native values at the execution edge.
            row_builder.push_bind(value.to_string());
        }
    });

    serde_json::to_string(&BuiltQuery {
        sql: query.sql().to_owned(),
        arguments,
    })
    .map_err(|e| e.to_string())
}

/// Build a parameterised PostgreSQL INSERT with SQLx and return JSON.
#[wasm_bindgen]
pub fn sqlx_build_insert(input: &str) -> String {
    build_insert_json(input).unwrap_or_else(|error| format!("ERROR: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_parameterized_multi_row_insert() {
        let output = build_insert_json(
            r#"{"table":"users","columns":["id","name"],"rows":[[1,"neko"],[2,"saba"]]}"#,
        )
        .unwrap();
        let value: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert_eq!(
            value["sql"],
            "INSERT INTO \"users\" (\"id\", \"name\") VALUES ($1, $2), ($3, $4)"
        );
        assert_eq!(
            value["arguments"],
            serde_json::json!([1, "neko", 2, "saba"])
        );
    }

    #[test]
    fn rejects_identifier_injection_and_ragged_rows() {
        assert!(build_insert_json(
            r#"{"table":"users; DROP TABLE users","columns":["id"],"rows":[[1]]}"#
        )
        .is_err());
        assert!(
            build_insert_json(r#"{"table":"users","columns":["id","name"],"rows":[[1]]}"#).is_err()
        );
    }
}
