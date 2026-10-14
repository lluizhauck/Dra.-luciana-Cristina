// Mohamed — jogo.js: masmorra vista de cima (Canvas), batalha por turnos e desafios de baús e portas

// confete das conquistas (também usado em app.js)
function confete(qtd = 70) {
  const caixa = document.createElement('div');
  caixa.className = 'confete';
  const cores = ['#7B2FF7', '#FFC531', '#1FC46B', '#FF4B5C', '#38BDF8', '#FF4FD8'];
  for (let i = 0; i < qtd; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${cores[i % cores.length]};--dx:${Math.random() * 160 - 80}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .3}s;animation-duration:${1.2 + Math.random() * .8}s`;
    caixa.appendChild(p);
  }
  document.body.appendChild(caixa);
  setTimeout(() => caixa.remove(), 2600);
}

// =====================================================================
// DESAFIOS de baús e portas: arrastar para ℕ ou ℤ, ligar, ordenar, reta e fila
// =====================================================================
const Jogo = (() => {
  let el = {}, ocupado = false;
  const tremer = x => { x.classList.remove('treme'); void x.offsetWidth; x.classList.add('treme'); };

  // ---------- painéis ----------
  function abrirPainel(cls, html) {
    const p = document.createElement('div');
    p.className = 'painel ' + cls;
    p.innerHTML = html;
    el.palco.appendChild(p);
    el.painel = p;
    return p;
  }

  // controla os passos de um painel: cada acerto ou erro faz o personagem reagir
  function passos(total, fim) {
    let restam = total, errou = false, conta = null;
    return {
      certo() { el.reagir(true); if (--restam === 0) fim(!errou, { dada: errou ? conta : 'ok', conta }); },
      errado(c, ...fichas) { errou = true; conta = conta || c; fichas.forEach(tremer); el.reagir(false); }
    };
  }

  // (1) arrastar (ou tocar e tocar) cada número para ℕ ou ℤ
  function pConjunto(ex, fim) {
    const p = abrirPainel('p-conjunto',
      `<div class="fichas">${ex.itens.map((it, k) => `<button class="ficha" data-k="${k}">${it.t}</button>`).join('')}</div>` +
      '<div class="conj cz" data-conj="ℤ"><b class="rot">ℤ</b><div class="conj cn" data-conj="ℕ"><b class="rot">ℕ</b><div class="dentro"></div></div><div class="dentro"></div></div>');
    const passo = passos(ex.itens.length, fim);
    let sel = null;
    const colocar = (f, alvo) => {
      const it = ex.itens[f.dataset.k];
      f.classList.remove('sel', 'arrasta');
      f.style.transform = '';
      sel = null;
      if (it.alvo === alvo) {
        f.classList.add('ok');
        f.disabled = true;
        p.querySelector(`[data-conj="${alvo}"] > .dentro`).appendChild(f);
        passo.certo();
      } else passo.errado(`${it.t} em ${alvo}`, f);
    };
    p.querySelectorAll('.ficha').forEach(f => {
      let x0 = null, y0 = 0, moveu = false;
      f.onpointerdown = e => {
        if (f.disabled || ocupado) return;
        x0 = e.clientX; y0 = e.clientY; moveu = false;
        f.setPointerCapture(e.pointerId);
      };
      f.onpointermove = e => {
        if (x0 === null) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (!moveu && Math.hypot(dx, dy) < 8) return;
        moveu = true;
        f.classList.add('arrasta');
        f.style.transform = `translate(${dx}px,${dy}px)`;
      };
      f.onpointerup = e => {
        if (x0 === null) return;
        x0 = null;
        if (!moveu) { // toque: seleciona e depois toca no conjunto
          p.querySelectorAll('.ficha.sel').forEach(o => o !== f && o.classList.remove('sel'));
          f.classList.toggle('sel');
          sel = f.classList.contains('sel') ? f : null;
          som('clique');
          return;
        }
        f.style.visibility = 'hidden';
        const alvo = document.elementFromPoint(e.clientX, e.clientY);
        f.style.visibility = '';
        const conj = alvo && alvo.closest('[data-conj]');
        if (conj) colocar(f, conj.dataset.conj);
        else { f.classList.remove('arrasta'); f.style.transform = ''; }
      };
      f.onpointercancel = () => { x0 = null; f.classList.remove('arrasta'); f.style.transform = ''; };
    });
    p.querySelectorAll('[data-conj]').forEach(c => c.addEventListener('click', e => {
      e.stopPropagation(); // ℕ fica dentro de ℤ: vale o conjunto mais de dentro
      if (sel && !ocupado) colocar(sel, c.dataset.conj);
    }));
  }

  // (2) ligar conta e resultado: toque num lado e depois no outro
  function pLigar(ex, fim) {
    const lado = (l, lista) => `<div class="col">${lista.map(o => `<button class="ficha" data-lado="${l}" data-v="${o.v}">${o.t}</button>`).join('')}</div>`;
    const esq = embaralhar(ex.pares.map(([c, r]) => ({ t: c, v: String(r) })));
    const dir = embaralhar(ex.pares.map(([, r]) => ({ t: typeof r === 'number' ? fmt(r) : r, v: String(r) })));
    const p = abrirPainel('p-ligar', lado('e', esq) + lado('d', dir));
    const passo = passos(ex.pares.length, fim);
    let sel = null;
    p.onclick = e => {
      const f = e.target.closest('.ficha');
      if (!f || f.disabled || ocupado) return;
      if (sel === f) { f.classList.remove('sel'); sel = null; return; }
      if (!sel || sel.dataset.lado === f.dataset.lado) {
        if (sel) sel.classList.remove('sel');
        sel = f;
        f.classList.add('sel');
        som('clique');
        return;
      }
      const a = sel;
      sel = null;
      a.classList.remove('sel');
      if (a.dataset.v === f.dataset.v) {
        [a, f].forEach(x => { x.classList.add('ok'); x.disabled = true; });
        passo.certo();
      } else passo.errado((a.dataset.lado === 'e' ? a : f).textContent, a, f);
    };
  }

  // ordenar: toque nos números na ordem certa
  function pOrdenar(ex, fim) {
    const ordem = ex.itens.slice().sort((a, b) => (ex.decrescente ? b - a : a - b));
    const sinal = `<span class="sinal">${ex.decrescente ? '&gt;' : '&lt;'}</span>`;
    const p = abrirPainel('p-ordenar',
      `<div class="fichas">${embaralhar(ex.itens).map(n => `<button class="ficha" data-v="${n}">${fmt(n)}</button>`).join('')}</div>` +
      `<div class="vagas">${ordem.map(() => '<i class="vaga"></i>').join(sinal)}</div>`);
    const passo = passos(ordem.length, fim);
    let k = 0;
    p.onclick = e => {
      const f = e.target.closest('.ficha');
      if (!f || f.disabled || ocupado) return;
      if (+f.dataset.v !== ordem[k]) return passo.errado(`Ordenar ${ex.itens.map(fmt).join(', ')}`, f);
      const vaga = p.querySelectorAll('.vaga')[k++];
      vaga.textContent = f.textContent;
      vaga.classList.add('cheia');
      f.disabled = true;
      f.classList.add('usada');
      passo.certo();
    };
  }

  // (etapa 10) posicionar um número tocando na reta
  function pReta(ex, fim) {
    const { min, max } = ex, W = 300, x0 = 14, passo = (W - 2 * x0) / (max - min);
    const X = v => x0 + (v - min) * passo;
    const rot = ex.rotulos || [min, 0, max].filter(v => v >= min && v <= max);
    let s = `<svg viewBox="0 0 ${W} 70"><line x1="4" y1="34" x2="${W - 4}" y2="34" stroke="#1E1240" stroke-width="3" stroke-linecap="round"/>`;
    for (let v = min; v <= max; v++) {
      const z = v === 0;
      s += `<line x1="${X(v)}" y1="${z ? 24 : 28}" x2="${X(v)}" y2="${z ? 44 : 40}" stroke="#1E1240" stroke-width="${z ? 3 : 2}"/>`;
      if (rot.includes(v)) s += `<text x="${X(v)}" y="62" text-anchor="middle" font-size="15" font-weight="900" fill="#1E1240">${fmt(v)}</text>`;
    }
    const p = abrirPainel('p-reta', s + '<g class="marcas"></g></svg>');
    const svg = p.querySelector('svg');
    const pino = (v, cor) => `<g transform="translate(${X(v)} 34)"><path d="M0 -3 L-7 -16 H7Z" fill="${cor}"/><circle cy="-21" r="9" fill="${cor}" stroke="#fff" stroke-width="2"/></g>`;
    svg.onpointerdown = e => {
      if (ocupado || svg.dataset.feito) return;
      const r = svg.getBoundingClientRect();
      const v = Math.max(min, Math.min(max, Math.round(((e.clientX - r.left) * (W / r.width) - x0) / passo + min)));
      const certo = v === ex.resposta;
      svg.dataset.feito = 1;
      svg.querySelector('.marcas').innerHTML = (certo ? '' : pino(ex.resposta, '#1FC46B')) + pino(v, certo ? '#1FC46B' : '#FF4B5C');
      fim(certo, { dada: fmt(v), conta: ex.conta || ex.pergunta });
    };
  }

  // ordem das operações: toque nas operações na ordem em que são feitas
  function pFila(ex, fim) {
    const toks = ex.tokens.map(t => (t.op ? `<button class="op" data-id="${t.id}">${t.op}</button>` : `<span>${t.t}</span>`)).join('');
    const p = abrirPainel('p-fila', `<div class="expr">${toks}</div><div class="vagas">${ex.ordem.map((_, i) => `<i class="vaga">${i + 1}º</i>`).join('')}</div>`);
    const passo = passos(ex.ordem.length, fim);
    let k = 0;
    p.onclick = e => {
      const b = e.target.closest('.op');
      if (!b || b.disabled || ocupado) return;
      if (+b.dataset.id !== ex.ordem[k]) return passo.errado(ex.conta || ex.pergunta, b);
      const vaga = p.querySelectorAll('.vaga')[k];
      vaga.textContent = ex.passos[k];
      vaga.classList.add('cheia');
      b.disabled = true;
      b.dataset.n = ++k;
      b.classList.add('feita');
      passo.certo();
    };
  }

  const PAINEIS = { conjunto: pConjunto, ligar: pLigar, ordenar: pOrdenar, reta: pReta, fila: pFila };

  // abre o painel do exercício dentro da caixa; "reagir" responde a cada passo
  function desafio(caixa, ex, fim, reagir) {
    ocupado = false;
    caixa.innerHTML = '';
    el = { palco: caixa, reagir, painel: null };
    PAINEIS[ex.tipo](ex, fim);
    if (el.painel) el.painel.classList.add('solto');
  }

  return { desafio, tipos: Object.keys(PAINEIS) };
})();

// =====================================================================
// MASMORRA vista de cima (Canvas): salas, movimento, monstros e desafios
// =====================================================================

// Salas em dados: 11 colunas × 13 linhas. Legenda:
// #  parede   .  chão   o  moeda   c  baú (desafio)   X  saída   @  início   m  monstro   B  chefão
// ^ v < >  portas (norte, sul, oeste, leste): levam à sala vizinha em "pos" [coluna, linha]
// trancas: portas com cadeado, abertas com um desafio ('cima', 'baixo', 'esquerda', 'direita')
// Portas e saída só abrem quando todos os monstros da sala caem.
const SALAS_MASMORRA = [
  { pos: [0, 0], mapa: [
    '###########',
    '#.........#',
    '#.o.....o.#',
    '#..##.##..#',
    '#.........#',
    '#.o.....o.#',
    '#....@....>',
    '#.........#',
    '#..#...#..#',
    '#..#.c.#..#',
    '#.......m.#',
    '#.o.....o.#',
    '###########'] },
  { pos: [1, 0], mapa: [
    '###########',
    '#.........#',
    '#.##...##.#',
    '#.#o...o#.#',
    '#.........#',
    '#...###...#',
    '<...#c#...#',
    '#...#.#...#',
    '#..m...m..#',
    '#.o.....o.#',
    '#.##...##.#',
    '#.........#',
    '#####v#####'] },
  { pos: [1, 1], mapa: [
    '#####^#####',
    '#.........#',
    '#..o...o..#',
    '#.#######.#',
    '#..m...m..#',
    '#.o.#.#.o.#',
    '<...#c#...#',
    '#.........#',
    '#.#######.#',
    '#..o...o..#',
    '#.........#',
    '#.........#',
    '###########'] },
  { pos: [0, 1], trancas: ['baixo'], mapa: [
    '###########',
    '#.........#',
    '#.o.o.o.o.#',
    '#.........#',
    '#.#.#.#.#.#',
    '#.........#',
    '#.........>',
    '#.#.#.#.#.#',
    '#.m..m..m.#',
    '#.o.o.o.o.#',
    '#....c....#',
    '#.........#',
    '#####v#####'] },
  { pos: [0, 2], mapa: [
    '#####^#####',
    '#.........#',
    '#.o.....o.#',
    '#..#...#..#',
    '#.........#',
    '#...###...#',
    '#...#X#...#',
    '#.........#',
    '#..#...#..#',
    '#.o..B..o.#',
    '#.........#',
    '#.........#',
    '###########'] }
];

// ---------- monstros originais por tema ----------
const TEMAS_MONSTRO = ['Natural', 'Negativo', 'Tabuada', 'Divisão'];
const ICONE_TEMA = { Natural: '🌿', Negativo: '❄️', Tabuada: '✖️', 'Divisão': '➗' };
const NOMES_CHEFE = { Natural: 'Rei Raizão', Negativo: 'Rainha Geleira', Tabuada: 'Vulcão Supremo', 'Divisão': 'Maré Gigante' };
const NOMES_MONSTRO = {
  Natural: ['Brotão', 'Folhito', 'Raizudo'],
  Negativo: ['Friúncio', 'Gelatão', 'Nevisco'],
  Tabuada: ['Brasinha', 'Lavito', 'Fumacê'],
  'Divisão': ['Bolhudo', 'Gotão', 'Marolo']
};
function desenharMonstro(tema, chefe = false) {
  const K = '#1E1240', T = `stroke="${K}" stroke-width="4" stroke-linejoin="round"`;
  const olho = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${T}/><circle cx="${x - 2}" cy="${y + 1}" r="${r / 2}" fill="${K}"/>`;
  const traco = d => `<path d="${d}" fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`;
  const ARTE = {
    // broto com uma folha de cada lado e um olho só
    Natural: `<path d="M50 26 Q38 6 22 12 Q32 28 50 26Z M50 26 Q62 4 80 10 Q70 28 50 26Z" fill="#86EFAC" ${T}/>${traco('M50 26 V36')}<ellipse cx="50" cy="64" rx="38" ry="32" fill="#22C55E" ${T}/>` + olho(50, 56, 14) + traco('M38 76 Q50 84 62 76'),
    // bloco de gelo com pontas; a boca é um sinal de menos
    Negativo: `<path d="M22 42 L30 12 L40 36 L50 6 L60 36 L70 12 L78 42Z" fill="#E0F2FE" ${T}/><rect x="14" y="34" width="72" height="62" rx="30" fill="#60A5FA" ${T}/>` + olho(38, 58, 10) + olho(62, 58, 10) + traco('M40 80 H60'),
    // chama de lava brava; a boca é um ×
    Tabuada: `<path d="M50 6 Q66 26 74 34 Q92 52 84 74 Q76 96 50 96 Q24 96 16 74 Q8 52 26 34 Q34 26 50 6Z" fill="#F97316" ${T}/><path d="M50 42 Q62 56 60 70 Q56 84 50 84 Q44 84 40 70 Q38 56 50 42Z" fill="#FDE047"/>` + olho(36, 56, 10) + olho(64, 56, 10) + traco('M26 42 L44 48 M74 42 L56 48') + traco('M44 72 L56 84 M56 72 L44 84'),
    // gota com bolhas; a boca é um ÷
    'Divisão': `<path d="M50 4 Q72 36 82 56 Q92 92 50 96 Q8 92 18 56 Q28 36 50 4Z" fill="#22D3EE" ${T}/><circle cx="28" cy="30" r="5" fill="#CFFAFE" ${T}/><circle cx="76" cy="24" r="4" fill="#CFFAFE" ${T}/>` + olho(38, 58, 10) + olho(62, 58, 10) + traco('M40 80 H60') + `<circle cx="50" cy="73" r="3" fill="${K}"/><circle cx="50" cy="87" r="3" fill="${K}"/>`
  };
  const coroa = chefe ? `<path d="M28 16 L34 -6 L44 6 L50 -10 L56 6 L66 -6 L72 16Z" fill="#FFC531" ${T}/><circle cx="50" cy="3" r="3.5" fill="#FF4B5C"/>` : '';
  return `<svg viewBox="0 ${chefe ? -14 : 0} 100 ${chefe ? 114 : 100}" xmlns="http://www.w3.org/2000/svg">${ARTE[tema] || ARTE.Natural}${coroa}</svg>`;
}

