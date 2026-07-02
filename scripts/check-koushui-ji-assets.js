const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets', 'koushui-ji');
const petPath = path.join(assetsDir, 'pet.json');
const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');
const trayPath = path.join(assetsDir, 'tray.png');
const iconPath = path.join(root, 'build', 'koushui-ji-icon.ico');

const cellWidth = 192;
const cellHeight = 208;
const expectedWidth = 1536;
const expectedHeight = 1872;
const requiredRows = [
  { state: 'idle', row: 0, frames: 6 },
  { state: 'running-right', row: 1, frames: 8 },
  { state: 'running-left', row: 2, frames: 8 },
  { state: 'waving', row: 3, frames: 4 },
  { state: 'jumping', row: 4, frames: 5 },
  { state: 'failed', row: 5, frames: 8 },
  { state: 'waiting', row: 6, frames: 6 },
  { state: 'running', row: 7, frames: 6 },
  { state: 'review', row: 8, frames: 6 }
];

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

function pythonCellCheck() {
  const rowsJson = JSON.stringify(requiredRows);
  const script = `
from pathlib import Path
from PIL import Image
import json

asset_path = Path(r"${spritesheetPath.replace(/\\/g, '\\\\')}")
rows = json.loads(r'''${rowsJson}''')
cell_width = ${cellWidth}
cell_height = ${cellHeight}
with Image.open(asset_path) as image:
    image = image.convert("RGBA")
    for row in rows:
        for index in range(row["frames"]):
            box = (index * cell_width, row["row"] * cell_height, (index + 1) * cell_width, (row["row"] + 1) * cell_height)
            frame = image.crop(box)
            alpha = frame.getchannel("A")
            if alpha.getbbox() is None:
                raise SystemExit(f"{row['state']} frame {index} is empty")
print("OK")
`;

  const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', script], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(`Frame content check failed${details ? `: ${details}` : ''}`);
  }
}

function main() {
  for (const filePath of [petPath, spritesheetPath, trayPath, iconPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${filePath}`);
    }
  }

  const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
  if (pet.id !== 'koushui-ji') {
    throw new Error(`Expected pet id koushui-ji; found ${pet.id}`);
  }
  if (pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error(`Expected spritesheetPath spritesheet.webp; found ${pet.spritesheetPath}`);
  }

  const size = parseWebpSize(spritesheetPath);
  if (size.width !== expectedWidth || size.height !== expectedHeight) {
    throw new Error(`Expected spritesheet ${expectedWidth}x${expectedHeight}; found ${size.width}x${size.height}`);
  }

  pythonCellCheck();

  console.log(`OK: ${pet.displayName || pet.id} assets validated (${size.width}x${size.height}, ${cellWidth}x${cellHeight} cells).`);
}

try {
  main();
} catch (error) {
  console.error(`Koushui Ji asset validation failed: ${error.message}`);
  process.exit(1);
}
