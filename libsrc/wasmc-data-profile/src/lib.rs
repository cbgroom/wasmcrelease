wit_bindgen::generate!({
    path: "wit",
    world: "data-profile",
    generate_all,
});

use crate::exports::wasmc::data_profile::profile::{
    BooleanSummary, ColumnProfile, Float64Summary, Guest, Int64Summary, LengthSummary,
    ProfileError, Summary, Uint64Summary,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot, Column, DataType as WitDataType,
};
use arrow_arith::aggregate::{max, min, sum_checked};
use arrow_array::types::{Float64Type, Int64Type, UInt64Type};
use arrow_array::{Array, Float64Array, Int64Array, UInt64Array};
use std::collections::BTreeSet;

struct DataProfile;

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

fn validate_batch(value: &BatchSnapshot) -> Result<(), ProfileError> {
    if value.fields.len() != value.columns.len() {
        return Err(ProfileError::InvalidBatch);
    }
    let rows = value.rows as usize;
    let mut names = BTreeSet::new();
    for (field, column) in value.fields.iter().zip(&value.columns) {
        if field.name.is_empty()
            || !names.insert(field.name.clone())
            || column_type(column) != field.data_type
            || column_len(column) != rows
            || (!field.nullable && column_has_null(column))
        {
            return Err(ProfileError::InvalidBatch);
        }
    }
    Ok(())
}

fn mean_i64(values: &Int64Array) -> Result<Option<f64>, ProfileError> {
    let non_null = values.len() - values.null_count();
    if non_null == 0 {
        return Ok(None);
    }
    let sum = sum_checked::<Int64Type>(values).map_err(|_| ProfileError::Overflow)?;
    Ok(sum.map(|value| value as f64 / non_null as f64))
}

fn mean_u64(values: &UInt64Array) -> Result<Option<f64>, ProfileError> {
    let non_null = values.len() - values.null_count();
    if non_null == 0 {
        return Ok(None);
    }
    let sum = sum_checked::<UInt64Type>(values).map_err(|_| ProfileError::Overflow)?;
    Ok(sum.map(|value| value as f64 / non_null as f64))
}

fn mean_f64(values: &Float64Array) -> Result<Option<f64>, ProfileError> {
    let non_null = values.len() - values.null_count();
    if non_null == 0 {
        return Ok(None);
    }
    let sum = sum_checked::<Float64Type>(values).map_err(|_| ProfileError::ComputeFailure)?;
    Ok(sum.map(|value| value / non_null as f64))
}

fn length_summary<'a>(
    values: impl Iterator<Item = Option<&'a [u8]>>,
) -> Result<LengthSummary, ProfileError> {
    let mut non_null = 0u64;
    let mut nulls = 0u64;
    let mut total = 0u64;
    let mut min_len: Option<u32> = None;
    let mut max_len: Option<u32> = None;

    for value in values {
        match value {
            None => nulls += 1,
            Some(value) => {
                non_null += 1;
                let len = u32::try_from(value.len()).map_err(|_| ProfileError::Overflow)?;
                total = total
                    .checked_add(len as u64)
                    .ok_or(ProfileError::Overflow)?;
                min_len = Some(min_len.map_or(len, |current| current.min(len)));
                max_len = Some(max_len.map_or(len, |current| current.max(len)));
            }
        }
    }

    Ok(LengthSummary {
        non_null,
        nulls,
        min_length: min_len,
        max_length: max_len,
        mean_length: if non_null == 0 {
            None
        } else {
            Some(total as f64 / non_null as f64)
        },
    })
}

fn profile_column(column: &Column) -> Result<Summary, ProfileError> {
    Ok(match column {
        Column::BooleanColumn(values) => {
            let mut true_count = 0u64;
            let mut false_count = 0u64;
            let mut nulls = 0u64;
            for value in values {
                match value {
                    Some(true) => true_count += 1,
                    Some(false) => false_count += 1,
                    None => nulls += 1,
                }
            }
            Summary::Boolean(BooleanSummary {
                non_null: true_count + false_count,
                nulls,
                true_count,
                false_count,
            })
        }
        Column::Int64Column(values) => {
            let array = Int64Array::from(values.clone());
            Summary::Int64(Int64Summary {
                non_null: (array.len() - array.null_count()) as u64,
                nulls: array.null_count() as u64,
                min: min::<Int64Type>(&array),
                max: max::<Int64Type>(&array),
                mean: mean_i64(&array)?,
            })
        }
        Column::Uint64Column(values) => {
            let array = UInt64Array::from(values.clone());
            Summary::Uint64(Uint64Summary {
                non_null: (array.len() - array.null_count()) as u64,
                nulls: array.null_count() as u64,
                min: min::<UInt64Type>(&array),
                max: max::<UInt64Type>(&array),
                mean: mean_u64(&array)?,
            })
        }
        Column::Float64Column(values) => {
            let array = Float64Array::from(values.clone());
            Summary::Float64(Float64Summary {
                non_null: (array.len() - array.null_count()) as u64,
                nulls: array.null_count() as u64,
                min: min::<Float64Type>(&array),
                max: max::<Float64Type>(&array),
                mean: mean_f64(&array)?,
            })
        }
        Column::Utf8Column(values) => Summary::Utf8(length_summary(
            values
                .iter()
                .map(|value| value.as_ref().map(|value| value.as_bytes())),
        )?),
        Column::BinaryColumn(values) => Summary::Binary(length_summary(
            values
                .iter()
                .map(|value| value.as_ref().map(Vec::as_slice)),
        )?),
    })
}

impl Guest for DataProfile {
    fn describe(
        value: BatchSnapshot,
        columns: Vec<u32>,
    ) -> Result<Vec<ColumnProfile>, ProfileError> {
        validate_batch(&value)?;

        let selected = if columns.is_empty() {
            (0..value.fields.len()).collect::<Vec<_>>()
        } else {
            let mut seen = BTreeSet::new();
            columns
                .into_iter()
                .map(|column| {
                    let index = column as usize;
                    if index >= value.fields.len() {
                        return Err(ProfileError::ColumnOutOfBounds);
                    }
                    if !seen.insert(index) {
                        return Err(ProfileError::DuplicateColumn);
                    }
                    Ok(index)
                })
                .collect::<Result<Vec<_>, _>>()?
        };

        selected
            .into_iter()
            .map(|index| {
                let field = &value.fields[index];
                Ok(ColumnProfile {
                    column: index as u32,
                    name: field.name.clone(),
                    data_type: field.data_type,
                    summary: profile_column(&value.columns[index])?,
                })
            })
            .collect()
    }
}

export!(DataProfile);
