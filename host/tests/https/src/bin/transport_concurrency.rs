#[cfg(all(feature = "readiness-dedicated", feature = "reactor-candidate"))]
compile_error!("readiness-dedicated and reactor-candidate are mutually exclusive");
#[cfg(not(any(feature = "readiness-dedicated", feature = "reactor-candidate")))]
compile_error!("select readiness-dedicated or reactor-candidate");

#[path = "../host_transport_reactor.rs"]
mod host_transport;
#[path = "../readiness_owner.rs"]
mod readiness_owner;

use host_transport::{HostEndpoint, HostTransportMetrics, HostWindow, Terminal};
use std::{
    error::Error,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{Arc, Barrier},
    thread,
    time::{Duration, Instant},
};

const FRAME_BYTES: usize = 64;

fn write_all_host(
    endpoint: &mut HostEndpoint,
    bytes: &[u8],
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut offset = 0usize;
    while offset < bytes.len() {
        let remaining = &bytes[offset..];
        let mut window = HostWindow::acquire(remaining.len() as u32)?;
        window.commit(remaining, remaining.len() as u32)?;
        let mut operation = endpoint.write(&window)?;
        endpoint.wait(&[&operation])?;
        let Terminal::Transfer(transfer) = endpoint.take_result(&mut operation)? else {
            return Err("unexpected write terminal".into());
        };
        if transfer.transferred == 0 {
            return Err("zero-byte host write".into());
        }
        offset += transfer.transferred as usize;
    }
    Ok(())
}

fn read_exact_host(
    endpoint: &mut HostEndpoint,
    length: usize,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    let mut output = Vec::with_capacity(length);
    while output.len() < length {
        let remaining = length - output.len();
        let mut window = HostWindow::acquire(remaining as u32)?;
        let mut operation = endpoint.read(&mut window, remaining as u32)?;
        endpoint.wait(&[&operation])?;
        let Terminal::Transfer(transfer) = endpoint.take_result(&mut operation)? else {
            return Err("unexpected read terminal".into());
        };
        if transfer.eof || transfer.transferred == 0 {
            return Err("unexpected host EOF".into());
        }
        let bytes = window.copy_out();
        if bytes.len() != transfer.transferred as usize {
            return Err("HostWindow transfer length mismatch".into());
        }
        output.extend_from_slice(&bytes);
    }
    Ok(output)
}

fn peer_echo(
    mut stream: TcpStream,
    barrier: Arc<Barrier>,
    iterations: usize,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    barrier.wait();
    let mut frame = [0u8; FRAME_BYTES];
    for _ in 0..iterations {
        stream.read_exact(&mut frame)?;
        stream.write_all(&frame)?;
        stream.flush()?;
    }
    Ok(())
}

fn host_lane(
    mut endpoint: HostEndpoint,
    barrier: Arc<Barrier>,
    connection: usize,
    iterations: usize,
) -> Result<HostTransportMetrics, Box<dyn Error + Send + Sync>> {
    barrier.wait();
    let mut frame = [0u8; FRAME_BYTES];
    for iteration in 0..iterations {
        frame[0..8].copy_from_slice(&(connection as u64).to_le_bytes());
        frame[8..16].copy_from_slice(&(iteration as u64).to_le_bytes());
        for (index, byte) in frame[16..].iter_mut().enumerate() {
            *byte = (connection ^ iteration ^ index) as u8;
        }
        write_all_host(&mut endpoint, &frame)?;
        let echoed = read_exact_host(&mut endpoint, FRAME_BYTES)?;
        if echoed != frame {
            return Err("echo payload mismatch".into());
        }
    }
    let metrics = endpoint.metrics();
    endpoint.close_backend()?;
    Ok(metrics)
}

