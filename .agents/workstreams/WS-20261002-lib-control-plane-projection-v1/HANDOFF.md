# Current-side Lib control-plane projection

## 0. Status

Task state: started. Integration state: not-ready; future public work only.

## 1. North Star

Public catalog identity and generated projections must agree. Current-side
installability, immutable released inventory, and all18 future admission remain
separate claims. No private compiler knowledge is imported.

## 2. Current Focus

Regenerate only the current-side derived fields in
`lib-ecosystem-control-plane.json` from the existing public catalog/generator.
The catalog contains five selected roots while the projection still reports
three. Keep historical22-package/140-API release facts unchanged.

## 3. Recent Progress

Base public main is clean synchronized
dd30f28276a633cefb68972186c2cbeb2fca4a80. The reused telemetry worktree was clean
0/0 and its former branch46813c9346022820f1a725d9b0f9cb8ed1fd03f7 is integrated;
its branch/history remain unchanged. Current registered tasks are merged and
do not overlap this claim. Related current-v2 and learning work is integrated.
Retained discovery a02768d19e73398cc4fc857313869035c16f42db is not integrated;
its catalog/install/discovery edits do not touch this projection or new test.

## 4. Current Action

Task state: started
Objective: remove a stale public current-side inventory projection without
promoting packages or modifying frozen release identity.
Technical basis: the existing generator independently derives the exact
current catalog set and per-package current-side fields; its read-only check
rejects the old three-root projection. No generator/API change is necessary.
Plan: push this START, run the existing generator, admit only its intended
projection diff, add a focused independent positive/negative regression,
retain failures and exact public input/output identities, then checkpoint.
Boundaries: only the three declared claims; no global HANDOFF/Skill write,
catalog or all18 denominator change, capability/qualification promotion,
compiler or Lib rebuild, Cargo, new release/candidate/tag, main integration,
or private source/path/receipt import.
Validation: actual generator check, independent catalog-set and per-package
checks with stale-count/row negative controls, current-v2 closure, historical
route closure, exact frozen-file preservation, old-candidate drift rejection,
maintainer rejection classification, git diff check and clean push/readback.
Resume point: implementation starts only after this START is committed/pushed.
Cache/disk: Node-only bounded metadata; zero Cargo targets/heavy writers;
expected additional files below1MiB, no cache eviction or floor waiver.

## 5. Next Actions

1. Push START, regenerate the existing projection and review exact changed fields.
2. Qualify the focused test, preservation and rejection controls.
3. Commit/push the result; leave serialized main integration to its owner.

## 6. Validation Commands

- node scripts/lib-ecosystem-control-plane.mjs --check
- node scripts/test-lib-control-plane-projection.mjs
- node scripts/test-current-v2-closure.mjs
- node scripts/lib-route-closure.mjs --check
- node scripts/release-candidate.mjs verify channels/candidates/0.0.20.json
- ./scripts/maintainer-orient.sh
- ./scripts/validate-maintainer.sh
- git diff --check

## 7. Do Not Do

Do not refresh integrity around future bytes as0.0.20. Its unchanged candidate
already rejects changed tools, and full orientation rejects the known frozen
`scripts/lib-catalog.mjs` identity. Preserve both rejection facts rather than
claiming full maintainer or release PASS. The immutable v0.0.20 peeled identity
remains4674d65c2650e6cbdddc3a4d0f4510911ae97ea3.

## 8. Recovery

Use this branch's task.json and HANDOFF as the resume state. Public source base,
existing generator and catalog are sufficient; no private repository access
is needed. No new candidate or release has been allocated.
