mod compiler;

/// Native Scarp compiler operations are limited to explicit user actions.
/// No automatic execution, shell plugin or unrestricted filesystem scopes.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(compiler::CompilerRuntime::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            compiler::scarp_probe,
            compiler::scarp_execute,
            compiler::scarp_project_action,
            compiler::scarp_cancel
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Scarp Studio");
}
