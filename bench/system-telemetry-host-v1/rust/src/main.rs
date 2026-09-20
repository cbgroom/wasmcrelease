#[cfg(target_os = "linux")]
use std::alloc::{GlobalAlloc, Layout, System as StdSystemAllocator};
use std::collections::VecDeque;
#[cfg(target_os = "linux")]
use std::fs::File;
#[cfg(target_os = "linux")]
use std::io::{Read, Seek, SeekFrom};
#[cfg(target_os = "linux")]
use std::mem::MaybeUninit;
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
const FRESH_CPU: u32 = 1 << 0;
const FRESH_MEMORY: u32 = 1 << 1;
const FRESH_NETWORK: u32 = 1 << 2;
const FRESH_LOAD: u32 = 1 << 3;
const FRESH_ALL: u32 = FRESH_CPU | FRESH_MEMORY | FRESH_NETWORK | FRESH_LOAD;
const MEMORY_CADENCE: Duration = Duration::from_millis(10);
const FALLBACK_NETWORK_CADENCE: Duration = Duration::from_millis(10);
const LOAD_CADENCE: Duration = Duration::from_millis(100);
#[cfg(target_os = "linux")]
const LINUX_BALANCED_CPU_CADENCE: Duration = Duration::from_millis(10);
#[cfg(target_os = "linux")]
const LINUX_BALANCED_NETWORK_CADENCE: Duration = Duration::from_millis(10);
#[cfg(target_os = "linux")]
const LINUX_ECONOMY_CADENCE: Duration = Duration::from_millis(50);
#[cfg(target_os = "linux")]
const LINUX_ECONOMY_LOAD_CADENCE: Duration = Duration::from_secs(1);

#[cfg(target_os = "linux")]
static ALLOCATIONS: AtomicU64 = AtomicU64::new(0);
#[cfg(target_os = "linux")]
static ALLOCATED_BYTES: AtomicU64 = AtomicU64::new(0);

#[cfg(target_os = "linux")]
struct CountingAllocator;

#[cfg(target_os = "linux")]
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        ALLOCATED_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        unsafe { StdSystemAllocator.alloc(layout) }
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { StdSystemAllocator.dealloc(ptr, layout) }
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        ALLOCATED_BYTES.fetch_add(new_size as u64, Ordering::Relaxed);
        unsafe { StdSystemAllocator.realloc(ptr, layout, new_size) }
    }
}

#[cfg(target_os = "linux")]
#[global_allocator]
static GLOBAL_ALLOCATOR: CountingAllocator = CountingAllocator;

#[derive(Clone, Copy, Debug)]
struct Frame {
    sequence: u64,
    monotonic_ns: u64,
    available_memory: u64,
    used_swap: u64,
    network_rx_total: u64,
    network_tx_total: u64,
    cpu_milli_pct: u32,
    load1_milli: u32,
    freshness_mask: u32,
    flags: u32,
}

impl Frame {
    fn encode_into(self, out: &mut [u8]) {
        assert!(out.len() >= FRAME_BYTES);
        let mut offset = 0usize;
        for value in [
            self.sequence,
            self.monotonic_ns,
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
        offset += 4;
        out[offset..offset + 4].copy_from_slice(&self.freshness_mask.to_le_bytes());
        offset += 4;
        out[offset..offset + 4].copy_from_slice(&self.flags.to_le_bytes());
    }

    fn synthetic(sequence: u64, epoch: Instant) -> Self {
        Self {
            sequence,
            monotonic_ns: epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            available_memory: (32u64 << 30).saturating_sub(sequence & 0xffff),
            used_swap: sequence & 0x3fff,
            network_rx_total: sequence.saturating_mul(128),
            network_tx_total: sequence.saturating_mul(96),
            cpu_milli_pct: (sequence % 100_000) as u32,
            load1_milli: (sequence % 8_000) as u32,
            freshness_mask: FRESH_ALL,
            flags: 0,
        }
    }
}

struct SysinfoSampler {
    system: System,
    networks: Networks,
    epoch: Instant,
    sequence: u64,
    last_cpu_refresh: Instant,
    last_memory_refresh: Instant,
    last_network_refresh: Instant,
    last_load_refresh: Instant,
    cached_available_memory: u64,
    cached_used_swap: u64,
    cached_network_rx_total: u64,
    cached_network_tx_total: u64,
    cached_load1_milli: u32,
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
    last_memory_refresh: Instant,
    last_load_refresh: Instant,
    cached_available_memory: u64,
    cached_used_swap: u64,
    cached_load1_milli: u32,
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
            last_memory_refresh: Instant::now(),
            last_load_refresh: Instant::now(),
            cached_available_memory: 0,
            cached_used_swap: 0,
            cached_load1_milli: 0,
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
        let mut total = 0u64;
        let mut idle = 0u64;
        let mut seen = 0usize;
        for (index, field) in line.split_whitespace().skip(1).take(8).enumerate() {
            let value = field.parse::<u64>().ok()?;
            total = total.saturating_add(value);
            if index == 3 || index == 4 {
                idle = idle.saturating_add(value);
            }
            seen += 1;
        }
        if seen < 4 {
            return None;
        }
        Some((total, idle))
    }

