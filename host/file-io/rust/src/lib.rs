use std::{
    fs::File,
    io::{Read, Seek, SeekFrom, Write},
};
/// Exclusive preopened file capability; no untrusted path resolver.
pub struct PreopenedFile {
    file: Option<File>,
    writable: bool,
}
impl PreopenedFile {
    pub fn new(file: File, writable: bool) -> Self {
        Self {
            file: Some(file),
            writable,
        }
    }
    fn check(&self, offset: i64, length: usize) -> Result<(), i32> {
        if self.file.is_none() {
            return Err(-1);
        }
        if offset < 0 || length > 16 || offset > 64 || offset as usize + length > 64 {
            return Err(-5);
        }
        Ok(())
    }
    pub fn read(&mut self, offset: i64, length: usize) -> Result<Vec<u8>, i32> {
        self.check(offset, length)?;
        let file = self.file.as_mut().unwrap();
        file.seek(SeekFrom::Start(offset as u64)).map_err(|_| -8)?;
        let mut bytes = vec![0; length];
        let count = file.read(&mut bytes).map_err(|_| -8)?;
        bytes.truncate(count);
        Ok(bytes)
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
