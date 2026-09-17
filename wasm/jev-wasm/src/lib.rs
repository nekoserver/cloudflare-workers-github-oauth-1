use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// このクレートはJev(TypeSafe AI System One Model)評価の「純粋ロジック」
// (入力検証・APIペイロード生成・レスポンス解析・出力整形)だけをRust/WASM化する。
// HTTP通信・APIキー・D1・認可はWorker(TypeScript)側に残す
// (このリポジトリのwasm/README.mdの方針、NOTICE.rust-WASM.mdの教訓に従う)。
// TypeScript側の対応実装: src/utils/jevEvaluation.ts

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JevLabel {
    pub id: i64,
    pub question_text: String,
    pub criteria: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluatedRow {
    pub jev_label_id: i64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JevScoreResult {
    #[serde(rename = "labelId")]
    pub label_id: i64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JevEvaluationPlan {
    pub pending: Vec<JevLabel>,
    pub cached: Vec<JevScoreResult>,
}

/// jev_labels.options_jsonから、Jev API送信用のcriteria(0側/1側の説明2要素配列)を
/// 取り出す。不正な形式はNoneを返す(呼び出し元に判断を委ねる)。
/// TS版: parseLabelCriteria (src/utils/jevEvaluation.ts)
fn parse_label_criteria_impl(options_json: Option<&str>) -> Option<Vec<String>> {
    let raw = options_json?;
    if raw.is_empty() {
        return None;
    }
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    let arr = parsed.as_array()?;
    if arr.len() != 2 {
        return None;
    }
    let strings: Vec<String> = arr
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();
    if strings.len() != 2 {
        return None;
    }
    Some(strings)
}

/// 全ラベルのうち、まだ評価済みでないものだけをpendingとして返す。
/// TS版: computeJevEvaluationPlan (src/utils/jevEvaluation.ts)
fn compute_jev_evaluation_plan_impl(
    all_labels: &[JevLabel],
    evaluated_rows: &[EvaluatedRow],
) -> JevEvaluationPlan {
    let mut evaluated: std::collections::HashMap<i64, f64> = std::collections::HashMap::new();
    for row in evaluated_rows {
        evaluated.insert(row.jev_label_id, row.value);
    }

    let mut pending = Vec::new();
    let mut cached = Vec::new();
    for label in all_labels {
        if let Some(value) = evaluated.get(&label.id) {
            cached.push(JevScoreResult {
                label_id: label.id,
                value: *value,
            });
        } else {
            pending.push(label.clone());
        }
    }
    JevEvaluationPlan { pending, cached }
}

/// Jev APIへ送るリクエストボディを組み立てる。
/// questionsはラベルIDをキーにした辞書(配列だとHTTP 422)。
/// TS版: buildJevRequestBody (src/utils/jevEvaluation.ts)
fn build_jev_request_body_impl(state: &str, labels: &[JevLabel]) -> serde_json::Value {
    let mut questions = serde_json::Map::new();
    for label in labels {
        questions.insert(
            label.id.to_string(),
            serde_json::json!({
                "type": "score",
                "question": label.question_text,
                "criteria": label.criteria,
            }),
        );
    }
    serde_json::json!({
        "model": "jev-latest",
        "state": state,
        "questions": questions,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub enum JevApiErrorCode {
    UnexpectedShape,
}

impl JevApiErrorCode {
    fn as_str(&self) -> &'static str {
        match self {
            JevApiErrorCode::UnexpectedShape => "unexpected_shape",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct JevApiError {
    pub error_code: JevApiErrorCode,
    pub detail: String,
}

fn extract_score_value(entry: &serde_json::Value) -> Option<f64> {
    if let Some(n) = entry.as_f64() {
        if n.is_finite() {
            return Some(n);
        }
    }
    if let Some(obj) = entry.as_object() {
        for key in ["score", "value", "probability"] {
            if let Some(v) = obj.get(key).and_then(|v| v.as_f64()) {
                if v.is_finite() {
                    return Some(v);
                }
            }
        }
    }
    None
}

/// Jevのレスポンス(answersが質問IDをキーにした辞書)をlabelIdに結び付ける。
/// TS版: parseJevApiResponse (src/utils/jevEvaluation.ts)、判別可能な型で成否を表現する
/// (文字列prefixでの判定はしない、リポジトリのルール32)。
fn parse_jev_api_response_impl(
    labels: &[JevLabel],
    json: &serde_json::Value,
) -> Result<Vec<JevScoreResult>, JevApiError> {
    if labels.is_empty() {
        return Ok(Vec::new());
    }
    let obj = json.as_object().ok_or_else(|| JevApiError {
        error_code: JevApiErrorCode::UnexpectedShape,
        detail: "レスポンスがオブジェクトではありません".to_string(),
    })?;
    let answers = obj.get("answers").ok_or_else(|| JevApiError {
        error_code: JevApiErrorCode::UnexpectedShape,
        detail: "answersが辞書(オブジェクト)ではありません".to_string(),
    })?;
    let answers_obj = answers.as_object().ok_or_else(|| JevApiError {
        error_code: JevApiErrorCode::UnexpectedShape,
        detail: "answersが辞書(オブジェクト)ではありません".to_string(),
    })?;

    let mut scores = Vec::with_capacity(labels.len());
    for label in labels {
        let key = label.id.to_string();
        let entry = answers_obj.get(&key).ok_or_else(|| JevApiError {
            error_code: JevApiErrorCode::UnexpectedShape,
            detail: format!("answersに質問ID {} の結果が含まれていません", key),
        })?;
        let value = extract_score_value(entry).ok_or_else(|| JevApiError {
            error_code: JevApiErrorCode::UnexpectedShape,
            detail: format!("answers[{}]から数値のscoreを取り出せませんでした", key),
        })?;
        scores.push(JevScoreResult {
            label_id: label.id,
            value,
        });
    }
    Ok(scores)
}

// ここから先はwasm-bindgen向けラッパー。JsValueに依存しないimpl関数を
// 通すだけで、実際のロジックは上のネイティブ関数(cargo testで検証可能)に委ねる
// (NOTICE.rust-WASM.mdの10番、vitestではWASMの実行結果を検証できないため)。

#[wasm_bindgen]
pub fn parse_label_criteria(options_json: Option<String>) -> JsValue {
    match parse_label_criteria_impl(options_json.as_deref()) {
        Some(criteria) => serde_wasm_bindgen_json(&criteria),
        None => JsValue::NULL,
    }
}

fn serde_wasm_bindgen_json<T: Serialize>(value: &T) -> JsValue {
    // wasm-bindgenの型変換crateを増やさず、JSON文字列経由でJsValueへ変換する
    // (JS側でJSON.parseする軽量な橋渡し)。
    match serde_json::to_string(value) {
        Ok(s) => JsValue::from_str(&s),
        Err(_) => JsValue::NULL,
    }
}

#[wasm_bindgen]
pub fn compute_jev_evaluation_plan(all_labels_json: &str, evaluated_rows_json: &str) -> Result<String, JsValue> {
    let all_labels: Vec<JevLabel> = serde_json::from_str(all_labels_json)
        .map_err(|e| JsValue::from_str(&format!("all_labelsのJSON解析に失敗しました: {e}")))?;
    let evaluated_rows: Vec<EvaluatedRow> = serde_json::from_str(evaluated_rows_json)
        .map_err(|e| JsValue::from_str(&format!("evaluated_rowsのJSON解析に失敗しました: {e}")))?;
    let plan = compute_jev_evaluation_plan_impl(&all_labels, &evaluated_rows);
    serde_json::to_string(&plan).map_err(|e| JsValue::from_str(&format!("結果のJSON化に失敗しました: {e}")))
}

#[wasm_bindgen]
pub fn build_jev_request_body(state: &str, labels_json: &str) -> Result<String, JsValue> {
    let labels: Vec<JevLabel> = serde_json::from_str(labels_json)
        .map_err(|e| JsValue::from_str(&format!("labelsのJSON解析に失敗しました: {e}")))?;
    let body = build_jev_request_body_impl(state, &labels);
    serde_json::to_string(&body).map_err(|e| JsValue::from_str(&format!("結果のJSON化に失敗しました: {e}")))
}

#[wasm_bindgen]
pub fn parse_jev_api_response(labels_json: &str, response_json: &str) -> Result<String, JsValue> {
    let labels: Vec<JevLabel> = serde_json::from_str(labels_json)
        .map_err(|e| JsValue::from_str(&format!("labelsのJSON解析に失敗しました: {e}")))?;
    let json: serde_json::Value = serde_json::from_str(response_json)
        .map_err(|e| JsValue::from_str(&format!("response_jsonの解析に失敗しました: {e}")))?;
    match parse_jev_api_response_impl(&labels, &json) {
        Ok(scores) => {
            let out = serde_json::json!({ "ok": true, "scores": scores });
            serde_json::to_string(&out).map_err(|e| JsValue::from_str(&format!("結果のJSON化に失敗しました: {e}")))
        }
        Err(err) => {
            let out = serde_json::json!({
                "ok": false,
                "errorCode": err.error_code.as_str(),
                "detail": err.detail,
            });
            serde_json::to_string(&out).map_err(|e| JsValue::from_str(&format!("結果のJSON化に失敗しました: {e}")))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn labels() -> Vec<JevLabel> {
        vec![
            JevLabel {
                id: 1,
                question_text: "事実性".to_string(),
                criteria: vec!["事実誤認がある".to_string(), "事実として正しい".to_string()],
            },
            JevLabel {
                id: 2,
                question_text: "根拠".to_string(),
                criteria: vec!["根拠・出典が不足".to_string(), "根拠が明示されている".to_string()],
            },
        ]
    }

    #[test]
    fn parse_label_criteria_valid_two_element_array() {
        assert_eq!(
            parse_label_criteria_impl(Some("[\"悪い状態\", \"良い状態\"]")),
            Some(vec!["悪い状態".to_string(), "良い状態".to_string()])
        );
    }

    #[test]
    fn parse_label_criteria_none_and_empty_are_none() {
        assert_eq!(parse_label_criteria_impl(None), None);
        assert_eq!(parse_label_criteria_impl(Some("")), None);
    }

    #[test]
    fn parse_label_criteria_invalid_json_is_none() {
        assert_eq!(parse_label_criteria_impl(Some("not json")), None);
    }

    #[test]
    fn parse_label_criteria_wrong_shape_is_none() {
        assert_eq!(parse_label_criteria_impl(Some("\"0=X, 1=Y\"")), None);
        assert_eq!(parse_label_criteria_impl(Some("[\"only one\"]")), None);
        assert_eq!(parse_label_criteria_impl(Some("[1, 2]")), None);
    }

    #[test]
    fn evaluation_plan_splits_pending_and_cached() {
        let plan = compute_jev_evaluation_plan_impl(
            &labels(),
            &[EvaluatedRow {
                jev_label_id: 1,
                value: 0.8,
            }],
        );
        assert_eq!(plan.pending, vec![labels()[1].clone()]);
        assert_eq!(
            plan.cached,
            vec![JevScoreResult {
                label_id: 1,
                value: 0.8
            }]
        );
    }

    #[test]
    fn evaluation_plan_all_pending_when_none_evaluated() {
        let plan = compute_jev_evaluation_plan_impl(&labels(), &[]);
        assert_eq!(plan.pending, labels());
        assert_eq!(plan.cached, vec![]);
    }

    #[test]
    fn evaluation_plan_empty_labels_is_always_empty() {
        let plan = compute_jev_evaluation_plan_impl(
            &[],
            &[EvaluatedRow {
                jev_label_id: 1,
                value: 0.8,
            }],
        );
        assert_eq!(plan.pending, vec![]);
        assert_eq!(plan.cached, vec![]);
    }

    #[test]
    fn request_body_builds_dict_keyed_by_label_id_with_criteria() {
        let body = build_jev_request_body_impl("回答本文", &labels());
        assert_eq!(body["model"], "jev-latest");
        assert_eq!(body["state"], "回答本文");
        assert_eq!(body["questions"]["1"]["type"], "score");
        assert_eq!(body["questions"]["1"]["question"], "事実性");
        assert_eq!(
            body["questions"]["1"]["criteria"],
            serde_json::json!(["事実誤認がある", "事実として正しい"])
        );
        assert_eq!(body["questions"]["2"]["question"], "根拠");
    }

    #[test]
    fn parse_response_extracts_numeric_scores() {
        let json = serde_json::json!({
            "answers": { "1": 0.9, "2": { "score": 0.4 } }
        });
        let result = parse_jev_api_response_impl(&labels(), &json).unwrap();
        assert_eq!(
            result,
            vec![
                JevScoreResult { label_id: 1, value: 0.9 },
                JevScoreResult { label_id: 2, value: 0.4 },
            ]
        );
    }

    #[test]
    fn parse_response_missing_answers_is_unexpected_shape() {
        let json = serde_json::json!({ "foo": "bar" });
        let err = parse_jev_api_response_impl(&labels(), &json).unwrap_err();
        assert_eq!(err.error_code, JevApiErrorCode::UnexpectedShape);
    }

    #[test]
    fn parse_response_answers_not_object_is_unexpected_shape() {
        let json = serde_json::json!({ "answers": [1, 2] });
        let err = parse_jev_api_response_impl(&labels(), &json).unwrap_err();
        assert_eq!(err.error_code, JevApiErrorCode::UnexpectedShape);
    }

    #[test]
    fn parse_response_missing_label_key_is_unexpected_shape() {
        let json = serde_json::json!({ "answers": { "1": 0.9 } });
        let err = parse_jev_api_response_impl(&labels(), &json).unwrap_err();
        assert_eq!(err.error_code, JevApiErrorCode::UnexpectedShape);
        assert!(err.detail.contains("質問ID 2"));
    }

    #[test]
    fn parse_response_non_numeric_score_is_unexpected_shape() {
        let json = serde_json::json!({ "answers": { "1": "not a number", "2": 0.4 } });
        let err = parse_jev_api_response_impl(&labels(), &json).unwrap_err();
        assert_eq!(err.error_code, JevApiErrorCode::UnexpectedShape);
    }

    #[test]
    fn parse_response_empty_labels_is_always_ok_empty() {
        let json = serde_json::json!({});
        let result = parse_jev_api_response_impl(&[], &json).unwrap();
        assert_eq!(result, vec![]);
    }
}
