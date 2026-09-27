# App authorization policy

This public-source candidate owns the platform-neutral authorization state and
planning model. It keeps permission vocabulary and repeat-prompt policy out of
the fixed Host.

Discovery must never prompt. A request is planned whenever an exact
`not-determined` capability is needed and no request for that capability is
currently in flight. Prior unsuccessful attempts do not permanently suppress a
later request. Authorized, limited,
provisional, ephemeral and permission-free capabilities proceed without a
request. Denied states route to application settings. Restricted, unavailable
and unknown states fail closed.

Attempt history is persistent evidence, not a one-shot authorization gate. An
application may show one rationale surface for a batch, but operating-system
prompts remain separately owned by each permission category. The matching iOS
provider currently qualifies ten status adapters, thirteen permission-free App
capabilities, repeat planning after an unsuccessful attempt, in-flight request
deduplication and a persistent attempt-history roundtrip without producing a
system prompt. On iOS a denied system permission cannot be prompted again by the
App, so each later demand reoffers the Settings recovery path instead.

Physical-device prompt callbacks, settings-return reconciliation, Component
lowering, admission and release remain pending.

The iOS Simulator binding now qualifies real Contacts request callbacks for both
allow and deny. This closes the simulator callback gate only: physical-device
prompt behavior and returning from Settings remain pending.
