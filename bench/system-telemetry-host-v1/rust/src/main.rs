use std::collections::VecDeque;
#[cfg(target_os = "linux")]
use std::fs::File;
#[cfg(target_os = "linux")]
use std::io::{Read, Seek, SeekFrom};
use std::process::Command;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Condvar, Mutex,
};
use std::thread;
use std::time::{Duration, Instant};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, Networks, RefreshKind, System};

const FRAME_BYTES: usize = 64;
const SELECTOR: &[u8] = b"system/telemetry";

#[derive(Clone, Copy, Debug)]
struct Frame {
    sequence: u64,
    monotonic_ns: u64,
    total_memory: u64,
    available_memory: u64,
    used_swap: u64,
    network_rx_total: u64,
    network_tx_total: u64,
    cpu_milli_pct: u32,
    load1_milli: u32,
}

impl Frame {
    fn encode_into(self, out: &mut [u8]) {
        assert!(out.len() >= FRAME_BYTES);
        let mut offset = 0usize;
        for value in [
            self.sequence,
            self.monotonic_ns,
            self.total_memory,
            self.available_memory,
            self.used_swap,
            self.network_rx_total,
            self.network_tx_total,
        ] {
            out[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
            offset += 8;
        }
        out[offset..offset + 4].copy_from_slice(&self.cpu_milli_pct.to_le_bytes());
        offset += 4;
        out[offset..offset + 4].copy_from_slice(&self.load1_milli.to_le_bytes());
    }

    fn synthetic(sequence: u64, epoch: Instant) -> Self {
        Self {
            sequence,
            monotonic_ns: epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            total_memory: 64u64 << 30,
            available_memory: (32u64 << 30).saturating_sub(sequence & 0xffff),
            used_swap: sequence & 0x3fff,
            network_rx_total: sequence.saturating_mul(128),
            network_tx_total: sequence.saturating_mul(96),
            cpu_milli_pct: (sequence % 100_000) as u32,
            load1_milli: (sequence % 8_000) as u32,
        }
    }
}

struct SysinfoSampler {
    system: System,
    networks: Networks,
    epoch: Instant,
    sequence: u64,
}

#[cfg(target_os = "linux")]
struct LinuxProcSampler {
    stat: File,
    meminfo: File,
    netdev: File,
    loadavg: File,
    stat_buf: String,
    mem_buf: String,
    net_buf: String,
    load_buf: String,
    epoch: Instant,
    sequence: u64,
    last_cpu_total: u64,
    last_cpu_idle: u64,
    last_cpu_milli_pct: u32,
}

#[cfg(target_os = "linux")]
impl LinuxProcSampler {
    fn new() -> std::io::Result<Self> {
        let mut sampler = Self {
            stat: File::open("/proc/stat")?,
            meminfo: File::open("/proc/meminfo")?,
            netdev: File::open("/proc/net/dev")?,
            loadavg: File::open("/proc/loadavg")?,
            stat_buf: String::with_capacity(4096),
            mem_buf: String::with_capacity(4096),
            net_buf: String::with_capacity(8192),
            load_buf: String::with_capacity(256),
            epoch: Instant::now(),
            sequence: 0,
            last_cpu_total: 0,
            last_cpu_idle: 0,
            last_cpu_milli_pct: 0,
        };
        sampler.refresh_cpu_baseline()?;
        Ok(sampler)
    }

    fn reread(file: &mut File, buffer: &mut String) -> std::io::Result<()> {
        file.seek(SeekFrom::Start(0))?;
        buffer.clear();
        file.read_to_string(buffer)?;
        Ok(())
    }

    fn cpu_counters(input: &str) -> Option<(u64, u64)> {
        let line = input.lines().find(|line| line.starts_with("cpu "))?;
        let fields = line
            .split_whitespace()
            .skip(1)
            .take(8)
            .map(str::parse::<u64>)
            .collect::<Result<Vec<_>, _>>()
            .ok()?;
        if fields.len() < 4 {
            return None;
        }
        let total = fields.iter().copied().sum::<u64>();
        let idle = fields[3].saturating_add(fields.get(4).copied().unwrap_or(0));
        Some((total, idle))
    }

