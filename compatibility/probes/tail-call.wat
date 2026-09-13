(module
  (func $value (result i32) i32.const 7)
  (func (export "run") (result i32) return_call $value))
