//! Local, bounded Scarp compiler discovery. Never executes a candidate while scanning.
//! A discovered executable is untrusted until the user approves the native probe.
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};

const MAX_ENTRIES: usize = 4096;
const MAX_ENTRIES_PER_ROOT: usize = 512;
// Scan at most this many Downloads entry names before applying the ordinary
// per-root processing budget. This stays bounded, even in crowded Downloads.
const MAX_DOWNLOADS_LOOKAHEAD: usize = 4096;
const MAX_ROOTS: usize = 128;
const MAX_CANDIDATES: usize = 24;
// Reserve discovery capacity for later locations (especially extracted ZIPs).
// A version-heavy installation tree must not hide every other candidate.
const MAX_CANDIDATES_PER_ROOT: usize = 4;

fn expected_file_name() -> &'static str {
    if cfg!(windows) {
        "scarp.exe"
    } else {
        "scarp"
    }
}

/// Parse a version *hint* from an extracted Scarp archive folder name.
/// This is solely a non-executing discovery ordering hint, not proof that an
/// executable is official or safe. The native probe still requires consent.
fn archive_version_hint(name: &str) -> Option<(u32, u32, u32, u8, u32)> {
    let lower = name.to_ascii_lowercase();
    let version = lower.strip_prefix("scarp-")?;
    let version = version.strip_prefix('v').unwrap_or(version);
    let (major, tail) = version.split_once('.')?;
    let (minor, tail) = tail.split_once('.')?;
    let patch_digits = tail.bytes().take_while(u8::is_ascii_digit).count();
    if patch_digits == 0 {
        return None;
    }
    let major: u32 = major.parse().ok()?;
    let minor: u32 = minor.parse().ok()?;
    let patch: u32 = tail[..patch_digits].parse().ok()?;
    let suffix = &tail[patch_digits..];
    let (stage, build) = if let Some(rest) = suffix.strip_prefix("-alpha.") {
        (0, rest)
    } else if let Some(rest) = suffix.strip_prefix("-beta.") {
        (1, rest)
    } else if let Some(rest) = suffix.strip_prefix("-rc.") {
        (2, rest)
    } else if suffix.is_empty() || suffix.starts_with("-x86_64") || suffix.starts_with("-aarch64") {
        return Some((major, minor, patch, 3, 0));
    } else {
        return None;
    };
    let digits = build.bytes().take_while(u8::is_ascii_digit).count();
    if digits == 0 || (!build[digits..].is_empty() && !build[digits..].starts_with('-')) {
        return None;
    }
    let build = build[..digits].parse().ok()?;
    Some((major, minor, patch, stage, build))
}

/// Scarp-named directories precede unrelated Downloads clutter; amongst
/// version-shaped directories prefer numerically newer compiler versions.
/// Invalid or unversioned Scarp names still remain eligible after versioned
/// directories. A normal sort never probes or executes candidates.
fn download_entry_order(entry: &fs::DirEntry) -> (u8, Option<(u32, u32, u32, u8, u32)>, String) {
    let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
    match entry.file_type() {
        Ok(kind) if kind.is_dir() && name.contains("scarp") => {
            (0, archive_version_hint(&name), name)
        }
        Ok(kind)
            if (kind.is_file() || kind.is_symlink())
                && name.eq_ignore_ascii_case(expected_file_name()) =>
        {
            (1, None, name)
        }
        _ => (2, None, name),
    }
}