    fn memory_bytes(input: &str) -> Option<(u64, u64, u64)> {
        let mut total = None;
        let mut available = None;
        let mut swap_total = None;
        let mut swap_free = None;
        for line in input.lines() {
            let mut fields = line.split_whitespace();
            let key = fields.next()?;
            let value = fields.next()?.parse::<u64>().ok()?.saturating_mul(1024);
            match key {
                "MemTotal:" => total = Some(value),
                "MemAvailable:" => available = Some(value),
                "SwapTotal:" => swap_total = Some(value),
                "SwapFree:" => swap_free = Some(value),
                _ => {}
            }
            if total.is_some() && available.is_some() && swap_total.is_some() && swap_free.is_some()
            {
                break;
            }
        }
        Some((total?, available?, swap_total?.saturating_sub(swap_free?)))
    }

    fn network_totals(input: &str) -> Option<(u64, u64)> {
        let mut rx = 0u64;
        let mut tx = 0u64;
        for line in input.lines().skip(2) {
            let (name, counters) = line.split_once(':')?;
            if name.trim() == "lo" {
                continue;
            }
            let fields = counters.split_whitespace().collect::<Vec<_>>();
            if fields.len() < 9 {
                return None;
            }
            rx = rx.saturating_add(fields[0].parse::<u64>().ok()?);
            tx = tx.saturating_add(fields[8].parse::<u64>().ok()?);
        }
        Some((rx, tx))
    }

    fn refresh_cpu_baseline(&mut self) -> std::io::Result<()> {
        Self::reread(&mut self.stat, &mut self.stat_buf)?;
        let (total, idle) = Self::cpu_counters(&self.stat_buf)
            .ok_or_else(|| std::io::Error::other("invalid /proc/stat"))?;
        self.last_cpu_total = total;
        self.last_cpu_idle = idle;
        Ok(())
    }

    fn sample(&mut self) -> std::io::Result<Frame> {
        Self::reread(&mut self.stat, &mut self.stat_buf)?;
        Self::reread(&mut self.meminfo, &mut self.mem_buf)?;
        Self::reread(&mut self.netdev, &mut self.net_buf)?;
        Self::reread(&mut self.loadavg, &mut self.load_buf)?;

        let (cpu_total, cpu_idle) = Self::cpu_counters(&self.stat_buf)
            .ok_or_else(|| std::io::Error::other("invalid /proc/stat"))?;
        let total_delta = cpu_total.saturating_sub(self.last_cpu_total);
        let idle_delta = cpu_idle.saturating_sub(self.last_cpu_idle);
        if total_delta != 0 {
            let busy_delta = total_delta.saturating_sub(idle_delta);
            self.last_cpu_milli_pct =
                ((busy_delta as u128 * 100_000u128) / total_delta as u128) as u32;
        }
        self.last_cpu_total = cpu_total;
        self.last_cpu_idle = cpu_idle;

        let (total_memory, available_memory, used_swap) = Self::memory_bytes(&self.mem_buf)
            .ok_or_else(|| std::io::Error::other("invalid /proc/meminfo"))?;
        let (network_rx_total, network_tx_total) = Self::network_totals(&self.net_buf)
            .ok_or_else(|| std::io::Error::other("invalid /proc/net/dev"))?;
        let load1_milli = self
            .load_buf
            .split_whitespace()
            .next()
            .and_then(|value| value.parse::<f64>().ok())
            .map(|value| (value.max(0.0) * 1000.0).min(u32::MAX as f64) as u32)
            .ok_or_else(|| std::io::Error::other("invalid /proc/loadavg"))?;

        self.sequence = self.sequence.saturating_add(1);
        Ok(Frame {
            sequence: self.sequence,
            monotonic_ns: self.epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            total_memory,
            available_memory,
            used_swap,
            network_rx_total,
            network_tx_total,
            cpu_milli_pct: self.last_cpu_milli_pct,
            load1_milli,
        })
    }
}

impl SysinfoSampler {
    fn new() -> Self {
        let refresh = RefreshKind::nothing()
            .with_memory(MemoryRefreshKind::everything())
            .with_cpu(CpuRefreshKind::nothing().with_cpu_usage());
        let mut system = System::new_with_specifics(refresh);
        let mut networks = Networks::new_with_refreshed_list();
        system.refresh_memory();
        system.refresh_cpu_usage();
        networks.refresh(false);
        Self {
            system,
            networks,
            epoch: Instant::now(),
            sequence: 0,
        }
    }

