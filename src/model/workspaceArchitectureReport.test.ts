import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_REPORT_SECTIONS,
  DEFAULT_ARCHITECTURE_REPORT_OPTIONS,
  MAX_ARCHITECTURE_REPORT_ROWS,
  MAX_ARCHITECTURE_REPORT_UNITS,
  architectureReportCallEdgeDescription,
  architectureReportCallSiteDescription,
  architectureReportCycleDescription,
  architectureReportFormatLabel,
  architectureReportImportEdgeDescription,
  architectureReportModuleDescription,
  architectureReportNotice,
  architectureReportSectionLabel,
  architectureReportSuggestedFilename,
  architectureReportSymbolDescription,
  buildArchitectureReport,
  buildSelectedArchitectureReport,
} from './workspaceArchitectureReport';
import { smallArchitectureFixture } from '../test/workspaceArchitectureFixtures';

describe('architecture report defaults', () => {
  it('defaults to a bounded plain-text report with all sections', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture);
    expect(report.format).toBe('text');
    expect(report.sections).toEqual(ARCHITECTURE_REPORT_SECTIONS);
    expect(report.rows).toBeGreaterThan(0);
    expect(report.text).toContain('[SUMMARY]');
    expect(report.text.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_REPORT_UNITS);
  });

  it('uses configured default row count below the hard maximum', () => {
    expect(DEFAULT_ARCHITECTURE_REPORT_OPTIONS.maxRows).toBeLessThanOrEqual(MAX_ARCHITECTURE_REPORT_ROWS);
    expect(DEFAULT_ARCHITECTURE_REPORT_OPTIONS.maxRows).toBeGreaterThan(0);
  });

  it('falls back to summary when an empty section list is supplied', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: [] });
    expect(report.sections).toEqual(['summary']);
    expect(report.text).not.toContain('moduleCount');
    expect(report.text).toContain('Open modules');
  });

  it('deduplicates repeated section requests', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: ['summary', 'summary', 'modules', 'modules'] });
    expect(report.sections).toEqual(['summary', 'modules']);
  });
});

describe('architecture text reports', () => {
  it('includes readable module observations', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: ['modules'], format: 'text' });
    expect(report.text).toContain('[MODULES]');
    expect(report.text).toContain('main.srp');
    expect(report.text).toContain('symbols=');
    expect(report.text).toContain('functions=');
  });

  it('includes declaration details without requiring internal IDs', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: ['symbols'], includeIds: false });
    expect(report.text).toContain('symbol=load');
    expect(report.text).toContain('kind=function');
    expect(report.text).not.toContain('id=[');
  });

  it('can include stable observation IDs explicitly', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: ['symbols'], includeIds: true });
    expect(report.text).toContain('id=');
  });

  it('redacts native parent paths unless explicitly requested', () => {
    const { architecture } = smallArchitectureFixture();
    const safe = buildArchitectureReport(architecture, { sections: ['modules'], includePaths: false });
    const full = buildArchitectureReport(architecture, { sections: ['modules'], includePaths: true });
    expect(safe.text).not.toContain('C:\\work\\src\\service.srp');
    expect(full.text).toContain('C:\\work\\src\\service.srp');
  });

  it('reports bounded coverage separately from graph summary', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: ['coverage'] });
    expect(report.text).toContain('Coverage');
    expect(report.text).toMatch(/Complete|Limited/);
  });

  it('can omit section headers for embedding', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { sections: ['modules'], includeHeaders: false });
    expect(report.text).not.toContain('[MODULES]');
    expect(report.text).toContain('module=');
  });
});

describe('architecture markdown reports', () => {
  it('renders one table per requested section', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, {
      format: 'markdown', sections: ['summary', 'modules', 'cycles'],
    });
    expect(report.text).toContain('## summary');
    expect(report.text).toContain('## modules');
    expect(report.text).toContain('| metric | value |');
    expect(report.text).toContain('| --- | --- |');
  });

  it('escapes pipe characters in cell values', () => {
    const fixture = smallArchitectureFixture();
    const architecture = {
      ...fixture.architecture,
      modules: Object.freeze(fixture.architecture.modules.map((module, index) => index === 0
        ? { ...module, name: 'main|unsafe.srp', listedName: null }
        : module)),
    };
    const report = buildArchitectureReport(architecture, { format: 'markdown', sections: ['modules'] });
    expect(report.text).toContain('main\\|unsafe.srp');
  });
});

describe('architecture CSV reports', () => {
  it('renders a shared section column and row headers', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { format: 'csv', sections: ['modules', 'symbols'] });
    const first = report.text.split('\n')[0];
    expect(first).toContain('section');
    expect(report.text).toContain('modules');
    expect(report.text).toContain('symbols');
  });

  it('quotes values that contain commas or quotes', () => {
    const fixture = smallArchitectureFixture();
    const architecture = {
      ...fixture.architecture,
      modules: Object.freeze(fixture.architecture.modules.map((module, index) => index === 0
        ? { ...module, name: 'main,"quoted".srp', listedName: null }
        : module)),
    };
    const report = buildArchitectureReport(architecture, { format: 'csv', sections: ['modules'] });
    expect(report.text).toContain('"main,""quoted"".srp"');
  });

  it('can omit CSV headers', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { format: 'csv', sections: ['modules'], includeHeaders: false });
    expect(report.text.split('\n')[0]).not.toContain('section,module');
  });
});

