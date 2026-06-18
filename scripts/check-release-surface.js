const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const sourceTextFiles = [
  'package.json',
  'README.txt',
  path.join('assets', 'pet.json')
];
const sourceDirs = ['src'];
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.cjs',
  '.txt'
]);

const forbiddenText = [
  { label: 'image_gen tool name', pattern: /\bimage[_-]?gen\b/i },
  { label: 'generated image function name', pattern: /\bgenerate[_-]?image\b/i },
  { label: 'OpenAI image API call', pattern: /\bimages\.generate\b/i },
  { label: 'GPT image model', pattern: /\bgpt-image(?:-\d+)?\b/i },
  { label: 'DALL-E model/API', pattern: /\bdall[-_ ]?e\b/i },
  { label: 'OpenAI SDK/API reference', pattern: /\bopenai\b/i },
  { label: 'MCP tool exposure', pattern: /\bmcp\b/i },
  { label: 'OpenAI API key reference', pattern: /\bOPENAI_API_KEY\b/i },
  { label: 'Bearer token header', pattern: /\bauthorization\s*:\s*bearer\b/i }
];

const forbiddenPackagedPaths = [
  /(^|\/)scripts(\/|$)/i,
  /(^|\/)output(\/|$)/i,
  /(^|\/)media(\/|$)/i,
  /(^|\/)\.env($|\.)/i,
  /(^|\/)\.codex(\/|$)/i
];

const riskyBuildFileGlobs = [
  /^\.?$/,
  /^\*\*\/\*$/,
  /^scripts(\/|$)/i,
  /^output(\/|$)/i,
  /^media(\/|$)/i,
  /^\.env($|\.)/i,
  /^\.codex(\/|$)/i
];

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isTextFile(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function walkFiles(startPath) {
  if (!fs.existsSync(startPath)) {
    return [];
  }

  const stat = fs.statSync(startPath);
  if (stat.isFile()) {
    return [startPath];
  }

  const files = [];
  for (const entry of fs.readdirSync(startPath, { withFileTypes: true })) {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function scanText(relativePath, text, findings) {
  for (const rule of forbiddenText) {
    const match = rule.pattern.exec(text);
    if (match) {
      findings.push({
        file: relativePath,
        detail: `${rule.label} at line ${lineNumberFor(text, match.index)}`
      });
    }
  }
}

function scanSource(findings) {
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const buildFiles = packageJson.build && Array.isArray(packageJson.build.files) ? packageJson.build.files : [];

  for (const glob of buildFiles) {
    if (riskyBuildFileGlobs.some(pattern => pattern.test(glob))) {
      findings.push({
        file: 'package.json',
        detail: `risky build.files entry "${glob}" could package generation tools or local output`
      });
    }
  }

  for (const relativePath of sourceTextFiles) {
    const fullPath = path.join(root, relativePath);
    if (fs.existsSync(fullPath)) {
      scanText(normalizePath(relativePath), fs.readFileSync(fullPath, 'utf8'), findings);
    }
  }

  for (const dir of sourceDirs) {
    for (const fullPath of walkFiles(path.join(root, dir))) {
      if (!isTextFile(fullPath)) {
        continue;
      }
      const relativePath = normalizePath(path.relative(root, fullPath));
      scanText(relativePath, fs.readFileSync(fullPath, 'utf8'), findings);
    }
  }
}

function collectAsarFiles() {
  return walkFiles(distDir).filter(file => path.basename(file).toLowerCase() === 'app.asar');
}

function scanDist(findings) {
  const asarFiles = collectAsarFiles();
  if (asarFiles.length === 0) {
    console.log('No packaged app.asar archives found under dist; skipping dist archive scan.');
    return;
  }

  const asar = require('@electron/asar');
  for (const archivePath of asarFiles) {
    const archiveLabel = normalizePath(path.relative(root, archivePath));
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dudu-release-surface-'));

    try {
      asar.extractAll(archivePath, tempDir);

      for (const fullPath of walkFiles(tempDir)) {
        const entryPath = normalizePath(path.relative(tempDir, fullPath));
        if (forbiddenPackagedPaths.some(pattern => pattern.test(entryPath))) {
          findings.push({
            file: `${archiveLabel}:${entryPath}`,
            detail: 'forbidden packaged path'
          });
        }

        if (!isTextFile(entryPath)) {
          continue;
        }

        const text = fs.readFileSync(fullPath, 'utf8');
        scanText(`${archiveLabel}:${entryPath}`, text, findings);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

function main() {
  const scanPackedDist = process.argv.includes('--dist');
  const findings = [];

  scanSource(findings);
  if (scanPackedDist) {
    scanDist(findings);
  }

  if (findings.length > 0) {
    console.error('Release surface check failed:');
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.detail}`);
    }
    process.exit(1);
  }

  console.log(scanPackedDist
    ? 'OK: release source and packaged app.asar contain no image generation tool surface.'
    : 'OK: release source contains no image generation tool surface.');
}

main();
