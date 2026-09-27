# WAsmC Linux uinput system Lib

Unreleased Linux system Lib prototype for virtual input devices. Its WIT owns
the public virtual-keyboard semantics and its exact native adapter owns every
Linux uinput detail: `/dev/uinput`, `UI_SET_*`, `UI_DEV_SETUP`,
`UI_DEV_CREATE`, `input_event` emission and `UI_DEV_DESTROY`.

The fixed native Host only verifies and invokes the Lib-owned descriptor. It
contains no uinput device path, ioctl, key code or input-event knowledge. The
qualification controller reads `wfc-profile.json`, creates a real kernel
virtual keyboard, opens the generated evdev endpoint, observes key-down and
key-up records, qualifies batched event delivery with one kernel write per
batch, destroys the device and rejects its stale resource token.

Run the qualification as root in a Linux environment exposing the uinput misc
device. The test fails rather than substituting a simulator when uinput is not
available. The public-source candidate is listed in the source registry, but it
is not admitted, catalogued for installation, discoverable, installable or
released.
