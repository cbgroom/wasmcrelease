use base64::{engine::general_purpose::STANDARD, Engine as _};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

// Match the qualified resource implementation's explicit bounds.
const MAX_BYTES: usize = 128;
const MAX_LABEL: usize = 48;
const MAX_RECORDS: usize = 4;
const MAX_KEY: usize = 24;

#[derive(Default)]
pub struct Text(RefCell<String>);
impl Text {
    pub fn new() -> Self {
        Self::default()
    }
    fn from_string(value: String) -> Self {
        Self(RefCell::new(value))
    }
    pub fn len(&self) -> u32 {
        self.0.borrow().len() as u32
    }
    pub fn is_empty(&self) -> bool {
        self.0.borrow().is_empty()
    }
    pub fn contains(&self, needle: &Self) -> bool {
        self.0.borrow().contains(&*needle.0.borrow())
    }
    pub fn starts_with(&self, prefix: &Self) -> bool {
        self.0.borrow().starts_with(&*prefix.0.borrow())
    }
    pub fn ends_with(&self, suffix: &Self) -> bool {
        self.0.borrow().ends_with(&*suffix.0.borrow())
    }
    pub fn push_str(&self, suffix: &Self) {
        let suffix = suffix.0.borrow().clone();
        self.0.borrow_mut().push_str(&suffix);
    }
    pub fn clear(&self) {
        self.0.borrow_mut().clear();
    }
}

#[derive(Default)]
pub struct StringList(RefCell<Vec<String>>);
impl StringList {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn len(&self) -> u32 {
        self.0.borrow().len() as u32
    }
    pub fn is_empty(&self) -> bool {
        self.0.borrow().is_empty()
    }
    pub fn push(&self, item: &Text) {
        self.0.borrow_mut().push(item.0.borrow().clone());
    }
    pub fn pop(&self) -> Option<Text> {
        self.0.borrow_mut().pop().map(Text::from_string)
    }
    pub fn get(&self, index: u32) -> Option<Text> {
        self.0
            .borrow()
            .get(index as usize)
            .cloned()
            .map(Text::from_string)
    }
    pub fn reverse(&self) {
        self.0.borrow_mut().reverse();
    }
    pub fn clear(&self) {
        self.0.borrow_mut().clear();
    }
}

#[derive(Default)]
pub struct S32List(RefCell<Vec<i32>>);
impl S32List {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn push(&self, item: i32) {
        self.0.borrow_mut().push(item);
    }
    pub fn len(&self) -> u32 {
        self.0.borrow().len() as u32
    }
    pub fn get(&self, index: u32) -> Option<i32> {
        self.0.borrow().get(index as usize).copied()
    }
    pub fn into_iterator(&self) -> S32Iterator {
        S32Iterator(RefCell::new(
            core::mem::take(&mut *self.0.borrow_mut()).into_iter(),
        ))
    }
}

#[derive(Default)]
pub struct S32Map(RefCell<IndexMap<i32, i32>>);
impl S32Map {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn len(&self) -> u32 {
        self.0.borrow().len() as u32
    }
    pub fn is_empty(&self) -> bool {
        self.0.borrow().is_empty()
    }
    pub fn contains_key(&self, key: i32) -> bool {
        self.0.borrow().contains_key(&key)
    }
    pub fn get(&self, key: i32) -> Option<i32> {
        self.0.borrow().get(&key).copied()
    }
    pub fn insert(&self, key: i32, item: i32) -> Option<i32> {
        self.0.borrow_mut().insert(key, item)
    }
    pub fn remove(&self, key: i32) -> Option<i32> {
        self.0.borrow_mut().shift_remove(&key)
    }
    pub fn clear(&self) {
        self.0.borrow_mut().clear();
    }
}