const Masmorra = (() => {
  const T = 32, COLS = 11, LINS = 13, VEL = 3.4;               // px por casa · tamanho da sala · casas por segundo
  const CORPO = { l: .56, a: .44 };                              // caixa de colisão dos pés (em casas)
  const MON = { vel: 1.2, velCaca: 2, raio: 3.4, corpo: .6, acorda: .9 }; // passo, perseguição, visão, tamanho, espera ao entrar
  const CHEFE = { velCaca: 1.4, corpo: .9, toque: 1.05, tamanho: 1.7 };
  const VETOR = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };
  const PORTAS = { '^': 'cima', v: 'baixo', '<': 'esquerda', '>': 'direita' };
  const OPOSTA = { cima: 'v', baixo: '^', esquerda: '>', direita: '<' };
  const TECLAS = { arrowup: 'cima', arrowdown: 'baixo', arrowleft: 'esquerda', arrowright: 'direita', w: 'cima', s: 'baixo', a: 'esquerda', d: 'direita' };
  // cor do cenário por mundo: chão, chão alternado, parede, topo da parede, sombra
  const PALETAS = [
    { chao: '#E9FFF2', chao2: '#DDF7E8', parede: '#2FBF71', topo: '#86E3AE', sombra: '#1C8A50' },
    { chao: '#EEF6FF', chao2: '#E1EDFC', parede: '#4E9BE8', topo: '#B8DBFF', sombra: '#2F6DB0' },
    { chao: '#FFF2E8', chao2: '#FFE5D2', parede: '#E2552B', topo: '#F9A66C', sombra: '#9A3412' },
    { chao: '#EAFDFF', chao2: '#D7F6FA', parede: '#0EA5B7', topo: '#67E8F9', sombra: '#0B6E7A' },
    { chao: '#2A2463', chao2: '#241F57', parede: '#7C3AED', topo: '#A78BFA', sombra: '#4C1D95' }
  ];

  let M = null, cv = null, ctx = null, raf = 0, ligado = false, cache = { chave: '', imgs: {} };
  const joy = { x: 0, y: 0 }, teclas = new Set(), artes = {};

  const sala = () => M.salas[M.atual];
  const casa = (c, l) => (sala().g[l] || [])[c] || '#';
  const aberta = (i, dir) => M.prog.pegos.includes(`porta:${i}:${dir}`);
  const cadeado = dir => sala().trancas.includes(dir) && !aberta(M.atual, dir);
  // portas e saída fecham enquanto houver monstro; porta com cadeado pede desafio
  const fechada = ch => (PORTAS[ch] || ch === 'X') && (sala().monstros.length > 0 || (PORTAS[ch] && cadeado(PORTAS[ch])));
  const solido = (c, l) => { const ch = casa(c, l); return '#cC'.includes(ch) || fechada(ch); };
  const vizinha = (s, dir) => M.salas.findIndex(o => o.pos[0] === s.pos[0] + VETOR[dir][0] && o.pos[1] === s.pos[1] + VETOR[dir][1]);

  // ---------- abrir a masmorra do dia ----------
  function abrir(op) {
    cv = document.getElementById('mas-tela');
    ctx = cv.getContext('2d');
    if (!ligado) ligarControles();
    M = { op, prog: op.progresso, cor: PALETAS[op.mundo] || PALETAS[0], vidas: op.vidas, maxVidas: op.vidas, entrada: null, textos: [], transicao: null, ultimo: 0, fim: false, pausa: false, graca: 0, acorda: 0, aviso: 0, errosSala: 0 };
    montarSalas();
    irParaInicio();
    sprites();
    pintarVidas();
    ajustar();
    teclas.clear();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(quadro);
  }

  function montarSalas() {
    M.salas = SALAS_MASMORRA.map((s, i) => ({
      pos: s.pos,
      g: s.mapa.map((linha, l) => linha.split('').map((ch, c) => ('@mB'.includes(ch) ? '.' : M.prog.pegos.includes(`${i}:${c}:${l}`) ? (ch === 'c' ? 'C' : '.') : ch))),
      portas: [...new Set(s.mapa.join('').split('').filter(ch => PORTAS[ch]).map(ch => PORTAS[ch]))],
      saida: s.mapa.join('').includes('X'),
      trancas: s.trancas || [],
      monstros: criarMonstros(i, s)
    }));
  }

  // monstros que ainda não caíram; o tema vem do mundo do dia (revisão: sorteado)
  function criarMonstros(i, s) {
    const lista = [];
    s.mapa.forEach((linha, l) => linha.split('').forEach((ch, c) => {
      const chave = `m:${i}:${c}:${l}`;
      if (!'mB'.includes(ch) || M.prog.pegos.includes(chave)) return;
      const tema = TEMAS_MONSTRO[M.op.mundo] || sortear(TEMAS_MONSTRO), chefe = ch === 'B';
      const [min, max] = CONFIG_BATALHA.vidaMonstro, vida = chefe ? CONFIG_BATALHA.vidaChefe : min + 5 * rnd(0, Math.floor((max - min) / 5));
      lista.push({ chave, sala: i, x: c + .5, y: l + .5, tema, chefe, nome: chefe ? NOMES_CHEFE[tema] : sortear(NOMES_MONSTRO[tema]), vida, max: vida, dir: null, t: 0, olhar: -1, caca: false, cores: { a1: M.cor.topo, a2: M.cor.chao } });
    }));
    return lista;
  }

  function irParaInicio() {
    M.atual = 0;
    SALAS_MASMORRA[0].mapa.forEach((linha, l) => { const c = linha.indexOf('@'); if (c >= 0) M.P = { x: c + .5, y: l + .5, dir: 'baixo', passo: 0, andando: false }; });
    M.acorda = MON.acorda;
    M.errosSala = 0;
    visitar(0);
  }

  // personagem do aluno: a função SVG vira imagens nas 4 direções (parado e 2 passos)
  function sprites() {
    const chave = JSON.stringify(M.op.personagem);
    if (cache.chave !== chave) {
      cache = { chave, imgs: {} };
      for (const dir of Object.keys(VETOR)) for (const pose of ['parado', 'anda1', 'anda2']) cache.imgs[dir + pose] = imagem(desenharPersonagem(M.op.personagem, pose, dir).replace('<svg ', '<svg width="100" height="132" '));
    }
    for (const tema of TEMAS_MONSTRO) if (!artes[tema]) {
      artes[tema] = imagem(desenharMonstro(tema).replace('<svg ', '<svg width="100" height="100" '));
      artes[tema + '👑'] = imagem(desenharMonstro(tema, true).replace('<svg ', '<svg width="100" height="114" '));
    }
  }
  function imagem(svg) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
  }

  // câmera fixa: a sala inteira cabe no palco, nítida em qualquer tela
  function ajustar() {
    const palco = cv.parentElement, dpr = window.devicePixelRatio || 1;
    const k = Math.max(.4, Math.min(palco.clientWidth / (COLS * T), palco.clientHeight / (LINS * T)));
    cv.style.width = COLS * T * k + 'px';
    cv.style.height = LINS * T * k + 'px';
    cv.width = Math.round(COLS * T * k * dpr);
    cv.height = Math.round(LINS * T * k * dpr);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
  }

  // ---------- controles: joystick virtual e setas ----------
  function ligarControles() {
    ligado = true;
    const base = document.getElementById('joy'), bola = base.querySelector('i');
    let id = null;
    const mexer = e => {
      const r = base.getBoundingClientRect(), raio = r.width / 2 - 16;
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > raio) { dx *= raio / d; dy *= raio / d; }
      bola.style.transform = `translate(${dx}px,${dy}px)`;
      joy.x = dx / raio;
      joy.y = dy / raio;
    };
    const soltar = e => {
      if (e && e.pointerId !== id) return;
      id = null;
      joy.x = joy.y = 0;
      bola.style.transform = '';
      base.classList.remove('ativo');
    };
    base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(id); base.classList.add('ativo'); mexer(e); });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) mexer(e); });
    base.addEventListener('pointerup', soltar);
    base.addEventListener('pointercancel', soltar);
    addEventListener('keydown', e => {
      const d = TECLAS[(e.key || '').toLowerCase()];
      if (!d || !M || M.pausa || !document.getElementById('t-masmorra').classList.contains('ativa')) return;
      teclas.delete(d);
      teclas.add(d);
      e.preventDefault();
    });
    addEventListener('keyup', e => teclas.delete(TECLAS[(e.key || '').toLowerCase()]));
    addEventListener('resize', () => { if (M) ajustar(); });
  }

  // só 4 direções: vale a tecla mais recente ou o eixo mais forte do joystick
  function direcao() {
    if (teclas.size) return [...teclas].pop();
    if (Math.hypot(joy.x, joy.y) < .3) return null;
    return Math.abs(joy.x) > Math.abs(joy.y) ? (joy.x > 0 ? 'direita' : 'esquerda') : joy.y > 0 ? 'baixo' : 'cima';
  }

  // ---------- movimento e colisão ----------
  function colide(x, y, l = CORPO.l, a = CORPO.a, bloqueia = solido) {
    const c0 = Math.floor(x - l / 2), c1 = Math.floor(x + l / 2 - 1e-6), l0 = Math.floor(y - a / 2), l1 = Math.floor(y + a / 2 - 1e-6);
    for (let k = l0; k <= l1; k++) for (let c = c0; c <= c1; c++) if (bloqueia(c, k)) return true;
    return false;
  }

  function andar(eixo, passo) {
    const P = M.P, novo = { x: P.x, y: P.y };
    novo[eixo] += passo;
    if (!colide(novo.x, novo.y)) { P[eixo] = novo[eixo]; return; }
    const outro = eixo === 'x' ? 'y' : 'x', s = Math.sign(passo), meia = (eixo === 'x' ? CORPO.l : CORPO.a) / 2;
    const frente = Math.floor(P[eixo] + s * (meia + .05)), meio = Math.floor(P[outro]);
    const ali = eixo === 'x' ? [frente, meio] : [meio, frente], ch = casa(...ali);
    if (ch === 'c') return abrirBau(...ali);
    if (fechada(ch)) return bateuPorta(ch, ali);
    // quina: escorrega para o centro da fileira livre mais perto (passa fácil em portas e corredores)
    let alvo = null;
    for (const k of [meio, meio - 1, meio + 1]) {
      const livre = eixo === 'x' ? !solido(frente, k) : !solido(k, frente);
      const dist = Math.abs(k + .5 - P[outro]);
      if (livre && dist < .75 && (alvo === null || dist < Math.abs(alvo + .5 - P[outro]))) alvo = k;
    }
    if (alvo === null) return;
    const d = alvo + .5 - P[outro], tenta = { x: P.x, y: P.y };
    tenta[outro] += Math.sign(d) * Math.min(Math.abs(d), Math.abs(passo));
    if (!colide(tenta.x, tenta.y)) P[outro] = tenta[outro];
  }

  // porta fechada: monstros na sala (aviso) ou cadeado (desafio)
  function bateuPorta(ch, [c, l]) {
    if (M.graca > 0 || M.pausa) return;
    if (sala().monstros.length) {
      if (M.aviso <= 0) { flutuar('👾 primeiro', c + .5, l + .3); M.aviso = 1.2; }
      return;
    }
    const dir = PORTAS[ch];
    M.pausa = true;
    M.op.aoDesafio('porta', r => {
      M.pausa = false;
      M.ultimo = 0;
      M.graca = .8;
      if (!r.aberto) return;
      M.prog.pegos.push(`porta:${M.atual}:${dir}`);
      M.op.aoSalvar();
      som('bau');
      flutuar('🔓', c + .5, l + .3);
    });
  }

  // ---------- moedas, baús (desafio), portas e saída ----------
  const guardar = (c, l) => { M.prog.pegos.push(`${M.atual}:${c}:${l}`); M.op.aoSalvar(); };

  function coletar() {
    const P = M.P;
    for (let l = Math.floor(P.y) - 1; l <= Math.floor(P.y) + 1; l++) for (let c = Math.floor(P.x) - 1; c <= Math.floor(P.x) + 1; c++) {
      if (casa(c, l) !== 'o' || Math.hypot(c + .5 - P.x, l + .5 - P.y) > .62) continue;
      sala().g[l][c] = '.';
      guardar(c, l);
      M.op.aoMoeda(1);
      som('moeda');
      vibrar(15);
      flutuar('+1 🪙', c + .5, l + .2);
    }
  }

  function abrirBau(c, l) {
    if (M.graca > 0 || M.pausa) return;
    M.pausa = true;
    M.op.aoDesafio('bau', r => {
      M.pausa = false;
      M.ultimo = 0;
      M.graca = .8;
      if (!r.aberto) return;
      const n = r.certo ? 5 : 2;
      sala().g[l][c] = 'C';
      guardar(c, l);
      M.op.aoMoeda(n);
      som('bau');
      vibrar(40);
      flutuar(`+${n} 🪙`, c + .5, l - .1);
    });
  }

  function conferirCasa() {
    const P = M.P, ch = casa(Math.floor(P.x), Math.floor(P.y));
    if (PORTAS[ch] && !M.transicao) {
      const destino = vizinha(sala(), PORTAS[ch]), dir = PORTAS[ch];
      if (destino >= 0) { som('clique'); M.transicao = { t: 0, trocou: false, trocar: () => entrar(destino, dir) }; }
    }
    if (ch === 'X' && !M.fim) {
      M.fim = true;
      som('vitoria');
      flutuar('🏁', P.x, P.y - 1);
      setTimeout(() => M.op.aoSaida(), 450);
    }
  }

  // o aluno entra pela porta oposta da sala vizinha
  function entrar(destino, dir) {
    const [dx, dy] = VETOR[dir];
    M.atual = destino;
    sala().g.forEach((linha, l) => linha.forEach((ch, c) => { if (ch === OPOSTA[dir]) { M.P.x = c + .5 + dx; M.P.y = l + .5 + dy; } }));
    M.acorda = MON.acorda;
    M.errosSala = 0;
    visitar(destino);
    const chefe = sala().monstros.find(m => m.chefe);
    if (chefe) { M.entrada = { t: 0, nome: chefe.nome }; som('chefe'); vibrar([120, 60, 120]); } // entrada dramática
  }

  function visitar(i) {
    if (!M.prog.visitadas.includes(i)) { M.prog.visitadas.push(i); M.op.aoSalvar(); }
    pintarMini();
  }

  const flutuar = (txt, x, y) => M.textos.push({ txt, x, y, t: 0 });

  // ---------- monstros: passeiam e perseguem de perto ----------
  const bloqueiaMonstro = (c, l) => { const ch = casa(c, l); return '#cCX'.includes(ch) || !!PORTAS[ch]; };

  function moverMonstros(dt) {
    for (const m of sala().monstros) {
      m.bob = (m.bob || 0) + dt;
      if (M.acorda > 0) continue;
      const dx = M.P.x - m.x, dy = M.P.y - m.y, dist = Math.hypot(dx, dy);
      m.caca = dist < MON.raio;
      let dir;
      if (m.caca) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'direita' : 'esquerda') : dy > 0 ? 'baixo' : 'cima';
      else {
        m.t -= dt;
        if (m.t <= 0 || !m.dir) { m.dir = sortear(Object.keys(VETOR)); m.t = 1 + Math.random(); }
        dir = m.dir;
      }
      const v = (m.caca ? (m.chefe ? CHEFE.velCaca : MON.velCaca) : MON.vel) * dt;
      if (!passoMonstro(m, dir, v)) {
        if (m.caca) passoMonstro(m, Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? 'baixo' : 'cima') : dx > 0 ? 'direita' : 'esquerda', v);
        else m.t = 0;
      }
      if (dist < (m.chefe ? CHEFE.toque : .75) && M.graca <= 0 && !M.pausa) return batalha(m);
    }
  }

  function passoMonstro(m, dir, v) {
    const [vx, vy] = VETOR[dir], nx = m.x + vx * v, ny = m.y + vy * v;
    if (vx) m.olhar = vx;
    const corpo = m.chefe ? CHEFE.corpo : MON.corpo;
    if (colide(nx, ny, corpo, corpo, bloqueiaMonstro)) return false;
    m.x = nx;
    m.y = ny;
    return true;
  }

  // encostou: abre a batalha por turnos (app.js decide perguntas, dano e prêmios)
  function batalha(m) {
    M.pausa = true;
    M.P.andando = false;
    teclas.clear();
    joy.x = joy.y = 0;
    som('pulo');
    vibrar(60);
    M.op.aoBatalha(m, { vidas: M.vidas, max: M.maxVidas }, res => {
      M.pausa = false;
      M.ultimo = 0;
      M.graca = 1.2;
      if (res.venceu) {
        M.vidas = res.vidas;
        sala().monstros = sala().monstros.filter(x => x !== m);
        M.prog.pegos.push(m.chave);
        M.op.aoSalvar();
        M.errosSala += res.erros;
        flutuar('💥', m.x, m.y - .4);
        if (!sala().monstros.length) {
          som('vitoria');
          flutuar('🔓', M.P.x, M.P.y - 1.2);
          M.op.aoSalaLimpa(M.atual, M.errosSala === 0, !!m.chefe);
        }
      } else {
        // sem corações: volta ao início com o progresso do dia guardado
        M.vidas = M.maxVidas;
        M.transicao = { t: 0, trocou: false, trocar: () => { montarSalas(); irParaInicio(); flutuar('💪', M.P.x, M.P.y - 1); } };
      }
      pintarVidas();
    });
  }

  // ---------- laço do jogo ----------
  function quadro(ms) {
    if (!M) return;
    if (!document.getElementById('t-masmorra').classList.contains('ativa')) return parar();
    const dt = M.ultimo ? Math.min(.05, (ms - M.ultimo) / 1000) : 0;
    M.ultimo = ms;
    atualizar(dt);
    desenhar(ms / 1000);
    raf = requestAnimationFrame(quadro);
  }

  function atualizar(dt) {
    M.textos = M.textos.filter(f => (f.t += dt) < .5);
    const tr = M.transicao, P = M.P;
    if (tr) {
      tr.t += dt;
      if (tr.t >= .14 && !tr.trocou) { tr.trocou = true; tr.trocar(); }
      if (tr.t >= .36) M.transicao = null;
      return;
    }
    if (M.entrada) {
      M.entrada.t += dt;
      if (M.entrada.t > 1.4) M.entrada = null;
      return;
    }
    if (M.pausa) return;
    M.graca = Math.max(0, M.graca - dt);
    M.acorda = Math.max(0, M.acorda - dt);
    M.aviso = Math.max(0, M.aviso - dt);
    const d = M.fim ? null : direcao();
    P.andando = !!d;
    if (d) {
      P.dir = d;
      P.passo += dt;
      const [dx, dy] = VETOR[d];
      if (dx) andar('x', dx * VEL * dt);
      else andar('y', dy * VEL * dt);
      coletar();
      conferirCasa();
    }
    if (!M.pausa && !M.transicao) moverMonstros(dt);
  }

  // ---------- desenho ----------
  function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function caixa(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }

  function desenhar(t) {
    const C = M.cor, g = sala().g;
    ctx.save();
    if (M.entrada && M.entrada.t < .5) ctx.translate(Math.sin(t * 70) * 3, 0); // o chão treme quando o chefão chega
    ctx.fillStyle = C.chao;
    ctx.fillRect(0, 0, COLS * T, LINS * T);
    for (let l = 0; l < LINS; l++) for (let c = 0; c < COLS; c++) {
      const ch = g[l][c], x = c * T, y = l * T;
      if (ch === '#') {
        ctx.fillStyle = C.parede;
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = C.topo;
        ctx.fillRect(x, y, T, T * .62);
        if (l + 1 < LINS && g[l + 1][c] !== '#') { ctx.fillStyle = C.sombra; ctx.fillRect(x, y + T - 5, T, 5); }
        continue;
      }
      if ((c + l) % 2) { ctx.fillStyle = C.chao2; ctx.fillRect(x, y, T, T); }
      if (PORTAS[ch]) porta(x, y, PORTAS[ch]);
      else if (ch === 'o') moeda(x + T / 2, y + T / 2 + Math.sin(t * 4 + c + l) * 2.5);
      else if (ch === 'c' || ch === 'C') bau(x, y, ch === 'C');
      else if (ch === 'X') saida(x + T / 2, y + T / 2, t, fechada('X'));
    }
    for (const m of sala().monstros) monstro(m, t);
    heroi();
    textos();
    ctx.restore();
    if (M.entrada) entradaChefe();
    if (M.transicao) {
      const tr = M.transicao, a = tr.t < .14 ? tr.t / .14 : 1 - (tr.t - .14) / .22;
      ctx.fillStyle = `rgba(20,15,46,${Math.max(0, Math.min(1, a))})`;
      ctx.fillRect(0, 0, COLS * T, LINS * T);
    }
  }

  // entrada do chefão: escurece, o nome cresce e some (1,4 s em passos curtos)
  function entradaChefe() {
    const e = M.entrada.t, a = Math.min(1, e / .3) * (e > 1.1 ? Math.max(0, 1 - (e - 1.1) / .3) : 1), k = e < .4 ? .6 + e : 1;
    ctx.fillStyle = `rgba(20,15,46,${.6 * a})`;
    ctx.fillRect(0, 0, COLS * T, LINS * T);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((COLS * T) / 2, LINS * T * .3);
    ctx.scale(k, k);
    ctx.font = '900 26px ui-rounded, "Nunito", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = TINTA;
    ctx.fillStyle = '#FFC531';
    ctx.strokeText(`👑 ${M.entrada.nome}`, 0, 0);
    ctx.fillText(`👑 ${M.entrada.nome}`, 0, 0);
    ctx.restore();
  }

  function porta(x, y, dir) {
    const [dx, dy] = VETOR[dir];
    ctx.fillStyle = M.cor.sombra;
    ctx.globalAlpha = .3;
    ctx.fillRect(x, y, T, T);
    ctx.globalAlpha = 1;
    if (sala().monstros.length) { // grades enquanto houver monstro
      ctx.fillStyle = '#4B4466';
      for (let k = 0; k < 3; k++) dy ? ctx.fillRect(x + 6 + k * 9, y + 2, 4, T - 4) : ctx.fillRect(x + 2, y + 6 + k * 9, T - 4, 4);
      return;
    }
    if (cadeado(dir)) { // cadeado dourado
      ctx.fillStyle = '#FFC531';
      caixa(x + 9, y + 14, 14, 12, 3);
      ctx.strokeStyle = '#FFC531';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 16, y + 14, 5, Math.PI, 0);
      ctx.stroke();
      return;
    }
    ctx.globalAlpha = .75;
    ctx.fillStyle = '#fff';
    const cx = x + T / 2 + dx * 4, cy = y + T / 2 + dy * 4;
    ctx.beginPath();
    ctx.moveTo(cx + dx * 7, cy + dy * 7);
    ctx.lineTo(cx - dy * 7 - dx * 4, cy + dx * 7 - dy * 4);
    ctx.lineTo(cx + dy * 7 - dx * 4, cy - dx * 7 - dy * 4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function moeda(x, y) {
    ctx.fillStyle = '#E09B00'; circ(x, y + 1.5, 8);
    ctx.fillStyle = '#FFC531'; circ(x, y, 8);
    ctx.fillStyle = '#FFF3B0'; circ(x - 2.5, y - 2.5, 2.6);
  }

  function bau(x, y, aberto) {
    const px = x + 5, py = y + 8, w = T - 10;
    ctx.fillStyle = '#9A3412'; caixa(px, py + 6, w, 14, 4);
    ctx.fillStyle = aberto ? '#5B1F0A' : '#C2410C'; caixa(px, aberto ? py - 3 : py, w, 9, 4);
    ctx.fillStyle = '#FFC531'; ctx.fillRect(px + w / 2 - 3, py + 2, 6, 16);
    if (aberto) { ctx.globalAlpha = .7; ctx.fillStyle = '#FFE48A'; circ(px + w / 2, py + 3, 6); ctx.globalAlpha = 1; }
  }

  function saida(x, y, t, fechadaAgora) {
    const p = fechadaAgora ? 1 : 1 + Math.sin(t * 5) * .08;
    ctx.fillStyle = fechadaAgora ? '#6B6585' : '#7B2FF7'; circ(x, y, 13 * p);
    ctx.fillStyle = fechadaAgora ? '#9D97B5' : '#C4B5FD'; circ(x, y, 8 * p);
    ctx.fillStyle = '#fff'; circ(x, y, 3.5);
  }

  function monstro(m, t) {
    const img = artes[m.tema + (m.chefe ? '👑' : '')], w = T * (m.chefe ? CHEFE.tamanho : 1.1), h = m.chefe ? w * 1.14 : w, pulo = Math.abs(Math.sin(m.bob * (m.caca ? 9 : 5))) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(m.x * T, (m.y + .3) * T, w * .34, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(m.x * T, (m.y + .3) * T - pulo);
      if (m.olhar > 0) ctx.scale(-1, 1); // a arte olha para a esquerda
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
    }
    if (m.caca && M.acorda <= 0) {
      ctx.font = '900 14px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4B5C';
      ctx.fillText('!', m.x * T, (m.y + .3) * T - h - 4 - pulo);
    }
  }

  function heroi() {
    const P = M.P, pose = P.andando ? (Math.floor(P.passo * 8) % 2 ? 'anda1' : 'anda2') : 'parado';
    const img = cache.imgs[P.dir + pose], w = T * 1.15, h = w * 1.32, pe = (P.y + CORPO.a / 2) * T;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(P.x * T, pe - 2, w * .32, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (M.graca > 0 && Math.floor(M.graca * 10) % 2) ctx.globalAlpha = .45; // pisca depois da batalha
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, P.x * T - w / 2, pe - h * (128 / 132), w, h);
    ctx.globalAlpha = 1;
  }

  function textos() {
    ctx.font = '900 13px ui-rounded, "Nunito", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = TINTA;
    ctx.fillStyle = '#fff';
    for (const f of M.textos) {
      const y = (f.y - f.t * 1.2) * T;
      ctx.globalAlpha = 1 - f.t / .5;
      ctx.strokeText(f.txt, f.x * T, y);
      ctx.fillText(f.txt, f.x * T, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- corações e mini mapa (HUD) ----------
  function pintarVidas() {
    document.getElementById('mas-vidas').innerHTML = Array.from({ length: M.maxVidas }, (_, k) => (k < M.vidas ? '❤️' : '🤍')).join('');
  }

  function pintarMini() {
    const Q = 12, G = 6, vis = M.prog.visitadas, centro = s => [s.pos[0] * (Q + G) + Q / 2, s.pos[1] * (Q + G) + Q / 2];
    const W = Math.max(...M.salas.map(s => s.pos[0])) + 1, H = Math.max(...M.salas.map(s => s.pos[1])) + 1;
    let linhas = '', quadros = '';
    M.salas.forEach((s, i) => {
      if (!vis.includes(i)) return;
      for (const dir of s.portas) {
        const j = vizinha(s, dir);
        if (j > i && vis.includes(j)) { const [a, b] = centro(s), [c, d] = centro(M.salas[j]); linhas += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; }
      }
      const [x, y] = [s.pos[0] * (Q + G), s.pos[1] * (Q + G)];
      quadros += `<rect x="${x}" y="${y}" width="${Q}" height="${Q}" rx="3" fill="${i === M.atual ? '#7B2FF7' : '#FFFFFF66'}"/>` + (s.saida ? `<circle cx="${x + Q / 2}" cy="${y + Q / 2}" r="2.5" fill="#FFC531"/>` : '');
    });
    const mini = document.getElementById('mas-mini');
    mini.setAttribute('viewBox', `-3 -3 ${W * (Q + G) - G + 6} ${H * (Q + G) - G + 6}`);
    mini.innerHTML = `<g stroke="#FFFFFF66" stroke-width="3">${linhas}</g>${quadros}`;
  }

  function parar() {
    cancelAnimationFrame(raf);
    teclas.clear();
    joy.x = joy.y = 0;
  }

  // o app pausa a masmorra (melhorias) e dá corações extras
  function pausar(sim) {
    if (!M) return;
    M.pausa = sim;
    M.ultimo = 0;
    teclas.clear();
  }
  function coracao() {
    if (!M) return;
    M.maxVidas++;
    M.vidas++;
    pintarVidas();
  }

  return { abrir, parar, pausar, coracao };
})();

// =====================================================================
// BATALHA por turnos: monstro no alto à direita, aluno de costas embaixo
// =====================================================================
const Batalha = (() => {
  const $b = id => document.getElementById(id);
  let op = null, fala = 0;

  function abrir(o) {
    op = o;
    const m = o.monstro, b = $b('batalha'), arena = $b('arena');
    b.hidden = false;
    arena.classList.toggle('chefe', !!m.chefe);
    b.style.setProperty('--a1', m.cores.a1);
    b.style.setProperty('--a2', m.cores.a2);
    $b('b-nome').textContent = `${ICONE_TEMA[m.tema]} ${m.nome}`;
    $b('b-arte').className = 'b-arte-m' + (m.chefe ? ' grande' : '');
    $b('b-arte').innerHTML = desenharMonstro(m.tema, m.chefe);
    $b('b-poderes').hidden = true;
    $b('b-efeitos').textContent = '';
    $b('b-dano').classList.remove('pop');
    $b('b-heroi').className = 'b-arte-h';
    $b('b-heroi').innerHTML = desenharPersonagem(o.personagem, 'parado', 'cima');
    $b('b-respostas').innerHTML = '';
    $b('b-fala').textContent = `${m.nome} apareceu!`;
    $b('b-dica').innerHTML = '';
    $b('b-segue').hidden = true;
    vida(m.vida, m.max);
    vidas(o.vidas);
    $b('b-poder').disabled = !o.aoPoder;
    $b('b-poder').onclick = () => o.aoPoder && o.aoPoder();
    $b('b-dicabt').onclick = () => o.aoDica();
    if (m.chefe) { // entrada dramática: escurece, o chefão desce, nome grande, tremor
      animar(arena, 'escurece');
      animar($b('b-arte'), 'desce');
      banner(`👑 ${m.nome}`);
      som('chefe');
      vibrar([150, 60, 150]);
      setTimeout(() => animar(arena, 'balanca'), 450);
    }
  }

  function banner(txt) {
    const b = $b('b-banner');
    b.textContent = txt;
    animar(b, 'mostra');
  }

  // fase do chefão: novo tipo de pergunta e cor mais brava
  function fase(n, rotulo) {
    const a = $b('b-arte');
    a.classList.remove('fase2', 'fase3');
    if (n > 1) a.classList.add('fase' + n);
    banner(`Fase ${n} · ${rotulo}`);
  }

  // poderes das cartas: lista curta acima das respostas
  function poderes(lista, escolher) {
    const p = $b('b-poderes');
    if (!p.hidden) { p.hidden = true; return; }
    p.innerHTML = lista.map(x => `<button class="b-poder" data-id="${x.id}"${x.qtd ? '' : ' disabled'}><span>${x.icone}</span><b>${x.nome} · ${x.qtd}</b><small>${x.efeito}</small></button>`).join('');
    p.hidden = false;
    p.onclick = e => { const bt = e.target.closest('.b-poder'); if (!bt || bt.disabled) return; p.hidden = true; escolher(bt.dataset.id); };
  }

  function eliminar(k) {
    const bt = botoes()[k];
    if (bt) { bt.disabled = true; bt.classList.add('fora'); }
  }

  function efeitos(selos, dicaTxt, poderTxt) {
    $b('b-efeitos').textContent = selos;
    $b('b-dicabt').textContent = dicaTxt;
    $b('b-poder').textContent = poderTxt;
  }

  function vida(v, max) {
    const i = $b('b-vida'), f = v / max;
    i.style.width = 100 * f + '%';
    i.style.background = f > .5 ? 'var(--ok)' : f > .25 ? 'var(--ouro)' : 'var(--erro)';
    $b('b-pv').textContent = `${v}/${max}`;
  }

  function vidas(n, perdeu) {
    $b('b-vidas').innerHTML = Array.from({ length: op.maxVidas }, (_, k) => `<span class="${perdeu && k === n ? 'perde' : ''}">${k < n ? '❤️' : '🤍'}</span>`).join('');
  }

  // a pergunta aparece digitando (até 0,45 s); as respostas ficam numa grade 2x2
  function perguntar(q, pronto) {
    $b('b-poderes').hidden = true;
    $b('b-dica').innerHTML = '';
    $b('b-segue').hidden = true;
    const r = $b('b-respostas');
    r.innerHTML = '';
    q.opcoes.forEach((o, i) => {
      const bt = document.createElement('button');
      bt.className = 'b-resp' + (o.length > 6 ? ' longa' : '');
      bt.dataset.i = i;
      bt.textContent = o;
      r.appendChild(bt);
    });
    r.onclick = e => { const bt = e.target.closest('.b-resp'); if (bt && !bt.disabled) op.aoResponder(+bt.dataset.i); };
    const el = $b('b-fala'), n = q.texto.length, porVez = Math.max(1, Math.ceil(n / 28));
    let k = 0;
    clearInterval(fala);
    el.textContent = '';
    fala = setInterval(() => {
      k = Math.min(n, k + porVez);
      el.textContent = q.texto.slice(0, k);
      if (k >= n) { clearInterval(fala); if (pronto) pronto(); }
    }, 16);
  }

  const botoes = () => [...$b('b-respostas').children];
  const travar = () => botoes().forEach(b => (b.disabled = true));
  const animar = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function numero(txt, cor) {
    const d = $b('b-dano');
    d.textContent = txt;
    d.style.color = cor;
    animar(d, 'pop');
  }

  // acerto: o aluno avança e ataca, o monstro treme e a vida desce
  function acerto(i, dano, v, max, rapido, cb) {
    clearInterval(fala);
    travar();
    botoes()[i].classList.add('certa');
    animar($b('b-heroi'), 'ataca');
    som('pulo');
    setTimeout(() => {
      animar($b('b-arte'), 'dor');
      vida(v, max);
      numero(`Acerto! ${dano} de dano${rapido ? ' ⚡' : ''}`, '#fff');
      som('moeda');
      vibrar(30);
    }, 200);
    setTimeout(cb, 900);
  }

  // erro: o monstro ataca, a tela balança, sai um coração e aparece a dica
  function erro(i, certa, q, n, txt, cb) {
    clearInterval(fala);
    travar();
    botoes()[i].classList.add('errada');
    botoes()[certa].classList.add('certa');
    animar($b('b-arte'), 'investe');
    setTimeout(() => {
      animar($b('arena'), 'balanca');
      som('erro');
      vibrar([80, 40, 80]);
      vidas(n, true);
      numero(txt, '#FFB3BB');
      dica(q.dica, q.visual);
      const s = $b('b-segue');
      s.hidden = false;
      s.onclick = () => { s.hidden = true; som('clique'); cb(); };
    }, 250);
  }

  function dica(txt, visual) {
    $b('b-dica').innerHTML = `💡 ${esc(txt)}${visual ? `<div class="visual">${visual}</div>` : ''}`;
  }

  function vitoria(txt, cb, chefe) {
    $b('b-respostas').innerHTML = '';
    if (chefe) { banner('🏆 Vitória!'); confete(); }
    animar($b('b-arte'), 'desmaia');
    numero(txt, '#FFE48A');
    $b('b-fala').textContent = '🎉 Monstro derrotado!';
    som('vitoria');
    setTimeout(cb, chefe ? 1600 : 1100);
  }

  function derrota(cb) {
    $b('b-respostas').innerHTML = '';
    animar($b('b-heroi'), 'desmaia');
    $b('b-fala').textContent = '💔 Sem corações! De volta ao início';
    const s = $b('b-segue');
    s.hidden = false;
    s.onclick = () => { s.hidden = true; som('clique'); cb(); };
  }

  function fechar() {
    clearInterval(fala);
    $b('batalha').hidden = true;
  }

  return { abrir, perguntar, acerto, erro, dica, vitoria, derrota, fechar, fase, poderes, eliminar, efeitos };
})();
