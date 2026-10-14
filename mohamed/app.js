/* Mohamed — app.js: estado, telas, personagem, mapa e motor da lição.

FORMATO DOS EXERCÍCIOS (usado em conteudo.js):
  {
    tipo: 'escolha' | 'digitar' | 'vf',
    pergunta: 'Texto curto, até 8 palavras',
    opcoes: [2 ou 3 valores curtos],   // só em 'escolha' (cada um vira um bloco "?")
    resposta: valor,                    // número ou texto; em 'vf' é true ou false
    dica: 'Frase curta',                // mostrada ao errar
    visual: '<svg>…</svg>',             // opcional: dica visual
    surpresa: true                      // opcional: desafio-surpresa (XP em dobro)
  }
LIÇÃO: { id, titulo, icone, chefao?, carta: { emoji, titulo, regra }, gerar: () => [exercícios] }
DIA:   { n, titulo, mundo, licoes?: [lições] }
*/

// ---------- catálogo ----------
const CORES = ['#7B2FF7', '#FF4B5C', '#1FC46B', '#38BDF8', '#FF9F1C', '#FF4FD8'];
const CORES_EXTRA = ['#FFD400', '#00D1B2', '#64748B', '#8B5E34'];
const ROSTOS = ['feliz', 'serio', 'piscando', 'surpreso', 'bravo'];
const ACESSORIOS = ['nenhum', 'bone', 'coroa', 'fone', 'laco', 'oculos'];
const ACESSORIOS_EXTRA = ['cartola', 'antena', 'capacete', 'flor'];
const MEDALHAS = [
  { id: 'seq10', emoji: '🔥', nome: '10 acertos seguidos' },
  { id: 'perfeita', emoji: '💎', nome: 'Sem errar nenhuma lição' },
  { id: 'dia', emoji: '🏆', nome: 'Dia concluído' }
];
const FRASES = [
  'Livro de matemática? Cheio de problemas! 📚',
  'O zero é natural. E bem tranquilo 😎',
  'Ímpar sempre sobra um. Igual meia! 🧦',
  'O infinito avisou: já volto! ♾️',
  'Dividir pizza é a melhor conta 🍕',
  'Calculadora? Meu cérebro é turbo! 🧠'
];

// ---------- estado salvo ----------
const CHAVE = 'mohamed.v1';
const novoEstado = () => ({
  nome: '', turma: '', criado: false,
  personagem: { cor: CORES[0], rosto: 'feliz', acessorio: 'nenhum' },
  xp: 0, diaAtual: 1, diasConcluidos: [], licoes: {},
  cartas: [], medalhas: [], erros: [], seguidos: 0,
  itens: { cores: [], acessorios: [] }, frases: [], andar: null
});
let estado = carregar();
function carregar() {
  try { return { ...novoEstado(), ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; }
  catch (e) { return novoEstado(); }
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {} }

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const vibrar = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
function toast(txt) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = txt;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2700);
}

// sons curtos com Web Audio: [frequência, duração]
let audio = null;
const SONS = {
  ok: [[660, .09], [990, .16]], erro: [[220, .12], [160, .22]], moeda: [[988, .06], [1319, .18]],
  pulo: [[330, .05], [560, .1]], clique: [[620, .03]], vitoria: [[523, .1], [659, .1], [784, .1], [1047, .3]],
  bau: [[392, .07], [523, .07], [659, .07], [1047, .25]]
};
function som(tipo) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const onda = tipo === 'erro' ? 'sawtooth' : tipo === 'moeda' ? 'square' : 'triangle';
    let t = audio.currentTime;
    for (const [f, d] of SONS[tipo]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = onda;
      o.frequency.value = f;
      g.gain.setValueAtTime(onda === 'triangle' ? .25 : .08, t);
      g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + d + .02);
      t += d * .85;
    }
  } catch (e) {}
}

