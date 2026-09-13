use serde_json::{json, Value};
use std::io::{self, Read};
use wasmc_completion_guard::CompletionGuard;
fn main() {
    let mut text = String::new();
    io::stdin()
        .take(1024 * 1024)
        .read_to_string(&mut text)
        .unwrap();
    let steps: Vec<Value> = serde_json::from_str(&text).unwrap();
    let mut sessions = [
        CompletionGuard::new().unwrap(),
        CompletionGuard::new().unwrap(),
    ];
    let mut rows = Vec::new();
    for step in steps {
        let s = step[0].as_u64().unwrap() as usize;
        let name = step[1].as_str().unwrap();
        let id = step.get(2).and_then(Value::as_i64).unwrap_or(0) as i32;
        let g = &mut sessions[s];
        let r: Result<Value, i32> = match name {
            "acquire" => g.acquire(id).map(|v| json!(v)),
            "submit" => g.submit(id).map(|v| json!(v)),
            "cancel" => g.cancel(id).map(|v| json!(v)),
            "release" => g.release(id).map(|v| json!(v)),
            "read" => g.read(id).map(|v| json!(v)),
            "poll" => g.poll(id).map(
                |(state, drained, error)| json!({"state":state,"drained":drained,"error":error}),
            ),
            "complete" => {
                let b: Option<Vec<u8>> = step[3]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
                    .collect();
                match b {
                    Some(b) => g
                        .complete(id, &b, step[4].as_i64().unwrap() as i32)
                        .map(|v| json!(v)),
                    None => Err(-5),
                }
            }
            "revoke" => Ok(json!(g.revoke())),
            _ => Err(-7),
        };
        rows.push(json!({"result":match r {Ok(v)=>json!({"ok":v}),Err(e)=>json!({"error":e})},"counts":[sessions[0].counts(),sessions[1].counts()]}));
    }
    println!("{}", json!(rows));
}
