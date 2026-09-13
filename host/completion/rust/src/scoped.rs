use crate::CompletionGuard;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BindingIdentity([u8; 32]);
impl BindingIdentity {
    pub fn issue() -> Result<Self, i32> {
        Self::issue_with(|bytes| getrandom::fill(bytes).map_err(|_| ()))
    }
    fn issue_with(fill: impl FnOnce(&mut [u8; 32]) -> Result<(), ()>) -> Result<Self, i32> {
        let mut bytes = [0; 32];
        fill(&mut bytes).map_err(|_| -8)?;
        Self::from_bytes(bytes)
    }
    pub fn from_bytes(bytes: [u8; 32]) -> Result<Self, i32> {
        if bytes == [0; 32] {
            Err(-5)
        } else {
            Ok(Self(bytes))
        }
    }
    pub fn from_hex(text: &str) -> Result<Self, i32> {
        if text.len() != 64
            || !text
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(-5);
        }
        let mut bytes = [0; 32];
        for (i, b) in bytes.iter_mut().enumerate() {
            *b = u8::from_str_radix(&text[i * 2..i * 2 + 2], 16).map_err(|_| -5)?;
        }
        Self::from_bytes(bytes)
    }
    fn hex(self) -> String {
        self.0.iter().map(|b| format!("{b:02x}")).collect()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ScopedToken {
    identity: BindingIdentity,
    local: i32,
}
impl ScopedToken {
    pub fn to_wire(self) -> String {
        format!("{}:{}", self.identity.hex(), self.local)
    }
    pub fn from_wire(text: &str) -> Result<Self, i32> {
        if text.len() > 75 {
            return Err(-1);
        }
        let (identity, local) = text.split_once(':').ok_or(-1)?;
        if local.is_empty()
            || local.len() > 10
            || local.starts_with('0')
            || !local.bytes().all(|b| b.is_ascii_digit())
        {
            return Err(-1);
        }
        let local = local.parse::<i32>().map_err(|_| -1)?;
        if local <= 0 {
            return Err(-1);
        }
        Ok(Self {
            identity: BindingIdentity::from_hex(identity).map_err(|_| -1)?,
            local,
        })
    }
}
pub struct ScopedCompletionGuard {
    identity: BindingIdentity,
    guard: CompletionGuard,
}
impl ScopedCompletionGuard {
    pub fn fresh() -> Result<Self, i32> {
        Self::new(BindingIdentity::issue()?)
    }
    pub fn new(identity: BindingIdentity) -> Result<Self, i32> {
        Ok(Self {
            identity,
            guard: CompletionGuard::new()?,
        })
    }
    fn unwrap(&self, ticket: &ScopedToken) -> Result<i32, i32> {
        if ticket.identity != self.identity {
            Err(-1)
        } else {
            Ok(ticket.local)
        }
    }
    fn wrap(&self, local: i32) -> ScopedToken {
        ScopedToken {
            identity: self.identity,
            local,
        }
    }
    pub fn acquire(&mut self, size: i32) -> Result<ScopedToken, i32> {
        let id = self.guard.acquire(size)?;
        Ok(self.wrap(id))
    }
    pub fn submit(&mut self, window: &ScopedToken) -> Result<ScopedToken, i32> {
        let id = self.guard.submit(self.unwrap(window)?)?;
        Ok(self.wrap(id))
    }
    pub fn cancel(&mut self, op: &ScopedToken) -> Result<i32, i32> {
        self.guard.cancel(self.unwrap(op)?)
    }
    pub fn complete(&mut self, op: &ScopedToken, bytes: &[u8], error: i32) -> Result<i32, i32> {
        self.guard.complete(self.unwrap(op)?, bytes, error)
    }
    pub fn poll(&self, op: &ScopedToken) -> Result<(&'static str, bool, i32), i32> {
        self.guard.poll(self.unwrap(op)?)
    }
    pub fn read(&self, window: &ScopedToken) -> Result<Vec<u8>, i32> {
        self.guard.read(self.unwrap(window)?)
    }
    pub fn release(&mut self, token: &ScopedToken) -> Result<i32, i32> {
        self.guard.release(self.unwrap(token)?)
    }
    pub fn revoke(&mut self) -> i32 {
        self.guard.revoke()
    }
    pub fn counts(&self) -> [usize; 2] {
        self.guard.counts()
    }
}

#[cfg(test)]
mod issuer_tests {
    use super::*;
    #[test]
    fn entropy_failure_and_zero_reject_without_fallback() {
        assert_eq!(BindingIdentity::issue_with(|_| Err(())), Err(-8));
        assert_eq!(
            BindingIdentity::issue_with(|bytes| {
                bytes[0] = 7;
                Err(())
            }),
            Err(-8)
        );
        assert_eq!(BindingIdentity::issue_with(|_| Ok(())), Err(-5));
    }
    #[test]
    fn system_issuance_smoke() {
        let mut seen = std::collections::HashSet::new();
        for _ in 0..32 {
            assert!(seen.insert(BindingIdentity::issue().unwrap().hex()));
        }
        assert_eq!(ScopedCompletionGuard::fresh().unwrap().counts(), [0, 0]);
    }
}
