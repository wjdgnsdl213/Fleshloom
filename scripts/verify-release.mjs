import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const projectRoot = process.cwd();
const publicRoot = join(projectRoot, 'public');
const distRoot = join(projectRoot, 'dist');
const indexPath = join(distRoot, 'index.html');

const startupArtPaths = [
  'assets/art/environment/wet-asphalt-tile-v1.png',
  'assets/art/characters/directional/carrier-directional-sheet-v2.webp',
  'assets/art/characters/directional/drifter-directional-sheet-v2.webp',
  'assets/art/loop/living-tether-tile-v2.webp',
];
const startupBudgetBytes = 6 * 1024 * 1024;
const verifiedArtHashes = new Map([
  [
    'assets/art/loop/living-tether-tile-v2.webp',
    'aa4ae87caf789c89b436514725231e1aaa085aaa90a4e197934c4d912acd0cec',
  ],
]);

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

for (const [relativePath, expectedHash] of verifiedArtHashes) {
  const path = join(publicRoot, relativePath);
  if (!existsSync(path)) {
    fail(`validated art asset is missing: ${relativePath}`);
  }
  const actualHash = createHash('sha256')
    .update(readFileSync(path))
    .digest('hex');
  if (actualHash !== expectedHash) {
    fail(
      `validated art asset changed without a new visual audit: ${relativePath}`,
    );
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

// Script budgets. The renderer backends are dynamically imported, so a player
// only ever downloads one of them; each is gated on its own rather than on
// their sum, and the boot chunk is gated separately so a backend growing
// cannot quietly be paid for out of startup.
const scriptBudgets = [
  { label: 'boot', match: /^index-[\w-]+\.js$/, gzipBudgetBytes: 64 * 1024 },
  {
    label: 'pixi backend',
    match: /^PixiRendererHost-[\w-]+\.js$/,
    gzipBudgetBytes: 56 * 1024,
  },
  {
    label: 'three backend',
    match: /^ThreeRendererHost-[\w-]+\.js$/,
    gzipBudgetBytes: 176 * 1024,
  },
];

const assetFiles = filesBelow(join(distRoot, 'assets'));
const scriptReport = [];
for (const budget of scriptBudgets) {
  const match = assetFiles.find((path) => budget.match.test(basename(path)));
  if (match === undefined) {
    fail(`no built chunk matched the ${budget.label} budget`);
  }
  const gzipBytes = gzipSync(readFileSync(match)).length;
  if (gzipBytes > budget.gzipBudgetBytes) {
    fail(
      `${budget.label} is ${(gzipBytes / 1024).toFixed(1)} KiB gzipped; ` +
        `budget is ${(budget.gzipBudgetBytes / 1024).toFixed(1)} KiB`,
    );
  }
  scriptReport.push(`${budget.label} ${(gzipBytes / 1024).toFixed(1)} KiB`);
}

const publicBytes = publicFiles.reduce(
  (total, path) => total + statSync(path).size,
  0,
);
console.log(
  `[release] verified ${publicFiles.length} public files, ` +
    `${localReferences.length} index references, ` +
    `${(startupBytes / 1024 / 1024).toFixed(2)} MiB startup art, ` +
    `${(publicBytes / 1024 / 1024).toFixed(2)} MiB total public payload, ` +
    `gzipped ${scriptReport.join(', ')}.`,
);
