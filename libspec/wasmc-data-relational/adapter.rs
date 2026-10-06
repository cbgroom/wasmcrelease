use crate::delta;
use crate::exports::wasmc::data_relational::relational::{
    Aggregate as WitAggregate, ColumnAggregate as WitColumnAggregate,
    DistinctOptions as WitDistinctOptions, Guest, JoinKey as WitJoinKey,
    JoinKind as WitJoinKind, JoinOptions as WitJoinOptions,
    OffsetWindow as WitOffsetWindow, OffsetWindowFunction as WitOffsetWindowFunction,
    RelationalError, RowsFrame as WitRowsFrame, RowsFrameEnd as WitRowsFrameEnd,
    RowsFrameStart as WitRowsFrameStart, WindowFunction as WitWindowFunction,
    WindowOptions as WitWindowOptions, WindowOrder as WitWindowOrder,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot as WitBatchSnapshot, Column as WitColumn, DataType as WitDataType,
    Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);
pub struct Adapter;
fn column_aggregate(v:WitColumnAggregate)->delta::ColumnAggregate{
    delta::ColumnAggregate{column:v.column,alias:v.alias}
}
fn aggregate(v:WitAggregate)->delta::Aggregate{match v{
    WitAggregate::CountAll(v)=>delta::Aggregate::CountAll(v),
    WitAggregate::Count(v)=>delta::Aggregate::Count(column_aggregate(v)),
    WitAggregate::Sum(v)=>delta::Aggregate::Sum(column_aggregate(v)),
    WitAggregate::Min(v)=>delta::Aggregate::Min(column_aggregate(v)),
    WitAggregate::Max(v)=>delta::Aggregate::Max(column_aggregate(v)),
    WitAggregate::Mean(v)=>delta::Aggregate::Mean(column_aggregate(v)),
    WitAggregate::First(v)=>delta::Aggregate::First(column_aggregate(v)),
    WitAggregate::Last(v)=>delta::Aggregate::Last(column_aggregate(v)),
    WitAggregate::VariancePop(v)=>delta::Aggregate::VariancePop(column_aggregate(v)),
    WitAggregate::StddevPop(v)=>delta::Aggregate::StddevPop(column_aggregate(v)),
}}
fn join_key(v:WitJoinKey)->delta::JoinKey{
    delta::JoinKey{left_column:v.left_column,right_column:v.right_column}
}
fn join_kind(v:WitJoinKind)->delta::JoinKind{match v{
    WitJoinKind::Inner=>delta::JoinKind::Inner,
    WitJoinKind::Left=>delta::JoinKind::Left,
}}
fn join_options(v:WitJoinOptions)->delta::JoinOptions{
    delta::JoinOptions{kind:join_kind(v.kind),right_prefix:v.right_prefix,max_output_rows:v.max_output_rows}
}
fn window_order(v:WitWindowOrder)->delta::WindowOrder{
    delta::WindowOrder{column:v.column,descending:v.descending,nulls_first:v.nulls_first}
}
fn window_function(v:WitWindowFunction)->delta::WindowFunction{match v{
    WitWindowFunction::RowNumber(v)=>delta::WindowFunction::RowNumber(v),
    WitWindowFunction::Rank(v)=>delta::WindowFunction::Rank(v),
    WitWindowFunction::DenseRank(v)=>delta::WindowFunction::DenseRank(v),
}}
fn window_options(v:WitWindowOptions)->delta::WindowOptions{delta::WindowOptions{max_rows:v.max_rows}}
fn rows_start(v:WitRowsFrameStart)->delta::RowsFrameStart{match v{
    WitRowsFrameStart::Unbounded=>delta::RowsFrameStart::Unbounded,
    WitRowsFrameStart::Preceding(v)=>delta::RowsFrameStart::Preceding(v),
    WitRowsFrameStart::CurrentRow=>delta::RowsFrameStart::CurrentRow,
    WitRowsFrameStart::Following(v)=>delta::RowsFrameStart::Following(v),
}}
fn rows_end(v:WitRowsFrameEnd)->delta::RowsFrameEnd{match v{
    WitRowsFrameEnd::Preceding(v)=>delta::RowsFrameEnd::Preceding(v),
    WitRowsFrameEnd::CurrentRow=>delta::RowsFrameEnd::CurrentRow,
    WitRowsFrameEnd::Following(v)=>delta::RowsFrameEnd::Following(v),
    WitRowsFrameEnd::Unbounded=>delta::RowsFrameEnd::Unbounded,
}}
fn rows_frame(v:WitRowsFrame)->delta::RowsFrame{
    delta::RowsFrame{start:rows_start(v.start),end:rows_end(v.end)}
}
fn distinct_options(v:WitDistinctOptions)->delta::DistinctOptions{delta::DistinctOptions{max_rows:v.max_rows}}
fn offset_window(v:WitOffsetWindow)->delta::OffsetWindow{
    delta::OffsetWindow{column:v.column,offset:v.offset,alias:v.alias}
}
fn offset_function(v:WitOffsetWindowFunction)->delta::OffsetWindowFunction{match v{
    WitOffsetWindowFunction::Lag(v)=>delta::OffsetWindowFunction::Lag(offset_window(v)),
    WitOffsetWindowFunction::Lead(v)=>delta::OffsetWindowFunction::Lead(offset_window(v)),
}}
fn error(v:delta::Error)->RelationalError{match v{
    delta::Error::InvalidBatch=>RelationalError::InvalidBatch,
    delta::Error::EmptyInput=>RelationalError::EmptyInput,
    delta::Error::EmptyKeys=>RelationalError::EmptyKeys,
    delta::Error::EmptyOrder=>RelationalError::EmptyOrder,
    delta::Error::EmptyFunctions=>RelationalError::EmptyFunctions,
    delta::Error::SchemaMismatch=>RelationalError::SchemaMismatch,
    delta::Error::KeyTypeMismatch=>RelationalError::KeyTypeMismatch,
    delta::Error::ColumnOutOfBounds=>RelationalError::ColumnOutOfBounds,
    delta::Error::DuplicateKey=>RelationalError::DuplicateKey,
    delta::Error::DuplicateFunction=>RelationalError::DuplicateFunction,
    delta::Error::EmptyAlias=>RelationalError::EmptyAlias,
    delta::Error::DuplicateOutputName=>RelationalError::DuplicateOutputName,
    delta::Error::InvalidLimit=>RelationalError::InvalidLimit,
    delta::Error::RowLimitExceeded=>RelationalError::RowLimitExceeded,
    delta::Error::OutputLimitExceeded=>RelationalError::OutputLimitExceeded,
    delta::Error::UnsupportedType=>RelationalError::UnsupportedType,
    delta::Error::UnsupportedFunction=>RelationalError::UnsupportedFunction,
    delta::Error::InvalidFrame=>RelationalError::InvalidFrame,
    delta::Error::Overflow=>RelationalError::Overflow,
    delta::Error::ComputeFailure=>RelationalError::ComputeFailure,
}}
impl Guest for Adapter{
    fn group_aggregate(value:WitBatchSnapshot,keys:Vec<u32>,aggregates:Vec<WitAggregate>)->Result<WitBatchSnapshot,RelationalError>{
        delta::group_aggregate(batch_from_wit(value),keys,aggregates.into_iter().map(aggregate).collect()).map(batch_to_wit).map_err(error)
    }
    fn union_all(values:Vec<WitBatchSnapshot>)->Result<WitBatchSnapshot,RelationalError>{
        delta::union_all(values.into_iter().map(batch_from_wit).collect()).map(batch_to_wit).map_err(error)
    }
    fn equi_join(left:WitBatchSnapshot,right:WitBatchSnapshot,keys:Vec<WitJoinKey>,options:WitJoinOptions)->Result<WitBatchSnapshot,RelationalError>{
        delta::equi_join(batch_from_wit(left),batch_from_wit(right),keys.into_iter().map(join_key).collect(),join_options(options)).map(batch_to_wit).map_err(error)
    }
    fn window_rank(value:WitBatchSnapshot,partition_by:Vec<u32>,order_by:Vec<WitWindowOrder>,functions:Vec<WitWindowFunction>,options:WitWindowOptions)->Result<WitBatchSnapshot,RelationalError>{
        delta::window_rank(batch_from_wit(value),partition_by,order_by.into_iter().map(window_order).collect(),functions.into_iter().map(window_function).collect(),window_options(options)).map(batch_to_wit).map_err(error)
    }
    fn distinct(value:WitBatchSnapshot,keys:Vec<u32>,options:WitDistinctOptions)->Result<WitBatchSnapshot,RelationalError>{
        delta::distinct(batch_from_wit(value),keys,distinct_options(options)).map(batch_to_wit).map_err(error)
    }
    fn window_offset(value:WitBatchSnapshot,partition_by:Vec<u32>,order_by:Vec<WitWindowOrder>,functions:Vec<WitOffsetWindowFunction>,options:WitWindowOptions)->Result<WitBatchSnapshot,RelationalError>{
        delta::window_offset(batch_from_wit(value),partition_by,order_by.into_iter().map(window_order).collect(),functions.into_iter().map(offset_function).collect(),window_options(options)).map(batch_to_wit).map_err(error)
    }
    fn window_aggregate(value:WitBatchSnapshot,partition_by:Vec<u32>,order_by:Vec<WitWindowOrder>,frame:WitRowsFrame,aggregates:Vec<WitAggregate>,options:WitWindowOptions)->Result<WitBatchSnapshot,RelationalError>{
        delta::window_aggregate(batch_from_wit(value),partition_by,order_by.into_iter().map(window_order).collect(),rows_frame(frame),aggregates.into_iter().map(aggregate).collect(),window_options(options)).map(batch_to_wit).map_err(error)
    }
}
