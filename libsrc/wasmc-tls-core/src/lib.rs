wit_bindgen::generate!({
    path: "wit",
    world: "tls-core",
});

use crate::exports::wasmc::tls_core::tls::{
    ConnectionState as ApiState, Guest, GuestSession, Progress, Session as ApiSession, TlsError,
};
use crate::wasmc::tls_core::entropy;
use getrandom::{register_custom_getrandom, Error as RandomError};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, UnixTime};
use rustls::server::UnbufferedServerConnection;
use rustls::time_provider::TimeProvider;
use rustls::unbuffered::ConnectionState as RustlsState;
use rustls::ServerConfig;
use std::cell::RefCell;
use std::collections::VecDeque;
use std::num::NonZeroU32;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

const MAX_CIPHERTEXT_BUFFER: usize = 1 << 20;
const MAX_OUTPUT_BUFFER: usize = 1 << 20;
const MAX_PLAINTEXT_BUFFER: usize = 1 << 20;
const MAX_WRITE_BYTES: usize = 16 << 10;

static ENTROPY_FAILED: AtomicBool = AtomicBool::new(false);

fn custom_random(dest: &mut [u8]) -> Result<(), RandomError> {
    let length = u32::try_from(dest.len()).map_err(|_| custom_random_error())?;
    match entropy::fill(length) {
        Ok(bytes) if bytes.len() == dest.len() => {
            dest.copy_from_slice(&bytes);
            Ok(())
        }
        _ => {
            ENTROPY_FAILED.store(true, Ordering::Release);
            Err(custom_random_error())
        }
    }
}

fn custom_random_error() -> RandomError {
    RandomError::from(NonZeroU32::new(RandomError::CUSTOM_START).unwrap())
}

register_custom_getrandom!(custom_random);

struct Tls;

// Server-side TLS in this profile neither validates peer certificates nor emits
// session tickets. rustls still requires a TimeProvider in no-std mode, so keep
// that implementation inside the portable Lib rather than creating a Host clock
// dependency. If future TLS features require authoritative wall time, that must
// be introduced as an explicit capability with separate evidence.
#[derive(Debug)]
struct ServerOnlyTime;

impl TimeProvider for ServerOnlyTime {
    fn current_time(&self) -> Option<UnixTime> {
        Some(UnixTime::since_unix_epoch(Duration::ZERO))
    }
}

struct Session {
    inner: RefCell<Inner>,
}

struct Inner {
    conn: UnbufferedServerConnection,
    incoming: Vec<u8>,
    outgoing: Vec<u8>,
    plaintext: VecDeque<u8>,
    pending_write: Option<Vec<u8>>,
    accepted_write: u32,
    close_requested: bool,
    close_emitted: bool,
    peer_closed: bool,
    closed: bool,
    failed: bool,
}

fn classify_error() -> TlsError {
    if ENTROPY_FAILED.swap(false, Ordering::AcqRel) {
        TlsError::EntropyFailure
    } else {
        TlsError::CryptoFailure
    }
}

impl Inner {
    fn api_state(&self) -> ApiState {
        if self.failed {
            ApiState::Failed
        } else if self.closed {
            ApiState::Closed
        } else if self.peer_closed {
            ApiState::PeerClosed
        } else if self.close_requested {
            ApiState::Closing
        } else if self.conn.is_handshaking() {
            ApiState::Handshaking
        } else {
            ApiState::Ready
        }
    }

    fn progress(&self) -> Progress {
        Progress {
            state: self.api_state(),
            pending_output: self.outgoing.len().min(u32::MAX as usize) as u32,
            plaintext_available: self.plaintext.len().min(u32::MAX as usize) as u32,
        }
    }

