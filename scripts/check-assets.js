const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const petPath = path.join(assetsDir, 'pet.json');
const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');
const extraActionsPath = path.join(assetsDir, 'siyanji-extra-actions.webp');
const extraActionsJsonPath = path.join(assetsDir, 'siyanji-extra-actions.json');
const longActionsPath = path.join(assetsDir, 'siyanji-long-actions.webp');
const longActionsJsonPath = path.join(assetsDir, 'siyanji-long-actions.json');

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

function pythonFrameCheck() {
  const script = `
from pathlib import Path
from PIL import Image, ImageChops
import json

root = Path(r"${root.replace(/\\/g, '\\\\')}")
manifest_path = root / "assets" / "siyanji-extra-actions.json"
asset_path = root / "assets" / "siyanji-extra-actions.webp"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
cell_width = manifest["cellWidth"]
cell_height = manifest["cellHeight"]
with Image.open(asset_path) as image:
    image = image.convert("RGBA")
    for row in manifest["rows"]:
        frames = []
        for index in range(row["frames"]):
            box = (index * cell_width, row["row"] * cell_height, (index + 1) * cell_width, (row["row"] + 1) * cell_height)
            frames.append(image.crop(box))
        for index, frame in enumerate(frames):
            previous = frames[index - 1]
            if ImageChops.difference(previous, frame).getbbox() is None:
                raise SystemExit(f"{row['id']} has duplicate adjacent frame {index - 1}->{index}")
print("OK")
`;

  const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', script], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(`Extra action frame difference check failed${details ? `: ${details}` : ''}`);
  }
}

function validateLongActions() {
  if (!fs.existsSync(longActionsPath) || !fs.existsSync(longActionsJsonPath)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(longActionsJsonPath, 'utf8'));
  if (manifest.version !== 1) {
    throw new Error(`Expected long actions manifest version 1; found ${manifest.version}`);
  }
  if (manifest.spritesheetPath !== 'siyanji-long-actions.webp') {
    throw new Error(`Expected long actions spritesheetPath siyanji-long-actions.webp; found ${manifest.spritesheetPath}`);
  }
  if (manifest.cellWidth !== 192 || manifest.cellHeight !== 208) {
    throw new Error(`Expected long action cells 192x208; found ${manifest.cellWidth}x${manifest.cellHeight}`);
  }
  if (manifest.columns !== 24 || !Number.isInteger(manifest.rows) || manifest.rows < 1) {
    throw new Error(`Expected long actions atlas to use 24 columns and a positive row count; found ${manifest.columns}x${manifest.rows}`);
  }
  if (!Array.isArray(manifest.actions) || manifest.actions.length < 1) {
    throw new Error('Expected at least one long action.');
  }

  const longSize = parseWebpSize(longActionsPath);
  const expectedLongWidth = manifest.cellWidth * manifest.columns;
  const expectedLongHeight = manifest.cellHeight * manifest.rows;
  if (longSize.width !== expectedLongWidth || longSize.height !== expectedLongHeight) {
    throw new Error(`Expected long actions ${expectedLongWidth}x${expectedLongHeight}; found ${longSize.width}x${longSize.height}`);
  }

  for (const action of manifest.actions) {
    if (!Number.isInteger(action.row) || !Number.isInteger(action.rowCount) || action.rowCount < 1) {
      throw new Error(`Invalid long action row metadata for ${action.id}.`);
    }
    if (!Number.isInteger(action.frames) || action.frames < 1) {
      throw new Error(`Invalid long action frame count for ${action.id}.`);
    }
    if (!Array.isArray(action.durations) || action.durations.length !== action.frames) {
      throw new Error(`Expected ${action.id} to have ${action.frames} frame durations.`);
    }
    const expectedRows = Math.ceil(action.frames / manifest.columns);
    if (action.rowCount !== expectedRows) {
      throw new Error(`Expected ${action.id} rowCount ${expectedRows}; found ${action.rowCount}`);
    }
    if (action.row + action.rowCount > manifest.rows) {
      throw new Error(`Long action ${action.id} exceeds atlas row bounds.`);
    }
    if (!action.frameChecks || action.frameChecks.adjacentDifferent !== true) {
      throw new Error(`Expected ${action.id} to pass adjacent frame checks.`);
    }
  }
}

