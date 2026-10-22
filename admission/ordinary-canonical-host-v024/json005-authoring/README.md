# Original JSON0.0.5 producer inputs

The six materialized authoring files were read from the completed producer
workspace. They contain the JSON Lib implementation and its original Cargo/WIT
inputs. They contain no private compiler implementation.

producer-custody.json retains the original producer report, exact original
private receipt digest, driver digest, observed Source HEAD, command and elapsed
time. The original build took14.763 seconds and produced the exact published
Root candidate manifest3bfaa6449d8800aaa98a7068ceccaae3527490f6cb7773b53b70195e9c7eaadc.
This recovery performs no compilation and makes no claim that a later Source
HEAD performed that build.

source-lib.build.json is independently read from canonical9e6d, Git blob
d0dda97116202e0639db647348cdc324b066a005 and SHA283ce7886cdca94d53b7a646b403471c0482be502be933e0a5a3e7e072ce9820,
which exactly matches the original receipt's source-spec digest. The materialized
lib.build.json has SHA758147e0b88aa12c028d85301a316b48dcb9541a52c475795ebaa3cdf52da38d.
Only rust.crate_dir differs to select the producer workspace layout. The initial
incorrect source/materialized digest comparison is preserved in
source-spec-custody.json; all other parsed JSON fields are independently equal.

The original build specification uses a workspace containing
json-record-view/workspace/json-adapter. Preserve that relative layout when
reconstructing producer inputs. Complete LICENSE and original notice bytes are
already bound by the unchanged18-file Root in standard/wasmc-json/0.0.5.
The authoring packet is provenance, separate from that hermetic installable Root.

Root Core and Component each passed actual wasm-tools validation. The raw Core
API test executes all13 APIs and compares27 ordinary valid-input results with
the original0.0.1 Root on each of Node/Bun/Deno. It also executes256 alternating
success/failure pairs with stable18-page linear memory after post-return cleanup.
It does not claim equivalence for every malformed-input error precedence, actual
Component runtime execution, current-catalog admission or formal publication.
