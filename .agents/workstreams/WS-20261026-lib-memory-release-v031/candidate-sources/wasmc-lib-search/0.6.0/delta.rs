use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

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
    package_id: String,
    version: String,
    profile: String,
    target: String,
    wit_route: String,
    source_path: String,
    wit_sha256: String,
    description: String,
    delivery: Option<Binding>,
    apis: Vec<Api>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Api {
    route: String,
    description: String,
}
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
pub enum Error {
    InvalidIndex,
    IndexTooLarge,
    InvalidQuery,
    InvalidLimit,
}

fn hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
fn profile(value: &str) -> bool {
    matches!(value, "value" | "resource" | "host" | "native")
}
fn api_route(value: &str) -> bool {
    let word = |s: &str| {
        !s.is_empty()
            && s.bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
    };
    let Some((interface, member)) = value.split_once('#') else {
        return false;
    };
    if !word(interface) {
        return false;
    }
    if let Some(resource) = member.strip_prefix("[constructor]") {
        return word(resource);
    }
    for prefix in ["[method]", "[static]"] {
        if let Some(resource) = member.strip_prefix(prefix) {
            return resource
                .split_once('.')
                .is_some_and(|(r, f)| word(r) && word(f));
        }
    }
    word(member)
}
fn relative_path(value: &str) -> bool {
    !value.is_empty()
        && !value.contains(['\\', ':', '\0'])
        && value
            .split('/')
            .all(|p| !p.is_empty() && p != "." && p != "..")
}
fn binding(value: &Binding, native: bool) -> bool {
    hash(&value.manifest_sha256)
        && hash(&value.receipt_sha256)
        && value.artifact_path.as_deref().is_none_or(relative_path)
        && value.artifact_sha256.as_deref().is_none_or(hash)
        && value.component_sha256.as_deref().is_none_or(hash)
        && value.artifact_path.is_some() == value.artifact_sha256.is_some()
        && if native {
            value.component_sha256.is_none()
                && match value.artifact_kind.as_str() {
                    "native-source" => value.artifact_path.is_none(),
                    "native-binary" | "native-module" => value.artifact_path.is_some(),
                    _ => false,
                }
        } else {
            value.artifact_kind == "wasm-core-component"
                && value.artifact_path.is_some()
                && value.component_sha256.is_some()
        }
}
fn parse(text: &str) -> Result<Index, Error> {
    let wire: WireIndex = serde_json::from_str(text).map_err(|_| Error::InvalidIndex)?;
    if wire.schema != SCHEMA || !hash(&wire.registry_sha256) || !hash(&wire.source_fingerprint) {
        return Err(Error::InvalidIndex);
    }
    let mut entries = Vec::new();
    for package in wire.packages {
        let key = format!("{}@{}", package.package_id, package.version);
        let base = Hit {
            identity: key.clone(),
            package_id: package.package_id,
            version: package.version,
            profile: package.profile,
            target: package.target,
            kind: "package".into(),
            wit_route: package.wit_route,
            source_path: package.source_path,
            wit_sha256: package.wit_sha256,
            description: package.description,
            delivery: package.delivery,
        };
        entries.push(base.clone());
        for api in package.apis {
            if !api_route(&api.route) {
                return Err(Error::InvalidIndex);
            }
            let mut entry = base.clone();
            entry.identity = format!("{key}/{}", api.route);
            entry.kind = "api".into();
            entry.wit_route = format!("{}/{}", base.wit_route, api.route);
            entry.description = api.description;
            entries.push(entry);
        }
    }
    let index = Index {
        registry_sha256: wire.registry_sha256,
        entries,
    };
    let mut previous = "";
    let mut packages = BTreeMap::new();
    for entry in &index.entries {
        let key = format!("{}@{}", entry.package_id, entry.version);
        let versions: Vec<_> = entry.version.split('.').collect();
        let valid_version = versions.len() == 3
            && versions
                .iter()
                .all(|v| !v.is_empty() && v.bytes().all(|b| b.is_ascii_digit()));
        if entry.identity.as_str() <= previous
            || !id(&entry.package_id)
            || !valid_version
            || !profile(&entry.profile)
            || entry.target.is_empty()
            || entry.source_path != format!("libspec/{}/lib.wit", entry.package_id)
            || !hash(&entry.wit_sha256)
            || entry
                .delivery
                .as_ref()
                .is_some_and(|b| !binding(b, entry.profile == "native"))
        {
            return Err(Error::InvalidIndex);
        }
        previous = &entry.identity;
        if entry.kind == "package" {
            if entry.identity != key
                || entry.wit_route.contains('/')
                || !entry.wit_route.contains(':')
                || !entry.wit_route.ends_with(&format!("@{}", entry.version))
                || packages.insert(key, entry).is_some()
            {
                return Err(Error::InvalidIndex);
            }
        } else if entry.kind != "api" {
            return Err(Error::InvalidIndex);
        }
    }
    for entry in index.entries.iter().filter(|e| e.kind == "api") {
        let key = format!("{}@{}", entry.package_id, entry.version);
        let parent = packages.get(&key).ok_or(Error::InvalidIndex)?;
        let suffix = entry
            .wit_route
            .strip_prefix(&(parent.wit_route.clone() + "/"))
            .ok_or(Error::InvalidIndex)?;
        if !suffix.contains('#')
            || entry.identity != format!("{key}/{suffix}")
            || entry.profile != parent.profile
            || entry.target != parent.target
            || entry.wit_sha256 != parent.wit_sha256
            || entry.delivery != parent.delivery
        {
            return Err(Error::InvalidIndex);
        }
    }
    Ok(index)
}

