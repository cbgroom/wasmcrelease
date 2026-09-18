use std::io::{Read, Write};
use std::net::{Ipv4Addr, Shutdown, SocketAddrV4, TcpStream};
use std::time::Duration;
fn main() {
    let port: u16 = std::env::args().nth(1).unwrap().parse().unwrap();
    let mut tcp = TcpStream::connect(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port)).unwrap();
    tcp.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
    tcp.set_write_timeout(Some(Duration::from_secs(1))).unwrap();
    tcp.write_all(&[7, 8, 9]).unwrap();
    tcp.shutdown(Shutdown::Write).unwrap();
    let mut response = Vec::new();
    tcp.read_to_end(&mut response).unwrap();
    assert_eq!(response, [24]);
    println!("{{\"accepted\":true,\"peer_response\":[24]}}");
}
