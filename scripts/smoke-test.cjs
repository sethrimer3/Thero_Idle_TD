const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const requiredFiles = [
  'index.html',
  'assets/main.js',
  'assets/playfield.js',
  'assets/configuration.js',
  'assets/data/gameplayConfig.json',
  'assets/data/achievements.json',
  'assets/data/fieldNotes.json',
  'assets/data/towers/index.js',
  'scripts/core/formatting.js',
  'scripts/core/mathText.js',
  'scripts/features/towers/TOWER_INDEX.md',
];

const importRoots = [
  'assets/main.js',
  'assets/playfield.js',
  'assets/configuration.js',
  'assets/towersTab.js',
  'assets/levelGridController.js',
  'assets/playfield/controllers/TowerOrchestrationController.js',
  'assets/data/towers/index.js',
];

const failures = [];

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function assertFileExists(relativePath, reason) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    failures.push(`${relativePath} is missing${reason ? ` (${reason})` : ''}.`);
  }
}

function assertPathExists(relativePath, reason) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing${reason ? ` (${reason})` : ''}.`);
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function resolveModulePath(fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const fromDir = path.dirname(path.join(rootDir, fromFile));
  const resolved = path.resolve(fromDir, specifier);
  const candidates = path.extname(resolved)
    ? [resolved]
    : [`${resolved}.js`, `${resolved}.json`, path.join(resolved, 'index.js')];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function collectStaticImports(source) {
  const imports = [];
  const importFromPattern = /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const exportFromPattern = /\bexport\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [importFromPattern, exportFromPattern, dynamicImportPattern]) {
    let match = pattern.exec(source);
    while (match) {
      imports.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return imports;
}

// Recursively walks static imports starting from `relativePath`, validating that every
// local (relative) specifier resolves to a file on disk. Non-JS resolved targets (e.g.
// .json) are checked for existence but not parsed/recursed into.
function assertStaticImportsResolve(relativePath, visited = new Set()) {
  if (visited.has(relativePath)) {
    return;
  }
  visited.add(relativePath);

  const cleanSource = stripComments(readText(relativePath));
  for (const specifier of collectStaticImports(cleanSource)) {
    const resolved = resolveModulePath(relativePath, specifier);
    if (!resolved) {
      continue;
    }
    if (!fs.existsSync(resolved)) {
      const resolvedRelative = toPosixPath(path.relative(rootDir, resolved));
      failures.push(`${relativePath} imports ${specifier}, but ${resolvedRelative} does not exist.`);
      continue;
    }
    if (resolved.endsWith('.js')) {
      const resolvedRelative = toPosixPath(path.relative(rootDir, resolved));
      assertStaticImportsResolve(resolvedRelative, visited);
    }
  }
}

for (const relativePath of requiredFiles) {
  assertFileExists(relativePath, 'required startup or core configuration file');
}

const indexHtml = readText('index.html');
if (!/<script\b[^>]*type=["']module["'][^>]*src=["']\.\/assets\/main\.js["'][^>]*><\/script>/i.test(indexHtml)) {
  failures.push('index.html does not include the expected module entry ./assets/main.js.');
}

const startupReferences = [
  './assets/styles.css',
  './assets/favicon/favicon.ico',
  './assets/favicon/favicon-32x32.png',
  './assets/favicon/favicon-16x16.png',
  './assets/favicon/apple-touch-icon.png',
  './assets/sprites/logo/gravy_thyme_logo.webp',
  './assets/animations/menuBackground_animation.webp',
];

for (const reference of startupReferences) {
  assertPathExists(reference.replace(/^\.\//, ''), 'referenced by index.html startup markup');
}

for (const relativePath of importRoots) {
  assertFileExists(relativePath, 'import root');
  if (fs.existsSync(path.join(rootDir, relativePath))) {
    assertStaticImportsResolve(relativePath);
  }
}

if (failures.length > 0) {
  console.error('Smoke test failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Smoke test passed: ${requiredFiles.length} required files, ${startupReferences.length} startup assets, and ${importRoots.length} import roots (recursively) checked.`);
