import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReport, checkReport, parseMatrix, matrixHash } from './windows-acceptance-report.mjs';

const matrix = readFileSync(new URL('../docs/windows-11-acceptance.md', import.meta.url), 'utf8');
const provenance = {
  schema_version: 1,
  source_commit: 'a'.repeat(40),
  source_tree: 'b'.repeat(40),
  run_url: 'https://github.com/scarp-lang/scarp-studio/actions/runs/123',
  run_attempt: 1,
  studio_version: '0.0.2-alpha.1',
  compiler_version: '0.0.6-alpha.20',
  compiler_zip_sha256: '68a5ee47f24e2e36dd7fb1fcc6257feaea291d801048f7866bff1a7e4994aca2',
  acceptance_matrix_sha256: matrixHash(matrix),
  publication_authorized: false,
  manual_gui_acceptance: 'NOT RUN',
  files: [
    { file: 'scarp-studio.exe', sha256: 'c'.repeat(64), size_bytes: 100 },
    { file: 'Scarp-Studio-setup.exe', sha256: 'd'.repeat(64), size_bytes: 200 },
  ],
};
const fresh = () => createReport(provenance, matrix);
test('all real worksheet cases begin unrun and remain release-blocking', () => {
  const report = fresh();
  const result = checkReport(provenance, matrix, report);
  assert.ok(result.total >= 138);
  assert.equal(result.not_run, result.total);
  assert.equal(result.pass, 0);
  assert.equal(result.all_cases_recorded_pass, false);
  assert.equal(result.publication_authorized, false);
});
test('worksheet hashing is stable for Windows line endings', () => {
  assert.equal(matrixHash(matrix), matrixHash(matrix.replace(/\r?\n/g, '\r\n')));
});
test('missing, duplicated and malformed worksheet cases fail closed', () => {
  const row = matrix.split(/\r?\n/).find(line => line.startsWith('| E01 |'));
  assert.throws(() => parseMatrix(matrix.replace(row, '')), /missing/);
  assert.throws(() => parseMatrix(matrix + '\n' + row), /Duplicate/);
  assert.throws(() => parseMatrix(matrix.replace(row, row.replace('NOT RUN', 'UNKNOWN'))), /Malformed/);
});
test('reject stale provenance and old compiler or changed matrix', () => {
  for (const patch of [
    { publication_authorized: true },
    { manual_gui_acceptance: 'PASS' },
    { compiler_version: '0.0.6-alpha.19' },
    { acceptance_matrix_sha256: '0'.repeat(64) },
    { run_attempt: 0 },
    { source_commit: 'unknown' },
    { files: [provenance.files[0], provenance.files[0]] },
  ]) assert.throws(() => createReport({ ...provenance, ...patch }, matrix));
});
test('report is bound to exact commit, run attempt, compiler and binary hashes', () => {
  for (const key of ['source_commit', 'source_tree', 'run_url', 'run_attempt',
    'compiler_version', 'compiler_zip_sha256', 'acceptance_matrix_sha256']) {
    const report = fresh();
    report.candidate[key] = 'different';
    assert.throws(() => checkReport(provenance, matrix, report), /mismatch/);
  }
  const report = fresh();
  report.candidate.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => checkReport(provenance, matrix, report), /executable mismatch/);
});
test('duplicate, unknown and omitted result cases are rejected', () => {
  for (const mutate of [
    report => report.cases.push(report.cases[0]),
    report => report.cases.pop(),
    report => { report.cases[0].id = 'E999'; },
  ]) {
    const report = fresh();
    mutate(report);
    assert.throws(() => checkReport(provenance, matrix, report));
  }
});
test('executed cases need Windows build and actual evidence entries', () => {
  const report = fresh();
  report.cases[0].status = 'PASS';
  assert.throws(() => checkReport(provenance, matrix, report), /requires Windows build and evidence/);
  report.windows_build = 'Windows 11 test build';
  assert.throws(() => checkReport(provenance, matrix, report), /requires Windows build and evidence/);
  report.cases[0].evidence = 'Local evidence reference';
  report.cases[1].status = 'FAIL';
  report.cases[1].evidence = 'Reproduction log reference';
  const result = checkReport(provenance, matrix, report);
  assert.equal(result.pass, 1);
  assert.equal(result.fail, 1);
  assert.equal(result.all_cases_recorded_pass, false);
});
test('even structurally complete synthetic evidence does not authorize publication', () => {
  const report = fresh();
  report.windows_build = 'Synthetic test data';
  for (const entry of report.cases) {
    entry.status = 'PASS';
    entry.evidence = 'Synthetic unit-test evidence';
  }
  const result = checkReport(provenance, matrix, report);
  assert.equal(result.all_cases_recorded_pass, true);
  assert.equal(result.publication_authorized, false);
});