// ---------- personagem (SVG reutilizável: telas, mapa e jogo) ----------
const TINTA = '#1E1240';
function desenharPersonagem(p = {}, pose = 'parado') {
  const cor = p.cor || CORES[0];
  const rosto = pose === 'tombo' ? 'tonto' : p.rosto || 'feliz';
  const pula = pose === 'pula';
  const L = `stroke="${TINTA}" stroke-width="4" stroke-linecap="round" fill="none"`;
  const T = `stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"`;
  const olho = (x, r = 11) => `<circle cx="${x}" cy="50" r="${r}" fill="#fff"/><circle cx="${x + 2}" cy="51" r="${r / 2}" fill="${TINTA}"/><circle cx="${x + 4}" cy="48" r="2" fill="#fff"/>`;
  const ROSTO = {
    feliz: olho(36) + olho(64) + `<path d="M40 66 Q50 76 60 66" ${L}/>`,
    serio: olho(36) + olho(64) + `<path d="M42 70 H58" ${L}/>`,
    piscando: olho(36) + `<path d="M56 51 Q64 44 72 51" ${L}/><path d="M39 65 Q50 79 61 65Z" fill="${TINTA}"/>`,
    surpreso: olho(36, 13) + olho(64, 13) + `<ellipse cx="50" cy="72" rx="6" ry="7" fill="${TINTA}"/>`,
    bravo: olho(36) + olho(64) + `<path d="M25 35 L45 41 M75 35 L55 41" ${L}/><path d="M40 69 Q50 74 60 69" ${L}/>`,
    tonto: `<path d="M30 44 L42 56 M42 44 L30 56 M58 44 L70 56 M70 44 L58 56" ${L}/><path d="M38 71 q6 -6 12 0 t12 0" ${L}/>`
  };
  const ACESS = {
    bone: `<path d="M22 32 Q22 8 50 8 Q78 8 78 32Z" fill="#FF4B5C" ${T}/><rect x="52" y="26" width="38" height="9" rx="4.5" fill="#FF4B5C" ${T}/>`,
    coroa: `<path d="M28 24 L31 2 L41 14 L50 -2 L59 14 L69 2 L72 24Z" fill="#FFC531" ${T}/>`,
    fone: `<path d="M17 50 Q17 6 50 6 Q83 6 83 50" fill="none" stroke="${TINTA}" stroke-width="6"/><rect x="6" y="40" width="16" height="26" rx="8" fill="#38BDF8" ${T}/><rect x="78" y="40" width="16" height="26" rx="8" fill="#38BDF8" ${T}/>`,
    laco: `<g transform="translate(68 22)" fill="#FF4FD8" ${T}><path d="M0 0 L-16 -11 L-16 11Z"/><path d="M0 0 L16 -11 L16 11Z"/><circle r="5"/></g>`,
    oculos: `<g fill="${TINTA}" ${T}><rect x="22" y="40" width="26" height="20" rx="8"/><rect x="52" y="40" width="26" height="20" rx="8"/><path d="M48 48 H52"/></g><path d="M27 45 l6 -2 M57 45 l6 -2" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    cartola: `<rect x="32" y="-8" width="36" height="30" rx="3" fill="${TINTA}"/><rect x="32" y="12" width="36" height="6" fill="#FF4B5C"/><rect x="20" y="20" width="60" height="8" rx="4" fill="${TINTA}"/>`,
    antena: `<path d="M50 22 V2" stroke="${TINTA}" stroke-width="4"/><circle cx="50" cy="0" r="7" fill="#FFC531" ${T}/>`,
    capacete: `<circle cx="50" cy="58" r="47" fill="#BFE9FF" fill-opacity=".35" stroke="#fff" stroke-width="4"/><path d="M18 44 Q22 24 40 16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    flor: `<g transform="translate(30 20)" ${T}>${[0, 72, 144, 216, 288].map(a => `<circle cy="-8" r="6" fill="#fff" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#FFC531"/></g>`
  };
  const bracos = pula
    ? `<rect x="4" y="22" width="14" height="32" rx="7" fill="${cor}" transform="rotate(-30 11 50)"/><rect x="82" y="22" width="14" height="32" rx="7" fill="${cor}" transform="rotate(30 89 50)"/>`
    : `<rect x="6" y="56" width="14" height="28" rx="7" fill="${cor}"/><rect x="80" y="56" width="14" height="28" rx="7" fill="${cor}"/>`;
  const pernas = pula
    ? `<rect x="28" y="96" width="16" height="14" rx="7" fill="${TINTA}"/><rect x="56" y="96" width="16" height="14" rx="7" fill="${TINTA}"/>`
    : `<rect class="perna-a" x="29" y="94" width="14" height="22" rx="7" fill="${TINTA}"/><rect class="perna-b" x="57" y="94" width="14" height="22" rx="7" fill="${TINTA}"/>`;
  const corpo = `<rect x="14" y="22" width="72" height="80" rx="36" fill="${cor}"/><ellipse cx="50" cy="82" rx="22" ry="14" fill="#fff" opacity=".22"/><circle cx="25" cy="64" r="6" fill="#FF7AA8" opacity=".5"/><circle cx="75" cy="64" r="6" fill="#FF7AA8" opacity=".5"/>`;
  return `<svg viewBox="0 -12 100 132" xmlns="http://www.w3.org/2000/svg">${pernas}${bracos}${corpo}${ROSTO[rosto] || ROSTO.feliz}${ACESS[p.acessorio] || ''}</svg>`;
}