    fn sample(&mut self) -> Frame {
        self.system.refresh_memory();
        self.system.refresh_cpu_usage();
        self.networks.refresh(false);
        let (network_rx_total, network_tx_total) =
            self.networks
                .iter()
                .fold((0u64, 0u64), |(rx, tx), (_, data)| {
                    (
                        rx.saturating_add(data.total_received()),
                        tx.saturating_add(data.total_transmitted()),
                    )
                });
        self.sequence = self.sequence.saturating_add(1);
        let load = System::load_average().one;
        Frame {
            sequence: self.sequence,
            monotonic_ns: self.epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            total_memory: self.system.total_memory(),
            available_memory: self.system.available_memory(),
            used_swap: self.system.used_swap(),
            network_rx_total,
            network_tx_total,
            cpu_milli_pct: (self.system.global_cpu_usage().max(0.0) * 1000.0).min(u32::MAX as f32)
                as u32,
            load1_milli: (load.max(0.0) * 1000.0).min(u32::MAX as f64) as u32,
        }
    }
}

#[derive(Default)]
struct RingState {
    frames: VecDeque<Frame>,
    dropped: u64,
    closed: bool,
}

struct Ring {
    state: Mutex<RingState>,
    ready: Condvar,
    capacity: usize,
}

impl Ring {
    fn new(capacity: usize) -> Self {
        assert!(capacity > 0);
        Self {
            state: Mutex::new(RingState::default()),
            ready: Condvar::new(),
            capacity,
        }
    }

    fn push(&self, frame: Frame) {
        let mut state = self.state.lock().expect("ring poisoned");
        if state.frames.len() == self.capacity {
            state.frames.pop_front();
            state.dropped = state.dropped.saturating_add(1);
        }
        state.frames.push_back(frame);
        self.ready.notify_one();
    }

    fn close(&self) {
        let mut state = self.state.lock().expect("ring poisoned");
        state.closed = true;
        self.ready.notify_all();
    }

    fn try_drain(&self, max: usize) -> Vec<Frame> {
        let mut state = self.state.lock().expect("ring poisoned");
        let count = max.min(state.frames.len());
        state.frames.drain(..count).collect()
    }

    fn wait_drain(&self, max: usize, timeout: Duration) -> Vec<Frame> {
        let state = self.state.lock().expect("ring poisoned");
        let (mut state, _) = self
            .ready
            .wait_timeout_while(state, timeout, |s| s.frames.is_empty() && !s.closed)
            .expect("ring poisoned");
        let count = max.min(state.frames.len());
        state.frames.drain(..count).collect()
    }

    fn stats(&self) -> (usize, u64, bool) {
        let state = self.state.lock().expect("ring poisoned");
        (state.frames.len(), state.dropped, state.closed)
    }
}

struct Endpoint {
    ring: Arc<Ring>,
    released: bool,
}

struct Window {
    bytes: Vec<u8>,
    valid: usize,
    released: bool,
}

struct Operation {
    max_frames: usize,
    cancelled: bool,
    released: bool,
}

enum Submission {
    Completed(usize),
    Pending(Operation),
}

#[derive(Default)]
struct HostMetrics {
    open_calls: AtomicU64,
    read_calls: AtomicU64,
    wait_calls: AtomicU64,
    cancel_calls: AtomicU64,
    release_calls: AtomicU64,
    copied_bytes: AtomicU64,
    completed_inline: AtomicU64,
    completed_after_wait: AtomicU64,
}

struct HostSession {
    root: Arc<Ring>,
    metrics: Arc<HostMetrics>,
}

impl HostSession {
    fn new(root: Arc<Ring>) -> Self {
        Self {
            root,
            metrics: Arc::new(HostMetrics::default()),
        }
    }

    fn describe(&self) -> &'static [&'static str] {
        &["copy-windows", "batch", "ring"]
    }

