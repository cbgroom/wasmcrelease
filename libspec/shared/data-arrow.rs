use arrow_array::builder::{BinaryBuilder, StringBuilder};
use arrow_array::{
    Array, ArrayRef, BinaryArray, BooleanArray, Float64Array, Int64Array, RecordBatch,
    RecordBatchOptions, StringArray, UInt64Array,
};
use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema};
use std::collections::BTreeSet;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DataType {
    Boolean,
    Int64,
    Uint64,
    Float64,
    Utf8,
    Binary,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Field {
    pub name: String,
    pub data_type: DataType,
    pub nullable: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Column {
    Boolean(Vec<Option<bool>>),
    Int64(Vec<Option<i64>>),
    Uint64(Vec<Option<u64>>),
    Float64(Vec<Option<f64>>),
    Utf8(Vec<Option<String>>),
    Binary(Vec<Option<Vec<u8>>>),
}

#[derive(Clone, Debug, PartialEq)]
pub struct BatchSnapshot {
    pub rows: u32,
    pub fields: Vec<Field>,
    pub columns: Vec<Column>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    ColumnCountMismatch,
    RowCountMismatch,
    TypeMismatch,
    NullabilityViolation,
    EmptyFieldName,
    DuplicateFieldName,
    InvalidLayout,
    UnsupportedType,
}

pub fn arrow_type(value: DataType) -> ArrowDataType {
    match value {
        DataType::Boolean => ArrowDataType::Boolean,
        DataType::Int64 => ArrowDataType::Int64,
        DataType::Uint64 => ArrowDataType::UInt64,
        DataType::Float64 => ArrowDataType::Float64,
        DataType::Utf8 => ArrowDataType::Utf8,
        DataType::Binary => ArrowDataType::Binary,
    }
}

pub fn data_type_from_arrow(value: &ArrowDataType) -> Result<DataType, Error> {
    match value {
        ArrowDataType::Boolean => Ok(DataType::Boolean),
        ArrowDataType::Int64 => Ok(DataType::Int64),
        ArrowDataType::UInt64 => Ok(DataType::Uint64),
        ArrowDataType::Float64 => Ok(DataType::Float64),
        ArrowDataType::Utf8 => Ok(DataType::Utf8),
        ArrowDataType::Binary => Ok(DataType::Binary),
        _ => Err(Error::UnsupportedType),
    }
}

pub fn column_type(value: &Column) -> DataType {
    match value {
        Column::Boolean(_) => DataType::Boolean,
        Column::Int64(_) => DataType::Int64,
        Column::Uint64(_) => DataType::Uint64,
        Column::Float64(_) => DataType::Float64,
        Column::Utf8(_) => DataType::Utf8,
        Column::Binary(_) => DataType::Binary,
    }
}

pub fn column_len(value: &Column) -> usize {
    match value {
        Column::Boolean(values) => values.len(),
        Column::Int64(values) => values.len(),
        Column::Uint64(values) => values.len(),
        Column::Float64(values) => values.len(),
        Column::Utf8(values) => values.len(),
        Column::Binary(values) => values.len(),
    }
}

pub fn column_has_null(value: &Column) -> bool {
    match value {
        Column::Boolean(values) => values.iter().any(Option::is_none),
        Column::Int64(values) => values.iter().any(Option::is_none),
        Column::Uint64(values) => values.iter().any(Option::is_none),
        Column::Float64(values) => values.iter().any(Option::is_none),
        Column::Utf8(values) => values.iter().any(Option::is_none),
        Column::Binary(values) => values.iter().any(Option::is_none),
    }
}

pub fn column_to_array(value: &Column) -> ArrayRef {
    match value {
        Column::Boolean(values) => Arc::new(BooleanArray::from(values.clone())),
        Column::Int64(values) => Arc::new(Int64Array::from(values.clone())),
        Column::Uint64(values) => Arc::new(UInt64Array::from(values.clone())),
        Column::Float64(values) => Arc::new(Float64Array::from(values.clone())),
        Column::Utf8(values) => {
            let mut builder = StringBuilder::new();
            for value in values {
                match value {
                    Some(value) => builder.append_value(value),
                    None => builder.append_null(),
                }
            }
            Arc::new(builder.finish())
        }
        Column::Binary(values) => {
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

pub fn validate_snapshot(value: &BatchSnapshot) -> Result<RecordBatch, Error> {
    if value.fields.len() != value.columns.len() {
        return Err(Error::ColumnCountMismatch);
    }
    let rows = value.rows as usize;
    let mut names = BTreeSet::new();
    let mut arrow_fields = Vec::with_capacity(value.fields.len());
    let mut arrays = Vec::with_capacity(value.columns.len());
    for (field, column) in value.fields.iter().zip(&value.columns) {
        if field.name.is_empty() {
            return Err(Error::EmptyFieldName);
        }
        if !names.insert(field.name.clone()) {
            return Err(Error::DuplicateFieldName);
        }
        if column_type(column) != field.data_type {
            return Err(Error::TypeMismatch);
        }
        if column_len(column) != rows {
            return Err(Error::RowCountMismatch);
        }
        if !field.nullable && column_has_null(column) {
            return Err(Error::NullabilityViolation);
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
    RecordBatch::try_new_with_options(schema, arrays, &options).map_err(|_| Error::InvalidLayout)
}

fn value_or_none<T: Copy>(
    array: &dyn Array,
    index: usize,
    get: impl Fn(usize) -> T,
) -> Option<T> {
    if array.is_null(index) {
        None
    } else {
        Some(get(index))
    }
}

pub fn array_to_column(data_type: DataType, array: &dyn Array) -> Result<Column, Error> {
    match data_type {
        DataType::Boolean => {
            let values = array
                .as_any()
                .downcast_ref::<BooleanArray>()
                .ok_or(Error::InvalidLayout)?;
            Ok(Column::Boolean(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        DataType::Int64 => {
            let values = array
                .as_any()
                .downcast_ref::<Int64Array>()
                .ok_or(Error::InvalidLayout)?;
            Ok(Column::Int64(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        DataType::Uint64 => {
            let values = array
                .as_any()
                .downcast_ref::<UInt64Array>()
                .ok_or(Error::InvalidLayout)?;
            Ok(Column::Uint64(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        DataType::Float64 => {
            let values = array
                .as_any()
                .downcast_ref::<Float64Array>()
                .ok_or(Error::InvalidLayout)?;
            Ok(Column::Float64(
                (0..values.len())
                    .map(|index| value_or_none(values, index, |index| values.value(index)))
                    .collect(),
            ))
        }
        DataType::Utf8 => {
            let values = array
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(Error::InvalidLayout)?;
            Ok(Column::Utf8(
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
        DataType::Binary => {
            let values = array
                .as_any()
                .downcast_ref::<BinaryArray>()
                .ok_or(Error::InvalidLayout)?;
            Ok(Column::Binary(
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

pub fn snapshot_from_batch_with_fields(
    batch: &RecordBatch,
    fields: &[Field],
) -> Result<BatchSnapshot, Error> {
    if batch.num_columns() != fields.len() {
        return Err(Error::ColumnCountMismatch);
    }
    let columns = fields
        .iter()
        .zip(batch.columns())
        .map(|(field, array)| array_to_column(field.data_type, array.as_ref()))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(BatchSnapshot {
        rows: u32::try_from(batch.num_rows()).map_err(|_| Error::InvalidLayout)?,
        fields: fields.to_vec(),
        columns,
    })
}

pub fn snapshot_from_batch_schema(batch: &RecordBatch) -> Result<BatchSnapshot, Error> {
    let mut names = BTreeSet::new();
    let fields = batch
        .schema()
        .fields()
        .iter()
        .map(|field| {
            if field.name().is_empty() {
                return Err(Error::EmptyFieldName);
            }
            if !names.insert(field.name().clone()) {
                return Err(Error::DuplicateFieldName);
            }
            if !field.is_nullable() {
                let index = batch
                    .schema()
                    .index_of(field.name())
                    .map_err(|_| Error::InvalidLayout)?;
                if batch.column(index).null_count() != 0 {
                    return Err(Error::NullabilityViolation);
                }
            }
            Ok(Field {
                name: field.name().clone(),
                data_type: data_type_from_arrow(field.data_type())?,
                nullable: field.is_nullable(),
            })
        })
        .collect::<Result<Vec<_>, Error>>()?;
    snapshot_from_batch_with_fields(batch, &fields)
}

#[macro_export]
macro_rules! define_data_arrow_wit_bridge {
    ($wit_data_type:ident, $wit_field:ident, $wit_column:ident, $wit_batch:ident) => {
        fn data_type_from_wit(value: $wit_data_type) -> crate::data_arrow::DataType {
            match value {
                $wit_data_type::Boolean => crate::data_arrow::DataType::Boolean,
                $wit_data_type::Int64 => crate::data_arrow::DataType::Int64,
                $wit_data_type::Uint64 => crate::data_arrow::DataType::Uint64,
                $wit_data_type::Float64 => crate::data_arrow::DataType::Float64,
                $wit_data_type::Utf8 => crate::data_arrow::DataType::Utf8,
                $wit_data_type::Binary => crate::data_arrow::DataType::Binary,
            }
        }

        fn data_type_to_wit(value: crate::data_arrow::DataType) -> $wit_data_type {
            match value {
                crate::data_arrow::DataType::Boolean => $wit_data_type::Boolean,
                crate::data_arrow::DataType::Int64 => $wit_data_type::Int64,
                crate::data_arrow::DataType::Uint64 => $wit_data_type::Uint64,
                crate::data_arrow::DataType::Float64 => $wit_data_type::Float64,
                crate::data_arrow::DataType::Utf8 => $wit_data_type::Utf8,
                crate::data_arrow::DataType::Binary => $wit_data_type::Binary,
            }
        }

        fn field_from_wit(value: $wit_field) -> crate::data_arrow::Field {
            crate::data_arrow::Field {
                name: value.name,
                data_type: data_type_from_wit(value.data_type),
                nullable: value.nullable,
            }
        }

        fn field_to_wit(value: crate::data_arrow::Field) -> $wit_field {
            $wit_field {
                name: value.name,
                data_type: data_type_to_wit(value.data_type),
                nullable: value.nullable,
            }
        }

        fn column_from_wit(value: $wit_column) -> crate::data_arrow::Column {
            match value {
                $wit_column::BooleanColumn(values) => crate::data_arrow::Column::Boolean(values),
                $wit_column::Int64Column(values) => crate::data_arrow::Column::Int64(values),
                $wit_column::Uint64Column(values) => crate::data_arrow::Column::Uint64(values),
                $wit_column::Float64Column(values) => crate::data_arrow::Column::Float64(values),
                $wit_column::Utf8Column(values) => crate::data_arrow::Column::Utf8(values),
                $wit_column::BinaryColumn(values) => crate::data_arrow::Column::Binary(values),
            }
        }

        fn column_to_wit(value: crate::data_arrow::Column) -> $wit_column {
            match value {
                crate::data_arrow::Column::Boolean(values) => $wit_column::BooleanColumn(values),
                crate::data_arrow::Column::Int64(values) => $wit_column::Int64Column(values),
                crate::data_arrow::Column::Uint64(values) => $wit_column::Uint64Column(values),
                crate::data_arrow::Column::Float64(values) => $wit_column::Float64Column(values),
                crate::data_arrow::Column::Utf8(values) => $wit_column::Utf8Column(values),
                crate::data_arrow::Column::Binary(values) => $wit_column::BinaryColumn(values),
            }
        }

        fn batch_from_wit(value: $wit_batch) -> crate::data_arrow::BatchSnapshot {
            crate::data_arrow::BatchSnapshot {
                rows: value.rows,
                fields: value.fields.into_iter().map(field_from_wit).collect(),
                columns: value.columns.into_iter().map(column_from_wit).collect(),
            }
        }

        fn batch_to_wit(value: crate::data_arrow::BatchSnapshot) -> $wit_batch {
            $wit_batch {
                rows: value.rows,
                fields: value.fields.into_iter().map(field_to_wit).collect(),
                columns: value.columns.into_iter().map(column_to_wit).collect(),
            }
        }
    };
}
