#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error { InputTooLarge, BodyTooLarge, TooManyHeaders, InvalidSyntax, InvalidVersion, InvalidMethod, InvalidTarget, InvalidStatus, InvalidHeaderName, InvalidHeaderValue, HostRequired, InvalidContentLength, ConflictingFraming, UnsupportedTransferCoding, InvalidChunk, PrematureEof, OutputTooLarge }

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Header { pub name:String, pub value:Vec<u8> }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Response { pub minor_version:u8, pub status:u16, pub headers:Vec<Header>, pub body:Vec<u8>, pub consumed:u32 }
const MAX_HEAD_BYTES: usize = 64 << 10;
const MAX_BODY_BYTES: usize = 1 << 20;
const MAX_HEADERS: usize = 32;
const MAX_WIRE_BYTES: usize = MAX_HEAD_BYTES + MAX_BODY_BYTES + 4096;


fn valid_token(value: &str) -> bool {
    !value.is_empty()
        && value.bytes().all(|byte| {
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
                        | b'`'
                        | b'|'
                        | b'~'
                )
        })
}

fn valid_header_value(value: &[u8]) -> bool {
    value
        .iter()
        .all(|byte| *byte == b'\t' || (0x20..=0x7e).contains(byte) || *byte >= 0x80)
}

fn parse_decimal(value: &[u8]) -> Result<usize, Error> {
    let value = trim_ascii(value);
    if value.is_empty() || !value.iter().all(u8::is_ascii_digit) {
        return Err(Error::InvalidContentLength);
    }
    let text = core::str::from_utf8(value).map_err(|_| Error::InvalidContentLength)?;
    let parsed = text
        .parse::<usize>()
        .map_err(|_| Error::InvalidContentLength)?;
    if parsed > MAX_BODY_BYTES {
        Err(Error::BodyTooLarge)
    } else {
        Ok(parsed)
    }
}

fn trim_ascii(mut value: &[u8]) -> &[u8] {
    while value.first().is_some_and(u8::is_ascii_whitespace) {
        value = &value[1..];
    }
    while value.last().is_some_and(u8::is_ascii_whitespace) {
        value = &value[..value.len() - 1];
    }
    value
}

pub fn serialize_request(
    method: &str,
    target: &str,
    headers: &[Header],
    body: &[u8],
) -> Result<Vec<u8>, Error> {
    if !valid_token(method) {
        return Err(Error::InvalidMethod);
    }
    if target.is_empty() || target.bytes().any(|byte| byte <= 0x20 || byte == 0x7f) {
        return Err(Error::InvalidTarget);
    }
    if headers.len() > MAX_HEADERS {
        return Err(Error::TooManyHeaders);
    }
    if body.len() > MAX_BODY_BYTES {
        return Err(Error::BodyTooLarge);
    }

    let mut has_host = false;
    let mut content_length = None;
    for header in headers {
        if !valid_token(&header.name) {
            return Err(Error::InvalidHeaderName);
        }
        if !valid_header_value(&header.value) {
            return Err(Error::InvalidHeaderValue);
        }
        if header.name.eq_ignore_ascii_case("host") {
            if trim_ascii(&header.value).is_empty() {
                return Err(Error::HostRequired);
            }
            has_host = true;
        }
        if header.name.eq_ignore_ascii_case("transfer-encoding") {
            return Err(Error::UnsupportedTransferCoding);
        }
        if header.name.eq_ignore_ascii_case("content-length") {
            let parsed = parse_decimal(&header.value)?;
            match content_length {
                Some(existing) if existing != parsed => {
                    return Err(Error::InvalidContentLength)
                }
                _ => content_length = Some(parsed),
            }
        }
    }
    if !has_host {
        return Err(Error::HostRequired);
    }
    if content_length.is_some_and(|length| length != body.len()) {
        return Err(Error::InvalidContentLength);
    }

    let mut output = Vec::new();
    output.extend_from_slice(method.as_bytes());
    output.push(b' ');
    output.extend_from_slice(target.as_bytes());
    output.extend_from_slice(b" HTTP/1.1\r\n");
    for header in headers {
        output.extend_from_slice(header.name.to_ascii_lowercase().as_bytes());
        output.extend_from_slice(b": ");
        output.extend_from_slice(&header.value);
        output.extend_from_slice(b"\r\n");
    }
    if content_length.is_none() && !body.is_empty() {
        output.extend_from_slice(b"content-length: ");
        output.extend_from_slice(body.len().to_string().as_bytes());
        output.extend_from_slice(b"\r\n");
    }
    output.extend_from_slice(b"\r\n");
    output.extend_from_slice(body);
    if output.len() > MAX_WIRE_BYTES {
        Err(Error::OutputTooLarge)
    } else {
        Ok(output)
    }
}

struct ParsedHead {
    minor_version: u8,
    status: u16,
    headers: Vec<Header>,
    body_offset: usize,
    content_length: Option<usize>,
    chunked: bool,
}

