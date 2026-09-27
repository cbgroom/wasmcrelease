# iOS App Contacts

This public-source candidate proves that an exact domain Lib can use an iOS
protected capability after authorization without adding a Contacts API to the
fixed Host. Its qualification operation creates a uniquely named temporary
contact, fetches it by identifier, deletes it and confirms cleanup.

Authorization acquisition remains owned by the separate App authorization
policy Lib. This Contacts Lib never prompts. It fails closed without attempting
the operation unless the current Contacts state is `authorized`.

The iOS Simulator qualification grants Contacts through `simctl privacy`, then
executes the real Contacts framework roundtrip. That is simulator evidence, not
a physical-device or production-data claim. WIT-to-Wasm lowering, admission and
release remain pending.
