import { isScarpPath } from './documents';
import {
  MAX_SCARP_FOLDER_DEPTH, MAX_SCANNED_SCARP_DIRECTORIES,
  safeRelativeScarpDirectory, safeRelativeScarpSourceName,
} from './folderListing';

export type WorkspaceCreateKind = 'source' | 'directory';
export const MAX_WORKSPACE_ITEM_NAME = 120;
export interface WorkspaceCreateRequest {
  kind: WorkspaceCreateKind;
  directory: string;
  name: string;
}
export interface WorkspaceCreatePlan {
  kind: WorkspaceCreateKind;
  directory: string;
  segments: string[];
  basename: string;
  relativePath: string;
}
export type WorkspaceCreateValidation =
  | { ok: true; plan: WorkspaceCreatePlan }
  | { ok: false; error: string };

const invalid = (error: string): WorkspaceCreateValidation => ({ ok: false, error });
const reservedWindowsName = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i;

/** Portable single-component names, never arbitrary paths or device streams. */
export function workspaceItemNameError(name: string): string | null {
  if (!name.length || name.length > MAX_WORKSPACE_ITEM_NAME) {
    return 'Enter a name between 1 and 120 characters.';
  }
  if (name !== name.trim() || name.endsWith('.') || name.startsWith('.')) {
    return 'Use a visible name without leading or trailing whitespace or dots.';
  }
  if (/[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) || reservedWindowsName.test(name)) {
    return 'Use a regular filename without reserved Windows names, separators or control characters.';
  }
  // Native path serialization replaces malformed surrogate pairs. Reject
  // these before constructing any destination or passing a name to Tauri.
  for (let i = 0; i < name.length; i++) {
    const unit = name.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = name.charCodeAt(++i);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return 'Use valid Unicode text in the name.';
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return 'Use valid Unicode text in the name.';
    }
  }
  return null;
}

/** Do not expose failed, inaccessible or malformed directory paths as
 * creation targets. A blocked ancestor also excludes all its descendants. */
export function workspaceCreationTargets(
  directories: readonly string[], unavailable: readonly string[],
): string[] {
  const blocked = new Set(unavailable);
  const targets = new Set<string>();
  if (!blocked.has('')) targets.add('');
  for (const directory of directories.slice(0, MAX_SCANNED_SCARP_DIRECTORIES - 1)) {
    if (!safeRelativeScarpDirectory(directory)) continue;
    const parts = directory.split('/');
    if (parts.some((part, index) => workspaceItemNameError(part) !== null ||
        blocked.has(parts.slice(0, index + 1).join('/')))) continue;
    if (!blocked.has('')) targets.add(directory);
  }
  return [...targets];
}

/** Creation plans are tied to observed relative directories. The native
 * service independently rechecks every parent before the actual operation. */
export function planWorkspaceCreation(
  request: WorkspaceCreateRequest, targets: readonly string[],
): WorkspaceCreateValidation {
  if (request.kind !== 'source' && request.kind !== 'directory') {
    return invalid('Choose a Scarp source or folder.');
  }
  if (!targets.includes(request.directory) ||
      (request.directory !== '' && !safeRelativeScarpDirectory(request.directory))) {
    return invalid('Choose a currently available workspace folder.');
  }
  const segments = request.directory ? request.directory.split('/') : [];
  if (segments.some(segment => workspaceItemNameError(segment) !== null)) {
    return invalid('The parent folder name is not safe for creation.');
  }
  const error = workspaceItemNameError(request.name);
  if (error) return invalid(error);
  const basename = request.kind === 'source' && !isScarpPath(request.name)
    ? request.name + '.srp' : request.name;
  const finalError = workspaceItemNameError(basename);
  if (finalError) return invalid(finalError);
  const relativePath = [...segments, basename].join('/');
  if (request.kind === 'directory') {
    if (segments.length >= MAX_SCARP_FOLDER_DEPTH) {
      return invalid('This folder is already at the maximum Explorer nesting depth.');
    }
    if (!safeRelativeScarpDirectory(relativePath)) {
      return invalid('Choose a visible, browseable folder name outside reserved build/dependency directories.');
    }
  } else if (!safeRelativeScarpSourceName(relativePath)) {
    return invalid('Choose a shorter, valid Scarp source path.');
  }
  return { ok: true, plan: {
    kind: request.kind, directory: request.directory, segments, basename, relativePath,
  } };
}
