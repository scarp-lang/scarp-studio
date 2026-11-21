//! Local, bounded Scarp compiler discovery. Never executes a candidate while scanning.
//! A discovered executable is untrusted until the user approves the native probe.
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};

const MAX_ENTRIES: usize = 4096;
const MAX_ENTRIES_PER_ROOT: usize = 512;
const MAX_ROOTS: usize = 128;
const MAX_CANDIDATES: usize = 24;

fn expected_file_name() -> &'static str {
    if cfg!(windows) {
        "scarp.exe"
    } else {
        "scarp"
    }
}

fn record_binary(path: &Path, found: &mut Vec<String>, seen: &mut HashSet<PathBuf>) {
    if found.len() >= MAX_CANDIDATES
        || !path.file_name().is_some_and(|name| {
            name.to_string_lossy()
                .eq_ignore_ascii_case(expected_file_name())
        })
    {
        return;
    }
    let Ok(canonical) = fs::canonicalize(path) else {
        return;
    };
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
    if *budget == 0 || found.len() >= MAX_CANDIDATES {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if *budget == 0 || found.len() >= MAX_CANDIDATES {
            break;
        }
        *budget -= 1;
        let path = entry.path();
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_file() || kind.is_symlink() {
            record_binary(&path, found, seen);
        } else if depth > 0 && kind.is_dir() {
            let scarp_named = entry
                .file_name()
                .to_string_lossy()
                .to_ascii_lowercase()
                .contains("scarp");
            if descend_all || scarp_named {
                scan_directory(&path, depth - 1, true, budget, found, seen);
            }
        }
    }
}

fn scan_directories_with_budgets(
    roots: &[(PathBuf, u8, bool)],
    total_limit: usize,
    root_limit: usize,
) -> Vec<String> {
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    let mut remaining_total = total_limit;
    for (root, depth, all) in roots.iter().take(MAX_ROOTS) {
        if remaining_total == 0 || found.len() >= MAX_CANDIDATES {
            break;
        }
        // Never walk a remote UNC root just because it appears in PATH.
        if !root.is_absolute() {
            continue;
        }
        #[cfg(windows)]
        {
            let name = root.to_string_lossy();
            if name.starts_with(r"\\") || name.starts_with("//") {
                continue;
            }
        }
        let mut root_budget = root_limit.min(remaining_total);
        let initial = root_budget;
        scan_directory(root, *depth, *all, &mut root_budget, &mut found, &mut seen);
        remaining_total -= initial - root_budget;
    }
    found
}

