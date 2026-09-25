fn main() {
    let args: Vec<_> = std::env::args().collect();
    assert_eq!(args.len(), 3, "componentize CORE OUTPUT");
    let core = std::fs::read(&args[1]).unwrap();
    let component = wit_component::ComponentEncoder::default()
        .module(&core).unwrap().validate(true).encode().unwrap();
    std::fs::write(&args[2], &component).unwrap();
    println!("component_bytes={}", component.len());
}
