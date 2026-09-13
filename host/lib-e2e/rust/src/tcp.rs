use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
/// Trusted Host supplies a connected stream, not a guest-selected address.
pub struct PreconnectedTcp {
    stream: Option<TcpStream>,
    writable: bool,
}

impl PreconnectedTcp {
    /// Trusted backend stop handle; never exposed as a guest capability.
    pub fn stop_handle(&self) -> Result<TcpStream, i32> {
        self.stream.as_ref().ok_or(-1)?.try_clone().map_err(|_| -8)
    }
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
    fn read_eof_preserves_write_until_explicit_retirement() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let mut client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (stream, _) = listener.accept().unwrap();
        client
            .set_read_timeout(Some(std::time::Duration::from_secs(1)))
            .unwrap();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(1)))
            .unwrap();
        let mut tcp = PreconnectedTcp::new(stream, true);
        client.write_all(&[7, 8, 9]).unwrap();
        client.shutdown(Shutdown::Write).unwrap();
        assert_eq!(tcp.read(3), Ok(vec![7, 8, 9]));
        assert_eq!(tcp.read(1), Ok(vec![]));
        assert_eq!(tcp.write(&[24]), Ok(1));
        tcp.release().unwrap();
        let mut response = Vec::new();
        client.read_to_end(&mut response).unwrap();
        assert_eq!(response, [24]);
        assert_eq!(tcp.write(&[24]), Err(-1));
    }
    #[test]
    fn native_supervisor_retires_real_tcp_only_after_close_ack() {
        use std::sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering},
            Arc,
        };
        use wasmc_completion_guard::owner_supervisor::{NativeOwnerSupervisor, QuarantineEndpoint};
        struct Fence {
            tcp: PreconnectedTcp,
            close: Arc<AtomicBool>,
            reads: Arc<AtomicUsize>,
        }
        impl QuarantineEndpoint for Fence {
            fn acknowledge_close(&mut self) -> Result<(), i32> {
                if !self.close.load(Ordering::Acquire) {
                    return Err(-8);
                }
                let handle = self.tcp.stop_handle()?;
                match handle.shutdown(Shutdown::Both) {
                    Ok(()) => Ok(()),
                    Err(e) if e.kind() == std::io::ErrorKind::NotConnected => Ok(()),
                    Err(_) => Err(-8),
                }
            }
            fn retire(&mut self) -> Result<(), i32> {
                self.tcp.release()
            }
        }
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (mut peer, _) = listener.accept().unwrap();
        client
            .set_read_timeout(Some(std::time::Duration::from_millis(30)))
            .unwrap();
        peer.set_read_timeout(Some(std::time::Duration::from_secs(1)))
            .unwrap();
        let close = Arc::new(AtomicBool::new(false));
        let reads = Arc::new(AtomicUsize::new(0));
        let mut supervisor = NativeOwnerSupervisor::new(1).unwrap();
        let ticket = match supervisor.admit(
            Fence {
                tcp: PreconnectedTcp::new(client, false),
                close: close.clone(),
                reads: reads.clone(),
            },
            16,
        ) {
            Ok(t) => t,
            Err(_) => panic!("admission failed"),
        };
        let owner = supervisor.endpoint_mut(ticket).unwrap();
        owner.reads.fetch_add(1, Ordering::Relaxed);
        assert_eq!(owner.tcp.read(1), Err(-8)); // actual timeout has settled I/O
        supervisor.quarantine_settled(ticket).unwrap();
        assert_eq!(supervisor.retire_quarantine(ticket), Err(-8));
        assert_eq!(supervisor.resource_counts(ticket), Ok([1, 1]));
        assert_eq!(supervisor.counts(), [0, 1]);
        close.store(true, Ordering::Release);
        supervisor.retire_quarantine(ticket).unwrap();
        assert_eq!(supervisor.counts(), [0, 0]);
        assert_eq!(reads.load(Ordering::Relaxed), 1);
        assert_eq!(peer.read(&mut [0; 1]).unwrap(), 0);
    }
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
