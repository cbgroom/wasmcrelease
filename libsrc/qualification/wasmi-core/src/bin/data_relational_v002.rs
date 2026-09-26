use anyhow::{bail, Context, Result};
use wasmi::{Engine, Linker, Module, Store};

fn main() -> Result<()> {
    let path = std::env::var("WASMC_LIBSRC_DATA_RELATIONAL")
        .context("WASMC_LIBSRC_DATA_RELATIONAL is required")?;
    let bytes = std::fs::read(&path).with_context(|| format!("read {path}"))?;

    let engine = Engine::default();
    let module = Module::new(&engine, &bytes[..]).context("Wasmi validation failed")?;
    if let Some(import) = module.imports().next() {
        bail!(
            "pure relational Lib unexpectedly imports {}.{}",
            import.module(),
            import.name()
        );
    }
    let mut store = Store::new(&engine, ());
    let instance = Linker::<()>::new(&engine)
        .instantiate_and_start(&mut store, &module)
        .context("Wasmi instantiation failed")?;
    if instance.get_memory(&store, "memory").is_none() {
        bail!("memory export missing");
    }
    if instance.get_export(&store, "cabi_realloc").is_none() {
        bail!("canonical allocator export missing");
    }

    let exports = [
        "wasmc:data-relational/relational@0.0.2#group-aggregate",
        "wasmc:data-relational/relational@0.0.2#union-all",
        "wasmc:data-relational/relational@0.0.2#equi-join",
        "wasmc:data-relational/relational@0.0.2#window-rank",
        "wasmc:data-relational/relational@0.0.2#distinct",
        "wasmc:data-relational/relational@0.0.2#window-offset",
    ];
    for export in exports {
        if instance.get_export(&store, export).is_none() {
            bail!("expected v0.0.2 Core export missing: {export}");
        }
    }
    for stale in [
        "wasmc:data-relational/relational@0.0.1#distinct",
        "wasmc:data-relational/relational@0.0.1#window-offset",
    ] {
        if instance.get_export(&store, stale).is_some() {
            bail!("stale v0.0.1 candidate export unexpectedly present: {stale}");
        }
    }

    println!(
        "{{\"accepted\":true,\"schema\":\"wasmc.data-relational-v002-wasmi/v1\",\"engine\":\"wasmi-2.0.0\",\"bytes\":{},\"imports\":0,\"instantiated\":true,\"exports_checked\":{},\"new_exports\":[\"distinct\",\"window-offset\"],\"semantic_scope\":\"structural-engine-qualification-only\"}}",
        bytes.len(),
        exports.len()
    );
    Ok(())
}