    fn open(&self, selector: &[u8]) -> Result<Endpoint, i32> {
        self.metrics.open_calls.fetch_add(1, Ordering::Relaxed);
        if selector != SELECTOR {
            return Err(-1);
        }
        Ok(Endpoint {
            ring: self.root.clone(),
            released: false,
        })
    }

    fn window_acquire(&self, bytes: usize) -> Result<Window, i32> {
        if bytes == 0 || bytes > FRAME_BYTES * 1024 {
            return Err(-5);
        }
        Ok(Window {
            bytes: vec![0; bytes],
            valid: 0,
            released: false,
        })
    }

    fn fill_window(&self, frames: &[Frame], window: &mut Window) -> Result<usize, i32> {
        if window.released {
            return Err(-1);
        }
        let required = frames.len().checked_mul(FRAME_BYTES).ok_or(-5)?;
        if required > window.bytes.len() {
            return Err(-5);
        }
        for (index, frame) in frames.iter().copied().enumerate() {
            let start = index * FRAME_BYTES;
            frame.encode_into(&mut window.bytes[start..start + FRAME_BYTES]);
        }
        window.valid = required;
        self.metrics
            .copied_bytes
            .fetch_add(required as u64, Ordering::Relaxed);
        Ok(frames.len())
    }

    fn read(
        &self,
        endpoint: &Endpoint,
        window: &mut Window,
        max_frames: usize,
    ) -> Result<Submission, i32> {
        self.metrics.read_calls.fetch_add(1, Ordering::Relaxed);
        if endpoint.released || window.released || max_frames == 0 {
            return Err(-1);
        }
        if max_frames
            .checked_mul(FRAME_BYTES)
            .filter(|needed| *needed <= window.bytes.len())
            .is_none()
        {
            return Err(-5);
        }
        let frames = endpoint.ring.try_drain(max_frames);
        if frames.is_empty() {
            Ok(Submission::Pending(Operation {
                max_frames,
                cancelled: false,
                released: false,
            }))
        } else {
            let count = self.fill_window(&frames, window)?;
            self.metrics
                .completed_inline
                .fetch_add(1, Ordering::Relaxed);
            Ok(Submission::Completed(count))
        }
    }

    fn wait(
        &self,
        endpoint: &Endpoint,
        operation: &mut Operation,
        window: &mut Window,
        timeout: Duration,
    ) -> Result<usize, i32> {
        self.metrics.wait_calls.fetch_add(1, Ordering::Relaxed);
        if endpoint.released || operation.released || operation.cancelled {
            return Err(-6);
        }
        let frames = endpoint.ring.wait_drain(operation.max_frames, timeout);
        if frames.is_empty() {
            let (_, _, closed) = endpoint.ring.stats();
            return if closed { Ok(0) } else { Err(-7) };
        }
        let count = self.fill_window(&frames, window)?;
        self.metrics
            .completed_after_wait
            .fetch_add(1, Ordering::Relaxed);
        Ok(count)
    }

    fn cancel(&self, operation: &mut Operation) -> Result<(), i32> {
        if operation.released {
            return Err(-1);
        }
        self.metrics.cancel_calls.fetch_add(1, Ordering::Relaxed);
        operation.cancelled = true;
        Ok(())
    }

