# Host runtime

Portable execution machinery belongs here:

- Resource table
- Operation table
- Completion lifecycle
- Window ownership
- Lib-defined native descriptor execution
- platform/embedding boundary dispatch

Domain, OS and vendor APIs do not belong here. New domains must not add runtime
methods; they add exact Lib WIT plus matching physical descriptors.
