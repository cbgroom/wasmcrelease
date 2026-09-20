wit_bindgen::generate!({
    path: "wit",
    world: "http1-server",
});

use crate::exports::wasmc::http1_server::wire::{Guest, Header, HttpError, RequestHead};

const MAX_INPUT_BYTES: usize = 64 << 10;
const MAX_BODY_BYTES: usize = 1 << 20;
const MAX_HEADERS: usize = 32;
const MAX_OUTPUT_BYTES: usize = 64 << 10;

struct Wire;

fn parse_head(bytes: &[u8]) -> Result<RequestHead, HttpError> {
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(HttpError::InputTooLarge);
    }
    let mut headers = [httparse::EMPTY_HEADER; MAX_HEADERS];
    let mut request = httparse::Request::new(&mut headers);
    let body_offset = match request.parse(bytes) {
        Ok(httparse::Status::Complete(offset)) => offset,
        Ok(httparse::Status::Partial) => return Err(HttpError::Incomplete),
        Err(httparse::Error::TooManyHeaders) => return Err(HttpError::TooManyHeaders),
        Err(_) => return Err(HttpError::InvalidSyntax),
    };
    let method = request.method.ok_or(HttpError::InvalidSyntax)?.to_string();
    let target = request.path.ok_or(HttpError::InvalidSyntax)?.to_string();
    let minor = request.version.ok_or(HttpError::InvalidVersion)?;
    if minor > 1 {
        return Err(HttpError::InvalidVersion);
    }
    let headers = request
        .headers
        .iter()
        .map(|header| Header {
            name: header.name.to_string(),
            value: header.value.to_vec(),
        })
        .collect();
    Ok(RequestHead {
        method,
        target,
        minor_version: minor,
        headers,
        body_offset: body_offset as u32,
    })
}

fn ascii_eq_ignore_case(left: &str, right: &str) -> bool {
    left.eq_ignore_ascii_case(right)
}

fn parse_content_length(value: &[u8]) -> Result<usize, HttpError> {
    let text = core::str::from_utf8(value).map_err(|_| HttpError::InvalidContentLength)?;
    if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(HttpError::InvalidContentLength);
    }
    let value = text
        .parse::<usize>()
        .map_err(|_| HttpError::InvalidContentLength)?;
    if value > MAX_BODY_BYTES {
        Err(HttpError::BodyTooLarge)
    } else {
        Ok(value)
    }
}

fn frame_length(bytes: &[u8]) -> Result<Option<u32>, HttpError> {
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(HttpError::InputTooLarge);
    }
    let mut headers = [httparse::EMPTY_HEADER; MAX_HEADERS];
    let mut request = httparse::Request::new(&mut headers);
    let body_offset = match request.parse(bytes) {
        Ok(httparse::Status::Complete(offset)) => offset,
        Ok(httparse::Status::Partial) => return Ok(None),
        Err(httparse::Error::TooManyHeaders) => return Err(HttpError::TooManyHeaders),
        Err(_) => return Err(HttpError::InvalidSyntax),
    };
    let minor = request.version.ok_or(HttpError::InvalidVersion)?;
    if minor > 1 {
        return Err(HttpError::InvalidVersion);
    }

    let mut content_length = None;
    for header in request.headers.iter() {
        if ascii_eq_ignore_case(header.name, "transfer-encoding") && !header.value.is_empty() {
            return Err(HttpError::UnsupportedFraming);
        }
        if ascii_eq_ignore_case(header.name, "content-length") {
            let parsed = parse_content_length(header.value)?;
            match content_length {
                Some(existing) if existing != parsed => {
                    return Err(HttpError::InvalidContentLength)
                }
                _ => content_length = Some(parsed),
            }
        }
    }
    let body = content_length.unwrap_or(0);
    let total = body_offset
        .checked_add(body)
        .ok_or(HttpError::BodyTooLarge)?;
    if bytes.len() < total {
        Ok(None)
    } else {
        u32::try_from(total)
            .map(Some)
            .map_err(|_| HttpError::BodyTooLarge)
    }
}

