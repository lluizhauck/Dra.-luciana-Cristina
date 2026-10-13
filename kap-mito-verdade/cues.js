/*
 * Folha de deixas (cue sheet) — fonte única de tempo do vídeo.
 *
 * Lida pela composição (index.html) para posicionar cada animação e pelo
 * gerador da trilha (tools/audio/soundtrack.js) para posicionar cada efeito
 * sonoro. Mudou um tempo aqui? Rode `npm run audio` para regenerar o áudio.
 *
 * Grade musical: 120 BPM, compasso 4/4 => 1 tempo = 0,5 s, 1 compasso = 2 s.
 * Os carimbos caem nos tempos fortes (6, 12, 18 e 25 s).
 */
(function (root) {
  "use strict";

  var C = {
    DURATION: 30,
    BPM: 120,
    TURN: 0.8, // duração de uma virada de página

    // 0–4 s — abertura
    open: {
      sheetIn: 0.0,
      logo: 0.5,
      kicker: 0.85,
      title: [1.05, 1.22, 1.4], // "3 mitos" / "sobre financiar" / "sua casa"
      underline: 1.95,
      index: [2.15, 2.27, 2.39],
      hint: 2.7,
      turn: 3.3,
    },

    // 4–10 s — mito 1 (entrada)
    m1: { strike: 5.4, stamp: 6.0, turn: 6.5, truth: 7.25, out: 9.5 },

    // 10–16 s — mito 2 (burocracia)
    m2: { stamp: 12.0, turn: 12.5, truth: 13.25, docs: 13.6, checks: [14.6, 14.78, 14.96], out: 15.45 },

    // 16–22 s — mito 3 (parcelas)
    m3: { circle: 16.85, strike: 17.4, stamp: 18.0, turn: 18.5, truth: 19.25, scale: 19.55, out: 21.85 },

    // 22–30 s — encerramento
    end: {
      start: 22.7,
      logo: 22.75,
      lines: [23.15, 23.45, 23.7],
      underline: 24.15,
      comente: 24.55,
      simular: 25.0,
      complement: 25.45,
    },
  };

  root.KAP_CUES = C;
  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof window !== "undefined" ? window : globalThis);
