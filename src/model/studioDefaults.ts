import {
  DEFAULT_EDITOR_PREFERENCES,
  type EditorPreferences,
} from './editorPreferences';
import { DEFAULT_AUTO_SAVE, type AutoSavePreferences } from './autoSaveSettings';

/** Restore the entire Studio Settings panel, not just editor appearance.
 *
 * Auto Save is intentionally disabled by default. Returning independent
 * objects avoids allowing later state edits to mutate shared constants.
 * The UI also synchronously revokes the active Auto Save writer reference
 * before committing these React state changes.
 */
export function restoreStudioDefaults(): {
  editor: EditorPreferences;
  autoSave: AutoSavePreferences;
} {
  return {
    editor: { ...DEFAULT_EDITOR_PREFERENCES },
    autoSave: { ...DEFAULT_AUTO_SAVE },
  };
}
