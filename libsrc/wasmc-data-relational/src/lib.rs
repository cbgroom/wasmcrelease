wit_bindgen::generate!({
    path: "wit",
    world: "data-relational",
    generate_all,
});

use crate::exports::wasmc::data_relational::relational::{
    Aggregate, ColumnAggregate, Guest, JoinKey, JoinKind, JoinOptions, RelationalError,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot, Column, DataType as WitDataType, Field as WitField,
};
use arrow_arith::aggregate::{max, min, sum_checked};
use arrow_array::builder::{BinaryBuilder, StringBuilder};
use arrow_array::types::{Float64Type, Int64Type, UInt64Type};
use arrow_array::{
    Array, ArrayRef, BooleanArray, Float64Array, Int64Array, UInt32Array, UInt64Array,
};
use arrow_select::take::take;
use ordered_float::OrderedFloat;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

struct DataRelational;

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
}

#[derive(Clone, Debug)]
struct AggDesc {
    kind: AggKind,
    column: Option<usize>,
    alias: String,
    input_type: Option<WitDataType>,
}

enum AggValue {
    UInt64(Option<u64>),
    Int64(Option<i64>),
    Float64(Option<f64>),
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

fn validate_batch(value: &BatchSnapshot) -> Result<Vec<ArrayRef>, RelationalError> {
    if value.fields.len() != value.columns.len() {
        return Err(RelationalError::InvalidBatch);
    }
    let rows = value.rows as usize;
    let mut names = BTreeSet::new();
    let mut arrays = Vec::with_capacity(value.columns.len());
    for (field, column) in value.fields.iter().zip(&value.columns) {
        if field.name.is_empty()
            || !names.insert(field.name.clone())
            || column_type(column) != field.data_type
            || column_len(column) != rows
            || (!field.nullable && column_has_null(column))
        {
            return Err(RelationalError::InvalidBatch);
        }
        arrays.push(column_to_array(column));
    }
    Ok(arrays)
}

fn same_schema(left: &[WitField], right: &[WitField]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right).all(|(left, right)| {
            left.name == right.name
                && left.data_type == right.data_type
                && left.nullable == right.nullable
        })
}

