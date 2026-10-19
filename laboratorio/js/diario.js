/* =====================================================================
   diario.js — diário automático, pontos de PROCESSO e relatório
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;
  var MAX_ENTRADAS = 4000;

  var CATEGORIAS = {
    investigacao: 'Investigação',
    hipoteses: 'Hipóteses',
    metodo: 'Método (uma mudança por vez)',
    reflexao: 'Reflexão'
  };

  var ROTULOS = {
    sessao: 'Sessão', aquecimento: 'Aquecimento', execucao: 'Execução', hipotese: 'Hipótese',
    previsao: 'Previsão', ajuda: 'Ajuda', solucao: 'Solução comentada', inspecao: 'Inspecionar',
    diff: 'Muitas mudanças', etapa: 'Etapa concluída', missao: 'Missão concluída', insight: 'Insight',
    restaurar: 'Código restaurado', raiox: 'Raio-X', pontos: 'Pontos'
  };

  var diario = {
    CATEGORIAS: CATEGORIAS,

    /** registra uma entrada. ctx (missao/etapa) é preenchido pelo motor. */
    registrar: function (tipo, texto, dados) {
      var a = Lab.estado.aluno;
      if (!a) return null;
      var ctx = (Lab.motor && Lab.motor.contexto && Lab.motor.contexto()) || {};
      var e = {
        em: Date.now(), sessao: Lab.sessao.atual ? Lab.sessao.atual.id : null,
        trilha: Lab.cfg.trilha, missao: ctx.missao || null, etapa: ctx.etapa || null,
        tipo: tipo, texto: texto || '', dados: dados || null
      };
      a.diario.push(e);
      if (a.diario.length > MAX_ENTRADAS) a.diario.splice(0, a.diario.length - MAX_ENTRADAS);
      Lab.sessao.atividade();
      Lab.estado.salvar();
      diario.renderPainel();
      return e;
    },

    /**
     * dá pontos de processo. limiteChave/limite evitam "farmar" pontos
     * (ex.: no máximo 2 pontos de Inspecionar por etapa).
     */
    pontuar: function (categoria, n, motivo, limiteChave, limite) {
      var a = Lab.estado.aluno;
      if (!a) return 0;
      if (limiteChave) {
        a.limitesPontos = a.limitesPontos || {};
        var usado = a.limitesPontos[limiteChave] || 0;
        if (usado >= limite) return 0;
        n = Math.min(n, limite - usado);
        a.limitesPontos[limiteChave] = usado + n;
      }
      a.pontos = a.pontos || { investigacao: 0, hipoteses: 0, metodo: 0, reflexao: 0 };
      a.pontos[categoria] = (a.pontos[categoria] || 0) + n;
      diario.registrar('pontos', '+' + n + ' ' + CATEGORIAS[categoria] + ': ' + motivo, { categoria: categoria, n: n });
      if (Lab.ui && Lab.ui.atualizarPontos) Lab.ui.atualizarPontos();
      return n;
    },

    totais: function (a) {
      var p = (a && a.pontos) || {};
      var t = { investigacao: p.investigacao || 0, hipoteses: p.hipoteses || 0, metodo: p.metodo || 0, reflexao: p.reflexao || 0 };
      t.total = t.investigacao + t.hipoteses + t.metodo + t.reflexao;
      return t;
    },

    // --------------------------------------------------------- painel
    renderPainel: function () {
      var cont = document.getElementById('painel-diario');
      var a = Lab.estado.aluno;
      if (!cont || !a) return;
      var sid = Lab.sessao.atual && Lab.sessao.atual.id;
      var itens = a.diario.filter(function (e) { return e.sessao === sid && e.tipo !== 'pontos'; }).slice(-80).reverse();
      U.limpar(cont);
      if (!itens.length) {
        cont.appendChild(el('p', { class: 'vazio' }, 'O diário desta sessão aparece aqui: execuções, hipóteses, ajudas e insights. Tudo é salvo sozinho.'));
        return;
      }
      itens.forEach(function (e) {
        cont.appendChild(el('div', { class: 'diario-item tipo-' + e.tipo }, [
          el('span', { class: 'diario-hora' }, U.hora(e.em)),
          el('span', { class: 'diario-tipo' }, ROTULOS[e.tipo] || e.tipo),
          el('span', { class: 'diario-texto' }, e.texto)
        ]));
      });
    },

    // ------------------------------------------------------ relatório
    dadosRelatorio: function (a, turmaId) {
      var trilhaId = Lab.cfg.trilha;
      var trilha = (a.trilhas && a.trilhas[trilhaId]) || { missoes: {} };
      var defTrilha = Lab.trilhaAtiva();
      var missoes = (defTrilha ? defTrilha.missoes : []).map(function (m) {
        var prog = trilha.missoes[m.id];
        var def = Lab.missoes[m.id];
        if (!prog) return { id: m.id, titulo: m.titulo, status: 'não iniciada' };
        var tipos = {};
        (prog.tentativas || []).forEach(function (t) { (t.tiposErro || []).forEach(function (x) { tipos[x] = (tipos[x] || 0) + 1; }); });
        var titulos = {};
        if (def) def.etapas.forEach(function (e, i) { titulos[e.id] = 'Etapa ' + (i + 1) + ' – ' + e.titulo; });
        return {
          id: m.id, titulo: m.titulo, status: prog.status === 'concluida' ? 'concluída' : 'em andamento',
          tempoMs: prog.tempoMs || 0,
          tentativas: (prog.tentativas || []).length,
          etapasConcluidas: (prog.etapasConcluidas || []).map(function (e) { return titulos[e] || e; }),
          tiposErro: tipos,
          hipoteses: (prog.hipoteses || []).map(function (h) { return { em: h.em, etapa: titulos[h.etapa] || h.etapa, texto: 'Acho que o problema está em ' + h.onde + ' porque ' + h.porque }; }),
          ajudas: (prog.ajudas || []).map(function (h) { return { em: h.em, etapa: titulos[h.etapa] || h.etapa, nivel: h.nivel, explicacao: h.explicacao || '' }; }),
          previsoes: (prog.previsoes || []).map(function (p) { return { etapa: titulos[p.etapa] || p.etapa, previsao: p.previsao, observado: p.observado, diferenca: p.diferenca || '' }; }),
          snapshots: (prog.snapshots || []).length,
          insight: prog.insight || null
        };
      });
      return {
        geradoEm: Date.now(), aluno: a.nome, turma: turmaId, trilha: trilhaId,
        pontos: diario.totais(a),
        sessoes: a.sessoes.map(function (s) {
          return {
            numero: s.numero, inicio: s.inicio, fim: s.fim || s.ultimoEvento, ativoMs: s.ativoMs,
            encerrada: !!s.encerrada, aquecimento: s.aquecimento, contadores: s.contadores,
            avancos: s.avancos.map(function (v) { return Lab.descreverAvanco(v); })
          };
        }),
        missoes: missoes,
        reflexao: a.reflexao || {}
      };
    },

    abrirRelatorio: function (a, turmaId, opcoes) {
      opcoes = opcoes || {};
      var d = diario.dadosRelatorio(a, turmaId);
      var turma = Lab.turmas.porId(turmaId);
      var ov = document.getElementById('relatorio');
      var corpo = U.limpar(document.getElementById('relatorio-corpo'));

      corpo.appendChild(el('header', { class: 'rel-cabecalho' }, [
        el('p', { class: 'rel-sobre' }, Lab.cfg.nomeSistema + ' · ' + Lab.cfg.subtitulo + ' · Projeto de Aplicações Web – Cap. 4'),
        el('h1', null, 'Relatório de aprendizagem'),
        el('dl', { class: 'rel-ficha' }, [
          el('dt', null, 'Aluno(a)'), el('dd', null, d.aluno),
          el('dt', null, 'Turma'), el('dd', null, turma ? turma.nome : turmaId),
          el('dt', null, 'Gerado em'), el('dd', null, U.dataHora(d.geradoEm)),
          el('dt', null, 'Tempo ativo total'), el('dd', null, U.duracao(d.sessoes.reduce(function (s, x) { return s + (x.ativoMs || 0); }, 0)))
        ])
      ]));

      // pontos de processo
      var p = d.pontos;
      corpo.appendChild(el('section', null, [
        el('h2', null, 'Pontos de processo'),
        el('p', { class: 'rel-nota' }, 'Os pontos medem COMO você trabalhou (investigar, levantar hipóteses, mudar uma coisa por vez, refletir), e não a velocidade.'),
        el('ul', { class: 'rel-pontos' }, Object.keys(CATEGORIAS).map(function (k) {
          return el('li', null, [el('strong', null, String(p[k])), ' ' + CATEGORIAS[k]]);
        }).concat([el('li', { class: 'total' }, [el('strong', null, String(p.total)), ' no total'])]))
      ]));

      // sessões
      corpo.appendChild(el('section', null, [
        el('h2', null, 'Sessões (aulas)'),
        el('table', { class: 'rel-tabela' }, [
          el('thead', null, el('tr', null, ['#', 'Data', 'Horário', 'Tempo ativo', 'O que avançou', 'Encerrada?'].map(function (h) { return el('th', null, h); }))),
          el('tbody', null, d.sessoes.map(function (s) {
            return el('tr', null, [
              el('td', null, String(s.numero)), el('td', null, U.data(s.inicio)),
              el('td', null, U.hora(s.inicio) + '–' + U.hora(s.fim || s.inicio)),
              el('td', null, U.duracao(s.ativoMs)),
              el('td', null, s.avancos.length ? s.avancos.join('; ') : '—'),
              el('td', null, s.encerrada ? 'sim' : 'não (fechou sem encerrar)')
            ]);
          }))
        ])
      ]));

      // missões
      d.missoes.forEach(function (m) {
        if (m.status === 'não iniciada') return;
        var sec = el('section', { class: 'rel-missao' }, [
          el('h2', null, m.titulo),
          el('p', { class: 'rel-nota' }, 'Situação: ' + m.status + ' · tempo: ' + U.duracao(m.tempoMs) + ' · execuções: ' + m.tentativas + ' · versões salvas do código: ' + m.snapshots)
        ]);
        if (m.etapasConcluidas.length) sec.appendChild(el('p', null, 'Etapas concluídas: ' + m.etapasConcluidas.join(' · ')));
        var tipos = Object.keys(m.tiposErro);
        if (tipos.length) sec.appendChild(el('p', null, 'Tipos de erro encontrados: ' + tipos.map(function (t) { return t + ' (' + m.tiposErro[t] + 'x)'; }).join(', ')));
        if (m.hipoteses.length) {
          sec.appendChild(el('h3', null, 'Hipóteses que escrevi'));
          sec.appendChild(el('ol', { class: 'rel-lista' }, m.hipoteses.map(function (h) { return el('li', null, [el('span', { class: 'rel-meta' }, U.dataHora(h.em) + ' · ' + h.etapa), el('br'), h.texto]); })));
        }
        if (m.previsoes.length) {
          sec.appendChild(el('h3', null, 'Previsões'));
          m.previsoes.forEach(function (pv) {
            sec.appendChild(el('div', { class: 'rel-previsao' }, [
              el('p', { class: 'rel-meta' }, pv.etapa),
              el('p', null, [el('strong', null, 'Eu previ: '), pv.previsao]),
              el('p', null, [el('strong', null, 'Aconteceu: '), pv.observado]),
              pv.diferenca ? el('p', null, [el('strong', null, 'Diferença que notei: '), pv.diferenca]) : null
            ]));
          });
        }
        if (m.ajudas.length) {
          sec.appendChild(el('h3', null, 'Ajudas usadas'));
          sec.appendChild(el('ul', { class: 'rel-lista' }, m.ajudas.map(function (h) {
            var nome = ['', 'evidência', 'pista de conceito', 'solução comentada'][h.nivel] || h.nivel;
            return el('li', null, [el('span', { class: 'rel-meta' }, U.dataHora(h.em) + ' · ' + h.etapa + ' · ' + nome),
              h.explicacao ? el('span', null, [el('br'), 'Minha explicação: ' + h.explicacao]) : null]);
          })));
        }
        if (m.insight) {
          sec.appendChild(el('h3', null, 'Insight (Raio-X)'));
          sec.appendChild(el('p', { class: 'rel-meta' }, m.insight.pergunta));
          sec.appendChild(el('blockquote', null, m.insight.resposta));
        }
        corpo.appendChild(sec);
      });

      // reflexão para completar depois
      var refl = d.reflexao;
      var campos = [
        ['errei', 'O que eu errei (e como descobri o erro)'],
        ['aprendi', 'O que eu aprendi'],
        ['fariaDiferente', 'O que eu faria diferente na próxima vez']
      ];
      corpo.appendChild(el('section', { class: 'rel-reflexao' }, [
        el('h2', null, 'Minha reflexão'),
        el('p', { class: 'rel-nota so-tela' }, 'Complete com calma. O texto é salvo sozinho e sai na impressão.'),
        el('div', null, campos.map(function (c) {
          var ta = el('textarea', { rows: '4', 'aria-label': c[1], 'data-campo': c[0], disabled: opcoes.somenteLeitura ? true : null });
          ta.value = refl[c[0]] || '';
          ta.addEventListener('input', U.debounce(function () {
            a.reflexao = a.reflexao || {};
            a.reflexao[c[0]] = ta.value;
            if (Lab.estado.aluno === a) Lab.estado.salvar();
          }, 500));
          var impresso = el('div', { class: 'so-impressao linhas' }, ta.value || '');
          ta.addEventListener('input', function () { impresso.textContent = ta.value; });
          return el('div', { class: 'rel-campo' }, [el('label', null, c[1]), ta, impresso]);
        }))
      ]));

      document.getElementById('rel-json').onclick = function () {
        U.baixar('relatorio-' + slug(a.nome) + '-turma' + turmaId + '.json', JSON.stringify(diario.dadosRelatorio(a, turmaId), null, 2));
      };
      Lab.ui.abrirOverlay(ov);
    }
  };

  function slug(t) {
    return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  diario.slug = slug;

  Lab.diario = diario;
})();