// ---------- navegação ----------
const TELAS = { 't-inicio': telaInicio, 't-personagem': telaPersonagem, 't-mapa': telaMapa, 't-dia': telaDia, 't-album': telaAlbum, 't-relatorio': () => Relatorio.tela() };
function irPara(id) {
  $$('.tela').forEach(t => t.classList.toggle('ativa', t.id === id));
  window.scrollTo(0, 0);
  if (TELAS[id]) TELAS[id]();
}

// ---------- tela inicial ----------
function telaInicio() {
  $('#logo-heroi').innerHTML = desenharPersonagem(estado.personagem);
  const nome = $('#in-nome'), turma = $('#in-turma'), bt = $('#bt-comecar');
  nome.value = estado.nome;
  turma.value = estado.turma;
  const checar = () => { bt.disabled = !(nome.value.trim() && turma.value.trim()); };
  nome.oninput = turma.oninput = checar;
  turma.onkeydown = e => { if (e.key === 'Enter' && !bt.disabled) bt.click(); };
  checar();
  bt.onclick = () => {
    estado.nome = nome.value.trim();
    estado.turma = turma.value.trim();
    salvar();
    som('ok');
    irPara(estado.criado ? 't-mapa' : 't-personagem');
  };
}

// ---------- criação do personagem ----------
let rascunho = null;
function telaPersonagem() {
  rascunho = { ...estado.personagem };
  desenharEditor();
}
function desenharEditor() {
  const op = (campo, v, miolo) => `<button class="op${rascunho[campo] === v ? ' sel' : ''}" data-c="${campo}" data-v="${v}">${miolo}</button>`;
  $('#pv-heroi').innerHTML = desenharPersonagem(rascunho);
  $('#op-cor').innerHTML = [...CORES, ...estado.itens.cores].map(c => op('cor', c, `<i class="cor" style="background:${c}"></i>`)).join('');
  $('#op-rosto').innerHTML = ROSTOS.map(r => op('rosto', r, desenharPersonagem({ ...rascunho, rosto: r, acessorio: 'nenhum' }))).join('');
  $('#op-acessorio').innerHTML = [...ACESSORIOS, ...estado.itens.acessorios]
    .map(a => op('acessorio', a, a === 'nenhum' ? '🚫' : desenharPersonagem({ ...rascunho, acessorio: a }))).join('');
}

// ---------- mapa de fases ----------
// posição dos nós: caminho sinuoso, com espaço extra para a placa de cada mundo
const POS = (() => {
  let y = 0;
  return DIAS.map((d, i) => {
    const novo = i === 0 || DIAS[i - 1].mundo !== d.mundo;
    y += (i ? 120 : 0) + (novo ? 110 : 0);
    return { x: 180 + Math.sin(i * 1.1 + .5) * 92, y: y + 60, novo };
  });
})();
function pontoCaminho(a, b, t) {
  const u = 1 - t, c1 = a.y + 60, c2 = b.y - 60;
  return {
    x: u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b.y
  };
}
const ESTRELA = '<path d="M0 -16L4.1 -5.7L15.2 -4.9L6.7 2.2L9.4 12.9L0 7L-9.4 12.9L-6.7 2.2L-15.2 -4.9L-4.1 -5.7Z" fill="#FFC531" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>';
const CADEADO = '<g fill="#A29EB6"><rect x="-11" y="-3" width="22" height="17" rx="4"/><path d="M-7 -3V-8a7 7 0 0 1 14 0V-3" fill="none" stroke="#A29EB6" stroke-width="4"/></g>';

