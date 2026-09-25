//! Explicit Linux embedding example, NOT a telemetry-specific Host ABI.
//! Opens four fixed read-only resources once, samples without child processes,
//! and refuses incomplete bounded reads. Core Lib never selects or opens paths.
#[cfg(target_os = "linux")]
mod linux {
    use std::fs::{self, File};
    use std::io::{self, Read, Seek, SeekFrom};
    use std::time::{Duration, Instant};
    use wasmc_system_telemetry::{Profile, Sampler, Snapshots, MAX_SNAPSHOT_BYTES};

    fn complete<R: Read + Seek>(source: &mut R, buffer: &mut [u8]) -> io::Result<usize> {
        source.seek(SeekFrom::Start(0))?;
        let mut n = 0;
        while n < buffer.len() {
            match source.read(&mut buffer[n..]) {
                Ok(0) => return Ok(n),
                Ok(m) => n += m,
                Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(e),
            }
        }
        let mut extra = [0];
        loop {
            match source.read(&mut extra) {
                Ok(0) => return Ok(n),
                Ok(_) => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "resource snapshot exceeds bound",
                    ))
                }
                Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(e),
            }
        }
    }

    pub fn run() -> Result<(), Box<dyn std::error::Error>> {
        let before = fs::read_dir("/proc/self/fd")?.count();
        let epoch = Instant::now();
        let mut state = Sampler::new(Profile::Balanced);
        let mut frame = None;
        let mut reads = 0u64;
        {
            // Explicit caller grant. No arbitrary path supplied by the guest.
            let mut files = [
                File::open("/proc/stat")?,
                File::open("/proc/meminfo")?,
                File::open("/proc/net/dev")?,
                File::open("/proc/loadavg")?,
            ];
            let mut buffers: [Vec<u8>; 4] = std::array::from_fn(|_| vec![0; MAX_SNAPSHOT_BYTES]);
            let mut lengths = [0usize; 4];
            for _ in 0..100 {
                let now = u64::try_from(epoch.elapsed().as_nanos())?;
                let mask = state
                    .refresh_mask(now)
                    .map_err(|e| format!("cadence: {e:?}"))?;
                for i in 0..4 {
                    if mask & (1 << i) != 0 {
                        lengths[i] = complete(&mut files[i], &mut buffers[i])?;
                        reads += 1;
                    }
                }
                let text = |i: usize| std::str::from_utf8(&buffers[i][..lengths[i]]);
                let input = Snapshots {
                    cpu: if mask & 1 != 0 { Some(text(0)?) } else { None },
                    memory: if mask & 2 != 0 { Some(text(1)?) } else { None },
                    network: if mask & 4 != 0 { Some(text(2)?) } else { None },
                    load: if mask & 8 != 0 { Some(text(3)?) } else { None },
                };
                let next = state
                    .sample(now, input)
                    .map_err(|e| format!("sample: {e:?}"))?;
                next.encode().map_err(|e| format!("frame: {e:?}"))?;
                frame = Some(next);
                std::thread::sleep(Duration::from_millis(1));
            }
        } // every preopened file closes before fd readback
        let after = fs::read_dir("/proc/self/fd")?.count();
        if before != after {
            return Err(format!("FD leak: {before}->{after}").into());
        }
        let f = frame.ok_or("no frames")?;
        if f.sequence != 100 {
            return Err("frame count mismatch".into());
        }
        println!("{{\"accepted\":true,\"profile\":\"linux-native-balanced-local\",\"frames\":{},\"resource_reads\":{},\"fd_before\":{},\"fd_after\":{},\"memory_bytes\":{},\"network_rx_bytes\":{},\"sampling_uses_shell\":false,\"release_qualified\":false}}",
            f.sequence, reads, before, after, f.available_memory, f.network_rx_total);
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::io::Cursor;
        #[test]
        fn rejects_truncated_resource() {
            assert!(complete(&mut Cursor::new(b"abcdef"), &mut [0; 3]).is_err());
        }
        #[test]
        fn exact_capacity_is_valid_only_at_eof() {
            assert_eq!(complete(&mut Cursor::new(b"abc"), &mut [0; 3]).unwrap(), 3);
        }
        struct Short(Cursor<Vec<u8>>);
        impl Read for Short {
            fn read(&mut self, b: &mut [u8]) -> io::Result<usize> {
                let n = b.len().min(1);
                self.0.read(&mut b[..n])
            }
        }
        impl Seek for Short {
            fn seek(&mut self, p: SeekFrom) -> io::Result<u64> {
                self.0.seek(p)
            }
        }
        #[test]
        fn short_read_is_not_end_of_file() {
            let mut b = [0; 6];
            assert_eq!(
                complete(&mut Short(Cursor::new(b"abcde".to_vec())), &mut b).unwrap(),
                5
            );
            assert_eq!(&b[..5], b"abcde");
        }
    }
}
#[cfg(target_os = "linux")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    linux::run()
}
#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("Linux acquisition is the only implemented adapter; no simulated data.");
    std::process::exit(2);
}
