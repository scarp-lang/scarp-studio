import { invoke } from '@tauri-apps/api/core';

/** Only these explicit, bounded commands may run against the chosen project. */
export type ScarpProjectAction = 'info' | 'verify' | 'list-tests' | 'run-tests' | 'run';

export function scarpProjectAction(
  binary: string, folder: string, action: ScarpProjectAction,
  stdinText = '', interactive = false,
): Promise<{ output: string; testReportJson: string | null }> {
  const args = { binary, folder, action };
  // Preserve the arguments for existing non-executing commands.
  return invoke<[string, string | null]>('scarp_project_action',
    action === 'run' ? { ...args, stdinText, interactive } : args,
  ).then(([output, testReportJson]) => ({ output, testReportJson }));
}
