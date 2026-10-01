# Ordinary App admission probe (development only)

This is not a new published compiler or catalog. The clean matching producer
compiled the retained Host Clock source into a 113-byte ordinary Core App.
The public replay needs no private repository, compiler or provider source:

```sh
node scripts/test-current-v2-app.mjs
```

The replay checks exact App/provider/manifest identities, executes 640 calls
including signed overflow, rejects missing/non-function imports, and propagates
the original Host exception. Fifteen mutation controls reject false promotion,
missing observations and changed identities. Binding a declared clock function
is an embedding fixture, not a new platform Host API or real OS clock test.

`admission/current-v2-next/ordinary-app.json` retains the matching producer,
compiler library fingerprint, source, artifact identities and actual diagnostics.
Host Clock is locally App-qualified with that compiler only. HTTP1, Owned
Algorithms and Data Core reject complex-value Core transport; Resource Counter
rejects constructor/method transport. These four rejections occur before source
body type checking. Their probe snippets are NOT validated executable examples
and do not demonstrate that a repaired resolver would compile the full bodies.
Generated SDK success does not close these missing App mechanisms. Component
fallback, raw handles, package-specific compiler dispatch and fake imports are
not used to conceal the rejection.

The maintainer-only producer probe is `scripts/probe-current-v2-app.mjs`. It
accepts an explicitly selected clean private producer and builds/links only
there. Public CI never downloads or builds private compiler source; it replays
the retained App. The existing dual-runtime feature profile is used because
the current default Wasmtime-only build independently fails its feature gate.
This probe does not fix that defect. All-package App admission, package license
binding, catalog admission and immutable release qualification remain pending.
