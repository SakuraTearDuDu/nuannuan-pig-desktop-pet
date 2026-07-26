const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const petId = 'tiaowuji';
const assetsDir = path.join(root, 'assets', petId);
const petPath = path.join(assetsDir, 'pet.json');
const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');
const trayPath = path.join(assetsDir, 'tray.png');
const iconPath = path.join(root, 'build', `${petId}-icon.ico`);
const macIconPath = path.join(root, 'build', `${petId}-icon.icns`);

const expectedWidth = 1536;
const expectedHeight = 2288;

function parseWebpSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('WEBP file is invalid.');
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunk = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (chunk === 'VP8X') {
      return {
        width: 1 + data.readUIntLE(start + 4, 3),
        height: 1 + data.readUIntLE(start + 7, 3),
      };
    }

    if (chunk === 'VP8 ' && start + 10 <= data.length) {
      return {
        width: data.readUInt16LE(start + 6) & 0x3fff,
        height: data.readUInt16LE(start + 8) & 0x3fff,
      };
    }

    if (chunk === 'VP8L' && start + 5 <= data.length) {
      const bits = data.readUInt32LE(start + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    offset = start + size + (size % 2);
  }

  throw new Error('Unable to read WEBP dimensions.');
}

function main() {
  for (const filePath of [petPath, spritesheetPath, trayPath, iconPath, macIconPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${filePath}`);
    }
  }

  const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
  if (pet.id !== petId) throw new Error(`Expected pet id ${petId}; found ${pet.id}`);
  if (pet.displayName !== '跳舞鸡') throw new Error(`Expected displayName 跳舞鸡; found ${pet.displayName}`);
  if (pet.spriteVersionNumber !== 2) throw new Error(`Expected spriteVersionNumber 2; found ${pet.spriteVersionNumber}`);
  if (pet.spritesheetPath !== 'spritesheet.webp') throw new Error(`Expected spritesheetPath spritesheet.webp; found ${pet.spritesheetPath}`);

  const size = parseWebpSize(spritesheetPath);
  if (size.width !== expectedWidth || size.height !== expectedHeight) {
    throw new Error(`Expected spritesheet ${expectedWidth}x${expectedHeight}; found ${size.width}x${size.height}`);
  }

  console.log(`OK: ${pet.displayName} assets validated (${size.width}x${size.height}, v${pet.spriteVersionNumber}).`);
}

try {
  main();
} catch (error) {
  console.error(`Tiaowuji asset validation failed: ${error.message}`);
  process.exit(1);
}
