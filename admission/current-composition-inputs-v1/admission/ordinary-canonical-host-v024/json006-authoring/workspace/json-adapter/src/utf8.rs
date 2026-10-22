//! Exact UTF-8 conversion shared by the WIT export and native unit tests.
pub(crate) fn encode(input: String) -> Vec<u8> {
    input.into_bytes()
}

#[cfg(test)]
mod tests {
    use crate::{bindings::exports::wasmc::json::utf8::Guest, Component};

    #[test]
    fn empty() {
        assert_eq!(<Component as Guest>::encode(String::new()), b"");
    }

    #[test]
    fn ascii() {
        assert_eq!(
            <Component as Guest>::encode("UTF8 / 0123 !".into()),
            b"UTF8 / 0123 !"
        );
    }

    #[test]
    fn unicode() {
        assert_eq!(
            <Component as Guest>::encode("雪🦀café".into()),
            b"\xe9\x9b\xaa\xf0\x9f\xa6\x80caf\xc3\xa9"
        );
    }

    #[test]
    fn embedded_nul_is_preserved() {
        assert_eq!(
            <Component as Guest>::encode("a\0b\0".into()),
            [b'a', 0, b'b', 0]
        );
    }

    #[test]
    fn one_kibibyte() {
        assert_eq!(
            <Component as Guest>::encode("x".repeat(1024)),
            vec![b'x'; 1024]
        );
    }

    #[test]
    fn sixty_four_kibibytes_with_multibyte_text_and_nul() {
        let mut input = "雪".repeat(21_845);
        input.push('\0');
        assert_eq!(input.len(), 65_536);
        let mut expected = b"\xe9\x9b\xaa".repeat(21_845);
        expected.push(0);
        assert_eq!(<Component as Guest>::encode(input), expected);
    }

    #[test]
    fn owned_allocation_is_reused() {
        let mut input = String::with_capacity(1024);
        input.push_str("雪\0🦀");
        let pointer = input.as_ptr();
        let capacity = input.capacity();
        let bytes = <Component as Guest>::encode(input);
        assert_eq!(bytes, b"\xe9\x9b\xaa\0\xf0\x9f\xa6\x80");
        assert_eq!(bytes.as_ptr(), pointer);
        assert_eq!(bytes.capacity(), capacity);
    }
}
