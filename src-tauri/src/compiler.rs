//! Bounded, opt-in execution of the separately installed official Scarp binary.
//! This service never invokes a shell and never starts on file open or save.
use std::{
    ffi::OsString,
    fs,
    io::{Read, Write},
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
// Smaller opt-in Studio stdin budgets; Scarp also enforces its own CLI limits.
const MAX_STDIN_BYTES: usize = 16 * 1024;
const MAX_STDIN_LINE_BYTES: usize = 4096;
const MAX_STDIN_LINES: usize = 256;
// Match the bounded interpreter budgets for both single-source and project Run.
const STUDIO_MAX_EXEC_STEPS: &str = "200000";
const STUDIO_MAX_EXEC_PRINTS: &str = "1000";

fn validate_stdin(input: &str) -> Result<(), String> {
    if input.len() > MAX_STDIN_BYTES {
        return Err("Program input exceeds Studio's 16 KiB UTF-8 limit.".into());
    }
    if input.is_empty() {
        return Ok(());
    }
    let mut lines = 0;
    for line in input.as_bytes().split_inclusive(|byte| *byte == b'\n') {
        lines += 1;
        if lines > MAX_STDIN_LINES {
            return Err("Program input exceeds Studio's 256-line limit.".into());
        }
        if line.len() > MAX_STDIN_LINE_BYTES {
            return Err("Program input line exceeds 4096 UTF-8 bytes including CR/LF.".into());
        }
    }
    Ok(())
}

#[derive(Clone)]
struct ActiveJob {
    id: u64,
    // None during CLI probing, Some once source execution has launched.
    child: Option<Arc<Mutex<Child>>>,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default, Clone)]
pub struct CompilerRuntime {
    active: Arc<Mutex<Option<ActiveJob>>>,
    sequence: Arc<AtomicU64>,
}

// Exit code, cancellation, native output cap and source freshness.
pub type NativeOutcome = (Option<i32>, bool, bool, bool);

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

/// Reserve a command slot before CLI probing so Stop can cancel a pending Run.
fn reserve_job(runtime: &CompilerRuntime) -> Result<ActiveJob, String> {
    let mut slot = runtime.active.lock().map_err(|e| e.to_string())?;
    if slot.is_some() {
        return Err("Scarp is already running or being checked. Stop it first.".into());
    }
    let job = ActiveJob {
        id: runtime.sequence.fetch_add(1, Ordering::Relaxed),
        child: None,
        cancelled: Arc::new(AtomicBool::new(false)),
    };
    *slot = Some(job.clone());
    Ok(job)
}

/// Release only the caller's slot, never a newer operation's slot.
fn release_job(runtime: &CompilerRuntime, id: u64) {
    if let Ok(mut slot) = runtime.active.lock() {
        if slot.as_ref().is_some_and(|job| job.id == id) {
            *slot = None;
        }
    }
}

fn process_with_input(
    binary: &Path,
    args: &[OsString],
    cwd: Option<&Path>,
    timeout: Duration,
    output_limit: usize,
    runtime: Option<&CompilerRuntime>,
    stdin_text: Option<&str>,
) -> Result<ProcessResult, String> {
    process_with_input_reserved(
        binary,
        args,
        cwd,
        timeout,
        output_limit,
        runtime,
        stdin_text,
        None,
    )
}

fn process_with_input_reserved(
    binary: &Path,
    args: &[OsString],
    cwd: Option<&Path>,
    timeout: Duration,
    output_limit: usize,
    runtime: Option<&CompilerRuntime>,
    stdin_text: Option<&str>,
    reservation: Option<&ActiveJob>,
) -> Result<ProcessResult, String> {
    let mut command = Command::new(binary);
    command
        .args(args)
        .stdin(if stdin_text.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
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
        if let Some(pending) = reservation {
            // Stop and the child registration share this lock. Source execution
            // cannot start after the pending operation was cancelled.
            if !slot.as_ref().is_some_and(|job| job.id == pending.id) {
                return Err("The pending Scarp operation is no longer active.".into());
            }
            if pending.cancelled.load(Ordering::SeqCst) {
                return Err("Scarp operation was cancelled before launch.".into());
            }
        } else if slot.is_some() {
            return Err(
                "Scarp is already running. Stop it before starting another command.".into(),
            );
        }
        let child = Arc::new(Mutex::new(
            command
                .spawn()
                .map_err(|e| format!("Could not start Scarp: {e}"))?,
        ));
        let id = reservation
            .map(|pending| pending.id)
            .unwrap_or_else(|| runtime.sequence.fetch_add(1, Ordering::Relaxed));
        let cancelled = reservation
            .map(|pending| pending.cancelled.clone())
            .unwrap_or_else(|| Arc::new(AtomicBool::new(false)));
        *slot = Some(ActiveJob {
            id,
            child: Some(child.clone()),
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
        let (stdout, stderr, stdin_pipe) = {
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
                child.stdin.take(),
            )
        };
        // A small, owned snapshot is written off-thread so a child that never
        // reads stdin cannot block Stop or the process timeout loop.
        // BrokenPipe is expected if source exits without consuming every byte.
        let input_thread =
            stdin_pipe
                .zip(stdin_text.map(str::to_owned))
                .map(|(mut pipe, payload)| {
                    thread::spawn(move || {
                        let _ = pipe.write_all(payload.as_bytes());
                    })
                });
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
        if let Some(writer) = input_thread {
            writer
                .join()
                .map_err(|_| "Scarp input writer thread failed".to_owned())?;
        }
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
                if reservation.is_some() {
                    // A reserved Run/Verify/Project/selection may spawn up to
                    // three sequential capability subprocesses before doing
                    // real work. Retain its reservation between processes,
                    // but drop the completed child handle. Stop can now
                    // cancel the NEXT probe or launch without another job
                    // stealing this slot in between.
                    if let Some(job) = slot.as_mut() {
                        job.child = None;
                    }
                } else {
                    *slot = None;
                }
            }
        }
    }
    execution
}

