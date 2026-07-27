const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const petId = 'caishen-ji';
const assetsDir = path.join(root, 'assets', petId);
const petPath = path.join(assetsDir, 'pet.json');
const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');
const trayPath = path.join(assetsDir, 'tray.png');
const iconPath = path.join(root, 'build', `${petId}-icon.ico`);
const pngIconPath = path.join(root, 'build', `${petId}-icon.png`);
const macIconPath = path.join(root, 'build', `${petId}-icon.icns`);
const expectedSha256 = 'edcb1279171d730da7f93b566d201cf957d602f9f7444940f7dce8b99d213517';
const cellWidth = 192;
const cellHeight = 208;
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
    throw new Error('spritesheet.webp is not a valid WEBP RIFF file.');
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunk = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (chunk === 'VP8X') {
      return { width: 1 + data.readUIntLE(start + 4, 3), height: 1 + data.readUIntLE(start + 7, 3) };
    }
    if (chunk === 'VP8 ' && start + 10 <= data.length) {
      return { width: data.readUInt16LE(start + 6) & 0x3fff, height: data.readUInt16LE(start + 8) & 0x3fff };
    }
    if (chunk === 'VP8L' && start + 5 <= data.length) {
      const bits = data.readUInt32LE(start + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    offset = start + size + (size % 2);
  }
  throw new Error('Unable to read spritesheet.webp dimensions.');
}

function checkUsedCells() {
  const script = [
    'from pathlib import Path',
    'from PIL import Image',
    'import json',
    `image = Image.open(Path(r"${spritesheetPath.replace(/\\/g, '\\\\')}" )).convert("RGBA")`,
    `rows = json.loads(r'''${JSON.stringify(requiredRows)}''')`,
    `cell_width = ${cellWidth}`,
    `cell_height = ${cellHeight}`,
    'for row in rows:',
    '    for index in range(row["frames"]):',
    '        box = (index * cell_width, row["row"] * cell_height, (index + 1) * cell_width, (row["row"] + 1) * cell_height)',
    '        if image.crop(box).getchannel("A").getbbox() is None:',
    '            raise SystemExit(f"{row[\'state\']} frame {index} is empty")',
    'print("OK")'
  ].join('\n');
  const candidates = [process.env.PYTHON, 'python', 'py', 'python3'].filter(Boolean);
  const failures = [];
  for (const command of candidates) {
    const args = command === 'py' ? ['-3', '-c', script] : ['-c', script];
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status === 0) return;
    if (result.error && result.error.code === 'ENOENT') continue;
    failures.push(`${command}: ${(result.stderr || result.stdout || result.error || '').toString().trim()}`);
  }
  throw new Error(`Frame content check failed: ${failures.join(' | ') || 'no Python interpreter found'}`);
}

function main() {
  for (const filePath of [petPath, spritesheetPath, trayPath, iconPath, pngIconPath, macIconPath]) {
    if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  }
  const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
  if (pet.id !== petId || pet.displayName !== '财神鸡' || pet.spriteVersionNumber !== 2 || pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error('pet.json does not match the 财神鸡 v2 asset contract.');
  }
  const size = parseWebpSize(spritesheetPath);
  if (size.width !== 1536 || size.height !== 2288) {
    throw new Error(`Expected 1536x2288 spritesheet; found ${size.width}x${size.height}.`);
  }
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(spritesheetPath)).digest('hex');
  if (actualHash !== expectedSha256) throw new Error('spritesheet.webp differs from the approved 财神鸡 atlas.');
  checkUsedCells();
  console.log('OK: 财神鸡 v2 assets are complete, approved, and structurally valid.');
}

main();
