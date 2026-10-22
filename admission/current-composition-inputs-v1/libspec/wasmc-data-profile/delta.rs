use crate::data_arrow::{self, BatchSnapshot, Column, DataType};
use arrow_arith::aggregate::{max, min, sum_checked};
use arrow_array::types::{Float64Type, Int64Type, UInt64Type};
use arrow_array::{Array, Float64Array, Int64Array, UInt64Array};
use std::collections::BTreeSet;

#[derive(Clone, Debug, PartialEq)]
pub struct BooleanSummary {
    pub non_null: u64,
    pub nulls: u64,
    pub true_count: u64,
    pub false_count: u64,
}
#[derive(Clone, Debug, PartialEq)]
pub struct Int64Summary {
    pub non_null: u64,
    pub nulls: u64,
    pub min: Option<i64>,
    pub max: Option<i64>,
    pub mean: Option<f64>,
}
#[derive(Clone, Debug, PartialEq)]
pub struct Uint64Summary {
    pub non_null: u64,
    pub nulls: u64,
    pub min: Option<u64>,
    pub max: Option<u64>,
    pub mean: Option<f64>,
}
#[derive(Clone, Debug, PartialEq)]
pub struct Float64Summary {
    pub non_null: u64,
    pub nulls: u64,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub mean: Option<f64>,
}
#[derive(Clone, Debug, PartialEq)]
pub struct LengthSummary {
    pub non_null: u64,
    pub nulls: u64,
    pub min_length: Option<u32>,
    pub max_length: Option<u32>,
    pub mean_length: Option<f64>,
}
#[derive(Clone, Debug, PartialEq)]
pub enum Summary {
    Boolean(BooleanSummary),
    Int64(Int64Summary),
    Uint64(Uint64Summary),
    Float64(Float64Summary),
    Utf8(LengthSummary),
    Binary(LengthSummary),
}
#[derive(Clone, Debug, PartialEq)]
pub struct ColumnProfile {
    pub column: u32,
    pub name: String,
    pub data_type: DataType,
    pub summary: Summary,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InvalidBatch,
    ColumnOutOfBounds,
    DuplicateColumn,
    Overflow,
    ComputeFailure,
}

fn mean_i64(values: &Int64Array) -> Result<Option<f64>, Error> {
    let non_null = values.len() - values.null_count();
    if non_null == 0 { return Ok(None); }
    let sum = sum_checked::<Int64Type>(values).map_err(|_| Error::Overflow)?;
    Ok(sum.map(|value| value as f64 / non_null as f64))
}
fn mean_u64(values: &UInt64Array) -> Result<Option<f64>, Error> {
    let non_null = values.len() - values.null_count();
    if non_null == 0 { return Ok(None); }
    let sum = sum_checked::<UInt64Type>(values).map_err(|_| Error::Overflow)?;
    Ok(sum.map(|value| value as f64 / non_null as f64))
}
fn mean_f64(values: &Float64Array) -> Result<Option<f64>, Error> {
    let non_null = values.len() - values.null_count();
    if non_null == 0 { return Ok(None); }
    let sum = sum_checked::<Float64Type>(values).map_err(|_| Error::ComputeFailure)?;
    Ok(sum.map(|value| value / non_null as f64))
}
fn length_summary<'a>(
    values: impl Iterator<Item = Option<&'a [u8]>>,
) -> Result<LengthSummary, Error> {
    let mut non_null = 0u64;
    let mut nulls = 0u64;
    let mut total = 0u64;
    let mut min_length = None;
    let mut max_length = None;
    for value in values {
        match value {
            None => nulls += 1,
            Some(value) => {
                non_null += 1;
                let len = u32::try_from(value.len()).map_err(|_| Error::Overflow)?;
                total = total.checked_add(len as u64).ok_or(Error::Overflow)?;
                min_length = Some(min_length.map_or(len, |current: u32| current.min(len)));
                max_length = Some(max_length.map_or(len, |current: u32| current.max(len)));
            }
        }
    }
    Ok(LengthSummary {
        non_null,
        nulls,
        min_length,
        max_length,
        mean_length: (non_null != 0).then_some(total as f64 / non_null.max(1) as f64),
    })
}
fn profile_column(column: &Column) -> Result<Summary, Error> {
    Ok(match column {
        Column::Boolean(values) => {
            let mut true_count=0; let mut false_count=0; let mut nulls=0;
            for value in values {
                match value { Some(true)=>true_count+=1, Some(false)=>false_count+=1, None=>nulls+=1 }
            }
            Summary::Boolean(BooleanSummary { non_null:true_count+false_count, nulls, true_count, false_count })
        }
        Column::Int64(values) => {
            let array=Int64Array::from(values.clone());
            Summary::Int64(Int64Summary { non_null:(array.len()-array.null_count()) as u64, nulls:array.null_count() as u64, min:min::<Int64Type>(&array), max:max::<Int64Type>(&array), mean:mean_i64(&array)? })
        }
        Column::Uint64(values) => {
            let array=UInt64Array::from(values.clone());
            Summary::Uint64(Uint64Summary { non_null:(array.len()-array.null_count()) as u64, nulls:array.null_count() as u64, min:min::<UInt64Type>(&array), max:max::<UInt64Type>(&array), mean:mean_u64(&array)? })
        }
        Column::Float64(values) => {
            let array=Float64Array::from(values.clone());
            Summary::Float64(Float64Summary { non_null:(array.len()-array.null_count()) as u64, nulls:array.null_count() as u64, min:min::<Float64Type>(&array), max:max::<Float64Type>(&array), mean:mean_f64(&array)? })
        }
        Column::Utf8(values) => Summary::Utf8(length_summary(values.iter().map(|v|v.as_ref().map(|v|v.as_bytes())))?),
        Column::Binary(values) => Summary::Binary(length_summary(values.iter().map(|v|v.as_ref().map(Vec::as_slice)))?),
    })
}
pub fn describe(value: BatchSnapshot, columns: Vec<u32>) -> Result<Vec<ColumnProfile>, Error> {
    data_arrow::validate_snapshot(&value).map_err(|_| Error::InvalidBatch)?;
    let selected = if columns.is_empty() {
        (0..value.fields.len()).collect::<Vec<_>>()
    } else {
        let mut seen=BTreeSet::new();
        columns.into_iter().map(|column| {
            let index=column as usize;
            if index>=value.fields.len(){return Err(Error::ColumnOutOfBounds)}
            if !seen.insert(index){return Err(Error::DuplicateColumn)}
            Ok(index)
        }).collect::<Result<Vec<_>,_>>()?
    };
    selected.into_iter().map(|index| {
        let field=&value.fields[index];
        Ok(ColumnProfile { column:index as u32, name:field.name.clone(), data_type:field.data_type, summary:profile_column(&value.columns[index])? })
    }).collect()
}
