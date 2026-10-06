use crate::delta;
use crate::exports::wasmc::data_interchange::adapter::{
    DecodeOptions as WitDecodeOptions, EncodeOptions as WitEncodeOptions, Guest, InterchangeError,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot as WitBatchSnapshot, Column as WitColumn, DataType as WitDataType,
    Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);
pub struct Adapter;

fn encode(v:WitEncodeOptions)->delta::EncodeOptions{delta::EncodeOptions{max_batches:v.max_batches,max_rows:v.max_rows,max_output_bytes:v.max_output_bytes}}
fn decode(v:WitDecodeOptions)->delta::DecodeOptions{delta::DecodeOptions{max_input_bytes:v.max_input_bytes,max_batches:v.max_batches,max_rows:v.max_rows,batch_rows:v.batch_rows}}
fn error(v:delta::Error)->InterchangeError{match v{
    delta::Error::InvalidOptions=>InterchangeError::InvalidOptions,
    delta::Error::InvalidBatch=>InterchangeError::InvalidBatch,
    delta::Error::EmptyInput=>InterchangeError::EmptyInput,
    delta::Error::SchemaMismatch=>InterchangeError::SchemaMismatch,
    delta::Error::UnsupportedType=>InterchangeError::UnsupportedType,
    delta::Error::InputLimitExceeded=>InterchangeError::InputLimitExceeded,
    delta::Error::BatchLimitExceeded=>InterchangeError::BatchLimitExceeded,
    delta::Error::RowLimitExceeded=>InterchangeError::RowLimitExceeded,
    delta::Error::OutputLimitExceeded=>InterchangeError::OutputLimitExceeded,
    delta::Error::InvalidData=>InterchangeError::InvalidData,
    delta::Error::EncodeFailure=>InterchangeError::EncodeFailure,
    delta::Error::Overflow=>InterchangeError::Overflow,
}}
fn from_batches(v:Vec<WitBatchSnapshot>)->Vec<crate::data_arrow::BatchSnapshot>{v.into_iter().map(batch_from_wit).collect()}
fn to_batches(v:Vec<crate::data_arrow::BatchSnapshot>)->Vec<WitBatchSnapshot>{v.into_iter().map(batch_to_wit).collect()}
impl Guest for Adapter{
    fn ipc_file_encode(values:Vec<WitBatchSnapshot>,options:WitEncodeOptions)->Result<Vec<u8>,InterchangeError>{
        delta::ipc_file_encode(from_batches(values),encode(options)).map_err(error)
    }
    fn ipc_file_decode(input:Vec<u8>,options:WitDecodeOptions)->Result<Vec<WitBatchSnapshot>,InterchangeError>{
        delta::ipc_file_decode(input,decode(options)).map(to_batches).map_err(error)
    }
    fn parquet_encode(values:Vec<WitBatchSnapshot>,options:WitEncodeOptions)->Result<Vec<u8>,InterchangeError>{
        delta::parquet_encode(from_batches(values),encode(options)).map_err(error)
    }
    fn parquet_decode(input:Vec<u8>,options:WitDecodeOptions)->Result<Vec<WitBatchSnapshot>,InterchangeError>{
        delta::parquet_decode(input,decode(options)).map(to_batches).map_err(error)
    }
}