// Keep legacy probes and all existing callers on null stdin.
fn process(
    binary: &Path,
    args: &[OsString],
    cwd: Option<&Path>,
    timeout: Duration,
    output_limit: usize,
    runtime: Option<&CompilerRuntime>,
) -> Result<ProcessResult, String> {
    process_with_input(binary, args, cwd, timeout, output_limit, runtime, None)
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

// Prompt mode is deliberately limited to versions with audited flag semantics.
// Published v0.0.7 releases retain the legacy run prompt flag and the
// structured project-test JSON v2 contract. Future series require review.
fn supports_audited_alpha7(version: &str) -> bool {
    matches!(version, "0.0.7-alpha.1" | "0.0.7-alpha.2" | "0.0.7-alpha.3")
}

fn supports_prompt_input(version: &str) -> bool {
    version
        .strip_prefix("0.0.6-alpha.")
        .and_then(|suffix| suffix.parse::<u16>().ok())
        .is_some_and(|alpha| alpha >= 10)
        || supports_audited_alpha7(version)
}

/// Project actions never write source and only accept a selected manifest root.
/// The CLI validates manifest fields, paths and dependency traversal itself.
/// Match the Explorer's file-entry policy: only a regular, non-symlink manifest
/// can activate project actions. Do not follow a manifest symlink outside the
/// selected workspace after a directory scan.
fn has_regular_project_manifest(root: &Path) -> bool {
    ["scarp.project", "Scarp.project"].iter().any(|name| {
        fs::symlink_metadata(root.join(name)).is_ok_and(|metadata| metadata.file_type().is_file())
    })
}

fn selected_project_root(folder: &str) -> Result<PathBuf, String> {
    let root = Path::new(folder);
    if !root.is_absolute() {
        return Err("Choose an absolute project folder in Studio first.".into());
    }
    let root = fs::canonicalize(root).map_err(|e| format!("Scarp folder not found: {e}"))?;
    if !root.is_dir() {
        return Err("The selected Scarp project path is not a directory.".into());
    }
    if !has_regular_project_manifest(&root) {
        return Err("No scarp.project manifest found. Choose the Scarp project root.".into());
    }
    Ok(root)
}

fn project_action_args(action: &str, folder: &Path) -> Result<Vec<OsString>, String> {
    let verbs: &[&str] = match action {
        "info" => &["project", "info", "--json"],
        "verify" => &["verify", "--diagnostic-format=json"],
        "list-tests" => &["test", "--list"],
        "run-tests" => &["test", "--require-tests"],
        "inspect-symbols" => &["inspect", "symbols", "--json", "--diagnostic-format=json"],
        "inspect-references" => &[
            "inspect",
            "references",
            "--json",
            "--diagnostic-format=json",
        ],
        _ => return Err(
            "Unsupported Scarp project action. Only the fixed Studio project commands are allowed."
                .into(),
        ),
    };
    let mut args: Vec<OsString> = verbs.iter().map(|verb| OsString::from(*verb)).collect();
    args.push(OsString::from("--"));
    args.push(folder.as_os_str().to_owned());
    Ok(args)
}

/// Project Run executes only the selected manifest entrypoint, not any
/// arbitrary source path. It shares single-file Run's work, print and input
/// quotas so switching to a project cannot silently grant larger budgets.
fn project_run_args(folder: &Path, interactive: bool) -> Vec<OsString> {
    let mut args: Vec<OsString> = [
        "run",
        "--max-steps",
        STUDIO_MAX_EXEC_STEPS,
        "--max-prints",
        STUDIO_MAX_EXEC_PRINTS,
        "--max-input-line-bytes",
        "4096",
        "--max-input-bytes",
        "16384",
        "--max-input-reads",
        "256",
        "--diagnostic-format=json",
    ]
    .into_iter()
    .map(OsString::from)
    .collect();
    if interactive {
        args.push(OsString::from("--interactive"));
    }
    args.push(OsString::from("--"));
    args.push(folder.as_os_str().to_owned());
    args
}

// The official test JSON v2 envelope was published in alpha.9. Older
// compilers keep the human-readable report without any schema assumption.
fn supports_structured_project_tests(version: &str) -> bool {
    version
        .strip_prefix("0.0.6-alpha.")
        .and_then(|suffix| suffix.parse::<u16>().ok())
        .is_some_and(|alpha| alpha >= 9)
        || supports_audited_alpha7(version)
}

/// Only an ordinary CLI exit can support a trusted structured test report.
/// Test suites with failures intentionally exit 1, whereas test discovery
/// must succeed with 0. A crash, signal, timeout, cancellation or CLI-level
/// failure must never acquire a structured PASS/FAIL navigation surface.
fn allowed_project_test_exit_code(action: &str, code: Option<i32>) -> bool {
    match action {
        "list-tests" => code == Some(0),
        "run-tests" => matches!(code, Some(0 | 1)),
        _ => false,
    }
}

fn project_test_args(action: &str, folder: &Path, version: &str) -> Result<Vec<OsString>, String> {
    let mut args = project_action_args(action, folder)?;
    // The static navigation schema was reviewed against the published alpha.3
    // implementation. Do not guess compatibility from arbitrary version text.
    if matches!(action, "inspect-symbols" | "inspect-references") && version != "0.0.7-alpha.3" {
        return Err("Static project navigation currently requires Scarp 0.0.7-alpha.3.".into());
    }
    if matches!(action, "list-tests" | "run-tests") && supports_structured_project_tests(version) {
        args.insert(1, OsString::from("--json=v2"));
    }
    Ok(args)
}

fn apply_project_test_filter(
    args: &mut Vec<OsString>,
    action: &str,
    version: &str,
    filter: Option<&str>,
) -> Result<(), String> {
    let Some(filter) = filter else {
        return Ok(());
    };
    if !matches!(action, "list-tests" | "run-tests") || version != "0.0.7-alpha.3" {
        return Err("Filtered project tests require Scarp 0.0.7-alpha.3.".into());
    }
    if filter.is_empty()
        || filter.len() > 128
        || filter.starts_with('-')
        || filter.chars().any(|ch| {
            ch.is_control()
                || matches!(
                    ch,
                    '/' | '\\' | ':' | '\u{061c}' | '\u{200e}' | '\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}'
                )
        })
    {
        return Err("Use a literal test filename substring of 1–128 UTF-8 bytes.".into());
    }
    // The fixed path separator remains last. No shell or argument splitting.
    let at = args.len() - 2;
    args.insert(at, OsString::from("--filter"));
    args.insert(at + 1, OsString::from(filter));
    Ok(())
}

/// A project command is a separate, explicit user action. No file-open or
/// background hook triggers it. Stop cancels the same native process slot.
#[tauri::command]
pub async fn scarp_project_action(
    binary: String,
    folder: String,
    action: String,
    stdin_text: Option<String>,
    interactive: Option<bool>,
    test_filter: Option<String>,
    state: tauri::State<'_, CompilerRuntime>,
) -> Result<
    (
        String,
        Option<String>,
        Option<i32>,
        NativeOutcome,
        Option<String>,
        Option<String>,
    ),
    String,
> {
    let runtime = state.inner().clone();
    let reserved = reserve_job(&runtime)?;
    tauri::async_runtime::spawn_blocking(move || {
        let execution = (|| {
            if reserved.cancelled.load(Ordering::SeqCst) {
                return Err("Scarp project operation was cancelled before launch.".into());
            }
            let input = stdin_text.unwrap_or_default();
            validate_stdin(&input)?;
            let wants_prompt = interactive.unwrap_or(false);
            if action != "run" && (!input.is_empty() || wants_prompt) {
                return Err("Program input and prompt mode are allowed only for Run Project.".into());
            }
            let root = selected_project_root(&folder)?;
            let (binary, version) =
                probe_reserved(&binary, Some(&runtime), Some(&reserved))?;
            let mut args = if action == "run" {
                project_run_args(&root, wants_prompt)
            } else {
                project_test_args(&action, &root, &version)?
            };
            apply_project_test_filter(&mut args, &action, &version, test_filter.as_deref())?;
            if action == "run" && wants_prompt && !supports_prompt_input(&version) {
                return Err("Project prompt Run requires Scarp v0.0.6-alpha.10 or newer alpha with --interactive support.".into());
            }
            let result = process_with_input_reserved(
                &binary,
                &args,
                Some(&root),
                EXEC_TIMEOUT,
                EXEC_OUTPUT_LIMIT,
                Some(&runtime),
                if action == "run" { Some(input.as_str()) } else { None },
                Some(&reserved),
            )?;
            let exit_code = result.status.code();
            let exit = exit_code
                .map_or("terminated by signal".to_owned(), |value| value.to_string());
            let outcome = if result.cancelled { "cancelled" }
                else if result.status.success() { "completed" } else { "failed" };
            let cap_notice = if result.truncated {
                "\n[Project output truncated to Studio's safety limit.]"
            } else { "" };
            // Only the official compiler's complete test-report stdout
            // is passed to the frontend. It is still parsed strictly there.
            // Per-test failures return exit 1 with a complete JSON report.
            let report_json = if allowed_project_test_exit_code(&action, exit_code)
                && supports_structured_project_tests(&version)
                && !result.truncated
                && !result.cancelled
                && result.stdout.starts_with('{')
            {
                Some(result.stdout.clone())
            } else {
                None
            };
            let filter_note = test_filter.as_ref().map_or_else(String::new, |filter| {
                format!("\nLiteral test filename filter: {filter:?} (not a full suite)")
            });
            let display = format!(
                "Scarp {version} — project {action} {}\nStatus: {outcome} (exit {exit}){filter_note}\n\n{}{}{}{}",
                root.display(), result.stdout,
                if result.stderr.is_empty() { "" } else { "\nCompiler diagnostics:\n" },
                result.stderr, cap_notice,
            );
            let inspection_json = if matches!(
                action.as_str(),
                "info" | "inspect-symbols" | "inspect-references"
            )
                && exit_code == Some(0)
                && !result.truncated
                && !result.cancelled
                && result.stderr.is_empty()
            {
                Some(result.stdout.clone())
            } else {
                None
            };
            // Diagnostics from explicitly non-executing compiler commands
            // use stderr only. Never interpret program/test output as errors.
            let diagnostic_json = if matches!(
                action.as_str(),
                "verify" | "inspect-symbols" | "inspect-references"
            ) && exit_code == Some(1)
                && !result.truncated
                && !result.cancelled
                && result.stdout.is_empty()
                && !result.stderr.is_empty()
            {
                Some(result.stderr.clone())
            } else {
                None
            };
            // The UI independently checks exit_code against the exact schema
            // counts. Do not infer success by regexing the display string.
            Ok((
                display,
                report_json,
                exit_code,
                (exit_code, result.cancelled, result.truncated, false),
                inspection_json,
                diagnostic_json,
            ))
        })();
        release_job(&runtime, reserved.id);
        execution
    })
    .await
    .map_err(|e| format!("Scarp project worker failed: {e}"))?
}

/// Capability probes share a single reserved job ID across --version,
/// guide exec, and guide verify. Stop may terminate whichever child is active;
/// a cancelled reservation must never start the next child or user source.
fn compiler_supports_reserved(
    binary: &Path,
    verb: &str,
    runtime: Option<&CompilerRuntime>,
    reservation: Option<&ActiveJob>,
) -> Result<bool, String> {
    let args = [OsString::from("guide"), OsString::from(verb)];
    let result = process_with_input_reserved(
        binary,
        &args,
        None,
        PROBE_TIMEOUT,
        PROBE_OUTPUT_LIMIT,
        runtime,
        None,
        reservation,
    )?;
    if result.cancelled {
        return Err("Scarp compiler capability probe was cancelled.".into());
    }
    Ok(result.status.success()
        && !result.truncated
        && result.stdout.starts_with(&format!("Usage: scarp {verb}")))
}

fn probe_reserved(
    binary: &str,
    runtime: Option<&CompilerRuntime>,
    reservation: Option<&ActiveJob>,
) -> Result<(PathBuf, String), String> {
    let binary = compiler_binary(binary)?;
    let result = process_with_input_reserved(
        &binary,
        &[OsString::from("--version")],
        None,
        PROBE_TIMEOUT,
        PROBE_OUTPUT_LIMIT,
        runtime,
        None,
        reservation,
    )?;
    if result.cancelled {
        return Err("Scarp compiler version probe was cancelled.".into());
    }
    if !result.status.success() || result.truncated {
        return Err("Scarp --version failed or returned invalid output.".into());
    }
    let version = parse_version(&result.stdout)
        .ok_or("The executable did not report a valid Scarp version.")?;
    if !compiler_supports_reserved(&binary, "exec", runtime, reservation)?
        || !compiler_supports_reserved(&binary, "verify", runtime, reservation)?
    {
        return Err("This Scarp build does not advertise both exec and static verify.".into());
    }
    Ok((binary, version))
}

/// Direct Rust integration tests may probe without an active Studio job.
fn probe(binary: &str) -> Result<(PathBuf, String), String> {
    probe_reserved(binary, None, None)
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

/// After a Run or Verify completes, recheck the original *saved bytes* using
/// the same bounded reader as the preflight. Another editor may have replaced,
/// truncated or removed the source while the compiler was processing it.
/// Preserve the compiler's raw output, but never use its positions against
/// a source now known to be different or unavailable. This is best-effort:
/// a modification restored to byte-identical content is not observable here.
fn source_stale_after_execution(source: &Path, expected_content: &str) -> bool {
    ensure_matching_disk_snapshot(source, expected_content).is_err()
}

fn command_args(mode: &str, source: &Path) -> Result<Vec<OsString>, String> {
    let mut args = match mode {
        "exec" => vec![
            OsString::from("exec"),
            OsString::from("--max-steps"),
            OsString::from(STUDIO_MAX_EXEC_STEPS),
            OsString::from("--max-prints"),
            OsString::from(STUDIO_MAX_EXEC_PRINTS),
        ],
        "verify" => vec![OsString::from("verify")],
        _ => return Err("Only the official Scarp exec and verify commands are allowed.".into()),
    };
    args.push(OsString::from("--diagnostic-format=json"));
    args.push(OsString::from("--"));
    args.push(source.as_os_str().to_owned());
    Ok(args)
}

fn command_args_with_input(
    mode: &str,
    source: &Path,
    has_input: bool,
) -> Result<Vec<OsString>, String> {
    let mut args = command_args(mode, source)?;
    if has_input {
        if mode != "exec" {
            return Err("Static Verify does not accept runtime input.".into());
        }
        args.splice(
            1..1,
            [
                "--max-input-line-bytes",
                "4096",
                "--max-input-bytes",
                "16384",
                "--max-input-reads",
                "256",
            ]
            .into_iter()
            .map(OsString::from),
        );
    }
    Ok(args)
}

/// Probe only the executable selected by the user. No execution or PATH search.
#[tauri::command]
pub async fn scarp_probe(
    binary: String,
    state: tauri::State<'_, CompilerRuntime>,
) -> Result<String, String> {
    let runtime = state.inner().clone();
    let reserved = reserve_job(&runtime)?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = probe_reserved(&binary, Some(&runtime), Some(&reserved))
            .map(|(_, version)| format!("Scarp {version} — exec and static verify available"));
        release_job(&runtime, reserved.id);
        result
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
    stdin_text: String,
    interactive: Option<bool>,
    state: tauri::State<'_, CompilerRuntime>,
) -> Result<(String, Option<String>, NativeOutcome), String> {
    let runtime = state.inner().clone();
    // Claim the native execution slot before the background worker probes
    // compiler CLI support, so Stop prevents later source execution.
    let reserved = reserve_job(&runtime)?;
    tauri::async_runtime::spawn_blocking(move || {
        let execution = (|| {
            if reserved.cancelled.load(Ordering::SeqCst) {
                return Err("Scarp operation was cancelled before launch.".into());
            }
            let source = source_file(&source)?;
            // Reject excessive/foreign input before probing or executing any binary.
            validate_stdin(&stdin_text)?;
            let mut args = command_args_with_input(&mode, &source, !stdin_text.is_empty())?;
            let (binary, version) =
                with_verified_source_snapshot(&source, &expected_content, || {
                    probe_reserved(&binary, Some(&runtime), Some(&reserved))
                })?;
            if interactive.unwrap_or(false) {
                if mode != "exec" || !supports_prompt_input(&version) {
                    return Err("Prompt Run requires the official Scarp v0.0.6-alpha.10 CLI with --interactive support.".into());
                }
                args.insert(1, OsString::from("--interactive"));
            }
            let result = process_with_input_reserved(
                &binary,
                &args,
                source.parent(),
                EXEC_TIMEOUT,
                EXEC_OUTPUT_LIMIT,
                Some(&runtime),
                if mode == "exec" {
                    Some(stdin_text.as_str())
                } else {
                    None
                },
                Some(&reserved),
            )?;
            // A second editor can change the on-disk source *after* our
            // pre-launch check. Never lose useful output or misapply old
            // compiler diagnostics to the presently saved source.
            let source_stale = source_stale_after_execution(&source, &expected_content);
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
            // Static Verify never executes user source. Only its complete,
            // non-cancelled failure stderr can be used for navigation.
            // Interactive Run can flush user-written stderr: NEVER treat that
            // stream as trusted diagnostic JSON (even on a failing exit).
            let diagnostic_stderr = if mode == "verify"
                && !result.status.success()
                && !result.cancelled
                && !result.truncated
                && !source_stale
                && !result.stderr.is_empty()
            {
                Some(result.stderr.clone())
            } else {
                None
            };
            let stale_notice = if source_stale {
                "[Source changed or became unavailable on disk during this command. Compiler output below refers to the previously saved snapshot; reload/review the file and rerun. Diagnostic navigation was disabled.]\n\n"
            } else {
                ""
            };
            let display = format!(
                "{stale_notice}Scarp {version} — {mode} {}\nStatus: {outcome} (exit {exit})\n\n{}{}{}{}",
                source.display(),
                result.stdout,
                if result.stderr.is_empty() {
                    ""
                } else {
                    "\nCompiler diagnostics:\n"
                },
                result.stderr,
                cap_notice
            );
            Ok((
                display,
                diagnostic_stderr,
                (
                    result.status.code(),
                    result.cancelled,
                    result.truncated,
                    source_stale,
                ),
            ))
        })();
        release_job(&runtime, reserved.id);
        execution
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
    if let Some(child) = &job.child {
        let mut child = child.lock().map_err(|e| e.to_string())?;
        let _ = child.kill(); // Already exited is harmless; completion resolves separately.
    }
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
    fn bounded_stdin_rejects_oversized_utf8_lines_and_excess_lines() {
        assert!(validate_stdin("").is_ok());
        assert!(validate_stdin("नमस्ते 👋\r\nAda").is_ok());
        assert!(validate_stdin(&"a".repeat(4096)).is_ok());
        assert!(validate_stdin(&"a".repeat(4097)).is_err());
        assert!(validate_stdin(&"👋".repeat(1025)).is_err());
        assert!(validate_stdin(&"a\n".repeat(257)).is_err());
        assert!(validate_stdin(&("a".repeat(4000) + &"\n".repeat(13000))).is_err());
        assert!(command_args_with_input("verify", Path::new("main.srp"), true).is_err());
        let args = command_args_with_input("exec", Path::new("main.srp"), true).unwrap();
        assert!(args.contains(&OsString::from("--max-input-bytes")));
        assert_eq!(args.last().unwrap(), "main.srp");
    }

    #[test]
    fn prompt_mode_is_version_gated() {
        assert!(!supports_prompt_input("0.0.6-alpha.8"));
        assert!(!supports_prompt_input("0.0.6-alpha.9"));
        assert!(supports_prompt_input("0.0.6-alpha.10"));
        assert!(supports_prompt_input("0.0.6-alpha.11"));
        assert!(!supports_prompt_input("0.0.6-beta.1"));
        assert!(!supports_prompt_input("unknown"));
        for version in ["0.0.7-alpha.1", "0.0.7-alpha.2", "0.0.7-alpha.3"] {
            assert!(supports_prompt_input(version));
            assert!(supports_structured_project_tests(version));
        }
        for version in [
            "0.0.7-alpha.0",
            "0.0.7-alpha.4",
            "0.0.7-beta.1",
            "0.0.8-alpha.1",
        ] {
            assert!(!supports_prompt_input(version));
            assert!(!supports_structured_project_tests(version));
        }
    }

    #[test]
    fn project_inspection_has_fixed_static_arguments_and_version_gate() {
        let folder = Path::new("C:/Scarp workspace");
        for (action, verb) in [
            ("inspect-symbols", "symbols"),
            ("inspect-references", "references"),
        ] {
            let args = project_test_args(action, folder, "0.0.7-alpha.3").unwrap();
            assert_eq!(args[0], "inspect");
            assert_eq!(args[1], verb);
            assert_eq!(args[2], "--json");
            assert_eq!(args[3], "--diagnostic-format=json");
            assert_eq!(args[4], "--");
            assert_eq!(args[5], folder.as_os_str());
            assert!(project_test_args(action, folder, "0.0.6-alpha.20").is_err());
            assert!(project_test_args(action, folder, "0.0.7-alpha.4").is_err());
        }
        assert!(project_test_args("inspect tokens", folder, "0.0.7-alpha.3").is_err());
    }

    #[test]
    fn project_actions_are_narrow_and_never_accept_commands_or_flags() {
        let root = Path::new("C:/Scarp Project");
        let info = project_action_args("info", root).unwrap();
        assert_eq!(info[0], "project");
        assert_eq!(info[1], "info");
        assert!(info.contains(&OsString::from("--json")));
        assert_eq!(info[info.len() - 2], "--");
        assert_eq!(info.last().unwrap(), root.as_os_str());
        let verify = project_action_args("verify", root).unwrap();
        assert_eq!(verify[0], "verify");
        assert!(verify.contains(&OsString::from("--diagnostic-format=json")));
        let list = project_action_args("list-tests", root).unwrap();
        assert_eq!(list[0], "test");
        assert!(list.contains(&OsString::from("--list")));
        let run = project_action_args("run-tests", root).unwrap();
        assert_eq!(run[0], "test");
        assert!(run.contains(&OsString::from("--require-tests")));
        for action in ["run", "exec", "init", "delete", "test --all", "../run", ""] {
            assert!(project_action_args(action, root).is_err(), "{action}");
        }
    }

    #[test]
    fn structured_project_test_reports_require_expected_native_exit_codes() {
        assert!(allowed_project_test_exit_code("list-tests", Some(0)));
        assert!(!allowed_project_test_exit_code("list-tests", Some(1)));
        assert!(!allowed_project_test_exit_code("list-tests", Some(2)));
        assert!(allowed_project_test_exit_code("run-tests", Some(0)));
        // A failed assertion/test is a genuine complete suite with exit 1.
        assert!(allowed_project_test_exit_code("run-tests", Some(1)));
        assert!(!allowed_project_test_exit_code("run-tests", Some(2)));
        assert!(!allowed_project_test_exit_code("run-tests", Some(-1)));
        for action in ["list-tests", "run-tests", "verify", "info", "run"] {
            assert!(!allowed_project_test_exit_code(action, None));
        }
        for action in ["verify", "info", "run", "test --all", ""] {
            assert!(!allowed_project_test_exit_code(action, Some(0)));
            assert!(!allowed_project_test_exit_code(action, Some(1)));
        }
    }

    #[test]
    fn project_json_v2_arguments_are_gated_by_published_compiler_version() {
        let root = Path::new("C:/Scarp Project");
        let legacy = project_test_args("list-tests", root, "0.0.6-alpha.8").unwrap();
        assert!(!legacy.contains(&OsString::from("--json=v2")));
        for action in ["list-tests", "run-tests"] {
            let args = project_test_args(action, root, "0.0.6-alpha.10").unwrap();
            assert_eq!(args[0], "test");
            assert_eq!(args[1], "--json=v2");
            assert_eq!(args[args.len() - 2], "--");
            assert_eq!(args.last().unwrap(), root.as_os_str());
        }
        let info = project_test_args("info", root, "0.0.6-alpha.10").unwrap();
        assert!(!info.contains(&OsString::from("--json=v2")));
        assert!(!supports_structured_project_tests("0.0.6-alpha.8"));
        assert!(supports_structured_project_tests("0.0.6-alpha.9"));
        assert!(supports_structured_project_tests("0.0.6-alpha.10"));
        assert!(!supports_structured_project_tests("garbage"));
    }

    #[test]
    fn project_run_uses_only_manifest_directory_and_bounded_input_flags() {
        let root = Path::new("C:/Scarp Project");
        let ordinary = project_run_args(root, false);
        assert_eq!(ordinary[0], "run");
        // Both ways to execute user code must carry identical bounded
        // interpreter workloads rather than the larger compiler defaults.
        let single = command_args("exec", Path::new("C:/source.srp")).unwrap();
        for (flag, limit) in [
            ("--max-steps", STUDIO_MAX_EXEC_STEPS),
            ("--max-prints", STUDIO_MAX_EXEC_PRINTS),
        ] {
            for args in [&ordinary, &single] {
                let index = args.iter().position(|item| item == flag).unwrap();
                assert_eq!(args[index + 1], limit);
                assert!(index < args.len() - 2, "work quota must precede --");
            }
        }
        assert!(ordinary.contains(&OsString::from("--max-input-line-bytes")));
        assert!(ordinary.contains(&OsString::from("4096")));
        assert!(ordinary.contains(&OsString::from("--max-input-bytes")));
        assert!(ordinary.contains(&OsString::from("16384")));
        assert!(ordinary.contains(&OsString::from("--max-input-reads")));
        assert!(ordinary.contains(&OsString::from("256")));
        assert!(ordinary.contains(&OsString::from("--diagnostic-format=json")));
        assert!(!ordinary.contains(&OsString::from("--interactive")));
        assert_eq!(ordinary[ordinary.len() - 2], "--");
        assert_eq!(ordinary.last().unwrap(), root.as_os_str());
        let prompted = project_run_args(root, true);
        assert!(prompted.contains(&OsString::from("--interactive")));
        for (flag, limit) in [
            ("--max-steps", STUDIO_MAX_EXEC_STEPS),
            ("--max-prints", STUDIO_MAX_EXEC_PRINTS),
        ] {
            let index = prompted.iter().position(|item| item == flag).unwrap();
            assert_eq!(prompted[index + 1], limit);
        }
        assert_eq!(prompted[prompted.len() - 2], "--");
        assert_eq!(prompted.last().unwrap(), root.as_os_str());
    }

    #[test]
    fn project_folder_requires_absolute_existing_manifest_root() {
        use std::time::{SystemTime, UNIX_EPOCH};
        assert!(selected_project_root("relative-path").is_err());
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root =
            std::env::temp_dir().join(format!("studio-project-{}-{unique}", std::process::id()));
        fs::create_dir(&root).unwrap();
        assert!(selected_project_root(root.to_str().unwrap()).is_err());
        // A same-named directory is not a regular manifest.
        fs::create_dir(root.join("scarp.project")).unwrap();
        assert!(selected_project_root(root.to_str().unwrap()).is_err());
        fs::remove_dir(root.join("scarp.project")).unwrap();
        fs::write(root.join("scarp.project"), "scarp-project: 1\n").unwrap();
        assert_eq!(
            selected_project_root(root.to_str().unwrap()).unwrap(),
            fs::canonicalize(&root).unwrap()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn project_manifest_symlink_is_rejected_before_native_compiler_launch() {
        use std::os::unix::fs::symlink;
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "studio-symlink-project-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("real-manifest"), "scarp-project: 1\n").unwrap();
        symlink(root.join("real-manifest"), root.join("scarp.project")).unwrap();
        assert!(selected_project_root(root.to_str().unwrap()).is_err());
        fs::remove_dir_all(root).unwrap();
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
    fn completed_compiler_output_detects_external_source_changes_without_discarding_logs() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "studio-source-postcheck-{}-{unique}.srp",
            std::process::id()
        ));
        let saved = "print(\"original\");";
        fs::write(&path, saved).unwrap();
        assert!(!source_stale_after_execution(&path, saved));

        // A same-length external change defeats size-only or timestamp-only
        // checks, but exact saved-byte comparison still catches it.
        let changed = "print(\"modified\");";
        assert_eq!(saved.len(), changed.len());
        fs::write(&path, changed).unwrap();
        assert!(source_stale_after_execution(&path, saved));

        fs::write(&path, saved).unwrap();
        assert!(!source_stale_after_execution(&path, saved));
        // Growth beyond the 4 MiB limit must remain bounded and be stale.
        let huge = vec![b'x'; MAX_SOURCE_BYTES as usize + 1];
        fs::write(&path, huge).unwrap();
        assert!(source_stale_after_execution(&path, saved));

        fs::remove_file(&path).unwrap();
        assert!(source_stale_after_execution(&path, saved));
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
        // Studio's actual selection/Run path reserves the same job across
        // all three probe subprocesses and keeps Stop available throughout.
        let selected_runtime = CompilerRuntime::default();
        let selected_reservation = reserve_job(&selected_runtime).unwrap();
        let (reserved_binary, reserved_version) = probe_reserved(
            &selected,
            Some(&selected_runtime),
            Some(&selected_reservation),
        )
        .expect("official compiler reserved probe");
        assert_eq!(reserved_binary, binary);
        assert_eq!(reserved_version, version);
        assert!(selected_runtime
            .active
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|job| job.id == selected_reservation.id && job.child.is_none()));
        release_job(&selected_runtime, selected_reservation.id);
        assert!(selected_runtime.active.lock().unwrap().is_none());
        let expected_version = std::env::var("SCARP_TEST_EXPECTED_VERSION")
            .expect("CI must explicitly provide the pinned Scarp compiler version");
        assert_eq!(version, expected_version);

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
        assert!(
            !runtime_failure.status.success(),
            "assert(false) must fail execution"
        );
        assert!(!runtime_failure.truncated);
        assert!(!runtime_failure.cancelled);
        assert!(
            runtime_failure.stderr.contains("E0065"),
            "{}",
            runtime_failure.stderr
        );
        assert!(
            runtime_failure.stdout.is_empty(),
            "failed execution replayed user stdout"
        );

        // Verify the real, published alpha.10 JSON stderr envelope. The
        // editor may navigate these errors only from failed static Verify.
        let invalid_source = "print(unknown_name);";
        fs::write(&source, invalid_source).unwrap();
        ensure_matching_disk_snapshot(&validated, invalid_source).unwrap();
        let failed_verify = process(
            &binary,
            &command_args("verify", &validated).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )
        .expect("native failed Verify diagnostics");
        assert!(!failed_verify.status.success());
        assert!(!failed_verify.truncated);
        assert!(!failed_verify.cancelled);
        let first_json = failed_verify.stderr.lines().next().unwrap_or("");
        assert!(
            first_json.contains("\"schema_version\":1")
                && first_json.contains("\"span_encoding\":\"utf-8-bytes\"")
                && first_json.contains("\"column_encoding\":\"unicode-scalar\""),
            "Scarp Verify JSON contract changed: {first_json}"
        );
        assert!(failed_verify.stdout.is_empty());

        // Exercise Scarp alpha.10's real read_line stdin contract using a pipe.
        let input_source = "bind name = read_line(); print(\"Hello\", name);";
        fs::write(&source, input_source).unwrap();
        ensure_matching_disk_snapshot(&validated, input_source).unwrap();
        let static_input = process(
            &binary,
            &command_args("verify", &validated).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
        )
        .expect("static read_line verification");
        assert!(static_input.status.success(), "{}", static_input.stderr);
        assert!(static_input.stdout.is_empty());

        let input_run = process_with_input(
            &binary,
            &command_args_with_input("exec", &validated, true).unwrap(),
            validated.parent(),
            EXEC_TIMEOUT,
            EXEC_OUTPUT_LIMIT,
            Some(&runtime),
            Some("नमस्ते 👋\n"),
        )
        .expect("native bounded stdin execution");
        assert!(input_run.status.success(), "{}", input_run.stderr);
        assert_eq!(input_run.stdout, "Hello नमस्ते 👋\n");

        fs::remove_file(&source).unwrap();

        // Alpha.20 changes the preferred filename, not the native project's
        // scoped argument contract. Exercise the same native command builders
        // and bounded process runner used by Studio for both manifest formats.
        if matches!(
            expected_version.as_str(),
            "0.0.6-alpha.20" | "0.0.7-alpha.1" | "0.0.7-alpha.2" | "0.0.7-alpha.3"
        ) {
            let workspace = std::env::temp_dir().join(format!(
                "studio-project-compat-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir(&workspace).unwrap();
            for (folder, filename, manifest, format) in [
                (
                    "modern",
                    "scarp.project",
                    "project \"modern\" { version: \"0.1.0\" entry: \"src/main.srp\" type: \"application\" }\n",
                    "v2",
                ),
                (
                    "legacy",
                    "Scarp.project",
                    "scarp-project: 1\nname: legacy\nentry: src/main.srp\n",
                    "legacy-v1",
                ),
            ] {
                let root = workspace.join(folder);
                fs::create_dir_all(root.join("src")).unwrap();
                fs::write(root.join(filename), manifest).unwrap();
                let main = root.join("src/main.srp");
                // Project Info and Verify are deliberately non-executing.
                fs::write(&main, "assert(false);\n").unwrap();
                let selected_root = selected_project_root(root.to_str().unwrap()).unwrap();
                let info = process(
                    &binary,
                    &project_action_args("info", &selected_root).unwrap(),
                    Some(&selected_root),
                    EXEC_TIMEOUT,
                    EXEC_OUTPUT_LIMIT,
                    Some(&runtime),
                )
                .expect("native project info");
                assert!(info.status.success(), "{}", info.stderr);
                assert!(!info.truncated && !info.cancelled);
                assert!(info.stdout.contains("\"schema_version\":1"));
                assert!(info.stdout.contains(&format!("\"format\":\"{format}\"")));
                assert!(info.stdout.contains("\"entry\":\"src/main.srp\""));
                let verify = process(
                    &binary,
                    &project_action_args("verify", &selected_root).unwrap(),
                    Some(&selected_root),
                    EXEC_TIMEOUT,
                    EXEC_OUTPUT_LIMIT,
                    Some(&runtime),
                )
                .expect("native project Verify");
                assert!(verify.status.success(), "{}", verify.stderr);
                assert!(!verify.truncated && !verify.cancelled);
                assert!(verify.stdout.is_empty());

                if expected_version == "0.0.7-alpha.3" {
                    // The same bounded native process runner and fixed command
                    // builder used by the project inspection bridge.
                    for action in ["inspect-symbols", "inspect-references"] {
                        let inspection = process(
                            &binary,
                            &project_test_args(action, &selected_root, &expected_version).unwrap(),
                            Some(&selected_root),
                            EXEC_TIMEOUT,
                            EXEC_OUTPUT_LIMIT,
                            Some(&runtime),
                        )
                        .expect("native static project inspection");
                        assert!(inspection.status.success(), "{}", inspection.stderr);
                        assert!(!inspection.truncated && !inspection.cancelled);
                        assert!(inspection.stderr.is_empty());
                        assert!(inspection.stdout.contains("\"schema_version\":1"));
                        assert!(inspection.stdout.contains("\"span_encoding\":\"utf-8-bytes\""));
                        assert_eq!(
                            inspection.stdout.contains("\"references\":["),
                            action == "inspect-references"
                        );
                    }
                }

                fs::write(&main, "print(\"STUDIO_PROJECT_ALPHA20_OK\");\n").unwrap();
                let run = process(
                    &binary,
                    &project_run_args(&selected_root, false),
                    Some(&selected_root),
                    EXEC_TIMEOUT,
                    EXEC_OUTPUT_LIMIT,
                    Some(&runtime),
                )
                .expect("native project Run");
                assert!(run.status.success(), "{}", run.stderr);
                assert!(!run.truncated && !run.cancelled);
                assert_eq!(run.stdout.trim(), "STUDIO_PROJECT_ALPHA20_OK");
                assert_eq!(fs::read_to_string(root.join(filename)).unwrap(), manifest);
            }
            fs::remove_dir_all(workspace).unwrap();
        }
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
    fn reserved_probe_children_keep_the_slot_between_launches() {
        let binary = std::env::current_exe().unwrap();
        let runtime = CompilerRuntime::default();
        let reserved = reserve_job(&runtime).unwrap();
        let args = [OsString::from("--list")];
        for _ in 0..2 {
            let result = process_with_input_reserved(
                &binary,
                &args,
                None,
                Duration::from_secs(8),
                4096,
                Some(&runtime),
                None,
                Some(&reserved),
            )
            .expect("reserved capability subprocess");
            assert!(result.status.success());
            assert!(!result.cancelled);
            let slot = runtime.active.lock().unwrap();
            let job = slot.as_ref().expect("reservation survives each subprocess");
            assert_eq!(job.id, reserved.id);
            assert!(
                job.child.is_none(),
                "completed child handle must be cleared"
            );
            drop(slot); // Do not call reserve_job while holding the same mutex.
            assert!(
                reserve_job(&runtime).is_err(),
                "another job must not take the slot"
            );
        }
        release_job(&runtime, reserved.id);
        assert!(runtime.active.lock().unwrap().is_none());
    }

    #[test]
    fn stop_during_reserved_probe_kills_child_and_blocks_followup_launch() {
        let binary = std::env::current_exe().unwrap();
        let runtime = CompilerRuntime::default();
        let reserved = reserve_job(&runtime).unwrap();
        let worker_runtime = runtime.clone();
        let worker_reservation = reserved.clone();
        let worker = thread::spawn(move || {
            process_with_input_reserved(
                &binary,
                &slow_test_process_args(),
                None,
                Duration::from_secs(12),
                4096,
                Some(&worker_runtime),
                None,
                Some(&worker_reservation),
            )
        });
        let started = Instant::now();
        loop {
            let spawned = runtime
                .active
                .lock()
                .unwrap()
                .as_ref()
                .is_some_and(|job| job.child.is_some());
            if spawned {
                break;
            }
            assert!(
                started.elapsed() < Duration::from_secs(8),
                "probe child did not launch"
            );
            thread::sleep(Duration::from_millis(10));
        }
        assert!(cancel_active_job(&runtime).unwrap());
        let result = worker.join().unwrap().expect("cancelled probe result");
        assert!(result.cancelled, "native Stop must be visible to the probe");
        assert!(
            !result.status.success(),
            "Stop must kill the active probe child"
        );
        let slot = runtime.active.lock().unwrap();
        let job = slot
            .as_ref()
            .expect("cancelled probe reservation remains until worker exits");
        assert_eq!(job.id, reserved.id);
        assert!(job.child.is_none());
        assert!(job.cancelled.load(Ordering::SeqCst));
        drop(slot);
        let blocked = process_with_input_reserved(
            &std::env::current_exe().unwrap(),
            &slow_test_process_args(),
            None,
            Duration::from_secs(1),
            4096,
            Some(&runtime),
            None,
            Some(&reserved),
        )
        .err()
        .expect("cancelled reservation must not spawn another process");
        assert!(blocked.contains("cancelled before launch"), "{blocked}");
        release_job(&runtime, reserved.id);
        assert!(!cancel_active_job(&runtime).unwrap());
    }

    #[test]
    fn stop_during_capability_probe_prevents_a_later_launch() {
        let binary = std::env::current_exe().unwrap();
        let runtime = CompilerRuntime::default();
        let reserved = reserve_job(&runtime).expect("reserve probe");
        assert!(runtime
            .active
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .child
            .is_none());
        assert!(cancel_active_job(&runtime).unwrap());
        assert!(reserved.cancelled.load(Ordering::SeqCst));

        // A valid executable exists, but the native process must never spawn
        // once Stop cancelled its pending reservation.
        let result = process_with_input_reserved(
            &binary,
            &slow_test_process_args(),
            None,
            Duration::from_secs(12),
            4096,
            Some(&runtime),
            None,
            Some(&reserved),
        );
        assert!(result
            .err()
            .expect("pending operation must not launch")
            .contains("cancelled before launch"));
        release_job(&runtime, reserved.id);
        assert!(!cancel_active_job(&runtime).unwrap());
    }

    #[test]
    fn only_one_probe_can_reserve_the_native_execution_slot() {
        let runtime = CompilerRuntime::default();
        let first = reserve_job(&runtime).unwrap();
        assert!(reserve_job(&runtime).is_err());
        release_job(&runtime, first.id);
        let second = reserve_job(&runtime).unwrap();
        assert_ne!(first.id, second.id);
        release_job(&runtime, first.id);
        assert!(runtime.active.lock().unwrap().is_some());
        release_job(&runtime, second.id);
        assert!(runtime.active.lock().unwrap().is_none());
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
