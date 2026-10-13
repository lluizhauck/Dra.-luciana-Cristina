"""Efeitos sonoros discretos, sintetizados (sem bancos de som de terceiros).

Saídas em assets/audio/sfx/*.wav (48 kHz, mono). Cada efeito já sai no volume
final, bem abaixo da narração (-16,5 LUFS), para ficar discreto.
Semente fixa: o resultado é sempre o mesmo.

Uso: python scripts/sfx.py
"""

from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "assets" / "audio" / "sfx"
rng = np.random.default_rng(20261013)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def band(x, lo=None, hi=None, order=4):
    if lo and hi:
        sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    elif lo:
        sos = butter(order, lo, btype="high", fs=SR, output="sos")
    else:
        sos = butter(order, hi, btype="low", fs=SR, output="sos")
    return sosfilt(sos, x)


def env_adsr(n, a, d, peak_at=None):
    t = np.arange(n) / SR
    peak_at = peak_at if peak_at is not None else a
    e = np.where(t < peak_at, (t / max(peak_at, 1e-4)) ** 1.5, np.exp(-(t - peak_at) / d))
    return e


def smooth_noise(n, rate_hz):
    """Ruído lento (modulação de amplitude tipo 'tremulação' do papel)."""
    k = max(2, int(n * rate_hz / SR))
    pts = rng.uniform(0.3, 1.0, k + 2)
    return np.interp(np.linspace(0, k + 1, n), np.arange(k + 2), pts)


def crackles(n, density, start=0.0, end=1.0, lo=1500, hi=7000):
    x = np.zeros(n)
    count = int(density * (end - start) * n / SR)
    for _ in range(count):
        i = int(rng.uniform(start, end) * n)
        length = int(rng.uniform(0.002, 0.008) * SR)
        if i + length >= n:
            continue
        x[i:i + length] += rng.normal(0, 1, length) * np.exp(-np.arange(length) / (length / 4)) * rng.uniform(0.3, 1)
    return band(x, lo, hi)


def fade(x, ms_in=3, ms_out=30):
    a, b = int(ms_in * SR / 1000), int(ms_out * SR / 1000)
    x = x.copy()
    x[:a] *= np.linspace(0, 1, a)
    x[-b:] *= np.linspace(1, 0, b)
    return x


def page_flip():
    dur = 0.55
    n = len(t_axis(dur))
    air = band(rng.normal(0, 1, n), 700, 6500) * env_adsr(n, 0.16, 0.11, peak_at=0.17) * smooth_noise(n, 35)
    crack = crackles(n, 160, 0.0, 0.35) * 0.7
    # "tapa" da folha assentando
    land_at = int(0.33 * SR)
    slap = np.zeros(n)
    m = int(0.06 * SR)
    slap[land_at:land_at + m] = band(rng.normal(0, 1, m), 120, 900) * np.exp(-np.arange(m) / (0.012 * SR))
    return fade(air * 0.6 + crack + slap * 1.2)


def paper_slide():
    dur = 0.7
    n = len(t_axis(dur))
    body = band(rng.normal(0, 1, n), 250, 3800) * env_adsr(n, 0.2, 0.18, peak_at=0.22) * smooth_noise(n, 22)
    grain = crackles(n, 90, 0.05, 0.6, 2000, 6000) * 0.35
    return fade(body + grain, ms_out=60)


def stamp():
    dur = 0.45
    t = t_axis(dur)
    n = len(t)
    freq = 55 + 50 * np.exp(-t / 0.03)  # queda de altura: "tum"
    thump = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.075)
    thock = band(rng.normal(0, 1, n), 280, 1600) * np.exp(-t / 0.018)
    snap = band(rng.normal(0, 1, n), 2500, 7000) * np.exp(-t / 0.006) * 0.5
    # leve "descolar" da borracha
    lift = np.zeros(n)
    i, m = int(0.2 * SR), int(0.05 * SR)
    lift[i:i + m] = band(rng.normal(0, 1, m), 1200, 5000) * np.hanning(m) * 0.12
    return fade(thump * 1.0 + thock * 0.8 + snap + lift, ms_in=1)


def marker():
    dur = 0.5
    n = len(t_axis(dur))
    rub = band(rng.normal(0, 1, n), 2200, 6200) * smooth_noise(n, 45)
    e = np.clip(np.minimum(np.arange(n) / (0.03 * SR), (n - np.arange(n)) / (0.12 * SR)), 0, 1)
    squeak = band(rng.normal(0, 1, n), 3000, 3400, order=2) * 0.6
    return fade((rub + squeak) * e)


def tick():
    dur = 0.12
    t = t_axis(dur)
    x = band(rng.normal(0, 1, len(t)), 900, 4500) * np.exp(-t / 0.008)
    return fade(x, ms_in=1, ms_out=20)


def loudness(x):
    import pyloudnorm as pyln

    pad = np.concatenate([x, np.zeros(max(0, SR - len(x)))])  # janela mínima de 1 s
    return pyln.Meter(SR).integrated_loudness(pad)


# alvo de loudness (janela de 1 s): narração fica em -16,5 LUFS
EFFECTS = {
    "page-flip": (page_flip, -31.0),
    "paper-slide": (paper_slide, -32.0),
    "stamp": (stamp, -29.0),
    "marker": (marker, -33.0),
    "tick": (tick, -33.0),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (fn, target) in EFFECTS.items():
        x = fn()
        x *= 10 ** ((target - loudness(x)) / 20)
        peak = 20 * np.log10(np.max(np.abs(x)))
        sf.write(OUT / f"{name}.wav", x.astype(np.float32), SR, subtype="PCM_16")
        print(f"{name:12s} {len(x) / SR:.2f}s  {target:.0f} LUFS(1s)  pico {peak:.1f} dBFS")


if __name__ == "__main__":
    main()
