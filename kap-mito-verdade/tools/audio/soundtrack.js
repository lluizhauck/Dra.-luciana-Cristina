/*
 * Trilha original da KAP — Mito x Verdade.
 * 100% sintetizada com a Web Audio API (OfflineAudioContext), sem samples.
 *
 *   window.KAP_renderSoundtrack(cues) -> Promise<{ music: AudioBuffer, sfx: AudioBuffer }>
 *
 * Música: 120 BPM, Fá maior, piano elétrico FM + marimba + baixo + percussão
 * leve "de papel". Efeitos: papel deslizando, virada de página, impressão,
 * carimbo, marcador, lápis, fita adesiva. Todo ruído usa PRNG com seed fixa,
 * então a renderização é reproduzível.
 */
(function () {
  "use strict";

  var SR = 48000;
  var BEAT = 0.5;
  var BAR = 2;

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mtof(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // ------------------------------------------------------------------
  // Infra comum
  // ------------------------------------------------------------------
  function makeCtx(duration, seed) {
    var ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
    var rnd = mulberry32(seed);
    var noiseLen = SR * 4;
    var noise = ctx.createBuffer(2, noiseLen, SR);
    for (var ch = 0; ch < 2; ch++) {
      var d = noise.getChannelData(ch);
      for (var i = 0; i < noiseLen; i++) d[i] = rnd() * 2 - 1;
    }
    // resposta ao impulso de uma sala pequena e quente
    var irLen = Math.floor(SR * 2.4);
    var ir = ctx.createBuffer(2, irLen, SR);
    for (var c = 0; c < 2; c++) {
      var x = ir.getChannelData(c);
      var lp = 0;
      for (var j = 0; j < irLen; j++) {
        var tt = j / SR;
        var n = rnd() * 2 - 1;
        lp += (n - lp) * (0.35 - 0.25 * Math.min(1, tt / 1.6)); // escurece com o tempo
        x[j] = lp * Math.exp(-tt / 0.55) * (tt < 0.012 ? tt / 0.012 : 1);
      }
    }
    var reverb = ctx.createConvolver();
    reverb.buffer = ir;
    var revReturn = ctx.createGain();
    revReturn.gain.value = 0.9;
    reverb.connect(revReturn);
    return { ctx: ctx, rnd: rnd, noise: noise, reverb: reverb, revReturn: revReturn };
  }

  function noiseSrc(E, t, dur) {
    var s = E.ctx.createBufferSource();
    s.buffer = E.noise;
    var off = E.rnd() * (E.noise.duration - dur - 0.1);
    s.start(t, Math.max(0, off), dur + 0.05);
    return s;
  }
  function filt(E, type, freq, q) {
    var f = E.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }
  function gainNode(E, v) {
    var g = E.ctx.createGain();
    g.gain.value = v === undefined ? 1 : v;
    return g;
  }
  function panner(E, v) {
    var p = E.ctx.createStereoPanner();
    p.pan.value = v || 0;
    return p;
  }
  // envelope ataque/decaimento exponencial
  function adEnv(param, t, peak, attack, decayTau, end) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.setTargetAtTime(0, t + attack, decayTau);
    if (end) param.setValueAtTime(0, end);
  }
  function connectOut(E, node, out, send) {
    node.connect(out);
    if (send) {
      var s = gainNode(E, send);
      node.connect(s);
      s.connect(E.reverb);
    }
  }

  // ==================================================================
  // MÚSICA
  // ==================================================================
  var CH = {
    Fmaj9: { bass: 41, v: [53, 57, 60, 64, 67] },
    Dm9: { bass: 38, v: [53, 57, 60, 64, 65] },
    Bbmaj9: { bass: 46, v: [50, 53, 57, 60, 62] },
    Cadd9: { bass: 48, v: [52, 55, 60, 62, 67] },
    Am7: { bass: 45, v: [52, 55, 57, 60, 64] },
    Gm9: { bass: 43, v: [50, 53, 57, 58, 62] },
    Csus: { bass: 48, v: [53, 55, 60, 62, 65] },
    FA: { bass: 45, v: [53, 57, 60, 64, 69] },
    Fadd9: { bass: 41, v: [53, 57, 60, 67, 69] },
  };
  // um acorde por compasso (2 s); alguns compassos dividem em dois
  var PROG = [
    ["Fmaj9"], ["Dm9"],                       // 0–4 abertura
    ["Bbmaj9"], ["Cadd9"], ["Am7"],           // 4–10 mito 1 (carimbo em 6)
    ["Bbmaj9"], ["FA"], ["Gm9", "Csus"],      // 10–16 mito 2 (carimbo em 12)
    ["Bbmaj9"], ["Am7"], ["Gm9", "Csus"],     // 16–22 mito 3 (carimbo em 18)
    ["Fmaj9"], ["Bbmaj9"], ["Gm9", "Cadd9"],  // 22–28 encerramento
    ["Fadd9"],                                // 28–30 resolução
  ];
  function chordAt(t) {
    var b = Math.min(PROG.length - 1, Math.floor(t / BAR));
    var bar = PROG[b];
    var half = bar.length > 1 && t - b * BAR >= BAR / 2 ? 1 : 0;
    return CH[bar[half]];
  }

  function epVoice(E, out, t, midi, dur, vel, pan) {
    var ctx = E.ctx;
    var f = mtof(midi);
    var car = ctx.createOscillator();
    car.frequency.value = f;
    var mod = ctx.createOscillator();
    mod.frequency.value = f;
    var mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2 * vel, t);
    mg.gain.setTargetAtTime(f * 0.18, t, 0.25);
    mod.connect(mg);
    mg.connect(car.frequency);
    var tine = ctx.createOscillator();
    tine.frequency.value = f * 7.02;
    var tg = gainNode(E, 0);
    adEnv(tg.gain, t, 0.05 * vel, 0.002, 0.05);
    tine.connect(tg);
    var amp = gainNode(E, 0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.13 * vel, t + 0.006);
    amp.gain.setTargetAtTime(0.045 * vel, t + 0.006, 0.6);
    amp.gain.setTargetAtTime(0, t + dur, 0.18);
    car.connect(amp);
    tg.connect(amp);
    var lp = filt(E, "lowpass", 3200, 0.4);
    var hp = filt(E, "highpass", 150, 0.6); // corta o DC/subgrave gerado pela FM
    var p = panner(E, pan || 0);
    amp.connect(lp);
    lp.connect(hp);
    hp.connect(p);
    connectOut(E, p, out, 0.28);
    var stop = t + dur + 1.2;
    [car, mod, tine].forEach(function (o) {
      o.start(t);
      o.stop(stop);
    });
  }
  function epChord(E, out, t, chord, dur, vel) {
    chord.v.forEach(function (m, i) {
      var strum = i * 0.012;
      epVoice(E, out, t + strum, m, dur - strum, vel * (i === 0 ? 0.9 : 0.75), (i - 2) * 0.12);
    });
  }

  function marimba(E, out, t, midi, vel, pan) {
    var ctx = E.ctx;
    var f = mtof(midi);
    var o1 = ctx.createOscillator();
    o1.frequency.value = f;
    var o2 = ctx.createOscillator();
    o2.frequency.value = f * 3.93;
    var g1 = gainNode(E, 0);
    var g2 = gainNode(E, 0);
    adEnv(g1.gain, t, 0.16 * vel, 0.002, 0.16);
    adEnv(g2.gain, t, 0.05 * vel, 0.001, 0.025);
    o1.connect(g1);
    o2.connect(g2);
    var p = panner(E, pan || 0);
    g1.connect(p);
    g2.connect(p);
    connectOut(E, p, out, 0.22);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1.2);
    o2.stop(t + 0.3);
  }

  function bassNote(E, out, t, midi, dur, vel) {
    var ctx = E.ctx;
    var f = mtof(midi);
    var o = ctx.createOscillator();
    o.frequency.value = f;
    var tri = ctx.createOscillator();
    tri.type = "triangle";
    tri.frequency.value = f;
    var tg = gainNode(E, 0.35);
    tri.connect(tg);
    var amp = gainNode(E, 0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.3 * vel, t + 0.012);
    amp.gain.setTargetAtTime(0.19 * vel, t + 0.012, 0.2);
    amp.gain.setTargetAtTime(0, t + dur, 0.05);
    o.connect(amp);
    tg.connect(amp);
    var lp = filt(E, "lowpass", 520, 0.6);
    amp.connect(lp);
    lp.connect(out);
    o.start(t);
    tri.start(t);
    o.stop(t + dur + 0.4);
    tri.stop(t + dur + 0.4);
  }

  function kick(E, out, t, vel) {
    var ctx = E.ctx;
    var o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    var g = gainNode(E, 0);
    adEnv(g.gain, t, 0.68 * vel, 0.002, 0.08);
    o.connect(g);
    var lp = filt(E, "lowpass", 900);
    g.connect(lp);
    lp.connect(out);
    o.start(t);
    o.stop(t + 0.6);
  }
  function snap(E, out, t, vel, pan) {
    var p = panner(E, pan || 0);
    connectOut(E, p, out, 0.35);
    [0, 0.009, 0.019].forEach(function (d, i) {
      var n = noiseSrc(E, t + d, 0.2);
      var bp = filt(E, "bandpass", 1700 + i * 250, 1.1);
      var g = gainNode(E, 0);
      adEnv(g.gain, t + d, (i === 2 ? 0.34 : 0.22) * vel, 0.001, i === 2 ? 0.045 : 0.008);
      n.connect(bp);
      bp.connect(g);
      g.connect(p);
    });
  }
  function shaker(E, out, t, vel, pan) {
    var n = noiseSrc(E, t, 0.12);
    var hp = filt(E, "highpass", 6500, 0.7);
    var g = gainNode(E, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.012);
    g.gain.setTargetAtTime(0, t + 0.012, 0.022);
    var p = panner(E, pan || 0);
    n.connect(hp);
    hp.connect(g);
    g.connect(p);
    p.connect(out);
  }
  function rim(E, out, t, vel) {
    var o = E.ctx.createOscillator();
    o.frequency.value = 1750;
    var g = gainNode(E, 0);
    adEnv(g.gain, t, 0.06 * vel, 0.0008, 0.012);
    o.connect(g);
    connectOut(E, g, out, 0.2);
    o.start(t);
    o.stop(t + 0.1);
  }
  function padChord(E, out, t, chord, dur, vel) {
    var ctx = E.ctx;
    var lp = filt(E, "lowpass", 950, 0.3);
    var g = gainNode(E, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022 * vel, t + 0.7);
    g.gain.setValueAtTime(0.022 * vel, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    lp.connect(g);
    connectOut(E, g, out, 0.5);
    chord.v.slice(0, 4).forEach(function (m) {
      [-7, 7].forEach(function (cents) {
        var o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(m);
        o.detune.value = cents;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.7);
      });
    });
  }
  function bell(E, out, t, midi, vel, len) {
    var ctx = E.ctx;
    var f = mtof(midi);
    var p = panner(E, 0.08);
    connectOut(E, p, out, 0.45);
    [
      [1, 0.1, len || 1.1],
      [2.76, 0.03, 0.35],
      [5.4, 0.012, 0.12],
    ].forEach(function (h) {
      var o = ctx.createOscillator();
      o.frequency.value = f * h[0];
      var g = gainNode(E, 0);
      adEnv(g.gain, t, h[1] * vel, 0.002, h[2]);
      o.connect(g);
      g.connect(p);
      o.start(t);
      o.stop(t + h[2] * 6 + 0.1);
    });
  }
  function riser(E, out, t, dur) {
    var n = noiseSrc(E, t, dur);
    var bp = filt(E, "bandpass", 300, 2.2);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
    var g = gainNode(E, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + dur * 0.92);
    g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp);
    bp.connect(g);
    connectOut(E, g, out, 0.4);
  }

  function renderMusic(C) {
    var E = makeCtx(C.DURATION, 1207);
    var ctx = E.ctx;
    var master = gainNode(E, 1);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.012;
    comp.release.value = 0.25;
    comp.knee.value = 8;
    var bus = gainNode(E, 1);
    var hpf = filt(E, "highpass", 38, 0.7);
    bus.connect(hpf);
    hpf.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    E.revReturn.connect(bus);

    // dinâmica geral + "abaixa" a música nos carimbos (dá espaço ao impacto)
    var mg = master.gain;
    mg.setValueAtTime(0.0001, 0);
    mg.exponentialRampToValueAtTime(0.85, 0.35);
    mg.setValueAtTime(0.85, 3.9);
    mg.linearRampToValueAtTime(1, 4.0);
    [C.m1.stamp, C.m2.stamp, C.m3.stamp, C.end.simular].forEach(function (s) {
      mg.setValueAtTime(1, s - 0.02);
      mg.linearRampToValueAtTime(0.55, s + 0.01);
      mg.setTargetAtTime(1, s + 0.06, 0.22);
      mg.setValueAtTime(1, s + 0.9);
    });
    mg.setValueAtTime(1, 28.2);
    mg.linearRampToValueAtTime(0.0001, C.DURATION - 0.05);

    var stampBars = [C.m1.stamp, C.m2.stamp, C.m3.stamp].map(function (s) {
      return Math.round(s / BAR);
    });
    function isBreak(t) {
      // silencia bumbo/caixa nos 2 tempos antes de cada carimbo
      return stampBars.some(function (b) {
        return t >= b * BAR - 1.0 - 1e-6 && t < b * BAR - 1e-6;
      });
    }

    for (var b = 0; b < PROG.length; b++) {
      var t0 = b * BAR;
      var parts = PROG[b];
      var segLen = BAR / parts.length;
      parts.forEach(function (name, pi) {
        var ch = CH[name];
        var ts = t0 + pi * segLen;
        var section = ts < 4 ? "intro" : ts < 22 ? "groove" : ts < 28 ? "end" : "final";
        // pad
        padChord(E, bus, ts, ch, segLen, section === "intro" ? 0.8 : 1);
        // piano elétrico
        if (section === "intro" || section === "final") {
          epChord(E, bus, ts, ch, section === "final" ? 2.0 : segLen, section === "final" ? 1.0 : 0.85);
        } else if (section === "groove") {
          var hits = parts.length > 1 ? [0, 0.75] : [0, 0.75, 1.5];
          hits.forEach(function (h, hi) {
            if (hi > 0 && isBreak(ts + h)) return;
            epChord(E, bus, ts + h, ch, hi === 0 ? 0.62 : 0.4, hi === 0 ? 0.9 : 0.62);
          });
        } else {
          epChord(E, bus, ts, ch, segLen * 0.95, 0.9);
          if (parts.length === 1) epChord(E, bus, ts + 1.25, ch, 0.6, 0.55);
        }
      });
    }

    // marimba: arpejo em colcheias (0,25 s) — dá o "andamento de papelaria"
    var arpPattern = [0, 2, 1, 3, 2, 4, 3, 1];
    for (var s = 0; s < 28 / 0.25; s++) {
      var t = s * 0.25;
      if (t < 0.5) continue;
      var ch = chordAt(t);
      var notes = ch.v.map(function (m) { return m + 12; });
      var idx = arpPattern[s % arpPattern.length] % notes.length;
      var vel = s % 2 === 0 ? 0.9 : 0.6;
      if (t < 4) vel *= 0.75;
      if (isBreak(t) && s % 2 === 1) continue;
      if (t >= 21.5 && t < 22) vel *= 1 + (t - 21.5) * 0.8;
      marimba(E, bus, t, notes[idx], vel, s % 2 === 0 ? -0.25 : 0.25);
    }

    // baixo e bateria a partir dos 4 s
    for (var bb = 2; bb < 14; bb++) {
      var tb = bb * BAR;
      var parts2 = PROG[bb];
      parts2.forEach(function (name, pi) {
        var ch2 = CH[name];
        var ts2 = tb + pi * (BAR / parts2.length);
        var lenSeg = BAR / parts2.length;
        bassNote(E, bus, ts2, ch2.bass, lenSeg > 1 ? 0.62 : 0.45, 1);
        if (lenSeg > 1 && !isBreak(ts2 + 0.75)) bassNote(E, bus, ts2 + 0.75, ch2.bass + 12, 0.2, 0.55);
        if (lenSeg > 1 && !isBreak(ts2 + 1.25)) bassNote(E, bus, ts2 + 1.25, ch2.bass + 7, 0.5, 0.75);
      });
      for (var beat = 0; beat < 4; beat++) {
        var tt = tb + beat * BEAT;
        var brk = isBreak(tt);
        var endSec = tt >= 22;
        if (!brk && (beat === 0 || beat === 2)) kick(E, bus, tt, endSec ? 0.8 : 0.9);
        if (!brk && beat === 2 && !endSec) kick(E, bus, tt + 0.375, 0.45);
        if (!brk && (beat === 1 || beat === 3)) snap(E, bus, tt, endSec ? 0.75 : 0.9, beat === 1 ? -0.1 : 0.1);
        for (var sx = 0; sx < 4; sx++) {
          var tsx = tt + sx * 0.125;
          var acc = sx === 2 ? 1 : sx === 0 ? 0.7 : 0.4;
          shaker(E, bus, tsx, (brk ? 0.5 : 1) * acc, 0.35);
        }
        if (!brk && beat === 3 && bb % 2 === 1) rim(E, bus, tt + 0.25, 0.9);
      }
    }
    // pequena virada antes do encerramento + subida
    [21.5, 21.625, 21.75, 21.8125, 21.875, 21.9375].forEach(function (t, i) {
      snap(E, bus, t, 0.35 + i * 0.1, i % 2 ? 0.2 : -0.2);
    });
    riser(E, bus, 20.4, 1.55);
    kick(E, bus, 22.0, 1.0);

    // melodia de sino no encerramento
    var MEL = [
      [22.0, 72, 0.9], [22.25, 69, 0.7], [22.5, 72, 0.8], [22.75, 76, 1.0],
      [24.0, 74, 0.9], [24.25, 72, 0.7], [24.5, 69, 0.8], [24.75, 74, 1.0],
      [26.0, 70, 0.9], [26.25, 69, 0.7], [26.5, 67, 0.8], [27.0, 72, 0.9], [27.5, 74, 0.8],
      [28.0, 72, 1.0], [28.0, 81, 0.5],
    ];
    MEL.forEach(function (n) {
      bell(E, bus, n[0], n[1], n[2], n[0] >= 28 ? 2.2 : 1.1);
    });
    // marimba suave na resolução
    [28.0, 28.25, 28.5, 28.75, 29.0].forEach(function (t, i) {
      marimba(E, bus, t, [65, 69, 72, 77, 81][i], 0.6 - i * 0.08, i % 2 ? 0.3 : -0.3);
    });

    return ctx.startRendering();
  }

  // ==================================================================
  // EFEITOS SONOROS
  // ==================================================================
  function whoosh(E, out, t, dur, o) {
    o = o || {};
    var n = noiseSrc(E, t, dur);
    var bp = filt(E, "bandpass", o.f0 || 500, o.q || 0.9);
    bp.frequency.setValueAtTime(o.f0 || 500, t);
    bp.frequency.exponentialRampToValueAtTime(o.f1 || 2600, t + dur * (o.peakAt || 0.55));
    bp.frequency.exponentialRampToValueAtTime(o.f2 || 900, t + dur);
    var g = gainNode(E, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.3, t + dur * (o.peakAt || 0.55));
    g.gain.linearRampToValueAtTime(0, t + dur);
    var p = E.ctx.createStereoPanner();
    p.pan.setValueAtTime(o.p0 || 0, t);
    p.pan.linearRampToValueAtTime(o.p1 || 0, t + dur);
    n.connect(bp);
    bp.connect(g);
    g.connect(p);
    connectOut(E, p, out, o.send || 0.15);
  }
  function crackle(E, out, t, dur, count, vol, pan) {
    for (var i = 0; i < count; i++) {
      var ti = t + E.rnd() * dur;
      var n = noiseSrc(E, ti, 0.02);
      var hp = filt(E, "bandpass", 2500 + E.rnd() * 4000, 1.5);
      var g = gainNode(E, 0);
      adEnv(g.gain, ti, (vol || 0.12) * (0.5 + E.rnd() * 0.5), 0.0005, 0.004 + E.rnd() * 0.006);
      var p = panner(E, (pan || 0) + (E.rnd() - 0.5) * 0.4);
      n.connect(hp);
      hp.connect(g);
      g.connect(p);
      p.connect(out);
    }
  }
  function thud(E, out, t, vol, freq) {
    var o = E.ctx.createOscillator();
    o.frequency.setValueAtTime((freq || 110) * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq || 110, t + 0.05);
    var g = gainNode(E, 0);
    adEnv(g.gain, t, 0.5 * vol, 0.002, 0.06);
    o.connect(g);
    var n = noiseSrc(E, t, 0.12);
    var lp = filt(E, "lowpass", 700, 0.7);
    var ng = gainNode(E, 0);
    adEnv(ng.gain, t, 0.45 * vol, 0.001, 0.025);
    n.connect(lp);
    lp.connect(ng);
    connectOut(E, g, out, 0.2);
    connectOut(E, ng, out, 0.2);
    o.start(t);
    o.stop(t + 0.5);
  }
  function pageTurn(E, out, t, dur, vol, dir) {
    vol = vol || 1;
    var d = dir || 1;
    crackle(E, out, t, 0.14, 7, 0.1 * vol, 0.4 * d);
    // "flap" principal com tremulação de papel
    var n = noiseSrc(E, t, dur);
    var bp = filt(E, "bandpass", 700, 0.8);
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(3400, t + dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(1100, t + dur);
    var g = gainNode(E, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32 * vol, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0, t + dur * 0.98);
    var trem = E.ctx.createOscillator();
    trem.frequency.setValueAtTime(14, t);
    trem.frequency.linearRampToValueAtTime(26, t + dur);
    var tg = gainNode(E, 0.12 * vol);
    trem.connect(tg);
    tg.connect(g.gain);
    var p = E.ctx.createStereoPanner();
    p.pan.setValueAtTime(0.45 * d, t);
    p.pan.linearRampToValueAtTime(-0.45 * d, t + dur);
    n.connect(bp);
    bp.connect(g);
    g.connect(p);
    connectOut(E, p, out, 0.18);
    trem.start(t);
    trem.stop(t + dur + 0.05);
    // pousa do outro lado
    var land = t + dur * 0.93;
    var ln = noiseSrc(E, land, 0.1);
    var lbp = filt(E, "bandpass", 1300, 0.9);
    var lg = gainNode(E, 0);
    adEnv(lg.gain, land, 0.16 * vol, 0.002, 0.03);
    var lp2 = panner(E, -0.5 * d);
    ln.connect(lbp);
    lbp.connect(lg);
    lg.connect(lp2);
    connectOut(E, lp2, out, 0.2);
  }
  function stamp(E, out, impact, big) {
    var k = big ? 1.25 : 1;
    // aproximação
    whoosh(E, out, impact - 0.16, 0.17, { f0: 300, f1: 1400, f2: 1600, peakAt: 0.95, vol: 0.12 * k, send: 0.05 });
    // golpe grave
    var o = E.ctx.createOscillator();
    o.frequency.setValueAtTime(96, impact);
    o.frequency.exponentialRampToValueAtTime(42, impact + 0.22);
    var og = gainNode(E, 0);
    adEnv(og.gain, impact, 0.95 * k, 0.0015, 0.11);
    o.connect(og);
    connectOut(E, og, out, 0.12);
    o.start(impact);
    o.stop(impact + 0.9);
    // "toc" de madeira + borracha
    var n = noiseSrc(E, impact, 0.2);
    var lp = filt(E, "lowpass", 1250, 0.8);
    var ng = gainNode(E, 0);
    adEnv(ng.gain, impact, 0.85 * k, 0.0008, 0.035);
    n.connect(lp);
    lp.connect(ng);
    connectOut(E, ng, out, 0.45);
    var body = E.ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(240, impact);
    body.frequency.exponentialRampToValueAtTime(170, impact + 0.06);
    var bg = gainNode(E, 0);
    adEnv(bg.gain, impact, 0.32 * k, 0.001, 0.03);
    body.connect(bg);
    connectOut(E, bg, out, 0.3);
    body.start(impact);
    body.stop(impact + 0.3);
    // papel chacoalha
    crackle(E, out, impact + 0.01, 0.12, 6, 0.08 * k, 0);
  }
  function scribble(E, out, t, dur, o) {
    // marcador/lápis: ruído filtrado com granulação irregular
    o = o || {};
    var n = noiseSrc(E, t, dur + 0.05);
    var bp = filt(E, "bandpass", o.freq || 3600, o.q || 1.6);
    bp.frequency.setValueAtTime((o.freq || 3600) * 0.85, t);
    bp.frequency.linearRampToValueAtTime((o.freq || 3600) * 1.12, t + dur);
    var g = gainNode(E, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.12, t + 0.02);
    g.gain.setValueAtTime(o.vol || 0.12, t + dur - 0.04);
    g.gain.linearRampToValueAtTime(0, t + dur);
    // granulação
    var grain = noiseSrc(E, t, dur + 0.05);
    var glp = filt(E, "lowpass", o.grainHz || 38, 0.5);
    var gg = gainNode(E, (o.vol || 0.12) * 2.6);
    grain.connect(glp);
    glp.connect(gg);
    gg.connect(g.gain);
    var p = panner(E, o.pan || 0.1);
    n.connect(bp);
    bp.connect(g);
    g.connect(p);
    connectOut(E, p, out, 0.1);
    if (o.body) {
      var n2 = noiseSrc(E, t, dur);
      var bp2 = filt(E, "bandpass", 900, 1.2);
      var g2 = gainNode(E, 0);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(o.vol * 0.35, t + 0.03);
      g2.gain.linearRampToValueAtTime(0, t + dur);
      n2.connect(bp2);
      bp2.connect(g2);
      g2.connect(p);
    }
  }
  function ticks(E, out, t, count, spacing, vol, jitter) {
    for (var i = 0; i < count; i++) {
      var ti = t + i * spacing + (E.rnd() - 0.5) * (jitter || 0.006);
      var n = noiseSrc(E, ti, 0.02);
      var hp = filt(E, "bandpass", 2600 + E.rnd() * 900, 2.5);
      var g = gainNode(E, 0);
      adEnv(g.gain, ti, (vol || 0.09) * (0.7 + E.rnd() * 0.3), 0.0005, 0.005);
      n.connect(hp);
      hp.connect(g);
      var o = E.ctx.createOscillator();
      o.frequency.value = 2200 + E.rnd() * 300;
      var og = gainNode(E, 0);
      adEnv(og.gain, ti, (vol || 0.09) * 0.25, 0.0004, 0.004);
      o.connect(og);
      var p = panner(E, (E.rnd() - 0.5) * 0.3);
      g.connect(p);
      og.connect(p);
      connectOut(E, p, out, 0.08);
      o.start(ti);
      o.stop(ti + 0.05);
    }
  }
  function swish(E, out, t, vol) {
    whoosh(E, out, t, 0.22, { f0: 1800, f1: 5200, f2: 3000, peakAt: 0.3, vol: vol || 0.05, q: 0.7, send: 0.1 });
  }
  function tape(E, out, t) {
    scribble(E, out, t, 0.11, { freq: 2400, q: 0.8, vol: 0.07, grainHz: 120 });
    crackle(E, out, t, 0.1, 5, 0.06, 0.1);
  }
  function pluck(E, out, t, midi) {
    var o = E.ctx.createOscillator();
    o.frequency.value = mtof(midi);
    var g = gainNode(E, 0);
    adEnv(g.gain, t, 0.09, 0.002, 0.14);
    var o2 = E.ctx.createOscillator();
    o2.frequency.value = mtof(midi) * 3.93;
    var g2 = gainNode(E, 0);
    adEnv(g2.gain, t, 0.025, 0.001, 0.02);
    o.connect(g);
    o2.connect(g2);
    connectOut(E, g, out, 0.3);
    connectOut(E, g2, out, 0.3);
    o.start(t);
    o2.start(t);
    o.stop(t + 1);
    o2.stop(t + 0.2);
  }
  function tink(E, out, t, vol) {
    var o = E.ctx.createOscillator();
    o.frequency.value = 3100;
    var g = gainNode(E, 0);
    adEnv(g.gain, t, vol || 0.03, 0.001, 0.06);
    o.connect(g);
    connectOut(E, g, out, 0.4);
    o.start(t);
    o.stop(t + 0.5);
  }

  function renderSfx(C) {
    var E = makeCtx(C.DURATION, 9001);
    var ctx = E.ctx;
    var out = gainNode(E, 1);
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -9;
    lim.knee.value = 2;
    lim.ratio.value = 14;
    lim.attack.value = 0.002;
    lim.release.value = 0.12;
    out.connect(lim);
    lim.connect(ctx.destination);
    E.revReturn.connect(out);
    var O = C.open, M1 = C.m1, M2 = C.m2, M3 = C.m3, EN = C.end, TURN = C.TURN;

    // ---- abertura
    whoosh(E, out, O.sheetIn, 0.75, { f0: 350, f1: 2200, f2: 700, peakAt: 0.35, vol: 0.34, p0: 0, p1: 0 });
    crackle(E, out, 0.5, 0.25, 6, 0.05, 0);
    thud(E, out, O.logo + 0.08, 0.55, 130);
    tape(E, out, O.logo + 0.33);
    tape(E, out, O.logo + 0.42);
    ticks(E, out, O.kicker + 0.08, 9, 0.035, 0.07);
    ticks(E, out, O.kicker + 0.22, 9, 0.035, 0.06);
    thud(E, out, O.title[0] + 0.1, 0.6, 80);
    swish(E, out, O.title[0] + 0.08, 0.05);
    swish(E, out, O.title[1], 0.05);
    swish(E, out, O.title[2], 0.06);
    scribble(E, out, O.underline, 0.45, { freq: 3300, vol: 0.13, body: true });
    O.index.forEach(function (t) { ticks(E, out, t + 0.04, 3, 0.03, 0.08); });
    scribble(E, out, O.hint, 0.5, { freq: 5200, q: 1.2, vol: 0.06, grainHz: 55 });
    pageTurn(E, out, O.turn, TURN, 1, 1);

    // ---- mito 1
    scribble(E, out, O.turn + 0.7, 0.55, { freq: 5200, q: 1.2, vol: 0.06, grainHz: 55 });
    [0, 1, 2].forEach(function (i) {
      scribble(E, out, M1.strike + i * 0.13, 0.3, { freq: 3500, vol: 0.14, body: true, pan: -0.15 + i * 0.15 });
    });
    stamp(E, out, M1.stamp, false);
    pageTurn(E, out, M1.turn, TURN, 1, 1);
    // verdade 1
    stamp(E, out, M1.truth, false);
    swish(E, out, M1.truth + 0.12, 0.05);
    thud(E, out, M1.truth + 0.36, 0.25, 160);
    whoosh(E, out, M1.truth + 0.38, 0.6, { f0: 900, f1: 2400, f2: 1500, peakAt: 0.8, vol: 0.06, p0: -0.4, p1: 0.4 });
    pluck(E, out, M1.truth + 0.95, 77);
    swish(E, out, M1.truth + 0.45, 0.05);
    swish(E, out, M1.truth + 0.95, 0.04);
    whoosh(E, out, M1.out, 0.6, { f0: 500, f1: 3000, f2: 1200, peakAt: 0.7, vol: 0.32, p0: 0, p1: 0.5 });

    // ---- mito 2
    scribble(E, out, M1.out + 0.62, 0.55, { freq: 5200, q: 1.2, vol: 0.06, grainHz: 55 });
    stamp(E, out, M2.stamp, false);
    pageTurn(E, out, M2.turn, TURN, 1, 1);
    // verdade 2
    stamp(E, out, M2.truth, false);
    swish(E, out, M2.truth + 0.12, 0.05);
    [0, 1, 2].forEach(function (i) {
      var t = M2.docs + i * 0.12;
      whoosh(E, out, t, 0.75, { f0: 600, f1: 2000, f2: 900, peakAt: 0.5, vol: 0.09, p0: [-0.5, 0.5, 0][i], p1: [-0.2, 0, 0.3][i] });
      crackle(E, out, t + 0.65, 0.1, 3, 0.06, 0);
    });
    scribble(E, out, M2.truth + 0.85, 0.42, { freq: 3300, vol: 0.09, body: true });
    scribble(E, out, M2.truth + 1.15, 0.42, { freq: 3300, vol: 0.09, body: true });
    [81, 84, 89].forEach(function (m, i) {
      pluck(E, out, M2.checks[i], m);
      scribble(E, out, M2.checks[i] + 0.08, 0.16, { freq: 4200, vol: 0.06 });
    });
    whoosh(E, out, M2.out, 0.55, { f0: 400, f1: 2400, f2: 700, peakAt: 0.6, vol: 0.32, p0: -0.3, p1: 0 });
    thud(E, out, M2.out + 0.5, 0.5, 120);
    crackle(E, out, M2.out + 0.5, 0.1, 5, 0.07, 0);

    // ---- mito 3
    scribble(E, out, M2.out + 0.65, 0.5, { freq: 5200, q: 1.2, vol: 0.06, grainHz: 55 });
    scribble(E, out, M3.circle, 0.5, { freq: 3400, vol: 0.12, body: true, grainHz: 26 });
    scribble(E, out, M3.circle + 0.3, 0.35, { freq: 5200, q: 1.2, vol: 0.05, grainHz: 55 });
    [0, 1, 2].forEach(function (i) {
      scribble(E, out, M3.strike + i * 0.13, 0.3, { freq: 3500, vol: 0.14, body: true, pan: -0.15 + i * 0.15 });
    });
    stamp(E, out, M3.stamp, false);
    pageTurn(E, out, M3.turn, TURN, 1, 1);
    // verdade 3
    stamp(E, out, M3.truth, false);
    swish(E, out, M3.truth + 0.1, 0.05);
    swish(E, out, M3.scale - 0.3, 0.05);
    tink(E, out, M3.scale + 0.02, 0.035);
    tink(E, out, M3.scale + 0.62, 0.022);
    tink(E, out, M3.scale + 1.2, 0.014);
    swish(E, out, M3.truth + 0.7, 0.04);
    scribble(E, out, M3.truth + 1.35, 0.45, { freq: 3300, vol: 0.1, body: true });
    // capa fecha
    pageTurn(E, out, M3.out, TURN, 1.15, -1);
    whoosh(E, out, M3.out + 0.05, 0.75, { f0: 200, f1: 900, f2: 300, peakAt: 0.6, vol: 0.22, p0: -0.5, p1: 0.4 });
    thud(E, out, M3.out + TURN * 0.95, 0.9, 70);

    // ---- encerramento
    thud(E, out, EN.logo + 0.18, 0.5, 120);
    tape(E, out, EN.logo + 0.38);
    tape(E, out, EN.logo + 0.48);
    EN.lines.forEach(function (t) { swish(E, out, t, 0.05); });
    scribble(E, out, EN.underline, 0.45, { freq: 3300, vol: 0.12, body: true });
    ticks(E, out, EN.comente + 0.05, 4, 0.04, 0.06);
    stamp(E, out, EN.simular, true);
    swish(E, out, EN.complement, 0.04);

    return ctx.startRendering();
  }

  window.KAP_renderSoundtrack = function (C) {
    return Promise.all([renderMusic(C), renderSfx(C)]).then(function (r) {
      return { music: r[0], sfx: r[1] };
    });
  };
})();
