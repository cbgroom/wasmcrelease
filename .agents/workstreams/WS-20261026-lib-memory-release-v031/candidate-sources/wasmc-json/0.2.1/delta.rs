//! JSON syntax, escapes and numbers are delegated to serde_json. The arena
//! stores only indices, so parsing, rendering, updates and drop do not impose
//! a recursive Rust call-stack depth or per-document byte/count quota.
use serde_json::{value::RawValue, Number, Value};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    InvalidJson,
    InvalidPointer,
    MissingTarget,
    TypeMismatch,
    InvalidIndex,
    OutOfRange,
    InvalidOperation,
    AllocationFailed,
}
type Result<T> = std::result::Result<T, Error>;
#[derive(Debug)]
enum Node {
    Null,
    Bool(bool),
    Number(Number),
    String(String),
    Array(Vec<usize>),
    Object(BTreeMap<String, usize>),
}
struct Document {
    nodes: Vec<Node>,
    free: Vec<usize>,
    root: usize,
}
fn push<T>(v: &mut Vec<T>, value: T) -> Result<()> {
    v.try_reserve(1).map_err(|_| Error::AllocationFailed)?;
    v.push(value);
    Ok(())
}
fn json<T>(r: serde_json::Result<T>) -> Result<T> {
    r.map_err(|_| Error::InvalidJson)
}
impl Document {
    fn new(input: &[u8]) -> Result<Self> {
        let mut d = Self {
            nodes: Vec::new(),
            free: Vec::new(),
            root: 0,
        };
        d.root = d.parse(input)?;
        Ok(d)
    }
    fn slot(&mut self) -> Result<usize> {
        if let Some(i) = self.free.pop() {
            return Ok(i);
        }
        let i = self.nodes.len();
        push(&mut self.nodes, Node::Null)?;
        Ok(i)
    }
    fn parse(&mut self, input: &[u8]) -> Result<usize> {
        let raw: &RawValue = json(serde_json::from_slice(input))?;
        let root = self.slot()?;
        let mut work = vec![(root, raw)];
        while let Some((index, raw)) = work.pop() {
            let text = raw.get();
            self.nodes[index] = match text.as_bytes()[0] {
                b'[' => {
                    let values: Vec<&RawValue> = json(serde_json::from_str(text))?;
                    let mut children = Vec::new();
                    children
                        .try_reserve(values.len())
                        .map_err(|_| Error::AllocationFailed)?;
                    for value in values {
                        let i = self.slot()?;
                        children.push(i);
                        push(&mut work, (i, value))?;
                    }
                    Node::Array(children)
                }
                b'{' => {
                    // serde_json owns decoded key and duplicate-key semantics.
                    let values: BTreeMap<String, &RawValue> = json(serde_json::from_str(text))?;
                    let mut children = BTreeMap::new();
                    for (key, value) in values {
                        let i = self.slot()?;
                        children.insert(key, i);
                        push(&mut work, (i, value))?;
                    }
                    Node::Object(children)
                }
                _ => match json(serde_json::from_str::<Value>(text))? {
                    Value::Null => Node::Null,
                    Value::Bool(v) => Node::Bool(v),
                    Value::Number(v) => Node::Number(v),
                    Value::String(v) => Node::String(v),
                    _ => unreachable!(),
                },
            };
        }
        Ok(root)
    }
    fn render(&self, root: usize) -> Result<String> {
        enum Part<'a> {
            Value(usize),
            Key(&'a str),
            Byte(u8),
        }
        let mut work = vec![Part::Value(root)];
        let mut output = Vec::new();
        while let Some(part) = work.pop() {
            match part {
                Part::Byte(b) => push(&mut output, b)?,
                Part::Key(key) => {
                    serde_json::to_writer(&mut output, key).map_err(|_| Error::AllocationFailed)?
                }
                Part::Value(i) => match &self.nodes[i] {
                    Node::Null => output.extend_from_slice(b"null"),
                    Node::Bool(v) => output.extend_from_slice(if *v { b"true" } else { b"false" }),
                    Node::Number(v) => serde_json::to_writer(&mut output, v)
                        .map_err(|_| Error::AllocationFailed)?,
                    Node::String(v) => serde_json::to_writer(&mut output, v)
                        .map_err(|_| Error::AllocationFailed)?,
                    Node::Array(values) => {
                        push(&mut output, b'[')?;
                        push(&mut work, Part::Byte(b']'))?;
                        for (n, &child) in values.iter().enumerate().rev() {
                            push(&mut work, Part::Value(child))?;
                            if n != 0 {
                                push(&mut work, Part::Byte(b','))?;
                            }
                        }
                    }
                    Node::Object(values) => {
                        push(&mut output, b'{')?;
                        push(&mut work, Part::Byte(b'}'))?;
                        for (n, (key, &child)) in values.iter().enumerate().rev() {
                            push(&mut work, Part::Value(child))?;
                            push(&mut work, Part::Byte(b':'))?;
                            push(&mut work, Part::Key(key))?;
                            if n != 0 {
                                push(&mut work, Part::Byte(b','))?;
                            }
                        }
                    }
                },
            }
        }
        String::from_utf8(output).map_err(|_| Error::InvalidJson)
    }
    fn get(&self, parts: &[String]) -> Result<Option<usize>> {
        let mut node = self.root;
        for part in parts {
            node = match &self.nodes[node] {
                Node::Object(values) => match values.get(part) {
                    Some(&v) => v,
                    None => return Ok(None),
                },
                Node::Array(values) => match array_index(part).ok().and_then(|i| values.get(i)) {
                    Some(&v) => v,
                    None => return Ok(None),
                },
                _ => return Ok(None),
            };
        }
        Ok(Some(node))
    }
    fn retire(&mut self, root: usize) -> Result<()> {
        let mut work = vec![root];
        while let Some(i) = work.pop() {
            match std::mem::replace(&mut self.nodes[i], Node::Null) {
                Node::Array(v) => {
                    for child in v {
                        push(&mut work, child)?;
                    }
                }
                Node::Object(v) => {
                    for child in v.into_values() {
                        push(&mut work, child)?;
                    }
                }
                _ => {}
            }
            push(&mut self.free, i)?;
        }
        Ok(())
    }
}
fn array_index(s: &str) -> Result<usize> {
    if s.is_empty() || (s.len() > 1 && s.starts_with('0')) || !s.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(Error::InvalidIndex);
    }
    s.parse().map_err(|_| Error::InvalidIndex)
}
fn pointer(pointer: &str) -> Result<Vec<String>> {
    if pointer.is_empty() {
        return Ok(Vec::new());
    }
    if !pointer.starts_with('/') {
        return Err(Error::InvalidPointer);
    }
    pointer[1..]
        .split('/')
        .map(|part| {
            let mut result = String::new();
            let mut chars = part.chars();
            while let Some(c) = chars.next() {
                if c == '~' {
                    result.push(match chars.next() {
                        Some('0') => '~',
                        Some('1') => '/',
                        _ => return Err(Error::InvalidPointer),
                    });
                } else {
                    result.push(c);
                }
            }
            Ok(result)
        })
        .collect()
}
pub fn compact(input: &[u8]) -> Result<String> {
    let d = Document::new(input)?;
    d.render(d.root)
}
pub fn validate(input: &[u8]) -> Result<()> {
    Document::new(input).map(|_| ())
}
pub fn select(input: &[u8], pointers: &[String]) -> Result<Vec<Option<String>>> {
    let parts = pointers
        .iter()
        .map(|p| pointer(p))
        .collect::<Result<Vec<_>>>()?;
    let d = Document::new(input)?;
    parts
        .iter()
        .map(|p| d.get(p)?.map(|i| d.render(i)).transpose())
        .collect()
}
pub fn quote(input: &str) -> String {
    serde_json::to_string(input)
        .expect("serializing a Rust string is infallible apart from allocation")
}
pub fn object(fields: Vec<(String, String)>) -> Result<String> {
    let mut d = Document::new(b"{}")?;
    let mut values = BTreeMap::new();
    for (key, value) in fields {
        let i = d.parse(value.as_bytes())?;
        if let Some(old) = values.insert(key, i) {
            d.retire(old)?;
        }
    }
    d.nodes[d.root] = Node::Object(values);
    d.render(d.root)
}
pub fn array(values: Vec<String>) -> Result<String> {
    let mut d = Document::new(b"[]")?;
    let mut nodes = Vec::new();
    for value in values {
        let i = d.parse(value.as_bytes())?;
        push(&mut nodes, i)?;
    }
    d.nodes[d.root] = Node::Array(nodes);
    d.render(d.root)
}
#[derive(Clone, Debug)]
pub enum EditKind {
    Set,
    Remove,
}
#[derive(Clone, Debug)]
pub struct Edit {
    pub kind: EditKind,
    pub path: String,
    pub value_json: String,
}
pub fn edit(input: &[u8], edits: Vec<Edit>) -> Result<String> {
    let mut d = Document::new(input)?;
    for edit in edits {
        let mut path = pointer(&edit.path)?;
        if path.is_empty() {
            if matches!(edit.kind, EditKind::Remove) {
                return Err(Error::InvalidOperation);
            }
            let next = d.parse(edit.value_json.as_bytes())?;
            let old = std::mem::replace(&mut d.root, next);
            d.retire(old)?;
            continue;
        }
        let key = path.pop().unwrap();
        let parent = d.get(&path)?.ok_or(Error::MissingTarget)?;
        let next = if matches!(edit.kind, EditKind::Set) {
            Some(d.parse(edit.value_json.as_bytes())?)
        } else {
            None
        };
        let old = match &mut d.nodes[parent] {
            Node::Object(v) => {
                if let Some(next) = next {
                    v.insert(key, next)
                } else {
                    Some(v.remove(&key).ok_or(Error::MissingTarget)?)
                }
            }
            Node::Array(v) => {
                if key == "-" {
                    if let Some(next) = next {
                        push(v, next)?;
                        None
                    } else {
                        return Err(Error::InvalidIndex);
                    }
                } else {
                    let i = array_index(&key)?;
                    if i >= v.len() {
                        return Err(Error::MissingTarget);
                    }
                    if let Some(next) = next {
                        Some(std::mem::replace(&mut v[i], next))
                    } else {
                        Some(v.remove(i))
                    }
                }
            }
            _ => return Err(Error::TypeMismatch),
        };
        if let Some(old) = old {
            d.retire(old)?;
        }
    }
    d.render(d.root)
}
fn selected(input: &[u8], path: &str) -> Result<(Document, Option<usize>)> {
    let p = pointer(path)?;
    let d = Document::new(input)?;
    let i = d.get(&p)?;
    Ok((d, i))
}
pub fn read_u64(input: &[u8], path: &str) -> Result<Option<u64>> {
    let (d, i) = selected(input, path)?;
    match i.map(|i| &d.nodes[i]) {
        None => Ok(None),
        Some(Node::Number(v)) => v.as_u64().map(Some).ok_or(Error::OutOfRange),
        _ => Err(Error::TypeMismatch),
    }
}
pub fn read_i64(input: &[u8], path: &str) -> Result<Option<i64>> {
    let (d, i) = selected(input, path)?;
    match i.map(|i| &d.nodes[i]) {
        None => Ok(None),
        Some(Node::Number(v)) => v.as_i64().map(Some).ok_or(Error::OutOfRange),
        _ => Err(Error::TypeMismatch),
    }
}
pub fn read_f64(input: &[u8], path: &str) -> Result<Option<f64>> {
    let (d, i) = selected(input, path)?;
    match i.map(|i| &d.nodes[i]) {
        None => Ok(None),
        Some(Node::Number(v)) => v.as_f64().map(Some).ok_or(Error::OutOfRange),
        _ => Err(Error::TypeMismatch),
    }
}
pub fn read_bool(input: &[u8], path: &str) -> Result<Option<bool>> {
    let (d, i) = selected(input, path)?;
    match i.map(|i| &d.nodes[i]) {
        None => Ok(None),
        Some(Node::Bool(v)) => Ok(Some(*v)),
        _ => Err(Error::TypeMismatch),
    }
}