    fn advance(&mut self) -> Result<(), TlsError> {
        loop {
            if self.failed || self.closed || !self.outgoing.is_empty() {
                return Ok(());
            }

            let mut extra_discard = 0usize;
            let mut stop = false;
            let mut error = None;

            {
                let status = self.conn.process_tls_records(self.incoming.as_mut_slice());
                let discard = status.discard;

                match status.state {
                    Err(_) => error = Some(classify_error()),
                    Ok(RustlsState::EncodeTlsData(mut encoder)) => {
                        let mut encoded = vec![0u8; 64 * 1024];
                        match encoder.encode(&mut encoded) {
                            Ok(written) => {
                                encoded.truncate(written);
                                if self.outgoing.len().saturating_add(encoded.len())
                                    > MAX_OUTPUT_BUFFER
                                {
                                    error = Some(TlsError::OutputTooLarge);
                                } else {
                                    self.outgoing.extend_from_slice(&encoded);
                                    stop = true;
                                }
                            }
                            Err(rustls::unbuffered::EncodeError::InsufficientSize(size)) => {
                                let mut encoded = vec![0u8; size.required_size];
                                match encoder.encode(&mut encoded) {
                                    Ok(written) => {
                                        encoded.truncate(written);
                                        if encoded.len() > MAX_OUTPUT_BUFFER {
                                            error = Some(TlsError::OutputTooLarge);
                                        } else {
                                            self.outgoing.extend_from_slice(&encoded);
                                            stop = true;
                                        }
                                    }
                                    Err(_) => error = Some(TlsError::CryptoFailure),
                                }
                            }
                            Err(_) => error = Some(TlsError::CryptoFailure),
                        }
                    }
                    Ok(RustlsState::TransmitTlsData(transmit)) => {
                        // We call advance only after the previously exposed ciphertext has
                        // been committed by the Host, so the transmit acknowledgement is exact.
                        transmit.done();
                    }
                    Ok(RustlsState::ReadTraffic(mut traffic)) => {
                        while let Some(record) = traffic.next_record() {
                            match record {
                                Ok(record) => {
                                    extra_discard = extra_discard.saturating_add(record.discard);
                                    if self.plaintext.len().saturating_add(record.payload.len())
                                        > MAX_PLAINTEXT_BUFFER
                                    {
                                        error = Some(TlsError::OutputTooLarge);
                                        break;
                                    }
                                    self.plaintext.extend(record.payload.iter().copied());
                                }
                                Err(_) => {
                                    error = Some(TlsError::CryptoFailure);
                                    break;
                                }
                            }
                        }
                    }
                    Ok(RustlsState::ReadEarlyData(mut traffic)) => {
                        while let Some(record) = traffic.next_record() {
                            match record {
                                Ok(record) => {
                                    extra_discard = extra_discard.saturating_add(record.discard);
                                    if self.plaintext.len().saturating_add(record.payload.len())
                                        > MAX_PLAINTEXT_BUFFER
                                    {
                                        error = Some(TlsError::OutputTooLarge);
                                        break;
                                    }
                                    self.plaintext.extend(record.payload.iter().copied());
                                }
                                Err(_) => {
                                    error = Some(TlsError::CryptoFailure);
                                    break;
                                }
                            }
                        }
                    }
                    Ok(RustlsState::WriteTraffic(mut traffic)) => {
                        if self.close_requested && !self.close_emitted {
                            let mut encoded = vec![0u8; 1024];
                            match traffic.queue_close_notify(&mut encoded) {
                                Ok(written) => {
                                    encoded.truncate(written);
                                    self.outgoing.extend_from_slice(&encoded);
                                    self.close_emitted = true;
                                    stop = true;
                                }
                                Err(_) => error = Some(TlsError::CryptoFailure),
                            }
                        } else if let Some(plaintext) = self.pending_write.take() {
                            let mut encoded = vec![0u8; plaintext.len().saturating_add(512)];
                            match traffic.encrypt(&plaintext, &mut encoded) {
                                Ok(written) => {
                                    encoded.truncate(written);
                                    if self.outgoing.len().saturating_add(encoded.len())
                                        > MAX_OUTPUT_BUFFER
                                    {
                                        error = Some(TlsError::OutputTooLarge);
                                    } else {
                                        self.accepted_write =
                                            plaintext.len().min(u32::MAX as usize) as u32;
                                        self.outgoing.extend_from_slice(&encoded);
                                        stop = true;
                                    }
                                }
                                Err(rustls::unbuffered::EncryptError::InsufficientSize(size)) => {
                                    let mut encoded = vec![0u8; size.required_size];
                                    match traffic.encrypt(&plaintext, &mut encoded) {
                                        Ok(written) => {
                                            encoded.truncate(written);
                                            self.accepted_write =
                                                plaintext.len().min(u32::MAX as usize) as u32;
                                            self.outgoing.extend_from_slice(&encoded);
                                            stop = true;
                                        }
                                        Err(_) => error = Some(TlsError::CryptoFailure),
                                    }
                                }
                                Err(_) => error = Some(TlsError::CryptoFailure),
                            }
                        } else {
                            stop = true;
                        }
                    }
                    Ok(RustlsState::BlockedHandshake) => stop = true,
                    Ok(RustlsState::PeerClosed) => {
                        self.peer_closed = true;
                        stop = true;
                    }
                    Ok(RustlsState::Closed) => {
                        self.closed = true;
                        stop = true;
                    }
                    _ => stop = true,
                }

                let total_discard = discard.saturating_add(extra_discard);
                if total_discard > self.incoming.len() {
                    error = Some(TlsError::CryptoFailure);
                } else if total_discard != 0 {
                    self.incoming.drain(..total_discard);
                }
            }

            if let Some(error) = error {
                self.failed = true;
                return Err(error);
            }
            if stop {
                return Ok(());
            }
        }
    }
}

