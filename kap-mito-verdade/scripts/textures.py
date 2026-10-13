"""Texturas procedurais (papel, mesa, papel amassado, tinta de carimbo).

Geradas com semente fixa, então o resultado é sempre o mesmo.
Uso: python scripts/textures.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter, zoom
from scipy.spatial import cKDTree

OUT = Path(__file__).resolve().parent.parent / "assets" / "img"
rng = np.random.default_rng(7)


def fractal(h, w, octaves=5, base=8):
    acc = np.zeros((h, w))
    amp = 1.0
    for o in range(octaves):
        cells = base * 2**o
        g = rng.normal(0, 1, (cells + 1, int(cells * w / h) + 1))
        up = zoom(g, (h / g.shape[0], w / g.shape[1]), order=3)[:h, :w]
        acc += up * amp
        amp *= 0.5
    return (acc - acc.mean()) / acc.std()


def desk():
    h, w = 1920, 1080
    base = np.array([0x1F, 0x1E, 0x1D], dtype=float)
    mottle = fractal(h, w, 4, 3) * 2.2
    grain = rng.normal(0, 2.4, (h, w))
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w * 0.75)) ** 2 + ((yy - h * 0.45) / (h * 0.62)) ** 2)
    light = 9 * np.clip(1 - r, 0, 1) ** 1.6 - 6 * np.clip(r - 0.8, 0, 1)
    img = base[None, None, :] + (mottle + grain + light)[..., None] * np.array([1.0, 0.97, 0.92])
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT / "desk.jpg", quality=92)


def paper_grain():
    h, w = 1400, 920
    fine = gaussian_filter(rng.normal(0, 1, (h, w)), 0.7)
    cloud = fractal(h, w, 5, 4)
    fibers = np.zeros((h, w))
    for _ in range(900):
        y, x = rng.uniform(0, h), rng.uniform(0, w)
        ang = rng.uniform(0, np.pi)
        length = rng.uniform(8, 40)
        for s in np.linspace(0, length, int(length)):
            yi, xi = int(y + np.sin(ang) * s), int(x + np.cos(ang) * s)
            if 0 <= yi < h and 0 <= xi < w:
                fibers[yi, xi] += 1
    fibers = gaussian_filter(fibers, 0.6)
    v = 255 - 0.6 * (fine * 5 + cloud * 6 + fibers * 22 + 10)
    Image.fromarray(np.clip(v, 0, 255).astype(np.uint8), "L").convert("RGB").save(OUT / "paper-grain.jpg", quality=90)


def crumple():
    h, w = 600, 1200
    pts = np.column_stack([rng.uniform(0, h, 140), rng.uniform(0, w, 140)])
    yy, xx = np.mgrid[0:h, 0:w]
    _, lab = cKDTree(pts).query(np.column_stack([yy.ravel(), xx.ravel()]))
    lab = lab.reshape(h, w)
    normals = rng.normal(0, 1, (len(pts), 3))
    normals[:, 2] = np.abs(normals[:, 2]) + 2.2
    normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    light = np.array([-0.5, -0.6, 0.62])
    shade = normals[lab] @ light
    shade = gaussian_filter(shade, 1.2)
    shade = (shade - shade.min()) / (shade.max() - shade.min())
    v = 200 + shade * 55 + gaussian_filter(rng.normal(0, 1, (h, w)), 0.8) * 4
    Image.fromarray(np.clip(v, 0, 255).astype(np.uint8), "L").convert("RGB").save(OUT / "crumple.jpg", quality=90)


def stamp_ink():
    h, w = 520, 1100
    n = fractal(h, w, 6, 6) + gaussian_filter(rng.normal(0, 1, (h, w)), 1.0) * 0.9
    alpha = np.clip((n + 2.05) * 255 / 0.7, 0, 255) * np.clip((n + 2.6) / 1.2, 0.55, 1)
    speck = gaussian_filter(rng.normal(0, 1, (h, w)), 0.9)
    alpha[speck > 2.3] = 0
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[..., 3] = alpha.astype(np.uint8)
    Image.fromarray(img, "RGBA").filter(ImageFilter.GaussianBlur(0.4)).save(OUT / "stamp-ink.png", optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    desk()
    paper_grain()
    crumple()
    stamp_ink()
    for p in sorted(OUT.glob("*")):
        print(f"{p.name:18s} {p.stat().st_size / 1024:7.0f} KB")


if __name__ == "__main__":
    main()
