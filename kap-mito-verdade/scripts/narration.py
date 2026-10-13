"""Gera as narrações (Kokoro-82M, pt-BR) e os tempos de cada palavra.

Vozes:  pm_alex  (masculina) -> abertura + mitos
        pf_dora  (feminina)  -> verdades + encerramento

Saídas:
  assets/audio/vo/<id>.wav        48 kHz, mono, loudness igualada (-16 LUFS)
  assets/data/narration.json      duração de cada fala + tempo de cada palavra

Uso:
  python scripts/narration.py            # gera áudio + alinhamento
  python scripts/narration.py --no-align # só áudio (tempos de palavra estimados)

Os modelos são os mesmos que o `npx hyperframes tts` usa (kokoro-onnx v1.0, GitHub).
O alinhamento usa o Parakeet TDT 0.6B v3 (sherpa-onnx) apenas para medir os
tempos de cada palavra; ele não altera o áudio.
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("KAP_MODEL_DIR", ROOT / ".cache" / "models"))
VO_DIR = ROOT / "assets" / "audio" / "vo"
DATA = ROOT / "assets" / "data" / "narration.json"

KOKORO_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
PARAKEET_URL = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/"
    "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2"
)

MALE, FEMALE = "pm_alex", "pf_dora"
SPEED = 1.0  # velocidade natural do modelo, sem aceleração artificial
TARGET_LUFS = -16.0

# id, voz, texto exibido/roteiro, texto falado (ajustes de pronúncia)
LINES = [
    ("abertura", MALE, "Três mitos sobre financiar sua casa.", None),
    ("mito1", MALE, "Preciso ter cem mil reais para dar de entrada?", None),
    ("verdade1", FEMALE, "Você pode utilizar o FGTS e compor renda, conforme as condições do financiamento.", None),
    ("mito2", MALE, "Vou resolver toda a burocracia sozinho?", None),
    ("verdade2", FEMALE, "A KAP auxilia com a documentação técnica da obra.", "A Kápi auxilia com a documentação técnica da obra."),
    ("mito3", MALE, "Financiar é sempre mais caro que alugar?", None),
    ("verdade3", FEMALE, "Compare os valores. A prestação pode ficar próxima do aluguel.", None),
    ("fim1", FEMALE, "Menos boatos. Mais contas no papel.", None),
    ("fim2", FEMALE, "Comente SIMULAR. Receba um diagnóstico real e gratuito no direct.", "Comente SIMULAR. Receba um diagnóstico real e gratuito no dairécti."),
]


def fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        print(f"baixando {url}")
        subprocess.run(["curl", "-fsSL", "-o", str(dest), url], check=True)
    return dest


def kokoro():
    from kokoro_onnx import Kokoro

    model = fetch(KOKORO_URL + "kokoro-v1.0.onnx", CACHE / "kokoro" / "kokoro-v1.0.onnx")
    voices = fetch(KOKORO_URL + "voices-v1.0.bin", CACHE / "kokoro" / "voices-v1.0.bin")
    return Kokoro(str(model), str(voices))


def fix_phonemes(ph):
    # o espeak-ng insere um schwa em encontros como "rm" (conforme -> "con-fó-re-me")
    return re.sub(r"ɾə(?=[mnlbdgptkfsvʃʒ])", "ɾ", ph)


def trim(samples, sr, pad=0.04, thresh_db=-45):
    env = np.abs(samples)
    win = int(sr * 0.01)
    rms = np.sqrt(np.convolve(env**2, np.ones(win) / win, mode="same"))
    loud = np.where(20 * np.log10(rms + 1e-9) > thresh_db)[0]
    if len(loud) == 0:
        return samples
    a = max(0, loud[0] - int(pad * sr))
    b = min(len(samples), loud[-1] + int(pad * sr))
    out = samples[a:b].copy()
    fade = int(0.01 * sr)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def loudness_match(samples, sr):
    import pyloudnorm as pyln

    meter = pyln.Meter(sr)
    gain_db = TARGET_LUFS - meter.integrated_loudness(samples)
    out = samples * (10 ** (gain_db / 20))
    peak = np.max(np.abs(out))
    ceiling = 10 ** (-1.5 / 20)
    if peak > ceiling:  # nunca deixar clipar
        out *= ceiling / peak
    return out


VOWELS = set("aeiouɐæɛɔʊyɪ")


def question_intonation(samples, sr, last_word_start, last_word_phonemes, peak_st=6.5):
    """Entonação de pergunta (sim/não) do português brasileiro na última palavra.

    O Kokoro lê "?" em pt-BR praticamente como ".", com a frase caindo no fim.
    Aqui o F0 da última palavra é redesenhado no padrão L+H* L%: grave no início
    da sílaba tônica, pico no fim da vogal tônica e queda na postônica.
    Só a altura muda (análise/síntese WORLD); duração e timbre continuam iguais,
    e o restante da frase é o áudio original.
    """
    import pyworld as pw
    from scipy.signal import find_peaks

    x = samples.astype(np.float64)
    f0, t = pw.harvest(x, sr, f0_floor=60, f0_ceil=400, frame_period=5.0)
    f0 = pw.stonemask(x, f0, t, sr)
    sp = pw.cheaptrick(x, f0, t, sr)
    ap = pw.d4c(x, f0, t, sr)
    voiced = f0 > 0
    v_end = t[np.where(voiced)[0][-1]]
    median = np.median(f0[(t < last_word_start) & voiced])

    # núcleos silábicos = picos de intensidade da última palavra
    half = int(0.015 * sr)
    rms = np.array([np.sqrt(np.mean(x[max(0, int(tt * sr) - half): int(tt * sr) + half] ** 2)) for tt in t])
    env = np.convolve(20 * np.log10(rms + 1e-6), np.ones(7) / 7, "same")
    window = t >= last_word_start - 0.05
    peaks, _ = find_peaks(np.where(window, env, -120), distance=14, prominence=2.0)
    nuclei = [t[p] for p in peaks if voiced[p]]
    ph = last_word_phonemes.replace("ˌ", "").strip("?.!,")
    after = ph[ph.index("ˈ") + 1:].lstrip("ˈ")
    i = 0
    while i < len(after) and after[i] in VOWELS:
        i += 1
    oxytone = not any(c in VOWELS for c in after[i:])
    stressed = nuclei[-1] if (oxytone or len(nuclei) < 2) else nuclei[-2]

    # contorno alvo em semitons relativos à mediana da frase
    lf = np.where(voiced, np.log(np.maximum(f0, 1.0)), np.nan)
    idx = np.arange(len(lf))
    good = ~np.isnan(lf)
    lf = np.interp(idx, idx[good], lf[good])
    smooth = np.convolve(lf, np.ones(9) / 9, "same")
    micro = lf - smooth  # preserva a microprosódia
    start = last_word_start - 0.03
    v0 = 12 * np.log2(np.exp(smooth[np.searchsorted(t, start)]) / median)
    low = min(v0, -1.5)
    if oxytone:
        pts = [(start, v0), (stressed - 0.07, low), (stressed + 0.07, peak_st), (v_end + 0.02, peak_st - 2)]
    else:
        pts = [(start, v0), (stressed - 0.07, low), (stressed + 0.04, peak_st),
               (nuclei[-1], 1.0), (v_end + 0.02, 0.0)]
    target = np.interp(t, [p[0] for p in pts], [p[1] for p in pts])
    lf_new = np.where(t >= start, np.log(median) + target / 12 * np.log(2) + micro, lf)
    y = pw.synthesize(np.where(voiced, np.exp(lf_new), 0.0), sp, ap, sr, frame_period=5.0)[: len(x)]

    out = x.copy()
    a = int((start - 0.05) * sr)
    n = int(0.04 * sr)
    ramp = np.linspace(0, 1, n)
    out[a: a + n] = x[a: a + n] * (1 - ramp) + y[a: a + n] * ramp
    out[a + n:] = y[a + n: len(x)]
    info = {"stressed_at": round(float(stressed), 3), "oxytone": bool(oxytone), "peak_st": peak_st}
    return out.astype(np.float32), info


def to_48k(src, dst):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", "aresample=48000:resampler=soxr",
         "-ac", "1", "-c:a", "pcm_s16le", str(dst)],
        check=True,
    )


def norm(word):
    word = unicodedata.normalize("NFD", word.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in word if unicodedata.category(c) != "Mn"))


def recognizer():
    import sherpa_onnx

    d = CACHE / "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8"
    if not d.exists():
        tar = fetch(PARAKEET_URL, CACHE / "parakeet.tar.bz2")
        subprocess.run(["tar", "-xjf", str(tar), "-C", str(CACHE)], check=True)
    return sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(d / "encoder.int8.onnx"), decoder=str(d / "decoder.int8.onnx"),
        joiner=str(d / "joiner.int8.onnx"), tokens=str(d / "tokens.txt"),
        model_type="nemo_transducer", num_threads=4,
    )


def align(rec, wav_path, script_text, duration):
    """Tempo de início de cada palavra do roteiro, a partir dos tokens do ASR."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(wav_path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    stream = rec.create_stream()
    stream.accept_waveform(16000, np.frombuffer(raw, dtype=np.float32))
    rec.decode_stream(stream)
    res = stream.result

    asr_words = []  # (texto, início)
    for tok, t in zip(res.tokens, res.timestamps):
        if tok.startswith(" ") or not asr_words:
            asr_words.append([tok.strip(), t])
        else:
            asr_words[-1][0] += tok
    asr_words = [(w, t) for w, t in asr_words if norm(w)]

    script_words = script_text.split()
    a = [norm(w) for w in script_words]
    b = [norm(w) for w, _ in asr_words]
    starts = [None] * len(a)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            starts[blk.a + k] = float(asr_words[blk.b + k][1])

    # palavras não reconhecidas: interpolação pelo número de letras
    known = [(i, s) for i, s in enumerate(starts) if s is not None]
    if not known:
        known = [(0, 0.0)]
    anchors = [(-1, 0.0)] + known + [(len(a), duration)]
    for (i0, t0), (i1, t1) in zip(anchors, anchors[1:]):
        gap = list(range(i0 + 1, i1))
        if not gap:
            continue
        lens = [max(1, len(a[i])) for i in range(max(i0, 0), i1)]
        total = sum(lens) or 1
        acc = 0
        base = max(i0, 0)
        for i in gap:
            acc = sum(lens[: i - base])
            starts[i] = t0 + (t1 - t0) * acc / total
    words = []
    for i, w in enumerate(script_words):
        end = starts[i + 1] if i + 1 < len(script_words) else duration
        words.append({"w": w, "start": round(starts[i], 3), "end": round(max(end, starts[i] + 0.08), 3)})
    return res.text, words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-align", action="store_true")
    args = ap.parse_args()

    VO_DIR.mkdir(parents=True, exist_ok=True)
    tts = kokoro()
    rec = None if args.no_align else recognizer()
    out = {"engine": "kokoro-v1.0 (kokoro-onnx)", "speed": SPEED, "lufs": TARGET_LUFS, "lines": {}}

    for line_id, voice, text, spoken in LINES:
        spoken = spoken or text
        ph = fix_phonemes(tts.tokenizer.phonemize(spoken, "pt-br"))
        samples, sr = tts.create(ph, voice=voice, speed=SPEED, is_phonemes=True)
        samples = trim(samples, sr)
        duration = len(samples) / sr
        tmp = VO_DIR / f"{line_id}.24k.wav"
        entry = {"voice": voice, "text": text, "spoken": spoken, "phonemes": ph, "duration": round(duration, 3)}
        if text.endswith("?"):
            if rec:
                sf.write(tmp, samples, sr, subtype="FLOAT")
                last_start = align(rec, tmp, text, duration)[1][-1]["start"]
            else:  # estimativa proporcional ao número de letras
                last_start = duration * (1 - len(text.split()[-1]) / len(text)) - 0.05
            samples, entry["question_intonation"] = question_intonation(samples, sr, last_start, ph.split()[-1])
        samples = loudness_match(samples, sr)
        sf.write(tmp, samples, sr, subtype="FLOAT")
        dst = VO_DIR / f"{line_id}.wav"
        to_48k(tmp, dst)
        tmp.unlink()
        if rec:
            heard, words = align(rec, dst, text, duration)
            entry["asr"] = heard
            entry["words"] = words
        out["lines"][line_id] = entry
        print(f"{line_id:9s} {voice}  {duration:5.2f}s  {entry.get('asr', '')}")

    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"ok -> {DATA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
