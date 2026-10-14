// Mohamed — jogo.js: cena lateral 2D da lição (só CSS, SVG e animações leves)

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

const Jogo = (() => {
  // cenário por mundo: céu, morros (longe), arbustos (perto), chão e borda do chão
  const TEMAS = [
    { ceu: ['#8FE3FF', '#E8FFF2'], longe: '#9BE8BC', perto: '#2FBF71', chao: '#A0642C', borda: '#3DDC6E' },
    { ceu: ['#B8DBFF', '#F3F9FF'], longe: '#DDEBFF', perto: '#8EC5FF', chao: '#6FA8DC', borda: '#F5FBFF' },
    { ceu: ['#FFC999', '#FFF1E0'], longe: '#F9A66C', perto: '#E2552B', chao: '#6B2510', borda: '#FF8A3D' },
    { ceu: ['#9FF0FA', '#EFFEFF'], longe: '#5EE1F0', perto: '#0EA5B7', chao: '#F5CF7A', borda: '#FFE7A8' },
    { ceu: ['#1E1B4B', '#4C1D95'], longe: '#5B21B6', perto: '#8B5CF6', chao: '#2E1065', borda: '#C084FC' }
  ];
  const SVG = (vb, corpo) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="none">${corpo}</svg>`)}")`;
  const longe = c => SVG('0 0 480 160', `<path d="M0 160V95Q60 25 120 80T240 70Q300 15 360 75T480 95V160Z" fill="${c}"/>`);
  const perto = c => SVG('0 0 320 90', `<g fill="${c}"><circle cx="40" cy="72" r="26"/><circle cx="72" cy="64" r="32"/><circle cx="104" cy="76" r="20"/><rect x="196" y="40" width="10" height="50"/><circle cx="201" cy="36" r="24"/><circle cx="276" cy="80" r="16"/></g>`);
  const chao = (c, b) => SVG('0 0 64 100', `<rect width="64" height="100" fill="${c}"/><rect width="64" height="16" fill="${b}"/><rect x="6" y="42" width="22" height="8" rx="4" fill="#00000022"/><rect x="38" y="72" width="16" height="8" rx="4" fill="#00000022"/>`);

  let el = {}, ocupado = false, geracao = 0;
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const animar = (alvo, kf, ms, easing = 'ease-out') =>
    new Promise(r => { alvo.animate(kf, { duration: ms, easing, fill: 'forwards' }).onfinish = r; });
  const tremer = x => { x.classList.remove('treme'); void x.offsetWidth; x.classList.add('treme'); };

  function iniciar(caixa, { personagem, mundo = 0, total = 8, chefe = false }) {
    const t = TEMAS[mundo] || TEMAS[0];
    geracao++;
    ocupado = false;
    caixa.innerHTML = `<div class="cena m${mundo}"><div class="camada c-longe"></div><div class="camada c-perto"></div><div class="chao"></div><div class="combo-tag" hidden></div><div class="blocos"></div><div class="heroi"></div></div>`;
    const q = s => caixa.querySelector(s);
    el = { cena: q('.cena'), blocos: q('.blocos'), heroi: q('.heroi'), combo: q('.combo-tag'), painel: null, p: personagem, brilho: false };
    el.cena.style.background = `linear-gradient(${t.ceu[0]}, ${t.ceu[1]})`;
    q('.c-longe').style.backgroundImage = longe(t.longe);
    q('.c-perto').style.backgroundImage = perto(t.perto);
    q('.chao').style.backgroundImage = chao(t.chao, t.borda);
    pose('corre');
    document.getElementById('trilha').dataset.n = '';
    trilha(0, total);
    if (chefe) criarMonstro();
  }

  // poses: corre, pula, tombo
  function pose(p) {
    el.heroi.className = `heroi ${p}${el.brilho ? ' brilho' : ''}`;
    el.heroi.innerHTML = desenharPersonagem(el.p, p);
  }

  // trilha curta no topo: 8 a 10 bolinhas até a bandeira
  function trilha(feitos, total) {
    const tr = document.getElementById('trilha');
    const n = Math.min(10, Math.max(8, total));
    if (tr.dataset.n != n) {
      tr.dataset.n = n;
      tr.innerHTML = '<i class="bola"></i>'.repeat(n) + '<span class="bandeira">🏁</span><div class="trilha-heroi"></div>';
      tr.querySelector('.trilha-heroi').innerHTML = desenharPersonagem(el.p);
    }
    const pct = feitos / total;
    tr.querySelectorAll('.bola').forEach((b, k) => b.classList.toggle('feita', k < Math.round(pct * n)));
    tr.querySelector('.trilha-heroi').style.left = `calc(${pct} * (100% - 28px) + 6px)`;
  }

  // ---------- pergunta: blocos "?" ou painel sobre o cenário ----------
  function limpar() {
    pararRelogio();
    el.cena.querySelectorAll('.painel,.power,.relogio,.casas,.buraco').forEach(x => x.remove());
    el.cena.classList.remove('parada');
    el.heroi.getAnimations().forEach(a => a.cancel());
    if (!el.heroi.classList.contains('corre')) pose('corre');
    el.painel = null;
    el.blocos.className = 'blocos';
    el.blocos.innerHTML = '';
  }

  function pergunta(ex, aoTocar, aoPainel, op = {}) {
    limpar();
    if (PAINEIS[ex.tipo]) return PAINEIS[ex.tipo](ex, aoPainel);
    if (op.ponte) abrirBuraco();
    const ops = ex.tipo === 'vf' ? [[true, '✔'], [false, '✘']]
      : ex.tipo === 'digitar' ? [[null, '?']]
      : ex.opcoes.map(o => [o, typeof o === 'number' ? fmt(o) : String(o)]);
    ops.forEach(([v, t], i) => {
      const b = document.createElement('button'), s = document.createElement('span');
      b.className = 'bloco' + (t.length > 3 ? ' longo' : '') + (ex.tipo === 'vf' ? (v ? ' vf-v' : ' vf-f') : '');
      b.style.animationDelay = `${i * .08}s, ${.4 + i * .3}s`;
      s.textContent = t;
      b.appendChild(s);
      if (ex.tipo !== 'digitar') b.onclick = () => { if (!ocupado) aoTocar(v, i); };
      el.blocos.appendChild(b);
    });
  }

  // texto do teclado: vai para o espaço "?" do painel ou do bloco
  function escrever(txt) {
    const slot = el.painel && el.painel.querySelector('.slot');
    if (slot) { slot.textContent = txt || '?'; return; }
    const s = el.blocos.querySelector('span');
    if (!s) return;
    s.textContent = txt || '?';
    s.parentNode.classList.toggle('longo', (txt || '').length > 3);
  }

  function travar() {
    el.cena.querySelectorAll('.power').forEach(x => x.remove()); // power-up não gasta depois da resposta
    el.blocos.classList.add('travado');
    if (el.painel) el.painel.classList.add('travado');
  }

  // personagem pula e bate no bloco: acerto solta moeda, erro dá tombo
  async function bater(i, certo, fim) {
    const g = geracao, b = el.blocos.children[i], h = el.heroi;
    if (!b) return reagir(certo, fim);
    ocupado = true;
    travar();
    const rb = b.getBoundingClientRect(), rh = h.getBoundingClientRect();
    const dx = rb.left + rb.width / 2 - (rh.left + rh.width / 2);
    const dy = Math.max(16, rh.top - rb.bottom + 8);
    const topo = `translate(${dx}px,${-dy}px)`, queda = `translate(${dx}px,0) rotate(-85deg)`;
    pose('pula');
    som('pulo');
    await animar(h, [{ transform: 'none' }, { transform: topo }], 320, 'cubic-bezier(.2,.9,.4,1)');
    if (g !== geracao) return;
    b.classList.add('bate', certo ? 'certo' : 'errado');
    vibrar(certo ? 25 : [70, 40, 70]);
    if (certo) {
      moeda(rb, rh);
      som('moeda');
      await animar(h, [{ transform: topo }, { transform: 'none' }], 380, 'ease-in');
      el.blocos.classList.add('some');
    } else {
      pose('tombo');
      await animar(h, [{ transform: topo }, { transform: queda }], 360, 'ease-in');
      await esperar(450);
      if (g !== geracao) return;
      await animar(h, [{ transform: queda }, { transform: 'none' }], 380);
    }
    terminar(g, certo, fim);
  }

  // reação sem bloco (painéis, teclado e tempo esgotado)
  async function reagir(certo, fim) {
    const g = geracao, h = el.heroi;
    ocupado = true;
    travar();
    if (certo) {
      pose('pula');
      som('pulo');
      await animar(h, [{ transform: 'none' }, { transform: 'translateY(-44px)', offset: .5 }, { transform: 'none' }], 560);
      if (g !== geracao) return;
      const rh = h.getBoundingClientRect();
      moeda({ left: rh.left, width: rh.width, top: rh.top - 70, height: 34 }, rh);
      som('moeda');
      vibrar(25);
    } else {
      pose('tombo');
      vibrar([70, 40, 70]);
      await animar(h, [{ transform: 'none' }, { transform: 'rotate(-85deg)' }], 320, 'ease-in');
      await esperar(450);
      if (g !== geracao) return;
      await animar(h, [{ transform: 'rotate(-85deg)' }, { transform: 'none' }], 320);
    }
    terminar(g, certo, fim);
  }

  function terminar(g, certo, fim) {
    if (g !== geracao) return;
    el.heroi.getAnimations().forEach(a => a.cancel());
    pose('corre');
    balao(certo ? sortear(['Boa!', 'Isso!', 'Uau!', 'Show!']) : sortear(['Quase!', 'Ops!', 'Eita!']));
    ocupado = false;
    if (fim) fim();
  }

  // reação curta a cada passo de um painel
  function pulinho(ok) {
    const h = el.heroi;
    if (ok) {
      h.animate([{ transform: 'none' }, { transform: 'translateY(-20px)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
      som('moeda');
    } else {
      h.animate([{ transform: 'none' }, { transform: 'translateX(-8px) rotate(-8deg)' }, { transform: 'translateX(8px) rotate(8deg)' }, { transform: 'none' }], { duration: 360 });
      som('erro');
      vibrar(60);
    }
    balao(ok ? sortear(['Boa!', 'Isso!', 'Show!']) : sortear(['Ops!', 'Quase!']));
  }

  function moeda(rb, rh) {
    const c = el.cena.getBoundingClientRect(), m = document.createElement('div');
    const x = rb.left - c.left + rb.width / 2 - 17, y = rb.top - c.top + rb.height / 2 - 17;
    m.className = 'moeda';
    m.style.cssText = `left:${x}px;top:${y}px;--hx:${rh.left - c.left + rh.width / 2 - 17 - x}px;--hy:${rh.top - c.top + 20 - y}px`;
    el.cena.appendChild(m);
    setTimeout(() => m.remove(), 800);
  }

  // balão de uma palavra acima do personagem
  function balao(txt) {
    el.cena.querySelectorAll('.balao').forEach(b => b.remove());
    const c = el.cena.getBoundingClientRect(), r = el.heroi.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'balao';
    d.textContent = txt;
    d.style.left = r.left - c.left + r.width / 2 + 'px';
    d.style.top = r.top - c.top - 4 + 'px';
    el.cena.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  // ---------- painéis ----------
  function abrirPainel(cls, html) {
    const p = document.createElement('div');
    p.className = 'painel ' + cls;
    p.innerHTML = html;
    el.cena.appendChild(p);
    el.painel = p;
    return p;
  }

  // controla os passos de um painel: cada acerto ou erro faz o personagem reagir
  function passos(total, fim) {
    let restam = total, errou = false, conta = null;
    return {
      certo() { pulinho(true); if (--restam === 0) fim(!errou, { dada: errou ? conta : 'ok', conta }); },
      errado(c, ...fichas) { errou = true; conta = conta || c; fichas.forEach(tremer); pulinho(false); }
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

  // (etapa 10) completar o padrão: a última linha recebe o teclado
  function pPadrao(ex) {
    const ultima = ex.ultima.includes('?') ? ex.ultima.replace('?', '<b class="slot">?</b>') : `${ex.ultima} <b class="slot">?</b>`;
    abrirPainel('p-padrao', ex.linhas.map(l => `<p>${l}</p>`).join('') + `<p class="ultima">${ultima}</p>`);
  }

  // tabuada: grade de bolinhas que some depois de alguns segundos
  function pGrade(ex) {
    const t = Math.max(6, Math.min(16, Math.floor(190 / ex.b), Math.floor(84 / ex.a)));
    const p = abrirPainel('p-grade',
      `<div class="pontos" style="--t:${t}px;grid-template-columns:repeat(${ex.b},${t}px)">${'<i></i>'.repeat(ex.a * ex.b)}</div>` +
      `<p>${ex.a} × ${ex.b} = <b class="slot">?</b></p>`);
    setTimeout(() => { if (el.painel === p) p.querySelector('.pontos').classList.add('some'); }, ex.mostrar || 2500);
  }

  // tabuada: tabuleiro que se preenche a cada conta
  function pTabuleiro(ex) {
    const casas = Array.from({ length: 10 }, (_, i) => {
      const k = i + 1, atual = k === ex.atual, feita = ex.feitos.includes(k);
      return `<span class="${atual ? 'atual' : feita ? 'cheia' : ''}">${ex.n}×${k}<b>${atual ? '<i class="slot">?</i>' : feita ? ex.n * k : ''}</b></span>`;
    });
    abrirPainel('p-tabuleiro', `<div class="tab">${casas.join('')}</div>`);
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

  // divisão: bolinhas repartidas entre amigos; as que sobram ficam de lado
  function pRepartir(ex) {
    const { n, k } = ex, q = Math.floor(n / k), r = n % k;
    const t = Math.max(7, Math.min(14, Math.floor(150 / Math.max(q, 1)), Math.floor(100 / k) - 4));
    let html = `<div class="amigos" style="--t:${t}px">`;
    for (let i = 0; i < k; i++) html += `<div class="amigo"><b>🙂</b>${Array.from({ length: q }, (_, j) => `<i style="animation-delay:${(j * k + i) * .06}s"></i>`).join('')}</div>`;
    html += '</div>' + (r ? `<div class="sobra">${'<i></i>'.repeat(r)}</div>` : '') + `<p>${ex.rotulo || `${n} ÷ ${k} =`} <b class="slot">?</b></p>`;
    abrirPainel('p-repartir', html);
  }

  // Extra A: o chão vira reta numérica com casas; o personagem pula até a casa tocada
  async function pCasas(ex, fim) {
    const g = geracao, h = el.heroi, box = document.createElement('div');
    box.className = 'casas';
    for (let v = ex.min; v <= ex.max; v++) {
      box.insertAdjacentHTML('beforeend', `<button class="casa${v < 0 ? ' neg' : v === 0 ? ' zero' : ''}${v === ex.de ? ' saida' : ''}" data-v="${v}" style="--d:${Math.max(0, -v)}">${fmt(v)}</button>`);
    }
    el.cena.appendChild(box);
    el.painel = box;
    el.cena.classList.add('parada');
    const base = h.getBoundingClientRect();
    const ponto = v => { const r = box.querySelector(`[data-v="${v}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2 - (base.left + base.width / 2), y: r.top - base.bottom }; };
    const tr = (p, sobe = 0) => `translate(${p.x}px,${p.y - sobe}px)`;
    let atual = ex.de;
    pose('parado');
    await animar(h, [{ transform: 'none' }, { transform: tr(ponto(atual)) }], 450);
    box.onclick = async e => {
      const b = e.target.closest('.casa');
      if (!b || ocupado || box.dataset.feito) return;
      box.dataset.feito = 1;
      ocupado = true;
      const alvo = +b.dataset.v, dir = Math.sign(alvo - atual);
      pose('pula');
      while (atual !== alvo) {
        const a = ponto(atual), c = ponto(atual + dir);
        atual += dir;
        som('clique');
        await animar(h, [{ transform: tr(a) }, { transform: tr({ x: (a.x + c.x) / 2, y: Math.min(a.y, c.y) }, 18), offset: .5 }, { transform: tr(c) }], 170);
        if (g !== geracao) return;
      }
      const certo = alvo === ex.resposta;
      b.classList.add(certo ? 'certo' : 'errado');
      if (!certo) box.querySelector(`[data-v="${ex.resposta}"]`).classList.add('certa');
      ocupado = false;
      fim(certo, { dada: fmt(alvo), conta: ex.conta || ex.pergunta, animado: true });
    };
  }

  // fim de uma animação feita pelo próprio painel (casas): só a reação final
  function fechar(certo, fim) {
    const g = geracao;
    travar();
    if (certo) {
      const rh = el.heroi.getBoundingClientRect();
      moeda({ left: rh.left, width: rh.width, top: rh.top - 70, height: 34 }, rh);
      som('moeda');
      vibrar(25);
    } else {
      pose('tombo');
      vibrar([70, 40, 70]);
    }
    balao(certo ? sortear(['Boa!', 'Isso!', 'Uau!']) : sortear(['Quase!', 'Ops!']));
    setTimeout(() => { if (g === geracao && fim) fim(); }, 550);
  }

  const PAINEIS = { conjunto: pConjunto, ligar: pLigar, ordenar: pOrdenar, reta: pReta, padrao: pPadrao, grade: pGrade, tabuleiro: pTabuleiro, fila: pFila, repartir: pRepartir, casas: pCasas };

  // ---------- Extra B: buraco no caminho; a resposta certa constrói a ponte ----------
  function abrirBuraco() {
    const b = document.createElement('div');
    b.className = 'buraco chega';
    b.innerHTML = '<i class="tabuas"></i>';
    el.cena.appendChild(b);
    setTimeout(() => { if (b.isConnected && !ocupado) { el.cena.classList.add('parada'); pose('parado'); } }, 600);
  }

  async function ponte(i, certo, fim) {
    const g = geracao, h = el.heroi, bu = el.cena.querySelector('.buraco'), b = el.blocos.children[i];
    if (!bu) return bater(i, certo, fim);
    ocupado = true;
    travar();
    if (b) b.classList.add('bate', certo ? 'certo' : 'errado');
    const c = el.cena.getBoundingClientRect(), rb = bu.getBoundingClientRect(), rh = h.getBoundingClientRect();
    const meio = rb.left + rb.width / 2 - (rh.left + rh.width / 2), alem = rb.right + 8 - rh.left;
    if (certo) {
      bu.classList.add('ponte');
      som('moeda');
      vibrar(25);
      await esperar(450);
      if (g !== geracao) return;
      el.cena.classList.remove('parada');
      pose('corre');
      await animar(h, [{ transform: 'none' }, { transform: `translateX(${alem}px)` }], 650, 'linear');
      if (g !== geracao) return;
      el.blocos.classList.add('some');
      await Promise.all([
        animar(h, [{ transform: `translateX(${alem}px)` }, { transform: 'none' }], 600, 'ease-in-out'),
        animar(bu, [{ transform: 'none' }, { transform: `translateX(${-(rb.right - c.left) - 20}px)` }], 600, 'ease-in')
      ]);
    } else {
      pose('pula');
      som('pulo');
      await animar(h, [{ transform: 'none' }, { transform: `translate(${meio / 2}px,-40px)`, offset: .5 }, { transform: `translate(${meio}px,0)` }], 420);
      if (g !== geracao) return;
      pose('tombo');
      som('erro');
      vibrar([70, 40, 70]);
      await animar(h, [{ transform: `translate(${meio}px,0)` }, { transform: `translate(${meio}px,130px) rotate(-120deg)`, opacity: 0 }], 480, 'ease-in');
      await esperar(250);
      if (g !== geracao) return;
      pose('parado'); // volta ao início do trecho
      await animar(h, [{ transform: 'translateX(-30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 380);
    }
    terminar(g, certo, fim);
  }

  // ---------- Extra C: chefão com monstrinho e barra de vida ----------
  const MONSTRO = '<svg viewBox="0 0 100 100"><path d="M24 34 L28 6 L42 28Z M76 34 L72 6 L58 28Z" fill="#FFC531" stroke="#1E1240" stroke-width="4" stroke-linejoin="round"/><ellipse cx="50" cy="60" rx="40" ry="34" fill="#14B8A6" stroke="#1E1240" stroke-width="4"/><circle cx="50" cy="50" r="15" fill="#fff" stroke="#1E1240" stroke-width="3"/><circle cx="44" cy="52" r="7" fill="#1E1240"/><path d="M30 74 Q50 88 70 74Z" fill="#fff" stroke="#1E1240" stroke-width="4" stroke-linejoin="round"/><rect x="28" y="90" width="14" height="9" rx="4" fill="#1E1240"/><rect x="58" y="90" width="14" height="9" rx="4" fill="#1E1240"/></svg>';
  function criarMonstro() {
    el.cena.classList.add('chefe');
    const m = document.createElement('div');
    m.className = 'monstro';
    m.innerHTML = `<div class="vida"><i></i></div>${MONSTRO}`;
    el.cena.appendChild(m);
    el.monstro = m;
    el.passos = 0;
  }

  // acerto: o personagem lança uma bolinha no monstro
  function monstroDano(vida, max) {
    const m = el.monstro;
    if (!m) return;
    const c = el.cena.getBoundingClientRect(), rh = el.heroi.getBoundingClientRect(), rm = m.getBoundingClientRect(), b = document.createElement('div');
    const x0 = rh.left - c.left + rh.width / 2 - 9, y0 = rh.top - c.top + 20;
    const dx = rm.left - c.left + rm.width / 2 - 9 - x0, dy = rm.top - c.top + rm.height / 2 - 9 - y0;
    b.className = 'bolinha';
    b.style.cssText = `left:${x0}px;top:${y0}px`;
    el.cena.appendChild(b);
    b.animate([{ transform: 'none' }, { transform: `translate(${dx / 2}px,${Math.min(dy, 0) - 60}px)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px)` }], { duration: 520, easing: 'ease-in-out' }).onfinish = () => {
      b.remove();
      m.querySelector('.vida i').style.width = Math.max(0, (100 * vida) / max) + '%';
      tremer(m.querySelector('svg'));
      som('pulo');
      if (vida <= 0) { m.classList.add('derrotado'); som('vitoria'); confete(); aviso('🎉 Vitória!'); }
    };
  }

  // erro: o monstro avança um passo
  function monstroAvanca() {
    const m = el.monstro;
    if (!m) return;
    el.passos++;
    m.style.setProperty('--x', `${-el.passos * 14}px`);
    m.classList.remove('pisa');
    void m.offsetWidth;
    m.classList.add('pisa');
  }

  // power-up: botão que abre uma dica visual por cima da cena
  function powerup(icone, qtd, usar) {
    const b = document.createElement('button');
    b.className = 'power';
    b.innerHTML = `${icone}<small>${qtd}</small>`;
    b.onclick = () => {
      if (ocupado) return;
      b.remove();
      som('bau');
      const d = document.createElement('div');
      d.className = 'painel p-dica';
      d.innerHTML = usar() + '<p>👆 ✕</p>';
      d.onclick = () => d.remove();
      el.cena.appendChild(d);
    };
    el.cena.appendChild(b);
  }

  // contra o tempo: barra que esvazia; ao acabar, conta como erro
  let relogioId = null, relogioFim = 0, relogioResta = 0, relogioCb = null;
  function armarRelogio(ms) {
    relogioFim = Date.now() + ms;
    relogioId = setTimeout(() => { const cb = relogioCb; relogioId = null; relogioCb = null; if (cb) cb(); }, ms);
  }
  function relogio(seg, aoAcabar) {
    pararRelogio();
    const r = document.createElement('div');
    r.className = 'relogio';
    r.innerHTML = `<i style="animation-duration:${seg}s"></i>`;
    el.cena.appendChild(r);
    relogioCb = aoAcabar;
    armarRelogio(seg * 1000);
  }
  function pararRelogio() {
    clearTimeout(relogioId);
    relogioId = null;
    relogioCb = null;
    const r = el.cena && el.cena.querySelector('.relogio i');
    if (r) r.style.animationPlayState = 'paused';
  }
  // app em segundo plano: o relógio espera o aluno voltar
  document.addEventListener('visibilitychange', () => {
    const barra = el.cena && el.cena.querySelector('.relogio i');
    if (!relogioCb || !barra) return;
    if (document.hidden) {
      clearTimeout(relogioId);
      relogioResta = Math.max(0, relogioFim - Date.now());
      barra.style.animationPlayState = 'paused';
    } else {
      barra.style.animationPlayState = 'running';
      armarRelogio(relogioResta);
    }
  });

  // combo: 3 acertos dão brilho, 5 soltam confete
  function combo(n, mult) {
    el.brilho = n >= 3;
    el.heroi.classList.toggle('brilho', el.brilho);
    el.combo.hidden = n < 3;
    el.combo.textContent = `🔥 x${mult}`;
    if (n === 3 || n === 5) { el.combo.classList.remove('pop'); void el.combo.offsetWidth; el.combo.classList.add('pop'); }
    if (n > 0 && n % 5 === 0) confete();
  }

  function aviso(txt) {
    const d = document.createElement('div');
    d.className = 'aviso';
    d.textContent = txt;
    el.cena.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  function parar() {
    geracao++;
    ocupado = false;
    pararRelogio();
    if (el.cena) el.cena.classList.add('parada');
  }

  return { iniciar, pergunta, escrever, bater, reagir, ponte, fechar, trilha, combo, aviso, powerup, relogio, pararRelogio, monstroDano, monstroAvanca, parar, ocupado: () => ocupado };
})();

// =====================================================================
// MASMORRA vista de cima (Canvas) · parte 1: salas, movimento e mini mapa
// =====================================================================

// Salas em dados: 11 colunas × 13 linhas. Legenda:
// #  parede   .  chão   o  moeda   c  baú   X  saída   @  início
// ^ v < >  portas (norte, sul, oeste, leste): levam à sala vizinha em "pos" [coluna, linha]
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
    '#.........#',
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
    '#.........#',
    '#.o.....o.#',
    '#.##...##.#',
    '#.........#',
    '#####v#####'] },
  { pos: [1, 1], mapa: [
    '#####^#####',
    '#.........#',
    '#..o...o..#',
    '#.#######.#',
    '#.........#',
    '#.o.#.#.o.#',
    '<...#c#...#',
    '#.........#',
    '#.#######.#',
    '#..o...o..#',
    '#.........#',
    '#.........#',
    '###########'] },
  { pos: [0, 1], mapa: [
    '###########',
    '#.........#',
    '#.o.o.o.o.#',
    '#.........#',
    '#.#.#.#.#.#',
    '#.........#',
    '#.........>',
    '#.#.#.#.#.#',
    '#.........#',
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
    '#.o.....o.#',
    '#.........#',
    '#.........#',
    '###########'] }
];

const Masmorra = (() => {
  const T = 32, COLS = 11, LINS = 13, VEL = 3.4;      // px por casa · tamanho da sala · casas por segundo
  const CORPO = { l: .56, a: .44 };                     // caixa de colisão dos pés (em casas)
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
  const joy = { x: 0, y: 0 }, teclas = new Set();

  const sala = () => M.salas[M.atual];
  const casa = (c, l) => (sala().g[l] || [])[c] || '#';
  const solido = (c, l) => '#cC'.includes(casa(c, l));
  const vizinha = (s, dir) => M.salas.findIndex(o => o.pos[0] === s.pos[0] + VETOR[dir][0] && o.pos[1] === s.pos[1] + VETOR[dir][1]);

  // ---------- abrir a masmorra do dia ----------
  function abrir(op) {
    cv = document.getElementById('mas-tela');
    ctx = cv.getContext('2d');
    if (!ligado) ligarControles();
    const prog = op.progresso;
    M = {
      op, prog, cor: PALETAS[op.mundo] || PALETAS[0], vidas: op.vidas || 5, atual: 0, textos: [], transicao: null, ultimo: 0, fim: false,
      salas: SALAS_MASMORRA.map((s, i) => {
        const g = s.mapa.map((linha, l) => linha.split('').map((ch, c) =>
          ch === '@' ? '.' : prog.pegos.includes(`${i}:${c}:${l}`) ? (ch === 'c' ? 'C' : '.') : ch));
        return { pos: s.pos, g, portas: [...new Set(s.mapa.join('').split('').filter(ch => PORTAS[ch]).map(ch => PORTAS[ch]))], saida: s.mapa.join('').includes('X') };
      })
    };
    SALAS_MASMORRA[0].mapa.forEach((linha, l) => { const c = linha.indexOf('@'); if (c >= 0) M.P = { x: c + .5, y: l + .5, dir: 'baixo', passo: 0, andando: false }; });
    sprites();
    visitar(0);
    pintarVidas();
    ajustar();
    teclas.clear();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(quadro);
  }

  // personagem do aluno: a função SVG vira imagens nas 4 direções (parado e 2 passos)
  function sprites() {
    const chave = JSON.stringify(M.op.personagem);
    if (cache.chave === chave) return;
    cache = { chave, imgs: {} };
    for (const dir of Object.keys(VETOR)) for (const pose of ['parado', 'anda1', 'anda2']) {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(desenharPersonagem(M.op.personagem, pose, dir).replace('<svg ', '<svg width="100" height="132" '));
      cache.imgs[dir + pose] = img;
    }
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
      if (e.pointerId !== id) return;
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
      if (!d || !M || !document.getElementById('t-masmorra').classList.contains('ativa')) return;
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
  function colide(x, y) {
    const c0 = Math.floor(x - CORPO.l / 2), c1 = Math.floor(x + CORPO.l / 2 - 1e-6);
    const l0 = Math.floor(y - CORPO.a / 2), l1 = Math.floor(y + CORPO.a / 2 - 1e-6);
    for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) if (solido(c, l)) return true;
    return false;
  }

  function andar(eixo, passo) {
    const P = M.P, novo = { x: P.x, y: P.y };
    novo[eixo] += passo;
    if (!colide(novo.x, novo.y)) { P[eixo] = novo[eixo]; return; }
    const outro = eixo === 'x' ? 'y' : 'x', s = Math.sign(passo), meia = (eixo === 'x' ? CORPO.l : CORPO.a) / 2;
    const frente = Math.floor(P[eixo] + s * (meia + .05)), meio = Math.floor(P[outro]);
    const ali = eixo === 'x' ? [frente, meio] : [meio, frente];
    if (casa(...ali) === 'c') return abrirBau(...ali);
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

  // ---------- moedas, baús, portas e saída ----------
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
    sala().g[l][c] = 'C';
    guardar(c, l);
    M.op.aoMoeda(5);
    som('bau');
    vibrar(40);
    flutuar('+5 🪙', c + .5, l - .1);
  }

  function conferirCasa() {
    const P = M.P, ch = casa(Math.floor(P.x), Math.floor(P.y));
    if (PORTAS[ch] && !M.transicao) {
      const destino = vizinha(sala(), PORTAS[ch]);
      if (destino >= 0) { som('clique'); M.transicao = { t: 0, destino, dir: PORTAS[ch], trocou: false }; }
    }
    if (ch === 'X' && !M.fim) {
      M.fim = true;
      som('vitoria');
      flutuar('🏁', P.x, P.y - 1);
      setTimeout(() => M.op.aoSaida(), 450);
    }
  }

  // troca de sala: escurece, muda e clareia (0,36 s); o aluno entra pela porta oposta
  function trocarSala() {
    const tr = M.transicao, [dx, dy] = VETOR[tr.dir];
    M.atual = tr.destino;
    sala().g.forEach((linha, l) => linha.forEach((ch, c) => { if (ch === OPOSTA[tr.dir]) { M.P.x = c + .5 + dx; M.P.y = l + .5 + dy; } }));
    tr.trocou = true;
    visitar(M.atual);
  }

  function visitar(i) {
    if (!M.prog.visitadas.includes(i)) { M.prog.visitadas.push(i); M.op.aoSalvar(); }
    pintarMini();
  }

  const flutuar = (txt, x, y) => M.textos.push({ txt, x, y, t: 0 });

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
      if (tr.t >= .14 && !tr.trocou) trocarSala();
      if (tr.t >= .36) M.transicao = null;
      return;
    }
    const d = M.fim ? null : direcao();
    P.andando = !!d;
    if (!d) return;
    P.dir = d;
    P.passo += dt;
    const [dx, dy] = VETOR[d];
    if (dx) andar('x', dx * VEL * dt);
    else andar('y', dy * VEL * dt);
    coletar();
    conferirCasa();
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
      else if (ch === 'X') saida(x + T / 2, y + T / 2, t);
    }
    heroi();
    textos();
    if (M.transicao) {
      const tr = M.transicao, a = tr.t < .14 ? tr.t / .14 : 1 - (tr.t - .14) / .22;
      ctx.fillStyle = `rgba(20,15,46,${Math.max(0, Math.min(1, a))})`;
      ctx.fillRect(0, 0, COLS * T, LINS * T);
    }
  }

  function porta(x, y, dir) {
    ctx.fillStyle = M.cor.sombra;
    ctx.globalAlpha = .3;
    ctx.fillRect(x, y, T, T);
    ctx.globalAlpha = .75;
    ctx.fillStyle = '#fff';
    const [dx, dy] = VETOR[dir], cx = x + T / 2 + dx * 4, cy = y + T / 2 + dy * 4;
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

  function saida(x, y, t) {
    const p = 1 + Math.sin(t * 5) * .08;
    ctx.fillStyle = '#7B2FF7'; circ(x, y, 13 * p);
    ctx.fillStyle = '#C4B5FD'; circ(x, y, 8 * p);
    ctx.fillStyle = '#fff'; circ(x, y, 3.5);
  }

  function heroi() {
    const P = M.P, pose = P.andando ? (Math.floor(P.passo * 8) % 2 ? 'anda1' : 'anda2') : 'parado';
    const img = cache.imgs[P.dir + pose], w = T * 1.15, h = w * 1.32, pe = (P.y + CORPO.a / 2) * T;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(P.x * T, pe - 2, w * .32, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, P.x * T - w / 2, pe - h * (128 / 132), w, h);
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
    document.getElementById('mas-vidas').innerHTML = Array.from({ length: 5 }, (_, k) => (k < M.vidas ? '❤️' : '🤍')).join('');
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

  return { abrir, parar };
})();
