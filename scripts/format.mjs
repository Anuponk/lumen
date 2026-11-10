import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as prettier from 'prettier';

const root = new URL('../', import.meta.url);
const scope = JSON.parse(await readFile(new URL('format-scope.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
  throw Error('Usage: node scripts/format.mjs --check|--write');
}
const options = JSON.parse(await readFile(new URL('.prettierrc.json', root), 'utf8'));
function syntax(source) {
  return JSON.stringify(
    parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    (key, value) => {
      if (['start', 'end', 'raw'].includes(key)) return undefined;
      return typeof value === 'bigint' ? value.toString() : value;
    },
  );
}
const mismatches = [];
for (const path of scope) {
  // A reviewed allowlist keeps this rollout separate from immutable data and
  // modules with historical source-text assertions. Never traverse generated data.
  if (!/^(src\/ui\/[^/]+\.js|scripts\/[^/]+\.mjs)$/.test(path)) {
    throw Error('Unsupported format scope: ' + path);
  }
  const file = new URL(path, root);
  const before = await readFile(file, 'utf8');
  const after = await prettier.format(before, { ...options, filepath: fileURLToPath(file) });
  if (syntax(before) !== syntax(after)) throw Error('Formatting changes syntax: ' + path);
  if (before !== after) {
    mismatches.push(path);
    if (args[0] === '--write') await writeFile(file, after);
  }
}
if (mismatches.length && args[0] === '--check') {
  console.error('Run npm run format for:\n' + mismatches.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Formatting ${args[0]} passed: ${scope.length} files; syntax preserved`);
}
