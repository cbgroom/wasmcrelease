use crate::delta;
use crate::exports::wasmc::http1_client::wire as api;
pub struct Adapter;
fn error(v: delta::Error) -> api::HttpError { match v {
    delta::Error::InputTooLarge => api::HttpError::InputTooLarge,
    delta::Error::BodyTooLarge => api::HttpError::BodyTooLarge,
    delta::Error::TooManyHeaders => api::HttpError::TooManyHeaders,
    delta::Error::InvalidSyntax => api::HttpError::InvalidSyntax,
    delta::Error::InvalidVersion => api::HttpError::InvalidVersion,
    delta::Error::InvalidMethod => api::HttpError::InvalidMethod,
    delta::Error::InvalidTarget => api::HttpError::InvalidTarget,
    delta::Error::InvalidStatus => api::HttpError::InvalidStatus,
    delta::Error::InvalidHeaderName => api::HttpError::InvalidHeaderName,
    delta::Error::InvalidHeaderValue => api::HttpError::InvalidHeaderValue,
    delta::Error::HostRequired => api::HttpError::HostRequired,
    delta::Error::InvalidContentLength => api::HttpError::InvalidContentLength,
    delta::Error::ConflictingFraming => api::HttpError::ConflictingFraming,
    delta::Error::UnsupportedTransferCoding => api::HttpError::UnsupportedTransferCoding,
    delta::Error::InvalidChunk => api::HttpError::InvalidChunk,
    delta::Error::PrematureEof => api::HttpError::PrematureEof,
    delta::Error::OutputTooLarge => api::HttpError::OutputTooLarge,
} }

impl api::Guest for Adapter {
    fn serialize_request(method:String,target:String,headers:Vec<api::Header>,body:Vec<u8>)->Result<Vec<u8>,api::HttpError>{
        let headers=headers.into_iter().map(|h|delta::Header{name:h.name,value:h.value}).collect::<Vec<_>>();
        delta::serialize_request(&method,&target,&headers,&body).map_err(error)
    }
    fn decode_response(bytes:Vec<u8>,method:String,eof:bool)->Result<Option<api::Response>,api::HttpError>{
        delta::decode_response(&bytes,&method,eof).map(|r|r.map(|r|api::Response{
            minor_version:r.minor_version,status:r.status,body:r.body,consumed:r.consumed,
            headers:r.headers.into_iter().map(|h|api::Header{name:h.name,value:h.value}).collect(),
        })).map_err(error)
    }
}
