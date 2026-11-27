// End-to-end qualification of the real published compiler wire format.
// Called only after the parent workflow verifies the official ZIP hash.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCompilerNavigation, referencesToSymbol } from '../src/model/compilerNavigation.ts';

const binary = resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'Pass the already SHA-256 validated compiler executable');
const stage = mkdtempSync(join(tmpdir(), 'studio-alpha3-inspection-'));
const project = join(stage, 'project café');
const src = join(project, 'src');
const main = join(src, 'main.srp');
const lib = join(src, 'lib.srp');
const manifest = join(project, 'scarp.project');
const manifestText = 'project "inspection" { version: "0.1.0" entry: "src/main.srp" type: "application" }\n';

function invoke(args) {
  const child = spawnSync(binary, args, {
    cwd: project, encoding: 'utf8', timeout: 20000,
    maxBuffer: 256 * 1024, windowsHide: true, shell: false,
  });
  if (child.error) throw child.error;
  return child;
}
function inspect(kind, target = project) {
  const child = invoke(['inspect', kind, '--json', '--diagnostic-format=json', '--', target]);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  const parsed = parseCompilerNavigation(child.stdout, 'inspect-' + kind);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.reason);
  return parsed.report;
}
function references(report, id) {
  return referencesToSymbol(report, id, {kind: 'all', file: 'all'});
}
function textAt(report, location) {
  // This is a disposable controlled fixture, not Studio's untrusted path
  // handling. Match only the known fixture names before reading any bytes.
  const label = report.files[location.source].path.replaceAll('\\', '/');
  const basename = label.split('/').at(-1);
  const path = basename === 'main.srp' ? main : basename === 'lib.srp' ? lib : null;
  assert.ok(path, 'Unexpected fixture file identity: ' + label);
  const bytes = readFileSync(path);
  assert.ok(location.byteEnd <= bytes.length);
  const result = new TextDecoder('utf-8', {fatal: true}).decode(
    bytes.subarray(location.byteStart, location.byteEnd));
  return result;
}
function symbol(report, name, kind) {
  const matches = report.symbols.filter(s => s.name === name && s.kind === kind);
  assert.equal(matches.length, 1, 'Expected exactly one ' + kind + ': ' + name);
  return matches[0];
}
try {
  mkdirSync(src, {recursive: true});
  writeFileSync(manifest, manifestText);
  const version = invoke(['--version']);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), 'scarp 0.0.7-alpha.3');

  // Published compiler navigation tests establish these lexical identities.
  // A Unicode comment and CRLF exercise byte offsets without inventing a
  // UTF-16 conversion. The contract would fail at runtime, not in inspection.
  const source = '// café 🌍\r\nimport "lib.srp" as lib;\r\n' +
    'var x=1; {var x=x+1; x+=2; print(x);} x=3; print(x);\r\n' +
    'print(lib.f(n: lib.value));\r\nprint(sum([1.0]));\r\nassert(false);\r\n';
  const library = 'pub bind value=2; pub pure funcra f(n: integer)->integer{return n;}\n';
  writeFileSync(main, source);
  writeFileSync(lib, library);
  const definitions = inspect('symbols');
  const report = inspect('references');
  assert.deepEqual(report.symbols, definitions.symbols);
  assert.deepEqual(report.files, definitions.files);
  assert.equal(definitions.references.length, 0);
  assert.equal(report.files.length, 2);
  const bindings = report.symbols.filter(s => s.name === 'x' && s.kind === 'binding');
  assert.equal(bindings.length, 2);
  assert.notEqual(bindings[0].id, bindings[1].id);
  assert.ok(bindings.every(s => s.mutable && textAt(report, s.location) === 'x'));
  assert.deepEqual(references(report, bindings[0].id).map(r => r.kind), ['read','write','read']);
  assert.deepEqual(references(report, bindings[1].id).map(r => r.kind), ['read_write','read']);
  const fn = symbol(report, 'f', 'function');
  const parameter = symbol(report, 'n', 'parameter');
  const alias = symbol(report, 'lib', 'import_alias');
  assert.equal(textAt(report, fn.location), 'f');
  assert.ok(fn.public);
  assert.equal(parameter.owner, fn.id);
  assert.ok(references(report, fn.id).some(r => r.kind === 'call' && textAt(report,r.location) === 'f'));
  assert.ok(references(report, parameter.id).some(r => r.kind === 'argument_label' && textAt(report,r.location) === 'n'));
  assert.ok(references(report, alias.id).some(r => r.kind === 'namespace' && textAt(report,r.location) === 'lib'));
  assert.ok(report.symbols.some(s => s.kind === 'builtin' && s.name === 'sum' && s.location === null));
  assert.equal(readFileSync(main, 'utf8'), source);
  assert.equal(readFileSync(lib, 'utf8'), library);
  assert.equal(readFileSync(manifest, 'utf8'), manifestText);
  console.log('PASS: published project symbol/reference schema, shadowing, imports, named labels and UTF-8 spans');

  // A compiler error must never emit an inventory even when JSON was requested.
  writeFileSync(main, 'bind x: integer=false;');
  for (const kind of ['symbols','references']) {
    const invalid = invoke(['inspect', kind, '--json', '--diagnostic-format=json', '--', project]);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, '');
    assert.equal(JSON.parse(invalid.stderr.trim().split(/\r?\n/)[0]).schema_version, 1);
    assert.equal(parseCompilerNavigation(invalid.stdout, 'inspect-' + kind).ok, false);
  }
  console.log('PASS: invalid project emits diagnostic, not partial inspection metadata');

  // The official CLI accepts file targets too; Studio currently exposes the
  // project commands only. Confirm the lexer and schema tolerate a Unicode name.
  writeFileSync(main, '// é🌍\r\nvar x=1; print(x);');
  const fileReport = inspect('references', main);
  const x = symbol(fileReport, 'x', 'binding');
  const use = references(fileReport, x.id)[0];
  assert.equal(textAt(fileReport,use.location), 'x');
  assert.equal(use.location.line, 2);
  assert.equal(use.location.column, 16);
  console.log('PASS: exact published byte and Unicode-scalar coordinates');
} finally {
  rmSync(stage, {recursive: true, force: true});
}
