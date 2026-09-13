use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
/// Trusted Host supplies a connected stream, not a guest-selected address.
pub struct PreconnectedTcp {
    stream: Option<TcpStream>,
    writable: bool,
}

impl PreconnectedTcp {
    pub fn new(stream: TcpStream, writable: bool) -> Self {
        Self {
            stream: Some(stream),
            writable,
        }
    }
    pub fn read(&mut self, length: usize) -> Result<Vec<u8>, i32> {
        let stream = self.stream.as_mut().ok_or(-1)?;
        if length > 16 {
            return Err(-5);
        }
        let mut bytes = vec![0; length];
        let count = stream.read(&mut bytes).map_err(|_| -8)?;
        bytes.truncate(count);
        Ok(bytes)
    }
    pub fn write(&mut self, bytes: &[u8]) -> Result<usize, i32> {
        let stream = self.stream.as_mut().ok_or(-1)?;
        if bytes.len() > 16 {
            return Err(-5);
        }
        if !self.writable {
            return Err(-2);
        }
        stream.write_all(bytes).map_err(|_| -9)?;
        Ok(bytes.len())
    }
    pub fn release(&mut self) -> Result<(), i32> {
        let stream = self.stream.take().ok_or(-1)?;
        // Descriptor is dropped even if shutdown reports peer failure.
        match stream.shutdown(Shutdown::Both) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotConnected => Ok(()),
            Err(_) => Err(-8),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    #[test]
    fn read_deadline_failure_releases_descriptor() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (_peer, _) = listener.accept().unwrap();
        client
            .set_read_timeout(Some(std::time::Duration::from_millis(20)))
            .unwrap();
        let mut tcp = PreconnectedTcp::new(client, false);
        assert_eq!(tcp.read(1), Err(-8));
        tcp.release().unwrap();
        assert_eq!(tcp.read(1), Err(-1));
    }
    #[test]
    fn real_stream_rights_bounds_and_retirement() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (mut peer, _) = listener.accept().unwrap();
        let mut tcp = PreconnectedTcp::new(client, false);
        assert_eq!(tcp.read(17), Err(-5));
        assert_eq!(tcp.write(&[0; 17]), Err(-5));
        assert_eq!(tcp.write(&[1]), Err(-2));
        peer.write_all(&[7]).unwrap();
        peer.shutdown(Shutdown::Write).unwrap();
        assert_eq!(tcp.read(16), Ok(vec![7]));
        assert_eq!(tcp.read(16), Ok(vec![]));
        tcp.release().unwrap();
        assert_eq!(tcp.read(1), Err(-1));
        assert_eq!(tcp.release(), Err(-1));
    }
}
