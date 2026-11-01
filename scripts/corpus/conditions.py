"""Phone photos under the conditions people really take them in.

Each selected document is photographed once per condition, so the report can
say which situation the reader handles and which it does not:

  dark          a dim room: underexposed, with the sensor noise phones add
  overexposed   too much light: washed out, low contrast
  flash         the flash's hot spot on glossy paper, dark corners
  blur          out of focus
  shake         a shaky hand: motion blur
  low-res       an old camera or a forwarded photo: small and compressed
  whatsapp      heavy JPEG compression at full size
  perspective   taken at an angle: one end of the page much narrower
  curled        a page that curls and has been folded
  upside-down   the phone held the wrong way round
  sideways      a portrait page photographed in landscape
  warm-light    under a yellow bulb
  hand-shadow   the sharp shadow of a hand or phone across the text
  far-away      a small page on a patterned table
  close-up      the page fills the frame, edges cut
  shadow-fill   the page fills the frame, tilted, a soft diagonal shadow across one side
  screenshot    a screenshot of the document open in a dark viewer app

Run after render.mjs: python3 scripts/corpus/conditions.py corpus
"""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

root = Path(sys.argv[1] if len(sys.argv) > 1 else "corpus")
PICK = [
    "inv-en-US-classic", "inv-de-multi-vat", "inv-tr-discount", "inv-fr-modern", "inv-es-leaders",
    "inv-pl-classic", "rcp-tr", "rcp-en-GB", "rcp-de", "stm-tr-1",
]
CONDITIONS = ["dark", "overexposed", "flash", "blur", "shake", "low-res", "whatsapp", "perspective", "curled", "upside-down", "sideways", "warm-light", "hand-shadow", "far-away", "close-up", "shadow-fill", "screenshot"]


def on_table(im: Image.Image, rnd: random.Random, angle: float, margin=0.12, bg=None) -> Image.Image:
    bg = bg or (rnd.randint(70, 110), rnd.randint(60, 95), rnd.randint(50, 80))
    rot = im.rotate(angle, expand=True, fillcolor=bg, resample=Image.BICUBIC)
    # The table is sized around the turned page, so a sideways photo keeps the whole sheet.
    canvas = Image.new("RGB", (int(rot.width * (1 + margin * 2)), int(rot.height * (1 + margin * 2))), bg)
    canvas.paste(rot, ((canvas.width - rot.width) // 2, (canvas.height - rot.height) // 2))
    return canvas


def arr(im: Image.Image) -> np.ndarray:
    return np.asarray(im).astype(np.float32)


def img(a: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def radial(w: int, h: int, cx: float, cy: float, radius: float) -> np.ndarray:
    y, x = np.mgrid[0:h, 0:w]
    return np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * radius**2)))


def motion_kernel(length: int, angle: float) -> np.ndarray:
    k = np.zeros((length, length), np.float32)
    c = length // 2
    for t in np.linspace(-c, c, length * 3):
        x = int(round(c + t * math.cos(math.radians(angle))))
        y = int(round(c + t * math.sin(math.radians(angle))))
        k[y, x] = 1
    return k / k.sum()


def convolve(a: np.ndarray, k: np.ndarray) -> np.ndarray:
    out = np.zeros_like(a)
    c = k.shape[0] // 2
    pad = np.pad(a, ((c, c), (c, c), (0, 0)), mode="edge")
    for dy in range(k.shape[0]):
        for dx in range(k.shape[1]):
            if k[dy, dx]:
                out += k[dy, dx] * pad[dy : dy + a.shape[0], dx : dx + a.shape[1]]
    return out


