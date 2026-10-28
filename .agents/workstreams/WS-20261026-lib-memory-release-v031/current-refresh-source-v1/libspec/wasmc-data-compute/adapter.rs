use crate::delta;
use crate::exports::wasmc::data_compute::compute::{
    ComputeError, Guest, SortKey as WitSortKey,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot as WitBatchSnapshot, Column as WitColumn, DataType as WitDataType,
    Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);

pub struct Adapter;

fn map_error(error: delta::Error) -> ComputeError {
    match error {
        delta::Error::InvalidBatch => ComputeError::InvalidBatch,
        delta::Error::MaskTypeMismatch => ComputeError::MaskTypeMismatch,
        delta::Error::MaskLengthMismatch => ComputeError::MaskLengthMismatch,
        delta::Error::ColumnOutOfBounds => ComputeError::ColumnOutOfBounds,
        delta::Error::DuplicateColumn => ComputeError::DuplicateColumn,
        delta::Error::EmptySort => ComputeError::EmptySort,
        delta::Error::ComputeFailure => ComputeError::ComputeFailure,
    }
}

impl Guest for Adapter {
    fn filter(value: WitBatchSnapshot, mask: WitColumn) -> Result<WitBatchSnapshot, ComputeError> {
        delta::filter(batch_from_wit(value), column_from_wit(mask))
            .map(batch_to_wit)
            .map_err(map_error)
    }

    fn project(
        value: WitBatchSnapshot,
        columns: Vec<u32>,
    ) -> Result<WitBatchSnapshot, ComputeError> {
        delta::project(batch_from_wit(value), columns)
            .map(batch_to_wit)
            .map_err(map_error)
    }

    fn sort(
        value: WitBatchSnapshot,
        keys: Vec<WitSortKey>,
        limit: Option<u32>,
    ) -> Result<WitBatchSnapshot, ComputeError> {
        let keys = keys
            .into_iter()
            .map(|key| delta::SortKey {
                column: key.column,
                descending: key.descending,
                nulls_first: key.nulls_first,
            })
            .collect();
        delta::sort(batch_from_wit(value), keys, limit)
            .map(batch_to_wit)
            .map_err(map_error)
    }
}
