import { invoke } from '@tauri-apps/api/core';
import { nativeExitCode, parseNativeOutcome, type NativeOutcome } from './nativeOutcome';

/** Only these explicit, bounded commands may run against the chosen project. */
export type ScarpProjectAction = 'info' | 'verify' | 'list-tests' | 'run-tests' | 'run' | 'inspect-symbols' | 'inspect-references';

export function scarpProjectAction(
  binary: string, folder: string, action: ScarpProjectAction,
  stdinText = '', interactive = false,
): Promise<{ output: string; testReportJson: string | null; exitCode: number | null; nativeOutcome?: NativeOutcome; inspectionJson?: string; projectInfoJson?: string; diagnosticStderr?: string }> {
  const args = { binary, folder, action };
  // Preserve the arguments for existing non-executing commands.
  return invoke<[string, string | null, number | null, unknown?, unknown?, unknown?]>('scarp_project_action',
    action === 'run' ? { ...args, stdinText, interactive } : args,
  ).then(([output, report, code, rawOutcome, inspection, diagnostic]) => {
    const exitCode = nativeExitCode(code);
    const nativeOutcome = parseNativeOutcome(rawOutcome);
    // The duplicate native exit fields must agree. A malformed new-format
    // response cannot be promoted to structured test navigation.
    const consistent = rawOutcome === undefined ||
      (nativeOutcome !== null && nativeOutcome.exitCode === exitCode);
    const testReportJson = consistent && (!nativeOutcome ||
      (!nativeOutcome.cancelled && !nativeOutcome.outputTruncated && !nativeOutcome.sourceStale)) ? report : null;
    const staticJson = (action === 'info' || action === 'inspect-symbols' || action === 'inspect-references') &&
      consistent && nativeOutcome !== null && nativeOutcome.exitCode === 0 &&
      !nativeOutcome.cancelled && !nativeOutcome.outputTruncated && !nativeOutcome.sourceStale &&
      typeof inspection === 'string' ? inspection : undefined;
    const diagnosticStderr = (action === 'verify' || action === 'inspect-symbols' || action === 'inspect-references') &&
      consistent && nativeOutcome !== null && nativeOutcome.exitCode === 1 &&
      !nativeOutcome.cancelled && !nativeOutcome.outputTruncated && !nativeOutcome.sourceStale &&
      typeof diagnostic === 'string' ? diagnostic : undefined;
    const inspectionJson = action !== 'info' ? staticJson : undefined;
    const projectInfoJson = action === 'info' ? staticJson : undefined;
    return { output, testReportJson, ...(inspectionJson !== undefined ? { inspectionJson } : {}),
      ...(projectInfoJson !== undefined ? { projectInfoJson } : {}),
      ...(diagnosticStderr !== undefined ? { diagnosticStderr } : {}), exitCode: consistent ? exitCode : null,
      ...(consistent && nativeOutcome ? { nativeOutcome } : {}) };
  });
}