function noMapa(d, p, m) {
  const feito = estado.diasConcluidos.includes(d.n), atual = d.n === estado.diaAtual, bloq = !feito && !atual;
  const cor = bloq ? '#DAD7E4' : m.cor;
  const miolo = bloq ? CADEADO : feito ? ESTRELA : `<text y="11" text-anchor="middle" font-size="30" font-weight="900" fill="#fff">${d.n}</text>`;
  return `<g class="no${bloq ? ' bloq' : ''}" data-dia="${d.n}" transform="translate(${p.x} ${p.y})">
    ${atual ? `<circle r="34" fill="${cor}" class="pulso"/>` : ''}
    <circle r="34" cy="7" fill="#00000026"/><circle r="34" fill="${cor}"/><circle r="27" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="4"/>
    ${miolo}
    <text y="60" text-anchor="middle" font-size="14" font-weight="800" fill="${bloq ? '#A29EB6' : TINTA}">${d.titulo}</text>
  </g>`;
}

function telaMapa() {
  $('#chip-xp').textContent = `⚡ ${estado.xp}`;
  $('#bt-perfil').innerHTML = desenharPersonagem(estado.personagem);
  let estradas = '', faixas = '', placas = '', nos = '';
  DIAS.forEach((d, i) => {
    const p = POS[i], m = MUNDOS[d.mundo];
    if (i) {
      const a = POS[i - 1], dd = `M${a.x} ${a.y}C${a.x} ${a.y + 60} ${p.x} ${p.y - 60} ${p.x} ${p.y}`;
      estradas += `<path d="${dd}" stroke="${m.cor}" opacity="${d.n <= estado.diaAtual ? 1 : .3}"/>`;
      faixas += `<path d="${dd}"/>`;
    }
    if (p.novo) placas += `<g transform="translate(180 ${p.y - 125})"><rect x="-90" y="-19" width="180" height="38" rx="19" fill="${m.cor}"/><text y="7" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">${m.emoji} ${m.nome}</text></g>`;
    nos += noMapa(d, p, m);
  });
  const alvo = Math.min(estado.diaAtual, DIAS.length) - 1;
  const ini = estado.andar ? estado.andar - 1 : alvo;
  const lugar = pt => `translate(${pt.x - 28}px,${pt.y - 100}px)`;
  const box = $('#mapa');
  box.innerHTML = `<svg viewBox="0 0 360 ${POS[POS.length - 1].y + 110}" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke-width="20" stroke-linecap="round">${estradas}</g>
    <g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 16" opacity=".7">${faixas}</g>
    ${placas}${nos}
    <g id="mapa-heroi" style="transform:${lugar(POS[ini])}"><g class="heroi-mapa">${desenharPersonagem(estado.personagem).replace('<svg ', '<svg width="56" height="74" ')}</g></g>
  </svg>`;
  const rolar = (y, suave) => box.scrollTo({ top: y * box.clientWidth / 360 - box.clientHeight / 2, behavior: suave ? 'smooth' : 'auto' });
  if (estado.andar && ini !== alvo) {
    // dia concluído: o personagem anda até o próximo nó
    const a = POS[ini], b = POS[alvo], heroi = $('#mapa-heroi');
    estado.andar = null;
    salvar();
    rolar(a.y);
    const kf = Array.from({ length: 11 }, (_, k) => {
      const pt = pontoCaminho(a, b, k / 10);
      return { transform: `translate(${pt.x - 28}px,${pt.y - 100 - (k % 2 ? 14 : 0)}px)` };
    });
    setTimeout(() => {
      rolar(b.y, true);
      heroi.animate(kf, { duration: 1800, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => {
        heroi.style.transform = lugar(b);
        som('ok');
      };
    }, 450);
  } else {
    estado.andar = null;
    rolar(POS[alvo].y);
  }
}

// ---------- lições do dia ----------
let diaAberto = 1;
function telaDia() {
  const d = DIAS[diaAberto - 1], m = MUNDOS[d.mundo], box = $('#dia-licoes');
  $('#dia-mundo').textContent = `${m.emoji} Dia ${d.n}`;
  $('#dia-titulo').textContent = d.titulo;
  if (!d.licoes) {
    box.innerHTML = '<div class="em-breve">🚧</div>';
    $('#dia-prox').textContent = 'Em breve!';
    return;
  }
  const ZIG = [0, 50, 70, 30, -30, 0];
  const iAtual = d.licoes.findIndex(l => !estado.licoes[l.id]);
  box.innerHTML = d.licoes.map((l, i) => {
    const cls = estado.licoes[l.id] ? 'feita' : i === iAtual ? 'atual' : 'bloq';
    return `<button class="licao-no ${cls}${l.chefao ? ' chefao' : ''}" data-i="${i}" style="left:${ZIG[i % 6]}px"${cls === 'bloq' ? ' disabled' : ''}>${cls === 'bloq' ? '🔒' : cls === 'feita' ? '⭐' : l.icone}</button>`;
  }).join('');
  $('#dia-prox').textContent = iAtual >= 0 ? `▶ ${d.licoes[iAtual].titulo}` : '⭐ Tudo feito!';
}

// ---------- motor da lição ----------
let L = null; // lição em andamento
const norm = v => {
  const s = String(v).replace(/−/g, '-').replace(/\s/g, '').toLowerCase();
  return /^-?\d+$/.test(s) ? String(Number(s)) : s; // "−0" = "0", "07" = "7"
};

function iniciarLicao(dia, idx) {
  const lic = dia.licoes[idx];
  L = { dia, idx, lic, exs: lic.gerar(), i: 0, vidas: 5, xp: 0, combo: 0, maxCombo: 0, acertos: 0, erros: 0, entrada: '', travado: false, power: 3 };
  Relatorio.licao(dia.n, lic.titulo);
  irPara('t-licao');
  $('#folha').className = 'folha';
  Jogo.iniciar($('#cena'), { personagem: estado.personagem, mundo: dia.mundo, total: L.exs.length });
  desenharVidas();
  proximo();
}

function desenharVidas(perdeu) {
  $('#vidas').innerHTML = [0, 1, 2, 3, 4]
    .map(k => `<span class="${perdeu && k === L.vidas ? 'perde' : ''}">${k < L.vidas ? '❤️' : '🤍'}</span>`).join('');
}

// tipos de exercício: blocos "?" (bater), teclado e painéis sobre o cenário
const BLOCOS = ['escolha', 'vf', 'digitar'];
const TECLADO = ['digitar', 'padrao', 'grade', 'tabuleiro'];

function proximo() {
  if (L.vidas <= 0) return fimLicao(false);
  if (L.i >= L.exs.length) return fimLicao(true);
  const ex = L.exs[L.i], p = $('#pergunta'), atual = L;
  L.entrada = '';
  L.travado = false;
  Jogo.trilha(L.i, L.exs.length);
  p.innerHTML = (ex.surpresa ? '<span class="tag">⚡</span>' : '') + ex.pergunta;
  p.classList.remove('entra');
  void p.offsetWidth;
  p.classList.add('entra');
  Jogo.pergunta(ex, responder, (certo, det) => avaliar(certo, det.dada, det.conta, fim => Jogo.reagir(certo, fim)));
  $('#teclado').hidden = !TECLADO.includes(ex.tipo);
  if (ex.surpresa) { Jogo.aviso('⚡ Surpresa!'); som('bau'); }
  if (ex.dedos && L.power > 0) Jogo.powerup(L.power, () => { L.power--; return dedos(ex.dedos); });
  if (ex.limite) Jogo.relogio(ex.limite, () => { if (L === atual) avaliar(false, '⏰', null, fim => Jogo.reagir(false, fim)); });
}

// resposta dos blocos e do teclado
function responder(v, i = 0) {
  if (!L || L.travado) return;
  const ex = L.exs[L.i];
  const certo = ex.tipo === 'vf' ? v === ex.resposta : norm(v) === norm(ex.resposta);
  const dada = ex.tipo === 'vf' ? (v ? 'V' : 'F') : String(v);
  avaliar(certo, dada, null, fim => BLOCOS.includes(ex.tipo) ? Jogo.bater(i, certo, fim) : Jogo.reagir(certo, fim));
}

// pontua qualquer tipo de exercício, anima a cena e abre o feedback
function avaliar(certo, dada, conta, animar) {
  if (!L || L.travado) return;
  L.travado = true;
  Jogo.pararRelogio();
  const ex = L.exs[L.i], atual = L;
  let ganho = 0;
  if (certo) {
    L.combo++;
    L.acertos++;
    estado.seguidos++;
    L.maxCombo = Math.max(L.maxCombo, L.combo);
    ganho = 10 * (L.combo >= 5 ? 3 : L.combo >= 3 ? 2 : 1) * (ex.surpresa ? 2 : 1);
    L.xp += ganho;
  } else {
    L.combo = 0;
    L.vidas--;
    L.erros++;
    estado.seguidos = 0;
    estado.erros = [...estado.erros, {
      dia: L.dia.n, licao: L.lic.id, pergunta: ex.pergunta,
      dada, certa: gabarito(ex) || '', quando: Date.now()
    }].slice(-200);
  }
  Relatorio.registrar(certo, conta || ex.conta || ex.pergunta);
  salvar();
  $('#teclado').hidden = true;
  animar(() => {
    if (L !== atual) return;
    if (!certo) desenharVidas(true);
    Jogo.combo(L.combo, L.combo >= 5 ? 3 : 2);
    if (estado.seguidos >= 10) ganharMedalha('seq10');
    mostrarFolha(certo, ex, ganho);
  });
}

function gabarito(ex) {
  if (ex.gabarito) return ex.gabarito;
  if (ex.tipo === 'vf') return ex.resposta ? '✔' : '✘';
  if (ex.resposta === undefined) return null;
  return typeof ex.resposta === 'number' ? fmt(ex.resposta) : String(ex.resposta);
}

// feedback: verde com XP, ou vermelho com a dica visual
function mostrarFolha(certo, ex, ganho) {
  const f = $('#folha'), resp = gabarito(ex);
  f.innerHTML = (certo
    ? `<div class="folha-titulo">✅ ${sortear(['Mandou bem!', 'Certinho!', 'Arrasou!', 'Perfeito!'])}<span class="xp">+${ganho} ⚡</span></div>`
    : `<div class="folha-titulo">❌ ${resp === null ? 'Quase!' : 'Era ' + resp}</div><div class="dica">💡 ${ex.dica || 'Olhe com calma'}${ex.visual ? `<div class="visual">${ex.visual}</div>` : ''}</div>`)
    + `<button class="btn ${certo ? 'ok' : 'erro'}" id="bt-continuar">Continuar ▶</button>`;
  f.className = `folha aberta ${certo ? 'ok' : 'erro'}`;
  som(certo ? 'ok' : 'erro');
  $('#bt-continuar').onclick = () => {
    som('clique');
    f.className = 'folha';
    L.i++;
    setTimeout(proximo, 180);
  };
}

function montarTeclado() {
  const t = $('#teclado');
  t.innerHTML = ['1', '2', '3', '4', '5', '⌫', '6', '7', '8', '9', '0', '−']
    .map(k => `<button class="tecla" data-k="${k}">${k}</button>`).join('') + '<button class="btn" data-k="ok">✔</button>';
  t.onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b || !L || L.travado || Jogo.ocupado()) return;
    const k = b.dataset.k;
    if (k === 'ok') { if (L.entrada.replace('−', '')) responder(L.entrada, 0); return; }
    if (k === '⌫') L.entrada = L.entrada.slice(0, -1);
    else if (k === '−') L.entrada = L.entrada.startsWith('−') ? L.entrada.slice(1) : '−' + L.entrada;
    else if (L.entrada.replace('−', '').length < 4) L.entrada += k;
    som('clique');
    Jogo.escrever(L.entrada);
  };
}