    fn release_operation(&self, operation: &mut Operation) -> Result<(), i32> {
        if operation.released {
            return Err(-1);
        }
        operation.released = true;
        self.metrics.release_calls.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    fn release_window(&self, window: &mut Window) -> Result<(), i32> {
        if window.released {
            return Err(-1);
        }
        window.released = true;
        self.metrics.release_calls.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    fn release_endpoint(&self, endpoint: &mut Endpoint) -> Result<(), i32> {
        if endpoint.released {
            return Err(-1);
        }
        endpoint.released = true;
        self.metrics.release_calls.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }
}

fn spawn_synthetic(ring: Arc<Ring>, hz: u64, duration: Duration) -> thread::JoinHandle<u64> {
    thread::spawn(move || {
        let epoch = Instant::now();
        let period = Duration::from_nanos(1_000_000_000u64 / hz.max(1));
        let deadline = epoch + duration;
        let mut next = epoch;
        let mut sequence = 0u64;
        while Instant::now() < deadline {
            let now = Instant::now();
            if now < next {
                thread::sleep(next - now);
            }
            sequence = sequence.saturating_add(1);
            ring.push(Frame::synthetic(sequence, epoch));
            next += period;
        }
        ring.close();
        sequence
    })
}

fn spawn_sysinfo(ring: Arc<Ring>, hz: u64, duration: Duration) -> thread::JoinHandle<u64> {
    thread::spawn(move || {
        let mut sampler = SysinfoSampler::new();
        let epoch = Instant::now();
        let period = Duration::from_nanos(1_000_000_000u64 / hz.max(1));
        let deadline = epoch + duration;
        let mut next = epoch;
        let mut produced = 0u64;
        while Instant::now() < deadline {
            let now = Instant::now();
            if now < next {
                thread::sleep(next - now);
            }
            ring.push(sampler.sample());
            produced = produced.saturating_add(1);
            next += period;
        }
        ring.close();
        produced
    })
}

#[cfg(target_os = "linux")]
fn spawn_linux_proc(ring: Arc<Ring>, hz: u64, duration: Duration) -> thread::JoinHandle<u64> {
    thread::spawn(move || {
        let mut sampler = LinuxProcSampler::new().expect("open /proc telemetry files");
        let epoch = Instant::now();
        let period = Duration::from_nanos(1_000_000_000u64 / hz.max(1));
        let deadline = epoch + duration;
        let mut next = epoch;
        let mut produced = 0u64;
        while Instant::now() < deadline {
            let now = Instant::now();
            if now < next {
                thread::sleep(next - now);
            }
            ring.push(sampler.sample().expect("sample /proc telemetry"));
            produced = produced.saturating_add(1);
            next += period;
        }
        ring.close();
        produced
    })
}

fn bench_stream(kind: &str, hz: u64, batch: usize, millis: u64) {
    let duration = Duration::from_millis(millis);
    let ring = Arc::new(Ring::new(8192));
    let host = HostSession::new(ring.clone());
    assert_eq!(host.describe(), ["copy-windows", "batch", "ring"]);
    let mut endpoint = host.open(SELECTOR).unwrap();
    let mut window = host.window_acquire(FRAME_BYTES * batch).unwrap();
    let producer = match kind {
        "synthetic" => spawn_synthetic(ring.clone(), hz, duration),
        "sysinfo" => spawn_sysinfo(ring.clone(), hz, duration),
        #[cfg(target_os = "linux")]
        "linux-proc" => spawn_linux_proc(ring.clone(), hz, duration),
        _ => panic!("bad kind"),
    };
    let consumer_period = Duration::from_nanos(
        (1_000_000_000u128 * batch as u128 / hz.max(1) as u128).min(u64::MAX as u128) as u64,
    );
    let started = Instant::now();
    let mut consumed = 0u64;
    let mut batches = 0u64;
    let mut sequence_gaps = 0u64;
    let mut last_sequence = 0u64;
    loop {
        if batch > 1 {
            thread::sleep(consumer_period);
        }
        let count = match host.read(&endpoint, &mut window, batch).unwrap() {
            Submission::Completed(count) => count,
            Submission::Pending(mut op) => {
                let result = host.wait(&endpoint, &mut op, &mut window, Duration::from_millis(100));
                host.release_operation(&mut op).unwrap();
                match result {
                    Ok(count) => count,
                    Err(-7) => 0,
                    Err(error) => panic!("wait failed: {error}"),
                }
            }
        };
        if count > 0 {
            batches += 1;
            consumed += count as u64;
            for index in 0..count {
                let start = index * FRAME_BYTES;
                let mut bytes = [0u8; 8];
                bytes.copy_from_slice(&window.bytes[start..start + 8]);
                let sequence = u64::from_le_bytes(bytes);
                if last_sequence != 0 && sequence != last_sequence + 1 {
                    sequence_gaps = sequence_gaps.saturating_add(sequence - last_sequence - 1);
                }
                last_sequence = sequence;
            }
        }
        let (queued, _, closed) = ring.stats();
        if closed && queued == 0 {
            break;
        }
    }
    let produced = producer.join().unwrap();
    let elapsed = started.elapsed();
    let (_, dropped, _) = ring.stats();
    host.release_window(&mut window).unwrap();
    host.release_endpoint(&mut endpoint).unwrap();
    let metrics = &host.metrics;
    println!(
        "{{\"kind\":\"stream\",\"provider\":\"{}\",\"hz\":{},\"batch\":{},\"duration_ms\":{},\"elapsed_ms\":{:.3},\"produced\":{},\"consumed\":{},\"ring_dropped\":{},\"sequence_gaps\":{},\"batches\":{},\"frames_per_batch\":{:.3},\"read_calls\":{},\"wait_calls\":{},\"inline\":{},\"after_wait\":{},\"copied_bytes\":{},\"host_calls_per_frame\":{:.6}}}",
        kind,
        hz,
        batch,
        millis,
        elapsed.as_secs_f64() * 1000.0,
        produced,
        consumed,
        dropped,
        sequence_gaps,
        batches,
        if batches == 0 {
            0.0
        } else {
            consumed as f64 / batches as f64
        },
        metrics.read_calls.load(Ordering::Relaxed),
        metrics.wait_calls.load(Ordering::Relaxed),
        metrics.completed_inline.load(Ordering::Relaxed),
        metrics.completed_after_wait.load(Ordering::Relaxed),
        metrics.copied_bytes.load(Ordering::Relaxed),
        if consumed == 0 {
            0.0
        } else {
            (metrics.read_calls.load(Ordering::Relaxed)
                + metrics.wait_calls.load(Ordering::Relaxed)) as f64
                / consumed as f64
        },
    );
}

fn bench_sampler(iterations: usize) {
    let mut sampler = SysinfoSampler::new();
    thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    let started = Instant::now();
    let mut encoded = [0u8; FRAME_BYTES];
    let mut cpu_changes = 0u64;
    let mut last_cpu = None;
    for _ in 0..iterations {
        let frame = sampler.sample();
        frame.encode_into(&mut encoded);
        if last_cpu.is_some_and(|value| value != frame.cpu_milli_pct) {
            cpu_changes += 1;
        }
        last_cpu = Some(frame.cpu_milli_pct);
    }
    let elapsed = started.elapsed();
    println!(
        "{{\"kind\":\"sampler-cost\",\"provider\":\"sysinfo-0.39.6\",\"iterations\":{},\"elapsed_ms\":{:.3},\"ns_per_sample\":{:.1},\"samples_per_sec\":{:.1},\"frame_bytes\":{},\"cpu_value_changes\":{},\"cpu_min_update_ms\":{}}}",
        iterations,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_nanos() as f64 / iterations as f64,
        iterations as f64 / elapsed.as_secs_f64(),
        FRAME_BYTES,
        cpu_changes,
        sysinfo::MINIMUM_CPU_UPDATE_INTERVAL.as_millis(),
    );
}

#[cfg(target_os = "linux")]
fn bench_linux_proc_sampler(iterations: usize) {
    let mut sampler = LinuxProcSampler::new().expect("open /proc telemetry files");
    let started = Instant::now();
    let mut encoded = [0u8; FRAME_BYTES];
    let mut cpu_changes = 0u64;
    let mut last_cpu = None;
    for _ in 0..iterations {
        let frame = sampler.sample().expect("sample /proc telemetry");
        frame.encode_into(&mut encoded);
        if last_cpu.is_some_and(|value| value != frame.cpu_milli_pct) {
            cpu_changes += 1;
        }
        last_cpu = Some(frame.cpu_milli_pct);
    }
    let elapsed = started.elapsed();
    println!(
        "{{\"kind\":\"sampler-cost\",\"provider\":\"linux-proc-resident\",\"iterations\":{},\"elapsed_ms\":{:.3},\"ns_per_sample\":{:.1},\"samples_per_sec\":{:.1},\"frame_bytes\":{},\"cpu_value_changes\":{}}}",
        iterations,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_nanos() as f64 / iterations as f64,
        iterations as f64 / elapsed.as_secs_f64(),
        FRAME_BYTES,
        cpu_changes,
    );
}

fn bench_transport_micro(frames: usize, batch: usize) {
    let ring = Arc::new(Ring::new(frames.max(1)));
    let epoch = Instant::now();
    for sequence in 1..=frames as u64 {
        ring.push(Frame::synthetic(sequence, epoch));
    }
    ring.close();
    let host = HostSession::new(ring);
    let endpoint = host.open(SELECTOR).unwrap();
    let mut window = host.window_acquire(FRAME_BYTES * batch).unwrap();
    let started = Instant::now();
    let mut consumed = 0usize;
    loop {
        match host.read(&endpoint, &mut window, batch).unwrap() {
            Submission::Completed(count) => consumed += count,
            Submission::Pending(mut op) => {
                let count = host
                    .wait(&endpoint, &mut op, &mut window, Duration::from_millis(1))
                    .unwrap();
                host.release_operation(&mut op).unwrap();
                if count == 0 {
                    break;
                }
                consumed += count;
            }
        }
    }
    let elapsed = started.elapsed();
    assert_eq!(consumed, frames);
    let metrics = &host.metrics;
    println!(
        "{{\"kind\":\"transport-micro\",\"frames\":{},\"batch\":{},\"elapsed_ms\":{:.3},\"ns_per_frame\":{:.1},\"frames_per_sec\":{:.1},\"read_calls\":{},\"wait_calls\":{},\"host_calls_per_frame\":{:.6},\"copied_bytes\":{}}}",
        frames,
        batch,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_nanos() as f64 / frames as f64,
        frames as f64 / elapsed.as_secs_f64(),
        metrics.read_calls.load(Ordering::Relaxed),
        metrics.wait_calls.load(Ordering::Relaxed),
        (metrics.read_calls.load(Ordering::Relaxed)
            + metrics.wait_calls.load(Ordering::Relaxed)) as f64
            / frames as f64,
        metrics.copied_bytes.load(Ordering::Relaxed),
    );
}

fn bench_shell(iterations: usize) {
    let started = Instant::now();
    for _ in 0..iterations {
        let status = Command::new("/bin/sh")
            .args(["-lc", "ps -A -o pid=,%cpu=,rss= >/dev/null"])
            .status()
            .expect("spawn shell");
        assert!(status.success());
    }
    let elapsed = started.elapsed();
    println!(
        "{{\"kind\":\"shell-cost\",\"iterations\":{},\"elapsed_ms\":{:.3},\"ns_per_sample\":{:.1},\"samples_per_sec\":{:.1},\"command\":\"ps -A -o pid=,%cpu=,rss= >/dev/null\"}}",
        iterations,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_nanos() as f64 / iterations as f64,
        iterations as f64 / elapsed.as_secs_f64(),
    );
}

fn cancellation_probe() {
    let ring = Arc::new(Ring::new(4));
    let host = HostSession::new(ring);
    let endpoint = host.open(SELECTOR).unwrap();
    let mut window = host.window_acquire(FRAME_BYTES).unwrap();
    let mut op = match host.read(&endpoint, &mut window, 1).unwrap() {
        Submission::Pending(op) => op,
        Submission::Completed(_) => panic!("unexpected completion"),
    };
    host.cancel(&mut op).unwrap();
    assert_eq!(
        host.wait(&endpoint, &mut op, &mut window, Duration::from_millis(1)),
        Err(-6)
    );
    host.release_operation(&mut op).unwrap();
    println!(
        "{{\"kind\":\"semantic-probe\",\"open\":true,\"read_pending\":true,\"wait\":true,\"cancel\":true,\"release\":true,\"host_api_added\":false}}"
    );
}

fn main() {
    cancellation_probe();
    bench_sampler(2_000);
    #[cfg(target_os = "linux")]
    bench_linux_proc_sampler(10_000);
    bench_shell(40);
    bench_transport_micro(100_000, 1);
    bench_transport_micro(100_000, 32);
    bench_transport_micro(100_000, 256);
    for (hz, millis) in [(10, 1200), (100, 1200), (1000, 1200)] {
        bench_stream("synthetic", hz, 1, millis);
        bench_stream("synthetic", hz, 32, millis);
    }
    for (hz, millis) in [(10, 1200), (100, 1200), (1000, 1200)] {
        bench_stream("sysinfo", hz, 32, millis);
    }
    #[cfg(target_os = "linux")]
    for (hz, millis) in [(100, 1200), (1000, 1200)] {
        bench_stream("linux-proc", hz, 32, millis);
    }
}
