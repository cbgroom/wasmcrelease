mod bindings {
    wit_bindgen::generate!({ path: "../../lib.wit", world: "json" });
}
mod logic;
use bindings::exports::wasmc::json::document::{Guest, JsonError, SelectedValue, SelectionView};
struct Component;
fn select_values(input: &[u8], pointers: &[String]) -> Result<Vec<SelectedValue>, JsonError> {
    logic::select(input, pointers)
        .map(|values| values.into_iter().map(|value| SelectedValue {
            present: value.is_some(),
            json: value.unwrap_or_default(),
        }).collect())
        .map_err(Into::into)
}
impl From<logic::JsonError> for JsonError {
    fn from(error: logic::JsonError) -> Self {
        match error {
            logic::JsonError::InputTooLarge => Self::InputTooLarge,
            logic::JsonError::DepthLimit => Self::DepthLimit,
            logic::JsonError::InvalidJson => Self::InvalidJson,
            logic::JsonError::TooManyPointers => Self::TooManyPointers,
            logic::JsonError::PointerTooLong => Self::PointerTooLong,
            logic::JsonError::InvalidPointer => Self::InvalidPointer,
            logic::JsonError::OutputTooLarge => Self::OutputTooLarge,
        }
    }
}
impl Guest for Component {
    fn inspect_values_bytes(input: Vec<u8>, pointers: Vec<String>) -> SelectionView {
        match select_values(&input, &pointers) {
            Ok(values) => SelectionView { valid: true, values, error: None },
            Err(error) => SelectionView { valid: false, values: Vec::new(), error: Some(error) },
        }
    }
    fn compact_or(input: String, fallback: String) -> String {
        logic::compact(input.as_bytes()).unwrap_or(fallback)
    }
    fn decode_string_or(input: String, fallback: String) -> String {
        if logic::validate(input.as_bytes()).is_err() { return fallback; }
        serde_json::from_str::<String>(&input).unwrap_or(fallback)
    }
    fn select_string_or_bytes(input: Vec<u8>, pointer: String, fallback: String) -> String {
        logic::select(&input, &[pointer]).ok()
            .and_then(|mut values| values.pop().flatten())
            .and_then(|json| serde_json::from_str::<String>(&json).ok())
            .unwrap_or(fallback)
    }
    fn compact_or_bytes(input: Vec<u8>, fallback: String) -> String {
        logic::compact(&input).unwrap_or(fallback)
    }
    fn compact(input: String) -> Result<String, JsonError> {
        logic::compact(input.as_bytes()).map_err(Into::into)
    }
    fn select(input: String, pointers: Vec<String>) -> Result<Vec<Option<String>>, JsonError> {
        logic::select(input.as_bytes(), &pointers).map_err(Into::into)
    }
    fn validate(input: String) -> Result<(), JsonError> {
        logic::validate(input.as_bytes()).map_err(Into::into)
    }
    fn compact_bytes(input: Vec<u8>) -> Result<String, JsonError> {
        logic::compact(&input).map_err(Into::into)
    }
    fn select_bytes(input: Vec<u8>, pointers: Vec<String>) -> Result<Vec<Option<String>>, JsonError> {
        logic::select(&input, &pointers).map_err(Into::into)
    }
    fn validate_bytes(input: Vec<u8>) -> Result<(), JsonError> {
        logic::validate(&input).map_err(Into::into)
    }
    fn select_values(input: String, pointers: Vec<String>) -> Result<Vec<SelectedValue>, JsonError> {
        select_values(input.as_bytes(), &pointers)
    }
    fn select_values_bytes(input: Vec<u8>, pointers: Vec<String>) -> Result<Vec<SelectedValue>, JsonError> {
        select_values(&input, &pointers)
    }
}
bindings::export!(Component with_types_in bindings);
