# iOS deferred-work example

The example registers one BGAppRefresh identifier, submits a request, verifies
that it remains pending across a Home/foreground cycle, cancels it and verifies
the pending set becomes empty. It does not invoke private BGTaskScheduler debug
selectors and does not claim system delivery.
