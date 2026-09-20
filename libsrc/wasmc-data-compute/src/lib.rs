wit_bindgen::generate!({
    path: "wit",
    world: "data-compute",
    generate_all,
});

use crate::exports::wasmc::data_compute::compute::{ComputeError, Guest, SortKey};
use crate::wasmc::data_core::types::{
    BatchSnapshot, Column, DataType as WitDataType, Field as WitField,
};
use arrow_array::builder::{BinaryBuilder, StringBuilder};
use arrow_array::{
    Array, ArrayRef, BinaryArray, BooleanArray, Float64Array, Int64Array, RecordBatch,
    RecordBatchOptions, StringArray, UInt64Array,
};
use arrow_ord::sort::{lexsort_to_indices, SortColumn};
use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema, SortOptions};
use arrow_select::filter::filter_record_batch;
use arrow_select::take::take_record_batch;
use std::collections::BTreeSet;
use std::sync::Arc;

struct DataCompute;

fn arrow_type(value: WitDataType) -> ArrowDataType {
    match value {
        WitDataType::Boolean => ArrowDataType::Boolean,
        WitDataType::Int64 => ArrowDataType::Int64,
        WitDataType::Uint64 => ArrowDataType::UInt64,
        WitDataType::Float64 => ArrowDataType::Float64,
        WitDataType::Utf8 => ArrowDataType::Utf8,
        WitDataType::Binary => ArrowDataType::Binary,
    }
}

fn column_type(value: &Column) -> WitDataType {
    match value {
        Column::BooleanColumn(_) => WitDataType::Boolean,
        Column::Int64Column(_) => WitDataType::Int64,
        Column::Uint64Column(_) => WitDataType::Uint64,
        Column::Float64Column(_) => WitDataType::Float64,
        Column::Utf8Column(_) => WitDataType::Utf8,
        Column::BinaryColumn(_) => WitDataType::Binary,
    }
}

fn column_len(value: &Column) -> usize {
    match value {
        Column::BooleanColumn(values) => values.len(),
        Column::Int64Column(values) => values.len(),
        Column::Uint64Column(values) => values.len(),
        Column::Float64Column(values) => values.len(),
        Column::Utf8Column(values) => values.len(),
        Column::BinaryColumn(values) => values.len(),
    }
}

fn column_has_null(value: &Column) -> bool {
    match value {
        Column::BooleanColumn(values) => values.iter().any(Option::is_none),
        Column::Int64Column(values) => values.iter().any(Option::is_none),
        Column::Uint64Column(values) => values.iter().any(Option::is_none),
        Column::Float64Column(values) => values.iter().any(Option::is_none),
        Column::Utf8Column(values) => values.iter().any(Option::is_none),
        Column::BinaryColumn(values) => values.iter().any(Option::is_none),
    }
}

fn column_to_array(value: &Column) -> ArrayRef {
    match value {
        Column::BooleanColumn(values) => Arc::new(BooleanArray::from(values.clone())),
        Column::Int64Column(values) => Arc::new(Int64Array::from(values.clone())),
        Column::Uint64Column(values) => Arc::new(UInt64Array::from(values.clone())),
        Column::Float64Column(values) => Arc::new(Float64Array::from(values.clone())),
        Column::Utf8Column(values) => {
            let mut builder = StringBuilder::new();
            for value in values {
                match value {
                    Some(value) => builder.append_value(value),
                    None => builder.append_null(),
                }
            }
            Arc::new(builder.finish())
        }
        Column::BinaryColumn(values) => {
            let mut builder = BinaryBuilder::new();
            for value in values {
                match value {
                    Some(value) => builder.append_value(value),
                    None => builder.append_null(),
                }
            }
            Arc::new(builder.finish())
        }
    }
}

