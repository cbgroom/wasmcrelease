//! Host-only transport selection under one supervisor; no guest dispatch ABI.
use crate::{
    nonblocking_tcp::{NonblockingTcpRead, ReadProgress},
    nonblocking_udp::NonblockingUdpRead,
    owner_supervisor::QuarantineEndpoint,
    readiness::ReadyReadOwner,
};
use std::time::Instant;

pub enum NativeSocketRead {
    Tcp(NonblockingTcpRead),
    Udp(NonblockingUdpRead),
}
impl ReadyReadOwner for NativeSocketRead {
    fn register(&mut self, registry: &mio::Registry, token: mio::Token) -> Result<(), i32> {
        match self {
            Self::Tcp(read) => read.register(registry, token),
            Self::Udp(read) => read.register(registry, token),
        }
    }
    fn deadline(&self) -> Instant {
        match self {
            Self::Tcp(read) => read.deadline(),
            Self::Udp(read) => read.deadline(),
        }
    }
    fn cancel(&mut self) -> Result<(), i32> {
        match self {
            Self::Tcp(read) => read.cancel(),
            Self::Udp(read) => read.cancel(),
        }
    }
    fn poll(&mut self, now: Instant) -> Result<ReadProgress, i32> {
        match self {
            Self::Tcp(read) => read.poll(now),
            Self::Udp(read) => read.poll(now),
        }
    }
    fn close_acknowledged(&self) -> bool {
        match self {
            Self::Tcp(read) => read.close_acknowledged(),
            Self::Udp(read) => read.close_acknowledged(),
        }
    }
}
impl QuarantineEndpoint for NativeSocketRead {
    fn acknowledge_close(&mut self) -> Result<(), i32> {
        if self.close_acknowledged() {
            Ok(())
        } else {
            Err(-4)
        }
    }
    fn acknowledge_quarantine_close(&mut self) -> Result<(), i32> {
        if !self.close_acknowledged() {
            let _ = self.cancel();
            if !matches!(self.poll(Instant::now())?, ReadProgress::Settled(Err(-10))) {
                return Err(-8);
            }
        }
        self.acknowledge_close()
    }
    fn retire(&mut self) -> Result<(), i32> {
        self.acknowledge_close()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read_reactor::SocketReadReactor;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream, UdpSocket},
        thread,
        time::Duration,
    };
    fn tcp() -> (NativeSocketRead, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        peer.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
        (
            NativeSocketRead::Tcp(
                NonblockingTcpRead::new(
                    listener.accept().unwrap().0,
                    16,
                    Instant::now() + Duration::from_secs(2),
                )
                .unwrap_or_else(|_| panic!("TCP")),
            ),
            peer,
        )
    }
    fn udp(duration: Duration) -> (NativeSocketRead, UdpSocket, std::net::SocketAddr) {
        let read = UdpSocket::bind("127.0.0.1:0").unwrap();
        let addr = read.local_addr().unwrap();
        let peer = UdpSocket::bind("127.0.0.1:0").unwrap();
        read.connect(peer.local_addr().unwrap()).unwrap();
        peer.connect(addr).unwrap();
        (
            NativeSocketRead::Udp(
                NonblockingUdpRead::new(read, 16, Instant::now() + duration)
                    .unwrap_or_else(|_| panic!("UDP")),
            ),
            peer,
            addr,
        )
    }
    #[test]
    fn sixteen_mixed_socket_reads_share_supervisor_queue_and_exact_results() {
        let mut reactor = SocketReadReactor::new(16).unwrap();
        let mut expected = Vec::new();
        let mut tcp_peers = Vec::new();
        let mut udp_peers = Vec::new();
        for i in 0..16u8 {
            let value = if i % 4 == 1 { vec![] } else { vec![i] };
            let (key, cancel) = if i % 2 == 0 {
                let (read, mut peer) = tcp();
                let admitted = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
                peer.write_all(&value).unwrap();
                tcp_peers.push(peer);
                admitted
            } else {
                let (read, peer, _) = udp(Duration::from_secs(2));
                let admitted = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
                assert_eq!(peer.send(&value).unwrap(), value.len());
                udp_peers.push(peer);
                admitted
            };
            expected.push((key, cancel, value));
        }
        let mut seen = Vec::new();
        while reactor.counts() != [0, 0] {
            for item in reactor.drive().unwrap() {
                assert!(!seen.contains(&item.key));
                seen.push(item.key);
                let (_, cancel, value) = expected
                    .iter()
                    .find(|(key, _, _)| *key == item.key)
                    .unwrap();
                assert_eq!(&item.result.unwrap(), value);
                assert_eq!(cancel.cancel(), Err(-1));
            }
        }
        assert_eq!(seen.len(), 16);
        assert!(reactor.drive().unwrap().is_empty());
        for mut peer in tcp_peers {
            assert_eq!(peer.read(&mut [0]).unwrap(), 0);
        }
    }
    #[test]
    fn mixed_cancel_deadline_oversize_and_stream_success_do_not_cross_deliver() {
        let mut reactor = SocketReadReactor::new(4).unwrap();
        let (read, _p1) = tcp();
        let (cancel_key, cancel) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        let (read, _p2, _) = udp(Duration::from_millis(60));
        let (deadline_key, _) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        let (read, p3, _) = udp(Duration::from_secs(2));
        let (oversize_key, _) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        p3.send(&[7; 64]).unwrap();
        let (read, mut p4) = tcp();
        let (ready_key, _) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        p4.write_all(b"ok").unwrap();
        cancel.cancel().unwrap();
        let mut seen = Vec::new();
        while reactor.counts() != [0, 0] {
            for item in reactor.drive().unwrap() {
                assert!(!seen.contains(&item.key));
                seen.push(item.key);
                let expected = if item.key == cancel_key {
                    Err(-10)
                } else if item.key == deadline_key {
                    Err(-9)
                } else if item.key == oversize_key {
                    Err(-5)
                } else {
                    assert!(item.key == ready_key);
                    Ok(b"ok".to_vec())
                };
                assert_eq!(item.result, expected);
            }
        }
        assert_eq!(seen.len(), 4);
    }
    #[test]
    fn mixed_pending_cancel_retains_quota_and_drop_closes_remaining_socket() {
        let mut reactor = SocketReadReactor::new(2).unwrap();
        let (read, _peer) = tcp();
        let (key, cancel) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        let (read, _peer2, addr) = udp(Duration::from_secs(2));
        let (_, other) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        let (read, _peer3) = tcp();
        let (code, read) = reactor.admit(read).err().unwrap();
        assert_eq!(code, -3);
        assert!(!read.close_acknowledged());
        let (tx, rx) = std::sync::mpsc::channel();
        let worker = thread::spawn(move || {
            let result = reactor.drive().unwrap();
            tx.send(()).unwrap();
            (reactor, result)
        });
        assert!(rx.recv_timeout(Duration::from_millis(20)).is_err());
        cancel.cancel().unwrap();
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        let (reactor, result) = worker.join().unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].key == key);
        assert_eq!(result[0].result, Err(-10));
        assert_eq!(reactor.counts(), [1, 0]);
        drop(reactor);
        assert_eq!(other.cancel(), Err(-1));
        assert!(UdpSocket::bind(addr).is_ok());
        struct RegistrationFailure(NativeSocketRead);
        impl ReadyReadOwner for RegistrationFailure {
            fn register(&mut self, registry: &mio::Registry, token: mio::Token) -> Result<(), i32> {
                self.0.register(registry, token)?;
                Err(-8) // Actual registration effected before error.
            }
            fn deadline(&self) -> Instant {
                self.0.deadline()
            }
            fn cancel(&mut self) -> Result<(), i32> {
                self.0.cancel()
            }
            fn poll(&mut self, now: Instant) -> Result<ReadProgress, i32> {
                self.0.poll(now)
            }
            fn close_acknowledged(&self) -> bool {
                self.0.close_acknowledged()
            }
        }
        impl QuarantineEndpoint for RegistrationFailure {
            fn acknowledge_close(&mut self) -> Result<(), i32> {
                self.0.acknowledge_close()
            }
            fn retire(&mut self) -> Result<(), i32> {
                self.0.retire()
            }
        }
        let mut failed =
            crate::read_reactor::GenericReadReactor::<RegistrationFailure>::new(1).unwrap();
        let (read, mut peer) = tcp();
        let (code, returned) = failed.admit(RegistrationFailure(read)).err().unwrap();
        assert_eq!(code, -8);
        assert!(!returned.close_acknowledged());
        assert!(matches!(failed.drive(), Err(-8)));
        let (read, _peer) = tcp();
        let (code, read) = failed.admit(RegistrationFailure(read)).err().unwrap();
        assert_eq!(code, -8);
        assert!(!read.close_acknowledged());
        assert_eq!(failed.counts(), [0, 0]);
        drop(returned);
        assert_eq!(peer.read(&mut [0]).unwrap(), 0);
    }
}
