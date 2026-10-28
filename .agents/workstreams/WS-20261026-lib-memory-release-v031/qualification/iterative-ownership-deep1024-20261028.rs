#[test]
fn compile_1024_deep_records_on_default_stack() {
 let declarations=(0..1024).map(|i|format!("record Rec{i} {{ v{i}: s32 }} ")).collect::<String>();
 let locals=(0..1024).map(|i|format!("let p{i}:Rec{i}={{v{i}:a}}; ")).collect::<String>();
 let additions=(0..1024).map(|i|format!(" + p{i}.v{i}")).collect::<String>();
 let source=format!("package local:many_records; interface api {{ {declarations} run: func(a:s32,b:s32)->s32 {{ {locals} return 0 {additions} + b; }} }} world app {{export api;}}");
 eprintln!("PHASE before ordinary compile"); let a=wasmc::compile(&source).unwrap(); wasmparser::Validator::new().validate_all(&a).unwrap();
 eprintln!("PHASE before auto compile"); let b=wasmc::compile_lib_auto(&source).unwrap(); wasmparser::Validator::new().validate_all(&b).unwrap(); eprintln!("PHASE after auto compile");
}