def photograph(page: Image.Image, cond: str, rnd: random.Random) -> tuple[Image.Image, int]:
    tilt = rnd.uniform(-3, 3)
    quality = 80
    if cond == "close-up":
        # The page fills the frame; a sliver of each margin is cut off.
        w, h = page.size
        im = page.rotate(tilt, expand=False, fillcolor=(235, 235, 230), resample=Image.BICUBIC).crop((int(w * 0.03), int(h * 0.02), int(w * 0.97), int(h * 0.985)))
        return ImageEnhance.Brightness(im).enhance(0.92).filter(ImageFilter.GaussianBlur(0.6)), 82
    if cond == "shadow-fill":
        # Held close and a little crooked: the sheet runs past every edge of the frame, and the
        # phone's shadow falls diagonally across the left side, darkest at the edge.
        w, h = page.size
        im = page.rotate(rnd.choice([-1, 1]) * rnd.uniform(2.5, 4), expand=False, fillcolor=(235, 235, 230), resample=Image.BICUBIC)
        im = im.crop((int(w * 0.02), int(h * 0.015), int(w * 0.985), int(h * 0.985)))
        a = arr(im)
        hh, ww = a.shape[:2]
        y, x = np.mgrid[0:hh, 0:ww]
        d = (x / ww) + 0.35 * (y / hh)  # distance along the diagonal
        shade = np.clip((0.55 - d) / 0.35, 0, 1) ** 1.3
        a = a * (1 - 0.62 * shade[..., None])
        return img(a).filter(ImageFilter.GaussianBlur(0.7)), 80
    if cond == "screenshot":
        # The PDF open in a dark viewer: toolbar and sidebar with their own text around the page.
        W = int(page.width * 1.45)
        H = int(page.height * 1.12)
        canvas = Image.new("RGB", (W, H), (32, 33, 36))
        d = ImageDraw.Draw(canvas)
        d.rectangle((0, 0, W, int(H * 0.04)), fill=(45, 46, 50))
        d.rectangle((0, 0, int(W * 0.18), H), fill=(40, 41, 45))
        for i, label in enumerate(["Documents", "Recent", "Shared", "Downloads", "Invoices 2026", "Archive"]):
            d.text((int(W * 0.02), int(H * 0.07) + i * 34), label, fill=(200, 200, 205))
        d.text((int(W * 0.2), int(H * 0.012)), "Preview  -  page 1 of 1  -  100%", fill=(220, 220, 225))
        small = page.resize((int(page.width * 0.95), int(page.height * 0.95)), Image.LANCZOS)
        canvas.paste(small, (int(W * 0.18) + (W - int(W * 0.18) - small.width) // 2, int(H * 0.05)))
        return canvas, 95
    if cond == "far-away":
        # A patterned table (wood grain), the page small in a 12-megapixel frame.
        W, H = 3000, 4000
        y, x = np.mgrid[0:H, 0:W]
        grain = 120 + 25 * np.sin(x / 9 + 4 * np.sin(y / 140)) + 12 * np.sin(y / 3.1)
        table = np.stack([grain * 1.0, grain * 0.72, grain * 0.5], -1)
        canvas = img(table)
        small = page.resize((int(W * 0.5), int(W * 0.5 * page.height / page.width)), Image.LANCZOS).rotate(tilt, expand=True, fillcolor=(0, 0, 0), resample=Image.BICUBIC)
        mask = small.convert("L").point(lambda v: 255 if v > 0 else 0)
        canvas.paste(small, ((W - small.width) // 2, (H - small.height) // 2), mask)
        return canvas.filter(ImageFilter.GaussianBlur(0.8)), 82
    im = on_table(page, rnd, 180 + tilt if cond == "upside-down" else 90 + tilt if cond == "sideways" else tilt)
    w, h = im.size
    if cond == "perspective":
        k = 0.13
        im = im.transform((w, h), Image.QUAD, (w * k, 0, 0, h, w, h, w * (1 - k), 0), resample=Image.BICUBIC, fillcolor=(80, 70, 60))
    if cond == "curled":
        a = arr(im)
        y = np.arange(h)[:, None]
        x = np.arange(w)[None, :]
        # The page bows: rows bend into a gentle wave, stronger towards the bottom.
        shift = (np.sin(x / w * math.pi) * 18 * (y / h)).astype(int)
        ys = np.clip(y + shift, 0, h - 1)
        a = a[ys, np.broadcast_to(x, (h, w))]
        # A fold: a light ridge and a dark valley across the page.
        fold = int(h * rnd.uniform(0.4, 0.6))
        prof = np.zeros(h, np.float32)
        prof[fold - 40 : fold] = np.linspace(0, 1, 40) * 25
        prof[fold : fold + 40] = -np.linspace(1, 0, 40) * 45
        im = img(a + prof[:, None, None])
    a = arr(im)
    if cond == "dark":
        a = a * 0.32
        a += np.random.default_rng(rnd.randint(0, 9999)).normal(0, 9, a.shape)
        quality = 70
    elif cond == "overexposed":
        a = 255 - (255 - a) * 0.42 + 20
    elif cond == "flash":
        spot = radial(w, h, w * rnd.uniform(0.35, 0.65), h * rnd.uniform(0.35, 0.6), min(w, h) * 0.14)
        vignette = 1 - 0.55 * (1 - radial(w, h, w / 2, h / 2, max(w, h) * 0.55))
        a = a * vignette[..., None]
        a = a + (255 - a) * (spot[..., None] * 0.88)
    elif cond == "warm-light":
        a = a * np.array([1.0, 0.8, 0.52]) * 0.85
    elif cond == "hand-shadow":
        shade = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(shade)
        x0 = w * rnd.uniform(0.45, 0.6)
        d.polygon([(x0, 0), (w, 0), (w, h), (x0 - w * 0.15, h)], fill=255)
        m = arr(shade.filter(ImageFilter.GaussianBlur(6)))[..., None] / 255
        a = a * (1 - 0.6 * m)
    im = img(a)
    if cond == "blur":
        im = im.filter(ImageFilter.GaussianBlur(2.2))
    elif cond == "shake":
        im = img(convolve(arr(im), motion_kernel(11, rnd.uniform(-20, 20))))
    else:
        im = im.filter(ImageFilter.GaussianBlur(0.7))
    if cond == "low-res":
        im = im.resize((640, int(640 * h / w)), Image.BILINEAR)
        quality = 45
    if cond == "whatsapp":
        quality = 18
    return im, quality


def main():
    docs = {d["name"]: d for d in json.loads((root / "truth.json").read_text())}
    rnd = random.Random(11)
    made = {}
    for cond in CONDITIONS:
        out = root / "conditions" / cond
        out.mkdir(parents=True, exist_ok=True)
        made[cond] = []
        for name in PICK:
            if name not in docs or not (root / "png" / f"{name}.png").exists():
                continue
            page = Image.open(root / "png" / f"{name}.png").convert("RGB")
            im, q = photograph(page, cond, rnd)
            im.save(out / f"{name}.jpg", quality=q)
            made[cond].append(name)
    (root / "conditions.json").write_text(json.dumps(made, indent=1) + "\n")
    print(f"{sum(len(v) for v in made.values())} photos in {len(made)} conditions")


if __name__ == "__main__":
    main()
