from __future__ import annotations

import json
from pathlib import Path

import cv2
import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
SPRITESHEET = ASSETS_DIR / "spritesheet.webp"
EXTRA_ACTIONS_MANIFEST = ASSETS_DIR / "siyanji-extra-actions.json"
OUT_DIR = ROOT / "media"
CELL_WIDTH = 192
CELL_HEIGHT = 208
SCALE = 3
FPS = 30
MAX_ACTION_LOOPS = 3
MIN_ACTION_PREVIEW_MS = 1800

BASE_STATES = [
    {"id": "idle", "label": "待机", "row": 0, "frames": 6, "durations": [280, 110, 110, 140, 140, 320], "sheet": "base"},
    {"id": "running-right", "label": "向右跑", "row": 1, "frames": 8, "durations": [120, 120, 120, 120, 120, 120, 120, 220], "sheet": "base"},
    {"id": "running-left", "label": "向左跑", "row": 2, "frames": 8, "durations": [120, 120, 120, 120, 120, 120, 120, 220], "sheet": "base"},
    {"id": "waving", "label": "挥手", "row": 3, "frames": 4, "durations": [140, 140, 140, 280], "sheet": "base"},
    {"id": "jumping", "label": "跳跃", "row": 4, "frames": 5, "durations": [140, 140, 140, 140, 280], "sheet": "base"},
    {"id": "failed", "label": "难过", "row": 5, "frames": 8, "durations": [140, 140, 140, 140, 140, 140, 140, 240], "sheet": "base"},
    {"id": "waiting", "label": "等待", "row": 6, "frames": 6, "durations": [150, 150, 150, 150, 150, 260], "sheet": "base"},
    {"id": "running", "label": "原地跑", "row": 7, "frames": 6, "durations": [120, 120, 120, 120, 120, 220], "sheet": "base"},
    {"id": "review", "label": "专注", "row": 8, "frames": 6, "durations": [150, 150, 150, 150, 150, 280], "sheet": "base"},
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    image = Image.new("RGBA", size, (246, 246, 241, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(226, 232, 224, 255))
    return image


def fit_frame(frame: Image.Image, size: tuple[int, int]) -> Image.Image:
    bbox = frame.getbbox()
    cropped = frame.crop(bbox) if bbox else frame
    cropped = cropped.resize((cropped.width * SCALE, cropped.height * SCALE), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - cropped.width) // 2
    y = size[1] - cropped.height - 40
    canvas.alpha_composite(cropped, (x, y))
    return canvas


def make_scene(frame: Image.Image, title: str, index: int, total: int) -> Image.Image:
    size = (720, 720)
    scene = checkerboard(size)
    pet = fit_frame(frame, size)
    scene.alpha_composite(pet)

    draw = ImageDraw.Draw(scene)
    title_font = load_font(42)
    meta_font = load_font(22)
    title_text = f"四眼鸡 - {title}"
    meta_text = f"{index}/{total}"

    draw.rounded_rectangle((28, 26, 692, 92), radius=18, fill=(255, 255, 255, 230))
    draw.text((48, 38), title_text, font=title_font, fill=(37, 43, 36))
    meta_bbox = draw.textbbox((0, 0), meta_text, font=meta_font)
    draw.text((672 - (meta_bbox[2] - meta_bbox[0]), 55), meta_text, font=meta_font, fill=(95, 108, 89))
    return scene.convert("RGB")


def repeat_for_duration(scene: Image.Image, duration_ms: int) -> list[Image.Image]:
    count = max(1, round(duration_ms / 1000 * FPS))
    return [scene] * count


def load_states() -> list[dict[str, object]]:
    states = list(BASE_STATES)
    with EXTRA_ACTIONS_MANIFEST.open("r", encoding="utf-8") as file:
        manifest = json.load(file)
    for row in manifest["rows"]:
        states.append(
            {
                "id": row["id"],
                "label": row["label"],
                "row": row["row"],
                "frames": row["frames"],
                "durations": row["durations"],
                "sheet": "extra",
            }
        )
    return states


def action_loops(durations: list[int]) -> int:
    total = sum(durations)
    if total <= 0:
        return 1
    return min(MAX_ACTION_LOOPS, max(1, round(MIN_ACTION_PREVIEW_MS / total)))


def export() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base_sheet = Image.open(SPRITESHEET).convert("RGBA")
    with EXTRA_ACTIONS_MANIFEST.open("r", encoding="utf-8") as file:
        extra_manifest = json.load(file)
    extra_sheet = Image.open(ASSETS_DIR / extra_manifest["spritesheetPath"]).convert("RGBA")
    states = load_states()

    gif_frames: list[Image.Image] = []
    gif_durations: list[int] = []
    video_frames: list[np.ndarray] = []

    for state_index, state in enumerate(states, start=1):
        sheet = extra_sheet if state["sheet"] == "extra" else base_sheet
        title = str(state["label"])
        row = int(state["row"])
        durations = [int(duration) for duration in state["durations"]]
        loops = action_loops(durations)
        for _loop_index in range(loops):
            for col, duration in enumerate(durations):
                frame = sheet.crop((col * CELL_WIDTH, row * CELL_HEIGHT, (col + 1) * CELL_WIDTH, (row + 1) * CELL_HEIGHT))
                scene = make_scene(frame, title, state_index, len(states))
                gif_frames.append(scene)
                gif_durations.append(duration)
                video_frames.extend(repeat_for_duration(scene, duration))

        # Hold on the final pose so viewers can read the action label.
        hold_col = int(state["frames"]) - 1
        hold_duration = 520
        frame = sheet.crop((hold_col * CELL_WIDTH, row * CELL_HEIGHT, (hold_col + 1) * CELL_WIDTH, (row + 1) * CELL_HEIGHT))
        hold = make_scene(frame, title, state_index, len(states))
        gif_frames.append(hold)
        gif_durations.append(hold_duration)
        video_frames.extend(repeat_for_duration(hold, hold_duration))

    gif_path = OUT_DIR / "siyanji-all-actions-preview.gif"
    mp4_path = OUT_DIR / "siyanji-all-actions-preview.mp4"

    gif_frames[0].save(
        gif_path,
        save_all=True,
        append_images=gif_frames[1:],
        duration=gif_durations,
        loop=0,
        optimize=True,
    )

    writer = cv2.VideoWriter(str(mp4_path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, video_frames[0].size)
    if not writer.isOpened():
        raise RuntimeError("Unable to open MP4 writer.")
    try:
        for frame in video_frames:
            writer.write(cv2.cvtColor(np.asarray(frame), cv2.COLOR_RGB2BGR))
    finally:
        writer.release()

    print(f"GIF: {gif_path}")
    print(f"MP4: {mp4_path}")
    print(f"Actions: {len(states)}")
    print(f"Duration: {len(video_frames) / FPS:.1f}s")


if __name__ == "__main__":
    export()
