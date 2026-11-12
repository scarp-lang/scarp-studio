//! Bounded, opt-in execution of the separately installed official Scarp binary.
//! This service never invokes a shell and never starts on file open or save.
use std::{
    ffi::OsString,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, ExitStatus, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const EXEC_TIMEOUT: Duration = Duration::from_secs(20);
const PROBE_OUTPUT_LIMIT: usize = 32 * 1024;
const EXEC_OUTPUT_LIMIT: usize = 256 * 1024;
// Bound native source snapshots independently from compiler output budgets.
const MAX_SOURCE_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Clone)]
struct ActiveJob {
    id: u64,
    child: Arc<Mutex<Child>>,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default, Clone)]
pub struct CompilerRuntime {
    active: Arc<Mutex<Option<ActiveJob>>>,
    sequence: Arc<AtomicU64>,
}

struct ProcessResult {
    status: ExitStatus,
    stdout: String,
    stderr: String,
    truncated: bool,
    cancelled: bool,
}

fn read_bounded<R: Read>(mut source: R, limit: usize) -> Result<(String, bool), String> {
    let mut captured = Vec::new();
    let mut buffer = [0u8; 8192];
    let mut truncated = false;
    loop {
        let size = source.read(&mut buffer).map_err(|e| e.to_string())?;
        if size == 0 {
            break;
        }
        let remaining = limit.saturating_sub(captured.len());
        captured.extend_from_slice(&buffer[..size.min(remaining)]);
        if size > remaining {
            truncated = true;
        }
        // Keep draining the pipe even after reaching the limit, so the child
        // cannot deadlock on a full stdout/stderr buffer.
    }
    Ok((String::from_utf8_lossy(&captured).into_owned(), truncated))
}

