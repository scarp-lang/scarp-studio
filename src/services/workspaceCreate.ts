import { join } from '@tauri-apps/api/path';
import { mkdir, open, readDir } from '@tauri-apps/plugin-fs';
import { sameFilePath } from '../model/documents';
import { planWorkspaceCreation, type WorkspaceCreateRequest } from '../model/workspaceCreate';

export interface CreatedWorkspaceItem {
  path: string;
  relativePath: string;
  kind: WorkspaceCreateRequest['kind'];
}
export interface WorkspaceCreateOptions {
  root: string;
  targets: readonly string[];
  request: WorkspaceCreateRequest;
  isCurrent: () => boolean;
  openPaths: () => readonly string[];
}

/** Revalidate every observed parent component using scoped native directory
 * reads. This is a best-effort check against external renames and links, not
 * an OS-level atomic directory traversal or a replacement for Tauri scope. */
export async function createWorkspaceItem(options: WorkspaceCreateOptions): Promise<CreatedWorkspaceItem> {
  const validation = planWorkspaceCreation(options.request, options.targets);
  if (!validation.ok) throw new Error(validation.error);
  const plan = validation.plan;
  function requireCurrent() {
    if (!options.isCurrent()) throw new Error('The workspace changed. Select the folder again before creating an item.');
  }
  requireCurrent();
  let parent = options.root;
  for (const component of plan.segments) {
    const entries = await readDir(parent);
    requireCurrent();
    const match = entries.find(entry => entry.name === component);
    if (!match || !match.isDirectory || match.isSymlink) {
      throw new Error('A workspace parent is missing, inaccessible or linked. Refresh Explorer and choose another folder.');
    }
    parent = await join(parent, component);
    requireCurrent();
  }
  const entries = await readDir(parent);
  requireCurrent();
  // Case-insensitive collision detection is intentional for portable Windows
  // workspaces. The native create-new operation also refuses existing files.
  if (entries.some(entry => entry.name.toLowerCase() === plan.basename.toLowerCase())) {
    throw new Error('An item with that name already exists. Choose a different name.');
  }
  const path = await join(parent, plan.basename);
  requireCurrent();
  if (options.openPaths().some(openPath => sameFilePath(path, openPath))) {
    throw new Error('This path is already represented by an open editor. Choose a different name.');
  }
  if (plan.kind === 'directory') {
    await mkdir(path, { recursive: false });
  } else {
    // createNew atomically refuses an existing file; never truncate or write
    // over an external source. An empty file is intentionally the only content.
    const handle = await open(path, { write: true, createNew: true });
    try {
      await handle.close();
    } catch {
      throw new Error('The source may have been created, but closing its native handle failed. Refresh Explorer before retrying.');
    }
  }
  return { path, relativePath: plan.relativePath, kind: plan.kind };
}
