use crate::data_arrow::{self, BatchSnapshot, Column, DataType, Field};
use arrow_arith::aggregate::{max, min, sum_checked};
use arrow_array::types::{Float64Type, Int64Type, UInt64Type};
use arrow_array::{Array, ArrayRef, Float64Array, Int64Array, UInt32Array, UInt64Array};
use arrow_select::take::take;
use ordered_float::OrderedFloat;
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ColumnAggregate { pub column: u32, pub alias: String }
#[derive(Clone, Debug, PartialEq)]
pub enum Aggregate {
    CountAll(String), Count(ColumnAggregate), Sum(ColumnAggregate), Min(ColumnAggregate),
    Max(ColumnAggregate), Mean(ColumnAggregate), First(ColumnAggregate), Last(ColumnAggregate),
    VariancePop(ColumnAggregate), StddevPop(ColumnAggregate),
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct JoinKey { pub left_column: u32, pub right_column: u32 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JoinKind { Inner, Left }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JoinOptions { pub kind: JoinKind, pub right_prefix: String, pub max_output_rows: u32 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WindowOrder { pub column: u32, pub descending: bool, pub nulls_first: bool }
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum WindowFunction { RowNumber(String), Rank(String), DenseRank(String) }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WindowOptions { pub max_rows: u32 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RowsFrameStart { Unbounded, Preceding(u32), CurrentRow, Following(u32) }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RowsFrameEnd { Preceding(u32), CurrentRow, Following(u32), Unbounded }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RowsFrame { pub start: RowsFrameStart, pub end: RowsFrameEnd }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DistinctOptions { pub max_rows: u32 }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OffsetWindow { pub column: u32, pub offset: u32, pub alias: String }
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OffsetWindowFunction { Lag(OffsetWindow), Lead(OffsetWindow) }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InvalidBatch, EmptyInput, EmptyKeys, EmptyOrder, EmptyFunctions, SchemaMismatch,
    KeyTypeMismatch, ColumnOutOfBounds, DuplicateKey, DuplicateFunction, EmptyAlias,
    DuplicateOutputName, InvalidLimit, RowLimitExceeded, OutputLimitExceeded,
    UnsupportedType, UnsupportedFunction, InvalidFrame, Overflow, ComputeFailure,
}

fn validate_batch(value: &BatchSnapshot) -> Result<Vec<ArrayRef>, Error> {
    let batch = data_arrow::validate_snapshot(value).map_err(|_| Error::InvalidBatch)?;
    Ok(batch.columns().to_vec())
}

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
enum Cell {
    Null,
    Bool(bool),
    Int64(i64),
    UInt64(u64),
    Float64(OrderedFloat<f64>),
    Utf8(String),
    Binary(Vec<u8>),
}

#[derive(Clone, Copy, Debug)]
enum AggKind {
    CountAll,
    Count,
    Sum,
    Min,
    Max,
    Mean,
    First,
    Last,
    VariancePop,
    StddevPop,
}

#[derive(Clone, Debug)]
struct AggDesc {
    kind: AggKind,
    column: Option<usize>,
    alias: String,
    input_type: Option<DataType>,
}

#[derive(Clone, Copy, Debug)]
enum WindowKind {
    RowNumber,
    Rank,
    DenseRank,
}

#[derive(Clone, Debug)]
struct WindowDesc {
    kind: WindowKind,
    alias: String,
}

#[derive(Clone, Copy, Debug)]
enum OffsetWindowKind {
    Lag,
    Lead,
}

#[derive(Clone, Debug)]
struct OffsetWindowDesc {
    kind: OffsetWindowKind,
    column: usize,
    offset: usize,
    alias: String,
    data_type: DataType,
}

enum AggValue {
    UInt64(Option<u64>),
    Int64(Option<i64>),
    Float64(Option<f64>),
    Cell(Cell),
}

fn same_schema(left: &[Field], right: &[Field]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right).all(|(left, right)| {
            left.name == right.name
                && left.data_type == right.data_type
                && left.nullable == right.nullable
        })
}

fn append_column(target: &mut Column, source: Column) -> Result<(), Error> {
    match (target, source) {
        (Column::Boolean(target), Column::Boolean(mut source)) => {
            target.append(&mut source)
        }
        (Column::Int64(target), Column::Int64(mut source)) => {
            target.append(&mut source)
        }
        (Column::Uint64(target), Column::Uint64(mut source)) => {
            target.append(&mut source)
        }
        (Column::Float64(target), Column::Float64(mut source)) => {
            target.append(&mut source)
        }
        (Column::Utf8(target), Column::Utf8(mut source)) => target.append(&mut source),
        (Column::Binary(target), Column::Binary(mut source)) => {
            target.append(&mut source)
        }
        _ => return Err(Error::SchemaMismatch),
    }
    Ok(())
}

fn row_key(columns: &[Column], indices: &[usize], row: usize) -> Option<Vec<Cell>> {
    let key = indices
        .iter()
        .map(|index| cell_at(&columns[*index], row))
        .collect::<Vec<_>>();
    (!key.iter().any(|cell| matches!(cell, Cell::Null))).then_some(key)
}

fn push_join_pair(
    pairs: &mut Vec<(u32, Option<u32>)>,
    pair: (u32, Option<u32>),
    max_output_rows: u32,
) -> Result<(), Error> {
    if pairs.len() >= max_output_rows as usize {
        return Err(Error::OutputLimitExceeded);
    }
    pairs.push(pair);
    Ok(())
}

fn compare_window_cell(left: &Cell, right: &Cell, descending: bool, nulls_first: bool) -> Ordering {
    match (left, right) {
        (Cell::Null, Cell::Null) => Ordering::Equal,
        (Cell::Null, _) => {
            if nulls_first {
                Ordering::Less
            } else {
                Ordering::Greater
            }
        }
        (_, Cell::Null) => {
            if nulls_first {
                Ordering::Greater
            } else {
                Ordering::Less
            }
        }
        _ => {
            let ordering = left.cmp(right);
            if descending {
                ordering.reverse()
            } else {
                ordering
            }
        }
    }
}

fn compare_window_keys(left: &[Cell], right: &[Cell], order_by: &[WindowOrder]) -> Ordering {
    for ((left, right), order) in left.iter().zip(right).zip(order_by) {
        let ordering = compare_window_cell(left, right, order.descending, order.nulls_first);
        if !ordering.is_eq() {
            return ordering;
        }
    }
    Ordering::Equal
}

fn ordered_window_partitions(
    value: &BatchSnapshot,
    partition_by: &[u32],
    order_by: &[WindowOrder],
    max_rows: u32,
) -> Result<Vec<Vec<usize>>, Error> {
    if max_rows == 0 {
        return Err(Error::InvalidLimit);
    }
    if value.rows > max_rows {
        return Err(Error::RowLimitExceeded);
    }

    let mut seen_partition = BTreeSet::new();
    let partition_indices = partition_by
        .iter()
        .map(|column| {
            let index = *column as usize;
            if index >= value.fields.len() {
                return Err(Error::ColumnOutOfBounds);
            }
            if !seen_partition.insert(index) {
                return Err(Error::DuplicateKey);
            }
            Ok(index)
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut seen_order = BTreeSet::new();
    for order in order_by {
        let index = order.column as usize;
        if index >= value.fields.len() {
            return Err(Error::ColumnOutOfBounds);
        }
        if !seen_order.insert(index) {
            return Err(Error::DuplicateKey);
        }
    }

    let order_keys = (0..value.rows as usize)
        .map(|row| {
            order_by
                .iter()
                .map(|order| cell_at(&value.columns[order.column as usize], row))
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    let mut partitions: BTreeMap<Vec<Cell>, Vec<usize>> = BTreeMap::new();
    for row in 0..value.rows as usize {
        let key = partition_indices
            .iter()
            .map(|index| cell_at(&value.columns[*index], row))
            .collect::<Vec<_>>();
        partitions.entry(key).or_default().push(row);
    }
    for rows in partitions.values_mut() {
        rows.sort_by(|left, right| {
            compare_window_keys(&order_keys[*left], &order_keys[*right], order_by)
                .then_with(|| left.cmp(right))
        });
    }
    Ok(partitions.into_values().collect())
}

fn cell_at(column: &Column, index: usize) -> Cell {
    match column {
        Column::Boolean(values) => values[index].map(Cell::Bool).unwrap_or(Cell::Null),
        Column::Int64(values) => values[index].map(Cell::Int64).unwrap_or(Cell::Null),
        Column::Uint64(values) => values[index].map(Cell::UInt64).unwrap_or(Cell::Null),
        Column::Float64(values) => values[index]
            .map(|value| Cell::Float64(OrderedFloat(value)))
            .unwrap_or(Cell::Null),
        Column::Utf8(values) => values[index]
            .as_ref()
            .map(|value| Cell::Utf8(value.clone()))
            .unwrap_or(Cell::Null),
        Column::Binary(values) => values[index]
            .as_ref()
            .map(|value| Cell::Binary(value.clone()))
            .unwrap_or(Cell::Null),
    }
}

fn cells_to_column(data_type: DataType, cells: &[Cell]) -> Result<Column, Error> {
    Ok(match data_type {
        DataType::Boolean => Column::Boolean(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Bool(value) => Ok(Some(*value)),
                    _ => Err(Error::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        DataType::Int64 => Column::Int64(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Int64(value) => Ok(Some(*value)),
                    _ => Err(Error::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        DataType::Uint64 => Column::Uint64(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::UInt64(value) => Ok(Some(*value)),
                    _ => Err(Error::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        DataType::Float64 => Column::Float64(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Float64(value) => Ok(Some(value.0)),
                    _ => Err(Error::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        DataType::Utf8 => Column::Utf8(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Utf8(value) => Ok(Some(value.clone())),
                    _ => Err(Error::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        DataType::Binary => Column::Binary(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Binary(value) => Ok(Some(value.clone())),
                    _ => Err(Error::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
    })
}

fn parse_aggregate(aggregate: Aggregate, fields: &[Field]) -> Result<AggDesc, Error> {
    let (kind, column, alias) = match aggregate {
        Aggregate::CountAll(alias) => (AggKind::CountAll, None, alias),
        Aggregate::Count(ColumnAggregate { column, alias }) => {
            (AggKind::Count, Some(column as usize), alias)
        }
        Aggregate::Sum(ColumnAggregate { column, alias }) => {
            (AggKind::Sum, Some(column as usize), alias)
        }
        Aggregate::Min(ColumnAggregate { column, alias }) => {
            (AggKind::Min, Some(column as usize), alias)
        }
        Aggregate::Max(ColumnAggregate { column, alias }) => {
            (AggKind::Max, Some(column as usize), alias)
        }
        Aggregate::Mean(ColumnAggregate { column, alias }) => {
            (AggKind::Mean, Some(column as usize), alias)
        }
        Aggregate::First(ColumnAggregate { column, alias }) => {
            (AggKind::First, Some(column as usize), alias)
        }
        Aggregate::Last(ColumnAggregate { column, alias }) => {
            (AggKind::Last, Some(column as usize), alias)
        }
        Aggregate::VariancePop(ColumnAggregate { column, alias }) => {
            (AggKind::VariancePop, Some(column as usize), alias)
        }
        Aggregate::StddevPop(ColumnAggregate { column, alias }) => {
            (AggKind::StddevPop, Some(column as usize), alias)
        }
    };

    if alias.is_empty() {
        return Err(Error::EmptyAlias);
    }
    let input_type = match column {
        Some(index) => Some(
            fields
                .get(index)
                .ok_or(Error::ColumnOutOfBounds)?
                .data_type,
        ),
        None => None,
    };
    if matches!(
        kind,
        AggKind::Sum
            | AggKind::Min
            | AggKind::Max
            | AggKind::Mean
            | AggKind::VariancePop
            | AggKind::StddevPop
    ) && !matches!(
        input_type,
        Some(DataType::Int64 | DataType::Uint64 | DataType::Float64)
    ) {
        return Err(Error::UnsupportedType);
    }

    Ok(AggDesc {
        kind,
        column,
        alias,
        input_type,
    })
}

fn selected(array: &ArrayRef, indices: &[u32]) -> Result<ArrayRef, Error> {
    let indices = UInt32Array::from(indices.to_vec());
    take(array.as_ref(), &indices, None).map_err(|_| Error::ComputeFailure)
}

fn population_variance(values: impl Iterator<Item = f64>) -> Option<f64> {
    let mut count = 0_u64;
    let mut mean = 0.0_f64;
    let mut squared_deviations = 0.0_f64;
    for value in values {
        count += 1;
        let delta = value - mean;
        mean += delta / count as f64;
        let adjusted_delta = value - mean;
        squared_deviations += delta * adjusted_delta;
    }
    (count != 0).then_some(squared_deviations / count as f64)
}

fn aggregate_group(
    desc: &AggDesc,
    arrays: &[ArrayRef],
    columns: &[Column],
    indices: &[u32],
) -> Result<AggValue, Error> {
    if matches!(desc.kind, AggKind::CountAll) {
        return Ok(AggValue::UInt64(Some(indices.len() as u64)));
    }

    let column = desc.column.ok_or(Error::ComputeFailure)?;
    if matches!(desc.kind, AggKind::First | AggKind::Last) {
        let rows: Box<dyn Iterator<Item = &u32>> = if matches!(desc.kind, AggKind::First) {
            Box::new(indices.iter())
        } else {
            Box::new(indices.iter().rev())
        };
        let value = rows
            .map(|row| cell_at(&columns[column], *row as usize))
            .find(|cell| !matches!(cell, Cell::Null))
            .unwrap_or(Cell::Null);
        return Ok(AggValue::Cell(value));
    }
    let array = selected(
        arrays
            .get(column)
            .ok_or(Error::ColumnOutOfBounds)?,
        indices,
    )?;
    let non_null = (array.len() - array.null_count()) as u64;

    if matches!(desc.kind, AggKind::Count) {
        return Ok(AggValue::UInt64(Some(non_null)));
    }

    match desc.input_type.ok_or(Error::ComputeFailure)? {
        DataType::Int64 => {
            let values = array
                .as_any()
                .downcast_ref::<Int64Array>()
                .ok_or(Error::ComputeFailure)?;
            match desc.kind {
                AggKind::Sum => Ok(AggValue::Int64(
                    sum_checked::<Int64Type>(values).map_err(|_| Error::Overflow)?,
                )),
                AggKind::Min => Ok(AggValue::Int64(min::<Int64Type>(values))),
                AggKind::Max => Ok(AggValue::Int64(max::<Int64Type>(values))),
                AggKind::Mean => {
                    let sum =
                        sum_checked::<Int64Type>(values).map_err(|_| Error::Overflow)?;
                    Ok(AggValue::Float64(match (sum, non_null) {
                        (Some(sum), count) if count != 0 => Some(sum as f64 / count as f64),
                        _ => None,
                    }))
                }
                AggKind::VariancePop | AggKind::StddevPop => {
                    let variance =
                        population_variance(values.iter().flatten().map(|value| value as f64));
                    Ok(AggValue::Float64(
                        if matches!(desc.kind, AggKind::StddevPop) {
                            variance.map(f64::sqrt)
                        } else {
                            variance
                        },
                    ))
                }
                _ => Err(Error::ComputeFailure),
            }
        }
        DataType::Uint64 => {
            let values = array
                .as_any()
                .downcast_ref::<UInt64Array>()
                .ok_or(Error::ComputeFailure)?;
            match desc.kind {
                AggKind::Sum => Ok(AggValue::UInt64(
                    sum_checked::<UInt64Type>(values).map_err(|_| Error::Overflow)?,
                )),
                AggKind::Min => Ok(AggValue::UInt64(min::<UInt64Type>(values))),
                AggKind::Max => Ok(AggValue::UInt64(max::<UInt64Type>(values))),
                AggKind::Mean => {
                    let sum =
                        sum_checked::<UInt64Type>(values).map_err(|_| Error::Overflow)?;
                    Ok(AggValue::Float64(match (sum, non_null) {
                        (Some(sum), count) if count != 0 => Some(sum as f64 / count as f64),
                        _ => None,
                    }))
                }
                AggKind::VariancePop | AggKind::StddevPop => {
                    let variance =
                        population_variance(values.iter().flatten().map(|value| value as f64));
                    Ok(AggValue::Float64(
                        if matches!(desc.kind, AggKind::StddevPop) {
                            variance.map(f64::sqrt)
                        } else {
                            variance
                        },
                    ))
                }
                _ => Err(Error::ComputeFailure),
            }
        }
        DataType::Float64 => {
            let values = array
                .as_any()
                .downcast_ref::<Float64Array>()
                .ok_or(Error::ComputeFailure)?;
            match desc.kind {
                AggKind::Sum => Ok(AggValue::Float64(
                    sum_checked::<Float64Type>(values)
                        .map_err(|_| Error::ComputeFailure)?,
                )),
                AggKind::Min => Ok(AggValue::Float64(min::<Float64Type>(values))),
                AggKind::Max => Ok(AggValue::Float64(max::<Float64Type>(values))),
                AggKind::Mean => {
                    let sum = sum_checked::<Float64Type>(values)
                        .map_err(|_| Error::ComputeFailure)?;
                    Ok(AggValue::Float64(match (sum, non_null) {
                        (Some(sum), count) if count != 0 => Some(sum / count as f64),
                        _ => None,
                    }))
                }
                AggKind::VariancePop | AggKind::StddevPop => {
                    let variance = population_variance(values.iter().flatten());
                    Ok(AggValue::Float64(
                        if matches!(desc.kind, AggKind::StddevPop) {
                            variance.map(f64::sqrt)
                        } else {
                            variance
                        },
                    ))
                }
                _ => Err(Error::ComputeFailure),
            }
        }
        _ => Err(Error::UnsupportedType),
    }
}

fn window_aggregate_output(
    desc: &AggDesc,
    results: Vec<AggValue>,
) -> Result<(Field, Column), Error> {
    Ok(match desc.kind {
        AggKind::CountAll | AggKind::Count => (
            Field {
                name: desc.alias.clone(),
                data_type: DataType::Uint64,
                nullable: false,
            },
            Column::Uint64(
                results
                    .into_iter()
                    .map(|value| match value {
                        AggValue::UInt64(value) => Ok(value),
                        _ => Err(Error::ComputeFailure),
                    })
                    .collect::<Result<Vec<_>, _>>()?,
            ),
        ),
        AggKind::Mean => (
            Field {
                name: desc.alias.clone(),
                data_type: DataType::Float64,
                nullable: true,
            },
            Column::Float64(
                results
                    .into_iter()
                    .map(|value| match value {
                        AggValue::Float64(value) => Ok(value),
                        _ => Err(Error::ComputeFailure),
                    })
                    .collect::<Result<Vec<_>, _>>()?,
            ),
        ),
        AggKind::Sum | AggKind::Min | AggKind::Max => {
            match desc.input_type.ok_or(Error::ComputeFailure)? {
                DataType::Int64 => (
                    Field {
                        name: desc.alias.clone(),
                        data_type: DataType::Int64,
                        nullable: true,
                    },
                    Column::Int64(
                        results
                            .into_iter()
                            .map(|value| match value {
                                AggValue::Int64(value) => Ok(value),
                                _ => Err(Error::ComputeFailure),
                            })
                            .collect::<Result<Vec<_>, _>>()?,
                    ),
                ),
                DataType::Uint64 => (
                    Field {
                        name: desc.alias.clone(),
                        data_type: DataType::Uint64,
                        nullable: true,
                    },
                    Column::Uint64(
                        results
                            .into_iter()
                            .map(|value| match value {
                                AggValue::UInt64(value) => Ok(value),
                                _ => Err(Error::ComputeFailure),
                            })
                            .collect::<Result<Vec<_>, _>>()?,
                    ),
                ),
                DataType::Float64 => (
                    Field {
                        name: desc.alias.clone(),
                        data_type: DataType::Float64,
                        nullable: true,
                    },
                    Column::Float64(
                        results
                            .into_iter()
                            .map(|value| match value {
                                AggValue::Float64(value) => Ok(value),
                                _ => Err(Error::ComputeFailure),
                            })
                            .collect::<Result<Vec<_>, _>>()?,
                    ),
                ),
                _ => return Err(Error::UnsupportedType),
            }
        }
        AggKind::First | AggKind::Last | AggKind::VariancePop | AggKind::StddevPop => {
            return Err(Error::UnsupportedFunction)
        }
    })
}

fn rows_frame_offsets(frame: &RowsFrame) -> Result<(Option<i64>, Option<i64>), Error> {
    let start = match frame.start {
        RowsFrameStart::Unbounded => None,
        RowsFrameStart::Preceding(value) => Some(-(i64::from(value))),
        RowsFrameStart::CurrentRow => Some(0),
        RowsFrameStart::Following(value) => Some(i64::from(value)),
    };
    let end = match frame.end {
        RowsFrameEnd::Preceding(value) => Some(-(i64::from(value))),
        RowsFrameEnd::CurrentRow => Some(0),
        RowsFrameEnd::Following(value) => Some(i64::from(value)),
        RowsFrameEnd::Unbounded => None,
    };
    if matches!((start, end), (Some(start), Some(end)) if start > end) {
        return Err(Error::InvalidFrame);
    }
    Ok((start, end))
}

fn rows_frame_range(
    position: usize,
    row_count: usize,
    offsets: (Option<i64>, Option<i64>),
) -> std::ops::Range<usize> {
    let position = position as i64;
    let row_count = row_count as i64;
    let start = offsets
        .0
        .map(|offset| position.saturating_add(offset))
        .unwrap_or(0)
        .clamp(0, row_count);
    let end_exclusive = offsets
        .1
        .map(|offset| position.saturating_add(offset).saturating_add(1))
        .unwrap_or(row_count)
        .clamp(0, row_count);
    let start = start.min(end_exclusive) as usize;
    start..end_exclusive as usize
}

pub fn window_rank(
        mut value: BatchSnapshot,
        partition_by: Vec<u32>,
        order_by: Vec<WindowOrder>,
        functions: Vec<WindowFunction>,
        options: WindowOptions,
    ) -> Result<BatchSnapshot, Error> {
        validate_batch(&value)?;
        if order_by.is_empty() {
            return Err(Error::EmptyOrder);
        }
        if functions.is_empty() {
            return Err(Error::EmptyFunctions);
        }
        let mut output_names = value
            .fields
            .iter()
            .map(|field| field.name.clone())
            .collect::<BTreeSet<_>>();
        let mut descs = Vec::with_capacity(functions.len());
        let mut seen_functions = BTreeSet::new();
        for function in functions {
            let (kind, alias) = match function {
                WindowFunction::RowNumber(alias) => (WindowKind::RowNumber, alias),
                WindowFunction::Rank(alias) => (WindowKind::Rank, alias),
                WindowFunction::DenseRank(alias) => (WindowKind::DenseRank, alias),
            };
            let function_id = match kind {
                WindowKind::RowNumber => 0_u8,
                WindowKind::Rank => 1_u8,
                WindowKind::DenseRank => 2_u8,
            };
            if !seen_functions.insert(function_id) {
                return Err(Error::DuplicateFunction);
            }
            if alias.is_empty() {
                return Err(Error::EmptyAlias);
            }
            if !output_names.insert(alias.clone()) {
                return Err(Error::DuplicateOutputName);
            }
            descs.push(WindowDesc { kind, alias });
        }

        let partitions =
            ordered_window_partitions(&value, &partition_by, &order_by, options.max_rows)?;

        let mut outputs = vec![vec![0_u64; value.rows as usize]; descs.len()];
        let order_keys = (0..value.rows as usize)
            .map(|row| {
                order_by
                    .iter()
                    .map(|order| cell_at(&value.columns[order.column as usize], row))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        for rows in &partitions {
            let mut rank = 1_u64;
            let mut dense_rank = 1_u64;
            for (position, row) in rows.iter().enumerate() {
                if position != 0
                    && !compare_window_keys(
                        &order_keys[rows[position - 1]],
                        &order_keys[*row],
                        &order_by,
                    )
                    .is_eq()
                {
                    rank = position as u64 + 1;
                    dense_rank = dense_rank.checked_add(1).ok_or(Error::Overflow)?;
                }
                for (output, desc) in outputs.iter_mut().zip(&descs) {
                    output[*row] = match desc.kind {
                        WindowKind::RowNumber => position as u64 + 1,
                        WindowKind::Rank => rank,
                        WindowKind::DenseRank => dense_rank,
                    };
                }
            }
        }

        for (desc, output) in descs.into_iter().zip(outputs) {
            value.fields.push(Field {
                name: desc.alias,
                data_type: DataType::Uint64,
                nullable: false,
            });
            value
                .columns
                .push(Column::Uint64(output.into_iter().map(Some).collect()));
        }
        Ok(value)
    }

pub fn distinct(
        value: BatchSnapshot,
        keys: Vec<u32>,
        options: DistinctOptions,
    ) -> Result<BatchSnapshot, Error> {
        validate_batch(&value)?;
        if options.max_rows == 0 {
            return Err(Error::InvalidLimit);
        }
        if value.rows > options.max_rows {
            return Err(Error::RowLimitExceeded);
        }

        let key_indices = if keys.is_empty() {
            (0..value.fields.len()).collect::<Vec<_>>()
        } else {
            let mut seen_keys = BTreeSet::new();
            keys.into_iter()
                .map(|column| {
                    let index = column as usize;
                    if index >= value.fields.len() {
                        return Err(Error::ColumnOutOfBounds);
                    }
                    if !seen_keys.insert(index) {
                        return Err(Error::DuplicateKey);
                    }
                    Ok(index)
                })
                .collect::<Result<Vec<_>, _>>()?
        };

        let mut seen = BTreeSet::new();
        let mut selected_rows = Vec::new();
        for row in 0..value.rows as usize {
            let identity = key_indices
                .iter()
                .map(|index| cell_at(&value.columns[*index], row))
                .collect::<Vec<_>>();
            if seen.insert(identity) {
                selected_rows.push(row);
            }
        }

        let columns = value
            .fields
            .iter()
            .enumerate()
            .map(|(column_index, field)| {
                let cells = selected_rows
                    .iter()
                    .map(|row| cell_at(&value.columns[column_index], *row))
                    .collect::<Vec<_>>();
                cells_to_column(field.data_type, &cells)
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(BatchSnapshot {
            rows: u32::try_from(selected_rows.len()).map_err(|_| Error::Overflow)?,
            fields: value.fields,
            columns,
        })
    }

pub fn window_offset(
        mut value: BatchSnapshot,
        partition_by: Vec<u32>,
        order_by: Vec<WindowOrder>,
        functions: Vec<OffsetWindowFunction>,
        options: WindowOptions,
    ) -> Result<BatchSnapshot, Error> {
        validate_batch(&value)?;
        if order_by.is_empty() {
            return Err(Error::EmptyOrder);
        }
        if functions.is_empty() {
            return Err(Error::EmptyFunctions);
        }

        let mut output_names = value
            .fields
            .iter()
            .map(|field| field.name.clone())
            .collect::<BTreeSet<_>>();
        let mut descs = Vec::with_capacity(functions.len());
        for function in functions {
            let (
                kind,
                OffsetWindow {
                    column,
                    offset,
                    alias,
                },
            ) = match function {
                OffsetWindowFunction::Lag(value) => (OffsetWindowKind::Lag, value),
                OffsetWindowFunction::Lead(value) => (OffsetWindowKind::Lead, value),
            };
            if alias.is_empty() {
                return Err(Error::EmptyAlias);
            }
            if !output_names.insert(alias.clone()) {
                return Err(Error::DuplicateOutputName);
            }
            let column = column as usize;
            let data_type = value
                .fields
                .get(column)
                .ok_or(Error::ColumnOutOfBounds)?
                .data_type;
            descs.push(OffsetWindowDesc {
                kind,
                column,
                offset: offset as usize,
                alias,
                data_type,
            });
        }

        let partitions =
            ordered_window_partitions(&value, &partition_by, &order_by, options.max_rows)?;
        let mut outputs = vec![vec![Cell::Null; value.rows as usize]; descs.len()];
        for rows in &partitions {
            for (position, row) in rows.iter().enumerate() {
                for (output, desc) in outputs.iter_mut().zip(&descs) {
                    let source_position = match desc.kind {
                        OffsetWindowKind::Lag => position.checked_sub(desc.offset),
                        OffsetWindowKind::Lead => position
                            .checked_add(desc.offset)
                            .filter(|position| *position < rows.len()),
                    };
                    if let Some(source_position) = source_position {
                        output[*row] = cell_at(&value.columns[desc.column], rows[source_position]);
                    }
                }
            }
        }

        for (desc, output) in descs.into_iter().zip(outputs) {
            value.fields.push(Field {
                name: desc.alias,
                data_type: desc.data_type,
                nullable: true,
            });
            value
                .columns
                .push(cells_to_column(desc.data_type, &output)?);
        }
        Ok(value)
    }

pub fn window_aggregate(
        mut value: BatchSnapshot,
        partition_by: Vec<u32>,
        order_by: Vec<WindowOrder>,
        frame: RowsFrame,
        aggregates: Vec<Aggregate>,
        options: WindowOptions,
    ) -> Result<BatchSnapshot, Error> {
        let arrays = validate_batch(&value)?;
        if order_by.is_empty() {
            return Err(Error::EmptyOrder);
        }
        if aggregates.is_empty() {
            return Err(Error::EmptyFunctions);
        }
        let frame_offsets = rows_frame_offsets(&frame)?;

        let mut output_names = value
            .fields
            .iter()
            .map(|field| field.name.clone())
            .collect::<BTreeSet<_>>();
        let mut descs = Vec::with_capacity(aggregates.len());
        for aggregate in aggregates {
            let desc = parse_aggregate(aggregate, &value.fields)?;
            if matches!(
                desc.kind,
                AggKind::First | AggKind::Last | AggKind::VariancePop | AggKind::StddevPop
            ) {
                return Err(Error::UnsupportedFunction);
            }
            if !output_names.insert(desc.alias.clone()) {
                return Err(Error::DuplicateOutputName);
            }
            descs.push(desc);
        }

        let partitions =
            ordered_window_partitions(&value, &partition_by, &order_by, options.max_rows)?;
        for desc in &descs {
            let mut by_input_row = (0..value.rows as usize)
                .map(|_| None)
                .collect::<Vec<Option<AggValue>>>();
            for rows in &partitions {
                for (position, input_row) in rows.iter().copied().enumerate() {
                    let range = rows_frame_range(position, rows.len(), frame_offsets);
                    let indices = rows[range]
                        .iter()
                        .map(|row| *row as u32)
                        .collect::<Vec<_>>();
                    by_input_row[input_row] =
                        Some(aggregate_group(desc, &arrays, &value.columns, &indices)?);
                }
            }
            let results = by_input_row
                .into_iter()
                .map(|result| result.ok_or(Error::ComputeFailure))
                .collect::<Result<Vec<_>, _>>()?;
            let (field, column) = window_aggregate_output(desc, results)?;
            value.fields.push(field);
            value.columns.push(column);
        }
        Ok(value)
    }

pub fn equi_join(
        left: BatchSnapshot,
        right: BatchSnapshot,
        keys: Vec<JoinKey>,
        options: JoinOptions,
    ) -> Result<BatchSnapshot, Error> {
        validate_batch(&left)?;
        validate_batch(&right)?;
        if keys.is_empty() {
            return Err(Error::EmptyKeys);
        }
        if options.max_output_rows == 0 {
            return Err(Error::InvalidLimit);
        }

        let mut seen_left = BTreeSet::new();
        let mut seen_right = BTreeSet::new();
        let mut left_keys = Vec::with_capacity(keys.len());
        let mut right_keys = Vec::with_capacity(keys.len());
        for key in keys {
            let left_index = key.left_column as usize;
            let right_index = key.right_column as usize;
            let left_field = left
                .fields
                .get(left_index)
                .ok_or(Error::ColumnOutOfBounds)?;
            let right_field = right
                .fields
                .get(right_index)
                .ok_or(Error::ColumnOutOfBounds)?;
            if !seen_left.insert(left_index) || !seen_right.insert(right_index) {
                return Err(Error::DuplicateKey);
            }
            if left_field.data_type != right_field.data_type {
                return Err(Error::KeyTypeMismatch);
            }
            left_keys.push(left_index);
            right_keys.push(right_index);
        }

        let left_join = matches!(options.kind, JoinKind::Left);
        let mut fields = left.fields.clone();
        let mut output_names = fields
            .iter()
            .map(|field| field.name.clone())
            .collect::<BTreeSet<_>>();
        for field in &right.fields {
            let name = format!("{}{}", options.right_prefix, field.name);
            if !output_names.insert(name.clone()) {
                return Err(Error::DuplicateOutputName);
            }
            fields.push(Field {
                name,
                data_type: field.data_type,
                nullable: field.nullable || left_join,
            });
        }

        let mut right_index: BTreeMap<Vec<Cell>, Vec<u32>> = BTreeMap::new();
        for row in 0..right.rows as usize {
            if let Some(key) = row_key(&right.columns, &right_keys, row) {
                right_index.entry(key).or_default().push(row as u32);
            }
        }

        let mut pairs = Vec::new();
        for left_row in 0..left.rows as usize {
            let matches =
                row_key(&left.columns, &left_keys, left_row).and_then(|key| right_index.get(&key));
            match matches {
                Some(right_rows) => {
                    for right_row in right_rows {
                        push_join_pair(
                            &mut pairs,
                            (left_row as u32, Some(*right_row)),
                            options.max_output_rows,
                        )?;
                    }
                }
                None if left_join => {
                    push_join_pair(&mut pairs, (left_row as u32, None), options.max_output_rows)?
                }
                None => {}
            }
        }

        let mut columns = Vec::with_capacity(fields.len());
        for (column_index, field) in left.fields.iter().enumerate() {
            let cells = pairs
                .iter()
                .map(|(left_row, _)| cell_at(&left.columns[column_index], *left_row as usize))
                .collect::<Vec<_>>();
            columns.push(cells_to_column(field.data_type, &cells)?);
        }
        for (column_index, field) in right.fields.iter().enumerate() {
            let cells = pairs
                .iter()
                .map(|(_, right_row)| {
                    right_row
                        .map(|row| cell_at(&right.columns[column_index], row as usize))
                        .unwrap_or(Cell::Null)
                })
                .collect::<Vec<_>>();
            columns.push(cells_to_column(field.data_type, &cells)?);
        }

        Ok(BatchSnapshot {
            rows: u32::try_from(pairs.len()).map_err(|_| Error::Overflow)?,
            fields,
            columns,
        })
    }

pub fn union_all(values: Vec<BatchSnapshot>) -> Result<BatchSnapshot, Error> {
        let mut values = values.into_iter();
        let mut output = values.next().ok_or(Error::EmptyInput)?;
        validate_batch(&output)?;

        for value in values {
            validate_batch(&value)?;
            if !same_schema(&output.fields, &value.fields) {
                return Err(Error::SchemaMismatch);
            }
            output.rows = output
                .rows
                .checked_add(value.rows)
                .ok_or(Error::Overflow)?;
            for (target, source) in output.columns.iter_mut().zip(value.columns) {
                append_column(target, source)?;
            }
        }

        Ok(output)
    }

pub fn group_aggregate(
        value: BatchSnapshot,
        keys: Vec<u32>,
        aggregates: Vec<Aggregate>,
    ) -> Result<BatchSnapshot, Error> {
        let arrays = validate_batch(&value)?;

        let mut seen_keys = BTreeSet::new();
        let key_indices = keys
            .into_iter()
            .map(|key| {
                let index = key as usize;
                if index >= value.fields.len() {
                    return Err(Error::ColumnOutOfBounds);
                }
                if !seen_keys.insert(index) {
                    return Err(Error::DuplicateKey);
                }
                Ok(index)
            })
            .collect::<Result<Vec<_>, _>>()?;

        let mut output_names = BTreeSet::new();
        for index in &key_indices {
            output_names.insert(value.fields[*index].name.clone());
        }
        let mut descs = Vec::with_capacity(aggregates.len());
        for aggregate in aggregates {
            let desc = parse_aggregate(aggregate, &value.fields)?;
            if !output_names.insert(desc.alias.clone()) {
                return Err(Error::DuplicateOutputName);
            }
            descs.push(desc);
        }

        let mut groups: BTreeMap<Vec<Cell>, Vec<u32>> = BTreeMap::new();
        if key_indices.is_empty() {
            groups.insert(Vec::new(), (0..value.rows).collect::<Vec<u32>>());
        } else {
            for row in 0..value.rows as usize {
                let key = key_indices
                    .iter()
                    .map(|index| cell_at(&value.columns[*index], row))
                    .collect::<Vec<_>>();
                groups.entry(key).or_default().push(row as u32);
            }
        }

        let group_count = groups.len();
        let mut fields = Vec::with_capacity(key_indices.len() + descs.len());
        let mut columns = Vec::with_capacity(key_indices.len() + descs.len());

        for (key_position, input_index) in key_indices.iter().enumerate() {
            let field = value.fields[*input_index].clone();
            let cells = groups
                .keys()
                .map(|key| key[key_position].clone())
                .collect::<Vec<_>>();
            columns.push(cells_to_column(field.data_type, &cells)?);
            fields.push(field);
        }

        for desc in &descs {
            let results = groups
                .values()
                .map(|indices| aggregate_group(desc, &arrays, &value.columns, indices))
                .collect::<Result<Vec<_>, _>>()?;

            let (field, column) = match desc.kind {
                AggKind::CountAll | AggKind::Count => (
                    Field {
                        name: desc.alias.clone(),
                        data_type: DataType::Uint64,
                        nullable: false,
                    },
                    Column::Uint64(
                        results
                            .into_iter()
                            .map(|value| match value {
                                AggValue::UInt64(value) => value,
                                _ => None,
                            })
                            .collect(),
                    ),
                ),
                AggKind::Mean | AggKind::VariancePop | AggKind::StddevPop => (
                    Field {
                        name: desc.alias.clone(),
                        data_type: DataType::Float64,
                        nullable: true,
                    },
                    Column::Float64(
                        results
                            .into_iter()
                            .map(|value| match value {
                                AggValue::Float64(value) => value,
                                _ => None,
                            })
                            .collect(),
                    ),
                ),
                AggKind::Sum | AggKind::Min | AggKind::Max => {
                    match desc.input_type.ok_or(Error::ComputeFailure)? {
                        DataType::Int64 => (
                            Field {
                                name: desc.alias.clone(),
                                data_type: DataType::Int64,
                                nullable: true,
                            },
                            Column::Int64(
                                results
                                    .into_iter()
                                    .map(|value| match value {
                                        AggValue::Int64(value) => value,
                                        _ => None,
                                    })
                                    .collect(),
                            ),
                        ),
                        DataType::Uint64 => (
                            Field {
                                name: desc.alias.clone(),
                                data_type: DataType::Uint64,
                                nullable: true,
                            },
                            Column::Uint64(
                                results
                                    .into_iter()
                                    .map(|value| match value {
                                        AggValue::UInt64(value) => value,
                                        _ => None,
                                    })
                                    .collect(),
                            ),
                        ),
                        DataType::Float64 => (
                            Field {
                                name: desc.alias.clone(),
                                data_type: DataType::Float64,
                                nullable: true,
                            },
                            Column::Float64(
                                results
                                    .into_iter()
                                    .map(|value| match value {
                                        AggValue::Float64(value) => value,
                                        _ => None,
                                    })
                                    .collect(),
                            ),
                        ),
                        _ => return Err(Error::UnsupportedType),
                    }
                }
                AggKind::First | AggKind::Last => {
                    let data_type = desc.input_type.ok_or(Error::ComputeFailure)?;
                    let cells = results
                        .into_iter()
                        .map(|value| match value {
                            AggValue::Cell(value) => Ok(value),
                            _ => Err(Error::ComputeFailure),
                        })
                        .collect::<Result<Vec<_>, _>>()?;
                    (
                        Field {
                            name: desc.alias.clone(),
                            data_type,
                            nullable: true,
                        },
                        cells_to_column(data_type, &cells)?,
                    )
                }
            };
            fields.push(field);
            columns.push(column);
        }

        Ok(BatchSnapshot {
            rows: u32::try_from(group_count).map_err(|_| Error::ComputeFailure)?,
            fields,
            columns,
        })
    }
