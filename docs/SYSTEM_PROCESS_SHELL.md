# System process and shell channels

Status: **macOS aarch64 locally qualified; Linux x86_64 and Windows x86_64 CI
qualification pending; not admitted; not released**.

## Boundary rule

Process and shell semantics belong to an exact System Lib. The fixed Host owns
only resource/window/operation/completion mechanics and a Lib-defined adapter
descriptor. Adding `/bin/sh`, `cmd.exe`, PowerShell or a mobile command runtime
must not add a Rust, Swift or Java process method to the Host API.

The portable API has two deliberately separate paths:

- `processes.run(executable, arguments, options)` is the default. Arguments are
  passed literally and are never parsed by a shell.
- `shells.run(kind, script, options)` is explicit. It runs a script using the
  selected platform provider and therefore has that shell's quoting and
  expansion rules.

Both return bounded stdout and stderr, exit code or terminating signal,
timeout/output-limit state and elapsed time. Options cover stdin, working
directory, environment inheritance/overlay, timeout and combined output limit.
The full-host profile deliberately adds no per-domain grant or allowlist API.

## Platform truth

| Target | Channel | Current evidence | Exact boundary |
|---|---|---|---|
| Linux desktop | executable + argv; `/bin/sh -c` | implementation complete; independent x86_64 CI pending | Node Lib adapter |
| macOS desktop | executable + argv; `/bin/sh -c` | local aarch64 real execution PASS | Node Lib adapter |
| Windows desktop | executable + argv; `%ComSpec% /d /s /c`; Windows PowerShell `-NoProfile` | implementation complete; independent x86_64 CI pending | Node Lib adapter |
| Android App | executable + argv; optionally `/system/bin/sh -c` inside the App sandbox | not implemented or qualified | future Android native Lib adapter, exercised as the App UID |
| iOS/iPadOS App | no general OS child-process or shell channel | platform limitation | only a separately named in-process command/runtime Lib is possible |
| Browser | no OS child-process or shell channel | platform limitation | only worker/Wasm/in-process command Libs are possible |

An `adb shell` success is evidence for Android's shell user, not for an Android
application. A command launched by a macOS simulator supervisor is evidence for
the macOS host, not for an iOS application. Neither may be recorded as mobile
shell qualification.

Android's future provider may execute only what the App UID and SELinux domain
can execute; it is not root and does not inherit adb privileges. iOS must not
present a bundled interpreter as an OS shell. If an in-process command language
is added, its command inventory and observable semantics need a different WIT
identity so callers cannot confuse it with arbitrary native process execution.

## Qualification

Run the exact provider on the current desktop target:

```sh
node scripts/test-system-process-shell.mjs
```

The qualification proves literal argv handling, cwd/environment/stdin,
stdout/stderr/non-zero exit capture, native default shell execution, timeout,
combined-output bounds, fail-closed foreign-shell selection and the unchanged
fixed Host executor identity. Windows additionally exercises Windows
PowerShell. `.github/workflows/system-process-shell-candidate.yml` runs the same
test on Linux, macOS and Windows; a local PASS must not be promoted to
cross-platform qualification before those exact jobs succeed.
