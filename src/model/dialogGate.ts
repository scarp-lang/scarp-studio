/** Single native confirmation slot shared by tab-close and window-exit.
 * Prevents stacked operating-system dialogs and ignores duplicate requests.
 * `finish` is intentionally owner-checked so one caller cannot unlock another.
 */
export type NativeDialogKind = 'tab-close' | 'window-exit';

export class NativeDialogGate {
  private owner: NativeDialogKind | null = null;

  get isActive(): boolean {
    return this.owner !== null;
  }

  begin(kind: NativeDialogKind): boolean {
    if (this.owner !== null) return false;
    this.owner = kind;
    return true;
  }

  finish(kind: NativeDialogKind): void {
    if (this.owner === kind) this.owner = null;
  }
}
