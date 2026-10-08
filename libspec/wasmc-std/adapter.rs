use crate::delta;
use crate::exports::wasmc::std::{
    base64::Guest as Base64Guest,
    bytes::{ByteBuffer, ByteBufferBorrow, Guest as BytesGuest, GuestByteBuffer},
    hex::Guest as HexGuest,
    integer_text::Guest as IntegerTextGuest,
    iterator::{Guest as IteratorGuest, GuestS32Iterator, S32Iterator, S32IteratorBorrow},
    list::{
        Guest as ListGuest, GuestS32List, GuestStringList, S32List, S32ListBorrow, StringList,
        StringListBorrow,
    },
    map::{Guest as MapGuest, GuestS32Map, S32Map, S32MapBorrow},
    string::{Guest as StringGuest, GuestText, Text, TextBorrow},
    structured_collection::{
        Guest as StructuredCollectionGuest, GuestReadingList, ReadingList, ReadingListBorrow,
    },
    structured_data::Guest as StructuredDataGuest,
    structured_map::{Guest as StructuredMapGuest, GuestReadingMap, ReadingMap, ReadingMapBorrow},
    structured_text::{Guest as StructuredTextGuest, GuestReading, Reading, ReadingBorrow},
    sum::Guest as SumGuest,
};

pub struct Adapter;
impl GuestText for delta::Text {}
impl GuestStringList for delta::StringList {}
impl GuestS32List for delta::S32List {}
impl GuestS32Map for delta::S32Map {}
impl GuestS32Iterator for delta::S32Iterator {}
impl GuestByteBuffer for delta::ByteBuffer {}
impl GuestReading for delta::Reading {}
impl GuestReadingList for delta::ReadingList {}
impl GuestReadingMap for delta::ReadingMap {}

