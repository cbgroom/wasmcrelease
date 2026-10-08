//! Resumable initialization without replaying a Wasm start.
use crate::{limits::invoke_wasmi_bounded, WasmiCompletionRuntime};
use std::ops::Deref;
use wasmi::{Instance, Linker, Module, Store};

pub(crate) struct ObservedModule {
    module: Module,
    start: Option<String>,
}
impl Deref for ObservedModule {
    type Target = Module;
    fn deref(&self) -> &Module {
        &self.module
    }
}
impl ObservedModule {
    pub(crate) fn new(runtime: &WasmiCompletionRuntime, wasm: &[u8]) -> Result<Self, wasmi::Error> {
        // Validate the exact artifact before inspecting any section.
        let original = Module::new(runtime.engine(), wasm)?;
        if !runtime.limits().observational_fuel() {
            return Ok(Self {
                module: original,
                start: None,
            });
        }
        let mut sections = Vec::new();
        let mut cursor = 8;
        let mut start = None;
        while cursor < wasm.len() {
            let id = wasm[cursor];
            cursor += 1;
            let len = read_u32(wasm, &mut cursor) as usize;
            let end = cursor + len;
            if id == 8 {
                let mut index = cursor;
                start = Some(read_u32(wasm, &mut index));
            }
            sections.push((id, &wasm[cursor..end]));
            cursor = end;
        }
        let Some(start_index) = start else {
            return Ok(Self {
                module: original,
                start: None,
            });
        };
        let mut suffix = 0_u64;
        let name = loop {
            let name = format!("__wasmc_sdk_start_{suffix}");
            if original.exports().all(|export| export.name() != name) {
                break name;
            }
            suffix += 1;
        };
        let mut entry = Vec::new();
        write_u32(&mut entry, name.len() as u32);
        entry.extend_from_slice(name.as_bytes());
        entry.push(0);
        write_u32(&mut entry, start_index);
        let mut rewritten = wasm[..8].to_vec();
        let mut exported = false;
        for (id, payload) in sections {
            if id == 7 {
                let mut position = 0;
                let count = read_u32(payload, &mut position);
                let mut exports = Vec::new();
                write_u32(&mut exports, count + 1);
                exports.extend_from_slice(&payload[position..]);
                exports.extend_from_slice(&entry);
                section(&mut rewritten, 7, &exports);
                exported = true;
            } else if id == 8 {
                if !exported {
                    let mut exports = vec![1];
                    exports.extend_from_slice(&entry);
                    section(&mut rewritten, 7, &exports);
                }
            } else {
                section(&mut rewritten, id, payload);
            }
        }
        Ok(Self {
            module: Module::new(runtime.engine(), &rewritten)?,
            start: Some(name),
        })
    }
    pub(crate) fn instantiate<T>(
        &self,
        runtime: &WasmiCompletionRuntime,
        linker: &Linker<T>,
        store: &mut Store<T>,
    ) -> Result<Instance, wasmi::Error> {
        let instance = linker.instantiate_and_start(&mut *store, &self.module)?;
        if let Some(name) = &self.start {
            let function = instance
                .get_func(&*store, name)
                .ok_or_else(|| wasmi::Error::new("SDK initialization export missing"))?;
            invoke_wasmi_bounded(store, &function, &[], &mut [], runtime.limits())?;
        }
        Ok(instance)
    }
}
// Only used after engine validation of section lengths and u32 bounds.
fn read_u32(bytes: &[u8], position: &mut usize) -> u32 {
    let mut value = 0;
    for shift in (0..35).step_by(7) {
        let byte = bytes[*position];
        *position += 1;
        value |= u32::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            break;
        }
    }
    value
}
fn write_u32(output: &mut Vec<u8>, mut value: u32) {
    loop {
        let byte = (value & 0x7f) as u8;
        value >>= 7;
        output.push(byte | if value == 0 { 0 } else { 0x80 });
        if value == 0 {
            break;
        }
    }
}
fn section(output: &mut Vec<u8>, id: u8, payload: &[u8]) {
    output.push(id);
    write_u32(output, payload.len() as u32);
    output.extend_from_slice(payload);
}
