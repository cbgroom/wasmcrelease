use crate::delta;
use crate::exports::wasmc::http1_server::wire::{
    Guest, Header as WitHeader, HttpError, RequestHead as WitRequestHead,
};

pub struct Adapter;

fn map_error(error: delta::Error) -> HttpError {
    match error {
        delta::Error::InputTooLarge => HttpError::InputTooLarge,
        delta::Error::TooManyHeaders => HttpError::TooManyHeaders,
        delta::Error::InvalidSyntax => HttpError::InvalidSyntax,
        delta::Error::Incomplete => HttpError::Incomplete,
        delta::Error::InvalidVersion => HttpError::InvalidVersion,
        delta::Error::InvalidStatus => HttpError::InvalidStatus,
        delta::Error::InvalidHeaderName => HttpError::InvalidHeaderName,
        delta::Error::InvalidHeaderValue => HttpError::InvalidHeaderValue,
        delta::Error::OutputTooLarge => HttpError::OutputTooLarge,
        delta::Error::InvalidContentLength => HttpError::InvalidContentLength,
        delta::Error::UnsupportedFraming => HttpError::UnsupportedFraming,
        delta::Error::BodyTooLarge => HttpError::BodyTooLarge,
    }
}

fn from_header(header: WitHeader) -> delta::Header {
    delta::Header {
        name: header.name,
        value: header.value,
    }
}

fn to_header(header: delta::Header) -> WitHeader {
    WitHeader {
        name: header.name,
        value: header.value,
    }
}

fn to_request_head(value: delta::RequestHead) -> WitRequestHead {
    WitRequestHead {
        method: value.method,
        target: value.target,
        minor_version: value.minor_version,
        headers: value.headers.into_iter().map(to_header).collect(),
        body_offset: value.body_offset,
    }
}

impl Guest for Adapter {
    fn parse_request(bytes: Vec<u8>) -> Result<WitRequestHead, HttpError> {
        delta::parse_request(bytes).map(to_request_head).map_err(map_error)
    }

    fn request_frame_length(bytes: Vec<u8>) -> Result<Option<u32>, HttpError> {
        delta::request_frame_length(bytes).map_err(map_error)
    }

    fn serialize_response_head(
        minor_version: u8,
        status: u16,
        headers: Vec<WitHeader>,
    ) -> Result<Vec<u8>, HttpError> {
        delta::serialize_response_head(
            minor_version,
            status,
            headers.into_iter().map(from_header).collect(),
        )
        .map_err(map_error)
    }
}