function main() {
  if (!fs.existsSync(petPath)) {
    throw new Error(`Missing ${petPath}`);
  }
  if (!fs.existsSync(spritesheetPath)) {
    throw new Error(`Missing ${spritesheetPath}`);
  }
  if (!fs.existsSync(extraActionsPath)) {
    throw new Error(`Missing ${extraActionsPath}`);
  }
  if (!fs.existsSync(extraActionsJsonPath)) {
    throw new Error(`Missing ${extraActionsJsonPath}`);
  }

  const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
  if (pet.id !== 'siyanji') {
    throw new Error(`Expected pet id siyanji; found ${pet.id}`);
  }
  if (pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error(`Expected spritesheetPath spritesheet.webp; found ${pet.spritesheetPath}`);
  }

  const size = parseWebpSize(spritesheetPath);
  if (size.width !== 1536 || size.height !== 1872) {
    throw new Error(`Expected spritesheet 1536x1872; found ${size.width}x${size.height}`);
  }

  const extraActions = JSON.parse(fs.readFileSync(extraActionsJsonPath, 'utf8'));
  if (extraActions.spritesheetPath !== 'siyanji-extra-actions.webp') {
    throw new Error(`Expected extra actions spritesheetPath siyanji-extra-actions.webp; found ${extraActions.spritesheetPath}`);
  }
  if (extraActions.version !== 2) {
    throw new Error(`Expected extra actions manifest version 2; found ${extraActions.version}`);
  }
  if (extraActions.cellWidth !== 192 || extraActions.cellHeight !== 208) {
    throw new Error(`Expected extra action cells 192x208; found ${extraActions.cellWidth}x${extraActions.cellHeight}`);
  }
  if (extraActions.columns !== 24) {
    throw new Error(`Expected extra actions to use 24 columns; found ${extraActions.columns}`);
  }
  if (!Array.isArray(extraActions.rows) || extraActions.rows.length < 1) {
    throw new Error('Expected at least one extra action row.');
  }
  for (const [index, row] of extraActions.rows.entries()) {
    if (row.row !== index) {
      throw new Error(`Expected extra action ${row.id} row ${index}; found ${row.row}`);
    }
    if (row.frames !== 24) {
      throw new Error(`Expected extra action ${row.id} to have 24 frames; found ${row.frames}`);
    }
    if (!Array.isArray(row.durations) || row.durations.length !== row.frames) {
      throw new Error(`Expected extra action ${row.id} to have ${row.frames} frame durations.`);
    }
    if (!row.frameChecks || row.frameChecks.adjacentDifferent !== true) {
      throw new Error(`Expected extra action ${row.id} to pass adjacent frame checks.`);
    }
  }

  const extraSize = parseWebpSize(extraActionsPath);
  const expectedExtraWidth = extraActions.cellWidth * extraActions.columns;
  const expectedExtraHeight = extraActions.cellHeight * extraActions.rows.length;
  if (extraSize.width !== expectedExtraWidth || extraSize.height !== expectedExtraHeight) {
    throw new Error(`Expected extra actions ${expectedExtraWidth}x${expectedExtraHeight}; found ${extraSize.width}x${extraSize.height}`);
  }
  pythonFrameCheck();
  validateLongActions();

  console.log(`OK: ${pet.displayName || pet.id} assets validated (${size.width}x${size.height}, extra ${extraSize.width}x${extraSize.height}).`);
}

try {
  main();
} catch (error) {
  console.error(`Asset validation failed: ${error.message}`);
  process.exit(1);
}