fn process(
    binary: &Path,
    args: &[OsString],
    cwd: Option<&Path>,
    timeout: Duration,
    output_limit: usize,
    runtime: Option<&CompilerRuntime>,
) -> Result<ProcessResult, String> {
    let mut command = Command::new(binary);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(directory) = cwd {
        command.current_dir(directory);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    // Reserve the execution slot before spawning so two Run clicks can never
    // launch two compiler processes concurrently.
    let (child, job_id, cancelled) = if let Some(runtime) = runtime {
        let mut slot = runtime.active.lock().map_err(|e| e.to_string())?;
        if slot.is_some() {
            return Err(
                "Scarp is already running. Stop it before starting another command.".into(),
            );
        }
        let child = Arc::new(Mutex::new(
            command
                .spawn()
                .map_err(|e| format!("Could not start Scarp: {e}"))?,
        ));
        let id = runtime.sequence.fetch_add(1, Ordering::Relaxed);
        let cancelled = Arc::new(AtomicBool::new(false));
        *slot = Some(ActiveJob {
            id,
            child: child.clone(),
            cancelled: cancelled.clone(),
        });
        (child, Some(id), cancelled)
    } else {
        let child = Arc::new(Mutex::new(
            command
                .spawn()
                .map_err(|e| format!("Could not start Scarp: {e}"))?,
        ));
        (child, None, Arc::new(AtomicBool::new(false)))
    };

    let execution = (|| {
        let (stdout, stderr) = {
            let mut child = child.lock().map_err(|e| e.to_string())?;
            (
                child
                    .stdout
                    .take()
                    .ok_or("Compiler stdout was unavailable")?,
                child
                    .stderr
                    .take()
                    .ok_or("Compiler stderr was unavailable")?,
            )
        };
        let output_thread = thread::spawn(move || read_bounded(stdout, output_limit));
        let error_thread = thread::spawn(move || read_bounded(stderr, output_limit));
        let started = Instant::now();
        let mut timed_out = false;
        let status = loop {
            let current = child
                .lock()
                .map_err(|e| e.to_string())?
                .try_wait()
                .map_err(|e| e.to_string())?;
            if let Some(status) = current {
                break status;
            }
            if started.elapsed() >= timeout {
                timed_out = true;
                let _ = child.lock().map_err(|e| e.to_string())?.kill();
                break child
                    .lock()
                    .map_err(|e| e.to_string())?
                    .wait()
                    .map_err(|e| e.to_string())?;
            }
            thread::sleep(Duration::from_millis(25));
        };
        let (stdout, stdout_truncated) = output_thread
            .join()
            .map_err(|_| "Scarp stdout reader thread failed".to_string())??;
        let (stderr, stderr_truncated) = error_thread
            .join()
            .map_err(|_| "Scarp stderr reader thread failed".to_string())??;
        if timed_out {
            return Err(format!(
                "Scarp exceeded the {} second time limit and was stopped.",
                timeout.as_secs()
            ));
        }
        Ok(ProcessResult {
            status,
            stdout,
            stderr,
            truncated: stdout_truncated || stderr_truncated,
            cancelled: cancelled.load(Ordering::SeqCst),
        })
    })();

    if let (Some(runtime), Some(id)) = (runtime, job_id) {
        if let Ok(mut slot) = runtime.active.lock() {
            if slot.as_ref().is_some_and(|job| job.id == id) {
                *slot = None;
            }
        }
    }
    execution
}

fn compiler_binary(path: &str) -> Result<PathBuf, String> {
    let raw = Path::new(path);
    if !raw.is_absolute() {
        return Err("Select the absolute path to the official Scarp executable.".into());
    }
    let resolved = fs::canonicalize(raw).map_err(|e| format!("Scarp executable not found: {e}"))?;
    if !resolved.is_file() {
        return Err("The selected Scarp compiler is not a file.".into());
    }
    let file_name = resolved.file_name().and_then(|s| s.to_str()).unwrap_or("");
    #[cfg(windows)]
    let expected = "scarp.exe";
    #[cfg(not(windows))]
    let expected = "scarp";
    if !file_name.eq_ignore_ascii_case(expected) {
        return Err(format!(
            "Select the official {expected} executable (not another program)."
        ));
    }
    Ok(resolved)
}

fn source_file(path: &str) -> Result<PathBuf, String> {
    let raw = Path::new(path);
    if !raw.is_absolute() || !raw.to_string_lossy().to_ascii_lowercase().ends_with(".srp") {
        return Err("Save a Scarp .srp file before running or verifying.".into());
    }
    let canonical = fs::canonicalize(raw).map_err(|e| format!("Scarp source not found: {e}"))?;
    if !canonical.is_file()
        || !canonical
            .to_string_lossy()
            .to_ascii_lowercase()
            .ends_with(".srp")
    {
        return Err("The selected source must be an existing .srp file.".into());
    }
    Ok(canonical)
}

fn parse_version(output: &str) -> Option<String> {
    let version = output
        .trim()
        .strip_prefix("scarp ")?
        .split_whitespace()
        .next()?;
    if version.contains('.')
        && version
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
    {
        Some(version.to_owned())
    } else {
        None
    }
}

fn compiler_supports(binary: &Path, verb: &str) -> Result<bool, String> {
    let args = [OsString::from("guide"), OsString::from(verb)];
    let result = process(binary, &args, None, PROBE_TIMEOUT, PROBE_OUTPUT_LIMIT, None)?;
    Ok(result.status.success()
        && !result.truncated
        && result.stdout.starts_with(&format!("Usage: scarp {verb}")))
}

fn probe(binary: &str) -> Result<(PathBuf, String), String> {
    let binary = compiler_binary(binary)?;
    let result = process(
        &binary,
        &[OsString::from("--version")],
        None,
        PROBE_TIMEOUT,
        PROBE_OUTPUT_LIMIT,
        None,
    )?;
    if !result.status.success() || result.truncated {
        return Err("Scarp --version failed or returned invalid output.".into());
    }
    let version = parse_version(&result.stdout)
        .ok_or("The executable did not report a valid Scarp version.")?;
    if !compiler_supports(&binary, "exec")? || !compiler_supports(&binary, "verify")? {
        return Err("This Scarp build does not advertise both exec and static verify.".into());
    }
    Ok((binary, version))
}

fn ensure_matching_disk_snapshot(source: &Path, expected_content: &str) -> Result<(), String> {
    if expected_content.len() as u64 > MAX_SOURCE_BYTES {
        return Err("Scarp source exceeds Studio's 4 MiB execution safety limit.".into());
    }
    // Avoid unbounded reads if the on-disk file grew after it was opened.
    let file =
        fs::File::open(source).map_err(|e| format!("Could not check saved Scarp source: {e}"))?;
    let mut disk_content = Vec::new();
    file.take(MAX_SOURCE_BYTES + 1)
        .read_to_end(&mut disk_content)
        .map_err(|e| format!("Could not check saved Scarp source: {e}"))?;
    if disk_content.len() as u64 > MAX_SOURCE_BYTES {
        return Err("Scarp source exceeds Studio's 4 MiB execution safety limit.".into());
    }
    if disk_content != expected_content.as_bytes() {
        return Err("Scarp file changed on disk. Reload or Save As before Run/Verify.".into());
    }
    Ok(())
}

/// Re-check the source after CLI capability probes, immediately before launch.
/// A file may change in a separate editor while those subprocesses run.
fn with_verified_source_snapshot<T>(
    source: &Path,
    expected_content: &str,
    probe: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    ensure_matching_disk_snapshot(source, expected_content)?;
    let verified = probe()?;
    ensure_matching_disk_snapshot(source, expected_content)?;
    Ok(verified)
}

fn command_args(mode: &str, source: &Path) -> Result<Vec<OsString>, String> {
    let mut args = match mode {
        "exec" => vec![
            OsString::from("exec"),
            OsString::from("--max-steps"),
            OsString::from("200000"),
            OsString::from("--max-prints"),
            OsString::from("1000"),
        ],
        "verify" => vec![OsString::from("verify")],
        _ => return Err("Only the official Scarp exec and verify commands are allowed.".into()),
    };
    args.push(OsString::from("--diagnostic-format=json"));
    args.push(OsString::from("--"));
    args.push(source.as_os_str().to_owned());
    Ok(args)
}

/// Probe only the executable selected by the user. No execution or PATH search.
#[tauri::command]
pub async fn scarp_probe(binary: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (_, version) = probe(&binary)?;
        Ok(format!(
            "Scarp {version} — exec and static verify available"
        ))
    })
    .await
    .map_err(|e| format!("Scarp probe worker failed: {e}"))?
}