describe('architecture JSON reports', () => {
  it('emits parseable grouped JSON', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { format: 'json', sections: ['summary', 'modules'] });
    const parsed = JSON.parse(report.text) as Record<string, unknown>;
    expect(parsed.summary).toBeDefined();
    expect(parsed.modules).toBeDefined();
  });

  it('includes only requested section keys', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { format: 'json', sections: ['cycles'] });
    const parsed = JSON.parse(report.text) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['cycles']);
  });
});

describe('architecture report row bounds', () => {
  it('honors a small selected row limit and reports omitted rows', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { maxRows: 3 });
    expect(report.rows).toBe(3);
    expect(report.truncated).toBe(true);
    expect(report.omittedRows).toBeGreaterThan(0);
    expect(report.warning).toContain('omitted');
  });

  it('clamps an excessive row limit to the hard maximum', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { maxRows: MAX_ARCHITECTURE_REPORT_ROWS + 1000 });
    expect(report.rows).toBeLessThanOrEqual(MAX_ARCHITECTURE_REPORT_ROWS);
  });

  it('recovers from a non-integer row limit using the default', () => {
    const { architecture } = smallArchitectureFixture();
    const report = buildArchitectureReport(architecture, { maxRows: Number.NaN });
    expect(report.rows).toBeLessThanOrEqual(DEFAULT_ARCHITECTURE_REPORT_OPTIONS.maxRows);
  });
});

describe('selected architecture reports', () => {
  it('restricts module rows to selected IDs', () => {
    const { architecture } = smallArchitectureFixture();
    const module = architecture.modules.find(item => item.documentId === 'service')!;
    const report = buildSelectedArchitectureReport(architecture, { moduleIds: [module.id] }, {
      sections: ['modules'], format: 'text',
    });
    expect(report.text).toContain('src/service.srp');
    expect(report.text).not.toContain('module=main.srp');
  });

  it('restricts symbol rows to selected IDs', () => {
    const { architecture } = smallArchitectureFixture();
    const symbol = architecture.symbols.find(item => item.name === 'load')!;
    const report = buildSelectedArchitectureReport(architecture, { symbolIds: [symbol.id] }, {
      sections: ['symbols'], format: 'text',
    });
    expect(report.text).toContain('symbol=load');
    expect(report.text).not.toContain('symbol=normalize');
  });

  it('keeps full summary metrics while restricting entity sections', () => {
    const { architecture } = smallArchitectureFixture();
    const module = architecture.modules[0];
    const report = buildSelectedArchitectureReport(architecture, { moduleIds: [module.id] }, {
      sections: ['summary', 'modules'], format: 'text',
    });
    expect(report.text).toContain('Open modules');
    expect(report.text).toContain(String(architecture.summary.moduleCount));
  });
});

describe('architecture report labels and descriptions', () => {
  it('has a label for every report section and format', () => {
    for (const section of ARCHITECTURE_REPORT_SECTIONS) expect(architectureReportSectionLabel(section).length).toBeGreaterThan(2);
    for (const format of ['text', 'markdown', 'csv', 'json'] as const) expect(architectureReportFormatLabel(format).length).toBeGreaterThan(2);
  });

  it('suggests a sanitized filename with the correct extension', () => {
    const fixture = smallArchitectureFixture();
    for (const format of ['text', 'markdown', 'csv', 'json'] as const) {
      const name = architectureReportSuggestedFilename(fixture.architecture, format);
      expect(name).toMatch(/^scarp-workspace-architecture-/);
      expect(name).toMatch(format === 'text' ? /\.txt$/ : format === 'markdown' ? /\.md$/ : format === 'csv' ? /\.csv$/ : /\.json$/);
    }
  });

  it('builds a compact architecture notice', () => {
    const { architecture } = smallArchitectureFixture();
    const notice = architectureReportNotice(architecture);
    expect(notice).toContain('open modules');
    expect(notice).toContain('functions');
    expect(notice).toContain('lexical call sites');
    expect(notice).toContain('literal imports');
  });

  it('describes representative graph entities', () => {
    const { architecture } = smallArchitectureFixture();
    expect(architectureReportModuleDescription(architecture.modules[0])).toContain('declarations');
    expect(architectureReportSymbolDescription(architecture, architecture.symbols[0])).toContain(architecture.symbols[0].name);
    expect(architectureReportCallSiteDescription(architecture, architecture.callSites[0])).toContain(architecture.callSites[0].name);
    expect(architectureReportCallEdgeDescription(architecture, architecture.callEdges[0])).toContain('→');
    expect(architectureReportImportEdgeDescription(architecture, architecture.importEdges[0])).toContain(architecture.importEdges[0].specifier);
    expect(architectureReportCycleDescription(architecture, architecture.cycles[0])).toContain('cycle');
  });
});