function fimLicao(venceu) {
  Jogo.parar();
  const { dia, lic } = L;
  let carta = null, diaFeito = false;
  if (venceu) {
    estado.xp += L.xp;
    estado.licoes[lic.id] = true;
    if (!estado.cartas.includes(lic.id)) { estado.cartas.push(lic.id); carta = lic.carta; }
    if (L.erros === 0) ganharMedalha('perfeita');
    if (lic.chefao && !estado.diasConcluidos.includes(dia.n)) {
      estado.diasConcluidos.push(dia.n);
      diaFeito = true;
      if (dia.n === estado.diaAtual) { estado.andar = dia.n; estado.diaAtual = dia.n + 1; }
      ganharMedalha('dia');
    }
    salvar();
  }
  telaResultado(venceu, carta, diaFeito);
}

// ---------- medalhas ----------
function ganharMedalha(id) {
  if (estado.medalhas.includes(id)) return;
  estado.medalhas.push(id);
  salvar();
  const m = MEDALHAS.find(x => x.id === id);
  toast(`${m.emoji} ${m.nome}!`);
  confete();
  som('vitoria');
}

// ---------- resultado ----------
function cartaHTML(l, mundo, tem, extra = '') {
  if (!tem) return '<div class="carta falta"><span class="em">?</span></div>';
  const [c1, c2] = l.chefao ? ['#FFD54A', '#FF9F1C'] : [MUNDOS[mundo].cor, '#7B2FF7'];
  return `<div class="carta${extra}" style="--c1:${c1};--c2:${c2}"><span class="em">${l.carta.emoji}</span><b>${l.carta.titulo}</b><p>${l.carta.regra}</p></div>`;
}

