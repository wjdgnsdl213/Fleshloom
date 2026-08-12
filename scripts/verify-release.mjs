import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const projectRoot = process.cwd();
const publicRoot = join(projectRoot, 'public');
const distRoot = join(projectRoot, 'dist');
const indexPath = join(distRoot, 'index.html');

const startupArtPaths = [
  'assets/art/environment/wet-asphalt-tile-v1.png',
  'assets/art/characters/carrier-09.png',
  'assets/art/characters/drifter.png',
  'assets/art/loop/living-tether-tile.png',
];
const startupBudgetBytes = 6 * 1024 * 1024;

function fail(message) {
  throw new Error(`[release] ${message}`);
}

function filesBelow(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

if (!existsSync(indexPath)) {
  fail('dist/index.html is missing. Run the production build first.');
}

const publicFiles = filesBelow(publicRoot).filter(
  (path) => !path.endsWith('.gitkeep'),
);
for (const sourcePath of publicFiles) {
  const relativePath = relative(publicRoot, sourcePath);
  const outputPath = join(distRoot, relativePath);
  if (!existsSync(outputPath)) {
    fail(`public asset was not copied to dist: ${relativePath}`);
  }
  if (statSync(sourcePath).size > 0 && statSync(outputPath).size === 0) {
    fail(`copied public asset is empty: ${relativePath}`);
  }
}

const indexHtml = readFileSync(indexPath, 'utf8');
const localReferences = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter(
    (reference) =>
      reference !== undefined &&
      !/^(?:[a-z]+:|\/\/|#)/i.test(reference),
  );

for (const reference of localReferences) {
  if (reference.startsWith('/')) {
    fail(`root-absolute index reference breaks sub-path hosting: ${reference}`);
  }

  const outputPath = resolve(dirname(indexPath), reference);
  if (!outputPath.startsWith(distRoot) || !existsSync(outputPath)) {
    fail(`index references a missing or unsafe file: ${reference}`);
  }
}

for (const bundlePath of filesBelow(join(distRoot, 'assets')).filter((path) =>
  path.endsWith('.js'),
)) {
  const bundle = readFileSync(bundlePath, 'utf8');
  if (bundle.includes('"/assets/art/') || bundle.includes("'/assets/art/")) {
    fail(`bundle contains a root-absolute art URL: ${relative(distRoot, bundlePath)}`);
  }
}

const startupBytes = startupArtPaths.reduce((total, relativePath) => {
  const path = join(publicRoot, relativePath);
  if (!existsSync(path)) {
    fail(`startup asset is missing: ${relativePath}`);
  }
  return total + statSync(path).size;
}, 0);
if (startupBytes > startupBudgetBytes) {
  fail(
    `startup art is ${(startupBytes / 1024 / 1024).toFixed(2)} MiB; ` +
      `budget is ${(startupBudgetBytes / 1024 / 1024).toFixed(2)} MiB`,
  );
}

const publicBytes = publicFiles.reduce(
  (total, path) => total + statSync(path).size,
  0,
);
console.log(
  `[release] verified ${publicFiles.length} public files, ` +
    `${localReferences.length} index references, ` +
    `${(startupBytes / 1024 / 1024).toFixed(2)} MiB startup art, ` +
    `${(publicBytes / 1024 / 1024).toFixed(2)} MiB total public payload.`,
);
