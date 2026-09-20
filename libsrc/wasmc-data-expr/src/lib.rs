wit_bindgen::generate!({
    path: "wit",
    world: "data-expr",
    generate_all,
});

use crate::exports::wasmc::data_expr::expr::{
    Binary as ExprBinary, ExprError, Guest, Literal, Node, Program, Unary,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot, Column, DataType as WitDataType,
};
use arrow_arith::boolean::{and_kleene, is_null, not, or_kleene};
use arrow_arith::numeric::{add, div, mul, sub};
use arrow_array::builder::{BinaryBuilder, StringBuilder};
use arrow_array::{
    new_null_array, Array, ArrayRef, BinaryArray, BooleanArray, Float64Array, Int64Array,
    StringArray, UInt64Array,
};
use arrow_ord::cmp::{eq, gt, gt_eq, lt, lt_eq, neq};
use arrow_schema::DataType as ArrowDataType;
use std::sync::Arc;

struct DataExpr;

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

fn wit_type(value: &ArrowDataType) -> Result<WitDataType, ExprError> {
    match value {
        ArrowDataType::Boolean => Ok(WitDataType::Boolean),
        ArrowDataType::Int64 => Ok(WitDataType::Int64),
        ArrowDataType::UInt64 => Ok(WitDataType::Uint64),
        ArrowDataType::Float64 => Ok(WitDataType::Float64),
        ArrowDataType::Utf8 => Ok(WitDataType::Utf8),
        ArrowDataType::Binary => Ok(WitDataType::Binary),
        _ => Err(ExprError::UnsupportedType),
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

fn array_to_column(array: &dyn Array) -> Result<Column, ExprError> {
    match array.data_type() {
        ArrowDataType::Boolean => {
            let values = array
                .as_any()
                .downcast_ref::<BooleanArray>()
                .ok_or(ExprError::ComputeFailure)?;
            Ok(Column::BooleanColumn(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        ArrowDataType::Int64 => {
            let values = array
                .as_any()
                .downcast_ref::<Int64Array>()
                .ok_or(ExprError::ComputeFailure)?;
            Ok(Column::Int64Column(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        ArrowDataType::UInt64 => {
            let values = array
                .as_any()
                .downcast_ref::<UInt64Array>()
                .ok_or(ExprError::ComputeFailure)?;
            Ok(Column::Uint64Column(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        ArrowDataType::Float64 => {
            let values = array
                .as_any()
                .downcast_ref::<Float64Array>()
                .ok_or(ExprError::ComputeFailure)?;
            Ok(Column::Float64Column(
                (0..values.len())
                    .map(|index| if values.is_null(index) { None } else { Some(values.value(index)) })
                    .collect(),
            ))
        }
        ArrowDataType::Utf8 => {
            let values = array
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(ExprError::ComputeFailure)?;
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
        ArrowDataType::Binary => {
            let values = array
                .as_any()
                .downcast_ref::<BinaryArray>()
                .ok_or(ExprError::ComputeFailure)?;
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
        _ => Err(ExprError::UnsupportedType),
    }
}

fn validate_batch(value: &BatchSnapshot) -> Result<Vec<ArrayRef>, ExprError> {
    if value.fields.len() != value.columns.len() {
        return Err(ExprError::InvalidProgram);
    }
    let rows = value.rows as usize;
    let mut arrays = Vec::with_capacity(value.columns.len());
    for (field, column) in value.fields.iter().zip(&value.columns) {
        if column_len(column) != rows {
            return Err(ExprError::InvalidProgram);
        }
        if column_type(column) != field.data_type {
            return Err(ExprError::TypeMismatch);
        }
        arrays.push(column_to_array(column));
    }
    Ok(arrays)
}

fn literal_array(value: Literal, rows: usize) -> ArrayRef {
    match value {
        Literal::Boolean(value) => Arc::new(BooleanArray::from(vec![Some(value); rows])),
        Literal::Int64(value) => Arc::new(Int64Array::from(vec![Some(value); rows])),
        Literal::Uint64(value) => Arc::new(UInt64Array::from(vec![Some(value); rows])),
        Literal::Float64(value) => Arc::new(Float64Array::from(vec![Some(value); rows])),
        Literal::Utf8(value) => {
            let mut builder = StringBuilder::new();
            for _ in 0..rows {
                builder.append_value(&value);
            }
            Arc::new(builder.finish())
        }
        Literal::TypedNull(data_type) => new_null_array(&arrow_type(data_type), rows),
    }
}

fn unary_input<'a>(values: &'a [ArrayRef], node: usize, input: Unary) -> Result<&'a ArrayRef, ExprError> {
    let index = input.input as usize;
    if index >= node {
        return Err(ExprError::ForwardReference);
    }
    values.get(index).ok_or(ExprError::ForwardReference)
}

fn binary_inputs<'a>(
    values: &'a [ArrayRef],
    node: usize,
    input: ExprBinary,
) -> Result<(&'a ArrayRef, &'a ArrayRef), ExprError> {
    let left = input.left as usize;
    let right = input.right as usize;
    if left >= node || right >= node {
        return Err(ExprError::ForwardReference);
    }
    Ok((
        values.get(left).ok_or(ExprError::ForwardReference)?,
        values.get(right).ok_or(ExprError::ForwardReference)?,
    ))
}

fn boolean_array(value: &ArrayRef) -> Result<&BooleanArray, ExprError> {
    value
        .as_any()
        .downcast_ref::<BooleanArray>()
        .ok_or(ExprError::TypeMismatch)
}

fn evaluate_array(value: &BatchSnapshot, expression: Program) -> Result<ArrayRef, ExprError> {
    if expression.nodes.is_empty() {
        return Err(ExprError::EmptyProgram);
    }
    if expression.root as usize >= expression.nodes.len() {
        return Err(ExprError::RootOutOfBounds);
    }

    let columns = validate_batch(value)?;
    let rows = value.rows as usize;
    let mut values: Vec<ArrayRef> = Vec::with_capacity(expression.nodes.len());

    for (index, node) in expression.nodes.into_iter().enumerate() {
        let output: ArrayRef = match node {
            Node::Column(column) => columns
                .get(column as usize)
                .cloned()
                .ok_or(ExprError::ColumnOutOfBounds)?,
            Node::Literal(literal) => literal_array(literal, rows),
            Node::Equal(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(eq(left, right).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::NotEqual(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(neq(left, right).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::Less(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(lt(left, right).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::LessEqual(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(lt_eq(left, right).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::Greater(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(gt(left, right).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::GreaterEqual(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(gt_eq(left, right).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::Add(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                add(left, right).map_err(|_| ExprError::ComputeFailure)?
            }
            Node::Subtract(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                sub(left, right).map_err(|_| ExprError::ComputeFailure)?
            }
            Node::Multiply(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                mul(left, right).map_err(|_| ExprError::ComputeFailure)?
            }
            Node::Divide(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                div(left, right).map_err(|_| ExprError::ComputeFailure)?
            }
            Node::LogicalAnd(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(
                    and_kleene(boolean_array(left)?, boolean_array(right)?)
                        .map_err(|_| ExprError::ComputeFailure)?,
                )
            }
            Node::LogicalOr(binary) => {
                let (left, right) = binary_inputs(&values, index, binary)?;
                Arc::new(
                    or_kleene(boolean_array(left)?, boolean_array(right)?)
                        .map_err(|_| ExprError::ComputeFailure)?,
                )
            }
            Node::LogicalNot(unary) => {
                let input = unary_input(&values, index, unary)?;
                Arc::new(not(boolean_array(input)?).map_err(|_| ExprError::ComputeFailure)?)
            }
            Node::IsNull(unary) => {
                let input = unary_input(&values, index, unary)?;
                Arc::new(is_null(input.as_ref()).map_err(|_| ExprError::ComputeFailure)?)
            }
        };
        values.push(output);
    }

    values
        .get(expression.root as usize)
        .cloned()
        .ok_or(ExprError::RootOutOfBounds)
}

impl Guest for DataExpr {
    fn validate(value: BatchSnapshot, expression: Program) -> Result<WitDataType, ExprError> {
        let array = evaluate_array(&value, expression)?;
        wit_type(array.data_type())
    }

    fn evaluate(value: BatchSnapshot, expression: Program) -> Result<Column, ExprError> {
        let array = evaluate_array(&value, expression)?;
        array_to_column(array.as_ref())
    }
}

export!(DataExpr);
