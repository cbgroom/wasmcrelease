// Public consumer glue only; the selected private producer supplies its API.
use std::{env, fs, path::Path};

fn main() {
    let args: Vec<String> = env::args().collect();
    assert_eq!(args.len(), 4);
    let source = fs::read_to_string(&args[2]).unwrap();
    match wasmc::compile_with_local_lib_catalog(&source, Path::new(&args[1])) {
        Ok(bundle) => {
            assert_eq!(bundle.libs.len(), 1);
            fs::write(&args[3], bundle.app_wasm).unwrap();
            println!("compiled");
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    }
}
