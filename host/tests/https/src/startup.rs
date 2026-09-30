//! A bound TCP listener is not evidence that Wasm modules are ready to serve.
use std::{sync::mpsc, time::Duration};

pub const STARTUP_LIMIT: Duration = Duration::from_secs(30);

pub fn initialize<T>(
    ready: mpsc::Sender<Result<(), String>>,
    build: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let result = build();
    let status = result.as_ref().map(|_| ()).map_err(Clone::clone);
    ready
        .send(status)
        .map_err(|_| "HTTPS startup observer disconnected".to_string())?;
    result
}

pub fn wait_ready(
    ready: mpsc::Receiver<Result<(), String>>,
    limit: Duration,
) -> Result<(), String> {
    ready
        .recv_timeout(limit)
        .map_err(|error| format!("HTTPS runtime readiness: {error}"))?
        .map_err(|error| format!("HTTPS runtime initialization: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        thread,
    };

    // Actual TCP reproducer: the listener accepts connects before initialization.
    // Its client times out despite a healthy server that will soon serve bytes.
    fn delayed_server() -> (
        std::net::SocketAddr,
        mpsc::Receiver<Result<(), String>>,
        thread::JoinHandle<()>,
    ) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (tx, rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            initialize(tx, || {
                thread::sleep(Duration::from_millis(1500));
                Ok(())
            })
            .unwrap();
            let (mut socket, _) = listener.accept().unwrap();
            let _ = socket.write_all(b"ready");
        });
        (address, rx, worker)
    }

    #[test]
    fn ungated_connect_reproduces_would_block_or_timeout() {
        let (address, ready, worker) = delayed_server();
        let mut socket = TcpStream::connect(address).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_millis(1000)))
            .unwrap();
        let error = socket.read(&mut [0; 5]).unwrap_err();
        assert!(matches!(
            error.kind(),
            std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
        ));
        // Keep the observer alive, so startup completes rather than failing its signal.
        wait_ready(ready, Duration::from_secs(5)).unwrap();
        worker.join().unwrap();
    }

    #[test]
    fn gated_connect_serves_without_extending_socket_timeout() {
        let (address, ready, worker) = delayed_server();
        wait_ready(ready, Duration::from_secs(5)).unwrap();
        let mut socket = TcpStream::connect(address).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_millis(1000)))
            .unwrap();
        let mut response = [0; 5];
        socket.read_exact(&mut response).unwrap();
        assert_eq!(&response, b"ready");
        worker.join().unwrap();
    }

    #[test]
    fn original_initialization_error_is_preserved() {
        let (tx, rx) = mpsc::channel();
        assert_eq!(
            initialize::<()>(tx, || Err("invalid module digest".into())).unwrap_err(),
            "invalid module digest"
        );
        assert!(wait_ready(rx, Duration::from_millis(10))
            .unwrap_err()
            .contains("invalid module digest"));
    }

    #[test]
    fn timeout_disconnect_and_observer_loss_fail_closed() {
        let (tx, rx) = mpsc::channel();
        assert!(wait_ready(rx, Duration::from_millis(1)).is_err());
        assert!(initialize(tx, || Ok(())).is_err());
        let (tx, rx) = mpsc::channel();
        drop(tx);
        assert!(wait_ready(rx, Duration::from_millis(10)).is_err());
    }
}
