#!/usr/bin/env python3
"""Create a deterministic, royalty-free demo dataset (5 folders × 6 images)."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "demo_data"
SIZE = (840, 630)
FOLDERS = ["Ours", "SeAFusion", "SwinFusion", "PSFusion", "Baseline"]


def gradient(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", SIZE)
    draw = ImageDraw.Draw(image)
    for y in range(SIZE[1]):
        t = y / (SIZE[1] - 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        draw.line([(0, y), (SIZE[0], y)], fill=color)
    return image


def glow(image: Image.Image, center, radius, color, opacity=255) -> None:
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    for step in range(16, 0, -1):
        r = radius * step / 16
        alpha = round(opacity * (1 - step / 17) ** 2)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(18))
    image.paste(layer, (0, 0), layer)


def grain(image: Image.Image, amount: float, seed: int) -> Image.Image:
    noise = Image.effect_noise(SIZE, 24).convert("RGB")
    return Image.blend(image, ImageChops.add(image, noise, scale=2.8), amount)


def vignette(image: Image.Image, strength: int = 90) -> Image.Image:
    mask = Image.radial_gradient("L").resize(SIZE).filter(ImageFilter.GaussianBlur(55))
    darkness = Image.new("RGB", SIZE, (3, 6, 9))
    return Image.composite(darkness, image, mask.point(lambda p: int(p * strength / 255)))


def valley(seed: int) -> Image.Image:
    image = gradient((205, 216, 199), (245, 184, 143))
    glow(image, (665, 165), 150, (255, 245, 210), 170)
    draw = ImageDraw.Draw(image, "RGBA")
    ranges = [
        ((105, 132, 119, 190), 320, 0.55),
        ((75, 108, 99, 210), 380, 0.7),
        ((44, 81, 74, 235), 450, 0.9),
        ((26, 58, 55, 255), 530, 1.0),
    ]
    for color, base, roughness in ranges:
        points = [(0, base)]
        for x in range(0, SIZE[0] + 60, 60):
            y = base - (math.sin(x / 92 + seed) + math.sin(x / 31 + seed * 2)) * 26 * roughness
            points.append((x, y))
        points += [(SIZE[0], SIZE[1]), (0, SIZE[1])]
        draw.polygon(points, fill=color)
    for i in range(13):
        x = 80 + i * 58 + (i % 3) * 9
        top = 470 + (i % 4) * 12
        draw.polygon([(x, top), (x + 6, top - 48), (x + 12, top)], fill=(18, 47, 43, 240))
    for y, alpha in [(390, 55), (430, 40), (470, 30)]:
        draw.rounded_rectangle((0, y, SIZE[0], y + 28), radius=20, fill=(238, 242, 227, alpha))
    return image


def coast(seed: int) -> Image.Image:
    image = gradient((40, 58, 100), (247, 145, 99))
    glow(image, (420, 322), 138, (255, 214, 148), 255)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 358, SIZE[0], SIZE[1]), fill=(36, 56, 72, 255))
    for y in range(358, SIZE[1], 9):
        alpha = max(0, 120 - (y - 358) // 2)
        draw.line((0, y, SIZE[0], y), fill=(249, 184, 128, alpha), width=2)
    for i in range(38):
        rnd = random.Random(seed * 100 + i)
        y = rnd.randint(365, 615)
        x = rnd.randint(0, SIZE[0])
        length = rnd.randint(15, 95)
        draw.line((x, y, x + length, y), fill=(247, 209, 159, rnd.randint(15, 60)), width=2)
    draw.polygon([(0, 400), (145, 345), (235, 410), (330, 385), (390, 470), (0, 480)], fill=(25, 35, 45, 255))
    for i in range(5):
        x = 120 + i * 55
        draw.line((x, 300 - i * 12, x + 18, 295 - i * 12), fill=(33, 37, 48, 180), width=2)
    return image


def city(seed: int) -> Image.Image:
    image = gradient((11, 18, 31), (38, 43, 61))
    glow(image, (660, 430), 260, (55, 96, 140), 120)
    draw = ImageDraw.Draw(image, "RGBA")
    rnd = random.Random(seed)
    x = -20
    while x < SIZE[0]:
        w = rnd.randint(45, 110)
        top = rnd.randint(165, 405)
        shade = rnd.randint(12, 28)
        draw.rectangle((x, top, x + w, SIZE[1]), fill=(shade, shade + 8, shade + 17, 255))
        for wy in range(top + 18, SIZE[1] - 20, 26):
            for wx in range(x + 11, x + w - 8, 19):
                if rnd.random() > 0.58:
                    color = (rnd.choice([240, 255, 208]), rnd.randint(160, 220), rnd.randint(75, 130), 210)
                    draw.rectangle((wx, wy, wx + 7, wy + 11), fill=color)
        x += w + rnd.randint(4, 18)
    draw.rectangle((0, 552, SIZE[0], SIZE[1]), fill=(8, 12, 19, 255))
    for i in range(15):
        x = rnd.randint(0, SIZE[0])
        draw.line((x, 552, x + rnd.randint(-20, 20), SIZE[1]), fill=(42, 70, 105, 80), width=1)
    draw.ellipse((610, 300, 735, 390), fill=(255, 120, 85, 30))
    draw.ellipse((650, 330, 695, 360), fill=(255, 145, 96, 200))
    return image


def greenhouse(seed: int) -> Image.Image:
    image = gradient((124, 157, 122), (41, 84, 63))
    draw = ImageDraw.Draw(image, "RGBA")
    rnd = random.Random(seed)
    for layer in range(3):
        for i in range(28):
            x = rnd.randint(-60, SIZE[0] + 60)
            y = rnd.randint(140, 610)
            length = rnd.randint(70, 240)
            color = (32 + layer * 16, 82 + layer * 24, 53 + layer * 15, 140 + layer * 35)
            angle = rnd.uniform(-1.2, 1.2)
            x2 = x + math.cos(angle) * length
            y2 = y + math.sin(angle) * length * 0.55
            draw.line((x, y, x2, y2), fill=color, width=rnd.randint(8, 22))
            for _ in range(rnd.randint(2, 5)):
                t = rnd.uniform(0.2, 0.9)
                lx = x + (x2 - x) * t
                ly = y + (y2 - y) * t
                draw.ellipse((lx - 14, ly - 7, lx + 14, ly + 7), fill=color)
    for x in [120, 360, 610, 770]:
        draw.rectangle((x, 0, x + 9, SIZE[1]), fill=(25, 46, 40, 190))
    for y in [95, 255, 430]:
        draw.rectangle((0, y, SIZE[0], y + 6), fill=(24, 45, 39, 170))
    for i in range(5):
        x = 110 + i * 155
        draw.polygon([(x, 555), (x + 70, 555), (x + 58, 600), (x + 12, 600)], fill=(91, 61, 47, 230))
        draw.rectangle((x + 13, 600, x + 57, 616), fill=(66, 44, 35, 255))
    glow(image, (415, 60), 170, (233, 255, 221), 80)
    return image


def desert(seed: int) -> Image.Image:
    image = gradient((238, 195, 145), (226, 146, 93))
    glow(image, (660, 165), 115, (255, 234, 178), 210)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.polygon([(0, 380), (180, 325), (390, 390), (620, 340), (840, 402), (840, 630), (0, 630)], fill=(188, 119, 68, 255))
    draw.polygon([(0, 465), (210, 405), (430, 485), (700, 415), (840, 475), (840, 630), (0, 630)], fill=(218, 156, 92, 255))
    draw.polygon([(0, 535), (230, 470), (480, 555), (660, 500), (840, 535), (840, 630), (0, 630)], fill=(239, 188, 119, 255))
    draw.polygon([(330, 630), (412, 440), (470, 440), (610, 630)], fill=(70, 62, 65, 255))
    for i in range(9):
        y = 460 + i * 19
        width = 3 + i * 2.4
        draw.line((421 - i * 1.5, y, 459 + i * 1.5, y), fill=(233, 197, 142, 185), width=max(1, round(width)))
    for x in [80, 760]:
        draw.ellipse((x - 10, 525, x + 8, 545), fill=(74, 90, 51, 255))
    return image


def snowlake(seed: int) -> Image.Image:
    image = gradient((166, 199, 214), (225, 238, 236))
    glow(image, (210, 120), 125, (255, 249, 220), 100)
    draw = ImageDraw.Draw(image, "RGBA")
    points = [(0, 370)]
    rnd = random.Random(seed)
    for x in range(0, SIZE[0] + 60, 60):
        points.append((x, 245 + rnd.randint(-55, 45)))
    points += [(SIZE[0], 380), (SIZE[0], 480), (0, 480)]
    draw.polygon(points, fill=(91, 119, 131, 255))
    for x in range(20, SIZE[0], 75):
        top = 245 + rnd.randint(-45, 30)
        draw.polygon([(x, top + 40), (x + 20, top - 45), (x + 38, top + 40)], fill=(229, 238, 239, 245))
    draw.rectangle((0, 380, SIZE[0], SIZE[1]), fill=(56, 94, 108, 255))
    for y in range(380, SIZE[1], 12):
        alpha = max(0, 95 - (y - 380) // 2)
        draw.line((0, y, SIZE[0], y), fill=(198, 226, 231, alpha), width=1)
    draw.polygon([(0, 382), (200, 350), (400, 390), (650, 350), (840, 380), (840, 445), (0, 445)], fill=(220, 231, 231, 210))
    for i in range(17):
        x = 35 + i * 49
        h = 50 + (i % 5) * 17
        draw.polygon([(x, 425), (x + 12, 425 - h), (x + 24, 425)], fill=(30, 63, 58, 235))
        draw.rectangle((x + 10, 425, x + 14, 440), fill=(54, 44, 35, 255))
    return image


SCENES = [
    ("01_valley.jpg", valley),
    ("02_coast.jpg", coast),
    ("03_city.jpg", city),
    ("04_greenhouse.jpg", greenhouse),
    ("05_desert.jpg", desert),
    ("06_snowlake.jpg", snowlake),
]


def model_variant(base: Image.Image, folder: str, seed: int) -> Image.Image:
    if folder == "Ours":
        image = ImageEnhance.Contrast(base).enhance(1.07)
        image = ImageEnhance.Color(image).enhance(1.06)
        image = image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=3))
    elif folder == "SeAFusion":
        image = ImageEnhance.Contrast(base).enhance(1.2)
        image = ImageEnhance.Color(image).enhance(1.15)
        image = ImageEnhance.Brightness(image).enhance(0.95)
        warm = Image.new("RGB", SIZE, (255, 176, 118))
        image = Image.blend(image, ImageChops.multiply(image, warm), 0.18)
        image = image.filter(ImageFilter.UnsharpMask(radius=1.8, percent=160, threshold=2))
    elif folder == "SwinFusion":
        image = ImageEnhance.Brightness(base).enhance(1.07)
        image = ImageEnhance.Contrast(image).enhance(0.94)
        image = ImageEnhance.Color(image).enhance(0.88)
        image = image.filter(ImageFilter.GaussianBlur(0.35))
    elif folder == "PSFusion":
        image = ImageEnhance.Brightness(base).enhance(1.14)
        image = ImageEnhance.Color(image).enhance(0.72)
        image = ImageEnhance.Contrast(image).enhance(0.95)
        haze = Image.new("RGB", SIZE, (255, 244, 226))
        image = Image.blend(image, haze, 0.1)
    else:
        image = ImageEnhance.Brightness(base).enhance(0.8)
        image = ImageEnhance.Contrast(image).enhance(1.08)
        image = ImageEnhance.Color(image).enhance(0.62)
        image = image.filter(ImageFilter.GaussianBlur(1.35))
        image = grain(image, 0.28, seed + 100)

    # A shared subtle grain keeps the set from looking like flat vectors.
    image = grain(image, 0.035, seed)
    image = vignette(image, 50 if folder == "Ours" else 78)
    return image


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for folder in FOLDERS:
        (ROOT / folder).mkdir(parents=True, exist_ok=True)
    for scene_index, (filename, factory) in enumerate(SCENES):
        base = factory(scene_index + 3)
        for folder in FOLDERS:
            variant = model_variant(base, folder, scene_index + 1)
            variant.save(ROOT / folder / filename, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"Created {len(FOLDERS)} folders × {len(SCENES)} images in {ROOT}")


if __name__ == "__main__":
    main()
