import type { StudioDocument } from '../../src/model/documents';
import type { ProjectSearchSource } from '../../src/model/projectSearch';
import { utf8ByteLength } from '../../src/model/utf8Text';

export const ROOT = '/fixture-private/workspace';
export const QUERY = 'needle';
export const SECRET = 'fixture-private-source-context';
export const DENSE_LABEL = 'src/a-dense.srp';
export const BUFFER_LABEL = 'src/b-buffer.srp';
export const FAILED_LABEL = 'src/c-unavailable.srp';
export const FIRST_LABEL = 'src/d-empty.srp';
export const SECOND_LABEL = 'src/e-later.srp';
export const NESTED_LABEL = 'src/nested/f-unicode.srp';
export const LAST_LABEL = 'tests/z-last.srp';

interface FixtureFile extends ProjectSearchSource {
  readonly content: string;
}

export interface FixtureWorkspace {
  readonly files: readonly FixtureFile[];
  readonly unavailable: readonly string[];
  readonly documents: readonly StudioDocument[];
}

function file(name: string, content: string): FixtureFile {
  return Object.freeze({ name, path: ROOT + '/' + name, content });
}

export function createFixture(): FixtureWorkspace {
  const dense = Array.from({ length: 27 }, (_, index) =>
    '// ' + SECRET + ' line ' + (index + 1) + ' needle').join('\n');
  const files = Object.freeze([
    file(DENSE_LABEL, dense),
    file(BUFFER_LABEL, '// disk needle'),
    file(FAILED_LABEL, '// unavailable needle'),
    file(FIRST_LABEL, '// no matches here'),
    file(SECOND_LABEL, '// later needle'),
    file(NESTED_LABEL, '// 😀 needle\r\n// NEEDLE\r// needleSuffix'),
    file(LAST_LABEL, '// test needle'),
  ]);
  return Object.freeze({
    files,
    unavailable: Object.freeze([FAILED_LABEL]),
    documents: Object.freeze([{
      id: 'fixture-open-buffer',
      name: BUFFER_LABEL,
      path: ROOT + '/' + BUFFER_LABEL,
      content: '// buffer needle\n// buffer needle',
      savedContent: '// disk needle',
      revision: 1,
    }]),
  });
}

export function listedSources(workspace: FixtureWorkspace): readonly ProjectSearchSource[] {
  return workspace.files.map(({ name, path }) => ({ name, path }));
}

export function editBuffer(workspace: FixtureWorkspace): FixtureWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map(document => ({
      ...document,
      content: document.content + '\n// added needle',
      revision: document.revision + 1,
    })),
  };
}

export function addFixtureTask(workspace: FixtureWorkspace): FixtureWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map(document => ({
      ...document,
      content: document.content + '\n// TODO(privateOwner): fixture-private-task  ',
      revision: document.revision + 1,
    })),
  };
}

export function recoverFile(workspace: FixtureWorkspace): FixtureWorkspace {
  return { ...workspace, unavailable: [] };
}

export function addListedFile(workspace: FixtureWorkspace): FixtureWorkspace {
  const name = 'src/aa-new.srp';
  if (workspace.files.some(item => item.name === name)) return workspace;
  return { ...workspace, files: [...workspace.files, file(name, '// new needle')] };
}

export function removeDenseFile(workspace: FixtureWorkspace): FixtureWorkspace {
  return { ...workspace, files: workspace.files.filter(item => item.name !== DENSE_LABEL) };
}

export interface FixtureReader {
  readonly read: (path: string, maxBytes: number) => Promise<string>;
  readonly paths: () => readonly string[];
}

/** The test reader only accepts exact fixture paths and logs every attempted
 * read. No Tauri mock, host bridge, network request or filesystem access. */
export function createFixtureReader(
  workspace: FixtureWorkspace,
  pause: () => Promise<void> = async () => {},
): FixtureReader {
  const paths: string[] = [];
  return {
    paths: () => [...paths],
    async read(path, maxBytes) {
      paths.push(path);
      await pause();
      const entry = workspace.files.find(item => item.path === path);
      if (!entry || workspace.unavailable.includes(entry.name)) {
        throw new Error('Synthetic reader refusal: ' + path);
      }
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
          utf8ByteLength(entry.content) > maxBytes) {
        throw new Error('Synthetic byte limit');
      }
      return entry.content;
    },
  };
}


export const LEXICAL_ENTRY='src/a-entry.srp';
export const LEXICAL_HELPER='src/b-helper.srp';
export const LEXICAL_LEAF='src/c-leaf.srp';
export const LEXICAL_UNAVAILABLE='src/d-unavailable.srp';
export const LEXICAL_CASE='src/f-case.srp';
export const LEXICAL_TEST='tests/e-check.srp';
export const LEXICAL_SECRET='fixture-private-function-body';
export function createLexicalFixture():FixtureWorkspace{
  const helperSaved='pub funcra helper(x: integer) -> integer { leaf(); return x; }\n';
  const helperWorking='pub funcra helper(x: integer) -> integer { leaf(); leaf(); return x; }\n';
  return Object.freeze({
    files:Object.freeze([
      file(LEXICAL_ENTRY,'pub funcra start(x: integer) -> integer { helper(); helper(); twin(); missing(); return x; }\nfuncra twin() {}\n'),
      file(LEXICAL_HELPER,helperSaved),
      file(LEXICAL_LEAF,'pub funcra leaf() { helper(); }\nfuncra twin() {}\nfuncra self() { self(); }\n'),
      file(LEXICAL_UNAVAILABLE,'funcra hidden() { helper(); }\n'),
      file(LEXICAL_CASE,'Helper(); module.helper(); bind typed: helper = 0; helper += 1;\n'),
      file(LEXICAL_TEST,'start(1); helper();\n// helper();\nbind label = "helper";\n// '+LEXICAL_SECRET+'\n'),
    ]),
    unavailable:Object.freeze([LEXICAL_UNAVAILABLE]),
    documents:Object.freeze([{
      id:'fixture-lexical-helper',name:LEXICAL_HELPER,path:ROOT+'/'+LEXICAL_HELPER,
      content:helperWorking,savedContent:helperSaved,revision:1,
    }]),
  });
}
export function changeLexicalInterface(workspace:FixtureWorkspace):FixtureWorkspace{
  return {...workspace,documents:workspace.documents.map(document=>document.name===LEXICAL_HELPER?
    {...document,content:document.content.replace('x: integer','x: float'),revision:document.revision+1}:document)};
}
export function shiftLexicalLocation(workspace:FixtureWorkspace):FixtureWorkspace{
  return {...workspace,documents:workspace.documents.map(document=>document.name===LEXICAL_HELPER?
    {...document,content:'// shifted location\n'+document.content,revision:document.revision+1}:document)};
}
export function failLexicalLeaf(workspace:FixtureWorkspace):FixtureWorkspace{
  return {...workspace,unavailable:[...new Set([...workspace.unavailable,LEXICAL_LEAF])]};
}
export function removeLexicalEntry(workspace:FixtureWorkspace):FixtureWorkspace{
  return {...workspace,files:workspace.files.filter(item=>item.name!==LEXICAL_ENTRY)};
}
