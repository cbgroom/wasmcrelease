use anyhow::{anyhow, bail, Result};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::time_provider::TimeProvider;
use rustls::{ClientConfig, ClientConnection, RootCertStore};
use std::io::{Cursor, Read, Write};
use std::sync::Arc;
use std::time::Duration;
use wasmtime::component::{bindgen, Component, HasSelf, Linker, ResourceAny};
use wasmtime::{Engine, Store};

bindgen!({
    path: "../../wit",
    world: "tls-core",
});

#[derive(Default)]
struct Host {
    state: u64,
    entropy_calls: u64,
}

impl wasmc::tls_core::entropy::Host for Host {
    fn fill(&mut self, length: u32) -> Result<Vec<u8>, wasmc::tls_core::entropy::EntropyError> {
        self.entropy_calls += 1;
        let mut output = Vec::with_capacity(length as usize);
        for _ in 0..length {
            self.state ^= self.state << 13;
            self.state ^= self.state >> 7;
            self.state ^= self.state << 17;
            output.push((self.state >> 24) as u8);
        }
        Ok(output)
    }
}

#[derive(Debug)]
struct FixedTime(u64);

impl TimeProvider for FixedTime {
    fn current_time(&self) -> Option<UnixTime> {
        Some(UnixTime::since_unix_epoch(Duration::from_secs(self.0)))
    }
}

fn wt<T>(value: wasmtime::Result<T>) -> Result<T> {
    value.map_err(|error| anyhow!("{error:?}"))
}

fn tls_result<T>(
    value: wasmtime::Result<std::result::Result<T, exports::wasmc::tls_core::tls::TlsError>>,
) -> Result<T> {
    wt(value)?.map_err(|error| anyhow!("TLS candidate error: {error:?}"))
}

fn client_config(cert: &[u8]) -> Result<Arc<ClientConfig>> {
    let mut roots = RootCertStore::empty();
    roots
        .add(CertificateDer::from(cert.to_vec()))
        .map_err(|error| anyhow!("root certificate: {error:?}"))?;
    let provider = Arc::new(rustls_rustcrypto::provider());
    let config = ClientConfig::builder_with_details(provider, Arc::new(FixedTime(1_700_000_000)))
        .with_safe_default_protocol_versions()
        .map_err(|error| anyhow!("protocol versions: {error:?}"))?
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(Arc::new(config))
}

fn drain_client(client: &mut ClientConnection) -> Result<Vec<u8>> {
    let mut output = Vec::new();
    while client.wants_write() {
        let before = output.len();
        client.write_tls(&mut output)?;
        if output.len() == before {
            break;
        }
    }
    Ok(output)
}

fn ingest_client(client: &mut ClientConnection, ciphertext: &[u8]) -> Result<()> {
    if ciphertext.is_empty() {
        return Ok(());
    }
    let mut cursor = Cursor::new(ciphertext);
    while (cursor.position() as usize) < ciphertext.len() {
        let read = client.read_tls(&mut cursor)?;
        if read == 0 {
            bail!("client accepted zero TLS bytes");
        }
    }
    client
        .process_new_packets()
        .map_err(|error| anyhow!("client TLS: {error:?}"))?;
    Ok(())
}

fn flush_server(
    store: &mut Store<Host>,
    session_api: &exports::wasmc::tls_core::tls::GuestSession<'_>,
    session: ResourceAny,
    client: &mut ClientConnection,
) -> Result<usize> {
    let mut total = 0usize;
    loop {
        let output = tls_result(session_api.call_output(&mut *store, session, 64 * 1024))?;
        if output.is_empty() {
            break;
        }
        total += output.len();
        ingest_client(client, &output)?;
        tls_result(session_api.call_commit_output(&mut *store, session, output.len() as u32))?;
    }
    Ok(total)
}

