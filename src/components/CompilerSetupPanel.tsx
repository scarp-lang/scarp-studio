interface Props {
  location: 'settings' | 'output';
  native: boolean;
  busy: boolean;
  scanning: boolean;
  selecting: boolean;
  approvedPath: string | null;
  compilerInfo: string | null;
  candidates: readonly string[];
  selectedCandidate: string | null;
  onSelectCandidate: (candidate: string) => void;
  onScan: () => void;
  onDownload: () => void;
  onChoose: () => void;
  onConfirm: () => void;
}

/** Controlled view: never discovers, probes or executes on mount. */
export function CompilerSetupPanel(props: Props) {
  const disabled = !props.native || props.busy || props.scanning || props.selecting;
  const candidate = props.selectedCandidate && props.candidates.includes(props.selectedCandidate)
    ? props.selectedCandidate : null;
  const needsApproval = candidate !== null && candidate !== props.approvedPath;
  const selectId = 'studio-compiler-candidate-' + props.location;
  return (
    <section className="compiler-setup-shared" aria-label={'Compiler setup in ' + props.location}>
      <div className="compiler-setup-actions compiler-actions">
        <button type="button" disabled={disabled} onClick={props.onScan}
          title="Scan bounded installed locations and PATH without launching executables">
          {props.scanning ? 'Scanning…' : 'Scan Compiler'}
        </button>
        <button type="button" disabled={disabled} onClick={props.onDownload}
          title="Open the official download destination. Verify published SHA-256 before approval.">Download Compiler</button>
        <button type="button" disabled={disabled} onClick={props.onChoose}
          title="Manually choose a trusted Scarp executable">
          {props.selecting ? 'Checking Compiler…' : props.approvedPath ? 'Change Compiler' : 'Choose Manually'}
        </button>
      </div>
      <div className="compiler-meta">
        <p role="status">{!props.native ? 'Compiler setup is available in the desktop application only.' :
          props.scanning ? 'Scanning for Scarp executables…' : props.selecting
            ? 'Checking compiler approval…' : props.approvedPath
              ? 'Compiler approved for this session.' : candidate
                ? 'Detected compiler; approval required.' : 'No compiler detected. Download, extract, then scan again.'}</p>
        {props.approvedPath && <>
          <strong>Approved executable</strong>
          <code className="compiler-path">{props.approvedPath}</code>
          {props.compilerInfo && <div>{props.compilerInfo}</div>}
        </>}
        {props.candidates.length > 0 && <>
          <label className="compiler-candidate-select" htmlFor={selectId}>
            Detected candidate ({props.candidates.length})
            <select id={selectId} aria-label="Detected compiler to trust and use on Run"
              disabled={disabled} value={candidate ?? ''}
              onChange={event => {
                const path = event.target.value;
                if (!disabled && props.candidates.includes(path)) props.onSelectCandidate(path);
              }}>
              {candidate === null && <option value="" disabled>Select a candidate</option>}
              {props.candidates.map(path => <option key={path} value={path}>{path}</option>)}
            </select>
          </label>
          {needsApproval && <div className="compiler-location-approval">
            <span>Candidate is not approved: <code className="compiler-path">{candidate}</code></span>
            <button type="button" disabled={disabled} onClick={props.onConfirm}>Yes, confirm this location</button>
          </div>}
        </>}
        <p>Discovery does not execute software. Explicit confirmation launches a version check; approval expires when Studio closes.</p>
      </div>
    </section>
  );
}
