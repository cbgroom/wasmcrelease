(module
  (type $f (func (result i32)))
  (func $value (type $f) i32.const 7)
  (elem declare func $value)
  (func (export "run") (result i32)
    ref.func $value
    call_ref $f))