pub fn snapshot(text: String) -> Result<SnapshotInfo, Error> {
    let index = parse(&text)?;
    let packages = index.entries.iter().filter(|e| e.kind == "package").count();
    Ok(SnapshotInfo {
        entry_count: index.entries.len() as u32,
        package_count: packages as u32,
        api_count: (index.entries.len() - packages) as u32,
        bound_package_count: index
            .entries
            .iter()
            .filter(|e| e.kind == "package" && e.delivery.is_some())
            .count() as u32,
        registry_sha256: index.registry_sha256,
        index_sha256: format!("{:x}", Sha256::digest(text.as_bytes())),
    })
}
pub fn search(text: String, query: Query, offset: u32, limit: u32) -> Result<Vec<Hit>, Error> {
    if query
        .text
        .chars()
        .any(|c| c.is_control() && !c.is_whitespace())
        || query.package_id.as_deref().is_some_and(|v| !id(v))
        || query.profile.as_deref().is_some_and(|v| !profile(v))
    {
        return Err(Error::InvalidQuery);
    }
    let lowercase = query.text.to_lowercase();
    let terms: Vec<_> = lowercase.split_whitespace().collect();
    let index = parse(&text)?;
    Ok(index
        .entries
        .into_iter()
        .filter(|entry| {
            if query
                .package_id
                .as_ref()
                .is_some_and(|v| v != &entry.package_id)
                || query.profile.as_ref().is_some_and(|v| v != &entry.profile)
                || (query.bound_only && entry.delivery.is_none())
            {
                return false;
            }
            let haystack = format!(
                "{} {} {} {} {}",
                entry.identity, entry.wit_route, entry.description, entry.profile, entry.target
            )
            .to_lowercase();
            terms.iter().all(|t| haystack.contains(t))
        })
        .skip(offset as usize)
        .take(limit as usize)
        .collect())
}
pub fn lookup(text: String, identity: String) -> Result<Option<Hit>, Error> {
    if identity.is_empty() || identity.chars().any(char::is_control) {
        return Err(Error::InvalidQuery);
    }
    let index = parse(&text)?;
    Ok(index
        .entries
        .binary_search_by(|entry| entry.identity.cmp(&identity))
        .ok()
        .map(|i| index.entries[i].clone()))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn index() -> (String, String) {
        let id = format!("wasmc-{}", "a".repeat(160));
        let apis: Vec<_> = (0..5000).map(|n| serde_json::json!({"route":format!("catalog#api{n:05}"),"description":"word ".repeat(100)})).collect();
        let key = format!("{id}@0.1.0");
        (serde_json::json!({"schema":SCHEMA,"registry_sha256":"0".repeat(64),"source_fingerprint":"1".repeat(64),"packages":[{"package_id":id,"version":"0.1.0","profile":"value","target":"portable","wit_route":"wasmc:test@0.1.0","source_path":format!("libspec/{id}/lib.wit"),"wit_sha256":"2".repeat(64),"description":"word ".repeat(1000),"delivery":null,"apis":apis}]}).to_string(),key)
    }
    #[test]
    fn large_index_page_terms_names_and_descriptions_follow_memory() {
        let (text, key) = index();
        assert!(text.len() > 2 * 1024 * 1024);
        assert_eq!(snapshot(text.clone()).unwrap().entry_count, 5001);
        assert!(lookup(text.clone(), key).unwrap().is_some());
        let query = Query {
            text: "word ".repeat(130),
            package_id: None,
            profile: None,
            bound_only: false,
        };
        assert_eq!(search(text.clone(), query, 0, 5001).unwrap().len(), 5001);
        let query = Query {
            text: String::new(),
            package_id: None,
            profile: None,
            bound_only: false,
        };
        assert_eq!(search(text, query, 4990, 1000).unwrap().len(), 11);
    }
    #[test]
    fn schema_validation_and_zero_page_semantics_remain() {
        assert_eq!(snapshot("{}".into()).err(), Some(Error::InvalidIndex));
        let (text, _) = index();
        let query = Query {
            text: String::new(),
            package_id: None,
            profile: None,
            bound_only: false,
        };
        assert!(search(text, query, 0, 0).unwrap().is_empty());
    }
}
