import { invoke } from '@tauri-apps/api/core';

/** Only these explicit, bounded commands may run against the chosen project. */
export type ScarpProjectAction = 'info' | 'verify' | 'list-tests' | 'run-tests';

export function scarpProjectAction(
  binary: string, folder: string, action: ScarpProjectAction,
): Promise<string> {
  return invoke<string>('scarp_project_action', { binary, folder, action });
}
