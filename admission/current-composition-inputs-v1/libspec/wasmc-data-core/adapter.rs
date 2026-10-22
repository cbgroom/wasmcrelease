use crate::delta;
use crate::exports::wasmc::data_core::model::{
    BatchSnapshot as WitBatchSnapshot, DataError, Guest,
};
use crate::exports::wasmc::data_core::types::{
    Column as WitColumn, DataType as WitDataType, Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);

pub struct Adapter;

fn map_model_error(error: crate::data_arrow::Error) -> DataError {
    match error {
        crate::data_arrow::Error::ColumnCountMismatch => DataError::ColumnCountMismatch,
        crate::data_arrow::Error::RowCountMismatch => DataError::RowCountMismatch,
        crate::data_arrow::Error::TypeMismatch => DataError::TypeMismatch,
        crate::data_arrow::Error::NullabilityViolation => DataError::NullabilityViolation,
        crate::data_arrow::Error::EmptyFieldName => DataError::EmptyFieldName,
        crate::data_arrow::Error::DuplicateFieldName => DataError::DuplicateFieldName,
        crate::data_arrow::Error::InvalidLayout | crate::data_arrow::Error::UnsupportedType => {
            DataError::InvalidLayout
        }
    }
}

fn map_error(error: delta::Error) -> DataError {
    match error {
        delta::Error::Model(error) => map_model_error(error),
        delta::Error::IndexOutOfBounds => DataError::IndexOutOfBounds,
    }
}

impl Guest for Adapter {
    fn validate(value: WitBatchSnapshot) -> Result<u32, DataError> {
        delta::validate(batch_from_wit(value)).map_err(map_error)
    }

    fn take(value: WitBatchSnapshot, indices: Vec<u32>) -> Result<WitBatchSnapshot, DataError> {
        delta::take(batch_from_wit(value), indices)
            .map(batch_to_wit)
            .map_err(map_error)
    }
}
