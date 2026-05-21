const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const entriesToCopy = ['index.html', 'assets', 'scripts'];

function copyEntry(name) {
  const source = path.join(rootDir, name);
  const target = path.join(distDir, name);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing required build entry: ${name}`);
  }

  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of entriesToCopy) {
  copyEntry(entry);
}

console.log(`Static build copied ${entriesToCopy.join(', ')} to dist/.`);
