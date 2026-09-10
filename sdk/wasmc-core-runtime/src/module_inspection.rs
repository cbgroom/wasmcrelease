//! Engine-neutral description of one validated WebAssembly Core module.

use wasmi::{ExternType, Module, ValType};

/// WebAssembly value types exposed by a Core function signature.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum CoreModuleValueType {
    I32,
    I64,
    F32,
    F64,
    V128,
    FuncRef,
    ExternRef,
}

/// Engine-neutral external item shape.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CoreModuleExternType {
    Function {
        params: Vec<CoreModuleValueType>,
        results: Vec<CoreModuleValueType>,
    },
    Memory,
    Table,
    Global,
}

/// One import in exact module order.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoreModuleImport {
    module: String,
    name: String,
    external_type: CoreModuleExternType,
}

impl CoreModuleImport {
    pub fn module(&self) -> &str {
        &self.module
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn external_type(&self) -> &CoreModuleExternType {
        &self.external_type
    }
}

/// One exported item.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoreModuleExport {
    name: String,
    external_type: CoreModuleExternType,
}

impl CoreModuleExport {
    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn external_type(&self) -> &CoreModuleExternType {
        &self.external_type
    }
}

/// Validated, engine-neutral facts needed for Host-owned admission.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoreModuleInspection {
    wasm_bytes: usize,
    imports: Vec<CoreModuleImport>,
    exports: Vec<CoreModuleExport>,
}

impl CoreModuleInspection {
    pub const fn wasm_bytes(&self) -> usize {
        self.wasm_bytes
    }

    pub fn imports(&self) -> &[CoreModuleImport] {
        &self.imports
    }

    pub fn exports(&self) -> &[CoreModuleExport] {
        &self.exports
    }
}

pub(crate) fn inspect_module(module: &Module, wasm_bytes: usize) -> CoreModuleInspection {
    CoreModuleInspection {
        wasm_bytes,
        imports: module
            .imports()
            .map(|import| CoreModuleImport {
                module: import.module().to_string(),
                name: import.name().to_string(),
                external_type: external_type(import.ty()),
            })
            .collect(),
        exports: module
            .exports()
            .map(|export| CoreModuleExport {
                name: export.name().to_string(),
                external_type: external_type(export.ty()),
            })
            .collect(),
    }
}

fn external_type(value: &ExternType) -> CoreModuleExternType {
    match value {
        ExternType::Func(function) => CoreModuleExternType::Function {
            params: function.params().iter().copied().map(value_type).collect(),
            results: function.results().iter().copied().map(value_type).collect(),
        },
        ExternType::Memory(_) => CoreModuleExternType::Memory,
        ExternType::Table(_) => CoreModuleExternType::Table,
        ExternType::Global(_) => CoreModuleExternType::Global,
    }
}

fn value_type(value: ValType) -> CoreModuleValueType {
    match value {
        ValType::I32 => CoreModuleValueType::I32,
        ValType::I64 => CoreModuleValueType::I64,
        ValType::F32 => CoreModuleValueType::F32,
        ValType::F64 => CoreModuleValueType::F64,
        ValType::V128 => CoreModuleValueType::V128,
        ValType::FuncRef => CoreModuleValueType::FuncRef,
        ValType::ExternRef => CoreModuleValueType::ExternRef,
    }
}
