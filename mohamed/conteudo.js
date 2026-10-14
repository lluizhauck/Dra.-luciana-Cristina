// Mohamed — conteudo.js: mundos, dias e exercícios (formato no topo de app.js)

const MUNDOS = [
  { nome: 'Naturais', emoji: '🌿', cor: '#22C55E' },
  { nome: 'Inteiros', emoji: '❄️', cor: '#38BDF8' },
  { nome: 'Multiplicação', emoji: '🌋', cor: '#F97316' },
  { nome: 'Divisão', emoji: '🌊', cor: '#06B6D4' },
  { nome: 'Revisão', emoji: '🌌', cor: '#A855F7' }
];

const DIAS = [
  'Naturais', 'Ordem nos naturais', 'Soma e subtração', 'Inteiros', 'Reta dos inteiros',
  'ℕ dentro de ℤ', 'Soma de inteiros', 'Subtração de inteiros', 'Tabuada 1, 2 e 10', 'Tabuada 3, 4 e 5',
  'Tabuada 6 e 7', 'Tabuada 8 e 9', 'Tabuada completa', 'Regra dos sinais', 'Divisão',
  'Divisão com resto', 'Divisão de inteiros', 'Operações misturadas', 'Revisão', 'Prova final'
].map((titulo, i) => ({ n: i + 1, titulo, mundo: i < 3 ? 0 : i < 8 ? 1 : i < 14 ? 2 : i < 17 ? 3 : 4 }));

// ---------- utilidades para geradores ----------
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const sortear = lista => lista[Math.floor(Math.random() * lista.length)];
function embaralhar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const distintos = (gerar, qtd) => { const s = new Set(); while (s.size < qtd) s.add(gerar()); return [...s]; };

const vf = (pergunta, resposta, dica, extra) => ({ tipo: 'vf', pergunta, resposta, dica, ...extra });
const fixa = (pergunta, opcoes, resposta, dica, extra) => ({ tipo: 'escolha', pergunta, opcoes, resposta, dica, ...extra });
const escolha = (pergunta, opcoes, resposta, dica, extra) => fixa(pergunta, embaralhar(opcoes), resposta, dica, extra);
const digitar = (pergunta, resposta, dica, extra) => ({ tipo: 'digitar', pergunta, resposta, dica, ...extra });

// números próximos e distintos do certo (sem negativos)
function vizinhos(certo, qtd = 2, raio = 3) {
  const s = new Set([certo]);
  while (s.size < qtd + 1) { const v = certo + rnd(-raio, raio); if (v >= 0) s.add(v); }
  return [...s];
}

// número fora de ℕ: negativo, decimal ou fração
const naoNatural = () => sortear([
  () => '−' + rnd(1, 30),
  () => rnd(0, 9) + ',' + rnd(1, 9),
  () => rnd(1, 4) + '/' + rnd(5, 9)
])();
const naoNaturais = qtd => distintos(naoNatural, qtd);

// dica visual: reta numérica com 11 marcas
function reta(marca, ini = Math.max(0, marca - 5)) {
  let s = '<svg viewBox="0 0 330 60"><line x1="10" y1="22" x2="320" y2="22" stroke="#B9B5C9" stroke-width="4" stroke-linecap="round"/>';
  for (let k = 0; k <= 10; k++) {
    const v = ini + k, x = 15 + k * 30, d = v === marca;
    s += `<circle cx="${x}" cy="22" r="${d ? 10 : 5}" fill="${d ? '#7B2FF7' : '#B9B5C9'}"/>` +
      `<text x="${x}" y="52" font-size="${v > 99 ? 11 : 14}" font-weight="800" text-anchor="middle" fill="${d ? '#7B2FF7' : '#7A7396'}">${v}</text>`;
  }
  return s + '</svg>';
}

