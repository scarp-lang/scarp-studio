import { useEffect, useRef } from 'react';
import type { StudioSettings, AutoSaveDelay, EditorFontSize } from '../model/studioSettings';

interface Props {
  settings: StudioSettings;
  onChange: (patch: Partial<StudioSettings>) => void;
  onClose: () => void;
  compilerCandidate: string | null;
  trustedCompiler: string | null;
  compilerVersion: string | null;
  compilerBusy: boolean;
  onConfirmCompiler: () => void;
  onScanCompiler: () => void;
  onChooseCompiler: () => void;
  onDownloadCompiler: () => void;
}

export default function StudioSettingsPanel({
  settings, onChange, onClose, compilerCandidate, trustedCompiler, compilerVersion,
  compilerBusy, onConfirmCompiler, onScanCompiler, onChooseCompiler, onDownloadCompiler,
}: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <section className="settings-view" aria-labelledby="studio-settings-heading">
      <div className="settings-topbar">
        <div>
          <div className="settings-eyebrow">SCARP STUDIO / PREFERENCES</div>
          <h1 id="studio-settings-heading" tabIndex={-1} ref={titleRef}>Settings</h1>
          <p>Customize the editor and review which Scarp compiler Studio will use.</p>
        </div>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
          Close ×
        </button>
      </div>

      <div className="settings-content">
        <section className="settings-section" aria-labelledby="settings-files">
          <h2 id="settings-files">Files & Auto Save</h2>
          <label className="settings-toggle">
            <span>
              <strong>Auto Save</strong>
              <small>Save named .srp files after you stop typing. Off by default.</small>
            </span>
            <input type="checkbox" checked={settings.autoSave}
              onChange={(event) => onChange({ autoSave: event.target.checked })} />
          </label>
          <label className="settings-row">
            <span>Save after inactivity</span>
            <select aria-label="Auto Save delay"
              disabled={!settings.autoSave} value={settings.autoSaveDelay}
              onChange={(event) => onChange({ autoSaveDelay: Number(event.target.value) as AutoSaveDelay })}>
              <option value={1000}>1 second</option>
              <option value={3000}>3 seconds (recommended)</option>
              <option value={5000}>5 seconds</option>
            </select>
          </label>
          <p className="settings-hint">
            Auto Save never opens a Save As dialog. New files require one manual save.
            Studio checks for external file changes and refuses to overwrite them.
            Failed saves keep your changes in the editor.
          </p>
        </section>

        <section className="settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance">Editor & Appearance</h2>
          <label className="settings-row">
            <span>Color theme</span>
            <select value={settings.theme} aria-label="Editor color theme"
              onChange={(event) => onChange({ theme: event.target.value as StudioSettings['theme'] })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label className="settings-row">
            <span>Editor font size</span>
            <select value={settings.fontSize} aria-label="Editor font size"
              onChange={(event) => onChange({ fontSize: Number(event.target.value) as EditorFontSize })}>
              {[12, 14, 16, 18, 20].map((size) =>
                <option key={size} value={size}>{size} px</option>)}
            </select>
          </label>
          <label className="settings-toggle">
            <span><strong>Word wrap</strong><small>Wrap long lines inside the editor.</small></span>
            <input type="checkbox" checked={settings.wordWrap}
              onChange={(event) => onChange({ wordWrap: event.target.checked })} />
          </label>
          <label className="settings-toggle">
            <span><strong>Minimap</strong><small>Show a compact source overview.</small></span>
            <input type="checkbox" checked={settings.minimap}
              onChange={(event) => onChange({ minimap: event.target.checked })} />
          </label>
        </section>

        <section className="settings-section" aria-labelledby="settings-compiler">
          <h2 id="settings-compiler">Scarp Compiler</h2>
          <p className="settings-hint">
            Detection does not execute software. Review the full path before allowing
            Studio to check or run any compiler. Approval lasts only this session.
          </p>
          <div className="settings-compiler-status">
            <strong>{trustedCompiler ? 'Approved for this session' :
              compilerCandidate ? 'Compiler candidate detected' : 'No compiler detected'}</strong>
            <code className="settings-compiler-path">
              {trustedCompiler || compilerCandidate || 'No Scarp executable found in standard locations'}
            </code>
            {compilerVersion && <small>{compilerVersion}</small>}
          </div>
          <div className="settings-actions">
            {compilerCandidate && !trustedCompiler && (
              <button type="button" onClick={onConfirmCompiler} disabled={compilerBusy}>
                Confirm this compiler location
              </button>
            )}
            <button type="button" onClick={onScanCompiler} disabled={compilerBusy}>Scan again</button>
            <button type="button" onClick={onChooseCompiler} disabled={compilerBusy}>Choose manually</button>
            <button type="button" onClick={onDownloadCompiler}>Official download</button>
          </div>
        </section>
      </div>
    </section>
  );
}
