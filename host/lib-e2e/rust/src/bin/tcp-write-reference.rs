use std::net::TcpStream;
use std::time::Duration;
use wasmc_completion_guard::scoped::ScopedCompletionGuard;
use wasmc_lib_host_e2e::tcp::PreconnectedTcp;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let stream =
        TcpStream::connect_timeout(&args[1].parse().unwrap(), Duration::from_secs(5)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .unwrap();
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .unwrap();
    let mut tcp = PreconnectedTcp::new(stream, true);
    let mut guard = ScopedCompletionGuard::fresh().unwrap();
    let window = guard.acquire(4).unwrap();
    let op = guard.submit(&window).unwrap();
    let acknowledged = tcp.write(&[1, 2, 3, 4]).unwrap();
    // Peer observation is explicit fixture proof, not normal write semantics.
    assert_eq!(tcp.read(1), Ok(vec![42]));
    guard.cancel(&op).unwrap();
    assert_eq!(guard.release(&window), Err(-4));
    guard.complete(&op, &[], 0).unwrap();
    assert_eq!(guard.complete(&op, &[], 0), Err(-1));
    guard.release(&op).unwrap();
    guard.release(&window).unwrap();
    tcp.release().unwrap();
    assert_eq!(guard.counts(), [0, 0]);
    println!("{{\"state\":\"cancelled\",\"effect\":\"possibly_partial\",\"acknowledged\":{acknowledged}}}");
}
