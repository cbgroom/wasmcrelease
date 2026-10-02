# Future all18 license admission

Task state: started
Base: 4ca6374da5521d25b3c1c0449d1c6dfb9cffe811
Objective: Reject new candidate creation unless every original all18 target has
an exact selected v2 root and digest-bound explicit license files, including
generated Rust SDK license-file linkage when a Rust SDK is carried.
Plan: add a bounded source-free declaration/identity checker, wire it into new
candidate creation only, exercise positive and missing/drift negative controls.
Boundaries: no binary rebuild, old root/tag/prod/candidate/integrity mutation,
private source disclosure, legal compatibility claim or runtime qualification.
This structural gate cannot prove resolved dependency notice completeness.
Validation: focused Node tests; unchanged frozen identity checks; old current
candidate must keep rejecting pre-existing tool drift. Full maintainer gate
currently stops at lib-catalog manifest mismatch, not a new waiver.
Resume: implement checker and tests; preserve all18 denominator and inspect diff.