function telaResultado(venceu, carta, diaFeito) {
  irPara('t-resultado');
  const c = $('#res-conteudo'), a = $('#res-acoes');
  if (!venceu) {
    c.innerHTML = '<div class="trofeu">💔</div><h2 class="titulo">Sem corações!</h2><p class="sub">Bora de novo? 💪</p>';
    a.innerHTML = '<button class="btn" id="bt-denovo">↻ Tentar de novo</button><button class="btn claro" data-ir="t-dia">🗺️ Voltar</button>';
    $('#bt-denovo').onclick = () => { som('clique'); iniciarLicao(L.dia, L.idx); };
    som('erro');
    return;
  }
  c.innerHTML = `<div class="trofeu">${diaFeito ? '🏆' : L.erros ? '🎉' : '💎'}</div>
    <h2 class="titulo">${diaFeito ? 'Dia concluído!' : 'Lição completa!'}</h2>
    <div class="stats">
      <div class="stat">⚡ ${L.xp}<small>XP</small></div>
      <div class="stat">🎯 ${L.acertos}/${L.exs.length}<small>acertos</small></div>
      <div class="stat">🔥 ${L.maxCombo}<small>combo</small></div>
    </div>
    ${carta ? `<p class="sub">🃏 Carta nova!</p>${cartaHTML(L.lic, L.dia.mundo, true, ' vira grande')}` : ''}`;
  if (diaFeito) {
    a.innerHTML = '<button class="btn" id="bt-bau">🎁 Abrir baú</button>';
    $('#bt-bau').onclick = abrirBau;
  } else {
    a.innerHTML = '<button class="btn" data-ir="t-dia">Continuar ▶</button>';
  }
  som('vitoria');
  if (carta || diaFeito) confete();
}

