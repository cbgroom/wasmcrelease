use std::{
    fs::File,
    io::{Read, Seek, SeekFrom, Write},
};
/// Exclusive preopened file capability; no untrusted path resolver.
pub struct PreopenedFile {
    file: Option<File>,
    writable: bool,
    max_io_bytes: usize,
    max_extent_bytes: usize,
}
impl PreopenedFile {
    pub fn new(file: File, writable: bool) -> Self {
        Self::with_limits(file, writable, 16, 64).expect("legacy file limits are valid")
    }

    pub fn with_limits(
        file: File,
        writable: bool,
        max_io_bytes: usize,
        max_extent_bytes: usize,
    ) -> Result<Self, i32> {
        if max_io_bytes == 0 || max_extent_bytes == 0 || max_io_bytes > max_extent_bytes {
            return Err(-5);
        }
        Ok(Self {
            file: Some(file),
            writable,
            max_io_bytes,
            max_extent_bytes,
        })
    }

    pub fn max_io_bytes(&self) -> usize {
        self.max_io_bytes
    }

    pub fn max_extent_bytes(&self) -> usize {
        self.max_extent_bytes
    }

    pub fn writable(&self) -> bool {
        self.writable
    }

    pub fn read_into(&mut self, offset: i64, destination: &mut [u8]) -> Result<usize, i32> {
        self.check(offset, destination.len())?;
        let file = self.file.as_mut().ok_or(-1)?;
        file.seek(SeekFrom::Start(offset as u64)).map_err(|_| -8)?;
        file.read(destination).map_err(|_| -8)
    }

    pub fn is_live(&self) -> bool {
        self.file.is_some()
    }

    pub fn legacy_profile() -> (usize, usize) {
        (16, 64)
    }

    pub fn read(&mut self, offset: i64, length: usize) -> Result<Vec<u8>, i32> {
        self.check(offset, length)?;
        let mut bytes = vec![0; length];
        let count = self.read_into(offset, &mut bytes)?;
        bytes.truncate(count);
        Ok(bytes)
    }

    fn check(&self, offset: i64, length: usize) -> Result<(), i32> {
        if self.file.is_none() {
            return Err(-1);
        }
        let offset = usize::try_from(offset).map_err(|_| -5)?;
        let end = offset.checked_add(length).ok_or(-5)?;
        if length > self.max_io_bytes || offset > self.max_extent_bytes || end > self.max_extent_bytes {
            return Err(-5);
        }
        Ok(())
    }
    pub fn write(&mut self, offset: i64, bytes: &[u8]) -> Result<usize, i32> {
        self.check(offset, bytes.len())?;
        if !self.writable {
            return Err(-2);
        }
        let file = self.file.as_mut().unwrap();
        file.seek(SeekFrom::Start(offset as u64)).map_err(|_| -8)?;
        file.write_all(bytes).map_err(|_| -9)?;
        Ok(bytes.len())
    }
    pub fn invoke_sync(&mut self) -> Result<(), i32> {
        let file = self.file.as_ref().ok_or(-1)?;
        if !self.writable {
            return Err(-2);
        }
        file.sync_all().map_err(|_| -8)
    }
    pub fn release(&mut self) -> Result<(), i32> {
        self.file.take().ok_or(-1)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs::OpenOptions,
        io::{Seek, SeekFrom, Write},
        sync::atomic::{AtomicU64, Ordering},
    };

    static NEXT_TEMP: AtomicU64 = AtomicU64::new(1);

    fn temporary_file() -> (std::path::PathBuf, File) {
        let name = format!(
            "wasmc-file-driver-{}-{}",
            std::process::id(),
            NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
        );
        let path = std::env::temp_dir().join(name);
        let mut file = OpenOptions::new()
            .create_new(true)
            .read(true)
            .write(true)
            .open(&path)
            .unwrap();
        file.write_all(b"abcdefghijklmnopqrstuvwxyz").unwrap();
        file.seek(SeekFrom::Start(0)).unwrap();
        (path, file)
    }

    #[test]
    fn legacy_constructor_keeps_16_by_64_profile() {
        let (path, file) = temporary_file();
        let mut resource = PreopenedFile::new(file, false);
        assert_eq!(PreopenedFile::legacy_profile(), (16, 64));
        assert_eq!(resource.max_io_bytes(), 16);
        assert_eq!(resource.max_extent_bytes(), 64);
        assert_eq!(resource.read(0, 16).unwrap().len(), 16);
        assert_eq!(resource.read(0, 17), Err(-5));
        assert_eq!(resource.read(i64::MAX, 1), Err(-5));
        resource.release().unwrap();
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn configurable_profile_supports_large_bounded_reads_without_allocation() {
        let (path, file) = temporary_file();
        let mut resource = PreopenedFile::with_limits(file, false, 4096, 16384).unwrap();
        let mut destination = [0_u8; 32];
        let count = resource.read_into(0, &mut destination).unwrap();
        assert_eq!(count, 26);
        assert_eq!(&destination[..count], b"abcdefghijklmnopqrstuvwxyz");
        assert_eq!(resource.read_into(16380, &mut destination), Err(-5));
        resource.release().unwrap();
        std::fs::remove_file(path).unwrap();
    }
}
