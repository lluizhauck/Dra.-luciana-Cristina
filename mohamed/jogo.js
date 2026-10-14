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

  function iniciar(caixa, { personagem, mundo = 0, total = 8 }) {
    const t = TEMAS[mundo] || TEMAS[0];
    geracao++;
    ocupado = false;
    caixa.innerHTML = `<div class="cena m${mundo}"><div class="camada c-longe"></div><div class="camada c-perto"></div><div class="chao"></div><div class="combo-tag" hidden></div><div class="blocos"></div><div class="heroi"></div></div>`;
    const q = s => caixa.querySelector(s);
    el = { cena: q('.cena'), blocos: q('.blocos'), heroi: q('.heroi'), combo: q('.combo-tag'), p: personagem, brilho: false };
    el.cena.style.background = `linear-gradient(${t.ceu[0]}, ${t.ceu[1]})`;
    q('.c-longe').style.backgroundImage = longe(t.longe);
    q('.c-perto').style.backgroundImage = perto(t.perto);
    q('.chao').style.backgroundImage = chao(t.chao, t.borda);
    pose('corre');
    document.getElementById('trilha').dataset.n = '';
    trilha(0, total);
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

  // cada resposta vira um bloco "?" flutuando
  function pergunta(ex, aoTocar) {
    const ops = ex.tipo === 'vf' ? [[true, '✔'], [false, '✘']]
      : ex.tipo === 'digitar' ? [[null, '?']]
      : ex.opcoes.map(o => [o, String(o)]);
    el.blocos.className = 'blocos';
    el.blocos.innerHTML = '';
    ops.forEach(([v, t], i) => {
      const b = document.createElement('button');
      b.className = 'bloco' + (t.length > 3 ? ' longo' : '') + (ex.tipo === 'vf' ? (v ? ' vf-v' : ' vf-f') : '');
      b.style.animationDelay = `${i * .08}s, ${.4 + i * .3}s`;
      b.innerHTML = `<span>${t}</span>`;
      if (ex.tipo !== 'digitar') b.onclick = () => { if (!ocupado) aoTocar(v, i); };
      el.blocos.appendChild(b);
    });
  }

  // texto digitado aparece dentro do bloco
  function escrever(txt) {
    const s = el.blocos.querySelector('span');
    if (!s) return;
    s.textContent = txt || '?';
    s.parentNode.classList.toggle('longo', (txt || '').length > 3);
  }

  // personagem pula e bate no bloco: acerto solta moeda, erro dá tombo
  async function bater(i, certo, fim) {
    const g = geracao, b = el.blocos.children[i], h = el.heroi;
    if (!b) return fim && fim();
    ocupado = true;
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
    if (g !== geracao) return;
    h.getAnimations().forEach(a => a.cancel());
    pose('corre');
    balao(certo ? sortear(['Boa!', 'Isso!', 'Uau!', 'Show!']) : sortear(['Quase!', 'Ops!', 'Eita!']));
    ocupado = false;
    if (fim) fim();
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
    const c = el.cena.getBoundingClientRect(), r = el.heroi.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'balao';
    d.textContent = txt;
    d.style.left = r.left - c.left + r.width / 2 + 'px';
    d.style.top = r.top - c.top - 4 + 'px';
    el.cena.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

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
    if (el.cena) el.cena.classList.add('parada');
  }

  return { iniciar, pergunta, escrever, bater, trilha, combo, aviso, parar, ocupado: () => ocupado };
})();
