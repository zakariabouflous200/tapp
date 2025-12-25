const fs = require('fs');
const path = require('path');

const targetDirs = ['.', './cmds', './events'];
const allowedExtensions = ['.js'];
const excludedDirs = ['node_modules', '.git', 'sqlite', 'database', 'data'];

let totalLines = 0;

console.log('\n📊 Line Count per File:\n');

function countLinesInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').length;
}

function scanDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludedDirs.includes(entry)) {
        scanDirectory(fullPath);
      }
    } else if (allowedExtensions.includes(path.extname(entry))) {
      const lineCount = countLinesInFile(fullPath);
      totalLines += lineCount;
      console.log(`📄 ${path.relative('.', fullPath)}: ${lineCount} lines`);
    }
  }
}

for (const dir of targetDirs) {
  scanDirectory(path.resolve(dir));
}

console.log(`\n✅ Total lines across project (excluding node_modules): ${totalLines} lines\n`);
