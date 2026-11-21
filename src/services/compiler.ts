import { invoke } from '@tauri-apps/api/core';

export type ScarpMode = 'exec' | 'verify';

/** The Rust backend probes CLI support and never invokes a shell. */
export function probeScarp(binary: string): Promise<string> {
  return invoke<string>('scarp_probe', { binary });
}

export function executeScarp(
  binary: string, source: string, mode: ScarpMode, expectedContent: string,
): Promise<string> {
  return invoke<string>('scarp_execute', { binary, source, mode, expectedContent });
}

export function stopScarp(): Promise<boolean> {
  return invoke<boolean>('scarp_cancel');
}

/** Discovery reads bounded install locations and does not execute candidates. */
export function detectScarp(): Promise<string[]> {
  return invoke<string[]>('scarp_detect');
}

/** Opens the official compiler release listing; users choose and extract a build. */
export function openScarpDownloads(): Promise<void> {
  return invoke<void>('scarp_download_page');
}
