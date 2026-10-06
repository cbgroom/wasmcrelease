# Current implementation: wasmc-system-ios-background-audio

Source authority: `libspec/wasmc-system-ios-background-audio/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# iOS background-audio provider

This Lib maps `wasmc:system-background-audio@0.0.1` to AVAudioSession and
AVAudioPlayer without extending the fixed Host. Its package-local example plays
a deterministic, inaudible PCM fixture, presses Home and journals player-clock
samples while UIKit reports the App as backgrounded.

Simulator qualification proves playback-session mechanics and clock progress;
it does not prove audible physical output, lock-screen controls, route changes,
Bluetooth/AirPlay, interruptions, calls, media-services reset, thermal behavior,
or App Store policy suitability. Those remain physical-device gates.
