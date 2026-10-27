use wasmc::json::document::{edit_or_bytes,Edit,EditKind};
#[unsafe(no_mangle)]pub extern "C" fn run(n:u32,seed:u32)->u32{let c=if seed==0{'a'}else{'b'};let text=c.to_string().repeat(n as usize);let input=format!("{{\"a\":1,\"b\":[],\"text\":\"{}\"}}",text);let edits=[Edit{kind:EditKind::Set,path:"/b/-".into(),value_json:"true".into()},Edit{kind:EditKind::Remove,path:"/a".into(),value_json:"".into()}];let output=edit_or_bytes(input.as_bytes(),&edits,"fallback");assert_eq!(output,format!("{{\"b\":[true],\"text\":\"{}\"}}",text));assert_eq!(edit_or_bytes(b"invalid",&edits,"fallback"),"fallback");n}

// exact SDK consumer assembler proof 20261027
