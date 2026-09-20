wit_bindgen::generate!({
    path: "wit",
    world: "data-core",
});

use crate::exports::wasmc::data_core::model::{BatchSnapshot, DataError, Guest};
use crate::exports::wasmc::data_core::types::{
    Column, DataType as WitDataType, Field as WitField,
};
use arrow_array::builder::{BinaryBuilder, StringBuilder};
use arrow_array::{
    Array, ArrayRef, BinaryArray, BooleanArray, Float64Array, Int64Array, RecordBatch,
    RecordBatchOptions, StringArray, UInt32Array, UInt64Array,
};
use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema};
use arrow_select::take::{take, TakeOptions};
use std::collections::BTreeSet;
use std::sync::Arc;

struct DataCore;

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

fn to_arrow_column(value: &Column) -> ArrayRef {
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

fn validate_snapshot(value: &BatchSnapshot) -> Result<RecordBatch, DataError> {
    if value.fields.len() != value.columns.len() {
        return Err(DataError::ColumnCountMismatch);
    }

    let rows = value.rows as usize;
    let mut names = BTreeSet::new();
    let mut arrow_fields = Vec::with_capacity(value.fields.len());
    let mut arrays = Vec::with_capacity(value.columns.len());

    for (field, column) in value.fields.iter().zip(&value.columns) {
        if field.name.is_empty() {
            return Err(DataError::EmptyFieldName);
        }
        if !names.insert(field.name.clone()) {
            return Err(DataError::DuplicateFieldName);
        }
        if column_type(column) != field.data_type {
            return Err(DataError::TypeMismatch);
        }
        if column_len(column) != rows {
            return Err(DataError::RowCountMismatch);
        }
        if !field.nullable && column_has_null(column) {
            return Err(DataError::NullabilityViolation);
        }

        arrow_fields.push(ArrowField::new(
            field.name.clone(),
            arrow_type(field.data_type),
            field.nullable,
        ));
        arrays.push(to_arrow_column(column));
    }

    let schema = Arc::new(Schema::new(arrow_fields));
    let options = RecordBatchOptions::new().with_row_count(Some(rows));
    RecordBatch::try_new_with_options(schema, arrays, &options)
        .map_err(|_| DataError::InvalidLayout)
}

fn value_or_none<T: Copy>(array: &dyn Array, index: usize, get: impl Fn(usize) -> T) -> Option<T> {
    if array.is_null(index) {
        None
    } else {
        Some(get(index))
    }
}

fn from_arrow_column(field: &WitField, array: &dyn Array) -> Result<Column, DataError> {
    match field.data_type {
        WitDataType::Boolean => {
            let values = array
                .as_any()
                .downcast_ref::<BooleanArray>()
                .ok_or(DataError::InvalidLayout)?;
            Ok(Column::BooleanColumn(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        WitDataType::Int64 => {
            let values = array
                .as_any()
                .downcast_ref::<Int64Array>()
                .ok_or(DataError::InvalidLayout)?;
            Ok(Column::Int64Column(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        WitDataType::Uint64 => {
            let values = array
                .as_any()
                .downcast_ref::<UInt64Array>()
                .ok_or(DataError::InvalidLayout)?;
            Ok(Column::Uint64Column(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        WitDataType::Float64 => {
            let values = array
                .as_any()
                .downcast_ref::<Float64Array>()
                .ok_or(DataError::InvalidLayout)?;
            Ok(Column::Float64Column(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        WitDataType::Utf8 => {
            let values = array
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(DataError::InvalidLayout)?;
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
                .ok_or(DataError::InvalidLayout)?;
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

fn snapshot_from_batch(batch: &RecordBatch, fields: &[WitField]) -> Result<BatchSnapshot, DataError> {
    let columns = fields
        .iter()
        .zip(batch.columns())
        .map(|(field, array)| from_arrow_column(field, array.as_ref()))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(BatchSnapshot {
        rows: u32::try_from(batch.num_rows()).map_err(|_| DataError::InvalidLayout)?,
        fields: fields.to_vec(),
        columns,
    })
}

impl Guest for DataCore {
    fn validate(value: BatchSnapshot) -> Result<u32, DataError> {
        let batch = validate_snapshot(&value)?;
        u32::try_from(batch.num_rows()).map_err(|_| DataError::InvalidLayout)
    }

    fn take(value: BatchSnapshot, indices: Vec<u32>) -> Result<BatchSnapshot, DataError> {
        let batch = validate_snapshot(&value)?;
        if indices.iter().any(|index| *index >= value.rows) {
            return Err(DataError::IndexOutOfBounds);
        }

        let indices = UInt32Array::from(indices);
        let columns = batch
            .columns()
            .iter()
            .map(|array| {
                take(
                    array.as_ref(),
                    &indices,
                    Some(TakeOptions { check_bounds: true }),
                )
            })
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| DataError::InvalidLayout)?;
        let schema = batch.schema();
        let output = RecordBatch::try_new(schema, columns).map_err(|_| DataError::InvalidLayout)?;
        snapshot_from_batch(&output, &value.fields)
    }
}

export!(DataCore);
