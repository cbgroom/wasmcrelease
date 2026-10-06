use crate::data_arrow::{self, BatchSnapshot, Column, Field};
use arrow_array::BooleanArray;
use arrow_ord::sort::{lexsort_to_indices, SortColumn};
use arrow_schema::{Field as ArrowField, Schema, SortOptions};
use arrow_select::filter::filter_record_batch;
use arrow_select::take::take_record_batch;
use std::collections::BTreeSet;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SortKey {
    pub column: u32,
    pub descending: bool,
    pub nulls_first: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InvalidBatch,
    MaskTypeMismatch,
    MaskLengthMismatch,
    ColumnOutOfBounds,
    DuplicateColumn,
    EmptySort,
    ComputeFailure,
}

fn batch(value: &BatchSnapshot) -> Result<arrow_array::RecordBatch, Error> {
    data_arrow::validate_snapshot(value).map_err(|_| Error::InvalidBatch)
}

fn snapshot(
    value: &arrow_array::RecordBatch,
    fields: &[Field],
) -> Result<BatchSnapshot, Error> {
    data_arrow::snapshot_from_batch_with_fields(value, fields).map_err(|_| Error::ComputeFailure)
}

pub fn filter(value: BatchSnapshot, mask: Column) -> Result<BatchSnapshot, Error> {
    let batch = batch(&value)?;
    let values = match mask {
        Column::Boolean(values) => values,
        _ => return Err(Error::MaskTypeMismatch),
    };
    if values.len() != value.rows as usize {
        return Err(Error::MaskLengthMismatch);
    }
    let predicate = BooleanArray::from(values);
    let filtered = filter_record_batch(&batch, &predicate).map_err(|_| Error::ComputeFailure)?;
    snapshot(&filtered, &value.fields)
}

pub fn project(value: BatchSnapshot, columns: Vec<u32>) -> Result<BatchSnapshot, Error> {
    let batch = batch(&value)?;
    let mut seen = BTreeSet::new();
    let mut fields = Vec::with_capacity(columns.len());
    let mut arrays = Vec::with_capacity(columns.len());
    for column in columns {
        let index = column as usize;
        if index >= value.fields.len() {
            return Err(Error::ColumnOutOfBounds);
        }
        if !seen.insert(index) {
            return Err(Error::DuplicateColumn);
        }
        fields.push(value.fields[index].clone());
        arrays.push(batch.column(index).clone());
    }
    let arrow_fields = fields
        .iter()
        .map(|field| ArrowField::new(
            field.name.clone(),
            data_arrow::arrow_type(field.data_type),
            field.nullable,
        ))
        .collect::<Vec<_>>();
    let schema = Arc::new(Schema::new(arrow_fields));
    let options = arrow_array::RecordBatchOptions::new().with_row_count(Some(value.rows as usize));
    let projected = arrow_array::RecordBatch::try_new_with_options(schema, arrays, &options)
        .map_err(|_| Error::ComputeFailure)?;
    snapshot(&projected, &fields)
}

pub fn sort(
    value: BatchSnapshot,
    keys: Vec<SortKey>,
    limit: Option<u32>,
) -> Result<BatchSnapshot, Error> {
    let batch = batch(&value)?;
    if keys.is_empty() {
        return Err(Error::EmptySort);
    }
    let mut seen = BTreeSet::new();
    let mut columns = Vec::with_capacity(keys.len());
    for key in keys {
        let index = key.column as usize;
        if index >= batch.num_columns() {
            return Err(Error::ColumnOutOfBounds);
        }
        if !seen.insert(index) {
            return Err(Error::DuplicateColumn);
        }
        columns.push(SortColumn {
            values: batch.column(index).clone(),
            options: Some(SortOptions {
                descending: key.descending,
                nulls_first: key.nulls_first,
            }),
        });
    }
    let indices = lexsort_to_indices(&columns, limit.map(|value| value as usize))
        .map_err(|_| Error::ComputeFailure)?;
    let sorted = take_record_batch(&batch, &indices).map_err(|_| Error::ComputeFailure)?;
    snapshot(&sorted, &value.fields)
}
