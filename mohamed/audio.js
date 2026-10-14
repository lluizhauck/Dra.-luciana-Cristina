/* Mohamed — audio.js: trilha sonora e efeitos gerados na hora com Web Audio (nenhum arquivo de áudio).
   API global:
     Audio2.musica('mapa' | 'aldeia' | 'masmorra' | 'batalha' | 'chefao')   troca com fade de 0,6 s
     Audio2.sfx('clique' | 'acerto' | 'erro' | 'golpe' | 'moeda' | 'porta' | 'vitoria' | 'derrota')  (+ 'bau' e 'chefe')
     Audio2.mudo(true | false) · Audio2.volume(0..1)
   O som começa no primeiro toque (regra dos navegadores), pausa com a aba oculta
   e o botão do canto guarda a escolha (ligado, baixo, mudo) no aparelho. */
const Audio2 = (() => {
  const CHAVE = 'mohamed.som', FADE = .6, VOL_PADRAO = .35, VOL_BAIXO = .15;
  let cfg = { mudo: false, vol: VOL_PADRAO };
  try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch (e) {}
  let ctx = null, mestre, busMusica, busSfx, eco, ruido, pedida = null, atual = null, trilhas = [], pintarBotao = () => {};
  const nota = m => 440 * Math.pow(2, (m - 69) / 12);
  const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(cfg)); } catch (e) {} };
  const pronto = () => ctx && !cfg.mudo && !document.hidden;

  // ---------- faixas: sempre em tom menor; 16 passos por compasso, 1 acorde por compasso ----------
  // acordes: semitons a partir da tônica · baixo: 1 tônica, 5 quinta, 8 oitava · arpejo: 0-2 notas do acorde, 3 oitava
  // bateria: x toca, . pausa · bat: volume de bumbo, caixa e chimbal
  const FAIXAS = {
    mapa: { // calma e misteriosa: Ré dórico, i · VI · IV · v
      bpm: 76, tonica: 50, acordes: [[0, 3, 7], [-4, 0, 3], [5, 9, 12], [7, 10, 14]],
      baixo: '1.......1...5...', som: { tipo: 'triangle', corte: 700, vol: .2 },
      arpejo: '0..1..2..3..2.1.', arp: { tipo: 'triangle', oitava: 1, vol: .06, corte: 2600, envio: .55 },
      pad: { vol: .018, corte: 800 },
      bumbo: 'x.......x.......', caixa: '................', chimbal: '....x.......x...', bat: [.35, 0, .025]
    },
    aldeia: { // aconchegante: Fá menor com acordes maiores, i · VI · III · VII, caixinha de música
      bpm: 70, tonica: 53, acordes: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
      baixo: '1.....1.5.......', som: { tipo: 'sine', corte: 0, vol: .16 },
      arpejo: '0.2.3.2.1.2.3...', arp: { tipo: 'sine', oitava: 2, vol: .06, corte: 0, solta: .45, envio: .5 },
      pad: { vol: .014, corte: 650 },
      bumbo: 'x.......x.......', caixa: '................', chimbal: '..x...x...x...x.', bat: [.22, 0, .015]
    },
    masmorra: { // tensa e rítmica: Mi frígio, i · bII · i · bVII
      bpm: 100, tonica: 52, acordes: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]],
      baixo: '1.1.8.1.1.1.8.1.', som: { tipo: 'sawtooth', corte: 520, vol: .13 },
      arpejo: '0..2..1..3..2...', arp: { tipo: 'square', oitava: 1, vol: .028, corte: 1500, envio: .45 },
      pad: { vol: .016, corte: 600 },
      bumbo: 'x.......x..x....', caixa: '........x.......', chimbal: 'x.x.x.x.x.x.x.x.', bat: [.6, .2, .03]
    },
    batalha: { // rápida e intensa: Lá menor harmônica, i · VI · iv · V
      bpm: 138, tonica: 57, acordes: [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 11, 14]],
      baixo: '1.8.1.8.1.8.1.8.', som: { tipo: 'sawtooth', corte: 850, vol: .12 },
      arpejo: '0123210301232103', arp: { tipo: 'square', oitava: 1, vol: .026, corte: 3000, envio: .3 },
      pad: { vol: .012, corte: 900 },
      bumbo: 'x...x...x...x...', caixa: '....x.......x...', chimbal: 'xxxxxxxxxxxxxxxx', bat: [.7, .26, .022]
    },
    chefao: { // grave, épica e urgente: Dó menor com bII e V maior, ritmo 3-3-2
      bpm: 150, tonica: 48, acordes: [[0, 3, 7], [-4, 0, 3], [1, 5, 8], [7, 11, 14]],
      baixo: '1..1..1.1..1..8.', som: { tipo: 'sawtooth', corte: 700, vol: .14, desafina: 10 },
      arpejo: '0.3.2.3.1.3.2.3.', arp: { tipo: 'sawtooth', oitava: 1, vol: .022, corte: 2200, envio: .35 },
      pad: { vol: .022, corte: 1300 },
      bumbo: 'x..x..x.x..x..x.', caixa: '....x.......x.xx', chimbal: 'x.x.x.x.x.x.x.x.', bat: [.8, .28, .03]
    }
  };

  // ---------- motor ----------
  function criar() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); // segura os picos: nada estoura na caixinha do celular
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
      mestre = ctx.createGain();
      mestre.gain.value = cfg.mudo ? 0 : 1;
      mestre.connect(comp);
      comp.connect(ctx.destination);
      busMusica = ctx.createGain();
      busSfx = ctx.createGain();
      busMusica.connect(mestre);
      busSfx.connect(mestre);
      eco = criarEco();
      eco.saida.connect(busMusica);
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      aplicarVolume();
      setInterval(agendar, 25);
      return true;
    } catch (e) { ctx = null; return false; }
  }

  // "reverb" leve: dois ecos com realimentação, um de cada lado, cada vez mais abafados
  function criarEco() {
    const entrada = ctx.createGain(), saida = ctx.createGain();
    saida.gain.value = .55;
    [[.23, -.5], [.37, .5]].forEach(([tempo, lado]) => {
      const atraso = ctx.createDelay(1), volta = ctx.createGain(), filtro = ctx.createBiquadFilter();
      atraso.delayTime.value = tempo;
      volta.gain.value = .38;
      filtro.type = 'lowpass';
      filtro.frequency.value = 2200;
      entrada.connect(atraso);
      atraso.connect(filtro);
      filtro.connect(volta);
      volta.connect(atraso);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan.pan) pan.pan.value = lado;
      filtro.connect(pan);
      pan.connect(saida);
    });
    return { entrada, saida };
  }

  const rampa = (p, v, s = .08) => { const t = ctx.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + s); };
  function aplicarVolume() {
    if (!ctx) return;
    rampa(busMusica.gain, cfg.vol);
    rampa(busSfx.gain, Math.min(1, cfg.vol * 1.45)); // efeitos um pouco acima da música
  }

  // uma nota: osciladores (2 levemente desafinados no pad), filtro e envelope sem estalos
  function voz(t, f, dur, o, saida) {
    const g = ctx.createGain(), solta = o.solta || .1, fim = t + dur + solta, ataque = Math.min(o.ataque || .005, dur);
    let alvo = g;
    if (o.corte) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = o.corte;
      fl.Q.value = o.q || .8;
      fl.connect(g);
      alvo = fl;
    }
    for (const det of o.desafina ? [-o.desafina, o.desafina] : [0]) {
      const os = ctx.createOscillator();
      os.type = o.tipo || 'triangle';
      os.frequency.setValueAtTime(f, t);
      if (o.desliza) os.frequency.exponentialRampToValueAtTime(o.desliza, t + dur);
      os.detune.value = det;
      os.connect(alvo);
      os.start(t);
      os.stop(fim + .02);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + ataque);
    g.gain.setValueAtTime(o.vol, t + dur);
    g.gain.exponentialRampToValueAtTime(.0001, fim);
    g.connect(saida.seco);
    if (o.envio && saida.molhado) {
      const e = ctx.createGain();
      e.gain.value = o.envio;
      g.connect(e);
      e.connect(saida.molhado);
    }
  }

  // ruído filtrado: chimbal, caixa, porta, golpe
  function chiado(t, dur, o, destino) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido;
    fl.type = o.tipo || 'highpass';
    fl.frequency.setValueAtTime(o.freq, t);
    if (o.ate) fl.frequency.exponentialRampToValueAtTime(o.ate, t + dur);
    fl.Q.value = o.q || .7;
    g.gain.setValueAtTime(o.vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(destino);
    s.start(t, Math.random() * .5);
    s.stop(t + dur + .02);
  }

  function bumbo(t, destino, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + .12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .004);
    g.gain.exponentialRampToValueAtTime(.0001, t + .28);
    o.connect(g);
    g.connect(destino);
    o.start(t);
    o.stop(t + .3);
    chiado(t, .02, { tipo: 'lowpass', freq: 3500, vol: vol * .2 }, destino); // o "toc" que se ouve no celular
  }

  function caixa(t, destino, vol) {
    chiado(t, .16, { tipo: 'bandpass', freq: 1800, q: .9, vol }, destino);
    voz(t, 190, .05, { tipo: 'triangle', vol: vol * .5, desliza: 120, solta: .05 }, { seco: destino });
  }

  // ---------- sequenciador: agenda as notas um pouco à frente do relógio do áudio ----------
  function passo(tr, t) {
    const F = tr.F, k = tr.passo % 16, ac = F.acordes[Math.floor(tr.passo / 16) % F.acordes.length], d16 = 60 / F.bpm / 4;
    const saida = { seco: tr.seco, molhado: tr.molhado };
    if (k === 0 && F.pad) ac.forEach(n => voz(t, nota(F.tonica + n), d16 * 16, { tipo: 'sawtooth', desafina: 9, vol: F.pad.vol, corte: F.pad.corte, ataque: .4, solta: .7, envio: .6 }, saida));
    const b = F.baixo[k];
    if (b !== '.') {
      let n = 1;
      while (k + n < 16 && F.baixo[k + n] === '.') n++;
      const grau = b === '5' ? ac[2] : b === '8' ? ac[0] + 12 : ac[0];
      voz(t, nota(F.tonica - 12 + grau), d16 * n * .85, { ...F.som, ataque: .008, solta: .08 }, saida);
    }
    const a = F.arpejo[k];
    if (a !== '.') {
      const grau = a === '3' ? ac[0] + 12 : ac[+a];
      voz(t, nota(F.tonica + 12 * F.arp.oitava + grau), d16 * .9, { tipo: F.arp.tipo, vol: F.arp.vol, corte: F.arp.corte, solta: F.arp.solta || .12, envio: F.arp.envio }, saida);
    }
    const [vb, vc, vh] = F.bat;
    if (F.bumbo[k] === 'x') bumbo(t, tr.seco, vb);
    if (F.caixa[k] === 'x') caixa(t, tr.seco, vc);
    if (F.chimbal[k] === 'x') chiado(t, .045, { tipo: 'highpass', freq: 7500, vol: vh * (k % 4 === 2 ? 1.4 : 1) }, tr.seco);
  }

  function agendar() {
    if (!ctx || ctx.state !== 'running') return;
    const agora = ctx.currentTime, ate = agora + .15;
    for (const tr of trilhas) {
      const d16 = 60 / tr.F.bpm / 4;
      while (tr.prox < ate && tr.prox < tr.fim) {
        if (tr.prox > agora - .05) passo(tr, Math.max(tr.prox, agora)); // atrasou demais? pula, sem rajada
        tr.prox += d16;
        tr.passo = (tr.passo + 1) % (16 * tr.F.acordes.length);
      }
    }
  }

  // troca de faixa: a antiga desce e a nova sobe em 0,6 s
  function trocar(nome) {
    const agora = ctx.currentTime;
    for (const tr of trilhas) {
      if (tr.fim !== Infinity) continue;
      tr.fim = agora + FADE;
      rampa(tr.seco.gain, 0, FADE);
      rampa(tr.molhado.gain, 0, FADE);
      setTimeout(() => { tr.seco.disconnect(); tr.molhado.disconnect(); trilhas = trilhas.filter(x => x !== tr); }, (FADE + 3) * 1000);
    }
    atual = nome;
    if (!nome) return;
    const tr = { F: FAIXAS[nome], seco: ctx.createGain(), molhado: ctx.createGain(), passo: 0, prox: agora + .06, fim: Infinity };
    tr.seco.connect(busMusica);
    tr.molhado.connect(eco.entrada);
    for (const g of [tr.seco.gain, tr.molhado.gain]) { g.setValueAtTime(0, agora); g.linearRampToValueAtTime(1, agora + FADE); }
    trilhas.push(tr);
  }

  const seguir = () => { if (pronto() && ctx.state === 'running' && pedida !== atual) trocar(pedida); };

  // primeiro toque: cria o áudio e começa a faixa pedida (o navegador só deixa tocar depois de um gesto)
  function liberar() {
    if (cfg.mudo || document.hidden || !criar()) return;
    if (ctx.state === 'running') seguir();
    else Promise.resolve(ctx.resume()).then(seguir, () => {});
  }
  ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'].forEach(ev => addEventListener(ev, liberar, { capture: true, passive: true }));

  // aba oculta: pausa tudo; ao voltar, continua de onde parou
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!cfg.mudo) Promise.resolve(ctx.resume()).then(seguir, () => {});
  });

  // ---------- efeitos curtos ----------
  const S = () => ({ seco: busSfx, molhado: eco.entrada });
  const EFEITOS = {
    clique: t => voz(t, 1250, .025, { tipo: 'triangle', vol: .16, desliza: 880, solta: .04 }, S()),
    acerto: t => {
      voz(t, nota(79), .07, { tipo: 'square', vol: .05, corte: 4000, solta: .04 }, S());
      voz(t + .07, nota(86), .14, { tipo: 'square', vol: .05, corte: 4000, solta: .22, envio: .35 }, S());
      voz(t + .07, nota(91), .14, { tipo: 'sine', vol: .07, solta: .3 }, S());
    },
    erro: t => {
      voz(t, 196, .2, { tipo: 'sawtooth', vol: .1, corte: 1000, desliza: 92, desafina: 12, solta: .06 }, S());
      chiado(t, .08, { tipo: 'lowpass', freq: 1200, vol: .12 }, busSfx);
    },
    golpe: t => {
      bumbo(t, busSfx, .9);
      chiado(t, .14, { tipo: 'bandpass', freq: 2400, ate: 400, q: 1, vol: .45 }, busSfx);
    },
    moeda: t => {
      voz(t, nota(83), .055, { tipo: 'square', vol: .05, corte: 6000, solta: .02 }, S());
      voz(t + .055, nota(88), .2, { tipo: 'square', vol: .05, corte: 6000, solta: .18, envio: .25 }, S());
    },
    porta: t => {
      chiado(t, .38, { tipo: 'bandpass', freq: 260, ate: 1400, q: 3, vol: .5 }, busSfx);
      voz(t, 98, .3, { tipo: 'triangle', vol: .12, desliza: 70, solta: .1 }, S());
    },
    vitoria: t => { // arpejo menor que resolve em maior
      [69, 72, 76].forEach((n, i) => voz(t + i * .09, nota(n), .09, { tipo: 'square', vol: .045, corte: 4000, solta: .06 }, S()));
      [69, 73, 76, 81].forEach(n => voz(t + .27, nota(n), .45, { tipo: 'triangle', vol: .07, ataque: .01, solta: .5, envio: .45 }, S()));
    },
    derrota: t => [64, 63, 60, 57].forEach((n, i) => voz(t + i * .17, nota(n), i === 3 ? .5 : .15, { tipo: 'sawtooth', vol: .06, corte: 1100, desafina: 8, solta: i === 3 ? .6 : .08, envio: .3 }, S())),
    bau: t => [72, 76, 79, 84, 88].forEach((n, i) => voz(t + i * .045, nota(n), .07, { tipo: 'triangle', vol: .09, solta: .25, envio: .45 }, S())),
    chefe: t => {
      bumbo(t, busSfx, 1);
      [43, 44].forEach(n => voz(t, nota(n), .8, { tipo: 'sawtooth', vol: .09, corte: 520, desafina: 15, ataque: .04, solta: .5 }, S()));
      chiado(t, .7, { tipo: 'lowpass', freq: 900, ate: 150, vol: .3 }, busSfx);
    }
  };

  // ---------- API ----------
  function musica(nome) {
    if (!FAIXAS[nome]) return;
    pedida = nome;
    seguir();
  }
  function sfx(nome) {
    if (!pronto() || !EFEITOS[nome]) return;
    try { EFEITOS[nome](ctx.currentTime + .005); } catch (e) {}
  }
  function mudo(sim) {
    cfg.mudo = !!sim;
    guardar();
    pintarBotao();
    if (cfg.mudo) {
      if (!ctx) return;
      rampa(mestre.gain, 0);
      setTimeout(() => { if (cfg.mudo) ctx.suspend(); }, 120);
    } else {
      liberar();
      if (ctx) rampa(mestre.gain, 1);
    }
  }
  function volume(v) {
    cfg.vol = Math.max(0, Math.min(1, Number(v) || 0));
    guardar();
    aplicarVolume();
    pintarBotao();
  }

  // ---------- botão do canto: 🔊 ligado → 🔉 baixo → 🔇 mudo ----------
  const ICONE = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/>${n === 0 ? '<path d="M16 9.5l5 5M21 9.5l-5 5"/>' : '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>' + (n > 1 ? '<path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : '')}</svg>`;
  function botao() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'som-bt';
    pintarBotao = () => {
      const n = cfg.mudo ? 0 : cfg.vol < .25 ? 1 : 2;
      b.innerHTML = ICONE(n);
      b.setAttribute('aria-label', ['Som desligado', 'Som baixo', 'Som ligado'][n]);
      b.classList.toggle('mudo', n === 0);
    };
    b.onclick = () => {
      if (cfg.mudo) { volume(VOL_PADRAO); mudo(false); }
      else if (cfg.vol >= .25) volume(VOL_BAIXO);
      else mudo(true);
      sfx('clique');
    };
    pintarBotao();
    document.body.appendChild(b);
  }
  if (document.body) botao();
  else document.addEventListener('DOMContentLoaded', botao);

  return { musica, sfx, mudo, volume, info: () => ({ estado: ctx ? ctx.state : 'sem áudio', tocando: atual, pedida, mudo: cfg.mudo, volume: cfg.vol, faixas: trilhas.length }) };
})();
