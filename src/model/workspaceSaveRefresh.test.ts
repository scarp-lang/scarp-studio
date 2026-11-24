import { describe, expect, it } from 'vitest';
import { saveChangesWorkspaceListing } from './workspaceSaveRefresh';

describe('refresh Explorer after a verified saved source path change', () => {
  it('refreshes after first Save and Save As into another practice directory', () => {
    expect(saveChangesWorkspaceListing(null, 'C:/Scarp-Practice/basic_tuple/main.srp')).toBe(true);
    expect(saveChangesWorkspaceListing(
      'C:/Scarp-Practice/basic_tuple/main.srp',
      'C:/Scarp-Practice/loops/main.srp',
    )).toBe(true);
  });

  it('does not rescan on repeated normal Saves or Windows aliases', () => {
    expect(saveChangesWorkspaceListing(
      'C:/Scarp-Practice/basic_tuple/main.srp',
      'C:/Scarp-Practice/basic_tuple/main.srp',
    )).toBe(false);
    expect(saveChangesWorkspaceListing(
      'C:/Scarp-Practice/basic_tuple/main.srp',
      'c:\\scarp-practice\\basic_tuple\\MAIN.SRP',
    )).toBe(false);
  });

  it('does not pretend POSIX case-sensitive paths are identical', () => {
    expect(saveChangesWorkspaceListing('/tmp/Scarp-Practice/Main.srp',
      '/tmp/Scarp-Practice/main.srp')).toBe(true);
  });
});
