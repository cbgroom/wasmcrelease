use wasmc_host::{HostBindPolicy, WasmcHost};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let host = WasmcHost::native(HostBindPolicy::Development)?;
    let report = host.binding_report();
    println!(
        "platform={:?} policy={:?} bound={} skipped={}",
        report.platform(),
        report.policy(),
        report.bound().len(),
        report.skipped().len()
    );
    for binding in report.bound() {
        println!(
            "bound selector={} kind={:?} origin={:?}",
            binding.selector(),
            binding.kind(),
            binding.origin()
        );
    }
    for skipped in report.skipped() {
        println!(
            "skipped selector={} reason={}",
            skipped.selector(),
            skipped.reason()
        );
    }
    for note in report.notes() {
        println!("note={note}");
    }
    Ok(())
}