    fn memory_values(input: &str) -> Option<(u64, u64)> {
        let mut available = None;
        let mut swap_total = None;
        let mut swap_free = None;
        for line in input.lines() {
            let mut fields = line.split_whitespace();
            let key = fields.next()?;
            let value = fields.next()?.parse::<u64>().ok()?.saturating_mul(1024);
            match key {
                "MemAvailable:" => available = Some(value),
                "SwapTotal:" => swap_total = Some(value),
                "SwapFree:" => swap_free = Some(value),
                _ => {}
            }
            if available.is_some() && swap_total.is_some() && swap_free.is_some() {
                break;
            }
        }
        Some((available?, swap_total?.saturating_sub(swap_free?)))
    }

    fn network_totals(input: &str) -> Option<(u64, u64)> {
        let mut rx = 0u64;
        let mut tx = 0u64;
        for line in input.lines().skip(2) {
            let (name, counters) = line.split_once(':')?;
            if name.trim() == "lo" {
                continue;
            }
            let mut fields = counters.split_whitespace();
            rx = rx.saturating_add(fields.next()?.parse::<u64>().ok()?);
            tx = tx.saturating_add(fields.nth(7)?.parse::<u64>().ok()?);
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

        let (available_memory, used_swap) = Self::memory_values(&self.mem_buf)
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
            available_memory,
            used_swap,
            network_rx_total,
            network_tx_total,
            cpu_milli_pct: self.last_cpu_milli_pct,
            load1_milli,
            freshness_mask: FRESH_ALL,
            flags: 0,
        })
    }

    fn sample_cadenced(&mut self) -> std::io::Result<Frame> {
        let now = Instant::now();
        Self::reread(&mut self.stat, &mut self.stat_buf)?;
        Self::reread(&mut self.netdev, &mut self.net_buf)?;

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
        let (network_rx_total, network_tx_total) = Self::network_totals(&self.net_buf)
            .ok_or_else(|| std::io::Error::other("invalid /proc/net/dev"))?;

        let mut freshness_mask = FRESH_CPU | FRESH_NETWORK;
        if self.sequence == 0 || now.duration_since(self.last_memory_refresh) >= MEMORY_CADENCE {
            Self::reread(&mut self.meminfo, &mut self.mem_buf)?;
            (self.cached_available_memory, self.cached_used_swap) =
                Self::memory_values(&self.mem_buf)
                    .ok_or_else(|| std::io::Error::other("invalid /proc/meminfo"))?;
            self.last_memory_refresh = now;
            freshness_mask |= FRESH_MEMORY;
        }
        if self.sequence == 0 || now.duration_since(self.last_load_refresh) >= LOAD_CADENCE {
            Self::reread(&mut self.loadavg, &mut self.load_buf)?;
            self.cached_load1_milli = self
                .load_buf
                .split_whitespace()
                .next()
                .and_then(|value| value.parse::<f64>().ok())
                .map(|value| (value.max(0.0) * 1000.0).min(u32::MAX as f64) as u32)
                .ok_or_else(|| std::io::Error::other("invalid /proc/loadavg"))?;
            self.last_load_refresh = now;
            freshness_mask |= FRESH_LOAD;
        }

        self.sequence = self.sequence.saturating_add(1);
        Ok(Frame {
            sequence: self.sequence,
            monotonic_ns: self.epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            available_memory: self.cached_available_memory,
            used_swap: self.cached_used_swap,
            network_rx_total,
            network_tx_total,
            cpu_milli_pct: self.last_cpu_milli_pct,
            load1_milli: self.cached_load1_milli,
            freshness_mask,
            flags: 0,
        })
    }
}

#[cfg(target_os = "linux")]
#[derive(Clone, Copy)]
struct GenericEndpoint(u32);

#[cfg(target_os = "linux")]
struct GenericFileGrant {
    selector: &'static [u8],
    file: File,
}

#[cfg(target_os = "linux")]
struct GenericResourceHost {
    grants: Vec<GenericFileGrant>,
    open_calls: u64,
    read_calls: u64,
}

#[cfg(target_os = "linux")]
impl GenericResourceHost {
    fn from_preopened(grants: Vec<GenericFileGrant>) -> Self {
        Self {
            grants,
            open_calls: 0,
            read_calls: 0,
        }
    }

    fn open(&mut self, selector: &[u8]) -> Result<GenericEndpoint, i32> {
        self.open_calls = self.open_calls.saturating_add(1);
        self.grants
            .iter()
            .position(|grant| grant.selector == selector)
            .and_then(|index| u32::try_from(index).ok())
            .map(GenericEndpoint)
            .ok_or(-1)
    }

    fn read(&mut self, endpoint: GenericEndpoint, window: &mut [u8]) -> Result<usize, i32> {
        self.read_calls = self.read_calls.saturating_add(1);
        let grant = self.grants.get_mut(endpoint.0 as usize).ok_or(-1)?;
        grant.file.seek(SeekFrom::Start(0)).map_err(|_| -8)?;
        grant.file.read(window).map_err(|_| -8)
    }
}

