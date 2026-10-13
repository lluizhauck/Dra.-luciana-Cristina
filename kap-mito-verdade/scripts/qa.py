"""Verificação do MP4 final: formato, volume e posição exata de cada narração.

Uso: python scripts/qa.py [render/kap-mito-verdade.mp4]

- formato: resolução, fps, quadros, codecs (ffprobe)
- volume: loudness integrado e pico verdadeiro (ffmpeg ebur128)
- sincronia: cada narração é localizada na mixagem final por correlação
  cruzada e comparada com o início agendado no index.html
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.signal import correlate

ROOT = Path(__file__).resolve().parent.parent
SR = 16000


def load(path, extra=()):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), *extra, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main():
    mp4 = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "render" / "kap-mito-verdade.mp4"
    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,sample_rate",
         "-of", "json", str(mp4)], capture_output=True, check=True, text=True).stdout)
    for s in probe["streams"]:
        if s["codec_type"] == "video":
            print(f"vídeo  {s['codec_name']} {s['width']}x{s['height']} {s['avg_frame_rate']} fps, {s['nb_frames']} quadros")
        else:
            print(f"áudio  {s['codec_name']} {s['sample_rate']} Hz")
    print(f"duração {float(probe['format']['duration']):.2f} s")

    log = subprocess.run(["ffmpeg", "-v", "info", "-i", str(mp4), "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summary = log[log.rfind("Summary:"):]
    loud = re.search(r"I:\s+(-?[0-9.]+) LUFS", summary).group(1)
    peak = re.search(r"Peak:\s+(-?[0-9.]+) dBFS", summary).group(1)
    print(f"volume {loud} LUFS integrado, pico verdadeiro {peak} dBTP")

    mix = load(mp4, ["-vn"])
    html = (ROOT / "index.html").read_text()
    worst = 0.0
    for m in re.finditer(r'<audio id="vo-(\w+)" src="([^"]+)" data-start="([0-9.]+)"', html):
        key, src, start = m.group(1), m.group(2), float(m.group(3))
        vo = load(ROOT / src)
        a = int((start - 0.5) * SR)
        seg = mix[a: a + len(vo) + SR]
        corr = correlate(seg, vo, mode="valid", method="fft")
        lag = np.argmax(np.abs(corr)) / SR - 0.5
        worst = max(worst, abs(lag))
        print(f"  {key:9s} agendado {start:6.3f} s   desvio {lag * 1000:+6.1f} ms")
    print(f"maior desvio de sincronia: {worst * 1000:.1f} ms")


if __name__ == "__main__":
    main()
