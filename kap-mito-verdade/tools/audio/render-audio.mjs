#!/usr/bin/env node
/*
 * Gera os stems de áudio do vídeo a partir do código (Web Audio API).
 *
 *   npm run audio            (a partir da pasta kap-mito-verdade)
 *
 * 1. Abre tools/audio/render.html no Chrome headless usado pelo HyperFrames.
 * 2. Renderiza música e efeitos com OfflineAudioContext (48 kHz, estéreo).
 * 3. Mede a loudness da mixagem (ffmpeg loudnorm), aplica um ganho global e um
 *    limitador com lookahead calculado sobre a SOMA — o mesmo envelope vai
 *    para os dois stems, então a soma que o HyperFrames mixa fica em ~-14 LUFS
 *    com pico abaixo de -1 dBTP.
 * 4. Grava assets/audio/trilha.wav e assets/audio/efeitos.wav (PCM 16 bits).
 *
 * Variáveis opcionais: CHROME_PATH (executável do Chrome), TARGET_LUFS.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "..", "..");
const outDir = path.join(project, "assets", "audio");
const TARGET = Number(process.env.TARGET_LUFS || -14);
const CEILING = -1.5;

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const out = execFileSync("npx", ["--yes", "hyperframes@0.8.150", "browser", "path"], { cwd: project });
  return out.toString().trim().split("\n").pop();
}

function wav(channels, sr, bits) {
  const frames = channels[0].length;
  const bps = bits / 8;
  const data = Buffer.alloc(frames * channels.length * bps);
  let o = 0;
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      const v = bits === 32 ? ch[i] : Math.max(-1, Math.min(1, ch[i]));
      if (bits === 32) data.writeFloatLE(v, o);
      else data.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), o);
      o += bps;
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(bits === 32 ? 3 : 1, 20);
  h.writeUInt16LE(channels.length, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * channels.length * bps, 28);
  h.writeUInt16LE(channels.length * bps, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Limitador "brick-wall" com lookahead: devolve o envelope de ganho por amostra.
function limiterEnvelope(mix, sr, ceilingDb) {
  const n = mix[0].length;
  const ceil = Math.pow(10, ceilingDb / 20);
  const look = Math.round(sr * 0.003);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pk = Math.max(Math.abs(mix[0][i]), Math.abs(mix[1][i]));
    need[i] = pk > ceil ? ceil / pk : 1;
  }
  const env = new Float32Array(n);
  const att = 1 - Math.exp(-1 / (look / 3));
  const rel = 1 - Math.exp(-1 / (sr * 0.09));
  let cur = 1;
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let j = i, e = Math.min(n, i + look); j < e; j++) if (need[j] < m) m = need[j];
    cur += (m - cur) * (m < cur ? att : rel);
    env[i] = Math.min(cur, need[i]);
  }
  return env;
}

function loudnessOf(file) {
  // o loudnorm escreve o relatório JSON no stderr
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const txt = r.stderr;
  const json = JSON.parse(txt.slice(txt.lastIndexOf("{"), txt.lastIndexOf("}") + 1));
  return { I: Number(json.input_i), TP: Number(json.input_tp), LRA: Number(json.input_lra) };
}

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ["--allow-file-access-from-files", "--no-sandbox"],
});
try {
  const page = await browser.newPage();
  page.on("console", (m) => console.log("[chrome]", m.text()));
  page.on("pageerror", (e) => console.error("[chrome error]", e.message));
  await page.goto(pathToFileURL(path.join(here, "render.html")).href);
  const t0 = Date.now();
  const res = await page.evaluate(async () => {
    const r = await window.KAP_renderSoundtrack(window.KAP_CUES);
    const enc = (buf) =>
      [0, 1].map((c) => {
        const f = buf.getChannelData(c);
        const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
        let s = "";
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      });
    return { sr: r.music.sampleRate, music: enc(r.music), sfx: enc(r.sfx) };
  });
  console.log(`síntese concluída em ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  const dec = (b64) => {
    const b = Buffer.from(b64, "base64");
    return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  };
  const music = res.music.map(dec);
  const sfx = res.sfx.map(dec);
  const mix = [0, 1].map((c) => music[c].map((v, i) => v + sfx[c][i]));

  const tmp = mkdtempSync(path.join(tmpdir(), "kap-audio-"));
  const mixFile = path.join(tmp, "mix.wav");
  writeFileSync(mixFile, wav(mix, res.sr, 32));
  const before = loudnessOf(mixFile);
  // +0,3 dB compensa a pequena perda de loudness do limitador
  const gainDb = TARGET - before.I + 0.3;
  const g = Math.pow(10, gainDb / 20);
  console.log(`mix antes: ${before.I} LUFS, pico ${before.TP} dBTP -> ganho ${gainDb.toFixed(2)} dB + limitador`);
  const env = limiterEnvelope(
    mix.map((ch) => ch.map((v) => v * g)),
    res.sr,
    CEILING - 0.4
  );

  const scale = (chs) => chs.map((ch) => ch.map((v, i) => v * g * env[i]));
  writeFileSync(path.join(outDir, "trilha.wav"), wav(scale(music), res.sr, 16));
  writeFileSync(path.join(outDir, "efeitos.wav"), wav(scale(sfx), res.sr, 16));
  writeFileSync(mixFile, wav(scale(mix), res.sr, 32));
  const after = loudnessOf(mixFile);
  console.log(`mix final: ${after.I} LUFS, pico ${after.TP} dBTP, LRA ${after.LRA} LU`);
  rmSync(tmp, { recursive: true, force: true });
} finally {
  await browser.close();
}
