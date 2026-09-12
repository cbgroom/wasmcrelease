#![no_std]

// Generated from exact digest-bound WIT, Core Wasm, and typed-resource plan bytes.
pub const LIB_PACKAGE: &str = "wasmc-std";
pub const LIB_VERSION: &str = "1.4.0";
pub const LIB_WIT_SHA256: &str = "d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d";
pub const LIB_ARTIFACT_SHA256: &str = "f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7";
pub const LIB_TYPED_RESOURCE_PLAN_SHA256: &str = "b83e1db2a815ea1ce7618ca402dd0bcf9aba1301270393b7452036531afe5664";
pub const LIB_IMPORT_MODULE: &str = "wasmc:lib/wasmc.std@1.4.0";

#[link(wasm_import_module = "wasmc:lib/wasmc.std@1.4.0")]
unsafe extern "C" {
    #[link_name = "std_string_new"]
    fn __wasmc_resource_1() -> i64;
    #[link_name = "std_string_len"]
    fn __wasmc_resource_2(p0: i64) -> i64;
    #[link_name = "std_string_is_empty"]
    fn __wasmc_resource_3(p0: i64) -> i64;
    #[link_name = "std_string_contains"]
    fn __wasmc_resource_4(p0: i64, p1: i64) -> i64;
    #[link_name = "std_string_starts_with"]
    fn __wasmc_resource_5(p0: i64, p1: i64) -> i64;
    #[link_name = "std_string_push_str"]
    fn __wasmc_resource_6(p0: i64, p1: i64) -> i32;
    #[link_name = "std_string_clear"]
    fn __wasmc_resource_7(p0: i64) -> i32;
    #[link_name = "std_list_new"]
    fn __wasmc_resource_8() -> i64;
    #[link_name = "std_list_len"]
    fn __wasmc_resource_9(p0: i64) -> i64;
    #[link_name = "std_list_is_empty"]
    fn __wasmc_resource_10(p0: i64) -> i64;
    #[link_name = "std_list_push"]
    fn __wasmc_resource_11(p0: i64, p1: i64) -> i32;
    #[link_name = "std_list_pop"]
    fn __wasmc_resource_12(p0: i64) -> i64;
    #[link_name = "std_list_get"]
    fn __wasmc_resource_13(p0: i64, p1: i32) -> i64;
    #[link_name = "std_list_reverse"]
    fn __wasmc_resource_14(p0: i64) -> i32;
    #[link_name = "std_list_clear"]
    fn __wasmc_resource_15(p0: i64) -> i32;
    #[link_name = "std_map_new"]
    fn __wasmc_resource_16() -> i64;
    #[link_name = "std_map_len"]
    fn __wasmc_resource_17(p0: i64) -> i64;
    #[link_name = "std_map_is_empty"]
    fn __wasmc_resource_18(p0: i64) -> i64;
    #[link_name = "std_map_contains_key"]
    fn __wasmc_resource_19(p0: i64, p1: i32) -> i64;
    #[link_name = "std_map_get"]
    fn __wasmc_resource_20(p0: i64, p1: i32) -> i64;
    #[link_name = "std_map_insert"]
    fn __wasmc_resource_21(p0: i64, p1: i32, p2: i32) -> i64;
    #[link_name = "std_map_remove"]
    fn __wasmc_resource_22(p0: i64, p1: i32) -> i64;
    #[link_name = "std_map_clear"]
    fn __wasmc_resource_23(p0: i64) -> i32;
    #[link_name = "std_sum_option_is_none"]
    fn __wasmc_resource_24(p0: i32, p1: i32) -> i64;
    #[link_name = "std_sum_option_is_some"]
    fn __wasmc_resource_25(p0: i32, p1: i32) -> i64;
    #[link_name = "std_sum_option_unwrap_or"]
    fn __wasmc_resource_26(p0: i32, p1: i32, p2: i32) -> i64;
    #[link_name = "std_sum_result_is_err"]
    fn __wasmc_resource_27(p0: i32, p1: i32, p2: i32) -> i64;
    #[link_name = "std_sum_result_is_ok"]
    fn __wasmc_resource_28(p0: i32, p1: i32, p2: i32) -> i64;
    #[link_name = "std_sum_result_unwrap_or"]
    fn __wasmc_resource_29(p0: i32, p1: i32, p2: i32, p3: i32) -> i64;
    #[link_name = "std_iter_list_new"]
    fn __wasmc_resource_30() -> i64;
    #[link_name = "std_iter_list_push"]
    fn __wasmc_resource_31(p0: i64, p1: i32) -> i32;
    #[link_name = "std_iter_into_iter"]
    fn __wasmc_resource_32(p0: i64) -> i64;
    #[link_name = "std_iter_next"]
    fn __wasmc_resource_33(p0: i64) -> i64;
    #[link_name = "std_iter_count"]
    fn __wasmc_resource_34(p0: i64) -> i64;
    #[link_name = "std_iter_fold_add"]
    fn __wasmc_resource_35(p0: i64, p1: i32) -> i64;
    #[link_name = "std_bytes_new"]
    fn __wasmc_resource_36() -> i64;
    #[link_name = "std_bytes_len"]
    fn __wasmc_resource_37(p0: i64) -> i64;
    #[link_name = "std_bytes_push"]
    fn __wasmc_resource_38(p0: i64, p1: i32) -> i32;
    #[link_name = "std_bytes_eq"]
    fn __wasmc_resource_39(p0: i64, p1: i64) -> i64;
    #[link_name = "std_base64_try_encode_standard"]
    fn __wasmc_resource_40(p0: i64, p1: i64) -> i64;
    #[link_name = "std_base64_try_decode_standard"]
    fn __wasmc_resource_41(p0: i64, p1: i64) -> i64;
    #[link_name = "std_hex_try_encode_lower"]
    fn __wasmc_resource_42(p0: i64, p1: i64) -> i64;
    #[link_name = "std_hex_try_decode"]
    fn __wasmc_resource_43(p0: i64, p1: i64) -> i64;
    #[link_name = "std_integer_text_parse_s32"]
    fn __wasmc_resource_44(p0: i64) -> i64;
    #[link_name = "std_integer_text_try_format_s32"]
    fn __wasmc_resource_45(p0: i32, p1: i64) -> i64;
    #[link_name = "std_structured_data_is_reading"]
    fn __wasmc_resource_46(p0: i64) -> i64;
    #[link_name = "std_structured_data_try_write_reading"]
    fn __wasmc_resource_47(p0: i32, p1: i32, p2: i32, p3: i64) -> i64;
    #[link_name = "std_structured_text_from_utf8"]
    fn __wasmc_resource_48(p0: i64) -> i64;
    #[link_name = "std_structured_text_parse_reading"]
    fn __wasmc_resource_49(p0: i64) -> i64;
    #[link_name = "std_structured_text_label"]
    fn __wasmc_resource_50(p0: i64) -> i64;
    #[link_name = "std_structured_text_text_len"]
    fn __wasmc_resource_51(p0: i64) -> i64;
    #[link_name = "std_structured_text_id"]
    fn __wasmc_resource_52(p0: i64) -> i64;
    #[link_name = "std_structured_text_value"]
    fn __wasmc_resource_53(p0: i64) -> i64;
    #[link_name = "std_structured_text_active"]
    fn __wasmc_resource_54(p0: i64) -> i64;
    #[link_name = "std_structured_text_try_write_labeled_reading"]
    fn __wasmc_resource_55(p0: i64, p1: i64) -> i64;
    #[link_name = "std_structured_collection_parse_readings"]
    fn __wasmc_resource_56(p0: i64) -> i64;
    #[link_name = "std_structured_collection_len"]
    fn __wasmc_resource_57(p0: i64) -> i64;
    #[link_name = "std_structured_collection_get"]
    fn __wasmc_resource_58(p0: i64, p1: i32) -> i64;
    #[link_name = "std_structured_collection_try_write_readings"]
    fn __wasmc_resource_59(p0: i64, p1: i64) -> i64;
    #[link_name = "std_structured_map_parse_map"]
    fn __wasmc_resource_60(p0: i64) -> i64;
    #[link_name = "std_structured_map_len"]
    fn __wasmc_resource_61(p0: i64) -> i64;
    #[link_name = "std_structured_map_contains_key"]
    fn __wasmc_resource_62(p0: i64, p1: i64) -> i64;
    #[link_name = "std_structured_map_get"]
    fn __wasmc_resource_63(p0: i64, p1: i64) -> i64;
    #[link_name = "std_structured_map_insert"]
    fn __wasmc_resource_64(p0: i64, p1: i64, p2: i64) -> i64;
    #[link_name = "std_structured_map_try_write_map"]
    fn __wasmc_resource_65(p0: i64, p1: i64) -> i64;
    #[link_name = "std_bytes_byte_at"]
    fn __wasmc_resource_66(p0: i64, p1: i32) -> i64;
    #[link_name = "std_bytes_clear"]
    fn __wasmc_resource_67(p0: i64) -> i32;
    #[link_name = "std_bytes_set"]
    fn __wasmc_resource_68(p0: i64, p1: i32, p2: i32) -> i64;
    #[link_name = "std_bytes_contains"]
    fn __wasmc_resource_69(p0: i64, p1: i64) -> i64;
    #[link_name = "std_bytes_count_byte"]
    fn __wasmc_resource_70(p0: i64, p1: i32) -> i64;
    #[link_name = "std_string_ends_with"]
    fn __wasmc_resource_71(p0: i64, p1: i64) -> i64;
    #[link_name = "std_list_len_s32"]
    fn __wasmc_resource_72(p0: i64) -> i64;
    #[link_name = "std_list_get_s32"]
    fn __wasmc_resource_73(p0: i64, p1: i32) -> i64;
    #[link_name = "std_string_drop"]
    fn __wasmc_resource_74(p0: i64) -> i32;
    #[link_name = "std_list_drop"]
    fn __wasmc_resource_75(p0: i64) -> i32;
    #[link_name = "std_map_drop"]
    fn __wasmc_resource_76(p0: i64) -> i32;
    #[link_name = "std_iter_list_drop"]
    fn __wasmc_resource_77(p0: i64) -> i32;
    #[link_name = "std_iter_iterator_drop"]
    fn __wasmc_resource_78(p0: i64) -> i32;
    #[link_name = "std_bytes_drop"]
    fn __wasmc_resource_79(p0: i64) -> i32;
    #[link_name = "std_structured_text_reading_drop"]
    fn __wasmc_resource_80(p0: i64) -> i32;
    #[link_name = "std_structured_collection_reading_list_drop"]
    fn __wasmc_resource_81(p0: i64) -> i32;
    #[link_name = "std_structured_map_reading_map_drop"]
    fn __wasmc_resource_82(p0: i64) -> i32;
}

