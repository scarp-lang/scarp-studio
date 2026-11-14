import { invoke } from '@tauri-apps/api/core';

/** Only these explicit, bounded commands may run against the chosen project. */
export type ScarpProjectAction = 'info' | 'verify' | 'list-tests' | 'run-tests' | 'run';

export function scarpProjectAction(
  binary: string, folder: string, action: ScarpProjectAction,
  stdinText = '', interactive = false,
): Promise<string> {
  const args = { binary, folder, action };
  // Retain the existing native call contract for all non-executing actions
  // and for the separate explicit Run Tests action.
  return invoke<string>('scarp_project_action',
    action === 'run' ? { ...args, stdinText, interactive } : args);
}
