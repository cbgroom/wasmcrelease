use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

/// Trusted prebound loopback endpoint and fixed peer, not guest path/address API.
pub struct PreauthorizedDatagram {
    socket: Option<UdpSocket>,
    peer: SocketAddr,
    writable: bool,
    buffer: Vec<u8>,
}
impl PreauthorizedDatagram {
    pub fn new(socket: UdpSocket, peer: SocketAddr, writable: bool) -> Result<Self, i32> {
        let local = socket.local_addr().map_err(|_| -8)?;
        if local.ip() != Ipv4Addr::LOCALHOST || peer.ip() != Ipv4Addr::LOCALHOST || peer.port() == 0
        {
            return Err(-5);
        }
        socket
            .set_read_timeout(Some(Duration::from_secs(1)))
            .map_err(|_| -8)?;
        socket
            .set_write_timeout(Some(Duration::from_secs(1)))
            .map_err(|_| -8)?;
        Ok(Self {
            socket: Some(socket),
            peer,
            writable,
            buffer: vec![0; 65536],
        })
    }
    pub fn read(&mut self) -> Result<Vec<u8>, i32> {
        let socket = self.socket.as_ref().ok_or(-1)?;
        // Bounded resident scratch holds any UDP4 message, avoiding divergent
        // platform errors/truncation when the application budget is only16.
        let (count, from) = socket.recv_from(&mut self.buffer).map_err(|_| -8)?;
        if from != self.peer {
            return Err(-2);
        }
        if count > 16 {
            return Err(-5);
        }
        Ok(self.buffer[..count].to_vec())
    }
    pub fn write(&mut self, data: &[u8]) -> Result<usize, i32> {
        if data.len() > 16 {
            return Err(-5);
        }
        let socket = self.socket.as_ref().ok_or(-1)?;
        if !self.writable {
            return Err(-2);
        }
        let count = socket.send_to(data, self.peer).map_err(|_| -9)?;
        if count != data.len() {
            return Err(-9);
        }
        Ok(count)
    }
    pub fn release(&mut self) -> Result<(), i32> {
        // std descriptor Drop cannot acknowledge/report every OS close fault.
        self.socket.take().ok_or(-1)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn datagram_boundary_peer_and_retirement() {
        let client = UdpSocket::bind("127.0.0.1:0").unwrap();
        let foreign = UdpSocket::bind("127.0.0.1:0").unwrap();
        let server = UdpSocket::bind("127.0.0.1:0").unwrap();
        let address = server.local_addr().unwrap();
        let mut endpoint =
            PreauthorizedDatagram::new(server, client.local_addr().unwrap(), false).unwrap();
        for bytes in [vec![], vec![7], vec![1; 16]] {
            client.send_to(&bytes, address).unwrap();
            assert_eq!(endpoint.read(), Ok(bytes));
        }
        client.send_to(&[1; 64], address).unwrap();
        assert_eq!(endpoint.read(), Err(-5));
        foreign.send_to(&[1], address).unwrap();
        assert_eq!(endpoint.read(), Err(-2));
        client.send_to(&[9], address).unwrap();
        assert_eq!(endpoint.read(), Ok(vec![9]));
        assert_eq!(endpoint.write(&[1]), Err(-2));
        endpoint.release().unwrap();
        assert_eq!(endpoint.read(), Err(-1));
        assert_eq!(endpoint.write(&[1]), Err(-1));
        assert_eq!(endpoint.release(), Err(-1));
    }
}