#[cfg(target_os = "linux")]
fn linux_generic_resource_host() -> std::io::Result<GenericResourceHost> {
    Ok(GenericResourceHost::from_preopened(vec![
        GenericFileGrant {
            selector: b"os.proc.stat",
            file: File::open("/proc/stat")?,
        },
        GenericFileGrant {
            selector: b"os.proc.meminfo",
            file: File::open("/proc/meminfo")?,
        },
        GenericFileGrant {
            selector: b"os.proc.netdev",
            file: File::open("/proc/net/dev")?,
        },
        GenericFileGrant {
            selector: b"os.proc.loadavg",
            file: File::open("/proc/loadavg")?,
        },
    ]))
}

#[cfg(target_os = "linux")]
struct LinuxTelemetryLib {
    host: GenericResourceHost,
    stat: GenericEndpoint,
    meminfo: GenericEndpoint,
    netdev: GenericEndpoint,
    loadavg: GenericEndpoint,
    stat_buf: [u8; 4096],
    mem_buf: [u8; 4096],
    net_buf: [u8; 8192],
    load_buf: [u8; 256],
    epoch: Instant,
    sequence: u64,
    last_cpu_total: u64,
    last_cpu_idle: u64,
    last_cpu_milli_pct: u32,
    last_cpu_refresh: Instant,
    last_memory_refresh: Instant,
    last_network_refresh: Instant,
    last_load_refresh: Instant,
    cached_available_memory: u64,
    cached_used_swap: u64,
    cached_network_rx_total: u64,
    cached_network_tx_total: u64,
    cached_load1_milli: u32,
}

#[cfg(target_os = "linux")]
impl LinuxTelemetryLib {
    fn new(mut host: GenericResourceHost) -> Result<Self, i32> {
        let stat = host.open(b"os.proc.stat")?;
        let meminfo = host.open(b"os.proc.meminfo")?;
        let netdev = host.open(b"os.proc.netdev")?;
        let loadavg = host.open(b"os.proc.loadavg")?;
        let epoch = Instant::now();
        let mut telemetry = Self {
            host,
            stat,
            meminfo,
            netdev,
            loadavg,
            stat_buf: [0; 4096],
            mem_buf: [0; 4096],
            net_buf: [0; 8192],
            load_buf: [0; 256],
            epoch,
            sequence: 0,
            last_cpu_total: 0,
            last_cpu_idle: 0,
            last_cpu_milli_pct: 0,
            last_cpu_refresh: epoch,
            last_memory_refresh: epoch,
            last_network_refresh: epoch,
            last_load_refresh: epoch,
            cached_available_memory: 0,
            cached_used_swap: 0,
            cached_network_rx_total: 0,
            cached_network_tx_total: 0,
            cached_load1_milli: 0,
        };
        let (total, idle) = telemetry.read_cpu()?;
        telemetry.last_cpu_total = total;
        telemetry.last_cpu_idle = idle;
        Ok(telemetry)
    }