/// Run/verify a previously saved source file only after an explicit button click.
#[tauri::command]
pub async fn scarp_execute(
    binary: String,
    source: String,
    mode: String,
    expected_content: String,
    state: tauri::State<'_, CompilerRuntime>,
) -> Result<String, String> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let source = source_file(&source)?;
        // Reject unsupported actions without launching even a capability probe.
        let args = command_args(&mode, &source)?;
        let (binary, version) =
            with_verified_source_snapshot(&source, &expected_content, || probe(&binary))?;
        let result = process(
            &binary,
            &args,
            source.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )?;
        let exit = result
            .status
            .code()
            .map_or("terminated by signal".to_owned(), |code| code.to_string());
        let outcome = if result.cancelled {
            "cancelled"
        } else if result.status.success() {
            "completed"
        } else {
            "failed"
        };
        let cap_notice = if result.truncated {
            "\n[Output truncated to the configured safety limit.]"
        } else {
            ""
        };
        Ok(format!(
            "Scarp {version} — {mode} {}\nStatus: {outcome} (exit {exit})\n\n{}{}{}{}",
            source.display(),
            result.stdout,
            if result.stderr.is_empty() {
                ""
            } else {
                "\nCompiler diagnostics:\n"
            },
            result.stderr,
            cap_notice
        ))
    })
    .await
    .map_err(|e| format!("Scarp execution worker failed: {e}"))?
}

fn cancel_active_job(runtime: &CompilerRuntime) -> Result<bool, String> {
    let slot = runtime.active.lock().map_err(|e| e.to_string())?;
    let Some(job) = slot.as_ref() else {
        return Ok(false);
    };
    job.cancelled.store(true, Ordering::SeqCst);
    let mut child = job.child.lock().map_err(|e| e.to_string())?;
    let _ = child.kill(); // Already exited is harmless; completion resolves separately.
    Ok(true)
}

