const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const petId = 'nuannuanji-student-pig';
const assetsDir = path.join(root, 'assets', petId);
const petPath = path.join(assetsDir, 'pet.json');
const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');
const trayPath = path.join(assetsDir, 'tray.png');
const iconPath = path.join(root, 'build', `${petId}-icon.ico`);
const macIconPath = path.join(root, 'build', `${petId}-icon.icns`);

const cellWidth = 192;
const cellHeight = 208;
const expectedWidth = 1536;
const expectedHeight = 2288;
const requiredRows = [
  { state: 'idle', row: 0, frames: 6 },
  { state: 'running-right', row: 1, frames: 8 },
  { state: 'running-left', row: 2, frames: 8 },
  { state: 'waving', row: 3, frames: 4 },
  { state: 'jumping', row: 4, frames: 5 },
  { state: 'failed', row: 5, frames: 8 },
  { state: 'waiting', row: 6, frames: 6 },
  { state: 'running', row: 7, frames: 6 },
  { state: 'review', row: 8, frames: 6 },
  { state: 'look-row-9', row: 9, frames: 8 },
  { state: 'look-row-10', row: 10, frames: 8 }
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

function runPython(script) {
  const candidates = [process.env.PYTHON, 'python', 'py', 'python3'].filter(Boolean);
  const failures = [];

  for (const command of candidates) {
    const args = command === 'py' ? ['-3', '-c', script] : ['-c', script];
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status === 0) {
      return;
    }
    if (result.error && result.error.code === 'ENOENT') {
      continue;
    }
    failures.push(`${command}: ${(result.stderr || result.stdout || result.error || '').toString().trim()}`);
  }

  throw new Error(`Frame content check failed${failures.length ? `: ${failures.join(' | ')}` : ': no Python interpreter found'}`);
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
            if frame.getchannel("A").getbbox() is None:
                raise SystemExit(f"{row['state']} frame {index} is empty")
print("OK")
`;

  runPython(script);
}

function main() {
  for (const filePath of [petPath, spritesheetPath, trayPath, iconPath, macIconPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${filePath}`);
    }
  }

  const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
  if (pet.id !== petId) {
    throw new Error(`Expected pet id ${petId}; found ${pet.id}`);
  }
  if (pet.displayName !== '暖暖鸡（学生小猪版）') {
    throw new Error(`Expected displayName 暖暖鸡（学生小猪版）; found ${pet.displayName}`);
  }
  if (pet.spriteVersionNumber !== 2) {
    throw new Error(`Expected spriteVersionNumber 2; found ${pet.spriteVersionNumber}`);
  }
  if (pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error(`Expected spritesheetPath spritesheet.webp; found ${pet.spritesheetPath}`);
  }

  const size = parseWebpSize(spritesheetPath);
  if (size.width !== expectedWidth || size.height !== expectedHeight) {
    throw new Error(`Expected spritesheet ${expectedWidth}x${expectedHeight}; found ${size.width}x${size.height}`);
  }

  pythonCellCheck();

  console.log(`OK: ${pet.displayName || pet.id} assets validated (${size.width}x${size.height}, v2, ${cellWidth}x${cellHeight} cells).`);
}

try {
  main();
} catch (error) {
  console.error(`Nuannuanji student pig asset validation failed: ${error.message}`);
  process.exit(1);
}
