// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;

use clap::Parser;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    
    // If we have more than 1 argument, or the first argument is not the binary path (unlikely), 
    // we assume CLI mode. Note: Tauri might pass some args, so we check specifically.
    if args.len() > 1 {
        // If the only argument is --minimized, we let it fall through to the GUI
        if args.len() == 2 && args[1] == "--minimized" {
            // Proceed to GUI
        } else {
            // For any other arguments, we treat it as a CLI call.
            // .parse() will print help/errors and exit the process.
            let parsed = cli::Cli::parse();
            cli::run_cli(parsed);
            return;
        }
    }

    sysora_lib::run();
}