// ---------- baú surpresa (fim do dia) ----------
const BAU = `<svg viewBox="0 0 120 100"><g class="tampa"><path d="M12 46Q12 14 60 14T108 46Z" fill="#C2410C" stroke="${TINTA}" stroke-width="4" stroke-linejoin="round"/><rect x="54" y="16" width="12" height="30" fill="#FFC531"/></g><rect x="12" y="46" width="96" height="46" rx="8" fill="#9A3412" stroke="${TINTA}" stroke-width="4"/><rect x="54" y="48" width="12" height="42" fill="#FFC531"/><rect x="50" y="40" width="20" height="20" rx="5" fill="#FFC531" stroke="${TINTA}" stroke-width="4"/></svg>`;

function sortearPremio() {
  return sortear([
    ...ACESSORIOS_EXTRA.filter(a => !estado.itens.acessorios.includes(a)).map(v => ({ tipo: 'acessorio', v })),
    ...CORES_EXTRA.filter(c => !estado.itens.cores.includes(c)).map(v => ({ tipo: 'cor', v })),
    { tipo: 'frase', v: sortear(FRASES) }
  ]);
}

function abrirBau() {
  som('clique');
  const s = document.createElement('div');
  s.className = 'sobre';
  s.innerHTML = `<div class="caixa"><h2 class="titulo">🎁 Baú surpresa</h2><button class="bau" aria-label="Abrir">${BAU}</button><p class="sub">Toque para abrir 👆</p></div>`;
  document.body.appendChild(s);
  const bau = s.querySelector('.bau');
  bau.onclick = () => {
    bau.onclick = null;
    bau.classList.add('treme');
    vibrar(120);
    som('pulo');
    setTimeout(() => { bau.classList.replace('treme', 'aberto'); som('bau'); confete(); }, 900);
    setTimeout(() => revelar(s), 1700);
  };
}

