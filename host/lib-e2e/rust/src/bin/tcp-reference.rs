use std::net::TcpStream;
use std::time::Duration;
use wasmc_lib_host_e2e::tcp::PreconnectedTcp;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    // Address comes only from trusted test launcher, not guest API.
    let stream =
        TcpStream::connect_timeout(&args[1].parse().unwrap(), Duration::from_secs(5)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut tcp = PreconnectedTcp::new(stream, args[2] == "write");
    assert_eq!(tcp.read(17), Err(-5));
    assert_eq!(tcp.write(&[0; 17]), Err(-5));
    let mut bytes = Vec::new();
    let length: usize = args[4].parse().unwrap();
    assert!(length <= 16);
    while bytes.len() < length {
        let chunk = tcp.read(16).unwrap();
        assert!(!chunk.is_empty());
        bytes.extend(chunk);
        assert!(bytes.len() <= 16);
    }
    let value = wasmc_lib_host_e2e::sum_bytes(&bytes, &args[3]).unwrap();
    if args[2] == "write" {
        tcp.write(&value.to_le_bytes()).unwrap();
    } else {
        assert_eq!(tcp.write(&[1]), Err(-2));
    }
    assert_eq!(tcp.read(16), Ok(vec![]));
    tcp.release().unwrap();
    assert_eq!(tcp.read(1), Err(-1));
    assert_eq!(tcp.write(&[1]), Err(-1));
    assert_eq!(tcp.release(), Err(-1));
    println!(
        "{}",
        bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
    );
}
