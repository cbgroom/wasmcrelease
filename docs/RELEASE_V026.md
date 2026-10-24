# WAsmC v0.0.26

This patch removes unused Table write and error-provider imports from pure static HTTP and read-only JSON applications. The SDK derives optional Host wrapper demand from actual caller imports. Static/read-only final modules use13 HTTP imports instead of18; applications calling Table retain their required imports and unchanged module bytes. The existing eight-module protocol, pinned cold assets, Core4.9.1 and42 current Lib Roots are unchanged.

The exact compiler is42c547a4f0819c081d66fddebedfa984098cbdb18d463c6a872e62a8683d70fe, built from c8540e8bad60d17553ca0e224e1aa2ee38246360 and integrated as4a299fbbb92a518d6a2dd6cdc92333d37ad956a7. See current/compiler-release.json and examples/canonical-host/import-demand-proof.json for complete custody and finite actual merged execution.

This changes package construction only. It does not change MCPGit Core, permissions, fuel limits or the live default compiler. Publication and downloaded installation evidence are recorded separately from Source integration.
