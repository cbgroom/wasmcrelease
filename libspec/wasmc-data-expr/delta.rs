use crate::data_arrow::{self, BatchSnapshot, Column, DataType};
use arrow_arith::boolean::{and_kleene, is_null, not, or_kleene};
use arrow_arith::numeric::{add, div, mul, sub};
use arrow_array::{new_null_array, ArrayRef, BooleanArray, Float64Array, Int64Array, UInt64Array};
use arrow_ord::cmp::{eq, gt, gt_eq, lt, lt_eq, neq};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Unary { pub input: u32 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Binary { pub left: u32, pub right: u32 }
#[derive(Clone, Debug, PartialEq)]
pub enum Literal {
    Boolean(bool), Int64(i64), Uint64(u64), Float64(f64), Utf8(String), TypedNull(DataType),
}
#[derive(Clone, Debug, PartialEq)]
pub enum Node {
    Column(u32), Literal(Literal), Equal(Binary), NotEqual(Binary), Less(Binary),
    LessEqual(Binary), Greater(Binary), GreaterEqual(Binary), Add(Binary), Subtract(Binary),
    Multiply(Binary), Divide(Binary), LogicalAnd(Binary), LogicalOr(Binary),
    LogicalNot(Unary), IsNull(Unary),
}
#[derive(Clone, Debug, PartialEq)]
pub struct Program { pub nodes: Vec<Node>, pub root: u32 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    EmptyProgram, RootOutOfBounds, ForwardReference, ColumnOutOfBounds,
    TypeMismatch, UnsupportedType, ComputeFailure, InvalidProgram,
}

fn literal_array(value: Literal, rows: usize) -> ArrayRef {
    match value {
        Literal::Boolean(value) => Arc::new(BooleanArray::from(vec![Some(value); rows])),
        Literal::Int64(value) => Arc::new(Int64Array::from(vec![Some(value); rows])),
        Literal::Uint64(value) => Arc::new(UInt64Array::from(vec![Some(value); rows])),
        Literal::Float64(value) => Arc::new(Float64Array::from(vec![Some(value); rows])),
        Literal::Utf8(value) => Arc::new(arrow_array::StringArray::from(vec![Some(value); rows])),
        Literal::TypedNull(data_type) => new_null_array(&data_arrow::arrow_type(data_type), rows),
    }
}

fn unary_input<'a>(values: &'a [ArrayRef], node: usize, input: Unary) -> Result<&'a ArrayRef, Error> {
    let index=input.input as usize;
    if index>=node { return Err(Error::ForwardReference); }
    values.get(index).ok_or(Error::ForwardReference)
}
fn binary_inputs<'a>(values:&'a [ArrayRef],node:usize,input:Binary)->Result<(&'a ArrayRef,&'a ArrayRef),Error>{
    let left=input.left as usize; let right=input.right as usize;
    if left>=node || right>=node { return Err(Error::ForwardReference); }
    Ok((values.get(left).ok_or(Error::ForwardReference)?,values.get(right).ok_or(Error::ForwardReference)?))
}
fn boolean_array(value:&ArrayRef)->Result<&BooleanArray,Error>{
    value.as_any().downcast_ref::<BooleanArray>().ok_or(Error::TypeMismatch)
}
fn evaluate_array(value:&BatchSnapshot, expression:Program)->Result<ArrayRef,Error>{
    if expression.nodes.is_empty(){return Err(Error::EmptyProgram)}
    if expression.root as usize>=expression.nodes.len(){return Err(Error::RootOutOfBounds)}
    let batch=data_arrow::validate_snapshot(value).map_err(|_|Error::InvalidProgram)?;
    let columns=batch.columns();
    let rows=value.rows as usize;
    let mut values:Vec<ArrayRef>=Vec::with_capacity(expression.nodes.len());
    for (index,node) in expression.nodes.into_iter().enumerate(){
        let output:ArrayRef=match node{
            Node::Column(column)=>columns.get(column as usize).cloned().ok_or(Error::ColumnOutOfBounds)?,
            Node::Literal(literal)=>literal_array(literal,rows),
            Node::Equal(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(eq(l,r).map_err(|_|Error::ComputeFailure)?)},
            Node::NotEqual(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(neq(l,r).map_err(|_|Error::ComputeFailure)?)},
            Node::Less(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(lt(l,r).map_err(|_|Error::ComputeFailure)?)},
            Node::LessEqual(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(lt_eq(l,r).map_err(|_|Error::ComputeFailure)?)},
            Node::Greater(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(gt(l,r).map_err(|_|Error::ComputeFailure)?)},
            Node::GreaterEqual(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(gt_eq(l,r).map_err(|_|Error::ComputeFailure)?)},
            Node::Add(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;add(l,r).map_err(|_|Error::ComputeFailure)?},
            Node::Subtract(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;sub(l,r).map_err(|_|Error::ComputeFailure)?},
            Node::Multiply(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;mul(l,r).map_err(|_|Error::ComputeFailure)?},
            Node::Divide(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;div(l,r).map_err(|_|Error::ComputeFailure)?},
            Node::LogicalAnd(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(and_kleene(boolean_array(l)?,boolean_array(r)?).map_err(|_|Error::ComputeFailure)?)},
            Node::LogicalOr(binary)=>{let(l,r)=binary_inputs(&values,index,binary)?;Arc::new(or_kleene(boolean_array(l)?,boolean_array(r)?).map_err(|_|Error::ComputeFailure)?)},
            Node::LogicalNot(unary)=>{let input=unary_input(&values,index,unary)?;Arc::new(not(boolean_array(input)?).map_err(|_|Error::ComputeFailure)?)},
            Node::IsNull(unary)=>{let input=unary_input(&values,index,unary)?;Arc::new(is_null(input.as_ref()).map_err(|_|Error::ComputeFailure)?)},
        };
        values.push(output);
    }
    values.get(expression.root as usize).cloned().ok_or(Error::RootOutOfBounds)
}
pub fn validate(value:BatchSnapshot,expression:Program)->Result<DataType,Error>{
    let array=evaluate_array(&value,expression)?;
    data_arrow::data_type_from_arrow(array.data_type()).map_err(|_|Error::UnsupportedType)
}
pub fn evaluate(value:BatchSnapshot,expression:Program)->Result<Column,Error>{
    let array=evaluate_array(&value,expression)?;
    let ty=data_arrow::data_type_from_arrow(array.data_type()).map_err(|_|Error::UnsupportedType)?;
    data_arrow::array_to_column(ty,array.as_ref()).map_err(|_|Error::ComputeFailure)
}
