const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const petPath = path.join(assetsDir, 'pet.json');
const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');

function parseWebpSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('spritesheet.webp is not a valid WEBP RIFF file.');
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

  throw new Error('Unable to read WEBP dimensions.');
}

function main() {
  if (!fs.existsSync(petPath)) {
    throw new Error(`Missing ${petPath}`);
  }
  if (!fs.existsSync(spritesheetPath)) {
    throw new Error(`Missing ${spritesheetPath}`);
  }

  const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
  if (pet.id !== 'dudu') {
    throw new Error(`Expected pet id dudu; found ${pet.id}`);
  }
  if (pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error(`Expected spritesheetPath spritesheet.webp; found ${pet.spritesheetPath}`);
  }

  const size = parseWebpSize(spritesheetPath);
  if (size.width !== 1536 || size.height !== 1872) {
    throw new Error(`Expected spritesheet 1536x1872; found ${size.width}x${size.height}`);
  }

  console.log(`OK: ${pet.displayName || pet.id} assets validated (${size.width}x${size.height}).`);
}

try {
  main();
} catch (error) {
  console.error(`Asset validation failed: ${error.message}`);
  process.exit(1);
}
