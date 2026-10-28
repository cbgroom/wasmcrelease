use crate::delta;
use crate::exports::wasmc::lib_search::catalog::{Binding, Guest, Hit, Query, SearchError, SnapshotInfo};

pub struct Adapter;
fn error(value: delta::Error) -> SearchError {
    match value {
        delta::Error::InvalidIndex => SearchError::InvalidIndex,
        delta::Error::IndexTooLarge => SearchError::IndexTooLarge,
        delta::Error::InvalidQuery => SearchError::InvalidQuery,
        delta::Error::InvalidLimit => SearchError::InvalidLimit,
    }
}
fn hit(value: delta::Hit) -> Hit {
    Hit { identity: value.identity, package_id: value.package_id, version: value.version,
        profile: value.profile, target: value.target, kind: value.kind, wit_route: value.wit_route,
        source_path: value.source_path, wit_sha256: value.wit_sha256, description: value.description,
        delivery: value.delivery.map(|v| Binding { manifest_sha256: v.manifest_sha256,
            receipt_sha256: v.receipt_sha256, artifact_kind: v.artifact_kind,
            artifact_path: v.artifact_path, artifact_sha256: v.artifact_sha256,
            component_sha256: v.component_sha256 }) }
}
impl Guest for Adapter {
    fn snapshot(index: String) -> Result<SnapshotInfo, SearchError> {
        delta::snapshot(index).map(|v| SnapshotInfo { entry_count: v.entry_count,
            package_count: v.package_count, api_count: v.api_count,
            bound_package_count: v.bound_package_count, registry_sha256: v.registry_sha256,
            index_sha256: v.index_sha256 }).map_err(error)
    }
    fn search(index: String, query: Query, offset: u32, limit: u32) -> Result<Vec<Hit>, SearchError> {
        delta::search(index, delta::Query { text: query.text, package_id: query.package_id,
            profile: query.profile, bound_only: query.bound_only }, offset, limit)
            .map(|v| v.into_iter().map(hit).collect()).map_err(error)
    }
    fn lookup(index: String, identity: String) -> Result<Option<Hit>, SearchError> {
        delta::lookup(index, identity).map(|v| v.map(hit)).map_err(error)
    }
}
