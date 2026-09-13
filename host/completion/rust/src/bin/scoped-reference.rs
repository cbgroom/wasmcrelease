use serde_json::json;
use wasmc_completion_guard::scoped::{BindingIdentity, ScopedCompletionGuard, ScopedToken};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let mut g = ScopedCompletionGuard::new(BindingIdentity::from_hex(&args[2]).unwrap()).unwrap();
    let w = g.acquire(1).unwrap();
    let op = g.submit(&w).unwrap();
    if args[1] == "create" {
        println!("{}", json!({"window":w.to_wire(),"operation":op.to_wire()}));
        return;
    }
    let oldw = ScopedToken::from_wire(&args[3]).unwrap();
    let oldop = ScopedToken::from_wire(&args[4]).unwrap();
    let foreign = [
        g.submit(&oldw).err(),
        g.read(&oldw).err(),
        g.release(&oldw).err(),
        g.poll(&oldop).err(),
        g.cancel(&oldop).err(),
        g.complete(&oldop, &[9], 0).err(),
    ];
    let live = g.counts();
    g.complete(&op, &[7], 0).unwrap();
    let bytes = g.read(&w).unwrap();
    g.release(&op).unwrap();
    g.release(&w).unwrap();
    println!(
        "{}",
        json!({"window":w.to_wire(),"operation":op.to_wire(),"foreign":foreign,"live":live,"bytes":bytes,"final":g.counts()})
    );
}
