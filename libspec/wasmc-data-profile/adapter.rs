use crate::delta;
use crate::exports::wasmc::data_profile::profile::{
    BooleanSummary, ColumnProfile, Float64Summary, Guest, Int64Summary, LengthSummary,
    ProfileError, Summary, Uint64Summary,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot as WitBatchSnapshot, Column as WitColumn, DataType as WitDataType,
    Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);

pub struct Adapter;

fn map_error(error: delta::Error) -> ProfileError {
    match error {
        delta::Error::InvalidBatch => ProfileError::InvalidBatch,
        delta::Error::ColumnOutOfBounds => ProfileError::ColumnOutOfBounds,
        delta::Error::DuplicateColumn => ProfileError::DuplicateColumn,
        delta::Error::Overflow => ProfileError::Overflow,
        delta::Error::ComputeFailure => ProfileError::ComputeFailure,
    }
}
fn length(value: delta::LengthSummary) -> LengthSummary {
    LengthSummary { non_null:value.non_null, nulls:value.nulls, min_length:value.min_length, max_length:value.max_length, mean_length:value.mean_length }
}
fn summary(value: delta::Summary) -> Summary {
    match value {
        delta::Summary::Boolean(v)=>Summary::Boolean(BooleanSummary{non_null:v.non_null,nulls:v.nulls,true_count:v.true_count,false_count:v.false_count}),
        delta::Summary::Int64(v)=>Summary::Int64(Int64Summary{non_null:v.non_null,nulls:v.nulls,min:v.min,max:v.max,mean:v.mean}),
        delta::Summary::Uint64(v)=>Summary::Uint64(Uint64Summary{non_null:v.non_null,nulls:v.nulls,min:v.min,max:v.max,mean:v.mean}),
        delta::Summary::Float64(v)=>Summary::Float64(Float64Summary{non_null:v.non_null,nulls:v.nulls,min:v.min,max:v.max,mean:v.mean}),
        delta::Summary::Utf8(v)=>Summary::Utf8(length(v)),
        delta::Summary::Binary(v)=>Summary::Binary(length(v)),
    }
}
fn profile(value: delta::ColumnProfile) -> ColumnProfile {
    ColumnProfile { column:value.column, name:value.name, data_type:data_type_to_wit(value.data_type), summary:summary(value.summary) }
}
impl Guest for Adapter {
    fn describe(value: WitBatchSnapshot, columns: Vec<u32>) -> Result<Vec<ColumnProfile>, ProfileError> {
        delta::describe(batch_from_wit(value),columns).map(|v|v.into_iter().map(profile).collect()).map_err(map_error)
    }
}
