/* =====================================================================
   util.js — utilidades gerais + armazenamento versionado
   ===================================================================== */
(function () {
  'use strict';
  var Lab = (window.Lab = window.Lab || {});
  var CFG = window.LAB_CONFIG;

  // ---------------------------------------------------------------- DOM
  /** el('div', {class:'x', onclick: fn}, [filhos | 'texto']) */
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, v);
      });
    }
    if (filhos !== undefined && filhos !== null) {
      (Array.isArray(filhos) ? filhos : [filhos]).forEach(function (f) {
        if (f === null || f === undefined || f === false) return;
        n.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
      });
    }
    return n;
  }
  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $$(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }
  function esc(t) {
    return String(t === undefined || t === null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  // ---------------------------------------------------------- formatos
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function data(ts) { var d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function hora(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dataHora(ts) { return data(ts) + ' ' + hora(ts); }
  function duracao(ms) {
    var min = Math.round((ms || 0) / 60000);
    if (min < 1) return 'menos de 1 min';
    if (min < 60) return min + ' min';
    return Math.floor(min / 60) + ' h ' + pad(min % 60) + ' min';
  }
  function uid(prefixo) {
    return (prefixo || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }
  function normalizarNome(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  function baixar(nomeArquivo, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: nomeArquivo });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function lerArquivo(file) {
    return new Promise(function (ok, erro) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = erro;
      r.readAsText(file);
    });
  }

  // ------------------------------------------------------------- diff
  /** diff por linhas (LCS). Retorna [{tipo:'=',' +','-', texto}] */
  function diffLinhas(a, b) {
    var A = a.split('\n'), B = b.split('\n');
    var n = A.length, m = B.length;
    // corta prefixo/sufixo iguais para economizar memória
    var ini = 0;
    while (ini < n && ini < m && A[ini] === B[ini]) ini++;
    var fimA = n - 1, fimB = m - 1;
    while (fimA >= ini && fimB >= ini && A[fimA] === B[fimB]) { fimA--; fimB--; }
    var a2 = A.slice(ini, fimA + 1), b2 = B.slice(ini, fimB + 1);
    var N = a2.length, M = b2.length, i, j;
    var tab = [];
    for (i = 0; i <= N; i++) { tab.push(new Uint16Array(M + 1)); }
    for (i = N - 1; i >= 0; i--) {
      for (j = M - 1; j >= 0; j--) {
        tab[i][j] = a2[i] === b2[j] ? tab[i + 1][j + 1] + 1 : Math.max(tab[i + 1][j], tab[i][j + 1]);
      }
    }
    var res = [];
    for (i = 0; i < ini; i++) res.push({ tipo: '=', texto: A[i], linha: i + 1 });
    i = 0; j = 0;
    while (i < N && j < M) {
      if (a2[i] === b2[j]) { res.push({ tipo: '=', texto: a2[i], linha: ini + j + 1 }); i++; j++; }
      else if (tab[i + 1][j] >= tab[i][j + 1]) { res.push({ tipo: '-', texto: a2[i] }); i++; }
      else { res.push({ tipo: '+', texto: b2[j], linha: ini + j + 1 }); j++; }
    }
    while (i < N) { res.push({ tipo: '-', texto: a2[i++] }); }
    while (j < M) { res.push({ tipo: '+', texto: b2[j], linha: ini + j + 1 }); j++; }
    for (i = fimB + 1; i < m; i++) res.push({ tipo: '=', texto: B[i], linha: i + 1 });
    return res;
  }
  /** quantas linhas mudaram: max(adicionadas, removidas) — uma linha editada conta 1 */
  function contarMudancas(diff) {
    var mais = 0, menos = 0;
    diff.forEach(function (d) { if (d.tipo === '+') mais++; else if (d.tipo === '-') menos++; });
    return Math.max(mais, menos);
  }

  // ------------------------------------------------- armazenamento
  // Todas as chaves começam com o prefixo versionado "lab:v1".
  // A versão do ESQUEMA dos registros fica em lab:v1:meta.esquema e em cada
  // registro de aluno (campo "esquema"). Migrações apenas ACRESCENTAM/ajustam
  // campos; nunca apagam dados. Antes de migrar, é feita uma cópia de segurança.
  var PREFIXO = 'lab:v1';
  var ESQUEMA_ATUAL = 1;
  var avisoCheio = false;

  function chave() {
    return [PREFIXO].concat(Array.prototype.slice.call(arguments)).join(':');
  }
  function chaveTurma(turmaId) {
    return chave.apply(null, ['turma' + turmaId].concat(Array.prototype.slice.call(arguments, 1)));
  }
  function ler(k, padrao) {
    try {
      var v = window.localStorage.getItem(k);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) {
      return padrao;
    }
  }
  function gravar(k, valor) {
    try {
      window.localStorage.setItem(k, JSON.stringify(valor));
      return true;
    } catch (e) {
      if (!avisoCheio && Lab.ui && Lab.ui.aviso) {
        avisoCheio = true;
        Lab.ui.aviso('O armazenamento deste navegador está cheio. Exporte seu código de progresso e avise o professor.', 'erro');
      }
      return false;
    }
  }
  function remover(k) { try { window.localStorage.removeItem(k); } catch (e) { /* sem acesso */ } }
  function listar(prefixo) {
    var r = [];
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(prefixo) === 0) r.push(k);
      }
    } catch (e) { /* sem acesso */ }
    return r;
  }
  function disponivel() {
    try {
      var k = PREFIXO + ':__teste';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  // Migrações de esquema: { versaoDestino: function(registroAluno) }.
  // Exemplo futuro: 2: function (a) { a.novoCampo = a.novoCampo || []; }
  var MIGRACOES_ALUNO = {};

  function migrarAluno(a) {
    if (!a) return a;
    var v = a.esquema || 1;
    while (v < ESQUEMA_ATUAL) {
      v++;
      if (MIGRACOES_ALUNO[v]) MIGRACOES_ALUNO[v](a);
      a.esquema = v;
    }
    return a;
  }

  function migrarGlobal() {
    var meta = ler(chave('meta'), null);
    if (!meta) {
      meta = { esquema: ESQUEMA_ATUAL, criadoEm: Date.now() };
      gravar(chave('meta'), meta);
      return meta;
    }
    if ((meta.esquema || 1) < ESQUEMA_ATUAL) {
      // cópia de segurança completa antes de qualquer migração
      var copia = {};
      listar(PREFIXO + ':').forEach(function (k) {
        if (k.indexOf(':backup-esquema') === -1) copia[k] = window.localStorage.getItem(k);
      });
      gravar(chave('backup-esquema', 'v' + (meta.esquema || 1), String(Date.now())), copia);
      meta.esquema = ESQUEMA_ATUAL;
      gravar(chave('meta'), meta);
    }
    return meta;
  }

  Lab.util = {
    el: el, $: $, $$: $$, esc: esc, limpar: limpar,
    data: data, hora: hora, dataHora: dataHora, duracao: duracao,
    uid: uid, debounce: debounce, normalizarNome: normalizarNome, clone: clone,
    baixar: baixar, lerArquivo: lerArquivo,
    diffLinhas: diffLinhas, contarMudancas: contarMudancas
  };
  Lab.armazem = {
    PREFIXO: PREFIXO, ESQUEMA: ESQUEMA_ATUAL,
    chave: chave, chaveTurma: chaveTurma,
    ler: ler, gravar: gravar, remover: remover, listar: listar,
    disponivel: disponivel, migrarAluno: migrarAluno, migrarGlobal: migrarGlobal
  };
  Lab.cfg = CFG;
})();
