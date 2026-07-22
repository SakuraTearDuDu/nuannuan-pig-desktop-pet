const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'android', 'all-pets-apk', 'app', 'src', 'main', 'assets');
const cellWidth = 192;
const cellHeight = 208;
const atlasWidth = 1536;
const minAtlasHeight = 1872;
const pets = [
  'siyanji',
  'nuannuan-pig',
  'rebellious-burger-king',
  'koushui-ji',
  'chuanghuo-ji',
  'mini-chieftain-chicken',
  'gui-fei-ji-student-uniform-pixel',
  'nuannuanji-student-pig'
];

function assetName(petId, fileName) {
  return fileName.startsWith(`${petId}-`) ? fileName : `${petId}-${fileName}`;
}

function assetPath(petId, fileName) {
  return path.join(assetsDir, assetName(petId, fileName));
}

function parseWebpSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${path.basename(filePath)} is not a valid WEBP RIFF file.`);
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunk = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (chunk === 'VP8X') {
      return {
        width: 1 + data.readUIntLE(start + 4, 3),
        height: 1 + data.readUIntLE(start + 7, 3)
      };
    }

    if (chunk === 'VP8 ' && start + 10 <= data.length) {
      return {
        width: data.readUInt16LE(start + 6) & 0x3fff,
        height: data.readUInt16LE(start + 8) & 0x3fff
      };
    }

    if (chunk === 'VP8L' && start + 5 <= data.length) {
      const bits = data.readUInt32LE(start + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1
      };
    }

    offset = start + size + (size % 2);
  }

  throw new Error(`Unable to read ${path.basename(filePath)} dimensions.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateBasePet(petId) {
  const petPath = assetPath(petId, 'pet.json');
  const spritesheetPath = assetPath(petId, 'spritesheet.webp');
  if (!fs.existsSync(petPath)) {
    throw new Error(`Missing ${petPath}`);
  }
  if (!fs.existsSync(spritesheetPath)) {
    throw new Error(`Missing ${spritesheetPath}`);
  }

  const pet = readJson(petPath);
  if (pet.id !== petId) {
    throw new Error(`${path.basename(petPath)} id must be ${petId}; found ${pet.id}.`);
  }
  if (pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error(`${path.basename(petPath)} must point to spritesheet.webp.`);
  }

  const size = parseWebpSize(spritesheetPath);
  if (size.width !== atlasWidth || size.height < minAtlasHeight || size.height % cellHeight !== 0) {
    throw new Error(`${path.basename(spritesheetPath)} must be ${atlasWidth} wide and at least ${minAtlasHeight} high; found ${size.width}x${size.height}.`);
  }
  return size;
}

function validateManifest(manifestPath, spritesheetPath, rowsKey) {
  const manifest = readJson(manifestPath);
  if (manifest.cellWidth !== cellWidth || manifest.cellHeight !== cellHeight) {
    throw new Error(`${path.basename(manifestPath)} must use ${cellWidth}x${cellHeight} cells.`);
  }
  if (!Number.isInteger(manifest.columns) || manifest.columns < 1) {
    throw new Error(`${path.basename(manifestPath)} must declare a positive columns value.`);
  }
  const rows = manifest[rowsKey];
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error(`${path.basename(manifestPath)} must contain ${rowsKey}.`);
  }
  for (const row of rows) {
    if (!row.id || !row.label || !Number.isInteger(row.row) || !Number.isInteger(row.frames)) {
      throw new Error(`${path.basename(manifestPath)} contains incomplete action metadata.`);
    }
  }

  const size = parseWebpSize(spritesheetPath);
  const expectedWidth = cellWidth * manifest.columns;
  const expectedRows = rowsKey === 'actions'
    ? Math.max(...rows.map(row => row.row + (row.rowCount || Math.ceil(row.frames / manifest.columns))))
    : rows.length;
  const expectedHeight = cellHeight * expectedRows;
  if (size.width !== expectedWidth || size.height < expectedHeight) {
    throw new Error(`${path.basename(spritesheetPath)} dimensions do not match ${path.basename(manifestPath)}.`);
  }
}

function main() {
  const sizes = pets.map(petId => ({ petId, size: validateBasePet(petId) }));
  validateManifest(
    assetPath('siyanji', 'siyanji-extra-actions.json'),
    assetPath('siyanji', 'siyanji-extra-actions.webp'),
    'rows'
  );
  validateManifest(
    assetPath('siyanji', 'siyanji-long-actions.json'),
    assetPath('siyanji', 'siyanji-long-actions.webp'),
    'actions'
  );

  const summary = sizes.map(({ petId, size }) => `${petId}:${size.width}x${size.height}`).join(', ');
  console.log(`OK: 大湾鸡总动员 assets validated (${summary}).`);
}

try {
  main();
} catch (error) {
  console.error(`All-pets asset validation failed: ${error.message}`);
  process.exit(1);
}
