/* =====================================================================
   sessoes.js — contexto do aluno logado + sessões (aulas)
   Cada login abre uma sessão. Ela é salva a cada ação; se o navegador
   fechar sem "Encerrar sessão", a sessão fica registrada como "não encerrada".
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util;
  var LIMITE_PAUSA = 3 * 60000; // pausas maiores que 3 min não contam como tempo ativo

  var estado = {
    turma: null,   // id da turma
    aluno: null,   // registro completo do aluno
    salvar: function () {
      if (estado.turma && estado.aluno) Lab.perfis.salvarAluno(estado.turma, estado.aluno);
    },
    trilha: function () {
      var a = estado.aluno, id = Lab.cfg.trilha;
      if (!a.trilhas[id]) a.trilhas[id] = { missoes: {}, missaoAtual: null };
      return a.trilhas[id];
    },
    sair: function () {
      estado.aluno = null;
      sessao.atual = null;
    }
  };

  var sessao = {
    atual: null,

    /** fecha sessões antigas que ficaram abertas e cria uma nova */
    iniciar: function () {
      var a = estado.aluno;
      a.sessoes.forEach(function (s) {
        if (!s.fim) { s.fim = s.ultimoEvento || s.inicio; s.encerrada = false; }
      });
      var s = {
        id: U.uid('s'), numero: a.sessoes.length + 1,
        inicio: Date.now(), ultimoEvento: Date.now(), fim: null, encerrada: false,
        ativoMs: 0, aquecimento: null, avancos: [],
        contadores: { execucoes: 0, hipoteses: 0, ajudas: 0, insights: 0, previsoes: 0 }
      };
      a.sessoes.push(s);
      sessao.atual = s;
      estado.salvar();
      return s;
    },

    /** sessão anterior à atual (para a tela Retomar) */
    anterior: function () {
      var a = estado.aluno;
      if (!a) return null;
      var lista = a.sessoes.filter(function (s) { return !sessao.atual || s.id !== sessao.atual.id; });
      return lista.length ? lista[lista.length - 1] : null;
    },

    /** chamada a cada ação do aluno: soma tempo ativo na sessão e na missão aberta */
    atividade: function () {
      var s = sessao.atual;
      if (!s) return;
      var agora = Date.now();
      var delta = Math.min(agora - (s.ultimoEvento || agora), LIMITE_PAUSA);
      s.ultimoEvento = agora;
      if (s.encerrada) return;
      if (delta > 0) {
        s.ativoMs += delta;
        var prog = Lab.motor && Lab.motor.progressoAberto && Lab.motor.progressoAberto();
        if (prog) prog.tempoMs = (prog.tempoMs || 0) + delta;
      }
    },

    contar: function (nome) {
      if (!sessao.atual) return;
      sessao.atual.contadores[nome] = (sessao.atual.contadores[nome] || 0) + 1;
    },

    avanco: function (missaoId, etapaId, tipo) {
      if (!sessao.atual) return;
      sessao.atual.avancos.push({ missao: missaoId, etapa: etapaId || null, tipo: tipo, em: Date.now() });
    },

    encerrar: function () {
      var s = sessao.atual;
      if (!s) return null;
      sessao.atividade();
      s.fim = Date.now();
      s.encerrada = true;
      estado.salvar();
      return s;
    }
  };

  // tempo ativo também conta enquanto o aluno digita/clica, mesmo sem "ações" formais
  var marcar = U.debounce(function () {
    if (sessao.atual) { sessao.atividade(); estado.salvar(); }
  }, 1500);
  ['keydown', 'pointerdown'].forEach(function (ev) { document.addEventListener(ev, marcar, true); });

  // última chance de salvar ao fechar a aba
  window.addEventListener('beforeunload', function () {
    if (sessao.atual) { sessao.atividade(); estado.salvar(); }
  });

  Lab.estado = estado;
  Lab.sessao = sessao;
})();
