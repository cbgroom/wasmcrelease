(module
  (func (export "route")
    (param $method i32) (param $path i32) (param $body_class i32)
    (param $request_count i32) (result i32 i32 i32)
    local.get $request_count
    i32.const 100
    i32.ge_u
    if
      i32.const 429 i32.const 0 i32.const 0 return
    end
    local.get $method
    i32.eqz
    if
      local.get $path i32.eqz
      if i32.const 200 i32.const 0 i32.const 0 return end
      local.get $path i32.const 1 i32.eq
      if i32.const 204 i32.const 1 i32.const 2 return end
      local.get $path i32.const 3 i32.eq
      if i32.const 403 i32.const 0 i32.const 0 return end
      local.get $path i32.const 4 i32.eq
      if i32.const 301 i32.const 2 i32.const 1 return end
      local.get $path i32.const 5 i32.eq
      if i32.const 418 i32.const 0 i32.const 0 return end
      i32.const 404 i32.const 0 i32.const 0 return
    end
    local.get $method i32.const 1 i32.eq
    if
      local.get $path i32.const 2 i32.eq
      if
        local.get $body_class i32.const 1 i32.eq
        if i32.const 201 i32.const 1 i32.const 3 return end
      end
    end
    i32.const 404 i32.const 0 i32.const 0
  )
)
