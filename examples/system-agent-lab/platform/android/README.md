# Android System Agent Lab

This platform composition selects the exact display, semantic UI, shell input
and direct uinput Lib providers used by the Android ARM64 Emulator qualification.
It reuses the repository's resolved Library OS profile and runtime gate instead
of copying a second Android harness.

```sh
node scripts/validate-android-system-agent-lab.mjs
node scripts/test-android-system-agent-lab.mjs
```

The second command may boot the configured `medium_phone` AVD. Emulator evidence
does not qualify a physical Android device.

