import { invoke } from '@tauri-apps/api/core';

export type ScarpMode = 'exec' | 'verify';

/** The Rust backend probes CLI support and never invokes a shell. */
export function probeScarp(binary: string): Promise<string> {
  return invoke<string>('scarp_probe', { binary });
}

export async function executeScarp(
  binary: string, source: string, mode: ScarpMode, expectedContent: string,
  stdinText: string, interactive = false,
): Promise<{ output: string; diagnosticStderr: string | null }> {
  const args = { binary, source, mode, expectedContent, stdinText };
  // Native returns a distinct, Verify-only stderr field for diagnostics.
  // Raw program stdout is never parsed as a source location.
  const [output, diagnosticStderr] = await invoke<[string, string | null]>(
    'scarp_execute', interactive ? { ...args, interactive: true } : args,
  );
  return { output, diagnosticStderr };
}

export function stopScarp(): Promise<boolean> {
  return invoke<boolean>('scarp_cancel');
}
