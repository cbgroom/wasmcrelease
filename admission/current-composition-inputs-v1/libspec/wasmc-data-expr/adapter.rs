use crate::delta;
use crate::exports::wasmc::data_expr::expr::{
    Binary as WitBinary, ExprError, Guest, Literal as WitLiteral, Node as WitNode,
    Program as WitProgram, Unary as WitUnary,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot as WitBatchSnapshot, Column as WitColumn, DataType as WitDataType,
    Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);
pub struct Adapter;

fn binary(v:WitBinary)->delta::Binary{delta::Binary{left:v.left,right:v.right}}
fn unary(v:WitUnary)->delta::Unary{delta::Unary{input:v.input}}
fn literal(v:WitLiteral)->delta::Literal{match v{
    WitLiteral::Boolean(v)=>delta::Literal::Boolean(v),
    WitLiteral::Int64(v)=>delta::Literal::Int64(v),
    WitLiteral::Uint64(v)=>delta::Literal::Uint64(v),
    WitLiteral::Float64(v)=>delta::Literal::Float64(v),
    WitLiteral::Utf8(v)=>delta::Literal::Utf8(v),
    WitLiteral::TypedNull(v)=>delta::Literal::TypedNull(data_type_from_wit(v)),
}}
fn node(v:WitNode)->delta::Node{match v{
    WitNode::Column(v)=>delta::Node::Column(v), WitNode::Literal(v)=>delta::Node::Literal(literal(v)),
    WitNode::Equal(v)=>delta::Node::Equal(binary(v)), WitNode::NotEqual(v)=>delta::Node::NotEqual(binary(v)),
    WitNode::Less(v)=>delta::Node::Less(binary(v)), WitNode::LessEqual(v)=>delta::Node::LessEqual(binary(v)),
    WitNode::Greater(v)=>delta::Node::Greater(binary(v)), WitNode::GreaterEqual(v)=>delta::Node::GreaterEqual(binary(v)),
    WitNode::Add(v)=>delta::Node::Add(binary(v)), WitNode::Subtract(v)=>delta::Node::Subtract(binary(v)),
    WitNode::Multiply(v)=>delta::Node::Multiply(binary(v)), WitNode::Divide(v)=>delta::Node::Divide(binary(v)),
    WitNode::LogicalAnd(v)=>delta::Node::LogicalAnd(binary(v)), WitNode::LogicalOr(v)=>delta::Node::LogicalOr(binary(v)),
    WitNode::LogicalNot(v)=>delta::Node::LogicalNot(unary(v)), WitNode::IsNull(v)=>delta::Node::IsNull(unary(v)),
}}
fn program(v:WitProgram)->delta::Program{delta::Program{nodes:v.nodes.into_iter().map(node).collect(),root:v.root}}
fn error(v:delta::Error)->ExprError{match v{
    delta::Error::EmptyProgram=>ExprError::EmptyProgram,delta::Error::RootOutOfBounds=>ExprError::RootOutOfBounds,
    delta::Error::ForwardReference=>ExprError::ForwardReference,delta::Error::ColumnOutOfBounds=>ExprError::ColumnOutOfBounds,
    delta::Error::TypeMismatch=>ExprError::TypeMismatch,delta::Error::UnsupportedType=>ExprError::UnsupportedType,
    delta::Error::ComputeFailure=>ExprError::ComputeFailure,delta::Error::InvalidProgram=>ExprError::InvalidProgram,
}}
impl Guest for Adapter{
    fn validate(value:WitBatchSnapshot,expression:WitProgram)->Result<WitDataType,ExprError>{
        delta::validate(batch_from_wit(value),program(expression)).map(data_type_to_wit).map_err(error)
    }
    fn evaluate(value:WitBatchSnapshot,expression:WitProgram)->Result<WitColumn,ExprError>{
        delta::evaluate(batch_from_wit(value),program(expression)).map(column_to_wit).map_err(error)
    }
}