impl StringGuest for Adapter {
    type Text = delta::Text;
    fn new() -> Text {
        Text::new(delta::Text::new())
    }
    fn len(value: TextBorrow<'_>) -> u32 {
        value.get::<delta::Text>().len()
    }
    fn is_empty(value: TextBorrow<'_>) -> bool {
        value.get::<delta::Text>().is_empty()
    }
    fn contains(value: TextBorrow<'_>, needle: TextBorrow<'_>) -> bool {
        value
            .get::<delta::Text>()
            .contains(needle.get::<delta::Text>())
    }
    fn starts_with(value: TextBorrow<'_>, prefix: TextBorrow<'_>) -> bool {
        value
            .get::<delta::Text>()
            .starts_with(prefix.get::<delta::Text>())
    }
    fn ends_with(value: TextBorrow<'_>, suffix: TextBorrow<'_>) -> bool {
        value
            .get::<delta::Text>()
            .ends_with(suffix.get::<delta::Text>())
    }
    fn push_str(value: TextBorrow<'_>, suffix: TextBorrow<'_>) {
        value
            .get::<delta::Text>()
            .push_str(suffix.get::<delta::Text>());
    }
    fn clear(value: TextBorrow<'_>) {
        value.get::<delta::Text>().clear();
    }
}
impl ListGuest for Adapter {
    type StringList = delta::StringList;
    type S32List = delta::S32List;
    fn new() -> StringList {
        StringList::new(delta::StringList::new())
    }
    fn len(value: StringListBorrow<'_>) -> u32 {
        value.get::<delta::StringList>().len()
    }
    fn is_empty(value: StringListBorrow<'_>) -> bool {
        value.get::<delta::StringList>().is_empty()
    }
    fn push(value: StringListBorrow<'_>, item: Text) {
        value
            .get::<delta::StringList>()
            .push(item.get::<delta::Text>());
    }
    fn pop(value: StringListBorrow<'_>) -> Option<Text> {
        value.get::<delta::StringList>().pop().map(Text::new)
    }
    fn get(value: StringListBorrow<'_>, index: u32) -> Option<Text> {
        value.get::<delta::StringList>().get(index).map(Text::new)
    }
    fn reverse(value: StringListBorrow<'_>) {
        value.get::<delta::StringList>().reverse();
    }
    fn clear(value: StringListBorrow<'_>) {
        value.get::<delta::StringList>().clear();
    }
    fn new_s32() -> S32List {
        S32List::new(delta::S32List::new())
    }
    fn len_s32(value: S32ListBorrow<'_>) -> u32 {
        value.get::<delta::S32List>().len()
    }
    fn get_s32(value: S32ListBorrow<'_>, index: u32) -> Option<i32> {
        value.get::<delta::S32List>().get(index)
    }
    fn push_s32(value: S32ListBorrow<'_>, item: i32) {
        value.get::<delta::S32List>().push(item);
    }
}
impl MapGuest for Adapter {
    type S32Map = delta::S32Map;
    fn new() -> S32Map {
        S32Map::new(delta::S32Map::new())
    }
    fn len(value: S32MapBorrow<'_>) -> u32 {
        value.get::<delta::S32Map>().len()
    }
    fn is_empty(value: S32MapBorrow<'_>) -> bool {
        value.get::<delta::S32Map>().is_empty()
    }
    fn contains_key(value: S32MapBorrow<'_>, key: i32) -> bool {
        value.get::<delta::S32Map>().contains_key(key)
    }
    fn get(value: S32MapBorrow<'_>, key: i32) -> Option<i32> {
        value.get::<delta::S32Map>().get(key)
    }
    fn insert(value: S32MapBorrow<'_>, key: i32, item: i32) -> Option<i32> {
        value.get::<delta::S32Map>().insert(key, item)
    }
    fn remove(value: S32MapBorrow<'_>, key: i32) -> Option<i32> {
        value.get::<delta::S32Map>().remove(key)
    }
    fn clear(value: S32MapBorrow<'_>) {
        value.get::<delta::S32Map>().clear();
    }
}
impl SumGuest for Adapter {
    fn option_is_none(value: Option<i32>) -> bool {
        delta::option_is_none(value)
    }
    fn option_is_some(value: Option<i32>) -> bool {
        delta::option_is_some(value)
    }
    fn option_unwrap_or(value: Option<i32>, fallback: i32) -> i32 {
        delta::option_unwrap_or(value, fallback)
    }
    fn result_is_err(value: Result<i32, i32>) -> bool {
        delta::result_is_err(value)
    }
    fn result_is_ok(value: Result<i32, i32>) -> bool {
        delta::result_is_ok(value)
    }
    fn result_unwrap_or(value: Result<i32, i32>, fallback: i32) -> i32 {
        delta::result_unwrap_or(value, fallback)
    }
}
impl IteratorGuest for Adapter {
    type S32Iterator = delta::S32Iterator;
    fn into_iter_s32(value: S32List) -> S32Iterator {
        S32Iterator::new(value.get::<delta::S32List>().into_iterator())
    }
    fn next_s32(value: S32IteratorBorrow<'_>) -> Option<i32> {
        value.get::<delta::S32Iterator>().next()
    }
    fn count_s32(value: S32Iterator) -> u32 {
        value.get::<delta::S32Iterator>().count()
    }
    fn fold_add_s32(value: S32Iterator, initial: i32) -> i32 {
        value.get::<delta::S32Iterator>().fold_add(initial)
    }
}
impl BytesGuest for Adapter {
    type ByteBuffer = delta::ByteBuffer;
    fn new() -> ByteBuffer {
        ByteBuffer::new(delta::ByteBuffer::new())
    }
    fn len(value: ByteBufferBorrow<'_>) -> u32 {
        value.get::<delta::ByteBuffer>().len()
    }
    fn push(value: ByteBufferBorrow<'_>, item: u8) {
        value.get::<delta::ByteBuffer>().push(item);
    }
    fn byte_at(value: ByteBufferBorrow<'_>, index: u32) -> Option<u8> {
        value.get::<delta::ByteBuffer>().byte_at(index)
    }
    fn clear(value: ByteBufferBorrow<'_>) {
        value.get::<delta::ByteBuffer>().clear();
    }
    fn set(value: ByteBufferBorrow<'_>, index: u32, item: u8) -> bool {
        value.get::<delta::ByteBuffer>().set(index, item)
    }
    fn contains(value: ByteBufferBorrow<'_>, needle: ByteBufferBorrow<'_>) -> bool {
        value
            .get::<delta::ByteBuffer>()
            .contains(needle.get::<delta::ByteBuffer>())
    }
    fn count_byte(value: ByteBufferBorrow<'_>, item: u8) -> u32 {
        value.get::<delta::ByteBuffer>().count_byte(item)
    }
    fn eq(left: ByteBufferBorrow<'_>, right: ByteBufferBorrow<'_>) -> bool {
        left.get::<delta::ByteBuffer>()
            .eq(right.get::<delta::ByteBuffer>())
    }
}
impl Base64Guest for Adapter {
    fn try_encode_standard(value: ByteBufferBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        delta::encode_base64(
            value.get::<delta::ByteBuffer>(),
            output.get::<delta::ByteBuffer>(),
        )
    }
    fn try_decode_standard(value: ByteBufferBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        delta::decode_base64(
            value.get::<delta::ByteBuffer>(),
            output.get::<delta::ByteBuffer>(),
        )
    }
}
impl HexGuest for Adapter {
    fn try_encode_lower(value: ByteBufferBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        delta::encode_hex(
            value.get::<delta::ByteBuffer>(),
            output.get::<delta::ByteBuffer>(),
        )
    }
    fn try_decode(value: ByteBufferBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        delta::decode_hex(
            value.get::<delta::ByteBuffer>(),
            output.get::<delta::ByteBuffer>(),
        )
    }
}
impl IntegerTextGuest for Adapter {
    fn parse_s32(value: ByteBufferBorrow<'_>) -> Option<i32> {
        delta::parse_s32(value.get::<delta::ByteBuffer>())
    }
    fn try_format_s32(value: i32, output: ByteBufferBorrow<'_>) -> bool {
        delta::format_s32(value, output.get::<delta::ByteBuffer>())
    }
}
impl StructuredDataGuest for Adapter {
    fn is_reading(input: ByteBufferBorrow<'_>) -> bool {
        delta::is_reading(input.get::<delta::ByteBuffer>())
    }
    fn try_write_reading(id: i32, value: i32, active: bool, output: ByteBufferBorrow<'_>) -> bool {
        delta::write_reading(id, value, active, output.get::<delta::ByteBuffer>())
    }
}
impl StructuredTextGuest for Adapter {
    type Reading = delta::Reading;
    fn from_utf8(input: ByteBufferBorrow<'_>) -> Option<Text> {
        delta::from_utf8(input.get::<delta::ByteBuffer>()).map(Text::new)
    }
    fn parse_reading(input: ByteBufferBorrow<'_>) -> Option<Reading> {
        delta::Reading::parse(input.get::<delta::ByteBuffer>()).map(Reading::new)
    }
    fn label(value: ReadingBorrow<'_>) -> Text {
        Text::new(value.get::<delta::Reading>().label())
    }
    fn text_len(value: TextBorrow<'_>) -> u32 {
        value.get::<delta::Text>().len()
    }
    fn id(value: ReadingBorrow<'_>) -> i32 {
        value.get::<delta::Reading>().id()
    }
    fn value(value: ReadingBorrow<'_>) -> i32 {
        value.get::<delta::Reading>().value()
    }
    fn active(value: ReadingBorrow<'_>) -> bool {
        value.get::<delta::Reading>().active()
    }
    fn try_write_labeled_reading(value: ReadingBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        value
            .get::<delta::Reading>()
            .write(output.get::<delta::ByteBuffer>())
    }
}
impl StructuredCollectionGuest for Adapter {
    type ReadingList = delta::ReadingList;
    fn parse_readings(input: ByteBufferBorrow<'_>) -> Option<ReadingList> {
        delta::ReadingList::parse(input.get::<delta::ByteBuffer>()).map(ReadingList::new)
    }
    fn len(value: ReadingListBorrow<'_>) -> u32 {
        value.get::<delta::ReadingList>().len()
    }
    fn get(value: ReadingListBorrow<'_>, index: u32) -> Option<Reading> {
        value
            .get::<delta::ReadingList>()
            .get(index)
            .map(Reading::new)
    }
    fn try_write_readings(value: ReadingListBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        value
            .get::<delta::ReadingList>()
            .write(output.get::<delta::ByteBuffer>())
    }
}
impl StructuredMapGuest for Adapter {
    type ReadingMap = delta::ReadingMap;
    fn parse_map(input: ByteBufferBorrow<'_>) -> Option<ReadingMap> {
        delta::ReadingMap::parse(input.get::<delta::ByteBuffer>()).map(ReadingMap::new)
    }
    fn len(value: ReadingMapBorrow<'_>) -> u32 {
        value.get::<delta::ReadingMap>().len()
    }
    fn contains_key(value: ReadingMapBorrow<'_>, key: TextBorrow<'_>) -> bool {
        value
            .get::<delta::ReadingMap>()
            .contains_key(key.get::<delta::Text>())
    }
    fn get(value: ReadingMapBorrow<'_>, key: TextBorrow<'_>) -> Option<Reading> {
        value
            .get::<delta::ReadingMap>()
            .get(key.get::<delta::Text>())
            .map(Reading::new)
    }
    fn insert(value: ReadingMapBorrow<'_>, key: Text, item: Reading) -> Option<Reading> {
        value
            .get::<delta::ReadingMap>()
            .insert(key.get::<delta::Text>(), item.get::<delta::Reading>())
            .map(Reading::new)
    }
    fn try_write_map(value: ReadingMapBorrow<'_>, output: ByteBufferBorrow<'_>) -> bool {
        value
            .get::<delta::ReadingMap>()
            .write(output.get::<delta::ByteBuffer>())
    }
}
