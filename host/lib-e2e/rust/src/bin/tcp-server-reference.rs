use std::io::Write;
use std::net::TcpListener;
use std::time::Duration;
use wasmc_lib_host_e2e::{
    app_engine::AppEngine, listener::PreauthorizedTcpListener, tcp::PreconnectedTcp,
};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let limit: usize = args[2].parse().unwrap();
    assert!((1..=64).contains(&limit));
    let mut app = AppEngine::new(
        &args[1],
        &args[3],
        args.iter().any(|arg| arg == "--wasmtime"),
    )
    .unwrap();
    // Bind policy belongs solely to trusted fixture launcher, never guest.
    let socket = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = socket.local_addr().unwrap().port();
    let mut listener = PreauthorizedTcpListener::new(socket).unwrap();
    println!("{{\"port\":{port}}}");
    std::io::stdout().flush().unwrap();
    let mut calls = 0;
    let mut rejected = 0;
    for _ in 0..limit {
        let stream = listener.accept(5000).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(500)))
            .unwrap();
        stream
            .set_write_timeout(Some(Duration::from_millis(500)))
            .unwrap();
        let mut tcp = PreconnectedTcp::new(stream, true);
        let result = (|| -> Result<(), i32> {
            let header = tcp.read(1)?;
            if header.len() != 1 || header[0] > 16 {
                return Err(-5);
            }
            let length = usize::from(header[0]);
            let mut bytes = Vec::new();
            while bytes.len() < length {
                let chunk = tcp.read(length - bytes.len())?;
                if chunk.is_empty() {
                    return Err(-8);
                }
                bytes.extend(chunk);
            }
            let value = app.call(&bytes, 0).map_err(|error| {
                eprintln!("Lib call: {error}");
                -8
            })?;
            calls += 1;
            tcp.write(&value.to_le_bytes())?;
            Ok(())
        })();
        if result.is_err() {
            rejected += 1;
        }
        let _ = tcp.release();
    }
    listener.release().unwrap();
    assert!(matches!(listener.accept(1), Err(-1)));
    assert_eq!(app.lib_calls(), calls);
    println!("{{\"accepted\":true,\"calls\":{calls},\"rejected\":{rejected},\"lib_instances\":1,\"app_instances\":1,\"listener_retired\":true}}");
}
