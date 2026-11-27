import { assertWellFormedUtf16, utf8ByteLength } from './utf8Text';
import type { ScarpTestReport } from './projectTestReport';

export const MAX_TEST_FILTER_BYTES=128;
export type TestSelectionAction='list-tests'|'run-tests';
export interface TestSelection {
  readonly filter:string;
  readonly action:TestSelectionAction;
}
export function testFilterError(filter:string):string|null {
  if(typeof filter!=='string'||!filter.length)return 'Enter a literal test filename substring.';
  if(filter.startsWith('-')||/[\\/:]/.test(filter))return 'Use a filename substring, not a path or command option.';
  if(/[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(filter))return 'Remove control and directional formatting characters.';
  try{assertWellFormedUtf16(filter,'Test filter');}catch{return 'Use well-formed Unicode text.';}
  if(utf8ByteLength(filter)>MAX_TEST_FILTER_BYTES)return 'Filter exceeds 128 UTF-8 bytes.';
  return null;
}
export function testFilenameMatches(path:string,filter:string):boolean {
  return path.startsWith('tests/') && path.slice(6).includes(filter);
}
export function validateFilteredTestReport(report:ScarpTestReport,filter:string):boolean{
  return !testFilterError(filter)&&report.tests.every(test=>testFilenameMatches(test.path,filter));
}
/** A preview of previously reported filenames, not a guarantee about disk
 * discovery: the compiler independently enumerates the actual suite. */
export function previewTestSelection(report:ScarpTestReport|null,filter:string):readonly string[]{
  if(!report||testFilterError(filter))return [];
  return report.tests.filter(test=>testFilenameMatches(test.path,filter)).map(test=>test.path);
}
export function selectionCoverageLabel(report:ScarpTestReport):string {
  if(report.filter!==undefined)return 'Filtered selection only: '+JSON.stringify(report.filter);
  return 'Unfiltered suite';
}
