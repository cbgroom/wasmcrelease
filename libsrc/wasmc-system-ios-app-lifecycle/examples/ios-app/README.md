# iOS App background lifecycle example

This package-local qualification App wires UIKit lifecycle callbacks to the
Lib-owned lifecycle provider. Its UI test presses the Simulator Home button,
waits while a finite UIKit background task advances, returns to the App, then
terminates and relaunches it to prove the append-only journal survived the
process boundary.

The result is evidence for UIKit lifecycle callbacks and finite background work
on the exact simulator runtime only. It is not evidence that the simulator
suspended the process, that iOS later scheduled new work, or that the behavior
matches a physical device.

`testEightSecondFiniteBackgroundWindow` is a fast possibility probe: it keeps a
finite task alive for eight seconds, records remaining-time samples, and returns
before any expiration wait.
The matrix test methods cover 15, 30 and 60 seconds independently so a first
observed expiration can stop the run without spending the whole budget on one
long case.
