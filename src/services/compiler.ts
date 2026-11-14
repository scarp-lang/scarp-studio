import { invoke } from '@tauri-apps/api/core';

export type ScarpMode = 'exec' | 'verify';

/** The Rust backend probes CLI support and never invokes a shell. */
export function probeScarp(binary: string): Promise<string> {
  return invoke<string>('scarp_probe', { binary });
}

export function executeScarp(
  binary: string, source: string, mode: ScarpMode, expectedContent: string,
  stdinText: string, interactive = false,
): Promise<string> {
  const args = { binary, source, mode, expectedContent, stdinText };
  // Preserve the existing native invocation contract when prompt mode is off.
  return invoke<string>('scarp_execute', interactive ? { ...args, interactive: true } : args);
}

export function stopScarp(): Promise<boolean> {
  return invoke<boolean>('scarp_cancel');
}
