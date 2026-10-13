"""Gera as texturas de papel usadas na composição (determinístico, seed fixa).

Uso: python3 -I tools/make-textures.py   (a partir da pasta kap-mito-verdade)

Saídas em assets/textures/:
  paper-grain.png  — grão + fibras (PNG RGBA escuro com alfa), ladrilhável 1024x1024
  paper-mottle.png — manchas suaves de baixa frequência, ladrilhável 1024x1024
"""

import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "textures")
SIZE = 1024
rng = np.random.default_rng(20260517)


def periodic_blur(img, sx, sy):
    """Desfoque gaussiano anisotrópico via FFT (periódico => textura ladrilhável)."""
    h, w = img.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    kernel = np.exp(-2 * (np.pi**2) * ((fx * sx) ** 2 + (fy * sy) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(img) * kernel))


def norm(a):
    a = a - a.mean()
    return a / (np.abs(a).max() + 1e-9)


# grão fino
grain = norm(periodic_blur(rng.standard_normal((SIZE, SIZE)), 0.7, 0.7))
# fibras: ruído esparso esticado em direções levemente diferentes
fibers = np.zeros((SIZE, SIZE))
for sx, sy in ((14, 1.0), (1.0, 12), (9, 2.5)):
    sparse = (rng.random((SIZE, SIZE)) > 0.9965).astype(float) * rng.choice([-1, 1], (SIZE, SIZE))
    fibers += periodic_blur(sparse, sx, sy)
fibers = norm(fibers)

tex = 0.65 * grain + 0.55 * fibers
tex = norm(tex)
# só escurece: alfa proporcional à "sujeira"
alpha = np.clip((tex + 0.15) * 255 * 0.9, 0, 255).astype(np.uint8)
rgba = np.zeros((SIZE, SIZE, 4), np.uint8)
rgba[..., 0] = 31
rgba[..., 1] = 30
rgba[..., 2] = 29
rgba[..., 3] = alpha
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "paper-grain.png"), optimize=True)

mottle = norm(periodic_blur(rng.standard_normal((SIZE, SIZE)), 60, 60))
alpha = np.clip((mottle * 0.5 + 0.5) * 255, 0, 255).astype(np.uint8)
rgba = np.zeros((SIZE, SIZE, 4), np.uint8)
rgba[..., 0] = 120
rgba[..., 1] = 96
rgba[..., 2] = 70
rgba[..., 3] = alpha
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "paper-mottle.png"), optimize=True)
print("ok", os.path.normpath(OUT))