fn append_column(target: &mut Column, source: Column) -> Result<(), RelationalError> {
    match (target, source) {
        (Column::BooleanColumn(target), Column::BooleanColumn(mut source)) => {
            target.append(&mut source)
        }
        (Column::Int64Column(target), Column::Int64Column(mut source)) => {
            target.append(&mut source)
        }
        (Column::Uint64Column(target), Column::Uint64Column(mut source)) => {
            target.append(&mut source)
        }
        (Column::Float64Column(target), Column::Float64Column(mut source)) => {
            target.append(&mut source)
        }
        (Column::Utf8Column(target), Column::Utf8Column(mut source)) => target.append(&mut source),
        (Column::BinaryColumn(target), Column::BinaryColumn(mut source)) => {
            target.append(&mut source)
        }
        _ => return Err(RelationalError::SchemaMismatch),
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
) -> Result<(), RelationalError> {
    if pairs.len() >= max_output_rows as usize {
        return Err(RelationalError::OutputLimitExceeded);
    }
    pairs.push(pair);
    Ok(())
}

fn cell_at(column: &Column, index: usize) -> Cell {
    match column {
        Column::BooleanColumn(values) => values[index].map(Cell::Bool).unwrap_or(Cell::Null),
        Column::Int64Column(values) => values[index].map(Cell::Int64).unwrap_or(Cell::Null),
        Column::Uint64Column(values) => values[index].map(Cell::UInt64).unwrap_or(Cell::Null),
        Column::Float64Column(values) => values[index]
            .map(|value| Cell::Float64(OrderedFloat(value)))
            .unwrap_or(Cell::Null),
        Column::Utf8Column(values) => values[index]
            .as_ref()
            .map(|value| Cell::Utf8(value.clone()))
            .unwrap_or(Cell::Null),
        Column::BinaryColumn(values) => values[index]
            .as_ref()
            .map(|value| Cell::Binary(value.clone()))
            .unwrap_or(Cell::Null),
    }
}

fn cells_to_column(data_type: WitDataType, cells: &[Cell]) -> Result<Column, RelationalError> {
    Ok(match data_type {
        WitDataType::Boolean => Column::BooleanColumn(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Bool(value) => Ok(Some(*value)),
                    _ => Err(RelationalError::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        WitDataType::Int64 => Column::Int64Column(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Int64(value) => Ok(Some(*value)),
                    _ => Err(RelationalError::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        WitDataType::Uint64 => Column::Uint64Column(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::UInt64(value) => Ok(Some(*value)),
                    _ => Err(RelationalError::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        WitDataType::Float64 => Column::Float64Column(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Float64(value) => Ok(Some(value.0)),
                    _ => Err(RelationalError::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        WitDataType::Utf8 => Column::Utf8Column(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Utf8(value) => Ok(Some(value.clone())),
                    _ => Err(RelationalError::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        WitDataType::Binary => Column::BinaryColumn(
            cells
                .iter()
                .map(|cell| match cell {
                    Cell::Null => Ok(None),
                    Cell::Binary(value) => Ok(Some(value.clone())),
                    _ => Err(RelationalError::ComputeFailure),
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
    })
}

fn parse_aggregate(aggregate: Aggregate, fields: &[WitField]) -> Result<AggDesc, RelationalError> {
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
    };

    if alias.is_empty() {
        return Err(RelationalError::EmptyAlias);
    }
    let input_type = match column {
        Some(index) => Some(
            fields
                .get(index)
                .ok_or(RelationalError::ColumnOutOfBounds)?
                .data_type,
        ),
        None => None,
    };
    if matches!(
        kind,
        AggKind::Sum | AggKind::Min | AggKind::Max | AggKind::Mean
    ) && !matches!(
        input_type,
        Some(WitDataType::Int64 | WitDataType::Uint64 | WitDataType::Float64)
    ) {
        return Err(RelationalError::UnsupportedType);
    }

    Ok(AggDesc {
        kind,
        column,
        alias,
        input_type,
    })
}

fn selected(array: &ArrayRef, indices: &[u32]) -> Result<ArrayRef, RelationalError> {
    let indices = UInt32Array::from(indices.to_vec());
    take(array.as_ref(), &indices, None).map_err(|_| RelationalError::ComputeFailure)
}

fn aggregate_group(
    desc: &AggDesc,
    arrays: &[ArrayRef],
    indices: &[u32],
) -> Result<AggValue, RelationalError> {
    if matches!(desc.kind, AggKind::CountAll) {
        return Ok(AggValue::UInt64(Some(indices.len() as u64)));
    }

    let column = desc.column.ok_or(RelationalError::ComputeFailure)?;
    let array = selected(
        arrays
            .get(column)
            .ok_or(RelationalError::ColumnOutOfBounds)?,
        indices,
    )?;
    let non_null = (array.len() - array.null_count()) as u64;

    if matches!(desc.kind, AggKind::Count) {
        return Ok(AggValue::UInt64(Some(non_null)));
    }

    match desc.input_type.ok_or(RelationalError::ComputeFailure)? {
        WitDataType::Int64 => {
            let values = array
                .as_any()
                .downcast_ref::<Int64Array>()
                .ok_or(RelationalError::ComputeFailure)?;
            match desc.kind {
                AggKind::Sum => Ok(AggValue::Int64(
                    sum_checked::<Int64Type>(values).map_err(|_| RelationalError::Overflow)?,
                )),
                AggKind::Min => Ok(AggValue::Int64(min::<Int64Type>(values))),
                AggKind::Max => Ok(AggValue::Int64(max::<Int64Type>(values))),
                AggKind::Mean => {
                    let sum =
                        sum_checked::<Int64Type>(values).map_err(|_| RelationalError::Overflow)?;
                    Ok(AggValue::Float64(match (sum, non_null) {
                        (Some(sum), count) if count != 0 => Some(sum as f64 / count as f64),
                        _ => None,
                    }))
                }
                _ => Err(RelationalError::ComputeFailure),
            }
        }
        WitDataType::Uint64 => {
            let values = array
                .as_any()
                .downcast_ref::<UInt64Array>()
                .ok_or(RelationalError::ComputeFailure)?;
            match desc.kind {
                AggKind::Sum => Ok(AggValue::UInt64(
                    sum_checked::<UInt64Type>(values).map_err(|_| RelationalError::Overflow)?,
                )),
                AggKind::Min => Ok(AggValue::UInt64(min::<UInt64Type>(values))),
                AggKind::Max => Ok(AggValue::UInt64(max::<UInt64Type>(values))),
                AggKind::Mean => {
                    let sum =
                        sum_checked::<UInt64Type>(values).map_err(|_| RelationalError::Overflow)?;
                    Ok(AggValue::Float64(match (sum, non_null) {
                        (Some(sum), count) if count != 0 => Some(sum as f64 / count as f64),
                        _ => None,
                    }))
                }
                _ => Err(RelationalError::ComputeFailure),
            }
        }
        WitDataType::Float64 => {
            let values = array
                .as_any()
                .downcast_ref::<Float64Array>()
                .ok_or(RelationalError::ComputeFailure)?;
            match desc.kind {
                AggKind::Sum => Ok(AggValue::Float64(
                    sum_checked::<Float64Type>(values)
                        .map_err(|_| RelationalError::ComputeFailure)?,
                )),
                AggKind::Min => Ok(AggValue::Float64(min::<Float64Type>(values))),
                AggKind::Max => Ok(AggValue::Float64(max::<Float64Type>(values))),
                AggKind::Mean => {
                    let sum = sum_checked::<Float64Type>(values)
                        .map_err(|_| RelationalError::ComputeFailure)?;
                    Ok(AggValue::Float64(match (sum, non_null) {
                        (Some(sum), count) if count != 0 => Some(sum / count as f64),
                        _ => None,
                    }))
                }
                _ => Err(RelationalError::ComputeFailure),
            }
        }
        _ => Err(RelationalError::UnsupportedType),
    }
}

impl Guest for DataRelational {
    fn equi_join(
        left: BatchSnapshot,
        right: BatchSnapshot,
        keys: Vec<JoinKey>,
        options: JoinOptions,
    ) -> Result<BatchSnapshot, RelationalError> {
        validate_batch(&left)?;
        validate_batch(&right)?;
        if keys.is_empty() {
            return Err(RelationalError::EmptyKeys);
        }
        if options.max_output_rows == 0 {
            return Err(RelationalError::InvalidLimit);
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
                .ok_or(RelationalError::ColumnOutOfBounds)?;
            let right_field = right
                .fields
                .get(right_index)
                .ok_or(RelationalError::ColumnOutOfBounds)?;
            if !seen_left.insert(left_index) || !seen_right.insert(right_index) {
                return Err(RelationalError::DuplicateKey);
            }
            if left_field.data_type != right_field.data_type {
                return Err(RelationalError::KeyTypeMismatch);
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
                return Err(RelationalError::DuplicateOutputName);
            }
            fields.push(WitField {
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
            rows: u32::try_from(pairs.len()).map_err(|_| RelationalError::Overflow)?,
            fields,
            columns,
        })
    }

    fn union_all(values: Vec<BatchSnapshot>) -> Result<BatchSnapshot, RelationalError> {
        let mut values = values.into_iter();
        let mut output = values.next().ok_or(RelationalError::EmptyInput)?;
        validate_batch(&output)?;

        for value in values {
            validate_batch(&value)?;
            if !same_schema(&output.fields, &value.fields) {
                return Err(RelationalError::SchemaMismatch);
            }
            output.rows = output
                .rows
                .checked_add(value.rows)
                .ok_or(RelationalError::Overflow)?;
            for (target, source) in output.columns.iter_mut().zip(value.columns) {
                append_column(target, source)?;
            }
        }

        Ok(output)
    }

    fn group_aggregate(
        value: BatchSnapshot,
        keys: Vec<u32>,
        aggregates: Vec<Aggregate>,
    ) -> Result<BatchSnapshot, RelationalError> {
        let arrays = validate_batch(&value)?;

        let mut seen_keys = BTreeSet::new();
        let key_indices = keys
            .into_iter()
            .map(|key| {
                let index = key as usize;
                if index >= value.fields.len() {
                    return Err(RelationalError::ColumnOutOfBounds);
                }
                if !seen_keys.insert(index) {
                    return Err(RelationalError::DuplicateKey);
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
                return Err(RelationalError::DuplicateOutputName);
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
                .map(|indices| aggregate_group(desc, &arrays, indices))
                .collect::<Result<Vec<_>, _>>()?;

            let (field, column) = match desc.kind {
                AggKind::CountAll | AggKind::Count => (
                    WitField {
                        name: desc.alias.clone(),
                        data_type: WitDataType::Uint64,
                        nullable: false,
                    },
                    Column::Uint64Column(
                        results
                            .into_iter()
                            .map(|value| match value {
                                AggValue::UInt64(value) => value,
                                _ => None,
                            })
                            .collect(),
                    ),
                ),
                AggKind::Mean => (
                    WitField {
                        name: desc.alias.clone(),
                        data_type: WitDataType::Float64,
                        nullable: true,
                    },
                    Column::Float64Column(
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
                    match desc.input_type.ok_or(RelationalError::ComputeFailure)? {
                        WitDataType::Int64 => (
                            WitField {
                                name: desc.alias.clone(),
                                data_type: WitDataType::Int64,
                                nullable: true,
                            },
                            Column::Int64Column(
                                results
                                    .into_iter()
                                    .map(|value| match value {
                                        AggValue::Int64(value) => value,
                                        _ => None,
                                    })
                                    .collect(),
                            ),
                        ),
                        WitDataType::Uint64 => (
                            WitField {
                                name: desc.alias.clone(),
                                data_type: WitDataType::Uint64,
                                nullable: true,
                            },
                            Column::Uint64Column(
                                results
                                    .into_iter()
                                    .map(|value| match value {
                                        AggValue::UInt64(value) => value,
                                        _ => None,
                                    })
                                    .collect(),
                            ),
                        ),
                        WitDataType::Float64 => (
                            WitField {
                                name: desc.alias.clone(),
                                data_type: WitDataType::Float64,
                                nullable: true,
                            },
                            Column::Float64Column(
                                results
                                    .into_iter()
                                    .map(|value| match value {
                                        AggValue::Float64(value) => value,
                                        _ => None,
                                    })
                                    .collect(),
                            ),
                        ),
                        _ => return Err(RelationalError::UnsupportedType),
                    }
                }
            };
            fields.push(field);
            columns.push(column);
        }

        Ok(BatchSnapshot {
            rows: u32::try_from(group_count).map_err(|_| RelationalError::ComputeFailure)?,
            fields,
            columns,
        })
    }
}

export!(DataRelational);