fn reason(status: u16) -> Result<&'static str, HttpError> {
    if !(100..=999).contains(&status) {
        return Err(HttpError::InvalidStatus);
    }
    Ok(match status {
        100 => "Continue",
        101 => "Switching Protocols",
        102 => "Processing",
        103 => "Early Hints",
        200 => "OK",
        201 => "Created",
        202 => "Accepted",
        203 => "Non Authoritative Information",
        204 => "No Content",
        205 => "Reset Content",
        206 => "Partial Content",
        207 => "Multi-Status",
        208 => "Already Reported",
        226 => "IM Used",
        300 => "Multiple Choices",
        301 => "Moved Permanently",
        302 => "Found",
        303 => "See Other",
        304 => "Not Modified",
        305 => "Use Proxy",
        307 => "Temporary Redirect",
        308 => "Permanent Redirect",
        400 => "Bad Request",
        401 => "Unauthorized",
        402 => "Payment Required",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        406 => "Not Acceptable",
        407 => "Proxy Authentication Required",
        408 => "Request Timeout",
        409 => "Conflict",
        410 => "Gone",
        411 => "Length Required",
        412 => "Precondition Failed",
        413 => "Payload Too Large",
        414 => "URI Too Long",
        415 => "Unsupported Media Type",
        416 => "Range Not Satisfiable",
        417 => "Expectation Failed",
        418 => "I'm a teapot",
        421 => "Misdirected Request",
        422 => "Unprocessable Entity",
        423 => "Locked",
        424 => "Failed Dependency",
        425 => "Too Early",
        426 => "Upgrade Required",
        428 => "Precondition Required",
        429 => "Too Many Requests",
        431 => "Request Header Fields Too Large",
        451 => "Unavailable For Legal Reasons",
        500 => "Internal Server Error",
        501 => "Not Implemented",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        504 => "Gateway Timeout",
        505 => "HTTP Version Not Supported",
        506 => "Variant Also Negotiates",
        507 => "Insufficient Storage",
        508 => "Loop Detected",
        510 => "Not Extended",
        511 => "Network Authentication Required",
        _ => "",
    })
}

fn valid_header_name(name: &str) -> bool {
    !name.is_empty()
        && name.bytes().all(|byte| {
            byte.is_ascii_alphanumeric()
                || matches!(
                    byte,
                    b'!' | b'#'
                        | b'$'
                        | b'%'
                        | b'&'
                        | b'\''
                        | b'*'
                        | b'+'
                        | b'-'
                        | b'.'
                        | b'^'
                        | b'_'
                        | b'|'
                        | b'~'
                )
                || byte == 0x60
        })
}

fn valid_header_value(value: &[u8]) -> bool {
    value.iter().all(|byte| {
        *byte == b'\t' || (0x20..=0x7e).contains(byte) || *byte >= 0x80
    })
}

impl Guest for Wire {
    fn parse_request(bytes: Vec<u8>) -> Result<RequestHead, HttpError> {
        parse_head(&bytes)
    }

    fn request_frame_length(bytes: Vec<u8>) -> Result<Option<u32>, HttpError> {
        frame_length(&bytes)
    }

    fn serialize_response_head(
        minor_version: u8,
        status: u16,
        headers: Vec<Header>,
    ) -> Result<Vec<u8>, HttpError> {
        if minor_version > 1 {
            return Err(HttpError::InvalidVersion);
        }
        let reason = reason(status)?;
        if headers.len() > MAX_HEADERS {
            return Err(HttpError::TooManyHeaders);
        }
        let mut output = Vec::new();
        output.extend_from_slice(if minor_version == 0 {
            b"HTTP/1.0 "
        } else {
            b"HTTP/1.1 "
        });
        output.extend_from_slice(status.to_string().as_bytes());
        output.push(b' ');
        output.extend_from_slice(reason.as_bytes());
        output.extend_from_slice(b"\r\n");
        for header in headers {
            if !valid_header_name(&header.name) {
                return Err(HttpError::InvalidHeaderName);
            }
            if !valid_header_value(&header.value) {
                return Err(HttpError::InvalidHeaderValue);
            }
            output.extend_from_slice(header.name.to_ascii_lowercase().as_bytes());
            output.extend_from_slice(b": ");
            output.extend_from_slice(&header.value);
            output.extend_from_slice(b"\r\n");
            if output.len() > MAX_OUTPUT_BYTES {
                return Err(HttpError::OutputTooLarge);
            }
        }
        output.extend_from_slice(b"\r\n");
        if output.len() > MAX_OUTPUT_BYTES {
            Err(HttpError::OutputTooLarge)
        } else {
            Ok(output)
        }
    }
}

export!(Wire);