/// Preserve the caller's explicit fallback when any field is not valid JSON.
pub fn object_or(fields: Vec<(String, String)>, fallback: String) -> String {
    object(fields).unwrap_or(fallback)
}
/// Preserve the caller's explicit fallback when any value is not valid JSON.
pub fn array_or(values: Vec<String>, fallback: String) -> String {
    array(values).unwrap_or(fallback)
}

#[cfg(test)]
mod tests {
    #[test]
    fn constructor_fallbacks_preserve_values_and_errors() {
        use super::*;
        let values = vec!["123".to_owned(); 300];
        assert_eq!(array_or(values, "fallback".into()), format!("[{}]", vec!["123"; 300].join(",")));
        assert_eq!(array_or(vec!["not-json".into()], "雪 fallback".into()), "雪 fallback");
        let fields = vec![("x".into(), "1".into()), ("name".into(), "\"雪\"".into()), ("x".into(), "2".into())];
        assert_eq!(object_or(fields, "fallback".into()), "{\"name\":\"雪\",\"x\":2}");
        assert_eq!(object_or(vec![("bad".into(), "not-json".into())], "fallback".into()), "fallback");
    }

    use super::*;
    #[test]
    fn rust_oracle_and_complete_input() {
        for input in [
            "null",
            "true",
            "18446744073709551615",
            "-9223372036854775808",
            "1.25e2",
            r#"{"z":1,"a":"雪\u0000🦀","z":2,"b":[null,{"x":false}]}"#,
        ] {
            let v: Value = serde_json::from_str(input).unwrap();
            assert_eq!(
                compact(input.as_bytes()).unwrap(),
                serde_json::to_string(&v).unwrap()
            );
        }
        for input in ["", "null null", "[1,]", "{", "1e400"] {
            assert_eq!(validate(input.as_bytes()), Err(Error::InvalidJson));
        }
    }
    #[test]
    fn no_document_or_output_byte_ceiling() {
        for n in [65_536, 65_537, 131_072, 2_097_152] {
            let input = quote(&"雪".repeat(n / 3));
            assert_eq!(compact(input.as_bytes()).unwrap(), input);
        }
    }
    #[test]
    fn no_pointer_count_length_or_sum_output_ceiling() {
        let key = "x".repeat(4096);
        let input = object(vec![(key.clone(), quote(&"v".repeat(1024)))]).unwrap();
        let values = select(input.as_bytes(), &vec![format!("/{key}"); 512]).unwrap();
        assert_eq!(values.len(), 512);
        assert!(values.iter().all(|v| v.as_ref().unwrap().len() == 1026));
    }
    #[test]
    fn no_recursive_depth_or_drop_ceiling() {
        let input = format!("{}0{}", "[".repeat(5000), "]".repeat(5000));
        assert_eq!(compact(input.as_bytes()).unwrap(), input);
        assert_eq!(
            select(input.as_bytes(), &["/0".repeat(5000)]).unwrap(),
            vec![Some("0".into())]
        );
    }
    #[test]
    fn missing_null_type_and_exact_integer_width() {
        let input =
            br#"{"x":null,"u":18446744073709551615,"i":-9223372036854775808,"f":1.25,"b":true}"#;
        assert_eq!(read_u64(input, "/u"), Ok(Some(u64::MAX)));
        assert_eq!(read_i64(input, "/i"), Ok(Some(i64::MIN)));
        assert_eq!(read_i64(input, "/u"), Err(Error::OutOfRange));
        assert_eq!(read_u64(input, "/missing"), Ok(None));
        assert_eq!(read_u64(input, "/x"), Err(Error::TypeMismatch));
        assert_eq!(read_bool(input, "/b"), Ok(Some(true)));
        assert_eq!(read_f64(input, "/f"), Ok(Some(1.25)));
        assert_eq!(
            select(input, &["/x".into(), "/missing".into()]).unwrap(),
            vec![Some("null".into()), None]
        );
    }
    #[test]
    fn build_and_atomic_batch_edits() {
        let input = object(vec![(
            "a/b".into(),
            array(vec!["1".into(), "2".into()]).unwrap(),
        )])
        .unwrap();
        let edits = vec![
            Edit {
                kind: EditKind::Set,
                path: "/a~1b/1".into(),
                value_json: quote("雪"),
            },
            Edit {
                kind: EditKind::Set,
                path: "/a~1b/-".into(),
                value_json: "null".into(),
            },
            Edit {
                kind: EditKind::Remove,
                path: "/a~1b/0".into(),
                value_json: String::new(),
            },
        ];
        assert_eq!(
            edit(input.as_bytes(), edits.clone()).unwrap(),
            r#"{"a/b":["雪",null]}"#
        );
        let mut bad = edits;
        bad.push(Edit {
            kind: EditKind::Remove,
            path: "/absent".into(),
            value_json: String::new(),
        });
        assert_eq!(edit(input.as_bytes(), bad), Err(Error::MissingTarget));
        assert_eq!(compact(input.as_bytes()).unwrap(), input);
        assert_eq!(validate(br#"{"recovery":true}"#), Ok(()));
    }
    #[test]
    fn repeated_replacement_reuses_arena_slots() {
        let mut edits = Vec::new();
        for i in 0..10000 {
            edits.push(Edit {
                kind: EditKind::Set,
                path: "/x".into(),
                value_json: i.to_string(),
            });
        }
        assert_eq!(edit(br#"{"x":0}"#, edits).unwrap(), r#"{"x":9999}"#);
    }
    #[test]
    fn pointer_and_container_correctness_is_not_a_capacity_limit() {
        assert_eq!(select(b"{}", &["/~2".into()]), Err(Error::InvalidPointer));
        assert_eq!(select(b"[1]", &["/00".into()]).unwrap(), vec![None]);
        assert_eq!(
            edit(
                b"[]",
                vec![Edit {
                    kind: EditKind::Set,
                    path: "/0".into(),
                    value_json: "1".into()
                }]
            ),
            Err(Error::MissingTarget)
        );
    }
}
