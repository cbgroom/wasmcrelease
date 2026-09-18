# Host qualification

Public evidence distinguishes implementation from qualification.

Recommended states:

- `implemented`
- `simulated`
- `qualified`
- `production-qualified`

Receipts should identify target, OS/device, contract identity, tested
capabilities, exact commit, behavior matrix, and known limitations.

## Qualification dimensions

Native and JS-runtime qualification is recorded as physical platform × embedding when both dimensions are meaningful. Browser engine qualification is embedding-only; Browser is not treated as an operating-system platform.

See `matrix.json`.