fn scan_directories(roots: &[(PathBuf, u8, bool)]) -> Vec<String> {
    scan_directories_with_budgets(roots, MAX_ENTRIES, MAX_ENTRIES_PER_ROOT)
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
            roots.insert(
                2,
                (
                    local.join("Microsoft").join("WinGet").join("Links"),
                    0,
                    false,
                ),
            );
        }
        if let Some(program_files) = env::var_os("ProgramFiles") {
            roots.push((PathBuf::from(program_files).join("Scarp"), 2, true));
        }
    }
    // Downloads can contain thousands of unrelated files, so scan installed
    // locations first. But reserve a bounded slot for the official extracted
    // ZIP BEFORE PATH: a large PATH could otherwise exhaust MAX_ROOTS or the
    // global entry budget and silently hide a freshly downloaded compiler.
    if let Some(index) = roots.iter().position(|(p, depth, _)| {
        *depth == 3 && p.file_name().is_some_and(|name| name == "Downloads")
    }) {
        let downloads = roots.remove(index);
        roots.push(downloads);
    }
    // Search each PATH directory directly; never run an untrusted 'where' command.
    if let Some(path) = env::var_os("PATH") {
        roots.extend(
            env::split_paths(&path)
                .filter(|p| p.is_absolute())
                .map(|p| (p, 0, false)),
        );
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
    // The Windows button points directly to the SHA-256-pinned compiler used in CI.
    // Other platforms use the official releases page until platform-specific flows are tested.
    #[cfg(windows)]
    const RELEASES: &str = "https://github.com/scarp-lang/scarp/releases/download/v0.0.6-alpha.17/scarp-0.0.6-alpha.17-x86_64-pc-windows-msvc.zip";
    #[cfg(not(windows))]
    const RELEASES: &str = "https://github.com/scarp-lang/scarp/releases";
    #[cfg(windows)]
    {
        let root = env::var_os("SystemRoot")
            .or_else(|| env::var_os("WINDIR"))
            .ok_or("Windows system directory is unavailable")?;
        let explorer = PathBuf::from(root).join("explorer.exe");
        if !explorer.is_file() {
            return Err("Windows Explorer executable was not found".into());
        }
        std::process::Command::new(explorer)
            .arg(RELEASES)
            .spawn()
            .map_err(|e| format!("Could not open the official Scarp downloads: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .arg(RELEASES)
            .spawn()
            .map_err(|e| format!("Could not open the official Scarp downloads: {e}"))?;
        Ok(())
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(RELEASES)
            .spawn()
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
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = env::temp_dir().join(format!("studio-detect-{}-{unique}", std::process::id()));
        let versioned = root.join("scarp-0.0.6-alpha.17").join("bin");
        fs::create_dir_all(&versioned).unwrap();
        fs::write(
            versioned.join(expected_file_name()),
            b"not actually executable",
        )
        .unwrap();
        fs::write(versioned.join("unrelated.exe"), b"ignored").unwrap();

        let found = scan_directories(&[(root.clone(), 3, false)]);
        assert_eq!(found.len(), 1);
        assert!(found[0].ends_with(expected_file_name()));
        // Only discovery occurred: the fake executable never needed to be runnable.
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn does_not_descend_into_unrelated_download_folders() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root =
            env::temp_dir().join(format!("studio-unrelated-{}-{unique}", std::process::id()));
        let unrelated = root.join("random-folder");
        fs::create_dir_all(&unrelated).unwrap();
        fs::write(unrelated.join(expected_file_name()), b"untrusted").unwrap();
        assert!(scan_directories(&[(root.clone(), 3, false)]).is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_non_scarp_name_and_duplicate_paths() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root =
            env::temp_dir().join(format!("studio-duplicates-{}-{unique}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join(expected_file_name()), b"candidate").unwrap();
        fs::write(root.join("scarp-helper.exe"), b"ignored").unwrap();
        assert_eq!(
            scan_directories(&[(root.clone(), 0, false), (root.clone(), 0, false)]).len(),
            1
        );
        fs::remove_dir_all(root).unwrap();
    }

    /// CI installs only the published SHA-256-verified Scarp archive and sets
    /// SCARP_TEST_BIN explicitly. This test never launches the executable.
    #[test]
    #[ignore = "requires pinned official Scarp executable from Windows CI"]
    fn discovers_pinned_official_compiler_from_extracted_archive() {
        let path = PathBuf::from(
            env::var_os("SCARP_TEST_BIN").expect("CI must provide the official Scarp binary"),
        );
        let canonical = fs::canonicalize(&path).expect("official binary must exist");
        let parent = path.parent().expect("official compiler must have a parent");
        let found = scan_directories(&[(parent.to_path_buf(), 0, false)]);
        assert!(
            found
                .iter()
                .any(|candidate| Path::new(candidate) == canonical),
            "Native discovery did not find the pinned official compiler: {}",
            canonical.display()
        );
    }

    #[test]
    fn standard_downloads_root_precedes_expanded_path_roots() {
        let roots = standard_roots();
        // Standard Windows locations occupy at most four early slots. The
        // Downloads entry must not be appended after an unbounded user PATH,
        // because scan_directories caps inspected roots at MAX_ROOTS.
        if let Some(download_index) = roots.iter().position(|(path, depth, _)| {
            *depth == 3 && path.file_name().is_some_and(|name| name == "Downloads")
        }) {
            assert!(
                download_index < 8,
                "Downloads root moved behind user PATH; it can be starved at {}",
                download_index
            );
        }
    }

    #[test]
    fn extracted_download_is_found_despite_more_than_max_roots_path_dirs() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = env::temp_dir().join(format!(
            "studio-download-priority-{}-{unique}",
            std::process::id()
        ));
        let downloads = base.join("Downloads");
        let extracted = downloads.join("Scarp-0.0.6-alpha.17").join("bin");
        fs::create_dir_all(&extracted).unwrap();
        fs::write(extracted.join(expected_file_name()), b"candidate").unwrap();
        let mut roots = vec![(downloads, 3, false)];
        for index in 0..(MAX_ROOTS + 50) {
            roots.push((base.join(format!("path-{index}")), 0, false));
        }
        let found = scan_directories_with_budgets(
            &roots, MAX_ENTRIES, MAX_ENTRIES_PER_ROOT,
        );
        assert_eq!(found.len(), 1);
        assert!(found[0].ends_with(expected_file_name()));

        // Reproduces the older ordering: Downloads after MAX_ROOTS PATH
        // locations was never visited, regardless of remaining entry budget.
        let downloaded = roots.remove(0);
        roots.push(downloaded);
        let starved = scan_directories_with_budgets(
            &roots, MAX_ENTRIES, MAX_ENTRIES_PER_ROOT,
        );
        assert!(starved.is_empty());
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn one_crowded_root_does_not_starve_other_compiler_locations() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = env::temp_dir().join(format!(
            "studio-fair-discovery-{}-{unique}",
            std::process::id()
        ));
        let crowded = base.join("crowded");
        let installed = base.join("Scarp");
        fs::create_dir_all(&crowded).unwrap();
        fs::create_dir_all(&installed).unwrap();
        for i in 0..80 {
            fs::write(crowded.join(format!("other-{i}.txt")), b"not a compiler").unwrap();
        }
        fs::write(installed.join(expected_file_name()), b"candidate").unwrap();
        let candidates =
            scan_directories_with_budgets(&[(crowded, 0, false), (installed, 0, false)], 32, 16);
        assert_eq!(candidates.len(), 1);
        assert!(candidates[0].ends_with(expected_file_name()));
        fs::remove_dir_all(base).unwrap();
    }
}