// dica visual: bolinhas em pares; a que sobra fica vermelha
function pares(n) {
  if (n < 1 || n > 20) return '';
  let s = `<svg viewBox="0 0 ${Math.ceil(n / 2) * 28 + 8} 64">`;
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${18 + Math.floor(i / 2) * 28}" cy="${18 + (i % 2) * 28}" r="10" fill="${n % 2 && i === n - 1 ? '#FF4B5C' : '#7B2FF7'}"/>`;
  }
  return s + '</svg>';
}
const dicaPar = n => `Último algarismo ${n % 10}: ${n % 2 ? 'ímpar' : 'par'}`;

// monta a lição: sorteia modelos sem repetir pergunta e encaixa o desafio-surpresa
function montar(modelos, surpresa, total = 8) {
  const lista = [], vistas = new Set();
  let fila = [], tentativas = 0;
  while (lista.length < total - 1) {
    if (!fila.length) fila = embaralhar(modelos);
    const ex = fila.pop()();
    if (vistas.has(ex.pergunta) && tentativas++ < 50) continue;
    vistas.add(ex.pergunta);
    lista.push(ex);
  }
  lista.splice(rnd(2, lista.length - 1), 0, { ...surpresa(), surpresa: true });
  return lista;
}

// ---------- DIA 1 · Naturais ----------
(() => {
  const SIM = 'ℕ ✔', NAO = 'Não';
  const par = () => rnd(1, 49) * 2;
  const impar = () => rnd(0, 49) * 2 + 1;

  // 1. O que são naturais e o zero
  const L1 = [
    () => vf('0 é um número natural?', true, 'ℕ começa no zero 🎯', { visual: reta(0) }),
    () => escolha('Menor número natural?', [0, 1, '−1'], 0, 'O primeiro de ℕ é o 0', { visual: reta(0) }),
    () => { const n = rnd(3, 60); return digitar(`Sucessor de ${n}?`, n + 1, `Sucessor: ${n} + 1 ➡️`, { visual: reta(n + 1) }); },
    () => { const n = rnd(2, 60); return digitar(`Antecessor de ${n}?`, n - 1, `Antecessor: ${n} − 1 ⬅️`, { visual: reta(n - 1) }); },
    () => vf('ℕ tem um último número?', false, 'Sempre cabe mais 1 ♾️'),
    () => { const k = rnd(1, 20); return vf(`−${k} é natural?`, false, 'Negativo fica fora de ℕ 🚫'); },
    () => { const n = rnd(1, 99); return vf(`${n} é natural?`, true, 'Inteiro sem sinal é ℕ ✔'); },
    () => { const n = rnd(2, 9); return escolha(`Quantos naturais antes de ${n}?`, vizinhos(n, 2, 2), n, `Conte de 0 até ${n - 1} 👆`, { visual: reta(n - 1, 0) }); }
  ];
  const S1 = () => digitar('Antecessor de 1?', 0, 'Antes do 1 vem o 0 👀', { visual: reta(0) });

  // 2. Caça ao natural
  const L2 = [
    () => { const n = rnd(0, 99); return escolha('Qual é natural?', [n, ...naoNaturais(2)], n, 'Sem −, vírgula ou barra 🔍'); },
    () => { const n = rnd(0, 20); return escolha('Toque no natural 👆', [n, naoNatural()], n, 'Sem −, vírgula ou barra 🔍'); },
    () => { const x = naoNatural(); return escolha('Qual NÃO é natural?', [x, rnd(0, 50), rnd(51, 999)], x, 'Tem −, vírgula ou barra 🚫'); },
    () => { const x = naoNatural(); return vf(`${x} é natural?`, false, 'Tem −, vírgula ou barra 🚫'); },
    () => { const n = rnd(100, 9999); return vf(`${n} é natural?`, true, 'Grande também é natural 💪'); },
    () => { const a = rnd(1, 5), b = a + rnd(3, 5); return digitar(`Quantos naturais de ${a} a ${b}?`, b - a + 1, `Conte: ${a}, ${a + 1}, … ${b}`, { visual: reta(b, a) }); },
    () => {
      const lista = embaralhar([...distintos(() => rnd(0, 60), rnd(1, 3)), ...naoNaturais(rnd(1, 2))]);
      return digitar(`Quantos naturais? ${lista.join(' · ')}`, lista.filter(v => typeof v === 'number').length, 'Conte só os sem − e vírgula');
    }
  ];
  const S2 = () => { const n = rnd(4, 9); return digitar(`Quantos naturais de 0 a ${n}?`, n + 1, 'O zero também conta! 0️⃣', { visual: reta(n, 0) }); };

  // 3. Pares e ímpares
  const L3 = [
    () => { const n = rnd(1, 20); return vf(`${n} é par?`, n % 2 === 0, dicaPar(n), { visual: pares(n) }); },
    () => { const n = rnd(21, 999); return fixa(`${n} é…`, ['Par', 'Ímpar'], n % 2 ? 'Ímpar' : 'Par', dicaPar(n)); },
    () => { const p = par(); return escolha('Qual é par?', [p, ...distintos(impar, 2)], p, 'Par termina em 0, 2, 4, 6, 8'); },
    () => { const i = impar(); return escolha('Qual é ímpar?', [i, ...distintos(par, 2)], i, 'Ímpar termina em 1, 3, 5, 7, 9'); },
    () => { const n = rnd(1, 60), r = n % 2 ? n + 1 : n + 2; return digitar(`Próximo par depois de ${n}?`, r, 'Pares vão de 2 em 2 👣', { visual: reta(r) }); },
    () => { const n = rnd(1, 60), r = n % 2 ? n + 2 : n + 1; return digitar(`Próximo ímpar depois de ${n}?`, r, 'Ímpares: 1, 3, 5, 7…', { visual: reta(r) }); },
    () => { const a = rnd(1, 9), b = rnd(1, 9); return vf(`${a} + ${b} dá par?`, (a + b) % 2 === 0, `${a} + ${b} = ${a + b}`, { visual: pares(a + b) }); }
  ];
  const S3 = () => vf('0 é par?', true, '0 ÷ 2 = 0, sem sobra ✔');

  // 4. Natural ou não
  const L4 = [
    () => { const x = naoNatural(); return fixa(`É natural? ${x}`, [SIM, NAO], NAO, 'Negativo, decimal ou fração: fora 🚫'); },
    () => { const n = rnd(0, 999); return fixa(`É natural? ${n}`, [SIM, NAO], SIM, 'Inteiro e sem sinal: é ℕ ✔'); },
    () => { const a = rnd(1, 9), b = a + rnd(1, 9); return fixa(`É natural? ${a} − ${b}`, [SIM, NAO], NAO, `${a} − ${b} = −${b - a} 🚫`); },
    () => { const a = rnd(5, 20), b = rnd(0, a - 1); return fixa(`É natural? ${a} − ${b}`, [SIM, NAO], SIM, `${a} − ${b} = ${a - b} ✔`); },
    () => { const a = rnd(0, 50), b = rnd(0, 50); return vf(`${a} + ${b} é natural?`, true, `${a} + ${b} = ${a + b} ✔`); },
    () => { const n = rnd(1, 9) * 2; return fixa(`É natural? ${n} ÷ 2`, [SIM, NAO], SIM, `${n} ÷ 2 = ${n / 2} ✔`, { visual: pares(n) }); },
    () => { const n = rnd(1, 9) * 2 + 1; return fixa(`É natural? ${n} ÷ 2`, [SIM, NAO], NAO, `${n} ÷ 2 = ${String(n / 2).replace('.', ',')} 🚫`, { visual: pares(n) }); }
  ];
  const S4 = () => fixa('É natural? 7 − 7', [SIM, NAO], SIM, '7 − 7 = 0, e 0 é ℕ 🎯');

  // 5. Classificar números
  const CLASSES = ['Par', 'Ímpar', 'Não ℕ'];
  const classe = x => typeof x === 'string' ? 'Não ℕ' : x % 2 ? 'Ímpar' : 'Par';
  const dicaClasse = x => typeof x === 'string' ? 'Tem −, vírgula ou barra: Não ℕ' : dicaPar(x);
  const contar = () => Array.from({ length: 5 }, () => rnd(1, 30));
  const L5 = [
    () => { const x = rnd(0, 99); return fixa(`Classifique: ${x}`, CLASSES, classe(x), dicaClasse(x)); },
    () => { const x = naoNatural(); return fixa(`Classifique: ${x}`, CLASSES, classe(x), dicaClasse(x)); },
    () => { const i = impar(); return escolha('Natural e ímpar?', [i, par(), '−' + impar()], i, 'Sem − e termina em 1, 3, 5, 7, 9'); },
    () => { const p = par(); return escolha('Natural e par?', [p, impar(), '−' + par()], p, 'Sem − e termina em 0, 2, 4, 6, 8'); },
    () => vf('Todo natural é par ou ímpar?', true, 'Ou sobra 1, ou não sobra 🧦'),
    () => { const l = contar(); return digitar(`Quantos pares? ${l.join(' · ')}`, l.filter(v => v % 2 === 0).length, 'Par termina em 0, 2, 4, 6, 8'); },
    () => { const l = contar(); return digitar(`Quantos ímpares? ${l.join(' · ')}`, l.filter(v => v % 2).length, 'Ímpar termina em 1, 3, 5, 7, 9'); },
    () => { const n = rnd(1, 50); return vf(`${n} é natural e par?`, n % 2 === 0, dicaPar(n)); }
  ];
  const S5 = () => { const a = impar(), b = par(), c = impar(); return digitar(`Some os ímpares: ${a} · ${b} · ${c}`, a + c, `${a} + ${c} = ${a + c}`); };

  // Chefão: 15 questões misturando tudo
  const SB = () => { const n = rnd(20, 99); return digitar(`Quantos naturais antes de ${n}?`, n, `De 0 a ${n - 1}: são ${n} 🎯`); };
  const TODOS = [...L1, ...L2, ...L3, ...L4, ...L5];

  DIAS[0].licoes = [
    { id: 'd1l1', titulo: 'O que são naturais', icone: '🌱', carta: { emoji: '🌱', titulo: 'Naturais', regra: 'ℕ = {0, 1, 2, 3, …}' }, gerar: () => montar(L1, S1) },
    { id: 'd1l2', titulo: 'Caça ao natural', icone: '🔍', carta: { emoji: '🔍', titulo: 'Caça ao natural', regra: 'Sem sinal de menos e sem vírgula' }, gerar: () => montar(L2, S2) },
    { id: 'd1l3', titulo: 'Pares e ímpares', icone: '⚖️', carta: { emoji: '⚖️', titulo: 'Par ou ímpar', regra: 'Par termina em 0, 2, 4, 6 ou 8' }, gerar: () => montar(L3, S3) },
    { id: 'd1l4', titulo: 'Natural ou não', icone: '🚫', carta: { emoji: '🚫', titulo: 'Fora de ℕ', regra: 'Negativos, decimais e frações não são naturais' }, gerar: () => montar(L4, S4) },
    { id: 'd1l5', titulo: 'Classificar números', icone: '🗂️', carta: { emoji: '🗂️', titulo: 'Classificar', regra: 'Todo natural é par ou ímpar' }, gerar: () => montar(L5, S5) },
    { id: 'd1boss', titulo: 'Chefão', icone: '👑', chefao: true, carta: { emoji: '👑', titulo: 'Mestre dos naturais', regra: 'ℕ não tem fim: sempre há +1' }, gerar: () => montar(TODOS, SB, 15) }
  ];
})();
