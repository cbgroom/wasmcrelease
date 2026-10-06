use anyhow::{anyhow, bail, Context, Result};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, UnixTime};
use rustls::time_provider::TimeProvider;
use rustls::{ServerConfig, ServerConnection};
use std::io::{Cursor, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use wasmtime::component::{bindgen, Component, HasSelf, Linker, ResourceAny};
use wasmtime::{Engine, Store};

bindgen!({
    path: "../../../../libspec/wasmc-tls-client",
    world: "tls-client",
});

const FIXED_TIME: u64 = 1_700_000_000;
const RESPONSE: &[u8] = b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok";

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
struct FixedTime;

impl TimeProvider for FixedTime {
    fn current_time(&self) -> Option<UnixTime> {
        Some(UnixTime::since_unix_epoch(Duration::from_secs(FIXED_TIME)))
    }
}

fn wt<T>(value: wasmtime::Result<T>) -> Result<T> {
    value.map_err(|error| anyhow!("{error:?}"))
}

fn tls_result<T>(
    value: wasmtime::Result<std::result::Result<T, exports::wasmc::tls_client::tls::TlsError>>,
) -> Result<T> {
    wt(value)?.map_err(|error| anyhow!("TLS client candidate error: {error:?}"))
}

fn server_config(cert: &[u8], key: &[u8]) -> Result<Arc<ServerConfig>> {
    let provider = Arc::new(rustls_rustcrypto::provider());
    let builder = ServerConfig::builder_with_details(provider, Arc::new(FixedTime))
        .with_safe_default_protocol_versions()
        .map_err(|error| anyhow!("protocol versions: {error:?}"))?;
    let key =
        PrivateKeyDer::try_from(key.to_vec()).map_err(|error| anyhow!("private key: {error:?}"))?;
    let mut config = builder
        .with_no_client_auth()
        .with_single_cert(vec![CertificateDer::from(cert.to_vec())], key)
        .map_err(|error| anyhow!("server certificate: {error:?}"))?;
    config.send_tls13_tickets = 0;
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(Arc::new(config))
}

fn ingest_server(server: &mut ServerConnection, ciphertext: &[u8]) -> Result<()> {
    let mut cursor = Cursor::new(ciphertext);
    while (cursor.position() as usize) < ciphertext.len() {
        let read = server.read_tls(&mut cursor)?;
        if read == 0 {
            bail!("server accepted zero TLS bytes");
        }
    }
    server
        .process_new_packets()
        .map_err(|error| anyhow!("server TLS: {error:?}"))?;
    Ok(())
}

fn drain_server(server: &mut ServerConnection) -> Result<Vec<u8>> {
    let mut output = Vec::new();
    while server.wants_write() {
        let before = output.len();
        server.write_tls(&mut output)?;
        if output.len() == before {
            break;
        }
    }
    Ok(output)
}

fn flush_client(
    store: &mut Store<Host>,
    session_api: &exports::wasmc::tls_client::tls::GuestSession<'_>,
    session: ResourceAny,
    server: &mut ServerConnection,
) -> Result<usize> {
    let mut total = 0usize;
    loop {
        let output = tls_result(session_api.call_output(&mut *store, session, 64 * 1024))?;
        if output.is_empty() {
            break;
        }
        total += output.len();
        ingest_server(server, &output)?;
        tls_result(session_api.call_commit_output(&mut *store, session, output.len() as u32))?;
    }
    Ok(total)
}

fn main() -> Result<()> {
    let component_path = std::env::var("WASMC_TLS_CLIENT_COMPONENT")?;
    let cert = std::fs::read(std::env::var("WASMC_TLS_CERT")?)?;
    let key = std::fs::read(std::env::var("WASMC_TLS_KEY")?)?;
    let request = std::fs::read(std::env::var("WASMC_TLS_HTTP_REQUEST")?)?;

    let engine = Engine::default();
    let component = wt(Component::from_file(&engine, component_path))?;
    let mut linker = Linker::new(&engine);
    wt(TlsClient::add_to_linker::<_, HasSelf<_>>(
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
    let bindings = wt(TlsClient::instantiate(&mut store, &component, &linker))?;
    let tls = bindings.wasmc_tls_client_tls();
    let session_api = tls.session();
    let roots = vec![cert.clone()];
    let alpn = vec![b"http/1.1".to_vec()];
    let session =
        tls_result(tls.call_create(&mut store, "example.com", &roots, FIXED_TIME, &alpn))?;
    let mut server = ServerConnection::new(server_config(&cert, &key)?)?;

    let mut handshake_rounds = 0u32;
    let mut client_ciphertext = 0usize;
    let mut server_ciphertext = 0usize;
    let mut ready = false;
    for round in 0..64u32 {
        handshake_rounds = round + 1;
        let sent = flush_client(&mut store, &session_api, session, &mut server)?;
        client_ciphertext += sent;
        let reply = drain_server(&mut server)?;
        if !reply.is_empty() {
            server_ciphertext += reply.len();
            let accepted = tls_result(session_api.call_ingest(&mut store, session, &reply))?;
            if accepted as usize != reply.len() {
                bail!("client accepted {accepted} of {} TLS bytes", reply.len());
            }
        }
        let state = wt(session_api.call_state(&mut store, session))?;
        if !server.is_handshaking()
            && matches!(
                state.state,
                exports::wasmc::tls_client::tls::ConnectionState::Ready
            )
        {
            ready = true;
            break;
        }
        if sent == 0 && reply.is_empty() {
            bail!("TLS client handshake stalled at state {:?}", state.state);
        }
    }
    if !ready {
        bail!("TLS client handshake did not reach ready state");
    }
    if server.alpn_protocol() != Some(b"http/1.1".as_slice()) {
        bail!("HTTP/1.1 ALPN was not negotiated");
    }

    let written = tls_result(session_api.call_write(&mut store, session, &request))?;
    if written as usize != request.len() {
        bail!("client accepted {written} of {} HTTP bytes", request.len());
    }
    client_ciphertext += flush_client(&mut store, &session_api, session, &mut server)?;
    let mut server_plaintext = vec![0; request.len()];
    server
        .reader()
        .read_exact(&mut server_plaintext)
        .context("read client HTTP request")?;
    if server_plaintext != request {
        bail!("server received different HTTP request");
    }

    server.writer().write_all(RESPONSE)?;
    let encrypted_response = drain_server(&mut server)?;
    server_ciphertext += encrypted_response.len();
    tls_result(session_api.call_ingest(&mut store, session, &encrypted_response))?;
    let client_plaintext =
        tls_result(session_api.call_read(&mut store, session, RESPONSE.len() as u32))?;
    if client_plaintext != RESPONSE {
        bail!("client HTTP response plaintext mismatch");
    }

    tls_result(session_api.call_close(&mut store, session))?;
    let close_notify_bytes = flush_client(&mut store, &session_api, session, &mut server)?;
    session
        .resource_drop(&mut store)
        .map_err(|error| anyhow!("{error:?}"))?;

    // Prove that the supplied trust root does not disable hostname validation.
    let bad_session =
        tls_result(tls.call_create(&mut store, "wrong.example", &roots, FIXED_TIME, &alpn))?;
    let mut bad_server = ServerConnection::new(server_config(&cert, &key)?)?;
    let mut hostname_rejected = false;
    for _ in 0..64 {
        let output = tls_result(session_api.call_output(&mut store, bad_session, 64 * 1024))?;
        let mut progressed = false;
        if !output.is_empty() {
            ingest_server(&mut bad_server, &output)?;
            progressed = true;
            match wt(session_api.call_commit_output(&mut store, bad_session, output.len() as u32))?
            {
                Ok(()) => {}
                Err(exports::wasmc::tls_client::tls::TlsError::CryptoFailure) => {
                    hostname_rejected = true;
                    break;
                }
                Err(error) => bail!("unexpected wrong-name commit error: {error:?}"),
            }
        }
        let reply = drain_server(&mut bad_server)?;
        if !reply.is_empty() {
            progressed = true;
            match wt(session_api.call_ingest(&mut store, bad_session, &reply))? {
                Ok(_) => {}
                Err(exports::wasmc::tls_client::tls::TlsError::CryptoFailure) => {
                    hostname_rejected = true;
                    break;
                }
                Err(error) => bail!("unexpected wrong-name ingest error: {error:?}"),
            }
        }
        if !progressed {
            break;
        }
    }
    bad_session
        .resource_drop(&mut store)
        .map_err(|error| anyhow!("{error:?}"))?;
    if !hostname_rejected {
        bail!("wrong server name was not rejected");
    }

    let maximum_roots = vec![cert.clone(); 256];
    let maximum_roots_session =
        tls_result(tls.call_create(&mut store, "example.com", &maximum_roots, FIXED_TIME, &alpn))?;
    maximum_roots_session
        .resource_drop(&mut store)
        .map_err(|error| anyhow!("{error:?}"))?;
    let excessive_roots = vec![cert.clone(); 257];
    match wt(tls.call_create(
        &mut store,
        "example.com",
        &excessive_roots,
        FIXED_TIME,
        &alpn,
    ))? {
        Err(exports::wasmc::tls_client::tls::TlsError::InvalidConfig) => {}
        Ok(session) => {
            session
                .resource_drop(&mut store)
                .map_err(|error| anyhow!("{error:?}"))?;
            bail!("TLS client accepted 257 root certificates");
        }
        Err(error) => bail!("unexpected excessive-roots error: {error:?}"),
    }

    // Exercise the same component through a real OS TCP stream. This proves a
    // transport composition without putting socket semantics into the TLS Lib.
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let loopback_port = listener.local_addr()?.port();
    let loopback_config = server_config(&cert, &key)?;
    let expected_request = request.clone();
    let server_thread = thread::spawn(move || -> Result<()> {
        let (socket, _) = listener.accept()?;
        socket.set_read_timeout(Some(Duration::from_secs(5)))?;
        socket.set_write_timeout(Some(Duration::from_secs(5)))?;
        let connection = ServerConnection::new(loopback_config)?;
        let mut stream = rustls::StreamOwned::new(connection, socket);
        let mut received = vec![0; expected_request.len()];
        stream.read_exact(&mut received)?;
        if received != expected_request {
            bail!("loopback server received different HTTP request");
        }
        stream.write_all(RESPONSE)?;
        stream.flush()?;
        Ok(())
    });

    let loopback_session =
        tls_result(tls.call_create(&mut store, "example.com", &roots, FIXED_TIME, &alpn))?;
    let mut socket = TcpStream::connect(("127.0.0.1", loopback_port))?;
    socket.set_read_timeout(Some(Duration::from_secs(5)))?;
    socket.set_write_timeout(Some(Duration::from_secs(5)))?;
    let mut loopback_tls_bytes = 0usize;
    for _ in 0..64 {
        let output = tls_result(session_api.call_output(&mut store, loopback_session, 64 * 1024))?;
        if !output.is_empty() {
            socket.write_all(&output)?;
            socket.flush()?;
            loopback_tls_bytes += output.len();
            tls_result(session_api.call_commit_output(
                &mut store,
                loopback_session,
                output.len() as u32,
            ))?;
        }
        let state = wt(session_api.call_state(&mut store, loopback_session))?;
        if matches!(
            state.state,
            exports::wasmc::tls_client::tls::ConnectionState::Ready
        ) {
            if state.pending_output == 0 {
                break;
            }
            continue;
        }
        let mut incoming = vec![0; 64 * 1024];
        let count = socket.read(&mut incoming)?;
        if count == 0 {
            bail!("loopback TLS peer closed during handshake");
        }
        loopback_tls_bytes += count;
        tls_result(session_api.call_ingest(&mut store, loopback_session, &incoming[..count]))?;
    }
    let loopback_state = wt(session_api.call_state(&mut store, loopback_session))?;
    if !matches!(
        loopback_state.state,
        exports::wasmc::tls_client::tls::ConnectionState::Ready
    ) || loopback_state.pending_output != 0
    {
        bail!("loopback TLS client did not reach ready state");
    }
    tls_result(session_api.call_write(&mut store, loopback_session, &request))
        .context("loopback client write")?;
    loop {
        let output = tls_result(session_api.call_output(&mut store, loopback_session, 64 * 1024))?;
        if output.is_empty() {
            break;
        }
        socket.write_all(&output)?;
        socket.flush()?;
        loopback_tls_bytes += output.len();
        tls_result(session_api.call_commit_output(
            &mut store,
            loopback_session,
            output.len() as u32,
        ))?;
    }
    let mut loopback_plaintext = Vec::new();
    while loopback_plaintext.len() < RESPONSE.len() {
        let mut incoming = vec![0; 64 * 1024];
        let count = socket.read(&mut incoming)?;
        if count == 0 {
            bail!("loopback HTTPS peer closed before response");
        }
        loopback_tls_bytes += count;
        tls_result(session_api.call_ingest(&mut store, loopback_session, &incoming[..count]))?;
        let chunk =
            tls_result(session_api.call_read(&mut store, loopback_session, RESPONSE.len() as u32))?;
        loopback_plaintext.extend_from_slice(&chunk);
    }
    if loopback_plaintext != RESPONSE {
        bail!("loopback HTTPS response mismatch");
    }
    std::fs::write(
        std::env::var("WASMC_TLS_HTTP_RESPONSE_OUTPUT")?,
        &loopback_plaintext,
    )?;
    loopback_session
        .resource_drop(&mut store)
        .map_err(|error| anyhow!("{error:?}"))?;
    server_thread
        .join()
        .map_err(|_| anyhow!("loopback HTTPS server thread panicked"))??;

    let mut public_ca_https = false;
    let mut public_ca_roots = 0usize;
    let mut public_ca_response_bytes = 0usize;
    if let Ok(bundle_path) = std::env::var("WASMC_TLS_PUBLIC_CA_BUNDLE") {
        let bundle = std::fs::read(&bundle_path)
            .with_context(|| format!("read public CA bundle {bundle_path}"))?;
        let mut cursor = Cursor::new(bundle);
        let public_roots = rustls_pemfile::certs(&mut cursor)
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("parse public CA bundle")?;
        public_ca_roots = public_roots.len();
        if public_ca_roots == 0 {
            bail!("public CA bundle contained no certificates");
        }
        let public_host = std::env::var("WASMC_TLS_PUBLIC_HOST")?;
        let public_port = std::env::var("WASMC_TLS_PUBLIC_PORT")
            .unwrap_or_else(|_| "443".to_owned())
            .parse::<u16>()
            .context("parse public HTTPS port")?;
        let public_time = std::env::var("WASMC_TLS_PUBLIC_UNIX_TIME")?
            .parse::<u64>()
            .context("parse public HTTPS Unix time")?;
        let public_roots = public_roots
            .into_iter()
            .map(|cert| cert.as_ref().to_vec())
            .collect::<Vec<_>>();
        let public_session = tls_result(tls.call_create(
            &mut store,
            &public_host,
            &public_roots,
            public_time,
            &alpn,
        ))?;
        let mut public_socket = TcpStream::connect((public_host.as_str(), public_port))?;
        public_socket.set_read_timeout(Some(Duration::from_secs(8)))?;
        public_socket.set_write_timeout(Some(Duration::from_secs(8)))?;
        let mut public_ready = false;
        for _ in 0..64 {
            loop {
                let output =
                    tls_result(session_api.call_output(&mut store, public_session, 64 * 1024))?;
                if output.is_empty() {
                    break;
                }
                public_socket.write_all(&output)?;
                public_socket.flush()?;
                tls_result(session_api.call_commit_output(
                    &mut store,
                    public_session,
                    output.len() as u32,
                ))?;
            }
            let state = wt(session_api.call_state(&mut store, public_session))?;
            if matches!(
                state.state,
                exports::wasmc::tls_client::tls::ConnectionState::Ready
            ) && state.pending_output == 0
            {
                public_ready = true;
                break;
            }
            let mut incoming = vec![0; 64 * 1024];
            let count = public_socket.read(&mut incoming)?;
            if count == 0 {
                bail!("public HTTPS peer closed during TLS handshake");
            }
            tls_result(session_api.call_ingest(&mut store, public_session, &incoming[..count]))?;
        }
        if !public_ready {
            bail!("public HTTPS TLS client did not reach ready state");
        }
        let public_request =
            format!("GET / HTTP/1.1\r\nHost: {public_host}\r\nConnection: close\r\n\r\n");
        let accepted = tls_result(session_api.call_write(
            &mut store,
            public_session,
            public_request.as_bytes(),
        ))?;
        if accepted as usize != public_request.len() {
            bail!("public HTTPS request was only partially accepted");
        }
        loop {
            let output =
                tls_result(session_api.call_output(&mut store, public_session, 64 * 1024))?;
            if output.is_empty() {
                break;
            }
            public_socket.write_all(&output)?;
            public_socket.flush()?;
            tls_result(session_api.call_commit_output(
                &mut store,
                public_session,
                output.len() as u32,
            ))?;
        }
        let mut public_plaintext = Vec::new();
        for _ in 0..64 {
            let chunk = tls_result(session_api.call_read(&mut store, public_session, 64 * 1024))?;
            public_plaintext.extend_from_slice(&chunk);
            if public_plaintext
                .windows(4)
                .any(|window| window == b"\r\n\r\n")
            {
                break;
            }
            let mut incoming = vec![0; 64 * 1024];
            let count = public_socket.read(&mut incoming)?;
            if count == 0 {
                break;
            }
            match wt(session_api.call_ingest(&mut store, public_session, &incoming[..count]))? {
                Ok(_) => {}
                Err(exports::wasmc::tls_client::tls::TlsError::CryptoFailure)
                    if !public_plaintext.is_empty() =>
                {
                    break;
                }
                Err(error) => bail!("public HTTPS ingest failed: {error:?}"),
            }
        }
        if !public_plaintext.starts_with(b"HTTP/1.1 ")
            && !public_plaintext.starts_with(b"HTTP/1.0 ")
        {
            bail!(
                "public HTTPS response did not contain an HTTP status line: {}",
                String::from_utf8_lossy(&public_plaintext)
            );
        }
        public_ca_response_bytes = public_plaintext.len();
        public_ca_https = true;
        public_session
            .resource_drop(&mut store)
            .map_err(|error| anyhow!("{error:?}"))?;
    }

    println!(
        "{{\"accepted\":true,\"handshake_rounds\":{},\"client_ciphertext\":{},\"server_ciphertext\":{},\"entropy_calls\":{},\"http_request_bytes\":{},\"http_response_bytes\":{},\"alpn\":\"http/1.1\",\"hostname_rejected\":true,\"root_boundary\":{{\"accepted\":256,\"rejected\":257}},\"close_notify_bytes\":{},\"loopback_https\":true,\"loopback_tls_bytes\":{},\"public_ca_https\":{},\"public_ca_roots\":{},\"public_ca_response_bytes\":{},\"host_imports\":[\"wasmc:tls-core/entropy@0.0.1#fill\"]}}",
        handshake_rounds,
        client_ciphertext,
        server_ciphertext,
        store.data().entropy_calls,
        request.len(),
        RESPONSE.len(),
        close_notify_bytes,
        loopback_tls_bytes,
        public_ca_https,
        public_ca_roots,
        public_ca_response_bytes,
    );
    Ok(())
}
