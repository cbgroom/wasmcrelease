# Current implementation: wasmc-system-ios-app-surface-control

Source authority: `libspec/wasmc-system-ios-app-surface-control/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# iOS App surface-control provider

This candidate is the iOS implementation of the platform-neutral
`wasmc:system-app-surface-control@0.0.3` contract. Public semantics live in
`lib.wit`; Apple-specific source and framework requirements live only below
`platform/ios/`.

The provider is statically linked into the fixed embedded Swift Host. Its
`embedded-source` binding is selected from exact target metadata by the common
profile resolver; neither the package name nor an `ios` string in Host code is
selection authority. A future Android, macOS, Windows or other implementation
should use a distinct provider package with the same WIT identity when the
semantics match, its own `platform/<os>/binding.json`, and an independently
qualified target tuple.

`examples/ios-app/` is the runnable XcodeGen application demonstrating five
parallel surfaces, confirmed human handoff, edge docking and system Picture in
Picture. It consumes this package's `platform/ios` provider directly; it is not
a second owner or copy of the provider implementation.

`examples/ios-webview-agent/` composes two real `WKWebView` surfaces. It retains
stable DOM semantic snapshots and performs a direct element action on one
surface while real XCUITest text input remains active on the other. The Agent
action never enters the UIKit physical input stream.

The retained iPad Simulator qualification covers five application-owned UIKit
surfaces, semantic Agent activation, confirmed human handoff, edge docking and
user-started system Picture in Picture lifecycle, plus real WKWebView/DOM
observation and isolated virtual activation. It does not qualify physical-device
PiP pixels, iPhone PiP, arbitrary remote pages, Wasm lowering, admission or release.
