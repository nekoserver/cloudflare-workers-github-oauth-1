use serde::Serialize;
use wasm_bindgen::prelude::*;

const HELP: &str = "msb-wasm: microsandbox CLI request parser\n\nUsage: msb <command> [arguments] [options]\n\nThe host is responsible for daemon communication, microVM lifecycle, file I/O, and networking.";

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliRequest {
    command: String,
    arguments: Vec<String>,
    options: Vec<CliOption>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliOption {
    name: String,
    value: Option<String>,
}

fn parse_arguments(args: Vec<String>) -> Result<CliRequest, String> {
    let mut values = args.into_iter();
    if matches!(values.clone().next().as_deref(), Some("msb")) {
        values.next();
    }

    let command = values
        .next()
        .filter(|value| !value.starts_with('-'))
        .ok_or_else(|| "msb command is required".to_string())?;
    let remaining: Vec<String> = values.collect();
    let mut arguments = Vec::new();
    let mut options = Vec::new();
    let mut index = 0;

    while index < remaining.len() {
        let value = &remaining[index];
        if value == "--" {
            arguments.extend_from_slice(&remaining[index + 1..]);
            break;
        }
        if let Some(option) = value.strip_prefix("--") {
            if option.is_empty() {
                return Err("option name must not be empty".to_string());
            }
            if let Some((name, option_value)) = option.split_once('=') {
                if name.is_empty() {
                    return Err("option name must not be empty".to_string());
                }
                options.push(CliOption {
                    name: name.to_string(),
                    value: Some(option_value.to_string()),
                });
            } else {
                let option_value = remaining
                    .get(index + 1)
                    .filter(|next| !next.starts_with('-'))
                    .cloned();
                if option_value.is_some() {
                    index += 1;
                }
                options.push(CliOption {
                    name: option.to_string(),
                    value: option_value,
                });
            }
        } else if let Some(short) = value.strip_prefix('-') {
            if short.is_empty() {
                arguments.push(value.clone());
            } else {
                options.push(CliOption {
                    name: short.to_string(),
                    value: None,
                });
            }
        } else {
            arguments.push(value.clone());
        }
        index += 1;
    }

    Ok(CliRequest {
        command,
        arguments,
        options,
    })
}

/// JavaScript の文字列配列(JSON)を、ホストが実行できる構造化要求へ変換する。
/// OSシェルを経由しないため、値は引用符展開せず入力どおり保持する。
#[wasm_bindgen]
pub fn parse_msb_args(args_json: &str) -> Result<String, JsValue> {
    let args: Vec<String> = serde_json::from_str(args_json).map_err(|error| {
        JsValue::from_str(&format!("arguments must be a JSON string array: {error}"))
    })?;
    let request = parse_arguments(args).map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&request)
        .map_err(|error| JsValue::from_str(&format!("failed to serialize request: {error}")))
}

#[wasm_bindgen]
pub fn msb_help() -> String {
    HELP.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_command_arguments_and_options() {
        let request = parse_arguments(vec![
            "msb".into(),
            "run".into(),
            "python".into(),
            "--memory=512".into(),
            "--name".into(),
            "demo box".into(),
            "-v".into(),
        ])
        .unwrap();

        assert_eq!(request.command, "run");
        assert_eq!(request.arguments, vec!["python"]);
        assert_eq!(
            request.options,
            vec![
                CliOption {
                    name: "memory".into(),
                    value: Some("512".into())
                },
                CliOption {
                    name: "name".into(),
                    value: Some("demo box".into())
                },
                CliOption {
                    name: "v".into(),
                    value: None
                },
            ]
        );
    }

    #[test]
    fn preserves_every_value_after_option_terminator() {
        let request = parse_arguments(vec![
            "exec".into(),
            "box".into(),
            "--".into(),
            "echo".into(),
            "--not-an-msb-option".into(),
        ])
        .unwrap();
        assert_eq!(
            request.arguments,
            vec!["box", "echo", "--not-an-msb-option"]
        );
        assert!(request.options.is_empty());
    }

    #[test]
    fn rejects_missing_command() {
        assert_eq!(
            parse_arguments(vec!["msb".into()]),
            Err("msb command is required".into())
        );
    }
}
