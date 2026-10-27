use crate::exports::wasmc::json::document::{
    BooleanValue, Edit, EditKind, FloatValue, Guest, JsonError, JsonField, SelectedValue,
    SelectionView, SignedValue, UnsignedValue,
};
pub struct Adapter;
fn select_values(input: &[u8], pointers: &[String]) -> Result<Vec<SelectedValue>, JsonError> {
    crate::delta::select(input, pointers)
        .map(|values| {
            values
                .into_iter()
                .map(|value| SelectedValue {
                    present: value.is_some(),
                    json: value.unwrap_or_default(),
                })
                .collect()
        })
        .map_err(Into::into)
}
impl From<crate::delta::Error> for JsonError {
    fn from(error: crate::delta::Error) -> Self {
        match error {
            crate::delta::Error::InvalidJson => Self::InvalidJson,
            crate::delta::Error::InvalidPointer => Self::InvalidPointer,
            crate::delta::Error::MissingTarget => Self::MissingTarget,
            crate::delta::Error::TypeMismatch => Self::TypeMismatch,
            crate::delta::Error::InvalidIndex => Self::InvalidIndex,
            crate::delta::Error::OutOfRange => Self::OutOfRange,
            crate::delta::Error::InvalidOperation => Self::InvalidOperation,
            crate::delta::Error::AllocationFailed => Self::AllocationFailed,
        }
    }
}
impl Guest for Adapter {
    fn inspect_values_bytes(input: Vec<u8>, pointers: Vec<String>) -> SelectionView {
        match select_values(&input, &pointers) {
            Ok(values) => SelectionView {
                valid: true,
                values,
                error: None,
            },
            Err(error) => SelectionView {
                valid: false,
                values: Vec::new(),
                error: Some(error),
            },
        }
    }
    fn compact_or(input: String, fallback: String) -> String {
        crate::delta::compact(input.as_bytes()).unwrap_or(fallback)
    }
    fn decode_string_or(input: String, fallback: String) -> String {
        if crate::delta::validate(input.as_bytes()).is_err() {
            return fallback;
        }
        serde_json::from_str::<String>(&input).unwrap_or(fallback)
    }
    fn select_string_or_bytes(input: Vec<u8>, pointer: String, fallback: String) -> String {
        crate::delta::select(&input, &[pointer])
            .ok()
            .and_then(|mut values| values.pop().flatten())
            .and_then(|json| serde_json::from_str::<String>(&json).ok())
            .unwrap_or(fallback)
    }
    fn compact_or_bytes(input: Vec<u8>, fallback: String) -> String {
        crate::delta::compact(&input).unwrap_or(fallback)
    }
    fn compact(input: String) -> Result<String, JsonError> {
        crate::delta::compact(input.as_bytes()).map_err(Into::into)
    }
    fn select(input: String, pointers: Vec<String>) -> Result<Vec<Option<String>>, JsonError> {
        crate::delta::select(input.as_bytes(), &pointers).map_err(Into::into)
    }
    fn validate(input: String) -> Result<(), JsonError> {
        crate::delta::validate(input.as_bytes()).map_err(Into::into)
    }
    fn compact_bytes(input: Vec<u8>) -> Result<String, JsonError> {
        crate::delta::compact(&input).map_err(Into::into)
    }
    fn select_bytes(
        input: Vec<u8>,
        pointers: Vec<String>,
    ) -> Result<Vec<Option<String>>, JsonError> {
        crate::delta::select(&input, &pointers).map_err(Into::into)
    }
    fn validate_bytes(input: Vec<u8>) -> Result<(), JsonError> {
        crate::delta::validate(&input).map_err(Into::into)
    }
    fn select_values(
        input: String,
        pointers: Vec<String>,
    ) -> Result<Vec<SelectedValue>, JsonError> {
        select_values(input.as_bytes(), &pointers)
    }
    fn select_values_bytes(
        input: Vec<u8>,
        pointers: Vec<String>,
    ) -> Result<Vec<SelectedValue>, JsonError> {
        select_values(&input, &pointers)
    }

    fn quote_string(input: String) -> String {
        crate::delta::quote(&input)
    }
    fn object_from_fields(fields: Vec<JsonField>) -> Result<String, JsonError> {
        crate::delta::object(fields.into_iter().map(|f| (f.name, f.value_json)).collect())
            .map_err(Into::into)
    }
    fn array_from_values(values: Vec<String>) -> Result<String, JsonError> {
        crate::delta::array(values).map_err(Into::into)
    }
    fn edit_bytes(input: Vec<u8>, edits: Vec<Edit>) -> Result<Vec<u8>, JsonError> {
        crate::delta::edit(
            &input,
            edits
                .into_iter()
                .map(|e| crate::delta::Edit {
                    kind: match e.kind {
                        EditKind::Set => crate::delta::EditKind::Set,
                        EditKind::Remove => crate::delta::EditKind::Remove,
                    },
                    path: e.path,
                    value_json: e.value_json,
                })
                .collect(),
        )
        .map(String::into_bytes)
        .map_err(Into::into)
    }
    fn edit_or_bytes(input: Vec<u8>, edits: Vec<Edit>, fallback: String) -> String {
        match Self::edit_bytes(input, edits) {
            Ok(bytes) => String::from_utf8(bytes).unwrap_or(fallback),
            Err(_) => fallback,
        }
    }
    fn read_u64(input: Vec<u8>, pointer: String) -> Result<UnsignedValue, JsonError> {
        crate::delta::read_u64(&input, &pointer)
            .map(|v| UnsignedValue {
                present: v.is_some(),
                value: v.unwrap_or(0),
            })
            .map_err(Into::into)
    }
    fn read_i64(input: Vec<u8>, pointer: String) -> Result<SignedValue, JsonError> {
        crate::delta::read_i64(&input, &pointer)
            .map(|v| SignedValue {
                present: v.is_some(),
                value: v.unwrap_or(0),
            })
            .map_err(Into::into)
    }
    fn read_f64(input: Vec<u8>, pointer: String) -> Result<FloatValue, JsonError> {
        crate::delta::read_f64(&input, &pointer)
            .map(|v| FloatValue {
                present: v.is_some(),
                value: v.unwrap_or(0.0),
            })
            .map_err(Into::into)
    }
    fn read_bool(input: Vec<u8>, pointer: String) -> Result<BooleanValue, JsonError> {
        crate::delta::read_bool(&input, &pointer)
            .map(|v| BooleanValue {
                present: v.is_some(),
                value: v.unwrap_or(false),
            })
            .map_err(Into::into)
    }
}

impl crate::exports::wasmc::json::utf8::Guest for Adapter {
    fn encode(input: String) -> Vec<u8> {
        input.into_bytes()
    }
    fn encode_parts(parts: Vec<String>) -> Vec<u8> {
        parts.concat().into_bytes()
    }
}
