# Camera provider semantic model

Camera is a semantic capability whose acquisition is platform-specific but whose
frame lifecycle should remain shared.

The machine-readable model is `model.json`. It deliberately does **not** mark
camera implemented or qualified on any platform.

## Shared semantics

- one capture effect maps to one Host Operation and one terminal Completion;
- a frame has 1–16 bounded planes;
- each plane lowers to a bounded `{window, offset, length}` slice;
- completion reports aggregate transferred bytes only;
- cancellation remains request-only and Drop remains supervision-only;
- native camera handles, pixel-buffer addresses, descriptor/fd/HANDLE values,
  permission tokens and platform identities never become Guest authority.

A two-plane NV12 1920×1080 fixture (`2073600 + 1036800 = 3110400` bytes)
is preserved only as structural evidence that multi-plane capture can reuse the
existing optional vector-transfer lane without adding per-plane completion or a
new kernel resource type.

## Platform boundary

Platform providers own:

- device discovery/acquisition;
- permission and app-sandbox integration;
- native frame/buffer acquisition;
- mapping native planes into bounded Host windows;
- platform close/retirement acknowledgement.

The shared camera model owns the frame/plane lifecycle after acquisition.
This prevents V4L2, AVFoundation, Android Camera2/AImageReader, Harmony camera
objects or Windows Media Foundation identities from leaking into the Host ABI.

Real platform support remains `unimplemented` until a canonical provider exists
and platform qualification evidence passes.
