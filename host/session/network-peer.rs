use std::io::{Read, Write};
use std::net::{Ipv4Addr, Shutdown, SocketAddrV4, TcpStream};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        return Err("usage: network-peer PORT comma-separated-bytes".into());
    }
    let port: u16 = args[1].parse()?;
    let bytes: Vec<u8> = if args[2].is_empty() {
        Vec::new()
    } else {
        args[2]
            .split(',')
            .map(str::parse)
            .collect::<Result<_, _>>()?
    };
    if bytes.len() > 16 {
        return Err("input exceeds fixture budget".into());
    }
    let mut socket = TcpStream::connect(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port))?;
    socket.set_read_timeout(Some(Duration::from_secs(2)))?;
    socket.set_write_timeout(Some(Duration::from_secs(2)))?;
    socket.write_all(&bytes)?;
    socket.shutdown(Shutdown::Write)?;
    let mut response = Vec::new();
    socket.take(9).read_to_end(&mut response)?;
    let expected: i64 = bytes.iter().map(|byte| i64::from(*byte)).sum();
    if response != expected.to_le_bytes() {
        return Err("half-close response mismatch".into());
    }
    println!("{{\"accepted\":true,\"response\":{response:?}}}");
    Ok(())
}
