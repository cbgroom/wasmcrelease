# iOS background-audio example

The UI test starts the Lib-owned deterministic WAV fixture, presses Home for
four seconds and returns. Acceptance requires at least five samples recorded
while UIKit reports `background`, every sample still playing, and at least 1.5
seconds of player-position progress.
