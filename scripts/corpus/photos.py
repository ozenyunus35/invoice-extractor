"""Turns every third page image into a phone-photo look: tilt, slight perspective,
uneven lighting, blur and JPEG compression."""
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

root = Path(sys.argv[1])
(root / "photo").mkdir(exist_ok=True)
rnd = random.Random(7)
docs = json.loads((root / "truth.json").read_text())
for i, d in enumerate(docs):
    if i % 3 or d["truth"]["kind"] == "reject":
        continue
    im = Image.open(root / "png" / f"{d['name']}.png").convert("RGB")
    angle = rnd.uniform(-4, 4)
    bg = (rnd.randint(60, 110), rnd.randint(55, 100), rnd.randint(50, 90))
    canvas = Image.new("RGB", (int(im.width * 1.2), int(im.height * 1.12)), bg)
    rot = im.rotate(angle, expand=True, fillcolor=bg, resample=Image.BICUBIC)
    canvas.paste(rot, ((canvas.width - rot.width) // 2, (canvas.height - rot.height) // 2))
    w, h = canvas.size
    k = rnd.uniform(0.01, 0.04)
    canvas = canvas.transform((w, h), Image.QUAD, (w * k, 0, 0, h, w, h, w * (1 - k), 0), resample=Image.BICUBIC, fillcolor=bg)
    shade = Image.new("L", (w, h), 0)
    ImageDraw.Draw(shade).rectangle([0, 0, w * rnd.uniform(0.3, 0.7), h], fill=rnd.randint(40, 80))
    canvas = Image.composite(Image.new("RGB", (w, h), (0, 0, 0)), canvas, shade.filter(ImageFilter.GaussianBlur(120)))
    canvas = ImageEnhance.Contrast(canvas).enhance(rnd.uniform(0.75, 0.95)).filter(ImageFilter.GaussianBlur(rnd.uniform(0.6, 1.2)))
    scale = rnd.uniform(0.75, 1.0)
    canvas = canvas.resize((int(w * scale), int(h * scale)), Image.BILINEAR)
    canvas.save(root / "photo" / f"{d['name']}.jpg", quality=rnd.randint(55, 75))
