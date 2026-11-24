// Read-only manual acceptance evidence bookkeeping. No binary execution or publication.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const worksheet = new URL('../docs/windows-11-acceptance.md', import.meta.url);
const sha40 = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;
const runUrl = /^https:\/\/github\.com\/scarp-lang\/scarp-studio\/actions\/runs\/[1-9][0-9]*$/;
const statuses = new Set(['NOT RUN', 'PASS', 'FAIL']);
const requiredIds = [
  ...Array.from({ length: 58 }, (_, i) => 'E' + String(i + 1).padStart(2, '0')).filter(id => id !== 'E49'),
  ...Array.from({ length: 39 }, (_, i) => 'P' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 28 }, (_, i) => 'C' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 18 }, (_, i) => 'D' + String(i + 1).padStart(2, '0')).filter(id => id !== 'D17'),
];
function insist(condition, message) {
  if (!condition) throw new Error(message);
}
function normalized(text) {
  return text.replace(/\r\n/g, '\n');
}
export function matrixHash(text) {
  return createHash('sha256').update(normalized(text), 'utf8').digest('hex');
}
export function parseMatrix(text) {
  const cases = [];
  const seen = new Set();
  for (const line of normalized(text).split('\n')) {
    if (!/^\|\s*[EPCD]\d/.test(line)) continue;
    const parts = line.split('|').map(part => part.trim());
    insist(parts.length === 6 && parts[0] === '' && parts[5] === '' &&
      /^[EPCD]\d{2,}$/.test(parts[1]) && parts[2] && parts[3] && statuses.has(parts[4]),
    'Malformed acceptance worksheet row: ' + line.slice(0, 80));
    insist(!seen.has(parts[1]), 'Duplicate acceptance case: ' + parts[1]);
    seen.add(parts[1]);
    cases.push(parts[1]);
  }
  for (const id of requiredIds) insist(seen.has(id), 'Required acceptance case missing: ' + id);
  return cases;
}
function identity(provenance, text) {
  insist(provenance && provenance.schema_version === 1 &&
    typeof provenance.source_commit === 'string' && sha40.test(provenance.source_commit) &&
    typeof provenance.source_tree === 'string' && sha40.test(provenance.source_tree) &&
    typeof provenance.run_url === 'string' && runUrl.test(provenance.run_url) &&
    Number.isSafeInteger(provenance.run_attempt) && provenance.run_attempt > 0 &&
    provenance.studio_version === '0.0.2-alpha.1' &&
    provenance.compiler_version === '0.0.6-alpha.20' &&
    provenance.compiler_zip_sha256 === '68a5ee47f24e2e36dd7fb1fcc6257feaea291d801048f7866bff1a7e4994aca2' &&
    provenance.publication_authorized === false && provenance.manual_gui_acceptance === 'NOT RUN',
  'Invalid or incompatible review-only provenance');
  insist(provenance.acceptance_matrix_sha256 === matrixHash(text), 'Acceptance matrix differs from the CI source');
  insist(Array.isArray(provenance.files) && provenance.files.length === 2, 'Exactly two executable records required');
  const files = provenance.files.map(file => {
    insist(file && typeof file.file === 'string' &&
      (file.file === 'scarp-studio.exe' || file.file === 'Scarp Studio_0.0.2-alpha.1_x64-setup.exe') &&
      typeof file.sha256 === 'string' && sha256.test(file.sha256) &&
      Number.isSafeInteger(file.size_bytes) && file.size_bytes > 0,
    'Invalid executable provenance record');
    return { file: file.file, sha256: file.sha256, size_bytes: file.size_bytes };
  }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  insist(files.filter(f => f.file === 'scarp-studio.exe').length === 1 &&
    files.filter(f => f.file.endsWith('-setup.exe')).length === 1, 'Executable and installer must both be recorded');
  return {
    source_commit: provenance.source_commit,
    source_tree: provenance.source_tree,
    run_url: provenance.run_url,
    run_attempt: provenance.run_attempt,
    studio_version: provenance.studio_version,
    compiler_version: provenance.compiler_version,
    compiler_zip_sha256: provenance.compiler_zip_sha256,
    acceptance_matrix_sha256: provenance.acceptance_matrix_sha256,
    files,
  };
}
export function createReport(provenance, text) {
  return {
    schema_version: 1,
    candidate: identity(provenance, text),
    windows_build: '',
    cases: parseMatrix(text).map(id => ({ id, status: 'NOT RUN', evidence: '' })),
  };
}
export function checkReport(provenance, text, report) {
  const candidate = identity(provenance, text);
  const ids = parseMatrix(text);
  insist(report && report.schema_version === 1 && report.candidate &&
    typeof report.windows_build === 'string' && report.windows_build.length <= 120 &&
    Array.isArray(report.cases), 'Invalid acceptance report');
  // Compare fixed scalar fields individually so ordinary JSON key ordering is irrelevant.
  for (const key of Object.keys(candidate).filter(key => key !== 'files')) {
    insist(report.candidate[key] === candidate[key], 'Report candidate mismatch: ' + key);
  }
  insist(Array.isArray(report.candidate.files) && report.candidate.files.length === 2,
    'Report executable records missing');
  for (const file of candidate.files) {
    const matches = report.candidate.files.filter(item => item && item.file === file.file);
    insist(matches.length === 1 && matches[0].sha256 === file.sha256 &&
      matches[0].size_bytes === file.size_bytes, 'Report executable mismatch: ' + file.file);
  }
  const expected = new Set(ids);
  const seen = new Set();
  const counts = { pass: 0, fail: 0, not_run: 0 };
  for (const result of report.cases) {
    insist(result && expected.has(result.id) && !seen.has(result.id), 'Unknown or duplicate report case');
    seen.add(result.id);
    insist(statuses.has(result.status) && typeof result.evidence === 'string' &&
      result.evidence.length <= 4096, 'Invalid case result: ' + result.id);
    if (result.status !== 'NOT RUN') {
      insist(report.windows_build.trim().length > 0 && result.evidence.trim().length > 0,
        'Executed case requires Windows build and evidence: ' + result.id);
    } else {
      insist(result.evidence.trim() === '', 'NOT RUN must not carry execution evidence: ' + result.id);
    }
    counts[result.status === 'PASS' ? 'pass' : result.status === 'FAIL' ? 'fail' : 'not_run']++;
  }
  insist(seen.size === expected.size, 'Report is missing required worksheet cases');
  return { total: ids.length, ...counts, all_cases_recorded_pass: counts.pass === ids.length,
    publication_authorized: false,
    note: 'Validates recorded evidence structure and candidate binding only. It cannot verify that manual tests really occurred or authorize a release.' };
}
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}
function main(args) {
  const text = readFileSync(worksheet, 'utf8');
  if (args.length === 1 && args[0] === 'matrix-hash') {
    parseMatrix(text);
    process.stdout.write(matrixHash(text) + '\n');
    return;
  }
  if (args.length === 2 && args[0] === 'template') {
    console.log(JSON.stringify(createReport(readJson(args[1]), text), null, 2));
    return;
  }
  if ((args.length === 3 || args.length === 4 && args[3] === '--require-pass') && args[0] === 'check') {
    const summary = checkReport(readJson(args[1]), text, readJson(args[2]));
    console.log(JSON.stringify(summary, null, 2));
    if (args[3] === '--require-pass' && !summary.all_cases_recorded_pass) process.exitCode = 1;
    return;
  }
  throw new Error('Usage: matrix-hash | template <provenance.json> | check <provenance.json> <report.json> [--require-pass]');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
