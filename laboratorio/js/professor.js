/* =====================================================================
   professor.js — modo professor (protegido pela senha)
   Liberar/bloquear missões por turma, redefinir PIN, resetar perfil
   (com backup automático e confirmação dupla), restaurar backups,
   exportar os dados da turma e ver o resumo da turma.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;

  var turmaVista = null;
  var relogio = null;

  function exigir(fn) {
    return function () {
      var args = arguments;
      if (Lab.auth.valido()) return fn.apply(null, args);
      return Lab.ui.pedirSenhaProfessor('O modo professor expirou. Digite a senha para continuar.').then(function (ok) {
        if (ok) return fn.apply(null, args);
      });
    };
  }

  function resumoAluno(t, p) {
    var a = Lab.perfis.carregarAluno(t, p.id) || { sessoes: [], trilhas: {}, diario: [] };
    var tr = (a.trilhas || {})[Lab.cfg.trilha] || { missoes: {} };
    var trilha = Lab.trilhaAtiva();
    var concluidas = 0, atual = '—', hip = 0, ajudas3 = 0, execs = 0;
    trilha.missoes.forEach(function (m) {
      var pr = tr.missoes[m.id];
      if (!pr) return;
      hip += (pr.hipoteses || []).length;
      execs += (pr.tentativas || []).length;
      ajudas3 += (pr.ajudas || []).filter(function (x) { return x.nivel === 3; }).length;
      if (pr.status === 'concluida') concluidas++;
      else {
        var def = Lab.missoes[m.id];
        var idx = def ? def.etapas.map(function (e) { return e.id; }).indexOf(pr.etapaAtual) : -1;
        atual = 'M' + (def ? def.numero : '?') + ' · etapa ' + (idx + 1);
      }
    });
    var ultima = a.sessoes.length ? a.sessoes[a.sessoes.length - 1] : null;
    return {
      aluno: a, concluidas: concluidas, atual: atual, hip: hip, ajudas3: ajudas3, execs: execs,
      sessoes: a.sessoes.length, tempo: a.sessoes.reduce(function (s, x) { return s + (x.ativoMs || 0); }, 0),
      ultima: ultima ? ultima.ultimoEvento || ultima.inicio : null,
      pontos: Lab.diario.totais(a).total
    };
  }

  var professor = {
    abrir: function () {
      return Lab.ui.pedirSenhaProfessor('Entre com a senha do professor para abrir o painel.').then(function (ok) {
        if (!ok) return;
        turmaVista = Lab.turmas.travada() || Lab.turmas.lista()[0].id;
        professor.render();
        Lab.ui.mostrarTela('tela-professor');
        clearInterval(relogio);
        relogio = setInterval(function () {
          var n = document.getElementById('prof-tempo');
          if (!n) return;
          var ms = Lab.auth.restanteMs();
          n.textContent = ms ? 'desbloqueado por mais ' + Math.ceil(ms / 60000) + ' min' : 'bloqueado';
          if (!ms) clearInterval(relogio);
        }, 1000);
      });
    },

    sair: function () {
      Lab.auth.encerrar();
      clearInterval(relogio);
      Lab.app.telaInicial();
    },

    render: function () {
      var raiz = U.limpar(document.getElementById('prof-conteudo'));
      var travada = Lab.turmas.travada();
      // abas de turma
      raiz.appendChild(el('div', { class: 'prof-turmas', role: 'tablist', 'aria-label': 'Turmas' }, Lab.turmas.lista().map(function (t) {
        return el('button', {
          type: 'button', role: 'tab', 'aria-selected': t.id === turmaVista ? 'true' : 'false', class: 'prof-aba',
          onclick: function () { turmaVista = t.id; professor.render(); }
        }, t.nome + (t.id === travada ? ' (este computador)' : ''));
      })));

      var t = turmaVista;
      var turma = Lab.turmas.porId(t);

      // ações gerais
      raiz.appendChild(el('div', { class: 'prof-acoes' }, [
        el('button', { type: 'button', class: 'bt bt-secundario', onclick: exigir(function () {
          U.baixar('turma' + t + '-' + U.data(Date.now()).replace(/\//g, '-') + '.json', JSON.stringify(Lab.perfis.exportarTurma(t), null, 2));
        }) }, 'Exportar dados da ' + turma.nome + ' (JSON)'),
        t !== travada ? el('button', { type: 'button', class: 'bt bt-secundario', onclick: exigir(function () {
          Lab.ui.confirmar('Trocar a turma deste computador', 'Este computador passa a abrir na ' + turma.nome + '. Nenhum dado é apagado. O modo professor será fechado.', 'Trocar').then(function (ok) {
            if (!ok) return;
            Lab.turmas.travar(t);
            clearInterval(relogio);
            Lab.app.telaInicial();
          });
        }) }, 'Fazer deste computador um da ' + turma.nome) : null
      ]));

      // missões
      var ctrl = Lab.perfis.controle(t).missoes || {};
      var secM = el('section', { class: 'prof-sec' }, [
        el('h2', null, 'Ritmo das missões — ' + turma.nome),
        el('p', { class: 'nota' }, 'As missões abrem em sequência (a próxima só depois da anterior). Bloquear segura a turma inteira numa missão, mesmo para quem terminou antes. O controle vale para este computador.')
      ]);
      var tab = el('table', { class: 'tabela-prof' }, [el('thead', null, el('tr', null, ['Missão', 'Arquivo', 'Situação', ''].map(function (h) { return el('th', null, h); })))]);
      var corpo = el('tbody');
      Lab.trilhaAtiva().missoes.forEach(function (m, i) {
        var existe = !!Lab.missoes[m.id];
        var bloqueada = ctrl[m.id] === 'bloqueada';
        corpo.appendChild(el('tr', null, [
          el('td', null, (i + 1) + '. ' + m.titulo),
          el('td', null, existe ? 'pronta' : 'em preparação'),
          el('td', null, bloqueada ? 'Bloqueada' : 'Liberada (em sequência)'),
          el('td', null, el('button', { type: 'button', class: 'bt bt-pequeno ' + (bloqueada ? 'bt-principal' : 'bt-secundario'), onclick: exigir(function () {
            Lab.perfis.definirMissao(t, m.id, bloqueada ? 'liberada' : 'bloqueada');
            professor.render();
          }) }, bloqueada ? 'Liberar' : 'Bloquear'))
        ]));
      });
      tab.appendChild(corpo);
      secM.appendChild(tab);
      raiz.appendChild(secM);

      // resumo da turma
      var perfis = Lab.perfis.listar(t);
      var secA = el('section', { class: 'prof-sec' }, [
        el('h2', null, 'Resumo da turma (' + perfis.length + ' aluno' + (perfis.length === 1 ? '' : 's') + ' neste computador)')
      ]);
      if (!perfis.length) secA.appendChild(el('p', { class: 'vazio' }, 'Nenhum perfil criado nesta turma neste computador.'));
      else {
        var tabA = el('table', { class: 'tabela-prof' }, [el('thead', null, el('tr', null,
          ['Aluno', 'Missões concluídas', 'Agora em', 'Sessões', 'Tempo ativo', 'Execuções', 'Hipóteses', 'Soluções vistas', 'Pts processo', 'Último acesso', 'Ações'].map(function (h) { return el('th', null, h); })))]);
        var cA = el('tbody');
        perfis.forEach(function (p) {
          var r = resumoAluno(t, p);
          cA.appendChild(el('tr', null, [
            el('td', null, p.nome),
            el('td', null, String(r.concluidas)),
            el('td', null, r.atual),
            el('td', null, String(r.sessoes)),
            el('td', null, U.duracao(r.tempo)),
            el('td', null, String(r.execs)),
            el('td', null, String(r.hip)),
            el('td', null, String(r.ajudas3)),
            el('td', null, String(r.pontos)),
            el('td', null, r.ultima ? U.dataHora(r.ultima) : '—'),
            el('td', { class: 'prof-acoes-aluno' }, [
              el('button', { type: 'button', class: 'bt bt-pequeno bt-secundario', onclick: exigir(function () { Lab.diario.abrirRelatorio(r.aluno, t, { somenteLeitura: true }); }) }, 'Relatório'),
              el('button', { type: 'button', class: 'bt bt-pequeno bt-secundario', onclick: exigir(function () { professor.redefinirPin(t, p); }) }, 'Redefinir PIN'),
              el('button', { type: 'button', class: 'bt bt-pequeno bt-secundario', onclick: exigir(function () { Lab.app.exportarCodigo(p.id, t); }) }, 'Código'),
              el('button', { type: 'button', class: 'bt bt-pequeno bt-perigo', onclick: exigir(function () { professor.resetar(t, p); }) }, 'Resetar')
            ])
          ]));
        });
        tabA.appendChild(cA);
        secA.appendChild(el('div', { class: 'rolagem-x' }, tabA));
      }
      raiz.appendChild(secA);

      // backups
      var backups = Lab.perfis.listarBackups(t);
      var secB = el('section', { class: 'prof-sec' }, [
        el('h2', null, 'Cópias de segurança'),
        el('p', { class: 'nota' }, 'Criadas automaticamente antes de resetar, importar ou restaurar. Restaurar também guarda uma cópia do estado atual antes.')
      ]);
      if (!backups.length) secB.appendChild(el('p', { class: 'vazio' }, 'Nenhuma cópia ainda.'));
      else secB.appendChild(el('ul', { class: 'lista-backups' }, backups.slice(0, 30).map(function (b) {
        return el('li', null, [
          el('span', null, b.nome + ' · ' + U.dataHora(b.em) + ' · ' + b.motivo),
          el('button', { type: 'button', class: 'bt bt-pequeno bt-secundario', onclick: exigir(function () {
            Lab.ui.confirmar('Restaurar cópia', 'O perfil de ' + b.nome + ' volta a ficar como estava em ' + U.dataHora(b.em) + '.', 'Restaurar').then(function (ok) {
              if (!ok) return;
              var r = Lab.perfis.restaurarBackup(t, b.chave);
              Lab.ui.aviso(r.ok ? 'Cópia restaurada.' : r.erro, r.ok ? '' : 'erro');
              professor.render();
            });
          }) }, 'Restaurar')
        ]);
      })));
      raiz.appendChild(secB);
    },

    redefinirPin: function (t, p) {
      var input = el('input', { type: 'text', inputmode: 'numeric', maxlength: '4', id: 'novo-pin-prof', class: 'campo-pin' });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      return Lab.ui.modal({
        titulo: 'Novo PIN para ' + p.nome, classe: 'modal-estreito',
        corpo: el('div', null, [el('label', { for: 'novo-pin-prof', class: 'rotulo' }, 'Novo PIN (4 números) — combine com o aluno'), input, msg]),
        botoes: [{ texto: 'Cancelar', valor: null }, { texto: 'Salvar PIN', principal: true, antes: function () {
          if (!/^\d{4}$/.test(input.value)) { msg.className = 'msg-campo erro'; msg.textContent = 'Use exatamente 4 números.'; return false; }
          return input.value;
        } }]
      }).then(function (pin) {
        if (!pin) return;
        return Lab.perfis.redefinirPin(t, p.id, pin).then(function (r) {
          Lab.ui.aviso(r.ok ? 'PIN de ' + p.nome + ' redefinido.' : r.erro, r.ok ? '' : 'erro');
        });
      });
    },

    resetar: function (t, p) {
      return Lab.ui.confirmar('Resetar o progresso de ' + p.nome + '?', 'Todo o progresso, diário e sessões deste aluno voltam ao zero (nome e PIN continuam). Uma cópia de segurança é criada antes e pode ser restaurada.', 'Continuar', true).then(function (ok) {
        if (!ok) return;
        var input = el('input', { type: 'text', id: 'conf-reset', autocomplete: 'off' });
        var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
        return Lab.ui.modal({
          titulo: 'Confirmação final', classe: 'modal-estreito',
          corpo: el('div', null, [el('label', { for: 'conf-reset', class: 'rotulo' }, 'Para confirmar, digite o nome do aluno exatamente: ' + p.nome), input, msg]),
          botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Resetar agora', principal: true, classe: 'bt-perigo', antes: function () {
            if (U.normalizarNome(input.value) !== p.nome) { msg.className = 'msg-campo erro'; msg.textContent = 'O nome não confere.'; return false; }
            return true;
          } }]
        }).then(function (v) {
          if (v !== true) return;
          var r = Lab.perfis.resetar(t, p.id);
          Lab.ui.aviso(r.ok ? 'Progresso de ' + p.nome + ' resetado (cópia de segurança criada).' : r.erro, r.ok ? '' : 'erro');
          professor.render();
        });
      });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('prof-sair');
    if (b) b.addEventListener('click', professor.sair);
  });

  Lab.professor = professor;
})();