    fn read_text<'a>(
        host: &mut GenericResourceHost,
        endpoint: GenericEndpoint,
        buffer: &'a mut [u8],
    ) -> Result<&'a str, i32> {
        let count = host.read(endpoint, buffer)?;
        std::str::from_utf8(&buffer[..count]).map_err(|_| -8)
    }

    fn read_cpu(&mut self) -> Result<(u64, u64), i32> {
        let text = Self::read_text(&mut self.host, self.stat, &mut self.stat_buf)?;
        LinuxProcSampler::cpu_counters(text).ok_or(-8)
    }

    fn read_memory(&mut self) -> Result<(u64, u64), i32> {
        let text = Self::read_text(&mut self.host, self.meminfo, &mut self.mem_buf)?;
        LinuxProcSampler::memory_values(text).ok_or(-8)
    }

    fn read_network(&mut self) -> Result<(u64, u64), i32> {
        let text = Self::read_text(&mut self.host, self.netdev, &mut self.net_buf)?;
        LinuxProcSampler::network_totals(text).ok_or(-8)
    }

    fn read_load(&mut self) -> Result<u32, i32> {
        let text = Self::read_text(&mut self.host, self.loadavg, &mut self.load_buf)?;
        text.split_whitespace()
            .next()
            .and_then(|value| value.parse::<f64>().ok())
            .map(|value| (value.max(0.0) * 1000.0).min(u32::MAX as f64) as u32)
            .ok_or(-8)
    }

    fn refresh_cpu(&mut self) -> Result<(), i32> {
        let (cpu_total, cpu_idle) = self.read_cpu()?;
        let total_delta = cpu_total.saturating_sub(self.last_cpu_total);
        let idle_delta = cpu_idle.saturating_sub(self.last_cpu_idle);
        if total_delta != 0 {
            let busy_delta = total_delta.saturating_sub(idle_delta);
            self.last_cpu_milli_pct =
                ((busy_delta as u128 * 100_000u128) / total_delta as u128) as u32;
        }
        self.last_cpu_total = cpu_total;
        self.last_cpu_idle = cpu_idle;
        Ok(())
    }

    fn frame(&mut self, profile: &str) -> Result<Frame, i32> {
        let now = Instant::now();
        let (cpu_cadence, memory_cadence, network_cadence, load_cadence) = match profile {
            "fast" => (Duration::ZERO, MEMORY_CADENCE, Duration::ZERO, LOAD_CADENCE),
            "balanced" => (
                LINUX_BALANCED_CPU_CADENCE,
                MEMORY_CADENCE,
                LINUX_BALANCED_NETWORK_CADENCE,
                LOAD_CADENCE,
            ),
            "economy" => (
                LINUX_ECONOMY_CADENCE,
                LINUX_ECONOMY_CADENCE,
                LINUX_ECONOMY_CADENCE,
                LINUX_ECONOMY_LOAD_CADENCE,
            ),
            _ => return Err(-7),
        };
        let mut freshness_mask = 0u32;

        if self.sequence == 0 || now.duration_since(self.last_cpu_refresh) >= cpu_cadence {
            self.refresh_cpu()?;
            self.last_cpu_refresh = now;
            freshness_mask |= FRESH_CPU;
        }
        if self.sequence == 0 || now.duration_since(self.last_network_refresh) >= network_cadence {
            (self.cached_network_rx_total, self.cached_network_tx_total) = self.read_network()?;
            self.last_network_refresh = now;
            freshness_mask |= FRESH_NETWORK;
        }
        if self.sequence == 0 || now.duration_since(self.last_memory_refresh) >= memory_cadence {
            (self.cached_available_memory, self.cached_used_swap) = self.read_memory()?;
            self.last_memory_refresh = now;
            freshness_mask |= FRESH_MEMORY;
        }
        if self.sequence == 0 || now.duration_since(self.last_load_refresh) >= load_cadence {
            self.cached_load1_milli = self.read_load()?;
            self.last_load_refresh = now;
            freshness_mask |= FRESH_LOAD;
        }

        self.sequence = self.sequence.saturating_add(1);
        Ok(Frame {
            sequence: self.sequence,
            monotonic_ns: self.epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            available_memory: self.cached_available_memory,
            used_swap: self.cached_used_swap,
            network_rx_total: self.cached_network_rx_total,
            network_tx_total: self.cached_network_tx_total,
            cpu_milli_pct: self.last_cpu_milli_pct,
            load1_milli: self.cached_load1_milli,
            freshness_mask,
            flags: 0,
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
        let epoch = Instant::now();
        let (cached_network_rx_total, cached_network_tx_total) =
            networks.iter().fold((0u64, 0u64), |(rx, tx), (_, data)| {
                (
                    rx.saturating_add(data.total_received()),
                    tx.saturating_add(data.total_transmitted()),
                )
            });
        Self {
            cached_available_memory: system.available_memory(),
            cached_used_swap: system.used_swap(),
            cached_network_rx_total,
            cached_network_tx_total,
            cached_load1_milli: (System::load_average().one.max(0.0) * 1000.0).min(u32::MAX as f64)
                as u32,
            system,
            networks,
            epoch,
            sequence: 0,
            last_cpu_refresh: epoch,
            last_memory_refresh: epoch,
            last_network_refresh: epoch,
            last_load_refresh: epoch,
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
            available_memory: self.system.available_memory(),
            used_swap: self.system.used_swap(),
            network_rx_total,
            network_tx_total,
            cpu_milli_pct: (self.system.global_cpu_usage().max(0.0) * 1000.0).min(u32::MAX as f32)
                as u32,
            load1_milli: (load.max(0.0) * 1000.0).min(u32::MAX as f64) as u32,
            freshness_mask: FRESH_ALL,
            flags: 0,
        }
    }

    fn sample_cadenced(&mut self) -> Frame {
        let now = Instant::now();
        let mut freshness_mask = 0u32;
        if self.sequence == 0
            || now.duration_since(self.last_cpu_refresh) >= sysinfo::MINIMUM_CPU_UPDATE_INTERVAL
        {
            self.system.refresh_cpu_usage();
            self.last_cpu_refresh = now;
            freshness_mask |= FRESH_CPU;
        }
        if self.sequence == 0 || now.duration_since(self.last_memory_refresh) >= MEMORY_CADENCE {
            self.system.refresh_memory();
            self.cached_available_memory = self.system.available_memory();
            self.cached_used_swap = self.system.used_swap();
            self.last_memory_refresh = now;
            freshness_mask |= FRESH_MEMORY;
        }
        if self.sequence == 0
            || now.duration_since(self.last_network_refresh) >= FALLBACK_NETWORK_CADENCE
        {
            self.networks.refresh(false);
            (self.cached_network_rx_total, self.cached_network_tx_total) = self
                .networks
                .iter()
                .fold((0u64, 0u64), |(rx, tx), (_, data)| {
                    (
                        rx.saturating_add(data.total_received()),
                        tx.saturating_add(data.total_transmitted()),
                    )
                });
            self.last_network_refresh = now;
            freshness_mask |= FRESH_NETWORK;
        }
        if self.sequence == 0 || now.duration_since(self.last_load_refresh) >= LOAD_CADENCE {
            self.cached_load1_milli =
                (System::load_average().one.max(0.0) * 1000.0).min(u32::MAX as f64) as u32;
            self.last_load_refresh = now;
            freshness_mask |= FRESH_LOAD;
        }
        self.sequence = self.sequence.saturating_add(1);
        Frame {
            sequence: self.sequence,
            monotonic_ns: self.epoch.elapsed().as_nanos().min(u64::MAX as u128) as u64,
            available_memory: self.cached_available_memory,
            used_swap: self.cached_used_swap,
            network_rx_total: self.cached_network_rx_total,
            network_tx_total: self.cached_network_tx_total,
            cpu_milli_pct: (self.system.global_cpu_usage().max(0.0) * 1000.0).min(u32::MAX as f32)
                as u32,
            load1_milli: self.cached_load1_milli,
            freshness_mask,
            flags: 0,
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

fn spawn_sysinfo_cadenced(ring: Arc<Ring>, hz: u64, duration: Duration) -> thread::JoinHandle<u64> {
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
            ring.push(sampler.sample_cadenced());
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

#[cfg(target_os = "linux")]
fn spawn_linux_proc_cadenced(
    ring: Arc<Ring>,
    hz: u64,
    duration: Duration,
) -> thread::JoinHandle<u64> {
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
            ring.push(
                sampler
                    .sample_cadenced()
                    .expect("sample cadenced /proc telemetry"),
            );
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
        "sysinfo-cadenced" => spawn_sysinfo_cadenced(ring.clone(), hz, duration),
        #[cfg(target_os = "linux")]
        "linux-proc" => spawn_linux_proc(ring.clone(), hz, duration),
        #[cfg(target_os = "linux")]
        "linux-proc-cadenced" => spawn_linux_proc_cadenced(ring.clone(), hz, duration),
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
    let mut fresh_cpu = 0u64;
    let mut fresh_memory = 0u64;
    let mut fresh_network = 0u64;
    let mut fresh_load = 0u64;
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
                let mut mask = [0u8; 4];
                mask.copy_from_slice(&window.bytes[start + 56..start + 60]);
                let mask = u32::from_le_bytes(mask);
                fresh_cpu += u64::from(mask & FRESH_CPU != 0);
                fresh_memory += u64::from(mask & FRESH_MEMORY != 0);
                fresh_network += u64::from(mask & FRESH_NETWORK != 0);
                fresh_load += u64::from(mask & FRESH_LOAD != 0);
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
        "{{\"kind\":\"stream\",\"provider\":\"{}\",\"hz\":{},\"batch\":{},\"duration_ms\":{},\"elapsed_ms\":{:.3},\"produced\":{},\"consumed\":{},\"ring_dropped\":{},\"sequence_gaps\":{},\"batches\":{},\"frames_per_batch\":{:.3},\"read_calls\":{},\"wait_calls\":{},\"inline\":{},\"after_wait\":{},\"copied_bytes\":{},\"host_calls_per_frame\":{:.6},\"fresh_cpu\":{},\"fresh_memory\":{},\"fresh_network\":{},\"fresh_load\":{}}}",
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
        fresh_cpu,
        fresh_memory,
        fresh_network,
        fresh_load,
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

fn bench_sysinfo_cadenced_sampler(iterations: usize) {
    let mut sampler = SysinfoSampler::new();
    let started = Instant::now();
    let mut encoded = [0u8; FRAME_BYTES];
    let mut fresh = [0u64; 4];
    for _ in 0..iterations {
        let frame = sampler.sample_cadenced();
        frame.encode_into(&mut encoded);
        fresh[0] += u64::from(frame.freshness_mask & FRESH_CPU != 0);
        fresh[1] += u64::from(frame.freshness_mask & FRESH_MEMORY != 0);
        fresh[2] += u64::from(frame.freshness_mask & FRESH_NETWORK != 0);
        fresh[3] += u64::from(frame.freshness_mask & FRESH_LOAD != 0);
    }
    let elapsed = started.elapsed();
    println!(
        "{{\"kind\":\"sampler-cost\",\"provider\":\"sysinfo-0.39.6-cadenced\",\"iterations\":{},\"elapsed_ms\":{:.3},\"ns_per_sample\":{:.1},\"samples_per_sec\":{:.1},\"frame_bytes\":{},\"fresh_cpu\":{},\"fresh_memory\":{},\"fresh_network\":{},\"fresh_load\":{}}}",
        iterations,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_nanos() as f64 / iterations as f64,
        iterations as f64 / elapsed.as_secs_f64(),
        FRAME_BYTES,
        fresh[0],
        fresh[1],
        fresh[2],
        fresh[3],
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

#[cfg(target_os = "linux")]
fn bench_linux_proc_cadenced_sampler(iterations: usize) {
    let mut sampler = LinuxProcSampler::new().expect("open /proc telemetry files");
    for _ in 0..128 {
        sampler
            .sample_cadenced()
            .expect("warm cadenced /proc telemetry");
    }
    ALLOCATIONS.store(0, Ordering::Relaxed);
    ALLOCATED_BYTES.store(0, Ordering::Relaxed);
    let started = Instant::now();
    let mut encoded = [0u8; FRAME_BYTES];
    let mut fresh = [0u64; 4];
    for _ in 0..iterations {
        let frame = sampler
            .sample_cadenced()
            .expect("sample cadenced /proc telemetry");
        frame.encode_into(&mut encoded);
        fresh[0] += u64::from(frame.freshness_mask & FRESH_CPU != 0);
        fresh[1] += u64::from(frame.freshness_mask & FRESH_MEMORY != 0);
        fresh[2] += u64::from(frame.freshness_mask & FRESH_NETWORK != 0);
        fresh[3] += u64::from(frame.freshness_mask & FRESH_LOAD != 0);
    }
    let elapsed = started.elapsed();
    let allocations = ALLOCATIONS.load(Ordering::Relaxed);
    let allocated_bytes = ALLOCATED_BYTES.load(Ordering::Relaxed);
    println!(
        "{{\"kind\":\"sampler-cost\",\"provider\":\"linux-proc-cadenced\",\"iterations\":{},\"elapsed_ms\":{:.3},\"ns_per_sample\":{:.1},\"samples_per_sec\":{:.1},\"frame_bytes\":{},\"fresh_cpu\":{},\"fresh_memory\":{},\"fresh_network\":{},\"fresh_load\":{},\"allocations\":{},\"allocated_bytes\":{},\"allocations_per_sample\":{:.6}}}",
        iterations,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_nanos() as f64 / iterations as f64,
        iterations as f64 / elapsed.as_secs_f64(),
        FRAME_BYTES,
        fresh[0],
        fresh[1],
        fresh[2],
        fresh[3],
        allocations,
        allocated_bytes,
        allocations as f64 / iterations as f64,
    );
}

#[cfg(target_os = "linux")]
fn thread_cpu_time_ns() -> u64 {
    let mut value = MaybeUninit::<libc::timespec>::uninit();
    let status = unsafe { libc::clock_gettime(libc::CLOCK_THREAD_CPUTIME_ID, value.as_mut_ptr()) };
    assert_eq!(status, 0);
    let value = unsafe { value.assume_init() };
    (value.tv_sec as u64)
        .saturating_mul(1_000_000_000)
        .saturating_add(value.tv_nsec as u64)
}

#[cfg(target_os = "linux")]
fn bench_generic_resource_lib_burst(iterations: usize) {
    let host = linux_generic_resource_host().expect("preopen generic /proc resources");
    let mut telemetry = LinuxTelemetryLib::new(host).expect("open telemetry resources");
    for _ in 0..128 {
        telemetry.frame("fast").expect("warm telemetry lib");
    }
    ALLOCATIONS.store(0, Ordering::Relaxed);
    ALLOCATED_BYTES.store(0, Ordering::Relaxed);
    let reads_before = telemetry.host.read_calls;
    let cpu_before = thread_cpu_time_ns();
    let started = Instant::now();
    let mut encoded = [0u8; FRAME_BYTES];
    let mut checksum = 0u64;
    for _ in 0..iterations {
        let frame = telemetry
            .frame("fast")
            .expect("sample generic resource lib");
        frame.encode_into(&mut encoded);
        checksum = checksum.wrapping_add(frame.network_rx_total);
    }
    let elapsed = started.elapsed();
    let cpu_ns = thread_cpu_time_ns().saturating_sub(cpu_before);
    let reads = telemetry.host.read_calls.saturating_sub(reads_before);
    let allocations = ALLOCATIONS.load(Ordering::Relaxed);
    let allocated_bytes = ALLOCATED_BYTES.load(Ordering::Relaxed);
    println!(
        "{{\"kind\":\"generic-resource-lib-burst\",\"profile\":\"fast\",\"iterations\":{},\"elapsed_ms\":{:.3},\"thread_cpu_ms\":{:.3},\"samples_per_sec\":{:.1},\"host_reads\":{},\"host_reads_per_frame\":{:.6},\"allocations\":{},\"allocated_bytes\":{},\"allocations_per_frame\":{:.6},\"checksum\":{}}}",
        iterations,
        elapsed.as_secs_f64() * 1000.0,
        cpu_ns as f64 / 1_000_000.0,
        iterations as f64 / elapsed.as_secs_f64(),
        reads,
        reads as f64 / iterations as f64,
        allocations,
        allocated_bytes,
        allocations as f64 / iterations as f64,
        checksum,
    );
}

#[cfg(target_os = "linux")]
fn bench_generic_resource_lib_1khz(profile: &'static str, frames: u64) {
    assert!(matches!(profile, "fast" | "balanced" | "economy"));
    let host = linux_generic_resource_host().expect("preopen generic /proc resources");
    let mut telemetry = LinuxTelemetryLib::new(host).expect("open telemetry resources");
    let period = Duration::from_millis(1);
    let started = Instant::now();
    let cpu_started = thread_cpu_time_ns();
    let reads_before = telemetry.host.read_calls;
    ALLOCATIONS.store(0, Ordering::Relaxed);
    ALLOCATED_BYTES.store(0, Ordering::Relaxed);
    let mut next = started;
    let mut max_late_ns = 0u64;
    let mut deadline_misses = 0u64;
    let mut periods_late = 0u64;
    let mut fresh = [0u64; 4];
    let mut encoded = [0u8; FRAME_BYTES];
    let mut checksum = 0u64;
    for _ in 0..frames {
        let before = Instant::now();
        if before < next {
            thread::sleep(next - before);
        }
        let actual = Instant::now();
        let late = actual.saturating_duration_since(next);
        let late_ns = late.as_nanos().min(u64::MAX as u128) as u64;
        max_late_ns = max_late_ns.max(late_ns);
        if late >= period {
            deadline_misses = deadline_misses.saturating_add(1);
            periods_late = periods_late
                .saturating_add((late.as_nanos() / period.as_nanos()).min(u64::MAX as u128) as u64);
        }
        let frame = telemetry
            .frame(profile)
            .expect("sample generic resource lib");
        frame.encode_into(&mut encoded);
        fresh[0] += u64::from(frame.freshness_mask & FRESH_CPU != 0);
        fresh[1] += u64::from(frame.freshness_mask & FRESH_MEMORY != 0);
        fresh[2] += u64::from(frame.freshness_mask & FRESH_NETWORK != 0);
        fresh[3] += u64::from(frame.freshness_mask & FRESH_LOAD != 0);
        checksum = checksum
            .wrapping_add(frame.network_rx_total)
            .wrapping_add(frame.cpu_milli_pct as u64);
        next += period;
    }
    let elapsed = started.elapsed();
    let cpu_ns = thread_cpu_time_ns().saturating_sub(cpu_started);
    let reads = telemetry.host.read_calls.saturating_sub(reads_before);
    let allocations = ALLOCATIONS.load(Ordering::Relaxed);
    let allocated_bytes = ALLOCATED_BYTES.load(Ordering::Relaxed);
    println!(
        "{{\"kind\":\"generic-resource-lib-1khz\",\"profile\":\"{}\",\"frames\":{},\"elapsed_ms\":{:.3},\"effective_hz\":{:.3},\"thread_cpu_ms\":{:.3},\"thread_cpu_percent\":{:.3},\"host_open_calls\":{},\"host_reads\":{},\"host_reads_per_frame\":{:.6},\"fresh_cpu\":{},\"fresh_memory\":{},\"fresh_network\":{},\"fresh_load\":{},\"deadline_misses\":{},\"periods_late\":{},\"max_late_us\":{:.3},\"allocations\":{},\"allocated_bytes\":{},\"allocations_per_frame\":{:.6},\"checksum\":{}}}",
        profile,
        frames,
        elapsed.as_secs_f64() * 1000.0,
        frames as f64 / elapsed.as_secs_f64(),
        cpu_ns as f64 / 1_000_000.0,
        cpu_ns as f64 / elapsed.as_nanos() as f64 * 100.0,
        telemetry.host.open_calls,
        reads,
        reads as f64 / frames as f64,
        fresh[0],
        fresh[1],
        fresh[2],
        fresh[3],
        deadline_misses,
        periods_late,
        max_late_ns as f64 / 1000.0,
        allocations,
        allocated_bytes,
        allocations as f64 / frames as f64,
        checksum,
    );
}

#[cfg(target_os = "linux")]
fn bench_linux_proc_1khz_soak(frames: u64, batch: usize) {
    assert!(frames > 0);
    assert!(batch > 0);
    let ring = Arc::new(Ring::new(8192));
    let host = HostSession::new(ring.clone());
    let endpoint = host.open(SELECTOR).unwrap();
    let mut window = host.window_acquire(FRAME_BYTES * batch).unwrap();
    let period = Duration::from_millis(1);
    let producer_ring = ring.clone();
    let producer = thread::spawn(move || {
        let mut sampler = LinuxProcSampler::new().expect("open /proc telemetry files");
        let started = Instant::now();
        let mut next = started;
        let mut max_late_ns = 0u64;
        let mut deadline_misses = 0u64;
        let mut periods_late = 0u64;
        for _ in 0..frames {
            let before = Instant::now();
            if before < next {
                thread::sleep(next - before);
            }
            let actual = Instant::now();
            let late = actual.saturating_duration_since(next);
            let late_ns = late.as_nanos().min(u64::MAX as u128) as u64;
            max_late_ns = max_late_ns.max(late_ns);
            if late >= period {
                deadline_misses = deadline_misses.saturating_add(1);
                periods_late = periods_late.saturating_add(
                    (late.as_nanos() / period.as_nanos()).min(u64::MAX as u128) as u64,
                );
            }
            producer_ring.push(
                sampler
                    .sample_cadenced()
                    .expect("sample cadenced /proc telemetry"),
            );
            next += period;
        }
        producer_ring.close();
        (
            started.elapsed(),
            max_late_ns,
            deadline_misses,
            periods_late,
        )
    });

    let consumer_started = Instant::now();
    let mut consumed = 0u64;
    let mut sequence_gaps = 0u64;
    let mut last_sequence = 0u64;
    let mut batches = 0u64;
    loop {
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
            batches = batches.saturating_add(1);
            consumed = consumed.saturating_add(count as u64);
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
    let (producer_elapsed, max_late_ns, deadline_misses, periods_late) = producer.join().unwrap();
    let consumer_elapsed = consumer_started.elapsed();
    let (_, ring_dropped, _) = ring.stats();
    assert_eq!(consumed, frames);
    let metrics = &host.metrics;
    println!(
        "{{\"kind\":\"linux-proc-1khz-soak\",\"target_frames\":{},\"batch\":{},\"producer_elapsed_ms\":{:.3},\"consumer_elapsed_ms\":{:.3},\"effective_hz\":{:.3},\"consumed\":{},\"ring_dropped\":{},\"sequence_gaps\":{},\"deadline_misses\":{},\"periods_late\":{},\"max_late_us\":{:.3},\"batches\":{},\"read_calls\":{},\"wait_calls\":{},\"host_calls_per_frame\":{:.6}}}",
        frames,
        batch,
        producer_elapsed.as_secs_f64() * 1000.0,
        consumer_elapsed.as_secs_f64() * 1000.0,
        frames as f64 / producer_elapsed.as_secs_f64(),
        consumed,
        ring_dropped,
        sequence_gaps,
        deadline_misses,
        periods_late,
        max_late_ns as f64 / 1000.0,
        batches,
        metrics.read_calls.load(Ordering::Relaxed),
        metrics.wait_calls.load(Ordering::Relaxed),
        (metrics.read_calls.load(Ordering::Relaxed)
            + metrics.wait_calls.load(Ordering::Relaxed)) as f64
            / consumed as f64,
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

fn overrun_probe() {
    let ring = Arc::new(Ring::new(32));
    let host = HostSession::new(ring.clone());
    let endpoint = host.open(SELECTOR).unwrap();
    let mut window = host.window_acquire(FRAME_BYTES * 8).unwrap();
    let epoch = Instant::now();
    for sequence in 1..=16 {
        ring.push(Frame::synthetic(sequence, epoch));
    }
    let first_count = match host.read(&endpoint, &mut window, 8).unwrap() {
        Submission::Completed(count) => count,
        Submission::Pending(_) => panic!("prefilled ring unexpectedly pending"),
    };
    assert_eq!(first_count, 8);
    let mut last_bytes = [0u8; 8];
    let last_offset = (first_count - 1) * FRAME_BYTES;
    last_bytes.copy_from_slice(&window.bytes[last_offset..last_offset + 8]);
    let previous_sequence = u64::from_le_bytes(last_bytes);
    assert_eq!(previous_sequence, 8);

    for sequence in 17..=80 {
        ring.push(Frame::synthetic(sequence, epoch));
    }
    let (_, ring_dropped, _) = ring.stats();
    assert_eq!(ring_dropped, 40);
    let second_count = match host.read(&endpoint, &mut window, 8).unwrap() {
        Submission::Completed(count) => count,
        Submission::Pending(_) => panic!("overrun ring unexpectedly pending"),
    };
    assert_eq!(second_count, 8);
    let mut first_bytes = [0u8; 8];
    first_bytes.copy_from_slice(&window.bytes[..8]);
    let resumed_sequence = u64::from_le_bytes(first_bytes);
    let sequence_gap = resumed_sequence - previous_sequence - 1;
    assert_eq!(resumed_sequence, 49);
    assert_eq!(sequence_gap, ring_dropped);
    println!(
        "{{\"kind\":\"overrun-probe\",\"ring_capacity\":32,\"previous_sequence\":{},\"resumed_sequence\":{},\"ring_dropped\":{},\"sequence_gap\":{},\"silent_loss\":false}}",
        previous_sequence, resumed_sequence, ring_dropped, sequence_gap,
    );
}

fn main() {
    #[cfg(target_os = "linux")]
    if std::env::args().any(|argument| argument == "--generic-resource-only") {
        bench_generic_resource_lib_burst(20_000);
        bench_generic_resource_lib_1khz("fast", 5_000);
        bench_generic_resource_lib_1khz("balanced", 5_000);
        bench_generic_resource_lib_1khz("economy", 5_000);
        return;
    }
    cancellation_probe();
    overrun_probe();
    bench_sampler(2_000);
    bench_sysinfo_cadenced_sampler(10_000);
    #[cfg(target_os = "linux")]
    bench_linux_proc_sampler(10_000);
    #[cfg(target_os = "linux")]
    bench_linux_proc_cadenced_sampler(20_000);
    #[cfg(target_os = "linux")]
    bench_generic_resource_lib_burst(20_000);
    #[cfg(target_os = "linux")]
    bench_generic_resource_lib_1khz("fast", 5_000);
    #[cfg(target_os = "linux")]
    bench_generic_resource_lib_1khz("balanced", 5_000);
    #[cfg(target_os = "linux")]
    bench_generic_resource_lib_1khz("economy", 5_000);
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
    bench_stream("sysinfo-cadenced", 1000, 32, 1200);
    #[cfg(target_os = "linux")]
    for (hz, millis) in [(100, 1200), (1000, 1200)] {
        bench_stream("linux-proc", hz, 32, millis);
    }
    #[cfg(target_os = "linux")]
    bench_stream("linux-proc-cadenced", 1000, 32, 1200);
    #[cfg(target_os = "linux")]
    bench_linux_proc_1khz_soak(5_000, 32);
}
