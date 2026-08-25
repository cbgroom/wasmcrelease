fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (bytes, result) = wasmc_wasmtime_demo::exercise()?;
    println!("compiled {bytes} bytes; run(5, 6) = {result}; FastAPI Core 4.3 initialized");
    Ok(())
}
