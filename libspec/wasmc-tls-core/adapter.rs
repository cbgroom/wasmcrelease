use crate::delta;
use crate::exports::wasmc::tls_core::tls as api;
use crate::wasmc::tls_core::entropy;
use getrandom::{register_custom_getrandom,Error as RandomError};
use std::num::NonZeroU32;
use std::sync::atomic::Ordering;
pub struct Adapter;
pub struct Resource(delta::Session);
fn custom_random(dest: &mut [u8]) -> Result<(), RandomError> {
    let length = u32::try_from(dest.len()).map_err(|_| custom_random_error())?;
    match entropy::fill(length) {
        Ok(bytes) if bytes.len() == dest.len() => {
            dest.copy_from_slice(&bytes);
            Ok(())
        }
        _ => {
            delta::ENTROPY_FAILED.store(true, Ordering::Release);
            Err(custom_random_error())
        }
    }
}

fn custom_random_error() -> RandomError {
    RandomError::from(NonZeroU32::new(RandomError::CUSTOM_START).unwrap())
}

register_custom_getrandom!(custom_random);

fn error(v: delta::Error) -> api::TlsError { match v {
    delta::Error::InvalidConfig => api::TlsError::InvalidConfig,
    delta::Error::InvalidState => api::TlsError::InvalidState,
    delta::Error::InputTooLarge => api::TlsError::InputTooLarge,
    delta::Error::OutputTooLarge => api::TlsError::OutputTooLarge,
    delta::Error::CryptoFailure => api::TlsError::CryptoFailure,
    delta::Error::EntropyFailure => api::TlsError::EntropyFailure,
} }
fn state(v: delta::State) -> api::ConnectionState { match v {
    delta::State::Handshaking => api::ConnectionState::Handshaking,
    delta::State::Ready => api::ConnectionState::Ready,
    delta::State::Closing => api::ConnectionState::Closing,
    delta::State::PeerClosed => api::ConnectionState::PeerClosed,
    delta::State::Closed => api::ConnectionState::Closed,
    delta::State::Failed => api::ConnectionState::Failed,
} }
fn progress(v:delta::Progress)->api::Progress { api::Progress{state:state(v.state),pending_output:v.pending_output,plaintext_available:v.plaintext_available} }
impl api::Guest for Adapter { type Session=Resource;
 fn create(cert_chain:Vec<Vec<u8>>, private_key:Vec<u8>)->Result<api::Session,api::TlsError>{delta::create(cert_chain,private_key).map(|s|api::Session::new(Resource(s))).map_err(error)}
}
impl api::GuestSession for Resource {
 fn state(&self)->api::Progress{progress(self.0.state())}
 fn ingest(&self,ciphertext:Vec<u8>)->Result<u32,api::TlsError>{self.0.ingest(ciphertext).map_err(error)}
 fn output(&self,limit:u32)->Result<Vec<u8>,api::TlsError>{self.0.output(limit).map_err(error)}
 fn commit_output(&self,transferred:u32)->Result<(),api::TlsError>{self.0.commit_output(transferred).map_err(error)}
 fn write(&self,plaintext:Vec<u8>)->Result<u32,api::TlsError>{self.0.write(plaintext).map_err(error)}
 fn read(&self,limit:u32)->Result<Vec<u8>,api::TlsError>{self.0.read(limit).map_err(error)}
 fn close(&self)->Result<(),api::TlsError>{self.0.close().map_err(error)}
}
