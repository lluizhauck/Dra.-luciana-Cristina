"""Monta o cronograma do vídeo a partir da duração real de cada narração.

Lê   assets/data/narration.json  (gerado por narration.py)
Gera assets/data/timeline.js     (window.KAP: tempos das cenas + palavras)
     index.html                  (bloco de <audio> e duração total do vídeo)

Nada de tempo fixo: cada mito/verdade fica na tela o tempo da fala mais as
pausas de leitura definidas abaixo.

Uso: python scripts/build_timeline.py
"""

import json
import re
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NARRATION = json.loads((ROOT / "assets" / "data" / "narration.json").read_text())["lines"]

# pausas (segundos)
OPEN_VO_AT = 0.55          # abertura: narração começa após o logo entrar
OPEN_HOLD = 0.85           # respiro depois do título
SHEET_IN = 0.75            # folha do mito desliza para a mesa
MYTH_LEAD = 0.75           # do início da folha até a voz masculina
STRIKE_AFTER = 0.12        # risco começa logo após a pergunta
STAMP_AFTER = 0.55         # carimbo MITO
TURN_AFTER = 1.45          # página vira (dá tempo de ler o carimbo)
TRUTH_STAMP_AFTER = 0.8    # carimbo VERDADE depois do início da virada
TRUTH_LEAD = 1.15          # do início da virada até a voz feminina
TRUTH_HOLD = 1.3           # leitura da verdade antes da próxima folha
CLOSE_LEAD = 0.8
CLOSE_GAP = 0.75           # entre "Menos boatos..." e o CTA
END_HOLD = 2.2             # CTA parado para leitura


def wav_seconds(path):
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def line(i):
    return NARRATION[i]


def main():
    s = {}
    cues = []  # (id, arquivo, início, volume)

    def vo(key, at):
        cues.append((f"vo-{key}", f"assets/audio/vo/{key}.wav", at, 1.0))
        return at + line(key)["duration"]

    def fx(name, at, vol=1.0):
        cues.append((f"sfx-{name}-{len([c for c in cues if c[0].startswith('sfx-' + name)]) + 1}",
                     f"assets/audio/sfx/{name}.wav", at, vol))

    # abertura
    fx("paper-slide", 0.02)
    s["open"] = {"vo": OPEN_VO_AT, "voEnd": vo("abertura", OPEN_VO_AT)}
    t = s["open"]["voEnd"] + OPEN_HOLD
    s["open"]["out"] = t

    for n in (1, 2, 3):
        m = {"in": t}
        fx("paper-slide", t)
        m["vo"] = t + MYTH_LEAD
        m["voEnd"] = vo(f"mito{n}", m["vo"])
        m["strike"] = m["voEnd"] + STRIKE_AFTER
        fx("marker", m["strike"])
        m["stamp"] = m["voEnd"] + STAMP_AFTER
        fx("stamp", m["stamp"])
        m["turn"] = m["voEnd"] + TURN_AFTER
        fx("page-flip", m["turn"])
        m["truthStamp"] = m["turn"] + TRUTH_STAMP_AFTER
        fx("stamp", m["truthStamp"], 0.85)
        m["truthVo"] = m["turn"] + TRUTH_LEAD
        m["truthVoEnd"] = vo(f"verdade{n}", m["truthVo"])
        m["out"] = m["truthVoEnd"] + TRUTH_HOLD
        s[f"m{n}"] = m
        t = m["out"]

    c = {"in": t}
    fx("paper-slide", t)
    c["vo1"] = t + CLOSE_LEAD
    c["vo1End"] = vo("fim1", c["vo1"])
    boatos = next(w for w in line("fim1")["words"] if w["w"].lower().startswith("boatos"))
    c["boatosStrike"] = c["vo1"] + boatos["end"] - 0.05
    fx("marker", c["boatosStrike"], 0.8)
    c["cta"] = c["vo1End"] + CLOSE_GAP - 0.3
    fx("tick", c["cta"] + 0.25)
    c["vo2"] = c["vo1End"] + CLOSE_GAP
    c["vo2End"] = vo("fim2", c["vo2"])
    c["end"] = c["vo2End"] + END_HOLD
    s["close"] = c
    total = round(c["end"], 2)

    s = json.loads(json.dumps(s), parse_float=lambda v: round(float(v), 3))
    words = {k: v["words"] for k, v in NARRATION.items()}
    js = (
        "// Gerado por scripts/build_timeline.py — não edite à mão.\n"
        f"window.KAP = {json.dumps({'total': total, 'scenes': s, 'words': words}, ensure_ascii=False, indent=1)};\n"
    )
    (ROOT / "assets" / "data" / "timeline.js").write_text(js)

    tags = []
    for cid, src, at, vol in cues:
        track = 10 if cid.startswith("vo-") else (12 if "stamp" in cid else 11)
        tags.append(
            f'      <audio id="{cid}" src="{src}" data-start="{at:.3f}" data-duration="{wav_seconds(ROOT / src):.3f}" '
            f'data-track-index="{track}" data-volume="{vol}"></audio>'
        )
    html_path = ROOT / "index.html"
    html = html_path.read_text()
    html = re.sub(
        r"(<!-- AUDIO:BEGIN.*?-->\n).*?(\s*<!-- AUDIO:END -->)",
        lambda mt: mt.group(1) + "\n".join(tags) + mt.group(2),
        html,
        flags=re.S,
    )
    html = re.sub(r'(id="root"[^>]*?data-duration=")[0-9.]+(")', rf"\g<1>{total}\g<2>", html, flags=re.S)
    html_path.write_text(html)

    print(f"duração total: {total:.2f}s  |  {len(cues)} faixas de áudio")
    for k, v in s.items():
        print(f"  {k:6s} " + "  ".join(f"{a}={b:.2f}" for a, b in v.items()))


if __name__ == "__main__":
    main()
