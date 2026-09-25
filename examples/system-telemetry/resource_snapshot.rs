//! Caller-side bounded reads using only the published generic Host SDK.
//! No telemetry semantics, raw resource identities, or private SDK internals.
use wasmc_host::{HostError, HostErrorCode, ResourceHandle, WasmcHost};

pub const SNAPSHOT_LIMIT: usize = 262_144;
const READ_CHUNK: usize = 16_384;

pub fn complete(
    host: &mut WasmcHost,
    handle: ResourceHandle,
    buffer: &mut [u8],
) -> Result<(usize, u64), HostError> {
    let mut used = 0usize;
    let mut calls = 0u64;
    while used < buffer.len() {
        let requested = READ_CHUNK.min(buffer.len() - used);
        let count = host.read(
            handle,
            Some(used as u64),
            &mut buffer[used..used + requested],
        )?;
        calls += 1;
        if count > requested {
            return Err(HostError::new(
                HostErrorCode::Bounds,
                "resource over-reported read length",
            ));
        }
        if count == 0 {
            return Ok((used, calls));
        }
        used += count;
    }
    // Exact capacity is valid only after independently establishing EOF.
    let mut extra = [0u8; 1];
    let count = host.read(handle, Some(used as u64), &mut extra)?;
    calls += 1;
    if count != 0 {
        return Err(HostError::new(
            HostErrorCode::Bounds,
            "resource snapshot exceeds bound",
        ));
    }
    Ok((used, calls))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    use wasmc_host::ResourceBinding;

    struct Input {
        data: Vec<u8>,
        short: bool,
        overreport: bool,
        fail_at: Option<u64>,
        releases: Arc<AtomicUsize>,
    }
    impl ResourceBinding for Input {
        fn read(&mut self, pos: Option<u64>, out: &mut [u8]) -> Result<usize, HostError> {
            let pos = pos.unwrap_or(0);
            if self.fail_at.is_some_and(|at| pos >= at) {
                return Err(HostError::new(
                    HostErrorCode::External,
                    "injected read failure",
                ));
            }
            if self.overreport {
                return Ok(out.len() + 1);
            }
            let available = self.data.get(pos as usize..).unwrap_or_default();
            let n = available
                .len()
                .min(out.len())
                .min(if self.short { 1 } else { usize::MAX });
            out[..n].copy_from_slice(&available[..n]);
            Ok(n)
        }
        fn release(&mut self) -> Result<(), HostError> {
            self.releases.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
    }
    fn host(
        data: &[u8],
        short: bool,
        overreport: bool,
        fail_at: Option<u64>,
    ) -> (WasmcHost, ResourceHandle, Arc<AtomicUsize>) {
        let releases = Arc::new(AtomicUsize::new(0));
        let h = WasmcHost::builder()
            .grant_resource(
                "test.input",
                Box::new(Input {
                    data: data.into(),
                    short,
                    overreport,
                    fail_at,
                    releases: releases.clone(),
                }),
            )
            .unwrap()
            .build()
            .unwrap();
        let handle = h.open("test.input").unwrap();
        (h, handle, releases)
    }
    fn retire(mut h: WasmcHost, id: ResourceHandle, count: Arc<AtomicUsize>) {
        h.release(id).unwrap();
        assert_eq!(count.load(Ordering::SeqCst), 1);
        assert_eq!(
            h.read(id, Some(0), &mut [0u8]).unwrap_err().code(),
            HostErrorCode::UnknownResource
        );
        assert!(h.release(id).is_err());
        assert_eq!(count.load(Ordering::SeqCst), 1);
        assert!(h.selectors().next().is_none());
    }
    #[test]
    fn short_reads_preserve_complete_snapshot() {
        let (mut h, id, count) = host(b"abcde", true, false, None);
        let mut out = [0; 6];
        let (n, calls) = complete(&mut h, id, &mut out).unwrap();
        assert_eq!(&out[..n], b"abcde");
        assert_eq!(calls, 6);
        retire(h, id, count);
    }
    #[test]
    fn exact_capacity_requires_eof() {
        let (mut h, id, count) = host(b"abc", false, false, None);
        assert_eq!(complete(&mut h, id, &mut [0; 3]).unwrap(), (3, 2));
        retire(h, id, count);
    }
    #[test]
    fn oversized_snapshot_rejects_and_releases() {
        let (mut h, id, count) = host(b"abcd", false, false, None);
        assert_eq!(
            complete(&mut h, id, &mut [0; 3]).unwrap_err().code(),
            HostErrorCode::Bounds
        );
        retire(h, id, count);
    }
    #[test]
    fn malicious_read_length_rejects() {
        let (mut h, id, count) = host(b"abc", false, true, None);
        assert_eq!(
            complete(&mut h, id, &mut [0; 3]).unwrap_err().code(),
            HostErrorCode::Bounds
        );
        retire(h, id, count);
    }
    #[test]
    fn partial_read_failure_is_not_success() {
        let (mut h, id, count) = host(b"abc", true, false, Some(1));
        assert_eq!(
            complete(&mut h, id, &mut [0; 4]).unwrap_err().code(),
            HostErrorCode::External
        );
        retire(h, id, count);
    }
    #[test]
    fn explicit_grants_deny_unknown_selector() {
        let (h, id, count) = host(b"", false, false, None);
        assert_eq!(
            h.open("/etc/passwd").unwrap_err().code(),
            HostErrorCode::UnknownResource
        );
        retire(h, id, count);
    }
    #[test]
    fn empty_input_is_a_complete_snapshot() {
        let (mut h, id, count) = host(b"", false, false, None);
        assert_eq!(complete(&mut h, id, &mut [0; 4]).unwrap(), (0, 1));
        retire(h, id, count);
    }
    #[test]
    fn repeated_reads_restart_at_zero() {
        let (mut h, id, count) = host(b"abc", false, false, None);
        for _ in 0..128 {
            let mut out = [0; 4];
            let (n, _) = complete(&mut h, id, &mut out).unwrap();
            assert_eq!(&out[..n], b"abc");
        }
        retire(h, id, count);
    }
    #[test]
    fn unsupported_write_does_not_change_input() {
        let (mut h, id, count) = host(b"abc", false, false, None);
        assert_eq!(
            h.write(id, Some(0), b"x").unwrap_err().code(),
            HostErrorCode::Unsupported
        );
        let mut out = [0; 4];
        let (n, _) = complete(&mut h, id, &mut out).unwrap();
        assert_eq!(&out[..n], b"abc");
        retire(h, id, count);
    }
}
