//! Local, bounded Scarp compiler discovery. Never executes a candidate while scanning.
//! A discovered executable is untrusted until the user approves the native probe.
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};

const MAX_ENTRIES: usize = 4096;
const MAX_CANDIDATES: usize = 24;

fn expected_file_name() -> &'static str {
    if cfg!(windows) { "scarp.exe" } else { "scarp" }
}

fn record_binary(path: &Path, found: &mut Vec<String>, seen: &mut HashSet<PathBuf>) {
    if found.len() >= MAX_CANDIDATES
        || !path.file_name().is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case(expected_file_name()))
    {
        return;
    }
    let Ok(canonical) = fs::canonicalize(path) else { return };
    if canonical.is_file() && seen.insert(canonical.clone()) {
        // A path is only a candidate, not evidence of a trusted Scarp build.
        found.push(canonical.to_string_lossy().into_owned());
    }
}

/// Scan only explicit roots and a shallow, name-filtered Downloads tree.
/// The entry budget prevents a large home directory from freezing startup.
fn scan_directory(
    dir: &Path,
    depth: u8,
    descend_all: bool,
    budget: &mut usize,
    found: &mut Vec<String>,
    seen: &mut HashSet<PathBuf>,
) {
    if *budget == 0 || found.len() >= MAX_CANDIDATES { return; }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if *budget == 0 || found.len() >= MAX_CANDIDATES { break; }
        *budget -= 1;
        let path = entry.path();
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_file() || kind.is_symlink() {
            record_binary(&path, found, seen);
        } else if depth > 0 && kind.is_dir() {
            let scarp_named = entry.file_name().to_string_lossy().to_ascii_lowercase().contains("scarp");
            if descend_all || scarp_named {
                scan_directory(&path, depth - 1, true, budget, found, seen);
            }
        }
    }
}

fn scan_directories(roots: &[(PathBuf, u8, bool)]) -> Vec<String> {
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    let mut budget = MAX_ENTRIES;
    for (root, depth, all) in roots {
        scan_directory(root, *depth, *all, &mut budget, &mut found, &mut seen);
        if budget == 0 || found.len() >= MAX_CANDIDATES { break; }
    }
    found
}

fn standard_roots() -> Vec<(PathBuf, u8, bool)> {
    let mut roots = Vec::new();
    if let Some(home) = env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }) {
        let home = PathBuf::from(home);
        roots.push((home.join(".cargo").join("bin"), 0, false));
        // Users can extract an official GitHub ZIP into Downloads/Scarp*.
        roots.push((home.join("Downloads"), 3, false));
    }
    if cfg!(windows) {
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            roots.insert(0, (local.join("Programs").join("Scarp"), 2, true));
            roots.insert(1, (local.join("Scarp"), 2, true));
            roots.insert(2, (local.join("Microsoft").join("WinGet").join("Links"), 0, false));
        }
        if let Some(program_files) = env::var_os("ProgramFiles") {
            roots.push((PathBuf::from(program_files).join("Scarp"), 2, true));
        }
    }
    // Search each PATH directory directly; never run an untrusted 'where' command.
    if let Some(path) = env::var_os("PATH") {
        roots.extend(env::split_paths(&path).filter(|p| p.is_absolute()).map(|p| (p, 0, false)));
    }
    roots
}

/// Discovery is non-executing; approval and capability probing occur at Run time.
pub fn discover() -> Vec<String> {
    scan_directories(&standard_roots())
}

#[tauri::command]
pub async fn scarp_detect() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(discover)
        .await
        .map_err(|e| format!("Scarp discovery worker failed: {e}"))
}

/// Open the official release listing in the OS browser on explicit click.
/// This is not an unattended binary installer.
#[tauri::command]
pub fn scarp_download_page() -> Result<(), String> {
    const RELEASES: &str = "https://github.com/scarp-lang/scarp/releases";
    #[cfg(windows)]
    {
        let root = env::var_os("SystemRoot").or_else(|| env::var_os("WINDIR"))
            .ok_or("Windows system directory is unavailable")?;
        let explorer = PathBuf::from(root).join("explorer.exe");
        if !explorer.is_file() { return Err("Windows Explorer executable was not found".into()); }
        std::process::Command::new(explorer).arg(RELEASES).spawn()
            .map_err(|e| format!("Could not open the official Scarp downloads: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open").arg(RELEASES).spawn()
            .map_err(|e| format!("Could not open the official Scarp downloads: {e}"))?;
        Ok(())
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open").arg(RELEASES).spawn()
            .map_err(|e| format!("Could not open the official Scarp downloads: {e}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn detects_extracted_archive_without_running_it() {
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let root = env::temp_dir().join(format!("studio-detect-{}-{unique}", std::process::id()));
        let versioned = root.join("scarp-0.0.6-alpha.16").join("bin");
        fs::create_dir_all(&versioned).unwrap();
        fs::write(versioned.join(expected_file_name()), b"not actually executable").unwrap();
        fs::write(versioned.join("unrelated.exe"), b"ignored").unwrap();

        let found = scan_directories(&[(root.clone(), 3, false)]);
        assert_eq!(found.len(), 1);
        assert!(found[0].ends_with(expected_file_name()));
        // Only discovery occurred: the fake executable never needed to be runnable.
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn does_not_descend_into_unrelated_download_folders() {
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let root = env::temp_dir().join(format!("studio-unrelated-{}-{unique}", std::process::id()));
        let unrelated = root.join("random-folder");
        fs::create_dir_all(&unrelated).unwrap();
        fs::write(unrelated.join(expected_file_name()), b"untrusted").unwrap();
        assert!(scan_directories(&[(root.clone(), 3, false)]).is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_non_scarp_name_and_duplicate_paths() {
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let root = env::temp_dir().join(format!("studio-duplicates-{}-{unique}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join(expected_file_name()), b"candidate").unwrap();
        fs::write(root.join("scarp-helper.exe"), b"ignored").unwrap();
        assert_eq!(scan_directories(&[(root.clone(), 0, false), (root.clone(), 0, false)]).len(), 1);
        fs::remove_dir_all(root).unwrap();
    }
}
