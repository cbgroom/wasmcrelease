# Staged v2 licensed delivery — not released

Five staged roots have exact license bindings in
`admission/current-v2-next/package-license-bindings.json`. This is an outer
distribution manifest, not a rewrite of the generated `lib.json` schema or
its nine-file inventory. It pins each manifest, Core, Component, SDK and
other generated file to the two independent producer-build inventories.

Only new WAsmC-owned material is bound to the repository research license.
Third-party terms and earlier grants remain unchanged. HTTP1/Data Core carry
the fifteen notices already reviewed for their seven primary semantic crates;
the envelope also carries the exact six-lockfile inventory with all 189
registry-crate notice materials, canonical adapter build inputs and two pinned
official Rust compiler/library copyright documents. It now also carries the
finite 189-identity / 17-expression registry notice-choice review. This closes scoped material
delivery, not license-obligation or target-applicability review.
It also carries both canonical five-package retained build records: workspace
input stability and selected-registry/routing stability. They contain hashes,
counts and producer observations, not private source or caches. Public recipient
validation checks those exact observed identities and actual package files;
it does not reexecute private builds or reopen deleted private adapter bodies.
The envelope additionally carries the exact r14 OwnedAlgorithms generated
adapter/full finite-manifest qualification record. Independently pinned observed
identity and actual package reopening cover that one mapped profile, not other
packages, arbitrary Cargo manifests or full toolchain/license obligations.
The full transitive license gate and release gate remain false.

Validate the binding and the isolated delivery, including SDK consumption:

```sh
git rev-parse HEAD
node scripts/current-v2-package-license.mjs
node scripts/test-current-v2-package-license.mjs --sdk
```

Create a new recoverable licensed delivery without clobbering an existing path:

```sh
wasmc_license_parent="$(mktemp -d)"
wasmc_license_parent="$(cd "$wasmc_license_parent" && pwd -P)"
node scripts/current-v2-package-license.mjs --stage "$wasmc_license_parent/licensed-delivery"
```

The resulting 80-file tree contains the exact five package roots, binding
manifest, research LICENSE and policy, independently pinned producer-build
receipts, primary-upstream review and notices, the dependency inventory and its
six exact lockfiles, and the toolchain receipt plus two compressed copyright
documents, registry notice-choice receipt and both full-cohort build-input
witness records and the new mapped-adapter manifest qualification record.
Historical single-package observations remain repository
history rather than redundant required recipient files. The dependency inventory embeds complete retained notice texts and
their source identities. No provider/compiler source is
copied. The validator derives trusted identities from the selected checkout,
not from a recipient's self-rehashed index. Existing destinations, missing
license/notices, linked files/directories, unreviewed extra files, altered
roots and false promotion/relicensing claims reject.

The SDK test adds only its public Cargo.toml and main.rs: the exact Cargo.lock
is already carried by the envelope and must equal the consumer input. This
produces an isolated 82-file consumer tree. Locked/offline execution uses public Cargo registry
engine dependencies and compatible build caches outside that tree. Every
source input is checked before and after execution. This is SDK consumption,
not ordinary App qualification or commercial/production permission.

The review binds only its inventory inputs; the envelope subsequently binds
both inventory and review. It never hashes a parent index carrying its own
bytes, nor claims its own delivery status. Actual isolated-recipient checks
reject a missing, altered or linked review, including a self-rehashed review
and envelope that drop an AND term. The valid capsule remains byte-unchanged
after behavior/SDK use and all 78 rejection controls. The new controls include
actual receipt deletion/tampering/links, false scope flags, and coordinated
workspace/registry witness plus envelope self-rehash. Additional controls
reject missing, altered or linked generated-manifest evidence
and coordinated semantic digest/record/envelope substitution. Exact source/build
identities are independent of the carrying envelope; they do not authorize
replacement input metadata. Test fixtures are removed only from each
invocation's exact owned temporary directory, not existing deliveries/caches.

A future immutable candidate must actually carry the bound license envelope
or an equivalent exact distribution binding, and close the remaining audit
obligations. Dropping the envelope and publishing bare roots is not covered
by this gate. The current catalog, prod pointer and v0.0.20 inventory are not
changed or promoted by these checks.
