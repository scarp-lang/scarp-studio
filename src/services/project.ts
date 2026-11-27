import { invoke } from '@tauri-apps/api/core';
import { nativeExitCode, parseNativeOutcome, type NativeOutcome } from './nativeOutcome';

/** Only these explicit, bounded commands may run against the chosen project. */
export type ScarpProjectAction = 'info' | 'verify' | 'list-tests' | 'run-tests' | 'run';

export function scarpProjectAction(
  binary: string, folder: string, action: ScarpProjectAction,
  stdinText = '', interactive = false,
): Promise<{ output: string; testReportJson: string | null; exitCode: number | null; nativeOutcome?: NativeOutcome }> {
  const args = { binary, folder, action };
  // Preserve the arguments for existing non-executing commands.
  return invoke<[string, string | null, number | null, unknown?]>('scarp_project_action',
    action === 'run' ? { ...args, stdinText, interactive } : args,
  ).then(([output, report, code, rawOutcome]) => {
    const exitCode = nativeExitCode(code);
    const nativeOutcome = parseNativeOutcome(rawOutcome);
    // The duplicate native exit fields must agree. A malformed new-format
    // response cannot be promoted to structured test navigation.
    const consistent = rawOutcome === undefined ||
      (nativeOutcome !== null && nativeOutcome.exitCode === exitCode);
    const testReportJson = consistent && (!nativeOutcome ||
      (!nativeOutcome.cancelled && !nativeOutcome.outputTruncated && !nativeOutcome.sourceStale)) ? report : null;
    return { output, testReportJson, exitCode: consistent ? exitCode : null,
      ...(consistent && nativeOutcome ? { nativeOutcome } : {}) };
  });
}
