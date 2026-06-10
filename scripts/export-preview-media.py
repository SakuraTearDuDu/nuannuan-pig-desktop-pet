from __future__ import annotations

from pathlib import Path

import cv2
import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SPRITESHEET = ROOT / "assets" / "spritesheet.webp"
OUT_DIR = ROOT / "media"
CELL_WIDTH = 192
CELL_HEIGHT = 208
SCALE = 3
FPS = 30

STATES = [
    ("idle", "待机", 0, [280, 110, 110, 140, 140, 320]),
    ("running-right", "向右跑", 1, [120, 120, 120, 120, 120, 120, 120, 220]),
    ("running-left", "向左跑", 2, [120, 120, 120, 120, 120, 120, 120, 220]),
    ("waving", "挥手", 3, [140, 140, 140, 280]),
    ("jumping", "跳跃", 4, [140, 140, 140, 140, 280]),
    ("failed", "难过", 5, [140, 140, 140, 140, 140, 140, 140, 240]),
    ("waiting", "等待", 6, [150, 150, 150, 150, 150, 260]),
    ("running", "原地跑", 7, [120, 120, 120, 120, 120, 220]),
    ("review", "专注", 8, [150, 150, 150, 150, 150, 280]),
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
    title_text = f"暖暖猪 - {title}"
    meta_text = f"{index}/{total}"

    draw.rounded_rectangle((28, 26, 692, 92), radius=18, fill=(255, 255, 255, 230))
    draw.text((48, 38), title_text, font=title_font, fill=(37, 43, 36))
    meta_bbox = draw.textbbox((0, 0), meta_text, font=meta_font)
    draw.text((672 - (meta_bbox[2] - meta_bbox[0]), 55), meta_text, font=meta_font, fill=(95, 108, 89))
    return scene.convert("RGB")


def repeat_for_duration(scene: Image.Image, duration_ms: int) -> list[Image.Image]:
    count = max(1, round(duration_ms / 1000 * FPS))
    return [scene] * count


def export() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SPRITESHEET).convert("RGBA")

    gif_frames: list[Image.Image] = []
    gif_durations: list[int] = []
    video_frames: list[np.ndarray] = []

    for state_index, (_state_id, title, row, durations) in enumerate(STATES, start=1):
        for col, duration in enumerate(durations):
            frame = sheet.crop((col * CELL_WIDTH, row * CELL_HEIGHT, (col + 1) * CELL_WIDTH, (row + 1) * CELL_HEIGHT))
            scene = make_scene(frame, title, state_index, len(STATES))
            gif_frames.append(scene)
            gif_durations.append(duration)
            video_frames.extend(repeat_for_duration(scene, duration))

        # Give viewers a moment to read the state label before the next state.
        hold = gif_frames[-1]
        gif_frames.append(hold)
        gif_durations.append(450)
        video_frames.extend(repeat_for_duration(hold, 450))

    gif_path = OUT_DIR / "nuannuan-pig-animation-preview.gif"
    mp4_path = OUT_DIR / "nuannuan-pig-animation-preview.mp4"

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
    print(f"Duration: {len(video_frames) / FPS:.1f}s")


if __name__ == "__main__":
    export()
