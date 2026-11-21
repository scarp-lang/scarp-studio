import { describe, expect, it } from 'vitest';
import { CompilerDiscoveryRequests } from './compilerDiscoveryRequests';

describe('compiler discovery result freshness', () => {
  it('accepts only the newest scan when startup and manual scans finish out of order', () => {
    const requests = new CompilerDiscoveryRequests();
    const startup = requests.begin();
    const manual = requests.begin();
    expect(requests.isCurrent(manual)).toBe(true);
    expect(requests.isCurrent(startup)).toBe(false);
  });

  it('prevents the startup scan from superseding a first-Run scan', () => {
    const requests = new CompilerDiscoveryRequests();
    const startup = requests.begin();
    const firstRun = requests.begin();
    expect(requests.isCurrent(startup)).toBe(false);
    expect(requests.isCurrent(firstRun)).toBe(true);
  });

  it('invalidates pending scans at effect cleanup and supports strict-mode replay', () => {
    const requests = new CompilerDiscoveryRequests();
    const firstMount = requests.begin();
    requests.invalidate();
    expect(requests.isCurrent(firstMount)).toBe(false);
    const secondMount = requests.begin();
    expect(requests.isCurrent(secondMount)).toBe(true);
    expect(requests.isCurrent(firstMount)).toBe(false);
  });

  it('never revives a stale scan even if newer requests fail', () => {
    const requests = new CompilerDiscoveryRequests();
    const earlier = requests.begin();
    const failed = requests.begin();
    requests.invalidate();
    expect(requests.isCurrent(earlier)).toBe(false);
    expect(requests.isCurrent(failed)).toBe(false);
  });
});