pub struct S32Iterator(RefCell<std::vec::IntoIter<i32>>);
impl S32Iterator {
    pub fn next(&self) -> Option<i32> {
        self.0.borrow_mut().next()
    }
    pub fn count(&self) -> u32 {
        self.0.borrow_mut().by_ref().count() as u32
    }
    pub fn fold_add(&self, initial: i32) -> i32 {
        self.0
            .borrow_mut()
            .by_ref()
            .fold(initial, i32::wrapping_add)
    }
}

#[derive(Default)]
pub struct ByteBuffer(RefCell<Vec<u8>>);
impl ByteBuffer {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn len(&self) -> u32 {
        self.0.borrow().len() as u32
    }
    pub fn push(&self, item: u8) {
        let mut value = self.0.borrow_mut();
        assert!(
            value.len() < MAX_BYTES,
            "CoreLib byte-buffer capacity exceeded"
        );
        value.push(item);
    }
    pub fn byte_at(&self, index: u32) -> Option<u8> {
        self.0.borrow().get(index as usize).copied()
    }
    pub fn clear(&self) {
        self.0.borrow_mut().clear();
    }
    pub fn set(&self, index: u32, item: u8) -> bool {
        match self.0.borrow_mut().get_mut(index as usize) {
            Some(value) => {
                *value = item;
                true
            }
            None => false,
        }
    }
    pub fn contains(&self, needle: &Self) -> bool {
        let value = self.0.borrow();
        let needle = needle.0.borrow();
        needle.is_empty()
            || value
                .windows(needle.len())
                .any(|window| window == needle.as_slice())
    }
    pub fn count_byte(&self, item: u8) -> u32 {
        self.0.borrow().iter().filter(|v| **v == item).count() as u32
    }
    pub fn eq(&self, right: &Self) -> bool {
        *self.0.borrow() == *right.0.borrow()
    }
    fn replace(&self, value: Vec<u8>) -> bool {
        if value.len() > MAX_BYTES {
            return false;
        }
        *self.0.borrow_mut() = value;
        true
    }
}

pub fn encode_base64(value: &ByteBuffer, output: &ByteBuffer) -> bool {
    let encoded = STANDARD.encode(value.0.borrow().as_slice());
    output.replace(encoded.into_bytes())
}
pub fn decode_base64(value: &ByteBuffer, output: &ByteBuffer) -> bool {
    let Ok(decoded) = STANDARD.decode(value.0.borrow().as_slice()) else {
        return false;
    };
    output.replace(decoded)
}
pub fn encode_hex(value: &ByteBuffer, output: &ByteBuffer) -> bool {
    let encoded = hex::encode(value.0.borrow().as_slice());
    output.replace(encoded.into_bytes())
}
pub fn decode_hex(value: &ByteBuffer, output: &ByteBuffer) -> bool {
    let Ok(decoded) = hex::decode(value.0.borrow().as_slice()) else {
        return false;
    };
    output.replace(decoded)
}
pub fn parse_s32(value: &ByteBuffer) -> Option<i32> {
    std::str::from_utf8(value.0.borrow().as_slice())
        .ok()?
        .parse()
        .ok()
}
pub fn format_s32(value: i32, output: &ByteBuffer) -> bool {
    output.replace(value.to_string().into_bytes())
}

pub fn option_is_none(value: Option<i32>) -> bool {
    value.is_none()
}
pub fn option_is_some(value: Option<i32>) -> bool {
    value.is_some()
}
pub fn option_unwrap_or(value: Option<i32>, fallback: i32) -> i32 {
    value.unwrap_or(fallback)
}
pub fn result_is_err(value: Result<i32, i32>) -> bool {
    value.is_err()
}
pub fn result_is_ok(value: Result<i32, i32>) -> bool {
    value.is_ok()
}
pub fn result_unwrap_or(value: Result<i32, i32>, fallback: i32) -> i32 {
    value.unwrap_or(fallback)
}

#[derive(Deserialize, Serialize)]
struct PlainReading {
    id: i32,
    value: i32,
    active: bool,
}
#[derive(Clone, Deserialize, Serialize)]
struct LabeledReading {
    label: String,
    id: i32,
    value: i32,
    active: bool,
}