fn parse_response_head(bytes: &[u8]) -> Result<Option<ParsedHead>, Error> {
    if bytes.len() > MAX_WIRE_BYTES {
        return Err(Error::InputTooLarge);
    }
    let head_limit = bytes.len().min(MAX_HEAD_BYTES + 1);
    let mut raw_headers = [httparse::EMPTY_HEADER; MAX_HEADERS];
    let mut response = httparse::Response::new(&mut raw_headers);
    let body_offset = match response.parse(&bytes[..head_limit]) {
        Ok(httparse::Status::Partial) if bytes.len() > MAX_HEAD_BYTES => {
            return Err(Error::InputTooLarge)
        }
        Ok(httparse::Status::Partial) => return Ok(None),
        Ok(httparse::Status::Complete(offset)) => offset,
        Err(httparse::Error::TooManyHeaders) => return Err(Error::TooManyHeaders),
        Err(_) => return Err(Error::InvalidSyntax),
    };
    let minor_version = response.version.ok_or(Error::InvalidVersion)?;
    if minor_version > 1 {
        return Err(Error::InvalidVersion);
    }
    let status = response.code.ok_or(Error::InvalidStatus)?;
    if !(100..=999).contains(&status) {
        return Err(Error::InvalidStatus);
    }

    let mut content_length = None;
    let mut chunked = false;
    let mut headers = Vec::with_capacity(response.headers.len());
    for header in response.headers.iter() {
        if header.name.eq_ignore_ascii_case("content-length") {
            let parsed = parse_decimal(header.value)?;
            match content_length {
                Some(existing) if existing != parsed => {
                    return Err(Error::InvalidContentLength)
                }
                _ => content_length = Some(parsed),
            }
        }
        if header.name.eq_ignore_ascii_case("transfer-encoding") {
            if !trim_ascii(header.value).eq_ignore_ascii_case(b"chunked") {
                return Err(Error::UnsupportedTransferCoding);
            }
            chunked = true;
        }
        headers.push(Header {
            name: header.name.to_ascii_lowercase(),
            value: header.value.to_vec(),
        });
    }
    if chunked && content_length.is_some() {
        return Err(Error::ConflictingFraming);
    }
    Ok(Some(ParsedHead {
        minor_version,
        status,
        headers,
        body_offset,
        content_length,
        chunked,
    }))
}

fn find_crlf(bytes: &[u8], start: usize) -> Option<usize> {
    bytes
        .get(start..)?
        .windows(2)
        .position(|pair| pair == b"\r\n")
        .map(|offset| start + offset)
}

fn decode_chunked(bytes: &[u8], start: usize) -> Result<Option<(Vec<u8>, usize)>, Error> {
    let mut cursor = start;
    let mut body = Vec::new();
    loop {
        let Some(line_end) = find_crlf(bytes, cursor) else {
            return Ok(None);
        };
        let size_text = bytes[cursor..line_end]
            .split(|byte| *byte == b';')
            .next()
            .unwrap_or_default();
        if size_text.is_empty() || !size_text.iter().all(u8::is_ascii_hexdigit) {
            return Err(Error::InvalidChunk);
        }
        let size_text = core::str::from_utf8(size_text).map_err(|_| Error::InvalidChunk)?;
        let size = usize::from_str_radix(size_text, 16).map_err(|_| Error::InvalidChunk)?;
        cursor = line_end + 2;
        if size == 0 {
            loop {
                let Some(trailer_end) = find_crlf(bytes, cursor) else {
                    return Ok(None);
                };
                if trailer_end == cursor {
                    return Ok(Some((body, cursor + 2)));
                }
                let trailer = &bytes[cursor..trailer_end];
                let Some(colon) = trailer.iter().position(|byte| *byte == b':') else {
                    return Err(Error::InvalidChunk);
                };
                let name =
                    core::str::from_utf8(&trailer[..colon]).map_err(|_| Error::InvalidChunk)?;
                if !valid_token(name) || !valid_header_value(trim_ascii(&trailer[colon + 1..])) {
                    return Err(Error::InvalidChunk);
                }
                cursor = trailer_end + 2;
                if cursor - start > MAX_HEAD_BYTES {
                    return Err(Error::InputTooLarge);
                }
            }
        }
        if body
            .len()
            .checked_add(size)
            .is_none_or(|total| total > MAX_BODY_BYTES)
        {
            return Err(Error::BodyTooLarge);
        }
        let Some(data_end) = cursor.checked_add(size) else {
            return Err(Error::BodyTooLarge);
        };
        if bytes.len() < data_end + 2 {
            return Ok(None);
        }
        if &bytes[data_end..data_end + 2] != b"\r\n" {
            return Err(Error::InvalidChunk);
        }
        body.extend_from_slice(&bytes[cursor..data_end]);
        cursor = data_end + 2;
    }
}

