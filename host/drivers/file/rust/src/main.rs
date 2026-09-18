use serde_json::{json, Value};
use std::{
    fs::OpenOptions,
    io::{self, Read},
};
use wasmc_preopened_file_reference::PreopenedFile;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    // Trusted harness configuration, never a guest supplied open operation.
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(&args[1])
        .unwrap();
    let mut host = PreopenedFile::new(file, args[2] == "write");
    let mut input = String::new();
    io::stdin()
        .take(1024 * 1024)
        .read_to_string(&mut input)
        .unwrap();
    let steps: Vec<Value> = serde_json::from_str(&input).unwrap();
    let mut results = Vec::new();
    for step in steps {
        let name = step[0].as_str().unwrap();
        let offset = step.get(1).and_then(Value::as_i64).unwrap_or(0);
        let result: Result<Value, i32> = match name {
            "read" => host
                .read(offset, step[2].as_u64().unwrap() as usize)
                .map(|b| json!(b)),
            "write" => {
                let bytes: Option<Vec<u8>> = step[2]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
                    .collect();
                match bytes {
                    Some(b) => host.write(offset, &b).map(|n| json!(n)),
                    None => Err(-5),
                }
            }
            "sync" => host.invoke_sync().map(|_| json!(0)),
            "release" => host.release().map(|_| json!(0)),
            _ => Err(-7),
        };
        results.push(match result {
            Ok(v) => json!({"ok":v}),
            Err(code) => json!({"error":code}),
        });
    }
    println!("{}", serde_json::to_string(&results).unwrap());
}