pub struct Text { reference: i64 }

impl Text {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for Text {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_74(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct StringList { reference: i64 }

impl StringList {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for StringList {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_75(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct S32Map { reference: i64 }

impl S32Map {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for S32Map {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_76(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct S32List { reference: i64 }

impl S32List {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for S32List {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_77(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct S32Iterator { reference: i64 }

impl S32Iterator {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for S32Iterator {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_78(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct ByteBuffer { reference: i64 }

impl ByteBuffer {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for ByteBuffer {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_79(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct Reading { reference: i64 }

impl Reading {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for Reading {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_80(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct ReadingList { reference: i64 }

impl ReadingList {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for ReadingList {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_81(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub struct ReadingMap { reference: i64 }

impl ReadingMap {
    #[inline]
    fn from_raw(reference: i64) -> Self {
        if reference >= 0 { core::arch::wasm32::unreachable() }
        Self { reference }
    }

#[inline]
    fn into_raw(self) -> i64 {
        let value = core::mem::ManuallyDrop::new(self);
        value.reference
    }
}

impl Drop for ReadingMap {
    #[inline]
    fn drop(&mut self) {
        if unsafe { __wasmc_resource_82(self.reference) } != 0 { core::arch::wasm32::unreachable() }
    }
}

pub mod string {
    use super::*;

    #[inline]
    pub fn new() -> Text { Text::from_raw(unsafe { __wasmc_resource_1() }) }

    #[inline]
    pub fn len(p0: &Text) -> u32 { let value = unsafe { __wasmc_resource_2(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn is_empty(p0: &Text) -> bool { match unsafe { __wasmc_resource_3(p0.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn contains(p0: &Text, p1: &Text) -> bool { match unsafe { __wasmc_resource_4(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn starts_with(p0: &Text, p1: &Text) -> bool { match unsafe { __wasmc_resource_5(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn push_str(p0: &Text, p1: &Text) -> () { if unsafe { __wasmc_resource_6(p0.reference, p1.reference) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn clear(p0: &Text) -> () { if unsafe { __wasmc_resource_7(p0.reference) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn ends_with(p0: &Text, p1: &Text) -> bool { match unsafe { __wasmc_resource_71(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod list {
    use super::*;

    #[inline]
    pub fn new() -> StringList { StringList::from_raw(unsafe { __wasmc_resource_8() }) }

    #[inline]
    pub fn len(p0: &StringList) -> u32 { let value = unsafe { __wasmc_resource_9(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn is_empty(p0: &StringList) -> bool { match unsafe { __wasmc_resource_10(p0.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn push(p0: &StringList, p1: Text) -> () { if unsafe { __wasmc_resource_11(p0.reference, p1.into_raw()) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn pop(p0: &StringList) -> Option<Text> { let value = unsafe { __wasmc_resource_12(p0.reference) }; if value == 0 { None } else { Some(Text::from_raw(value)) } }

    #[inline]
    pub fn get(p0: &StringList, p1: u32) -> Option<Text> { let value = unsafe { __wasmc_resource_13(p0.reference, p1 as i32) }; if value == 0 { None } else { Some(Text::from_raw(value)) } }

    #[inline]
    pub fn reverse(p0: &StringList) -> () { if unsafe { __wasmc_resource_14(p0.reference) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn clear(p0: &StringList) -> () { if unsafe { __wasmc_resource_15(p0.reference) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn new_s32() -> S32List { S32List::from_raw(unsafe { __wasmc_resource_30() }) }

    #[inline]
    pub fn push_s32(p0: &S32List, p1: i32) -> () { if unsafe { __wasmc_resource_31(p0.reference, p1) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn len_s32(p0: &S32List) -> u32 { let value = unsafe { __wasmc_resource_72(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn get_s32(p0: &S32List, p1: u32) -> Option<i32> { let envelope = unsafe { __wasmc_resource_73(p0.reference, p1 as i32) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 => Some(envelope as u32 as i32), _ => core::arch::wasm32::unreachable(), } }

}

pub mod map {
    use super::*;

    #[inline]
    pub fn new() -> S32Map { S32Map::from_raw(unsafe { __wasmc_resource_16() }) }

    #[inline]
    pub fn len(p0: &S32Map) -> u32 { let value = unsafe { __wasmc_resource_17(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn is_empty(p0: &S32Map) -> bool { match unsafe { __wasmc_resource_18(p0.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn contains_key(p0: &S32Map, p1: i32) -> bool { match unsafe { __wasmc_resource_19(p0.reference, p1) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn get(p0: &S32Map, p1: i32) -> Option<i32> { let envelope = unsafe { __wasmc_resource_20(p0.reference, p1) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 => Some(envelope as u32 as i32), _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn insert(p0: &S32Map, p1: i32, p2: i32) -> Option<i32> { let envelope = unsafe { __wasmc_resource_21(p0.reference, p1, p2) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 => Some(envelope as u32 as i32), _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn remove(p0: &S32Map, p1: i32) -> Option<i32> { let envelope = unsafe { __wasmc_resource_22(p0.reference, p1) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 => Some(envelope as u32 as i32), _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn clear(p0: &S32Map) -> () { if unsafe { __wasmc_resource_23(p0.reference) } != 0 { core::arch::wasm32::unreachable() } }

}

pub mod sum {
    use super::*;

    #[inline]
    pub fn option_is_none(p0: Option<i32>) -> bool { match unsafe { __wasmc_resource_24(match p0 { Some(value) => value, None => 0 }, i32::from(p0.is_some())) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn option_is_some(p0: Option<i32>) -> bool { match unsafe { __wasmc_resource_25(match p0 { Some(value) => value, None => 0 }, i32::from(p0.is_some())) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn option_unwrap_or(p0: Option<i32>, p1: i32) -> i32 { let value = unsafe { __wasmc_resource_26(match p0 { Some(value) => value, None => 0 }, i32::from(p0.is_some()), p1) }; if value != i64::from(value as i32) { core::arch::wasm32::unreachable() } value as i32 }

    #[inline]
    pub fn result_is_err(p0: Result<i32, i32>) -> bool { match unsafe { __wasmc_resource_27(match p0 { Ok(value) => value, Err(_) => 0 }, match p0 { Err(value) => value, Ok(_) => 0 }, match p0 { Ok(_) => 0, Err(_) => 1 }) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn result_is_ok(p0: Result<i32, i32>) -> bool { match unsafe { __wasmc_resource_28(match p0 { Ok(value) => value, Err(_) => 0 }, match p0 { Err(value) => value, Ok(_) => 0 }, match p0 { Ok(_) => 0, Err(_) => 1 }) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn result_unwrap_or(p0: Result<i32, i32>, p1: i32) -> i32 { let value = unsafe { __wasmc_resource_29(match p0 { Ok(value) => value, Err(_) => 0 }, match p0 { Err(value) => value, Ok(_) => 0 }, match p0 { Ok(_) => 0, Err(_) => 1 }, p1) }; if value != i64::from(value as i32) { core::arch::wasm32::unreachable() } value as i32 }

}

pub mod iterator {
    use super::*;

    #[inline]
    pub fn into_iter_s32(p0: S32List) -> S32Iterator { S32Iterator::from_raw(unsafe { __wasmc_resource_32(p0.into_raw()) }) }

    #[inline]
    pub fn next_s32(p0: &S32Iterator) -> Option<i32> { let envelope = unsafe { __wasmc_resource_33(p0.reference) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 => Some(envelope as u32 as i32), _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn count_s32(p0: S32Iterator) -> u32 { let value = unsafe { __wasmc_resource_34(p0.into_raw()) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn fold_add_s32(p0: S32Iterator, p1: i32) -> i32 { let value = unsafe { __wasmc_resource_35(p0.into_raw(), p1) }; if value != i64::from(value as i32) { core::arch::wasm32::unreachable() } value as i32 }

}

pub mod bytes {
    use super::*;

    #[inline]
    pub fn new() -> ByteBuffer { ByteBuffer::from_raw(unsafe { __wasmc_resource_36() }) }

    #[inline]
    pub fn len(p0: &ByteBuffer) -> u32 { let value = unsafe { __wasmc_resource_37(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn push(p0: &ByteBuffer, p1: u8) -> () { if unsafe { __wasmc_resource_38(p0.reference, i32::from(p1)) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn eq(p0: &ByteBuffer, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_39(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn byte_at(p0: &ByteBuffer, p1: u32) -> Option<u8> { let envelope = unsafe { __wasmc_resource_66(p0.reference, p1 as i32) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 if envelope as u32 <= u8::MAX as u32 => Some(envelope as u8), _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn clear(p0: &ByteBuffer) -> () { if unsafe { __wasmc_resource_67(p0.reference) } != 0 { core::arch::wasm32::unreachable() } }

    #[inline]
    pub fn set(p0: &ByteBuffer, p1: u32, p2: u8) -> bool { match unsafe { __wasmc_resource_68(p0.reference, p1 as i32, i32::from(p2)) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn contains(p0: &ByteBuffer, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_69(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn count_byte(p0: &ByteBuffer, p1: u8) -> u32 { let value = unsafe { __wasmc_resource_70(p0.reference, i32::from(p1)) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

}

pub mod base64 {
    use super::*;

    #[inline]
    pub fn try_encode_standard(p0: &ByteBuffer, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_40(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn try_decode_standard(p0: &ByteBuffer, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_41(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod hex {
    use super::*;

    #[inline]
    pub fn try_encode_lower(p0: &ByteBuffer, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_42(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn try_decode(p0: &ByteBuffer, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_43(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod integer_text {
    use super::*;

    #[inline]
    pub fn parse_s32(p0: &ByteBuffer) -> Option<i32> { let envelope = unsafe { __wasmc_resource_44(p0.reference) } as u64; match (envelope >> 32) as u32 { 0 if envelope as u32 == 0 => None, 1 => Some(envelope as u32 as i32), _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn try_format_s32(p0: i32, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_45(p0, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod structured_data {
    use super::*;

    #[inline]
    pub fn is_reading(p0: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_46(p0.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn try_write_reading(p0: i32, p1: i32, p2: bool, p3: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_47(p0, p1, i32::from(p2), p3.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod structured_text {
    use super::*;

    #[inline]
    pub fn from_utf8(p0: &ByteBuffer) -> Option<Text> { let value = unsafe { __wasmc_resource_48(p0.reference) }; if value == 0 { None } else { Some(Text::from_raw(value)) } }

    #[inline]
    pub fn parse_reading(p0: &ByteBuffer) -> Option<Reading> { let value = unsafe { __wasmc_resource_49(p0.reference) }; if value == 0 { None } else { Some(Reading::from_raw(value)) } }

    #[inline]
    pub fn label(p0: &Reading) -> Text { Text::from_raw(unsafe { __wasmc_resource_50(p0.reference) }) }

    #[inline]
    pub fn text_len(p0: &Text) -> u32 { let value = unsafe { __wasmc_resource_51(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn id(p0: &Reading) -> i32 { let value = unsafe { __wasmc_resource_52(p0.reference) }; if value != i64::from(value as i32) { core::arch::wasm32::unreachable() } value as i32 }

    #[inline]
    pub fn value(p0: &Reading) -> i32 { let value = unsafe { __wasmc_resource_53(p0.reference) }; if value != i64::from(value as i32) { core::arch::wasm32::unreachable() } value as i32 }

    #[inline]
    pub fn active(p0: &Reading) -> bool { match unsafe { __wasmc_resource_54(p0.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn try_write_labeled_reading(p0: &Reading, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_55(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod structured_collection {
    use super::*;

    #[inline]
    pub fn parse_readings(p0: &ByteBuffer) -> Option<ReadingList> { let value = unsafe { __wasmc_resource_56(p0.reference) }; if value == 0 { None } else { Some(ReadingList::from_raw(value)) } }

    #[inline]
    pub fn len(p0: &ReadingList) -> u32 { let value = unsafe { __wasmc_resource_57(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn get(p0: &ReadingList, p1: u32) -> Option<Reading> { let value = unsafe { __wasmc_resource_58(p0.reference, p1 as i32) }; if value == 0 { None } else { Some(Reading::from_raw(value)) } }

    #[inline]
    pub fn try_write_readings(p0: &ReadingList, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_59(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

pub mod structured_map {
    use super::*;

    #[inline]
    pub fn parse_map(p0: &ByteBuffer) -> Option<ReadingMap> { let value = unsafe { __wasmc_resource_60(p0.reference) }; if value == 0 { None } else { Some(ReadingMap::from_raw(value)) } }

    #[inline]
    pub fn len(p0: &ReadingMap) -> u32 { let value = unsafe { __wasmc_resource_61(p0.reference) } as u64; if value >> 32 != 0 { core::arch::wasm32::unreachable() } value as u32 }

    #[inline]
    pub fn contains_key(p0: &ReadingMap, p1: &Text) -> bool { match unsafe { __wasmc_resource_62(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

    #[inline]
    pub fn get(p0: &ReadingMap, p1: &Text) -> Option<Reading> { let value = unsafe { __wasmc_resource_63(p0.reference, p1.reference) }; if value == 0 { None } else { Some(Reading::from_raw(value)) } }

    #[inline]
    pub fn insert(p0: &ReadingMap, p1: Text, p2: Reading) -> Option<Reading> { let value = unsafe { __wasmc_resource_64(p0.reference, p1.into_raw(), p2.into_raw()) }; if value == 0 { None } else { Some(Reading::from_raw(value)) } }

    #[inline]
    pub fn try_write_map(p0: &ReadingMap, p1: &ByteBuffer) -> bool { match unsafe { __wasmc_resource_65(p0.reference, p1.reference) } { 0 => false, 1 => true, _ => core::arch::wasm32::unreachable(), } }

}

