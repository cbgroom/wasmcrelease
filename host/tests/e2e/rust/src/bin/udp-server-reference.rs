use std::io::Write;
use std::net::{SocketAddr, UdpSocket};
use wasmc_lib_host_e2e::{app_engine::AppEngine, udp::PreauthorizedDatagram};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let peer: SocketAddr = args[1].parse().unwrap();
    let limit: usize = args[2].parse().unwrap();
    assert!((1..=64).contains(&limit));
    let mut app = AppEngine::new(
        &args[3],
        &args[4],
        args.iter().any(|arg| arg == "--wasmtime"),
    )
    .unwrap();
    let socket = UdpSocket::bind("127.0.0.1:0").unwrap();
    let port = socket.local_addr().unwrap().port();
    let mut endpoint = PreauthorizedDatagram::new(socket, peer, true).unwrap();
    println!("{{\"port\":{port}}}");
    std::io::stdout().flush().unwrap();
    let mut rejected = 0;
    for index in 0..limit {
        let result = endpoint.read().and_then(|bytes| {
            let value = app.call(&bytes, 0).map_err(|_| -8)?;
            endpoint.write(&value.to_le_bytes())?;
            Ok(value)
        });
        let (status, sum) = match result {
            Ok(value) => (0, value),
            Err(error) => {
                rejected += 1;
                (error, 0)
            }
        };
        println!(
            "{{\"index\":{index},\"status\":{status},\"sum\":{sum},\"calls\":{}}}",
            app.lib_calls()
        );
        std::io::stdout().flush().unwrap();
    }
    endpoint.release().unwrap();
    assert_eq!(endpoint.read(), Err(-1));
    println!("{{\"accepted\":true,\"calls\":{},\"rejected\":{rejected},\"lib_instances\":1,\"app_instances\":1,\"resource_retired\":true}}",app.lib_calls());
}
