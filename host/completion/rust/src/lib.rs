use std::{
    collections::BTreeMap,
    sync::atomic::{AtomicU32, Ordering},
};
static NEXT: AtomicU32 = AtomicU32::new(1);
pub mod owner_supervisor;
pub mod scoped;
struct Window {
    size: usize,
    pins: bool,
    bytes: Vec<u8>,
}

struct Operation {
    window: i32,
    state: &'static str,
    drained: bool,
    error: i32,
}
pub struct CompletionGuard {
    owner: i32,
    seq: i32,
    revoked: bool,
    windows: BTreeMap<i32, Window>,
    ops: BTreeMap<i32, Operation>,
}
impl CompletionGuard {
    pub fn new() -> Result<Self, i32> {
        let owner = NEXT
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |n| {
                (n <= 32767).then_some(n + 1)
            })
            .map_err(|_| -3)? as i32;
        Ok(Self::with_owner(owner))
    }
    // Scoped fresh CSPRNG binding only. Raw integers must remain private.
    pub(crate) fn fresh_binding_local() -> Self {
        Self::with_owner(1)
    }
    fn with_owner(owner: i32) -> Self {
        Self {
            owner,
            seq: 1,
            revoked: false,
            windows: BTreeMap::new(),
            ops: BTreeMap::new(),
        }
    }
    fn id(&mut self) -> Result<i32, i32> {
        if self.seq > 32767 {
            return Err(-3);
        }
        let id = self.owner * 65536 + self.seq;
        self.seq += 1;
        Ok(id)
    }
    fn valid(&self, id: i32) -> Result<(), i32> {
        if id / 65536 != self.owner {
            Err(-1)
        } else {
            Ok(())
        }
    }
    pub fn acquire(&mut self, size: i32) -> Result<i32, i32> {
        if self.revoked {
            return Err(-2);
        }
        if !(0..=16).contains(&size) {
            return Err(-5);
        }
        if self.windows.len() >= 4 {
            return Err(-3);
        }
        let id = self.id()?;
        self.windows.insert(
            id,
            Window {
                size: size as usize,
                pins: false,
                bytes: Vec::new(),
            },
        );
        Ok(id)
    }
    pub fn submit(&mut self, window: i32) -> Result<i32, i32> {
        if self.revoked {
            return Err(-2);
        }
        self.valid(window)?;
        if self.windows.get(&window).ok_or(-1)?.pins {
            return Err(-4);
        }
        if self.ops.len() >= 4 {
            return Err(-3);
        }
        let id = self.id()?;
        let w = self.windows.get_mut(&window).ok_or(-1)?;
        w.pins = true;
        w.bytes.clear();
        self.ops.insert(
            id,
            Operation {
                window,
                state: "pending",
                drained: false,
                error: 0,
            },
        );
        Ok(id)
    }
    pub fn cancel(&mut self, id: i32) -> Result<i32, i32> {
        self.valid(id)?;
        let o = self.ops.get_mut(&id).ok_or(-1)?;
        if o.state != "pending" {
            return Err(-4);
        }
        o.state = "cancelled";
        Ok(0)
    }
    pub fn complete(&mut self, id: i32, bytes: &[u8], error: i32) -> Result<i32, i32> {
        self.valid(id)?;
        let o = self.ops.get_mut(&id).ok_or(-1)?;
        if o.drained {
            return Err(-1);
        }
        let w = self.windows.get_mut(&o.window).ok_or(-1)?;
        if error > 0 || bytes.len() > w.size {
            return Err(-5);
        }
        if o.state != "cancelled" {
            o.state = if error == 0 { "done" } else { "failed" };
            o.error = error;
            w.bytes = if error == 0 {
                bytes.to_vec()
            } else {
                Vec::new()
            };
        }
        o.drained = true;
        w.pins = false;
        Ok(0)
    }
    pub fn poll(&self, id: i32) -> Result<(&'static str, bool, i32), i32> {
        self.valid(id)?;
        let o = self.ops.get(&id).ok_or(-1)?;
        Ok((o.state, o.drained, o.error))
    }
    pub fn read(&self, id: i32) -> Result<Vec<u8>, i32> {
        if self.revoked {
            return Err(-2);
        }
        self.valid(id)?;
        let w = self.windows.get(&id).ok_or(-1)?;
        if w.pins {
            return Err(-4);
        }
        Ok(w.bytes.clone())
    }
    pub fn release(&mut self, id: i32) -> Result<i32, i32> {
        self.valid(id)?;
        if let Some(w) = self.windows.get(&id) {
            if w.pins {
                return Err(-4);
            }
            self.windows.remove(&id);
        } else {
            let o = self.ops.get(&id).ok_or(-1)?;
            if !o.drained {
                return Err(-4);
            }
            self.ops.remove(&id);
        }
        Ok(0)
    }
    pub fn revoke(&mut self) -> i32 {
        self.revoked = true;
        for o in self.ops.values_mut() {
            if o.state == "pending" {
                o.state = "cancelled"
            }
        }
        for w in self.windows.values_mut() {
            w.bytes.clear()
        }
        0
    }
    pub fn counts(&self) -> [usize; 2] {
        [self.windows.len(), self.ops.len()]
    }
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod scoped_tests;
