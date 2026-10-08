use crate::resident_state as kernel;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    InvalidRevision,
    InvalidInput,
    NotFound,
    Conflict,
    BudgetExceeded,
    InvalidRange,
    Integrity,
    Internal,
}
#[derive(Debug, Clone)]
pub struct Error {
    pub code: ErrorCode,
    pub message: String,
}
type Result<T> = std::result::Result<T, Error>;
fn fail(code: ErrorCode, message: impl Into<String>) -> Error {
    Error {
        code,
        message: message.into(),
    }
}
fn kernel_error(e: kernel::ResidentError) -> Error {
    use kernel::ResidentError::*;
    let code = match &e {
        BudgetExceeded { .. } | AccountingOverflow => ErrorCode::BudgetExceeded,
        StaleParent | NonMonotonicSequence | DuplicateRevision(_) | RefRevisionMismatch { .. } => {
            ErrorCode::Conflict
        }
        RevisionNotFound(_) | RefNotFound(_) => ErrorCode::NotFound,
        LockPoisoned => ErrorCode::Internal,
        _ => ErrorCode::InvalidInput,
    };
    fail(code, e.to_string())
}
fn revision(bytes: Vec<u8>) -> Result<kernel::ResidentRevision> {
    bytes.try_into().map_err(|_| {
        fail(
            ErrorCode::InvalidRevision,
            "revision must contain exactly 20 bytes",
        )
    })
}
fn size(n: u64) -> Result<usize> {
    usize::try_from(n).map_err(|_| {
        fail(
            ErrorCode::InvalidInput,
            "integer exceeds target address space",
        )
    })
}
fn nonempty(s: &str, name: &str) -> Result<()> {
    if s.is_empty() {
        return Err(fail(
            ErrorCode::InvalidInput,
            format!("{name} must not be empty"),
        ));
    }
    Ok(())
}
pub struct HistoryPolicy {
    pub max_retained_generations: u64,
    pub max_reflog_entries: u64,
    pub max_refs: u64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct ObjectInput {
    pub locator: String,
    pub role: Option<String>,
    pub media_type: String,
    pub mode: String,
    pub object_version: String,
    pub content: Vec<u8>,
}
pub struct AggregateInput {
    pub key: String,
    pub row_version: u64,
    pub aggregate_version: String,
    pub objects: Vec<ObjectInput>,
}
pub struct ReplaceRange {
    pub locator: String,
    pub expected_object_version: String,
    pub next_object_version: String,
    pub offset: u64,
    pub delete_length: u64,
    pub expected_slice_digest: Option<String>,
    pub data: Vec<u8>,
}
pub struct MoveObject {
    pub locator: String,
    pub next_locator: String,
    pub next_object_version: String,
}
pub enum ObjectMutation {
    Put(ObjectInput),
    Patch(ReplaceRange),
    Delete(String),
    Move(MoveObject),
}
pub struct AggregateChange {
    pub key: String,
    pub row_version: u64,
    pub aggregate_version: String,
    pub deleted: bool,
    pub objects: Vec<ObjectMutation>,
}
pub struct BudgetSnapshot {
    pub limit_bytes: u64,
    pub used_bytes: u64,
}
pub struct RoleStat {
    pub role: String,
    pub object_count: u64,
    pub byte_count: u64,
}
pub struct AggregateStat {
    pub aggregate_version: String,
    pub row_version: u64,
    pub object_count: u64,
    pub object_bytes: u64,
    pub largest_object_bytes: u64,
    pub objects_by_role: Vec<RoleStat>,
}
pub struct ObjectDescriptor {
    pub locator: String,
    pub role: Option<String>,
    pub media_type: String,
    pub mode: String,
    pub byte_count: u64,
    pub object_version: String,
}
pub struct ObjectPage {
    pub aggregate_version: String,
    pub objects: Vec<ObjectDescriptor>,
    pub truncated: bool,
    pub next_after: Option<String>,
}
#[derive(Clone)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}
pub struct ObjectRead {
    pub aggregate_version: String,
    pub object_version: String,
    pub total_bytes: u64,
    pub range: ByteRange,
    pub bytes: Vec<u8>,
}
#[derive(Serialize, Deserialize)]
struct Aggregate {
    row_version: u64,
    aggregate_version: String,
    objects: BTreeMap<String, ObjectInput>,
}
type Collection = BTreeMap<String, Aggregate>;

fn validate_object(object: &ObjectInput) -> Result<()> {
    nonempty(&object.locator, "locator")?;
    nonempty(&object.object_version, "object version")?;
    nonempty(&object.media_type, "media type")?;
    nonempty(&object.mode, "mode")
}
fn encode(collection: &Collection) -> Result<Vec<u8>> {
    serde_json::to_vec(collection).map_err(|e| fail(ErrorCode::Internal, e.to_string()))
}
fn row(collection: &Collection, sequence: u64) -> Result<kernel::ResidentRowInput> {
    Ok(kernel::ResidentRowInput {
        key: "objects".into(),
        row_version: sequence,
        deleted: false,
        cells: vec![kernel::ResidentScalarInput::Blob(encode(collection)?)],
    })
}
fn decode(snapshot: &kernel::ResidentSnapshot) -> Result<Collection> {
    match snapshot.cell(0, 0) {
        Some(kernel::ResidentCell::Blob(bytes)) => {
            serde_json::from_slice(bytes).map_err(|e| fail(ErrorCode::Integrity, e.to_string()))
        }
        _ => Err(fail(
            ErrorCode::Integrity,
            "resident collection cell is absent",
        )),
    }
}
pub struct Store(kernel::ResidentStore);
pub struct Snapshot(kernel::ResidentSnapshot);
impl Store {
    pub fn open(
        rev: Vec<u8>,
        aggregates: Vec<AggregateInput>,
        budget_bytes: u64,
        history: HistoryPolicy,
    ) -> Result<Self> {
        let rev = revision(rev)?;
        let mut collection = Collection::new();
        for aggregate in aggregates {
            nonempty(&aggregate.key, "aggregate key")?;
            nonempty(&aggregate.aggregate_version, "aggregate version")?;
            if aggregate.row_version == 0 {
                return Err(fail(
                    ErrorCode::InvalidInput,
                    "row version must be positive",
                ));
            }
            let mut objects = BTreeMap::new();
            for object in aggregate.objects {
                validate_object(&object)?;
                if objects.insert(object.locator.clone(), object).is_some() {
                    return Err(fail(ErrorCode::Conflict, "duplicate object locator"));
                }
            }
            if collection
                .insert(
                    aggregate.key,
                    Aggregate {
                        row_version: aggregate.row_version,
                        aggregate_version: aggregate.aggregate_version,
                        objects,
                    },
                )
                .is_some()
            {
                return Err(fail(ErrorCode::Conflict, "duplicate aggregate key"));
            }
        }
        kernel::ResidentStore::new_with_history(
            rev,
            vec![kernel::ResidentColumn {
                name: "objects".into(),
                value_type: kernel::ResidentValueType::Blob,
                nullable: false,
            }],
            vec![row(&collection, 1)?],
            size(budget_bytes)?,
            kernel::ResidentHistoryPolicy {
                max_retained_generations: size(history.max_retained_generations)?,
                max_reflog_entries: size(history.max_reflog_entries)?,
                max_refs: size(history.max_refs)?,
            },
        )
        .map(Self)
        .map_err(kernel_error)
    }
    pub fn pin_current(&self) -> Result<Snapshot> {
        self.0.pin_current().map(Snapshot).map_err(kernel_error)
    }
    pub fn pin_revision(&self, rev: Vec<u8>) -> Result<Snapshot> {
        self.0
            .pin_revision(revision(rev)?)
            .map(Snapshot)
            .map_err(kernel_error)
    }
    pub fn budget(&self) -> BudgetSnapshot {
        let budget = self.0.budget();
        BudgetSnapshot {
            limit_bytes: budget.limit_bytes as u64,
            used_bytes: budget.used_bytes as u64,
        }
    }
    pub fn publish(
        &self,
        parent: Vec<u8>,
        next: Vec<u8>,
        sequence: u64,
        changes: Vec<AggregateChange>,
    ) -> Result<Snapshot> {
        let parent = revision(parent)?;
        let next = revision(next)?;
        let snapshot = self.0.pin_current().map_err(kernel_error)?;
        if snapshot.revision() != parent {
            return Err(fail(ErrorCode::Conflict, "stale parent revision"));
        }
        let mut collection = decode(&snapshot)?;
        let mut changed = BTreeSet::new();
        for change in changes {
            nonempty(&change.key, "aggregate key")?;
            if !changed.insert(change.key.clone()) {
                return Err(fail(ErrorCode::Conflict, "duplicate aggregate change"));
            }
            nonempty(&change.aggregate_version, "aggregate version")?;
            if change.row_version == 0
                || collection
                    .get(&change.key)
                    .is_some_and(|a| change.row_version <= a.row_version)
            {
                return Err(fail(ErrorCode::Conflict, "row version must increase"));
            }
            if change.deleted {
                if !change.objects.is_empty() {
                    return Err(fail(
                        ErrorCode::InvalidInput,
                        "deleted aggregate cannot contain object mutations",
                    ));
                }
                if collection.remove(&change.key).is_none() {
                    return Err(fail(ErrorCode::NotFound, "aggregate not found"));
                }
                continue;
            }
            let aggregate = collection.entry(change.key).or_insert_with(|| Aggregate {
                row_version: 0,
                aggregate_version: String::new(),
                objects: BTreeMap::new(),
            });
            for mutation in change.objects {
                mutate(&mut aggregate.objects, mutation)?;
            }
            aggregate.row_version = change.row_version;
            aggregate.aggregate_version = change.aggregate_version;
        }
        let change = kernel::ResidentRowChange {
            index: 0,
            row: row(&collection, sequence)?,
        };
        self.0
            .publish(parent, next, sequence, vec![change])
            .map(Snapshot)
            .map_err(kernel_error)
    }
}
fn mutate(objects: &mut BTreeMap<String, ObjectInput>, mutation: ObjectMutation) -> Result<()> {
    match mutation {
        ObjectMutation::Put(object) => {
            validate_object(&object)?;
            objects.insert(object.locator.clone(), object);
        }
        ObjectMutation::Delete(locator) => {
            if objects.remove(&locator).is_none() {
                return Err(fail(ErrorCode::NotFound, "object not found"));
            }
        }
        ObjectMutation::Move(change) => {
            nonempty(&change.next_locator, "next locator")?;
            nonempty(&change.next_object_version, "next object version")?;
            if change.locator != change.next_locator && objects.contains_key(&change.next_locator) {
                return Err(fail(ErrorCode::Conflict, "destination locator exists"));
            }
            let mut object = objects
                .remove(&change.locator)
                .ok_or_else(|| fail(ErrorCode::NotFound, "object not found"))?;
            object.locator = change.next_locator.clone();
            object.object_version = change.next_object_version;
            objects.insert(change.next_locator, object);
        }
        ObjectMutation::Patch(change) => {
            nonempty(&change.next_object_version, "next object version")?;
            let object = objects
                .get_mut(&change.locator)
                .ok_or_else(|| fail(ErrorCode::NotFound, "object not found"))?;
            if object.object_version != change.expected_object_version {
                return Err(fail(ErrorCode::Conflict, "object version mismatch"));
            }
            let start = size(change.offset)?;
            let end = start
                .checked_add(size(change.delete_length)?)
                .ok_or_else(|| fail(ErrorCode::InvalidRange, "range overflow"))?;
            if start > end || end > object.content.len() {
                return Err(fail(ErrorCode::InvalidRange, "patch range exceeds object"));
            }
            if let Some(expected) = change.expected_slice_digest {
                let actual = hex::encode(Sha256::digest(&object.content[start..end]));
                if expected != actual {
                    return Err(fail(ErrorCode::Integrity, "slice digest mismatch"));
                }
            }
            object.content.splice(start..end, change.data);
            object.object_version = change.next_object_version;
        }
    }
    Ok(())
}
impl Snapshot {
    pub fn revision(&self) -> Vec<u8> {
        self.0.revision().to_vec()
    }
    pub fn sequence(&self) -> u64 {
        self.0.sequence()
    }
    fn aggregate(&self, owner: &str) -> Result<Aggregate> {
        decode(&self.0)?
            .remove(owner)
            .ok_or_else(|| fail(ErrorCode::NotFound, "aggregate not found"))
    }
    pub fn stat(&self, owner: String) -> Result<AggregateStat> {
        let aggregate = self.aggregate(&owner)?;
        let mut roles: BTreeMap<String, (u64, u64)> = BTreeMap::new();
        let mut bytes = 0;
        let mut largest = 0;
        for object in aggregate.objects.values() {
            let count = object.content.len() as u64;
            bytes += count;
            largest = largest.max(count);
            if let Some(role) = &object.role {
                let stat = roles.entry(role.clone()).or_default();
                stat.0 += 1;
                stat.1 += count;
            }
        }
        Ok(AggregateStat {
            aggregate_version: aggregate.aggregate_version,
            row_version: aggregate.row_version,
            object_count: aggregate.objects.len() as u64,
            object_bytes: bytes,
            largest_object_bytes: largest,
            objects_by_role: roles
                .into_iter()
                .map(|(role, (object_count, byte_count))| RoleStat {
                    role,
                    object_count,
                    byte_count,
                })
                .collect(),
        })
    }
    pub fn list_objects(
        &self,
        owner: String,
        after: Option<String>,
        limit: u64,
    ) -> Result<ObjectPage> {
        let limit = size(limit)?;
        if limit == 0 {
            return Err(fail(ErrorCode::InvalidInput, "page limit must be positive"));
        }
        let aggregate = self.aggregate(&owner)?;
        let mut pending = aggregate
            .objects
            .values()
            .filter(|o| after.as_ref().is_none_or(|a| o.locator > *a));
        let objects: Vec<_> = pending
            .by_ref()
            .take(limit)
            .map(|o| ObjectDescriptor {
                locator: o.locator.clone(),
                role: o.role.clone(),
                media_type: o.media_type.clone(),
                mode: o.mode.clone(),
                byte_count: o.content.len() as u64,
                object_version: o.object_version.clone(),
            })
            .collect();
        let truncated = pending.next().is_some();
        let next_after = if truncated {
            objects.last().map(|o| o.locator.clone())
        } else {
            None
        };
        Ok(ObjectPage {
            aggregate_version: aggregate.aggregate_version,
            objects,
            truncated,
            next_after,
        })
    }
    pub fn read(
        &self,
        owner: String,
        locator: String,
        expected: String,
        range: Option<ByteRange>,
    ) -> Result<ObjectRead> {
        let aggregate = self.aggregate(&owner)?;
        let object = aggregate
            .objects
            .get(&locator)
            .ok_or_else(|| fail(ErrorCode::NotFound, "object not found"))?;
        if object.object_version != expected {
            return Err(fail(ErrorCode::Conflict, "object version mismatch"));
        }
        let total_bytes = object.content.len() as u64;
        let range = range.unwrap_or(ByteRange {
            start: 0,
            end: total_bytes,
        });
        if range.start > range.end || range.end > total_bytes {
            return Err(fail(ErrorCode::InvalidRange, "read range exceeds object"));
        }
        let bytes = object.content[size(range.start)?..size(range.end)?].to_vec();
        Ok(ObjectRead {
            aggregate_version: aggregate.aggregate_version,
            object_version: object.object_version.clone(),
            total_bytes,
            range,
            bytes,
        })
    }
}