function revelar(s) {
  const p = sortearPremio();
  let titulo, corpo;
  if (p.tipo === 'frase') {
    if (!estado.frases.includes(p.v)) estado.frases.push(p.v);
    titulo = '😂 Frase nova!';
    corpo = `<p class="frase">${p.v}</p>`;
  } else {
    estado.itens[p.tipo === 'cor' ? 'cores' : 'acessorios'].push(p.v);
    estado.personagem[p.tipo] = p.v;
    titulo = p.tipo === 'cor' ? '🎨 Cor nova!' : '✨ Acessório novo!';
    corpo = `<div class="premio">${desenharPersonagem(estado.personagem)}</div>`;
  }
  salvar();
  s.querySelector('.caixa').innerHTML = `<h2 class="titulo">${titulo}</h2>${corpo}<button class="btn" id="bt-oba">Oba! ▶</button>`;
  s.querySelector('#bt-oba').onclick = () => { som('clique'); s.remove(); irPara('t-mapa'); };
}

// ---------- álbum de cartas e medalhas ----------
function telaAlbum() {
  const dias = DIAS.filter(d => d.licoes);
  const total = dias.reduce((s, d) => s + d.licoes.length, 0);
  $('#album-xp').textContent = `⚡ ${estado.xp}`;
  $('#album-cont').textContent = `🃏 ${estado.cartas.length}/${total}`;
  $('#album-medalhas').innerHTML = MEDALHAS
    .map(m => `<div class="medalha${estado.medalhas.includes(m.id) ? '' : ' falta'}"><span class="m">${m.emoji}</span>${m.nome}</div>`).join('');
  $('#album-cartas').innerHTML = dias.map(d =>
    `<div class="secao">${MUNDOS[d.mundo].emoji} Dia ${d.n} · ${d.titulo}</div>
     <div class="grade">${d.licoes.map(l => cartaHTML(l, d.mundo, estado.cartas.includes(l.id))).join('')}</div>`).join('')
    + (estado.frases.length ? `<div class="secao">😂 Frases</div><div class="frases">${estado.frases.map(f => `<p>${f}</p>`).join('')}</div>` : '');
}

// ---------- início do app ----------
function iniciarApp() {
  montarTeclado();
  Relatorio.iniciar();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (b) { som('clique'); irPara(b.dataset.ir); }
  });
  $('#t-personagem').addEventListener('click', e => {
    const b = e.target.closest('.op');
    if (!b) return;
    rascunho[b.dataset.c] = b.dataset.v;
    som('clique');
    desenharEditor();
    const pv = $('#pv-heroi');
    pv.classList.remove('pop');
    void pv.offsetWidth;
    pv.classList.add('pop');
  });
  $('#bt-pronto').onclick = () => {
    estado.personagem = { ...rascunho };
    estado.criado = true;
    salvar();
    som('ok');
    irPara('t-mapa');
  };
  $('#mapa').onclick = e => {
    const g = e.target.closest('.no');
    if (!g || g.classList.contains('bloq')) return;
    som('clique');
    diaAberto = +g.dataset.dia;
    irPara('t-dia');
  };
  $('#dia-licoes').onclick = e => {
    const b = e.target.closest('.licao-no');
    if (!b || b.disabled) return;
    som('clique');
    iniciarLicao(DIAS[diaAberto - 1], +b.dataset.i);
  };
  $('#bt-sair').onclick = () => {
    som('clique');
    Jogo.parar();
    $('#folha').className = 'folha';
    L = null;
    irPara('t-dia');
  };
  // teclado físico na lição
  document.addEventListener('keydown', e => {
    if (!L || !$('#t-licao').classList.contains('ativa')) return;
    if (e.key === 'Enter' && $('#folha').classList.contains('aberta')) return $('#bt-continuar').click();
    if ($('#teclado').hidden) return;
    const k = /^[0-9]$/.test(e.key) ? e.key : { Backspace: '⌫', '-': '−', Enter: 'ok' }[e.key];
    if (k) $(`#teclado [data-k="${k}"]`).click();
  });
  irPara(!estado.nome ? 't-inicio' : estado.criado ? 't-mapa' : 't-personagem');
}
iniciarApp();
