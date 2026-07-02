const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const configArgIndex = args.indexOf('--config');
const distDirArgIndex = args.indexOf('--dist-dir');
const configRelativePath = configArgIndex >= 0 && args[configArgIndex + 1] ? args[configArgIndex + 1] : 'package.json';
const configPath = path.resolve(root, configRelativePath);
const distDir = path.resolve(root, distDirArgIndex >= 0 && args[distDirArgIndex + 1] ? args[distDirArgIndex + 1] : 'dist');
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

function hasGlobSyntax(filePath) {
  return /[*?[\]{}]/.test(filePath);
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

function readBuildConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Build config not found: ${configPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    label: normalizePath(path.relative(root, configPath)),
    config: parsed.build && typeof parsed.build === 'object' ? parsed.build : parsed
  };
}

function collectBuildFiles(buildConfig) {
  return Array.isArray(buildConfig.files) ? buildConfig.files : [];
}

function collectSourceTextFiles(buildFiles, configLabel) {
  const files = new Set([
    'package.json',
    'README.txt',
    configLabel,
    path.join('assets', 'pet.json'),
    path.join('assets', 'koushui-ji', 'pet.json')
  ]);

  for (const entry of buildFiles) {
    if (hasGlobSyntax(entry)) {
      continue;
    }

    const fullPath = path.join(root, entry);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && isTextFile(fullPath)) {
      files.add(entry);
    }
  }

  return [...files];
}

function scanSource(findings) {
  const { label: configLabel, config: buildConfig } = readBuildConfig();
  const buildFiles = collectBuildFiles(buildConfig);

  for (const glob of buildFiles) {
    if (riskyBuildFileGlobs.some(pattern => pattern.test(glob))) {
      findings.push({
        file: configLabel,
        detail: `risky build.files entry "${glob}" could package generation tools or local output`
      });
    }
  }

  for (const relativePath of collectSourceTextFiles(buildFiles, configLabel)) {
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
  const scanPackedDist = args.includes('--dist');
  const findings = [];

  try {
    scanSource(findings);
    if (scanPackedDist) {
      scanDist(findings);
    }
  } catch (error) {
    console.error(`Release surface check failed: ${error.message}`);
    process.exit(1);
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
