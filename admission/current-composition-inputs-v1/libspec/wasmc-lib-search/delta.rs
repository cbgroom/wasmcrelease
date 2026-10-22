use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

const MAX_INDEX: usize = 2 * 1024 * 1024;
const MAX_ENTRIES: usize = 4096;
const SCHEMA: &str = "wasmc.current-lib-search-index/v2";

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub manifest_sha256: String,
    pub receipt_sha256: String,
    pub artifact_kind: String,
    pub artifact_path: Option<String>,
    pub artifact_sha256: Option<String>,
    pub component_sha256: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Hit {
    pub identity: String,
    pub package_id: String,
    pub version: String,
    pub profile: String,
    pub target: String,
    pub kind: String,
    pub wit_route: String,
    pub source_path: String,
    pub wit_sha256: String,
    pub description: String,
    pub delivery: Option<Binding>,
}
struct Index {
    registry_sha256: String,
    entries: Vec<Hit>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WireIndex {
    schema: String,
    registry_sha256: String,
    source_fingerprint: String,
    packages: Vec<Package>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Package {
    package_id: String, version: String, profile: String, target: String,
    wit_route: String, source_path: String, wit_sha256: String,
    description: String, delivery: Option<Binding>, apis: Vec<Api>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Api { route: String, description: String }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SnapshotInfo {
    pub entry_count: u32,
    pub package_count: u32,
    pub api_count: u32,
    pub bound_package_count: u32,
    pub registry_sha256: String,
    pub index_sha256: String,
}
pub struct Query {
    pub text: String,
    pub package_id: Option<String>,
    pub profile: Option<String>,
    pub bound_only: bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error { InvalidIndex, IndexTooLarge, InvalidQuery, InvalidLimit }

fn hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && value.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
fn profile(value: &str) -> bool { matches!(value, "value" | "resource" | "host" | "native") }
fn api_route(value: &str) -> bool {
    let word = |s: &str| !s.is_empty() && s.len() <= 128
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'));
    let Some((interface, member)) = value.split_once('#') else { return false; };
    if !word(interface) { return false; }
    if let Some(resource) = member.strip_prefix("[constructor]") { return word(resource); }
    for prefix in ["[method]", "[static]"] {
        if let Some(resource) = member.strip_prefix(prefix) {
            return resource.split_once('.').is_some_and(|(r, f)| word(r) && word(f));
        }
    }
    word(member)
}
fn relative_path(value: &str) -> bool {
    !value.is_empty() && value.len() <= 512 && !value.contains(['\\', ':', '\0'])
        && value.split('/').all(|p| !p.is_empty() && p != "." && p != "..")
}
fn binding(value: &Binding, native: bool) -> bool {
    hash(&value.manifest_sha256) && hash(&value.receipt_sha256)
        && value.artifact_path.as_deref().is_none_or(relative_path)
        && value.artifact_sha256.as_deref().is_none_or(hash)
        && value.component_sha256.as_deref().is_none_or(hash)
        && value.artifact_path.is_some() == value.artifact_sha256.is_some()
        && if native {
            value.component_sha256.is_none() && match value.artifact_kind.as_str() {
                "native-source" => value.artifact_path.is_none(),
                "native-binary" | "native-module" => value.artifact_path.is_some(),
                _ => false,
            }
        } else {
            value.artifact_kind == "wasm-core-component" && value.artifact_path.is_some() && value.component_sha256.is_some()
        }
}
fn parse(text: &str) -> Result<Index, Error> {
    if text.len() > MAX_INDEX { return Err(Error::IndexTooLarge); }
    let wire: WireIndex = serde_json::from_str(text).map_err(|_| Error::InvalidIndex)?;
    if wire.schema != SCHEMA || !hash(&wire.registry_sha256) || !hash(&wire.source_fingerprint)
        || wire.packages.len() > MAX_ENTRIES { return Err(Error::InvalidIndex); }
    let mut entries = Vec::new();
    let mut expanded_bytes = 0usize;
    for package in wire.packages {
        if entries.len().saturating_add(package.apis.len()).saturating_add(1) > MAX_ENTRIES {
            return Err(Error::InvalidIndex);
        }
        let key = format!("{}@{}", package.package_id, package.version);
        let base = Hit { identity: key.clone(), package_id: package.package_id, version: package.version,
            profile: package.profile, target: package.target, kind: "package".into(),
            wit_route: package.wit_route, source_path: package.source_path, wit_sha256: package.wit_sha256,
            description: package.description, delivery: package.delivery };
        let common_bytes = base.identity.len() + base.package_id.len() + base.version.len() + base.profile.len()
            + base.target.len() + base.wit_route.len() + base.source_path.len() + base.wit_sha256.len()
            + base.delivery.as_ref().map_or(0, |v| v.manifest_sha256.len() + v.receipt_sha256.len()
                + v.artifact_kind.len() + v.artifact_path.as_ref().map_or(0, String::len)
                + v.artifact_sha256.as_ref().map_or(0, String::len) + v.component_sha256.as_ref().map_or(0, String::len));
        expanded_bytes = expanded_bytes.saturating_add(common_bytes).saturating_add(base.description.len());
        if expanded_bytes > MAX_INDEX { return Err(Error::IndexTooLarge); }
        entries.push(base.clone());
        for api in package.apis {
            if !api_route(&api.route) { return Err(Error::InvalidIndex); }
            expanded_bytes = expanded_bytes.saturating_add(common_bytes).saturating_add(api.description.len())
                .saturating_add(api.route.len().saturating_mul(2));
            if expanded_bytes > MAX_INDEX { return Err(Error::IndexTooLarge); }
            let mut entry = base.clone();
            entry.identity = format!("{key}/{}", api.route);
            entry.kind = "api".into(); entry.wit_route = format!("{}/{}", base.wit_route, api.route);
            entry.description = api.description;
            entries.push(entry);
        }
    }
    let index = Index { registry_sha256: wire.registry_sha256, entries };
    let mut previous = "";
    let mut packages = BTreeMap::new();
    for entry in &index.entries {
        let key = format!("{}@{}", entry.package_id, entry.version);
        let versions: Vec<_> = entry.version.split('.').collect();
        let valid_version = versions.len() == 3 && versions.iter().all(|v| !v.is_empty() && v.bytes().all(|b| b.is_ascii_digit()));
        if entry.identity.as_str() <= previous || !id(&entry.package_id) || !valid_version
            || !profile(&entry.profile) || entry.identity.len() > 512 || entry.wit_route.len() > 512
            || entry.target.is_empty() || entry.target.len() > 128 || entry.description.len() > 4096
            || entry.source_path != format!("libspec/{}/lib.wit", entry.package_id) || !hash(&entry.wit_sha256)
            || entry.delivery.as_ref().is_some_and(|b| !binding(b, entry.profile == "native")) {
            return Err(Error::InvalidIndex);
        }
        previous = &entry.identity;
        if entry.kind == "package" {
            if entry.identity != key || entry.wit_route.contains('/') || !entry.wit_route.contains(':')
                || !entry.wit_route.ends_with(&format!("@{}", entry.version))
                || packages.insert(key, entry).is_some() { return Err(Error::InvalidIndex); }
        } else if entry.kind != "api" { return Err(Error::InvalidIndex); }
    }
    for entry in index.entries.iter().filter(|e| e.kind == "api") {
        let key = format!("{}@{}", entry.package_id, entry.version);
        let parent = packages.get(&key).ok_or(Error::InvalidIndex)?;
        let suffix = entry.wit_route.strip_prefix(&(parent.wit_route.clone() + "/")).ok_or(Error::InvalidIndex)?;
        if !suffix.contains('#') || entry.identity != format!("{key}/{suffix}")
            || entry.profile != parent.profile || entry.target != parent.target
            || entry.wit_sha256 != parent.wit_sha256 || entry.delivery != parent.delivery {
            return Err(Error::InvalidIndex);
        }
    }
    Ok(index)
}

pub fn snapshot(text: String) -> Result<SnapshotInfo, Error> {
    let index = parse(&text)?;
    let packages = index.entries.iter().filter(|e| e.kind == "package").count();
    Ok(SnapshotInfo {
        entry_count: index.entries.len() as u32, package_count: packages as u32,
        api_count: (index.entries.len() - packages) as u32,
        bound_package_count: index.entries.iter().filter(|e| e.kind == "package" && e.delivery.is_some()).count() as u32,
        registry_sha256: index.registry_sha256,
        index_sha256: format!("{:x}", Sha256::digest(text.as_bytes())),
    })
}
pub fn search(text: String, query: Query, offset: u32, limit: u32) -> Result<Vec<Hit>, Error> {
    if limit == 0 || limit > 64 { return Err(Error::InvalidLimit); }
    if query.text.len() > 512 || query.text.chars().any(|c| c.is_control() && !c.is_whitespace())
        || query.package_id.as_deref().is_some_and(|v| !id(v))
        || query.profile.as_deref().is_some_and(|v| !profile(v)) { return Err(Error::InvalidQuery); }
    let lowercase = query.text.to_lowercase();
    let terms: Vec<_> = lowercase.split_whitespace().collect();
    if terms.len() > 16 { return Err(Error::InvalidQuery); }
    let index = parse(&text)?;
    Ok(index.entries.into_iter().filter(|entry| {
        if query.package_id.as_ref().is_some_and(|v| v != &entry.package_id)
            || query.profile.as_ref().is_some_and(|v| v != &entry.profile)
            || (query.bound_only && entry.delivery.is_none()) { return false; }
        let haystack = format!("{} {} {} {} {}", entry.identity, entry.wit_route,
            entry.description, entry.profile, entry.target).to_lowercase();
        terms.iter().all(|t| haystack.contains(t))
    }).skip(offset as usize).take(limit as usize).collect())
}
pub fn lookup(text: String, identity: String) -> Result<Option<Hit>, Error> {
    if identity.is_empty() || identity.len() > 512 || identity.chars().any(char::is_control) {
        return Err(Error::InvalidQuery);
    }
    let index = parse(&text)?;
    Ok(index.entries.binary_search_by(|entry| entry.identity.cmp(&identity)).ok().map(|i| index.entries[i].clone()))
}
