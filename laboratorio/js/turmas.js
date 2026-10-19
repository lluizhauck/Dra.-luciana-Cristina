/* =====================================================================
   turmas.js — turmas, trava por computador, senha do professor,
   perfis de aluno com PIN, backups e código de progresso.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var A = Lab.armazem, U = Lab.util, CFG = Lab.cfg;
  var ITER_PIN = 5000;

  // ================================================================ TURMAS
  var turmas = {
    lista: function () { return CFG.turmas.slice(); },
    porId: function (id) {
      return CFG.turmas.filter(function (t) { return t.id === id; })[0] || null;
    },
    travada: function () {
      var meta = A.ler(A.chave('meta'), {});
      return meta.turmaTravada && turmas.porId(meta.turmaTravada) ? meta.turmaTravada : null;
    },
    travar: function (id) {
      var meta = A.ler(A.chave('meta'), {});
      if (meta.turmaTravada !== id) {
        meta.historicoTrava = (meta.historicoTrava || []).concat([{ de: meta.turmaTravada || null, para: id, em: Date.now() }]).slice(-20);
      }
      meta.turmaTravada = id;
      A.gravar(A.chave('meta'), meta);
      // trocar de turma sempre encerra o desbloqueio do professor
      auth.encerrar();
    }
  };

  // ===================================================== SENHA DO PROFESSOR
  // O estado "desbloqueado" vive SÓ nesta variável (memória). Recarregar a
  // página, trocar de turma ou passar do tempo limite apaga o desbloqueio.
  var desbloqueadoAte = 0;
  var avisosExpiracao = [];

  var auth = {
    valido: function () { return Date.now() < desbloqueadoAte; },
    restanteMs: function () { return Math.max(0, desbloqueadoAte - Date.now()); },
    encerrar: function () {
      var estava = desbloqueadoAte > 0;
      desbloqueadoAte = 0;
      if (estava) avisosExpiracao.forEach(function (f) { f(); });
    },
    aoExpirar: function (fn) { avisosExpiracao.push(fn); },
    bloqueio: function () {
      var b = A.ler(A.chave('bloqueio-senha'), { falhas: 0, ate: 0 });
      return { falhas: b.falhas || 0, restanteMs: Math.max(0, (b.ate || 0) - Date.now()) };
    },
    /** Promise<{ok:boolean, bloqueadoMs?:number}> */
    verificar: function (senha) {
      var b = A.ler(A.chave('bloqueio-senha'), { falhas: 0, ate: 0 });
      if (Date.now() < (b.ate || 0)) return Promise.resolve({ ok: false, bloqueadoMs: b.ate - Date.now() });
      var sp = CFG.senhaProfessor || {};
      if (!sp.hash || !sp.sal) return Promise.resolve({ ok: false, semSenha: true });
      return Lab.cripto.pbkdf2(senha, sp.sal, sp.iteracoes || 120000).then(function (hex) {
        if (Lab.cripto.iguais(hex, sp.hash)) {
          A.gravar(A.chave('bloqueio-senha'), { falhas: 0, ate: 0 });
          desbloqueadoAte = Date.now() + (CFG.minutosDesbloqueio || 10) * 60000;
          return { ok: true };
        }
        var tempos = CFG.bloqueiosSenha || [30, 60, 300];
        var falhas = (b.falhas || 0) + 1;
        var seg = tempos[Math.min(falhas - 1, tempos.length - 1)];
        A.gravar(A.chave('bloqueio-senha'), { falhas: falhas, ate: Date.now() + seg * 1000 });
        return { ok: false, bloqueadoMs: seg * 1000, falhas: falhas };
      });
    }
  };
  setInterval(function () {
    if (desbloqueadoAte && Date.now() >= desbloqueadoAte) auth.encerrar();
  }, 5000);

  // ================================================================ PERFIS
  function chavePerfis(t) { return A.chaveTurma(t, 'perfis'); }
  function chaveAluno(t, id) { return A.chaveTurma(t, 'aluno', id); }
  function chaveSandboxPrefixo(t, id) { return A.chaveTurma(t, 'aluno', id, 'sandbox') + ':'; }

  function novoAluno(id, nome) {
    return {
      esquema: A.ESQUEMA, id: id, nome: nome, criadoEm: Date.now(),
      sessoes: [], trilhas: {}, diario: [],
      reflexao: { errei: '', aprendi: '', fariaDiferente: '' }
    };
  }

  var perfis = {
    listar: function (t) {
      return A.ler(chavePerfis(t), []).slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    },
    porId: function (t, id) {
      return A.ler(chavePerfis(t), []).filter(function (p) { return p.id === id; })[0] || null;
    },
    _salvarLista: function (t, lista) { return A.gravar(chavePerfis(t), lista); },
    _atualizar: function (t, id, fn) {
      var lista = A.ler(chavePerfis(t), []);
      lista.forEach(function (p) { if (p.id === id) fn(p); });
      perfis._salvarLista(t, lista);
    },
    /** Promise<{ok, erro?, perfil?}> */
    criar: function (t, nome, pin) {
      nome = U.normalizarNome(nome);
      if (nome.length < 3) return Promise.resolve({ ok: false, erro: 'Escreva seu nome (pelo menos 3 letras).' });
      if (!/^\d{4}$/.test(pin)) return Promise.resolve({ ok: false, erro: 'O PIN precisa ter exatamente 4 números.' });
      var lista = A.ler(chavePerfis(t), []);
      var existe = lista.some(function (p) { return p.nome.toLowerCase() === nome.toLowerCase(); });
      if (existe) return Promise.resolve({ ok: false, erro: 'Já existe um perfil com esse nome nesta turma. Se for você, escolha seu nome na lista. Se for outra pessoa, acrescente o sobrenome.' });
      var sal = Lab.cripto.gerarSal(16);
      return Lab.cripto.pbkdf2(pin, sal, ITER_PIN).then(function (hash) {
        var p = { id: U.uid('a'), nome: nome, sal: sal, pinHash: hash, criadoEm: Date.now(), falhasPin: 0, bloqueadoAte: 0 };
        lista.push(p);
        perfis._salvarLista(t, lista);
        A.gravar(chaveAluno(t, p.id), novoAluno(p.id, nome));
        return { ok: true, perfil: p };
      });
    },
    /** Promise<{ok, bloqueadoMs?}> — 5 erros seguidos bloqueiam por 1 min */
    verificarPin: function (t, id, pin) {
      var p = perfis.porId(t, id);
      if (!p) return Promise.resolve({ ok: false });
      if (Date.now() < (p.bloqueadoAte || 0)) return Promise.resolve({ ok: false, bloqueadoMs: p.bloqueadoAte - Date.now() });
      return Lab.cripto.pbkdf2(pin, p.sal, ITER_PIN).then(function (hash) {
        if (Lab.cripto.iguais(hash, p.pinHash)) {
          perfis._atualizar(t, id, function (x) { x.falhasPin = 0; x.bloqueadoAte = 0; });
          return { ok: true };
        }
        var falhas = (p.falhasPin || 0) + 1, bloq = 0;
        if (falhas >= 5) { bloq = 60000; falhas = 0; }
        perfis._atualizar(t, id, function (x) { x.falhasPin = falhas; x.bloqueadoAte = bloq ? Date.now() + bloq : 0; });
        return { ok: false, bloqueadoMs: bloq };
      });
    },
    redefinirPin: function (t, id, pin) {
      if (!auth.valido()) return Promise.resolve({ ok: false, erro: 'Modo professor expirou.' });
      if (!/^\d{4}$/.test(pin)) return Promise.resolve({ ok: false, erro: 'O PIN precisa ter 4 números.' });
      var sal = Lab.cripto.gerarSal(16);
      return Lab.cripto.pbkdf2(pin, sal, ITER_PIN).then(function (hash) {
        perfis._atualizar(t, id, function (p) { p.sal = sal; p.pinHash = hash; p.falhasPin = 0; p.bloqueadoAte = 0; });
        return { ok: true };
      });
    },

    // ---------------------------------------------------- dados do aluno
    carregarAluno: function (t, id) {
      var p = perfis.porId(t, id);
      var a = A.ler(chaveAluno(t, id), null);
      if (!a && p) a = novoAluno(id, p.nome);
      return A.migrarAluno(a);
    },
    salvarAluno: function (t, aluno) {
      aluno.atualizadoEm = Date.now();
      return A.gravar(chaveAluno(t, aluno.id), aluno);
    },
    sandboxLer: function (t, id, escopo) {
      return A.ler(chaveSandboxPrefixo(t, id) + escopo, {});
    },
    sandboxGravar: function (t, id, escopo, dados) {
      return A.gravar(chaveSandboxPrefixo(t, id) + escopo, dados);
    },
    _sandboxTodos: function (t, id) {
      var pre = chaveSandboxPrefixo(t, id), r = {};
      A.listar(pre).forEach(function (k) { r[k.slice(pre.length)] = A.ler(k, {}); });
      return r;
    },

    // ---------------------------------------------------- backups
    backup: function (t, id, motivo) {
      var registro = {
        motivo: motivo || 'manual', em: Date.now(),
        perfil: perfis.porId(t, id), aluno: A.ler(chaveAluno(t, id), null),
        sandbox: perfis._sandboxTodos(t, id)
      };
      var k = A.chaveTurma(t, 'backup', id, String(registro.em));
      A.gravar(k, registro);
      return k;
    },
    listarBackups: function (t) {
      var pre = A.chaveTurma(t, 'backup') + ':';
      return A.listar(pre).map(function (k) {
        var b = A.ler(k, {});
        return { chave: k, em: b.em, motivo: b.motivo, nome: b.perfil ? b.perfil.nome : '?', id: b.perfil ? b.perfil.id : '' };
      }).sort(function (a, b) { return b.em - a.em; });
    },
    restaurarBackup: function (t, chaveBackup) {
      if (!auth.valido()) return { ok: false, erro: 'Modo professor expirou.' };
      var b = A.ler(chaveBackup, null);
      if (!b || !b.perfil) return { ok: false, erro: 'Backup não encontrado.' };
      perfis.backup(t, b.perfil.id, 'antes de restaurar backup');
      var lista = A.ler(chavePerfis(t), []).filter(function (p) { return p.id !== b.perfil.id; });
      lista.push(b.perfil);
      perfis._salvarLista(t, lista);
      if (b.aluno) A.gravar(chaveAluno(t, b.perfil.id), b.aluno);
      Object.keys(b.sandbox || {}).forEach(function (esc) { perfis.sandboxGravar(t, b.perfil.id, esc, b.sandbox[esc]); });
      return { ok: true };
    },
    /** zera o progresso (mantém nome e PIN). Sempre faz backup antes. */
    resetar: function (t, id) {
      if (!auth.valido()) return { ok: false, erro: 'Modo professor expirou.' };
      var p = perfis.porId(t, id);
      if (!p) return { ok: false, erro: 'Perfil não encontrado.' };
      var k = perfis.backup(t, id, 'antes de resetar');
      A.gravar(chaveAluno(t, id), novoAluno(id, p.nome));
      A.listar(chaveSandboxPrefixo(t, id)).forEach(A.remover);
      return { ok: true, backup: k };
    },

    // ---------------------------------------------- código de progresso
    exportarCodigo: function (t, id) {
      var p = perfis.porId(t, id);
      var corpo = {
        tipo: 'lab-progresso', versao: 1, geradoEm: Date.now(), turma: t,
        perfil: p, aluno: A.ler(chaveAluno(t, id), null), sandbox: perfis._sandboxTodos(t, id)
      };
      var json = JSON.stringify(corpo);
      var soma = Lab.cripto.sha256Hex(json).slice(0, 16);
      var b64 = btoa(unescape(encodeURIComponent(json)));
      return 'LAB1.' + soma + '.' + b64;
    },
    lerCodigo: function (codigo) {
      codigo = String(codigo || '').replace(/\s+/g, '');
      var m = /^LAB1\.([0-9a-f]{16})\.(.+)$/.exec(codigo);
      if (!m) return { ok: false, erro: 'Isso não parece um código de progresso (ele começa com LAB1.).' };
      var json;
      try { json = decodeURIComponent(escape(atob(m[2]))); } catch (e) { return { ok: false, erro: 'Código incompleto ou corrompido.' }; }
      if (Lab.cripto.sha256Hex(json).slice(0, 16) !== m[1]) return { ok: false, erro: 'O código foi alterado ou cortado no meio (a soma de verificação não bate).' };
      var d = JSON.parse(json);
      if (d.tipo !== 'lab-progresso' || !d.perfil || !d.aluno) return { ok: false, erro: 'Código sem dados de aluno.' };
      return { ok: true, dados: d };
    },
    /** importa para a turma t. modo: 'novo' | 'substituir' */
    importar: function (t, dados) {
      var lista = A.ler(chavePerfis(t), []);
      var mesmo = lista.filter(function (p) { return p.id === dados.perfil.id || p.nome.toLowerCase() === dados.perfil.nome.toLowerCase(); })[0];
      if (mesmo) {
        perfis.backup(t, mesmo.id, 'antes de importar código de progresso');
        lista = lista.filter(function (p) { return p.id !== mesmo.id; });
        A.remover(chaveAluno(t, mesmo.id));
        A.listar(chaveSandboxPrefixo(t, mesmo.id)).forEach(A.remover);
      }
      var p = dados.perfil;
      lista.push(p);
      perfis._salvarLista(t, lista);
      A.gravar(chaveAluno(t, p.id), A.migrarAluno(dados.aluno));
      Object.keys(dados.sandbox || {}).forEach(function (esc) { perfis.sandboxGravar(t, p.id, esc, dados.sandbox[esc]); });
      return { ok: true, perfil: p, substituiu: !!mesmo };
    },

    // --------------------------------------------- controle do professor
    controle: function (t) { return A.ler(A.chaveTurma(t, 'controle'), { missoes: {} }); },
    definirMissao: function (t, missaoId, estado) {
      if (!auth.valido()) return false;
      var c = perfis.controle(t);
      c.missoes = c.missoes || {};
      c.missoes[missaoId] = estado; // 'liberada' | 'bloqueada'
      c.atualizadoEm = Date.now();
      return A.gravar(A.chaveTurma(t, 'controle'), c);
    },
    exportarTurma: function (t) {
      var lista = A.ler(chavePerfis(t), []);
      return {
        tipo: 'lab-turma', versao: 1, turma: t, exportadoEm: Date.now(),
        controle: perfis.controle(t),
        alunos: lista.map(function (p) {
          return { perfil: { id: p.id, nome: p.nome, criadoEm: p.criadoEm }, dados: A.ler(chaveAluno(t, p.id), null), sandbox: perfis._sandboxTodos(t, p.id) };
        })
      };
    }
  };

  Lab.turmas = turmas;
  Lab.auth = auth;
  Lab.perfis = perfis;
})();
