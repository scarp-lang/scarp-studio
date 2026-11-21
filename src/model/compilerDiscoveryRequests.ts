/**
 * Prevent a slow startup scan from overwriting a newer user-requested scan.
 * Native discovery is non-executing; this tracks result ownership only.
 * Each new request invalidates every earlier result, including failures.
 */
export class CompilerDiscoveryRequests {
  private current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(request: number): boolean {
    return request === this.current;
  }

  invalidate(): void {
    this.current += 1;
  }
}
