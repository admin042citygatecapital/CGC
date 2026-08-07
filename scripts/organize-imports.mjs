import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) throw new Error('tsconfig.json not found');

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
const errorLogPath = path.join(root, 'typecheck.log');
const errorLogBuffer = fs.existsSync(errorLogPath) ? fs.readFileSync(errorLogPath) : Buffer.alloc(0);
const errorLog = errorLogBuffer[0] === 0xff && errorLogBuffer[1] === 0xfe
  ? errorLogBuffer.subarray(2).toString('utf16le')
  : errorLogBuffer.toString('utf8');
const relativeTargets = new Set(
  [...errorLog.matchAll(/^(.+?)\(\d+,\d+\): error TS6133:/gm)].map(match => match[1].replaceAll('\\', '/')),
);
const targets = parsed.fileNames.filter(fileName =>
  relativeTargets.has(path.relative(root, fileName).replaceAll('\\', '/')),
);
const versions = new Map(targets.map(fileName => [fileName, '0']));
const host = {
  getCompilationSettings: () => parsed.options,
  getScriptFileNames: () => targets,
  getScriptVersion: fileName => versions.get(fileName) ?? '0',
  getScriptSnapshot: fileName => {
    if (!fs.existsSync(fileName)) return undefined;
    return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, 'utf8'));
  },
  getCurrentDirectory: () => root,
  getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());
let changed = 0;

for (const fileName of targets) {
  const edits = service.organizeImports({ type: 'file', fileName }, {}, {});
  if (edits.length === 0) continue;
  let text = fs.readFileSync(fileName, 'utf8');
  const changes = edits.flatMap(edit => edit.textChanges).sort((a, b) => b.span.start - a.span.start);
  for (const change of changes) {
    text = text.slice(0, change.span.start) + change.newText + text.slice(change.span.start + change.span.length);
  }
  fs.writeFileSync(fileName, text, 'utf8');
  versions.set(fileName, String(Number(versions.get(fileName) ?? '0') + 1));
  changed++;
}

console.log(`Organized imports in ${changed} files.`);