pub fn decode_response(
    bytes: &[u8],
    request_method: &str,
    eof: bool,
) -> Result<Option<Response>, Error> {
    if !valid_token(request_method) {
        return Err(Error::InvalidMethod);
    }
    let Some(head) = parse_response_head(bytes)? else {
        if eof && !bytes.is_empty() {
            return Err(Error::PrematureEof);
        }
        return Ok(None);
    };
    let no_body = request_method.eq_ignore_ascii_case("HEAD")
        || (100..200).contains(&head.status)
        || matches!(head.status, 204 | 304);
    let (body, consumed) = if no_body {
        (Vec::new(), head.body_offset)
    } else if head.chunked {
        let Some(decoded) = decode_chunked(bytes, head.body_offset)? else {
            if eof {
                return Err(Error::PrematureEof);
            }
            return Ok(None);
        };
        decoded
    } else if let Some(length) = head.content_length {
        let end = head
            .body_offset
            .checked_add(length)
            .ok_or(Error::BodyTooLarge)?;
        if bytes.len() < end {
            if eof {
                return Err(Error::PrematureEof);
            }
            return Ok(None);
        }
        (bytes[head.body_offset..end].to_vec(), end)
    } else if eof {
        let body = &bytes[head.body_offset..];
        if body.len() > MAX_BODY_BYTES {
            return Err(Error::BodyTooLarge);
        }
        (body.to_vec(), bytes.len())
    } else {
        return Ok(None);
    };
    Ok(Some(Response {
        minor_version: head.minor_version,
        status: head.status,
        headers: head.headers,
        body,
        consumed: u32::try_from(consumed).map_err(|_| Error::InputTooLarge)?,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header(name: &str, value: &[u8]) -> Header {
        Header {
            name: name.into(),
            value: value.into(),
        }
    }

    #[test]
    fn serializes_request_and_injects_content_length() {
        let bytes = serialize_request(
            "POST",
            "/v1/items?q=1",
            &[header("Host", b"example.test"), header("X-A", b"b")],
            b"hello",
        )
        .unwrap();
        assert_eq!(bytes, b"POST /v1/items?q=1 HTTP/1.1\r\nhost: example.test\r\nx-a: b\r\ncontent-length: 5\r\n\r\nhello");
    }

    #[test]
    fn rejects_request_smuggling_shapes() {
        assert!(matches!(
            serialize_request("GET", "/", &[], b""),
            Err(Error::HostRequired)
        ));
        assert!(matches!(
            serialize_request(
                "POST",
                "/",
                &[header("host", b"x"), header("content-length", b"4")],
                b"hello"
            ),
            Err(Error::InvalidContentLength)
        ));
        assert!(matches!(
            serialize_request(
                "POST",
                "/",
                &[
                    header("host", b"x"),
                    header("transfer-encoding", b"chunked")
                ],
                b""
            ),
            Err(Error::UnsupportedTransferCoding)
        ));
    }

    #[test]
    fn incrementally_decodes_content_length_and_pipeline_boundary() {
        let partial = b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhel";
        assert!(decode_response(partial, "GET", false).unwrap().is_none());
        assert!(matches!(
            decode_response(partial, "GET", true),
            Err(Error::PrematureEof)
        ));
        let full = b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhelloNEXT";
        let response = decode_response(full, "GET", false).unwrap().unwrap();
        assert_eq!(response.status, 200);
        assert_eq!(response.body, b"hello");
        assert_eq!(response.consumed as usize, full.len() - 4);
    }

    #[test]
    fn decodes_chunked_body_and_trailers() {
        let bytes = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5;ext=yes\r\npedia\r\n0\r\nX-End: yes\r\n\r\n";
        let response = decode_response(bytes, "GET", false).unwrap().unwrap();
        assert_eq!(response.body, b"Wikipedia");
        assert_eq!(response.consumed as usize, bytes.len());
    }

    #[test]
    fn handles_bodyless_and_close_delimited_responses() {
        let head = b"HTTP/1.1 204 No Content\r\n\r\nnext";
        let response = decode_response(head, "GET", false).unwrap().unwrap();
        assert!(response.body.is_empty());
        assert_eq!(response.consumed as usize, head.len() - 4);

        let close = b"HTTP/1.0 200 OK\r\n\r\nbody";
        assert!(decode_response(close, "GET", false).unwrap().is_none());
        assert_eq!(
            decode_response(close, "GET", true).unwrap().unwrap().body,
            b"body"
        );
    }

    #[test]
    fn rejects_conflicting_response_framing() {
        let bytes = b"HTTP/1.1 200 OK\r\nContent-Length: 1\r\nTransfer-Encoding: chunked\r\n\r\n";
        assert!(matches!(
            decode_response(bytes, "GET", false),
            Err(Error::ConflictingFraming)
        ));
    }
}