impl Guest for Tls {
    type Session = Session;

    fn create(cert_chain: Vec<Vec<u8>>, private_key: Vec<u8>) -> Result<ApiSession, TlsError> {
        ENTROPY_FAILED.store(false, Ordering::Release);

        let cert_chain = cert_chain
            .into_iter()
            .map(CertificateDer::from)
            .collect::<Vec<_>>();
        if cert_chain.is_empty() {
            return Err(TlsError::InvalidConfig);
        }
        let private_key =
            PrivateKeyDer::try_from(private_key).map_err(|_| TlsError::InvalidConfig)?;
        let provider = Arc::new(rustls_rustcrypto::provider());
        let builder = ServerConfig::builder_with_details(provider, Arc::new(ServerOnlyTime))
            .with_safe_default_protocol_versions()
            .map_err(|_| classify_error())?;
        let mut config = builder
            .with_no_client_auth()
            .with_single_cert(cert_chain, private_key)
            .map_err(|_| classify_error())?;
        config.send_tls13_tickets = 0;
        let conn =
            UnbufferedServerConnection::new(Arc::new(config)).map_err(|_| classify_error())?;

        Ok(ApiSession::new(Session {
            inner: RefCell::new(Inner {
                conn,
                incoming: Vec::new(),
                outgoing: Vec::new(),
                plaintext: VecDeque::new(),
                pending_write: None,
                accepted_write: 0,
                close_requested: false,
                close_emitted: false,
                peer_closed: false,
                closed: false,
                failed: false,
            }),
        }))
    }
}

impl GuestSession for Session {
    fn state(&self) -> Progress {
        self.inner.borrow().progress()
    }

    fn ingest(&self, ciphertext: Vec<u8>) -> Result<u32, TlsError> {
        let accepted = u32::try_from(ciphertext.len()).map_err(|_| TlsError::InputTooLarge)?;
        let mut inner = self.inner.borrow_mut();
        if inner.incoming.len().saturating_add(ciphertext.len()) > MAX_CIPHERTEXT_BUFFER {
            return Err(TlsError::InputTooLarge);
        }
        inner.incoming.extend_from_slice(&ciphertext);
        inner.advance()?;
        Ok(accepted)
    }

    fn output(&self, limit: u32) -> Result<Vec<u8>, TlsError> {
        let inner = self.inner.borrow();
        let length = inner.outgoing.len().min(limit as usize);
        Ok(inner.outgoing[..length].to_vec())
    }

    fn commit_output(&self, transferred: u32) -> Result<(), TlsError> {
        let mut inner = self.inner.borrow_mut();
        let transferred = transferred as usize;
        if transferred > inner.outgoing.len() {
            return Err(TlsError::InvalidState);
        }
        inner.outgoing.drain(..transferred);
        if inner.outgoing.is_empty() {
            inner.advance()?;
        }
        Ok(())
    }

    fn write(&self, plaintext: Vec<u8>) -> Result<u32, TlsError> {
        if plaintext.len() > MAX_WRITE_BYTES {
            return Err(TlsError::InputTooLarge);
        }
        let mut inner = self.inner.borrow_mut();
        if inner.pending_write.is_some() || !inner.outgoing.is_empty() {
            return Err(TlsError::InvalidState);
        }
        inner.accepted_write = 0;
        inner.pending_write = Some(plaintext);
        inner.advance()?;
        if inner.accepted_write == 0 && inner.pending_write.is_some() {
            return Err(TlsError::InvalidState);
        }
        Ok(inner.accepted_write)
    }

    fn read(&self, limit: u32) -> Result<Vec<u8>, TlsError> {
        let mut inner = self.inner.borrow_mut();
        let length = inner.plaintext.len().min(limit as usize);
        Ok(inner.plaintext.drain(..length).collect())
    }

    fn close(&self) -> Result<(), TlsError> {
        let mut inner = self.inner.borrow_mut();
        inner.close_requested = true;
        if inner.outgoing.is_empty() {
            inner.advance()?;
        }
        Ok(())
    }
}

export!(Tls);
