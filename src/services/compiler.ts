import { invoke } from '@tauri-apps/api/core';

export type ScarpMode = 'exec' | 'verify';

/** The Rust backend probes CLI support and never invokes a shell. */
export function probeScarp(binary: string): Promise<string> {
  return invoke<string>('scarp_probe', { binary });
}

export async function executeScarp(
  binary: string, source: string, mode: ScarpMode, expectedContent: string,
): Promise<{ output: string; diagnosticStderr: string | null }> {
  const [output, diagnosticStderr] = await invoke<[string, string | null]>(
    'scarp_execute', { binary, source, mode, expectedContent },
  );
  return { output, diagnosticStderr };
}

export function stopScarp(): Promise<boolean> {
  return invoke<boolean>('scarp_cancel');
}
