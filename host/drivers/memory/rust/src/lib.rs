#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryError {
    Retired,
    Bounds,
    Capacity,
}

pub struct BoundedMemory {
    bytes: Option<Vec<u8>>,
    capacity: usize,
}

impl BoundedMemory {
    pub fn new(capacity: usize) -> Result<Self, MemoryError> {
        if capacity == 0 {
            return Err(MemoryError::Capacity);
        }
        Ok(Self {
            bytes: Some(vec![0; capacity]),
            capacity,
        })
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    fn live(&self) -> Result<&Vec<u8>, MemoryError> {
        self.bytes.as_ref().ok_or(MemoryError::Retired)
    }

    fn live_mut(&mut self) -> Result<&mut Vec<u8>, MemoryError> {
        self.bytes.as_mut().ok_or(MemoryError::Retired)
    }

    fn range(&self, offset: usize, length: usize) -> Result<std::ops::Range<usize>, MemoryError> {
        let end = offset.checked_add(length).ok_or(MemoryError::Bounds)?;
        if end > self.capacity {
            return Err(MemoryError::Bounds);
        }
        Ok(offset..end)
    }

    pub fn read(&self, offset: usize, length: usize) -> Result<Vec<u8>, MemoryError> {
        let range = self.range(offset, length)?;
        Ok(self.live()?[range].to_vec())
    }

    pub fn write(&mut self, offset: usize, input: &[u8]) -> Result<(), MemoryError> {
        let range = self.range(offset, input.len())?;
        self.live_mut()?[range].copy_from_slice(input);
        Ok(())
    }

    pub fn release(&mut self) -> Result<(), MemoryError> {
        self.bytes.take().ok_or(MemoryError::Retired)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_read_write_and_retirement() {
        let mut memory = BoundedMemory::new(64).unwrap();
        assert_eq!(memory.capacity(), 64);
        memory.write(7, b"wasmc").unwrap();
        assert_eq!(memory.read(7, 5).unwrap(), b"wasmc");
        assert_eq!(memory.read(64, 0).unwrap(), Vec::<u8>::new());
        assert_eq!(memory.write(63, b"ab"), Err(MemoryError::Bounds));
        assert_eq!(memory.read(63, 2), Err(MemoryError::Bounds));
        memory.release().unwrap();
        assert_eq!(memory.read(0, 1), Err(MemoryError::Retired));
        assert_eq!(memory.write(0, b"x"), Err(MemoryError::Retired));
        assert_eq!(memory.release(), Err(MemoryError::Retired));
    }

    #[test]
    fn zero_capacity_is_rejected() {
        assert_eq!(BoundedMemory::new(0).err(), Some(MemoryError::Capacity));
    }
}