fn main() -> Result<(), Box<dyn Error>> {
    let connections = std::env::var("WASMC_HOST_CONCURRENCY")
        .ok()
        .map(|value| value.parse::<usize>())
        .transpose()?
        .unwrap_or(32);
    let iterations = std::env::var("WASMC_HOST_ITERATIONS")
        .ok()
        .map(|value| value.parse::<usize>())
        .transpose()?
        .unwrap_or(1000);
    if connections == 0 || connections > 256 || iterations == 0 {
        return Err("invalid concurrency workload bounds".into());
    }

    let listener = TcpListener::bind("127.0.0.1:0")?;
    let addr = listener.local_addr()?;
    let barrier = Arc::new(Barrier::new(connections * 2 + 1));
    let mut peers = Vec::with_capacity(connections);
    let mut hosts = Vec::with_capacity(connections);

    for connection in 0..connections {
        let peer_stream = TcpStream::connect(addr)?;
        let (host_stream, _) = listener.accept()?;
        peer_stream.set_nodelay(true)?;
        host_stream.set_nodelay(true)?;

        let endpoint = HostEndpoint::from_accepted_tcp_with_limits(
            host_stream,
            Duration::from_secs(5),
            usize::MAX,
            64,
        )?;

        let peer_barrier = barrier.clone();
        peers.push(thread::spawn(move || {
            peer_echo(peer_stream, peer_barrier, iterations)
        }));

        let host_barrier = barrier.clone();
        hosts.push(thread::spawn(move || {
            host_lane(endpoint, host_barrier, connection, iterations)
        }));
    }

    let started = Instant::now();
    barrier.wait();

    for peer in peers {
        peer.join()
            .map_err(|_| "peer thread panic")?
            .map_err(|error| std::io::Error::other(error.to_string()))?;
    }

    let mut operations = 0u64;
    let mut waits = 0u64;
    let mut claimed = 0u64;
    let mut owner_threads = 0u64;
    let mut owner_cycles = 0u64;
    let mut reactor_polls = 0u64;
    let mut reactor_events = 0u64;
    let mut pending_peak = 0u64;
    let mut placement_requested = 0u64;
    let mut placement_applied = 0u64;
    for host in hosts {
        let metrics = host
            .join()
            .map_err(|_| "host thread panic")?
            .map_err(|error| std::io::Error::other(error.to_string()))?;
        operations = operations.saturating_add(metrics.operations_issued);
        waits = waits.saturating_add(metrics.waits);
        claimed = claimed.saturating_add(metrics.results_claimed);
        owner_threads = owner_threads.saturating_add(metrics.owner_threads_started);
        owner_cycles = owner_cycles.saturating_add(metrics.owner_wake_cycles);
        reactor_polls = reactor_polls.max(metrics.reactor_poll_calls);
        reactor_events = reactor_events.max(metrics.reactor_readiness_events);
        pending_peak = pending_peak.max(metrics.pending_peak);
        placement_requested = placement_requested.saturating_add(metrics.placement_requested);
        placement_applied = placement_applied.saturating_add(metrics.placement_applied);
    }

    let elapsed = started.elapsed();
    let logical_transfers = (connections as u64)
        .saturating_mul(iterations as u64)
        .saturating_mul(2);
    if operations != waits || operations != claimed || operations < logical_transfers {
        return Err("Host lifecycle accounting mismatch".into());
    }

    println!(
        "{{\"accepted\":true,\"connections\":{},\"iterations\":{},\"frame_bytes\":{},\"elapsed_ns\":{},\"logical_transfers\":{},\"logical_transfers_per_sec\":{:.3},\"host_operations\":{},\"host_waits\":{},\"host_claimed\":{},\"host_pending_peak\":{},\"owner_threads_started\":{},\"owner_cycles\":{},\"reactor_poll_calls\":{},\"reactor_readiness_events\":{},\"placement_requested\":{},\"placement_applied\":{}}}",
        connections,
        iterations,
        FRAME_BYTES,
        elapsed.as_nanos(),
        logical_transfers,
        logical_transfers as f64 / elapsed.as_secs_f64(),
        operations,
        waits,
        claimed,
        pending_peak,
        owner_threads,
        owner_cycles,
        reactor_polls,
        reactor_events,
        placement_requested,
        placement_applied,
    );
    Ok(())
}
