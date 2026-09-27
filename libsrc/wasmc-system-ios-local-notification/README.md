# iOS local-notification provider

This Lib maps `wasmc:system-local-notification@0.0.1` to
`UNUserNotificationCenter` without extending the fixed Host. Its package-local
example requests notification authorization through the real system prompt,
schedules a deterministic five-second local notification, presses Home, and verifies after
foreground return that the system-retained notification has the exact identifier,
title, body and payload.

Simulator qualification proves local scheduling and delivery while the App is
away from the foreground. It does not prove APNs remote push, silent push,
notification service/content extensions, Focus behavior, force-quit delivery,
or physical-device presentation. Authorization remains user-controlled: a
denial is not cached as permission and a later explicit request can try again
when the OS state permits it.
