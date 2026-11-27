// TypeScript → 브라우저용 JS. npm 없이 Node 내장 type stripping만 쓴다.
//   node build.mjs      (src/*.ts → js/*.js)
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const root = import.meta.dirname, src = join(root, 'src'), out = join(root, 'js');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
for (const file of walk(src).filter((p) => p.endsWith('.ts'))) {
  const js = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' })
    .replace(/(from\s+['"]\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1.js$2');
  const dest = join(out, relative(src, file)).replace(/\.ts$/, '.js');
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, js);
  console.log('built', relative(root, dest));
}
