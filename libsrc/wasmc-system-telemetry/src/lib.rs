//! Telemetry parsing and cadence: no ambient filesystem, clock or process I/O.
//! Origin: generic-resource experiment 8522ccd20498dc369c3aaf5e2bb604a55cf89c17.
//! The successor uses checked parsing and transactional state. Old benchmark
//! performance receipts do not qualify this new source or its v3 wire format.
#[cfg(feature = "component")]
mod component;
pub const CPU: u32 = 1;
pub const MEMORY: u32 = 2;
pub const NETWORK: u32 = 4;
pub const LOAD: u32 = 8;
pub const ALL: u32 = 15;
pub const MAX_SNAPSHOT_BYTES: usize = 262_144;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    MalformedInput,
    MissingInput,
    InputTooLarge,
    Overflow,
    ClockRegressed,
}
#[derive(Clone, Copy, Debug)]
pub enum Profile {
    Fast,
    Balanced,
    Economy,
}
impl Profile {
    fn periods(self) -> [u64; 4] {
        match self {
            Self::Fast => [0, 10_000_000, 0, 100_000_000],
            Self::Balanced => [10_000_000, 10_000_000, 10_000_000, 100_000_000],
            Self::Economy => [50_000_000, 50_000_000, 50_000_000, 1_000_000_000],
        }
    }
}
#[derive(Clone, Copy, Debug, Default)]
pub struct Snapshots<'a> {
    pub cpu: Option<&'a str>,
    pub memory: Option<&'a str>,
    pub network: Option<&'a str>,
    pub load: Option<&'a str>,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Frame {
    pub sequence: u64,
    pub monotonic_ns: u64,
    pub available_memory: u64,
    pub used_swap: u64,
    pub network_rx_total: u64,
    pub network_tx_total: u64,
    /// None: baseline/reset/no-progress; never misrepresent it as measured zero.
    pub cpu_milli_pct: Option<u32>,
    pub load1_milli: u32,
    /// Resource refreshed, not an independent physical OS sampling guarantee.
    pub freshness_mask: u32,
}
impl Frame {
    /// Version 3: 64 bytes LE. Flags bit0 denotes unavailable CPU rate.
    /// Not the old flags-zero v2 identity; negotiate/pin the version explicitly.
    pub fn encode(self) -> Result<[u8; 64], Error> {
        if self.cpu_milli_pct.is_some_and(|v| v > 100_000) || self.freshness_mask & !ALL != 0 {
            return Err(Error::MalformedInput);
        }
        let mut out = [0; 64];
        for (i, v) in [
            self.sequence,
            self.monotonic_ns,
            self.available_memory,
            self.used_swap,
            self.network_rx_total,
            self.network_tx_total,
        ]
        .iter()
        .enumerate()
        {
            out[i * 8..i * 8 + 8].copy_from_slice(&v.to_le_bytes());
        }
        for (i, v) in [
            self.cpu_milli_pct.unwrap_or(0),
            self.load1_milli,
            self.freshness_mask,
            u32::from(self.cpu_milli_pct.is_none()),
        ]
        .iter()
        .enumerate()
        {
            out[48 + i * 4..52 + i * 4].copy_from_slice(&v.to_le_bytes());
        }
        Ok(out)
    }
}
#[derive(Clone, Debug)]
pub struct Sampler {
    profile: Profile,
    frame: Frame,
    cpu: Option<(u64, u64)>,
    refreshed_at: [u64; 4],
}
impl Sampler {
    pub fn new(profile: Profile) -> Self {
        Self {
            profile,
            frame: Frame::default(),
            cpu: None,
            refreshed_at: [0; 4],
        }
    }
    pub fn refresh_mask(&self, now: u64) -> Result<u32, Error> {
        if self.frame.sequence == 0 {
            return Ok(ALL);
        }
        if now < self.frame.monotonic_ns {
            return Err(Error::ClockRegressed);
        }
        Ok(self
            .profile
            .periods()
            .iter()
            .enumerate()
            .fold(0, |m, (i, p)| {
                m | if now - self.refreshed_at[i] >= *p {
                    1 << i
                } else {
                    0
                }
            }))
    }
    pub fn sample(&mut self, now: u64, input: Snapshots<'_>) -> Result<Frame, Error> {
        for s in [input.cpu, input.memory, input.network, input.load]
            .into_iter()
            .flatten()
        {
            if s.len() > MAX_SNAPSHOT_BYTES {
                return Err(Error::InputTooLarge);
            }
        }
        let mask = self.refresh_mask(now)?;
        let mut next = self.clone(); // fixed-size, allocation-free state
        if mask & CPU != 0 {
            let current = parse_cpu(input.cpu.ok_or(Error::MissingInput)?)?;
            next.frame.cpu_milli_pct = self.cpu.and_then(|p| {
                let total = current.0.checked_sub(p.0)?;
                let idle = current.1.checked_sub(p.1)?;
                if total == 0 || idle > total {
                    return None;
                }
                Some(((u128::from(total - idle) * 100_000) / u128::from(total)) as u32)
            });
            next.cpu = Some(current);
        }
        if mask & MEMORY != 0 {
            (next.frame.available_memory, next.frame.used_swap) =
                parse_memory(input.memory.ok_or(Error::MissingInput)?)?;
        }
        if mask & NETWORK != 0 {
            (next.frame.network_rx_total, next.frame.network_tx_total) =
                parse_network(input.network.ok_or(Error::MissingInput)?)?;
        }
        if mask & LOAD != 0 {
            next.frame.load1_milli = parse_load(input.load.ok_or(Error::MissingInput)?)?;
        }
        for i in 0..4 {
            if mask & (1 << i) != 0 {
                next.refreshed_at[i] = now;
            }
        }
        next.frame.sequence = self.frame.sequence.checked_add(1).ok_or(Error::Overflow)?;
        next.frame.monotonic_ns = now;
        next.frame.freshness_mask = mask;
        let frame = next.frame;
        *self = next; // only publish state after all required parses succeed
        Ok(frame)
    }
}
fn uint(s: &str) -> Result<u64, Error> {
    if s.is_empty() || !s.bytes().all(|v| v.is_ascii_digit()) {
        return Err(Error::MalformedInput);
    }
    s.parse().map_err(|_| Error::Overflow)
}
pub fn parse_cpu(s: &str) -> Result<(u64, u64), Error> {
    let line = s
        .lines()
        .find(|l| l.split_whitespace().next() == Some("cpu"))
        .ok_or(Error::MalformedInput)?;
    let (mut total, mut idle, mut count) = (0u64, 0u64, 0);
    // guest/guest_nice are already counted in user/nice.
    for (i, f) in line.split_whitespace().skip(1).take(8).enumerate() {
        let v = uint(f)?;
        total = total.checked_add(v).ok_or(Error::Overflow)?;
        if i == 3 || i == 4 {
            idle = idle.checked_add(v).ok_or(Error::Overflow)?;
        }
        count += 1;
    }
    if count < 4 {
        return Err(Error::MalformedInput);
    }
    Ok((total, idle))
}
pub fn parse_memory(s: &str) -> Result<(u64, u64), Error> {
    let mut values = [None; 3];
    for line in s.lines() {
        let mut f = line.split_whitespace();
        let i = match f.next() {
            Some("MemAvailable:") => 0,
            Some("SwapTotal:") => 1,
            Some("SwapFree:") => 2,
            _ => continue,
        };
        if values[i].is_some() {
            return Err(Error::MalformedInput);
        }
        let v = uint(f.next().ok_or(Error::MalformedInput)?)?
            .checked_mul(1024)
            .ok_or(Error::Overflow)?;
        if f.next() != Some("kB") || f.next().is_some() {
            return Err(Error::MalformedInput);
        }
        values[i] = Some(v);
    }
    let [Some(a), Some(t), Some(f)] = values else {
        return Err(Error::MissingInput);
    };
    Ok((a, t.checked_sub(f).ok_or(Error::MalformedInput)?))
}
pub fn parse_network(s: &str) -> Result<(u64, u64), Error> {
    let mut lines = s.lines();
    if !lines
        .next()
        .is_some_and(|v| v.contains("Receive") && v.contains("Transmit"))
        || !lines
            .next()
            .is_some_and(|v| v.contains("bytes") && v.contains("packets"))
    {
        return Err(Error::MalformedInput);
    }
    let (mut rx, mut tx) = (0u64, 0u64);
    for line in lines {
        let (name, fields) = line.rsplit_once(':').ok_or(Error::MalformedInput)?;
        if name.trim().is_empty() {
            return Err(Error::MalformedInput);
        }
        let mut values = [0u64; 16];
        let mut iter = fields.split_whitespace();
        for v in &mut values {
            *v = uint(iter.next().ok_or(Error::MalformedInput)?)?;
        }
        if iter.next().is_some() {
            return Err(Error::MalformedInput);
        }
        if name.trim() != "lo" {
            rx = rx.checked_add(values[0]).ok_or(Error::Overflow)?;
            tx = tx.checked_add(values[8]).ok_or(Error::Overflow)?;
        }
    }
    Ok((rx, tx))
}
pub fn parse_load(s: &str) -> Result<u32, Error> {
    let v = s.split_whitespace().next().ok_or(Error::MalformedInput)?;
    let (whole, fraction) = v.split_once('.').unwrap_or((v, ""));
    let whole = uint(whole)?;
    if !fraction.bytes().all(|v| v.is_ascii_digit()) {
        return Err(Error::MalformedInput);
    }
    let mut milli = 0;
    for (i, b) in fraction.bytes().take(3).enumerate() {
        milli += u64::from(b - b'0') * [100, 10, 1][i];
    }
    let v = whole
        .checked_mul(1000)
        .and_then(|n| n.checked_add(milli))
        .ok_or(Error::Overflow)?;
    u32::try_from(v).map_err(|_| Error::Overflow)
}
#[cfg(test)]
mod tests;