pub fn is_reading(input: &ByteBuffer) -> bool {
    serde_json::from_slice::<PlainReading>(input.0.borrow().as_slice()).is_ok()
}
pub fn write_reading(id: i32, value: i32, active: bool, output: &ByteBuffer) -> bool {
    let Ok(encoded) = serde_json::to_vec(&PlainReading { id, value, active }) else {
        return false;
    };
    output.replace(encoded)
}
pub fn from_utf8(input: &ByteBuffer) -> Option<Text> {
    let bytes = input.0.borrow();
    if bytes.len() > MAX_LABEL {
        return None;
    }
    Some(Text::from_string(
        std::str::from_utf8(&bytes).ok()?.to_owned(),
    ))
}

pub struct Reading(LabeledReading);
impl Reading {
    pub fn parse(input: &ByteBuffer) -> Option<Self> {
        let value: LabeledReading = serde_json::from_slice(input.0.borrow().as_slice()).ok()?;
        if value.label.len() > MAX_LABEL {
            return None;
        }
        Some(Self(value))
    }
    pub fn label(&self) -> Text {
        Text::from_string(self.0.label.clone())
    }
    pub fn id(&self) -> i32 {
        self.0.id
    }
    pub fn value(&self) -> i32 {
        self.0.value
    }
    pub fn active(&self) -> bool {
        self.0.active
    }
    pub fn write(&self, output: &ByteBuffer) -> bool {
        let Ok(encoded) = serde_json::to_vec(&self.0) else {
            return false;
        };
        output.replace(encoded)
    }
}

pub struct ReadingList(Vec<LabeledReading>);
impl ReadingList {
    pub fn parse(input: &ByteBuffer) -> Option<Self> {
        let values: Vec<LabeledReading> =
            serde_json::from_slice(input.0.borrow().as_slice()).ok()?;
        if values.len() > MAX_RECORDS || values.iter().any(|v| v.label.len() > MAX_LABEL) {
            return None;
        }
        Some(Self(values))
    }
    pub fn len(&self) -> u32 {
        self.0.len() as u32
    }
    pub fn get(&self, index: u32) -> Option<Reading> {
        self.0.get(index as usize).cloned().map(Reading)
    }
    pub fn write(&self, output: &ByteBuffer) -> bool {
        let Ok(encoded) = serde_json::to_vec(&self.0) else {
            return false;
        };
        output.replace(encoded)
    }
}

pub struct ReadingMap(RefCell<IndexMap<String, LabeledReading>>);
impl ReadingMap {
    pub fn parse(input: &ByteBuffer) -> Option<Self> {
        let values: IndexMap<String, LabeledReading> =
            serde_json::from_slice(input.0.borrow().as_slice()).ok()?;
        if values.len() > MAX_RECORDS
            || values
                .iter()
                .any(|(k, v)| k.len() > MAX_KEY || v.label.len() > MAX_LABEL)
        {
            return None;
        }
        Some(Self(RefCell::new(values)))
    }
    pub fn len(&self) -> u32 {
        self.0.borrow().len() as u32
    }
    pub fn contains_key(&self, key: &Text) -> bool {
        self.0.borrow().contains_key(&*key.0.borrow())
    }
    pub fn get(&self, key: &Text) -> Option<Reading> {
        self.0.borrow().get(&*key.0.borrow()).cloned().map(Reading)
    }
    pub fn insert(&self, key: &Text, item: &Reading) -> Option<Reading> {
        let key = key.0.borrow().clone();
        let mut values = self.0.borrow_mut();
        assert!(
            values.contains_key(&key) || values.len() < MAX_RECORDS,
            "CoreLib reading-map capacity exceeded"
        );
        values.insert(key, item.0.clone()).map(Reading)
    }
    pub fn write(&self, output: &ByteBuffer) -> bool {
        let Ok(encoded) = serde_json::to_vec(&*self.0.borrow()) else {
            return false;
        };
        output.replace(encoded)
    }
}
