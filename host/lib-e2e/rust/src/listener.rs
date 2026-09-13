use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};
pub struct PreauthorizedTcpListener(Option<TcpListener>);
impl PreauthorizedTcpListener {
    pub fn new(listener: TcpListener) -> Result<Self, i32> {
        listener.set_nonblocking(true).map_err(|_| -8)?;
        Ok(Self(Some(listener)))
    }
    pub fn accept(&mut self, deadline_ms: u64) -> Result<TcpStream, i32> {
        let listener = self.0.as_ref().ok_or(-1)?;
        if !(1..=5000).contains(&deadline_ms) {
            return Err(-5);
        }
        let start = Instant::now();
        loop {
            match listener.accept() {
                Ok((stream, _)) => {
                    stream.set_nonblocking(false).map_err(|_| -8)?;
                    return Ok(stream);
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if start.elapsed() >= Duration::from_millis(deadline_ms) {
                        return Err(-6);
                    }
                    std::thread::sleep(Duration::from_millis(1));
                }
                Err(_) => return Err(-8),
            }
        }
    }
    pub fn release(&mut self) -> Result<(), i32> {
        self.0.take().ok_or(-1)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accept_deadline_and_retired_listener() {
        let socket = TcpListener::bind("127.0.0.1:0").unwrap();
        let mut listener = PreauthorizedTcpListener::new(socket).unwrap();
        assert!(matches!(listener.accept(0), Err(-5)));
        assert!(matches!(listener.accept(5), Err(-6)));
        listener.release().unwrap();
        assert!(matches!(listener.accept(1), Err(-1)));
        assert_eq!(listener.release(), Err(-1));
    }
}
