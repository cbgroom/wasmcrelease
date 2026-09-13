use std::net::{Shutdown, TcpStream};
use std::time::Duration;
use wasmc_completion_guard::scoped::ScopedCompletionGuard;
use wasmc_lib_host_e2e::tcp::PreconnectedTcp;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let mode = &args[2];
    let stream =
        TcpStream::connect_timeout(&args[1].parse().unwrap(), Duration::from_secs(5)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_millis(if mode == "timeout" {
            40
        } else {
            2000
        })))
        .unwrap();
    let mut tcp = PreconnectedTcp::new(stream, false);
    let mut guard = ScopedCompletionGuard::fresh().unwrap();
    let window = guard.acquire(16).unwrap();
    let op = guard.submit(&window).unwrap();
    assert_eq!(guard.release(&window), Err(-4));
    let stopper = if mode == "cancel" || mode == "revoke" {
        let handle = tcp.stop_handle().unwrap();
        Some(std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(30));
            // Shutdown interrupts the other descriptor's blocked read.
            let result = handle.shutdown(Shutdown::Both);
            assert!(
                result.is_ok()
                    || result.as_ref().err().unwrap().kind() == std::io::ErrorKind::NotConnected
            );
            // The cloned descriptor is dropped before join acknowledgement.
        }))
    } else {
        None
    };
    let read = tcp.read(16);
    if let Some(stopper) = stopper {
        stopper.join().unwrap();
    }
    let status = match mode.as_str() {
        "revoke" => {
            guard.revoke();
            -2
        }
        "cancel" | "timeout" => {
            guard.cancel(&op).unwrap();
            -6
        }
        "success" => 0,
        _ => panic!("unknown trusted fixture mode"),
    };
    if mode == "timeout" {
        assert_eq!(read, Err(-8));
    }
    let (bytes, error) = match read {
        Ok(bytes) => (bytes, 0),
        Err(error) => (vec![], error),
    };
    guard.complete(&op, &bytes, error).unwrap();
    assert_eq!(guard.complete(&op, &[], 0), Err(-1));
    if mode == "success" {
        assert_eq!(guard.read(&window), Ok(vec![7]));
    } else if mode == "revoke" {
        assert_eq!(guard.read(&window), Err(-2));
        assert_eq!(guard.acquire(1), Err(-2));
    } else {
        assert_eq!(guard.read(&window), Ok(vec![]));
    }
    guard.release(&op).unwrap();
    guard.release(&window).unwrap();
    tcp.release().unwrap();
    assert_eq!(guard.counts(), [0, 0]);
    assert_eq!(tcp.read(1), Err(-1));
    println!("{{\"status\":{status},\"cleanup\":true,\"duplicate_denied\":true}}");
}
