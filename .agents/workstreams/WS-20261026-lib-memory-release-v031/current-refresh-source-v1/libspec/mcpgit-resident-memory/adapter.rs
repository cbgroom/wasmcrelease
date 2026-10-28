use crate::delta as d;
use crate::exports::mcpgit::resident_memory::memory as w;

pub struct Adapter;
pub struct Store(d::Store);
pub struct Snapshot(d::Snapshot);
impl w::Guest for Adapter {
    type Store = Store;
    type Snapshot = Snapshot;
}

macro_rules! fields {
    ($from:ty => $to:ty; $($field:ident),+ $(,)?) => {
        impl From<$from> for $to {
            fn from(v: $from) -> Self { Self { $($field: v.$field),+ } }
        }
    };
}
fields!(w::HistoryPolicy => d::HistoryPolicy; max_retained_generations, max_reflog_entries, max_refs);
fields!(w::ObjectInput => d::ObjectInput; locator, role, media_type, mode, object_version, content);
fields!(w::ReplaceRange => d::ReplaceRange; locator, expected_object_version, next_object_version, offset, delete_length, expected_slice_digest, data);
fields!(w::MoveObject => d::MoveObject; locator, next_locator, next_object_version);
fields!(w::ByteRange => d::ByteRange; start, end);
fields!(d::ByteRange => w::ByteRange; start, end);
fields!(d::BudgetSnapshot => w::BudgetSnapshot; limit_bytes, used_bytes);
fields!(d::RoleStat => w::RoleStat; role, object_count, byte_count);
fields!(d::ObjectDescriptor => w::ObjectDescriptor; locator, role, media_type, mode, byte_count, object_version);

fn list<T, U: From<T>>(v: Vec<T>) -> Vec<U> {
    v.into_iter().map(Into::into).collect()
}
impl From<w::AggregateInput> for d::AggregateInput {
    fn from(v: w::AggregateInput) -> Self {
        Self {
            key: v.key,
            row_version: v.row_version,
            aggregate_version: v.aggregate_version,
            objects: list(v.objects),
        }
    }
}
impl From<w::AggregateChange> for d::AggregateChange {
    fn from(v: w::AggregateChange) -> Self {
        Self {
            key: v.key,
            row_version: v.row_version,
            aggregate_version: v.aggregate_version,
            deleted: v.deleted,
            objects: list(v.objects),
        }
    }
}
impl From<w::ObjectMutation> for d::ObjectMutation {
    fn from(v: w::ObjectMutation) -> Self {
        match v {
            w::ObjectMutation::Put(v) => Self::Put(v.into()),
            w::ObjectMutation::Patch(v) => Self::Patch(v.into()),
            w::ObjectMutation::Delete(v) => Self::Delete(v),
            w::ObjectMutation::Move(v) => Self::Move(v.into()),
        }
    }
}
impl From<d::AggregateStat> for w::AggregateStat {
    fn from(v: d::AggregateStat) -> Self {
        Self {
            aggregate_version: v.aggregate_version,
            row_version: v.row_version,
            object_count: v.object_count,
            object_bytes: v.object_bytes,
            largest_object_bytes: v.largest_object_bytes,
            objects_by_role: list(v.objects_by_role),
        }
    }
}
impl From<d::ObjectPage> for w::ObjectPage {
    fn from(v: d::ObjectPage) -> Self {
        Self {
            aggregate_version: v.aggregate_version,
            objects: list(v.objects),
            truncated: v.truncated,
            next_after: v.next_after,
        }
    }
}
impl From<d::ObjectRead> for w::ObjectRead {
    fn from(v: d::ObjectRead) -> Self {
        Self {
            aggregate_version: v.aggregate_version,
            object_version: v.object_version,
            total_bytes: v.total_bytes,
            range: v.range.into(),
            bytes: v.bytes,
        }
    }
}
impl From<d::Error> for w::ResidentError {
    fn from(v: d::Error) -> Self {
        let code = match v.code {
            d::ErrorCode::InvalidRevision => w::ErrorCode::InvalidRevision,
            d::ErrorCode::InvalidInput => w::ErrorCode::InvalidInput,
            d::ErrorCode::NotFound => w::ErrorCode::NotFound,
            d::ErrorCode::Conflict => w::ErrorCode::Conflict,
            d::ErrorCode::BudgetExceeded => w::ErrorCode::BudgetExceeded,
            d::ErrorCode::InvalidRange => w::ErrorCode::InvalidRange,
            d::ErrorCode::Integrity => w::ErrorCode::Integrity,
            d::ErrorCode::Internal => w::ErrorCode::Internal,
        };
        Self {
            code,
            message: v.message,
        }
    }
}
impl w::GuestStore for Store {
    fn open(
        revision: Vec<u8>,
        aggregates: Vec<w::AggregateInput>,
        budget_bytes: u64,
        history: w::HistoryPolicy,
    ) -> Result<w::Store, w::ResidentError> {
        d::Store::open(revision, list(aggregates), budget_bytes, history.into())
            .map(|v| w::Store::new(Self(v)))
            .map_err(Into::into)
    }
    fn pin_current(&self) -> Result<w::Snapshot, w::ResidentError> {
        self.0
            .pin_current()
            .map(|v| w::Snapshot::new(Snapshot(v)))
            .map_err(Into::into)
    }
    fn pin_revision(&self, revision: Vec<u8>) -> Result<w::Snapshot, w::ResidentError> {
        self.0
            .pin_revision(revision)
            .map(|v| w::Snapshot::new(Snapshot(v)))
            .map_err(Into::into)
    }
    fn publish(
        &self,
        expected_parent: Vec<u8>,
        next_revision: Vec<u8>,
        next_sequence: u64,
        changes: Vec<w::AggregateChange>,
    ) -> Result<w::Snapshot, w::ResidentError> {
        self.0
            .publish(expected_parent, next_revision, next_sequence, list(changes))
            .map(|v| w::Snapshot::new(Snapshot(v)))
            .map_err(Into::into)
    }
    fn budget(&self) -> w::BudgetSnapshot {
        self.0.budget().into()
    }
}
impl w::GuestSnapshot for Snapshot {
    fn revision(&self) -> Vec<u8> {
        self.0.revision()
    }
    fn sequence(&self) -> u64 {
        self.0.sequence()
    }
    fn stat(&self, owner: String) -> Result<w::AggregateStat, w::ResidentError> {
        self.0.stat(owner).map(Into::into).map_err(Into::into)
    }
    fn list_objects(
        &self,
        owner: String,
        after: Option<String>,
        limit: u64,
    ) -> Result<w::ObjectPage, w::ResidentError> {
        self.0
            .list_objects(owner, after, limit)
            .map(Into::into)
            .map_err(Into::into)
    }
    fn read(
        &self,
        owner: String,
        locator: String,
        expected_object_version: String,
        range: Option<w::ByteRange>,
    ) -> Result<w::ObjectRead, w::ResidentError> {
        self.0
            .read(
                owner,
                locator,
                expected_object_version,
                range.map(Into::into),
            )
            .map(Into::into)
            .map_err(Into::into)
    }
}