/// Cancel only the Scarp process launched by Studio; no system-wide kills.
#[tauri::command]
pub fn scarp_cancel(state: tauri::State<'_, CompilerRuntime>) -> Result<bool, String> {
    cancel_active_job(state.inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_real_scarp_version_format() {
        assert_eq!(
            parse_version("scarp 0.0.6-alpha.8\n"),
            Some("0.0.6-alpha.8".into())
        );
        assert_eq!(parse_version("other 0.0.6-alpha.8"), None);
        assert_eq!(parse_version("scarp ../../evil"), None);
    }

    #[test]
    fn only_official_actions_are_allowed() {
        let source = Path::new("C:/Scarp project/main.srp");
        let run = command_args("exec", source).unwrap();
        assert_eq!(run[0], "exec");
        assert_eq!(run[1], "--max-steps");
        assert_eq!(run.last().unwrap(), source.as_os_str());
        let verify = command_args("verify", source).unwrap();
        assert_eq!(verify[0], "verify");
        assert!(!verify.iter().any(|value| value == "--max-steps"));
        assert!(command_args("run", source).is_err());
        assert!(command_args("launch", source).is_err());
    }

    #[test]
    fn saved_content_must_match_disk_before_launch() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("scarp-studio-{}-{unique}.srp", std::process::id()));
        fs::write(&path, "print(\"original\");").unwrap();
        assert!(ensure_matching_disk_snapshot(&path, "print(\"original\");").is_ok());
        assert!(ensure_matching_disk_snapshot(&path, "print(\"stale\");").is_err());
        fs::remove_file(&path).unwrap();
        assert!(ensure_matching_disk_snapshot(&path, "print(\"original\");").is_err());
    }

    #[test]
    fn source_changes_during_compiler_probe_are_rejected() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "studio-snapshot-race-{}-{unique}.srp",
            std::process::id()
        ));
        fs::write(&path, "print(1);").unwrap();
        let result = with_verified_source_snapshot(&path, "print(1);", || {
            fs::write(&path, "print(2);").unwrap();
            Ok(())
        });
        assert!(result.unwrap_err().contains("changed on disk"));
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn source_snapshot_checks_enforce_a_bounded_native_read() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "studio-source-limit-{}-{unique}.srp",
            std::process::id()
        ));
        fs::write(&path, b"short").unwrap();
        let oversized = "x".repeat(MAX_SOURCE_BYTES as usize + 1);
        assert!(ensure_matching_disk_snapshot(&path, &oversized)
            .unwrap_err()
            .contains("4 MiB"));
        fs::write(&path, oversized.as_bytes()).unwrap();
        assert!(ensure_matching_disk_snapshot(&path, "short")
            .unwrap_err()
            .contains("4 MiB"));
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn source_validation_rejects_non_scarp_files_and_relative_paths() {
        assert!(source_file("test.rs").is_err());
        assert!(source_file("test.srp").is_err());
        assert!(source_file("C:/not-a-file.rs").is_err());
    }

    #[test]
    fn binary_validation_rejects_relative_paths() {
        assert!(compiler_binary("scarp").is_err());
        assert!(compiler_binary("scarp.exe").is_err());
    }

    /// Uses the actual pinned release binary only when CI explicitly enables it.
    #[test]
    #[ignore = "requires the SHA-256-pinned official Scarp compiler"]
    fn official_compiler_runs_through_native_service() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let selected = std::env::var("SCARP_TEST_BIN")
            .expect("CI must explicitly provide the verified official Scarp executable");
        let (binary, version) = probe(&selected).expect("official compiler probe");
        assert_eq!(version, "0.0.6-alpha.8");

        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let source = std::env::temp_dir().join(format!(
            "scarp-studio-native-{}-{unique}.srp",
            std::process::id()
        ));
        let content = "assert(2 + 2 == 4, \"addition\");\nprint(\"Studio backend integration\");";
        fs::write(&source, content).unwrap();
        let validated = source_file(source.to_str().unwrap()).unwrap();
        ensure_matching_disk_snapshot(&validated, content).unwrap();

        let runtime = CompilerRuntime::default();
        let verify = process(
            &binary,
            &command_args("verify", &validated).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )
        .expect("native verify process");
        assert!(verify.status.success(), "{}", verify.stderr);
        assert!(!verify.truncated);
        assert!(!verify.cancelled);

        let execute = process(
            &binary,
            &command_args("exec", &validated).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )
        .expect("native exec process");
        assert!(execute.status.success(), "{}", execute.stderr);
        assert!(execute.stdout.contains("Studio backend integration"));
        assert!(!execute.truncated);
        assert!(!execute.cancelled);

        // Verify checks assertion types but does not evaluate a false predicate.
        // The alpha.8 interpreter must fail with the native E0065 diagnostic;
        // buffered program stdout must not leak after a runtime failure.
        let failing_assertion = "print(\"do-not-emit\");\nassert(false, \"intentional failure\");";
        fs::write(&source, failing_assertion).unwrap();
        ensure_matching_disk_snapshot(&validated, failing_assertion).unwrap();
        let static_check = process(
            &binary,
            &command_args("verify", &validated).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )
        .expect("native verify of false assertion");
        assert!(static_check.status.success(), "{}", static_check.stderr);
        assert!(!static_check.truncated);

        let runtime_failure = process(
            &binary,
            &command_args("exec", &validated).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )
        .expect("native assertion failure");
        assert!(!runtime_failure.status.success(), "assert(false) must fail execution");
        assert!(!runtime_failure.truncated);
        assert!(!runtime_failure.cancelled);
        assert!(runtime_failure.stderr.contains("E0065"), "{}", runtime_failure.stderr);
        assert!(runtime_failure.stdout.is_empty(), "failed execution replayed user stdout");

        fs::remove_file(&source).unwrap();
        assert!(runtime.active.lock().unwrap().is_none());
    }

    // This helper runs only when explicitly selected as a child test process.
    // It is never launched in the normal unit-test suite.
    #[test]
    #[ignore = "invoked by native process cancellation and timeout tests"]
    fn slow_child_process_helper() {
        std::thread::sleep(Duration::from_secs(15));
    }

    fn slow_test_process_args() -> Vec<OsString> {
        vec![
            OsString::from("--exact"),
            OsString::from("compiler::tests::slow_child_process_helper"),
            OsString::from("--ignored"),
            OsString::from("--nocapture"),
        ]
    }

    #[test]
    fn native_stop_terminates_an_active_child_and_cleans_up() {
        let binary = std::env::current_exe().unwrap();
        let runtime = CompilerRuntime::default();
        let worker_runtime = runtime.clone();
        let handle = thread::spawn(move || {
            process(
                &binary,
                &slow_test_process_args(),
                None,
                Duration::from_secs(12),
                4096,
                Some(&worker_runtime),
            )
        });

        let started = Instant::now();
        loop {
            if runtime.active.lock().unwrap().is_some() {
                break;
            }
            assert!(
                started.elapsed() < Duration::from_secs(8),
                "Native test helper failed to enter the active job slot"
            );
            thread::sleep(Duration::from_millis(10));
        }
        assert!(cancel_active_job(&runtime).unwrap());
        let result = handle.join().unwrap().expect("Cancelled process result");
        assert!(result.cancelled, "Stop must be observable by the worker");
        assert!(!result.status.success(), "Stop must terminate the child");
        assert!(runtime.active.lock().unwrap().is_none());
        assert!(!cancel_active_job(&runtime).unwrap());
    }

    #[test]
    fn native_process_timeout_stops_long_running_children() {
        let binary = std::env::current_exe().unwrap();
        let failure = process(
            &binary,
            &slow_test_process_args(),
            None,
            Duration::from_millis(100),
            4096,
            None,
        )
        .err()
        .expect("Long running process should time out");
        assert!(failure.contains("time limit"), "{failure}");
    }

    #[test]
    fn output_capture_is_bounded_even_for_large_streams() {
        let source = vec![b'x'; 300_000];
        let (captured, truncated) = read_bounded(source.as_slice(), 4096).unwrap();
        assert_eq!(captured.len(), 4096);
        assert!(truncated);
    }
}