fn from_arrow_column(field: &WitField, array: &dyn Array) -> Result<Column, ComputeError> {
    match field.data_type {
        WitDataType::Boolean => {
            let values = array
                .as_any()
                .downcast_ref::<BooleanArray>()
                .ok_or(ComputeError::ComputeFailure)?;
            Ok(Column::BooleanColumn(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        WitDataType::Int64 => {
            let values = array
                .as_any()
                .downcast_ref::<Int64Array>()
                .ok_or(ComputeError::ComputeFailure)?;
            Ok(Column::Int64Column(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        WitDataType::Uint64 => {
            let values = array
                .as_any()
                .downcast_ref::<UInt64Array>()
                .ok_or(ComputeError::ComputeFailure)?;
            Ok(Column::Uint64Column(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        WitDataType::Float64 => {
            let values = array
                .as_any()
                .downcast_ref::<Float64Array>()
                .ok_or(ComputeError::ComputeFailure)?;
            Ok(Column::Float64Column(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        WitDataType::Utf8 => {
            let values = array
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(ComputeError::ComputeFailure)?;
            Ok(Column::Utf8Column(
                (0..values.len())
                    .map(|index| {
                        if values.is_null(index) {
                            None
                        } else {
                            Some(values.value(index).to_owned())
                        }
                    })
                    .collect(),
            ))
        }
        WitDataType::Binary => {
            let values = array
                .as_any()
                .downcast_ref::<BinaryArray>()
                .ok_or(ComputeError::ComputeFailure)?;
            Ok(Column::BinaryColumn(
                (0..values.len())
                    .map(|index| {
                        if values.is_null(index) {
                            None
                        } else {
                            Some(values.value(index).to_vec())
                        }
                    })
                    .collect(),
            ))
        }
    }
}

fn validate_snapshot(value: &BatchSnapshot) -> Result<RecordBatch, ComputeError> {
    if value.fields.len() != value.columns.len() {
        return Err(ComputeError::InvalidBatch);
    }
    let rows = value.rows as usize;
    let mut names = BTreeSet::new();
    let mut arrow_fields = Vec::with_capacity(value.fields.len());
    let mut arrays = Vec::with_capacity(value.columns.len());

    for (field, column) in value.fields.iter().zip(&value.columns) {
        if field.name.is_empty() || !names.insert(field.name.clone()) {
            return Err(ComputeError::InvalidBatch);
        }
        if column_type(column) != field.data_type || column_len(column) != rows {
            return Err(ComputeError::InvalidBatch);
        }
        if !field.nullable && column_has_null(column) {
            return Err(ComputeError::InvalidBatch);
        }
        arrow_fields.push(ArrowField::new(
            field.name.clone(),
            arrow_type(field.data_type),
            field.nullable,
        ));
        arrays.push(column_to_array(column));
    }

    let schema = Arc::new(Schema::new(arrow_fields));
    let options = RecordBatchOptions::new().with_row_count(Some(rows));
    RecordBatch::try_new_with_options(schema, arrays, &options)
        .map_err(|_| ComputeError::InvalidBatch)
}

fn snapshot_from_batch(
    batch: &RecordBatch,
    fields: &[WitField],
) -> Result<BatchSnapshot, ComputeError> {
    if batch.num_columns() != fields.len() {
        return Err(ComputeError::ComputeFailure);
    }
    let columns = fields
        .iter()
        .zip(batch.columns())
        .map(|(field, array)| from_arrow_column(field, array.as_ref()))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(BatchSnapshot {
        rows: u32::try_from(batch.num_rows()).map_err(|_| ComputeError::ComputeFailure)?,
        fields: fields.to_vec(),
        columns,
    })
}

impl Guest for DataCompute {
    fn filter(value: BatchSnapshot, mask: Column) -> Result<BatchSnapshot, ComputeError> {
        let batch = validate_snapshot(&value)?;
        let values = match mask {
            Column::BooleanColumn(values) => values,
            _ => return Err(ComputeError::MaskTypeMismatch),
        };
        if values.len() != value.rows as usize {
            return Err(ComputeError::MaskLengthMismatch);
        }
        let predicate = BooleanArray::from(values);
        let filtered = filter_record_batch(&batch, &predicate)
            .map_err(|_| ComputeError::ComputeFailure)?;
        snapshot_from_batch(&filtered, &value.fields)
    }

    fn project(
        value: BatchSnapshot,
        columns: Vec<u32>,
    ) -> Result<BatchSnapshot, ComputeError> {
        let batch = validate_snapshot(&value)?;
        let mut seen = BTreeSet::new();
        let mut fields = Vec::with_capacity(columns.len());
        let mut arrays = Vec::with_capacity(columns.len());

        for column in columns {
            let index = column as usize;
            if index >= value.fields.len() {
                return Err(ComputeError::ColumnOutOfBounds);
            }
            if !seen.insert(index) {
                return Err(ComputeError::DuplicateColumn);
            }
            fields.push(value.fields[index].clone());
            arrays.push(batch.column(index).clone());
        }

        let arrow_fields = fields
            .iter()
            .map(|field| {
                ArrowField::new(
                    field.name.clone(),
                    arrow_type(field.data_type),
                    field.nullable,
                )
            })
            .collect::<Vec<_>>();
        let schema = Arc::new(Schema::new(arrow_fields));
        let options = RecordBatchOptions::new().with_row_count(Some(value.rows as usize));
        let projected = RecordBatch::try_new_with_options(schema, arrays, &options)
            .map_err(|_| ComputeError::ComputeFailure)?;
        snapshot_from_batch(&projected, &fields)
    }

    fn sort(
        value: BatchSnapshot,
        keys: Vec<SortKey>,
        limit: Option<u32>,
    ) -> Result<BatchSnapshot, ComputeError> {
        let batch = validate_snapshot(&value)?;
        if keys.is_empty() {
            return Err(ComputeError::EmptySort);
        }

        let mut seen = BTreeSet::new();
        let mut columns = Vec::with_capacity(keys.len());
        for key in keys {
            let index = key.column as usize;
            if index >= batch.num_columns() {
                return Err(ComputeError::ColumnOutOfBounds);
            }
            if !seen.insert(index) {
                return Err(ComputeError::DuplicateColumn);
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
            .map_err(|_| ComputeError::ComputeFailure)?;
        let sorted = take_record_batch(&batch, &indices)
            .map_err(|_| ComputeError::ComputeFailure)?;
        snapshot_from_batch(&sorted, &value.fields)
    }
}

export!(DataCompute);
