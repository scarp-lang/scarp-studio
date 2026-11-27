import { invoke } from '@tauri-apps/api/core';
import { parseNativeOutcome, type NativeOutcome } from './nativeOutcome';

export type ScarpMode = 'exec' | 'verify';

/** The Rust backend probes CLI support and never invokes a shell. */
export function probeScarp(binary: string): Promise<string> {
  return invoke<string>('scarp_probe', { binary });
}

export async function executeScarp(
  binary: string, source: string, mode: ScarpMode, expectedContent: string,
  stdinText: string, interactive = false,
): Promise<{ output: string; diagnosticStderr: string | null; nativeOutcome?: NativeOutcome }> {
  const args = { binary, source, mode, expectedContent, stdinText };
  // Native returns a distinct, Verify-only stderr field for diagnostics.
  // Raw program stdout is never parsed as a source location.
  const [output, diagnosticStderr, rawOutcome] = await invoke<[string, string | null, unknown?]>(
    'scarp_execute', interactive ? { ...args, interactive: true } : args,
  );
  const nativeOutcome = parseNativeOutcome(rawOutcome);
  // Recheck the trusted native channel as a defense in depth. No Run stdout,
  // cancellation, truncated or stale result may acquire Verify diagnostics.
  const usable = mode === 'verify' && (rawOutcome === undefined ||
    (nativeOutcome !== null && !nativeOutcome.cancelled && !nativeOutcome.outputTruncated && !nativeOutcome.sourceStale &&
      nativeOutcome.exitCode !== 0 && nativeOutcome.exitCode !== null));
  return { output, diagnosticStderr: usable ? diagnosticStderr : null,
    ...(nativeOutcome ? { nativeOutcome } : {}) };
}

export function stopScarp(): Promise<boolean> {
  return invoke<boolean>('scarp_cancel');
}

/** Scan bounded local install locations without running any discovered executable. */
export function detectScarp(): Promise<string[]> {
  return invoke<string[]>('scarp_detect');
}

/** Open the platform-specific compiler download destination on explicit user action. */
export function openCompilerDownloads(): Promise<void> {
  return invoke<void>('scarp_download_page');
}