fn record_binary(
    path: &Path,
    found: &mut Vec<String>,
    seen: &mut HashSet<PathBuf>,
    candidate_limit: usize,
) {
    if found.len() >= candidate_limit
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
    candidate_limit: usize,
    prioritize_scarp_archives: bool,
) {
    if *budget == 0 || found.len() >= candidate_limit {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    // A Scarp-named ZIP extraction may enumerate after hundreds of unrelated
    // downloads. Prefer those directories in a bounded 4096-name lookahead,
    // without increasing the ordinary 512-entry processing/recursion budget.
    let lookahead = if prioritize_scarp_archives {
        MAX_DOWNLOADS_LOOKAHEAD
    } else {
        *budget
    };
    let mut entries: Vec<_> = entries.flatten().take(lookahead).collect();
    // Standard Scarp installation roots can also contain several versions.
    // Apply the same numeric ordering within their ordinary 512-entry budget,
    // without widening PATH scans or increasing any I/O allowance.
    if prioritize_scarp_archives || descend_all {
        entries.sort_by(|left, right| {
            let left = download_entry_order(left);
            let right = download_entry_order(right);
            left.0
                .cmp(&right.0)
                .then_with(|| right.1.cmp(&left.1))
                .then_with(|| left.2.cmp(&right.2))
        });
    }
    for entry in entries {
        if *budget == 0 || found.len() >= candidate_limit {
            break;
        }
        *budget -= 1;
        let path = entry.path();
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_file() || kind.is_symlink() {
            record_binary(&path, found, seen, candidate_limit);
        } else if depth > 0 && kind.is_dir() {
            let scarp_named = entry
                .file_name()
                .to_string_lossy()
                .to_ascii_lowercase()
                .contains("scarp");
            if descend_all || scarp_named {
                scan_directory(
                    &path,
                    depth - 1,
                    true,
                    budget,
                    found,
                    seen,
                    candidate_limit,
                    false,
                );
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
        // Each root gets at most four of the global 24 candidate slots.
        // This preserves later install/Downloads/PATH locations even when an
        // earlier root contains dozens of versioned Scarp installations.
        let candidate_limit = (found.len() + MAX_CANDIDATES_PER_ROOT).min(MAX_CANDIDATES);
        scan_directory(
            root,
            *depth,
            *all,
            &mut root_budget,
            &mut found,
            &mut seen,
            candidate_limit,
            // Only the bounded Downloads archive scan gets the extra name
            // lookahead. No extra path roots or executable permissions.
            *depth == 3 && !*all && root.file_name().is_some_and(|name| name == "Downloads"),
        );
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
    // The Windows button points to the published SHA-256-pinned alpha.20 CLI targeted by CI.
    // Other platforms use the official releases page until platform-specific flows are tested.
    #[cfg(windows)]
    const RELEASES: &str = "https://github.com/scarp-lang/scarp/releases/download/v0.0.6-alpha.20/scarp-0.0.6-alpha.20-x86_64-pc-windows-msvc.zip";
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
        let found = scan_directories_with_budgets(&roots, MAX_ENTRIES, MAX_ENTRIES_PER_ROOT);
        assert_eq!(found.len(), 1);
        assert!(found[0].ends_with(expected_file_name()));

        // Reproduces the older ordering: Downloads after MAX_ROOTS PATH
        // locations was never visited, regardless of remaining entry budget.
        let downloaded = roots.remove(0);
        roots.push(downloaded);
        let starved = scan_directories_with_budgets(&roots, MAX_ENTRIES, MAX_ENTRIES_PER_ROOT);
        assert!(starved.is_empty());
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn crowded_downloads_prioritizes_extracted_scarp_archive() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = env::temp_dir().join(format!(
            "studio-crowded-downloads-{}-{unique}",
            std::process::id()
        ));
        let downloads = base.join("Downloads");
        fs::create_dir_all(&downloads).unwrap();
        // A plain 512-entry scan could miss the later versioned archive.
        // Discovery must not execute the fake candidate to find it.
        for index in 0..(MAX_ENTRIES_PER_ROOT + 100) {
            fs::write(
                downloads.join(format!("unrelated-{index:04}.txt")),
                b"noise",
            )
            .unwrap();
        }
        let extracted = downloads.join("Scarp-0.0.6-alpha.18").join("bin");
        fs::create_dir_all(&extracted).unwrap();
        let executable = extracted.join(expected_file_name());
        fs::write(&executable, b"discovery must not execute this").unwrap();
        let found = scan_directories(&[(downloads, 3, false)]);
        assert_eq!(
            found,
            vec![fs::canonicalize(executable)
                .unwrap()
                .to_string_lossy()
                .into_owned()]
        );
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn archive_version_hints_compare_numeric_alpha_versions() {
        assert!(
            archive_version_hint("Scarp-v0.0.6-alpha.19")
                > archive_version_hint("scarp-0.0.6-alpha.9")
        );
        assert!(
            archive_version_hint("scarp-0.0.7-alpha.1")
                > archive_version_hint("scarp-0.0.6-alpha.99")
        );
        assert!(archive_version_hint("scarp-0.0.6") > archive_version_hint("scarp-0.0.6-rc.999"));
        assert!(
            archive_version_hint("scarp-0.0.6-rc.1") > archive_version_hint("scarp-0.0.6-beta.50")
        );
        assert_eq!(archive_version_hint("scarp-not-a-version"), None);
        assert_eq!(archive_version_hint("not-scarp-0.0.6-alpha.18"), None);
        assert_eq!(archive_version_hint("scarp-0.0.6-alpha.invalid"), None);
        assert_eq!(archive_version_hint("scarp-0.0.6-alpha.18malformed"), None);
    }

    #[test]
    fn newer_extracted_versions_win_the_bounded_download_candidate_slots() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = env::temp_dir().join(format!(
            "studio-versioned-downloads-{}-{unique}",
            std::process::id()
        ));
        let downloads = base.join("Downloads");
        fs::create_dir_all(&downloads).unwrap();
        let versions = [
            "0.0.6-alpha.2",
            "0.0.6-alpha.19",
            "0.0.6-alpha.18",
            "0.0.5-alpha.100",
            "0.0.6-alpha.9",
            "0.0.6-alpha.17",
            "0.0.6-alpha.10",
            "0.0.6-alpha.3",
            "0.0.6-alpha.1",
        ];
        for version in versions {
            let extracted = downloads.join(format!("Scarp-{version}")).join("bin");
            fs::create_dir_all(&extracted).unwrap();
            fs::write(
                extracted.join(expected_file_name()),
                b"fake discovery candidate, never launch",
            )
            .unwrap();
        }
        let candidates = scan_directories(&[(downloads.clone(), 3, false)]);
        assert_eq!(candidates.len(), MAX_CANDIDATES_PER_ROOT);
        let expected = [
            "0.0.6-alpha.19",
            "0.0.6-alpha.18",
            "0.0.6-alpha.17",
            "0.0.6-alpha.10",
        ];
        for (actual, version) in candidates.iter().zip(expected) {
            let path = fs::canonicalize(
                downloads
                    .join(format!("Scarp-{version}"))
                    .join("bin")
                    .join(expected_file_name()),
            )
            .unwrap()
            .to_string_lossy()
            .into_owned();
            assert_eq!(actual, &path, "a stale archive hid a newer candidate");
        }
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn versioned_installs_select_newest_within_the_same_root_budget() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = env::temp_dir().join(format!(
            "studio-versioned-install-{}-{unique}",
            std::process::id()
        ));
        let installed = base.join("Scarp");
        let versions = [
            "0.0.6-alpha.9",
            "0.0.6-alpha.1",
            "0.0.6-alpha.19",
            "0.0.6-alpha.18",
            "0.0.6-alpha.10",
            "0.0.6-alpha.17",
            "0.0.5-alpha.99",
        ];
        for version in versions {
            let bin = installed.join(format!("Scarp-{version}")).join("bin");
            fs::create_dir_all(&bin).unwrap();
            fs::write(
                bin.join(expected_file_name()),
                b"fake compiler, native discovery only",
            )
            .unwrap();
        }
        let found = scan_directories(&[(installed.clone(), 2, true)]);
        assert_eq!(found.len(), MAX_CANDIDATES_PER_ROOT);
        for (candidate, version) in found.iter().zip([
            "0.0.6-alpha.19",
            "0.0.6-alpha.18",
            "0.0.6-alpha.17",
            "0.0.6-alpha.10",
        ]) {
            let expected = fs::canonicalize(
                installed
                    .join(format!("Scarp-{version}"))
                    .join("bin")
                    .join(expected_file_name()),
            )
            .unwrap()
            .to_string_lossy()
            .into_owned();
            assert_eq!(candidate, &expected);
        }
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn version_heavy_installation_root_cannot_hide_new_download() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = env::temp_dir().join(format!(
            "studio-candidate-fairness-{}-{unique}",
            std::process::id()
        ));
        let older = base.join("installed-versions");
        let downloaded = base.join("FreshScarp");
        fs::create_dir_all(&downloaded).unwrap();

        // Before per-root candidate limits, the first root filled all 24
        // global slots and a later newly extracted compiler disappeared.
        for index in 0..(MAX_CANDIDATES + 6) {
            let dir = older.join(format!("old-version-{index}"));
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join(expected_file_name()), b"older candidate").unwrap();
        }
        let latest = downloaded.join(expected_file_name());
        fs::write(&latest, b"new candidate").unwrap();

        let found = scan_directories(&[(older, 1, true), (downloaded, 0, false)]);
        let latest_path = fs::canonicalize(latest)
            .unwrap()
            .to_string_lossy()
            .into_owned();
        assert_eq!(found.len(), MAX_CANDIDATES_PER_ROOT + 1);
        assert!(
            found.contains(&latest_path),
            "newer install root was starved by older versioned candidates"
        );
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
