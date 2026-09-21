use rustls::{
    pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer},
    ServerConfig, ServerConnection, StreamOwned,
};
use std::{
    error::Error,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::Arc,
    thread,
    time::Duration,
};

fn serve_connection(
    stream: TcpStream,
    config: Arc<ServerConfig>,
) -> Result<u64, Box<dyn Error + Send + Sync>> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;
    let connection = ServerConnection::new(config)?;
    let mut tls = StreamOwned::new(connection, stream);
    let mut input = Vec::<u8>::new();
    let mut temp = [0u8; 4096];
    let mut requests = 0u64;
    loop {
        let n = match tls.read(&mut temp) {
            Ok(0) => break,
            Ok(n) => n,
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::ConnectionReset
                        | std::io::ErrorKind::ConnectionAborted
                        | std::io::ErrorKind::BrokenPipe
                        | std::io::ErrorKind::UnexpectedEof
                ) =>
            {
                break;
            }
            Err(error) => return Err(error.into()),
        };
        input.extend_from_slice(&temp[..n]);
        while let Some(head) = input.windows(4).position(|window| window == b"\r\n\r\n") {
            let head = head + 4;
            input.drain(..head);
            tls.write_all(b"HTTP/1.1 204 No Content\r\ncontent-length: 0\r\n\r\n")?;
            tls.flush()?;
            requests = requests.saturating_add(1);
        }
    }
    Ok(requests)
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = std::env::args().skip(1);
    let cert = std::fs::read(args.next().ok_or("cert")?)?;
    let key = std::fs::read(args.next().ok_or("key")?)?;
    let connections = std::env::var("WASMC_HTTPS_EXTERNAL_CONNECTIONS")
        .ok()
        .map(|value| value.parse::<usize>())
        .transpose()?
        .unwrap_or(1);
    if connections == 0 || connections > 64 {
        return Err("connections must be in 1..=64".into());
    }
    let provider = Arc::new(rustls_rustcrypto::provider());
    let config = ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()?
        .with_no_client_auth()
        .with_single_cert(
            vec![CertificateDer::from(cert)],
            PrivateKeyDer::from(PrivatePkcs8KeyDer::from(key)),
        )?;
    let config = Arc::new(config);
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;
    println!(
        "{{\"schema\":\"native-https-control/v1\",\"ready\":true,\"addr\":\"{}\",\"connections\":{}}}",
        addr, connections
    );
    std::io::stdout().flush()?;

    let mut workers = Vec::with_capacity(connections);
    for _ in 0..connections {
        let listener = listener.try_clone()?;
        let config = config.clone();
        workers.push(thread::spawn(move || {
            let (stream, _) = listener.accept()?;
            serve_connection(stream, config)
        }));
    }
    drop(listener);
    let mut requests = 0u64;
    for worker in workers {
        requests = requests.saturating_add(
            worker
                .join()
                .map_err(|_| "native HTTPS worker panicked")?
                .map_err(|error| format!("native HTTPS worker failed: {error}"))?,
        );
    }
    println!(
        "{{\"schema\":\"native-https-control-result/v1\",\"accepted\":true,\"connections\":{},\"requests\":{}}}",
        connections, requests
    );
    Ok(())
}
