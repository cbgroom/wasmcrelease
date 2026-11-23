# Release critical path

Apply the version's admission policy in
[Release channels](../../../../docs/RELEASE_CHANNELS.md). Plan around three
independent deliverables. Close the admitted producer handoff and the tested
public candidate before publishing the exact rehearsal and verifying anonymous
readback.

## Preflight the candidate and the production view

1. Reconcile the independently observed public tag, GitHub Latest and default
   package index. Read the producer receipt and compare the build's exact
   inputs and artifact hashes with the admitted private Source. Assemble from
   the already measured carriers and Roots. Use separately scoped work or a
   supported evidence bridge when only one producer changes.
2. Before dispatching the expensive matrix, exercise the real consumer
   commands locally on the selected catalog. Check package/license closure
   with `node scripts/validate-libs.mjs` and the active license checker. Run
   `node examples/lib-search/run.mjs` and exercise an installed Root with
   `node scripts/validate-lib-install.mjs github` and the `jsdelivr` mirror.
   Verify copyable entrypoint
   commands and their versions and hashes against the selected Roots
   (`AGENTS.md`, `LIB.md`, Skills, quickstart and examples). Where a shell
   command is piped through `tee`, require both the producer's exit status and
   its actual result. Treat skipped, missing or empty output as such.
3. Check the three Runtime receipts against the shipped compiler digest and
   one actually exercised source-free archive. On a compiler change, regenerate
   the Node, Bun and Deno receipts early. Old Host receipts cannot qualify
   replacement compiler bytes even when the candidate verifier opens them.
4. Prepare the lifecycle projection in an isolated checkout while public
   qualification runs. Exercise the same release, channels, routing, SDK
   states, license and checksums the final archive will expose. Useful checks
   include `node scripts/validate-integrity.mjs`,
   `node scripts/validate-license-policy.mjs`,
   `node scripts/validate-sdk-agent-routes.mjs` and
   `node scripts/test-agent-quickstart.mjs`. An unpublished draft can test those
   projections while release acceptance stays pending. Use the checker for the
   active product variant. Public authored-Lib refresh checks require the
   public Rust authoring inputs. A source-free private-producer overlay uses
   the candidate's public projection and notice checks plus private custody.
   If a generic maintainer check demands private authoring files, retain the
   rejection and diagnose the variant mismatch. Keep every genuinely required
   consumer check in the qualification set.

## Run and recover only the affected qualification

- Dispatch independent public runtime, LibSearch and Native lanes when their
  respective inputs are pinned. Run preparation and deterministic checks while
  CI is queued. Keep one current run for each changed lane. Read concurrency
  and recovery inputs in the workflow before dispatching. The normal consumer
  workflow can cancel an in-flight run on the same ref.
- On failure, save the original job/command outcome and retrieve its report.
  A cancellation before runner assignment is infrastructure evidence. Check
  runner availability and supported labels for the same OS and architecture
  before retrying. Prefer a supported targeted recovery or download-only path
  when the necessary package already exists.
- Carry a passing result forward only when the applicable policy permits reuse
  and a recorded input bridge proves that every input consumed by the check is
  unchanged. Record actual tested commits, commands, environment, run/job and
  artifact digests, the candidate commit, and the bounded diff with an explicit
  justification for each changed path. Re-run the affected commands and the
  new candidate's identity checks. Preserve the original failed aggregate and
  identify the source of each recovered cell or command. Mixed-source
  evidence must remain distinguishable from one green exact-commit run.
- Freeze the final production rehearsal with the actual qualifying receipts.
  Run the version's complete live Agent cohort on that exact commit and tree
  after deterministic checks pass. Review each first final and its execution
  evidence against the original task. Preserve failures. Resolve the specific
  mismatch before another complete run when it comes from the product or
  guidance. A bounded complete retry can confirm an isolated transient. Keep
  the admitted policy, cases and budgets and require one complete cohort. A
  pre-publication edit to the rehearsal requires a new receipt.

## Publish and read back

- Verify the independent Agent receipt before creating the immutable tag.
  Check the remote tag's dereferenced commit and the current default pointer.
  Upload approved assets to a draft and compare the remote inventory, sizes
  and digests with the local files before publishing. Resolve a draft by its
  numeric release ID if the by-tag REST endpoint returns 404. Read back
  uncertain operations before retrying and upload only assets still missing.
- Confirm GitHub Latest, the immutable tag and default package index from an
  anonymous consumer. Download the official asset set and check the published
  digests. Reopen the archive without Git metadata, install a Root from each
  qualified mirror, and execute it. Verify the required Native package
  inventory and exercise a compatible downloaded CLI where available.
- Save the release, asset and consumer receipts after the tag so their commit
  cannot change the attested tree. Record time spent building, queued,
  qualifying and publishing when diagnosing slow releases. Use those actual
  measurements to choose the next optimization.