fn main() -> Result<()> {
    let component_path = std::env::var("WASMC_TLS_COMPONENT")?;
    let cert_path = std::env::var("WASMC_TLS_CERT")?;
    let key_path = std::env::var("WASMC_TLS_KEY")?;

    let cert = std::fs::read(cert_path)?;
    let key = std::fs::read(key_path)?;

    let engine = Engine::default();
    let component = wt(Component::from_file(&engine, component_path))?;
    let mut linker = Linker::new(&engine);
    wt(TlsCore::add_to_linker::<_, HasSelf<_>>(
        &mut linker,
        |state| state,
    ))?;
    let mut store = Store::new(
        &engine,
        Host {
            state: 0x9e37_79b9_d1ce_beef,
            entropy_calls: 0,
        },
    );
    let bindings = wt(TlsCore::instantiate(&mut store, &component, &linker))?;
    let tls = bindings.wasmc_tls_core_tls();
    let session_api = tls.session();

    let chain = vec![cert.clone()];
    let session = tls_result(tls.call_create(&mut store, &chain, &key))?;

    let config = client_config(&cert)?;
    let server_name = ServerName::try_from("example.com")
        .map_err(|error| anyhow!("server name: {error:?}"))?
        .to_owned();
    let mut client = ClientConnection::new(config, server_name)?;

    let mut handshake_rounds = 0u32;
    let mut client_ciphertext = 0usize;
    let mut server_ciphertext = 0usize;
    let mut ready = false;

    for round in 0..64u32 {
        handshake_rounds = round + 1;
        let outbound = drain_client(&mut client)?;
        let mut progressed = false;
        if !outbound.is_empty() {
            client_ciphertext += outbound.len();
            let accepted = tls_result(session_api.call_ingest(&mut store, session, &outbound))?;
            if accepted as usize != outbound.len() {
                bail!(
                    "server accepted {accepted} of {} client TLS bytes",
                    outbound.len()
                );
            }
            progressed = true;
        }
        let server_bytes = flush_server(&mut store, &session_api, session, &mut client)?;
        if server_bytes != 0 {
            server_ciphertext += server_bytes;
            progressed = true;
        }

        let state = wt(session_api.call_state(&mut store, session))?;
        if !client.is_handshaking()
            && matches!(
                state.state,
                exports::wasmc::tls_core::tls::ConnectionState::Ready
            )
        {
            ready = true;
            break;
        }
        if !progressed {
            bail!(
                "TLS handshake stalled: client_handshaking={} server_state={:?}",
                client.is_handshaking(),
                state.state
            );
        }
    }
    if !ready {
        bail!("TLS handshake did not reach ready state");
    }

    client.writer().write_all(b"ping")?;
    let request_ciphertext = drain_client(&mut client)?;
    client_ciphertext += request_ciphertext.len();
    tls_result(session_api.call_ingest(&mut store, session, &request_ciphertext))?;
    let server_read = tls_result(session_api.call_read(&mut store, session, 4))?;
    if server_read != b"ping" {
        bail!("server plaintext mismatch: {server_read:?}");
    }

    let written = tls_result(session_api.call_write(&mut store, session, b"pong"))?;
    if written != 4 {
        bail!("server write accepted {written} bytes");
    }
    let reply_ciphertext = flush_server(&mut store, &session_api, session, &mut client)?;
    server_ciphertext += reply_ciphertext;

    let mut client_plaintext = [0u8; 4];
    let read = client.reader().read(&mut client_plaintext)?;
    if read != 4 || &client_plaintext != b"pong" {
        bail!("client plaintext mismatch: read={read} bytes={client_plaintext:?}");
    }

    tls_result(session_api.call_close(&mut store, session))?;
    let close_ciphertext = flush_server(&mut store, &session_api, session, &mut client)?;
    server_ciphertext += close_ciphertext;

    session
        .resource_drop(&mut store)
        .map_err(|error| anyhow!("{error:?}"))?;

    println!(
        "{{\"accepted\":true,\"handshake_rounds\":{},\"client_ciphertext\":{},\"server_ciphertext\":{},\"entropy_calls\":{},\"server_read\":\"ping\",\"client_read\":\"pong\",\"close_notify_bytes\":{},\"host_imports\":[\"entropy.fill\"]}}",
        handshake_rounds,
        client_ciphertext,
        server_ciphertext,
        store.data().entropy_calls,
        close_ciphertext,
    );

    Ok(())
}
