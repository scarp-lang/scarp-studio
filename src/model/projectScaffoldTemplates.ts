/** Fixed starter programs; user input is never interpolated into code. */
export interface ScaffoldTemplateFile {
  readonly path:string;
  readonly content:string;
}
export interface ScaffoldTemplate {
  readonly id:string;
  readonly title:string;
  readonly description:string;
  readonly sourceFiles:readonly ScaffoldTemplateFile[];
  readonly testFiles:readonly ScaffoldTemplateFile[];
}
const file=(path:string,lines:readonly string[]):ScaffoldTemplateFile=>Object.freeze({path,content:lines.join('\n')+'\n'});
const templates:ScaffoldTemplate[]=[
  {id:'hello',title:'Hello application',description:'A standalone application and optional assertion smoke test.',
    sourceFiles:[file('src/main.srp',['// Start your Scarp application here.','print("Hello, Scarp!");'])],
    testFiles:[file('tests/smoke.srp',['assert(2 + 3 == 5);'])]},
  {id:'calculator',title:'Modular calculator',description:'Public typed functions, imports and tests of shared implementation.',
    sourceFiles:[
      file('src/main.srp',['import "math.srp" as math;','','print(math.add(2, 3));','print(math.multiply(4, 5));']),
      file('src/math.srp',[
        'pub pure funcra add(a: integer, b: integer) -> integer {','    return a + b;','}','',
        'pub pure funcra subtract(a: integer, b: integer) -> integer {','    return a - b;','}','',
        'pub pure funcra multiply(a: integer, b: integer) -> integer {','    return a * b;','}']),
    ],
    testFiles:[
      file('tests/arithmetic.srp',['import "../src/math.srp" as math;','','assert(math.add(2, 3) == 5);',
        'assert(math.subtract(2, 5) == -3);','assert(math.multiply(-2, 3) == -6);']),
      file('tests/identity.srp',['import "../src/math.srp" as math;','assert(math.add(9, 0) == 9);','assert(math.multiply(9, 1) == 9);']),
    ]},
  {id:'counter',title:'State and loops',description:'A typed helper, counted loop and mutable state.',
    sourceFiles:[
      file('src/main.srp',['import "count.srp" as count;','','var total: integer = 0;','repeat 5 as index {','    total += count.square(index);','}','print(total);']),
      file('src/count.srp',['pub pure funcra square(value: integer) -> integer {','    return value * value;','}']),
    ],
    testFiles:[file('tests/squares.srp',['import "../src/count.srp" as count;','assert(count.square(0) == 0);','assert(count.square(-3) == 9);'])]},
  {id:'input',title:'Console input',description:'Read Program Input and test a reusable text function.',
    sourceFiles:[
      file('src/main.srp',['import "greeting.srp" as greeting;','','// Preload a name in Program Input before Run.',
        'bind name: string = read_line();','print(greeting.message(name));']),
      file('src/greeting.srp',['pub pure funcra message(name: string) -> string {','    return "Hello, " + name;','}']),
    ],
    testFiles:[file('tests/greeting.srp',['import "../src/greeting.srp" as greeting;',
      'assert(greeting.message("Scarp") == "Hello, Scarp");','assert(greeting.message("नमस्ते") == "Hello, नमस्ते");'])]},
];
export const PROJECT_SCAFFOLD_TEMPLATES:readonly ScaffoldTemplate[]=Object.freeze(templates.map(template=>Object.freeze({
  ...template,sourceFiles:Object.freeze(template.sourceFiles),testFiles:Object.freeze(template.testFiles),
})));
export function scaffoldTemplate(id:string):ScaffoldTemplate|null{
  return PROJECT_SCAFFOLD_TEMPLATES.find(template=>template.id===id)??null;
}
/** Callers validate manifest values first. Quote visible Unicode safely. */
export function scaffoldManifest(name:string,version:string):string{
  return 'project '+JSON.stringify(name)+' {\n    version: '+JSON.stringify(version)+
    '\n    entry: "src/main.srp"\n    type: "application"\n}\n';
}
