/* =====================================================================
   motor.js — o MOTOR das missões (reutilizável para qualquer capítulo)
   Lê as missões como DADOS (missoes/<trilha>/*.js) e cuida de:
   executar, validar, hipótese obrigatória, aviso de "mudou demais",
   previsão, escada de ajuda, pontos de processo, pontos de salvamento.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el, CFG = Lab.cfg;

  // ------------------------------------------------ registro de missões
  Lab.missoes = Lab.missoes || {};
  Lab.trilhas = Lab.trilhas || {};
  Lab.assets = Lab.assets || {};
  Lab.registrarMissao = function (def) { Lab.missoes[def.id] = def; };
  Lab.registrarTrilha = function (def) { Lab.trilhas[def.id] = def; };
  Lab.registrarAssets = function (mapa) { Object.keys(mapa).forEach(function (k) { Lab.assets[k] = mapa[k]; }); };
  Lab.trilhaAtiva = function () { return Lab.trilhas[CFG.trilha] || null; };
  Lab.descreverAvanco = function (v) {
    var m = Lab.missoes[v.missao];
    var nomeM = m ? 'M' + m.numero : v.missao;
    if (v.tipo === 'missao') return nomeM + ' concluída';
    if (v.tipo === 'inicio') return nomeM + ' iniciada';
    var idx = m ? m.etapas.map(function (e) { return e.id; }).indexOf(v.etapa) : -1;
    return nomeM + ' · etapa ' + (idx + 1) + ' concluída';
  };

  // ------------------------------------------------------------ estado
  var atual = {
    def: null,        // definição da missão aberta
    prog: null,       // progresso salvo dessa missão
    etapaIdx: 0,
    revisao: false,   // missão já concluída, aberta só para rever
    ocupado: false,
    errosPreview: [],
    armazenamentoSessao: {}
  };

  function etapaDef() { return atual.def ? atual.def.etapas[atual.etapaIdx] : null; }
  function estEtapa(id) {
    var p = atual.prog;
    id = id || (etapaDef() && etapaDef().id);
    p.etapas = p.etapas || {};
    if (!p.etapas[id]) p.etapas[id] = { execucoes: 0, tentativasComHipotese: 0, precisaHipotese: false, previsaoFeita: false, ultimoCodigo: null, nivelAjuda: 0, solucaoVista: false, ultimoResultado: {} };
    return p.etapas[id];
  }
  function escopoSandbox() { return CFG.trilha + ':' + atual.def.id; }
  function chaveLimite(nome) { return nome + ':' + atual.def.id + ':' + etapaDef().id; }

  function novoProgresso(def) {
    return {
      status: 'em-andamento', iniciadaEm: Date.now(), concluidaEm: null, versaoMissao: def.versao || 1,
      etapaAtual: def.etapas[0].id, etapasConcluidas: [], codigo: null, inicioEtapa: {},
      tempoMs: 0, tentativas: [], hipoteses: [], ajudas: [], previsoes: [], snapshots: [],
      etapas: {}, insight: null, raiox: { vistos: [] }
    };
  }

  function salvarCodigo() {
    if (!atual.prog || atual.revisao) return;
    atual.prog.codigo = Lab.editor.obterRegioes();
    Lab.estado.salvar();
  }
  var salvarCodigoDepois = U.debounce(salvarCodigo, 700);

  function igualArquivos(a, b) {
    if (!a || !b) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return a[k] === b[k]; });
  }

  function diffArquivos(antes, depois) {
    var total = 0, porArquivo = [];
    Object.keys(depois).forEach(function (nome) {
      var d = U.diffLinhas(antes[nome] || '', depois[nome]);
      var n = U.contarMudancas(d);
      if (n) porArquivo.push({ nome: nome, diff: d, n: n });
      total += n;
    });
    return { total: total, arquivos: porArquivo };
  }

  function preencher(texto, dados) {
    return String(texto || '').replace(/\{(\w+)\}/g, function (m, k) { return dados && dados[k] !== undefined ? dados[k] : m; });
  }

  function qualidadeHipotese(onde, porque) {
    var t = onde + ' ' + porque, q = 0;
    if (t.length >= 45) q++;
    if (/linha\s*\d+|<\/?[a-z][a-z0-9]*|[.#][a-z][\w-]*|\b[a-z-]+\s*:|\.(css|html|js)\b|\b(tag|seletor|classe|class|id|propriedade|atributo|caminho|href|src|link|fechamento|abertura)\b/i.test(t)) q++;
    if (porque.trim().split(/\s+/).length >= 5) q++;
    return Math.max(1, q);
  }

  // ============================================================ MOTOR
  var motor = {
    molduraPreview: null,

    iniciar: function () {
      motor.molduraPreview = new Lab.preview.Moldura(document.getElementById('preview-iframe'), 'preview');
      motor.molduraPreview.aoMensagem = motor._mensagemPreview;
      Lab.validadores.iniciar(document.getElementById('validador-iframe'));
      Lab.editor.aoMudar(function () { salvarCodigoDepois(); });

      document.getElementById('bt-executar').addEventListener('click', function () { motor.executar(); });
      document.getElementById('bt-recarregar').addEventListener('click', function () { motor.recarregarPreview(true); });
      document.getElementById('bt-inspecionar').addEventListener('click', function () { Lab.inspetor.alternar(); });
      document.getElementById('bt-fechar-ficha').addEventListener('click', function () { Lab.inspetor.fechar(); });
      document.getElementById('bt-ajuda').addEventListener('click', function () { motor.abrirAjuda(); });
      document.getElementById('bt-restaurar').addEventListener('click', function () { motor.restaurarEtapa(); });
      document.getElementById('bt-arquivos').addEventListener('click', function () { motor.mostrarArquivos(); });
      document.getElementById('bt-limpar-dados').addEventListener('click', function () { motor.limparDadosSite(); });
      U.$$('#seletor-largura button').forEach(function (b) {
        b.addEventListener('click', function () { motor.definirLargura(b.getAttribute('data-largura')); });
      });
      document.addEventListener('keydown', function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter' && document.body.getAttribute('data-tela') === 'tela-bancada' && document.getElementById('camada-modal').hidden) {
          ev.preventDefault();
          motor.executar();
        }
      });
      window.addEventListener('resize', U.debounce(function () { motor.definirLargura(); }, 150));
      U.$$('.bancada-baixo [role=tab]').forEach(function (t) {
        t.addEventListener('click', function () { motor.abaInferior(t.getAttribute('data-painel')); });
      });
    },

    contexto: function () {
      if (!atual.def) return {};
      return { missao: atual.def.id, etapa: etapaDef() ? etapaDef().id : null };
    },
    progressoAberto: function () { return atual.revisao ? null : atual.prog; },
    arquivoPrincipal: function () { return (atual.def && atual.def.principal) || 'index.html'; },
    missaoAberta: function () { return atual.def; },

    // --------------------------------------------------- disponibilidade
    situacao: function (missaoId) {
      var trilha = Lab.trilhaAtiva();
      var meta = trilha.missoes.filter(function (m) { return m.id === missaoId; })[0];
      var prog = Lab.estado.trilha().missoes[missaoId];
      if (prog && prog.status === 'concluida') return 'concluida';
      if (!Lab.missoes[missaoId]) return 'em-breve';
      var ctrl = Lab.perfis.controle(Lab.estado.turma).missoes || {};
      if (ctrl[missaoId] === 'bloqueada') return 'bloqueada-professor';
      var idx = trilha.missoes.indexOf(meta);
      if (idx > 0) {
        var anterior = Lab.estado.trilha().missoes[trilha.missoes[idx - 1].id];
        if (!anterior || anterior.status !== 'concluida') return 'bloqueada-sequencia';
      }
      return prog ? 'em-andamento' : 'disponivel';
    },

    proximaMissao: function () {
      var trilha = Lab.trilhaAtiva();
      for (var i = 0; i < trilha.missoes.length; i++) {
        var s = motor.situacao(trilha.missoes[i].id);
        if (s !== 'concluida') return { meta: trilha.missoes[i], situacao: s };
      }
      return null;
    },

    // ----------------------------------------------------- abrir missão
    abrirMissao: function (id, opcoes) {
      opcoes = opcoes || {};
      var def = Lab.missoes[id];
      if (!def) return;
      var trilha = Lab.estado.trilha();
      var prog = trilha.missoes[id];
      var nova = !prog;
      if (!prog) {
        prog = trilha.missoes[id] = novoProgresso(def);
        Lab.sessao.avanco(id, null, 'inicio');
      }
      trilha.missaoAtual = id;
      atual.def = def;
      atual.prog = prog;
      atual.revisao = prog.status === 'concluida';
      atual.armazenamentoSessao = {};
      // etapa atual (se a etapa salva sumiu numa atualização, pega a primeira não concluída)
      var idx = def.etapas.map(function (e) { return e.id; }).indexOf(prog.etapaAtual);
      if (idx === -1) {
        idx = def.etapas.findIndex(function (e) { return prog.etapasConcluidas.indexOf(e.id) === -1; });
        if (idx === -1) idx = def.etapas.length - 1;
        prog.etapaAtual = def.etapas[idx].id;
      }
      atual.etapaIdx = idx;

      Lab.editor.carregar(def.arquivos, prog.codigo, { abaInicial: def.abaInicial });
      Lab.editor.setSomenteLeitura(false);
      if (!prog.codigo) prog.codigo = Lab.editor.obterRegioes();
      if (!prog.inicioEtapa[prog.etapaAtual]) prog.inicioEtapa[prog.etapaAtual] = U.clone(prog.codigo);
      if (nova) Lab.diario.registrar('sessao', 'Começou a ' + def.titulo);
      Lab.estado.salvar();

      Lab.inspetor.alternar(false);
      motor.renderPainelEsquerdo();
      motor.renderCriterios(estEtapa().ultimoResultado);
      document.getElementById('bancada-titulo').textContent = 'Missão ' + def.numero + ' · ' + def.titulo;
      document.getElementById('banner-revisao').hidden = !atual.revisao;
      Lab.consolePainel.limpar();
      Lab.diario.renderPainel();
      motor.renderArmazenamento();
      Lab.ui.mostrarTela('tela-bancada');
      motor.definirLargura(motor._largura || 'painel');
      motor.recarregarPreview(false);
      if (nova && !opcoes.silencioso) {
        setTimeout(function () { Lab.ui.aviso('Leia a mensagem do cliente e clique em Executar para ver como o site está agora.'); }, 400);
      }
    },

    fecharMissao: function () {
      if (atual.def && !atual.revisao) salvarCodigo();
      Lab.inspetor.alternar(false);
      atual.def = null;
      atual.prog = null;
    },

    // ------------------------------------------------ painel esquerdo
    renderPainelEsquerdo: function () {
      var def = atual.def, prog = atual.prog;
      // conversa com o cliente
      var chat = U.limpar(document.getElementById('chat-mensagens'));
      document.getElementById('chat-nome').textContent = def.cliente.nome;
      document.getElementById('chat-negocio').textContent = def.cliente.negocio;
      document.getElementById('chat-avatar').textContent = def.cliente.iniciais || def.cliente.nome.slice(0, 2).toUpperCase();
      function bolha(texto, quem, extra) {
        chat.appendChild(el('div', { class: 'bolha ' + (quem || 'cliente') + (extra ? ' ' + extra : '') }, [
          el('p', null, texto)
        ]));
      }
      (def.abertura || []).forEach(function (m) { bolha(m); });
      def.etapas.forEach(function (e, i) {
        if (i > atual.etapaIdx && !atual.revisao) return;
        (e.mensagens || []).forEach(function (m) { bolha(m); });
        if (prog.etapasConcluidas.indexOf(e.id) !== -1) {
          chat.appendChild(el('div', { class: 'chat-marco' }, 'Etapa ' + (i + 1) + ' entregue'));
          if (e.aoConcluir) bolha(e.aoConcluir);
        }
      });
      if (atual.revisao && def.encerramento) bolha(def.encerramento);
      chat.scrollTop = chat.scrollHeight;

      // tarefa
      var e = etapaDef();
      var tarefa = U.limpar(document.getElementById('tarefa'));
      tarefa.appendChild(el('p', { class: 'tarefa-meta' }, [
        el('span', null, 'Etapa ' + (atual.etapaIdx + 1) + ' de ' + def.etapas.length),
        e.minutos ? el('span', null, '≈ ' + e.minutos + ' min') : null
      ]));
      tarefa.appendChild(el('h2', { class: 'tarefa-titulo' }, e.titulo));
      tarefa.appendChild(el('div', { class: 'tarefa-texto', html: e.tarefa }));
      if (e.conceitos && e.conceitos.length) {
        tarefa.appendChild(el('ul', { class: 'conceitos', 'aria-label': 'Conceitos desta etapa' }, e.conceitos.map(function (c) { return el('li', null, c); })));
      }
      motor.renderTrilhaEtapas();
    },

    renderTrilhaEtapas: function () {
      var cont = U.limpar(document.getElementById('etapas-trilha'));
      atual.def.etapas.forEach(function (e, i) {
        var feita = atual.prog.etapasConcluidas.indexOf(e.id) !== -1;
        cont.appendChild(el('li', { class: (feita ? 'feita' : '') + (i === atual.etapaIdx ? ' atual' : ''), title: e.titulo, 'aria-current': i === atual.etapaIdx ? 'step' : null }, [
          el('span', { class: 'sr' }, 'Etapa ' + (i + 1) + (feita ? ' concluída' : '') + ': ' + e.titulo)
        ]));
      });
    },

    renderCriterios: function (resultado) {
      resultado = resultado || {};
      var cont = U.limpar(document.getElementById('criterios'));
      etapaDef().criterios.forEach(function (c) {
        var ok = resultado[c.id] === true || atual.revisao;
        cont.appendChild(el('li', { class: ok ? 'ok' : '' }, [
          el('span', { class: 'marca', 'aria-hidden': 'true' }),
          el('span', null, c.texto),
          el('span', { class: 'sr' }, ok ? ' (atendido)' : ' (ainda não)')
        ]));
      });
    },

    // ------------------------------------------------------- preview
    _renderInfoPreview: function (arquivos) {
      Lab.consolePainel.limpar();
      atual.errosPreview = [];
      document.getElementById('preview-titulo-aba').textContent = '…';
      var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox());
      return motor.molduraPreview.render(arquivos, {
        principal: motor.arquivoPrincipal(), assets: motor._assets(), armazenamento: arm, sessao: atual.armazenamentoSessao
      }).then(function (r) {
        r.doc.naoEncontrados.forEach(function (n) {
          Lab.consolePainel.adicionar('error', 'GET ' + 'https://' + CFG.enderecoSite + '/' + n.resolvido + ' 404 (Not Found)', {
            arquivo: n.arquivo, linha: n.linha,
            simples: 'Em português: o navegador procurou o arquivo de ' + n.tipo + ' "' + n.caminho + '" e ele não existe nesse caminho.'
          });
        });
        if (!r.pronto) {
          Lab.consolePainel.adicionar('error', 'A página não terminou de carregar.', { simples: 'Em português: o código travou o navegador ou demorou demais. Pode ser um laço que nunca termina.' });
        }
        if (r.pronto) {
          document.getElementById('preview-titulo-aba').textContent = r.pronto.titulo || motor.arquivoPrincipal();
          if (Lab.inspetor.ativo) motor.molduraPreview.enviar('inspecionar', true);
        }
        return r;
      });
    },

    _assets: function () {
      var r = {};
      (atual.def.assets || []).forEach(function (k) { if (Lab.assets[k]) r[k] = Lab.assets[k]; });
      return r;
    },

    recarregarPreview: function (manual) {
      if (!atual.def) return Promise.resolve();
      // como um F5 de verdade: recarrega a última versão EXECUTADA (não o que está só no editor)
      var arquivos = (!atual.revisao && estEtapa().ultimoCodigo) || Lab.editor.obterArquivos();
      if (manual) Lab.diario.registrar('execucao', 'Recarregou a página do preview (F5).');
      return motor._renderInfoPreview(arquivos);
    },

    _mensagemPreview: function (tipo, d) {
      var C = Lab.consolePainel;
      if (tipo === 'console') {
        C.adicionar(d.nivel, d.texto, d.onde || {});
      } else if (tipo === 'erro') {
        atual.errosPreview.push(d);
        C.erro(d);
      } else if (tipo === 'recurso') {
        C.adicionar('error', 'Falha ao carregar ' + d.tag + ': "' + d.url + '"', { arquivo: motor.arquivoPrincipal(), linha: d.linha, simples: 'Em português: esse endereço não pôde ser carregado.' });
      } else if (tipo === 'link') {
        var externo = /^(https?:|mailto:|tel:)/i.test(d.href);
        var destino = externo ? d.href : 'https://' + CFG.enderecoSite + '/' + Lab.preview.resolver(motor.arquivoPrincipal(), d.href);
        C.adicionar('lab', '(Laboratório) Este link levaria o visitante para: ' + destino, {
          arquivo: motor.arquivoPrincipal(), linha: d.linha,
          simples: externo ? 'No laboratório o preview não sai da página, mas o endereço é este.' : 'Esse endereço fica DENTRO do próprio site (' + CFG.enderecoSite + '). Se não existir uma página com esse nome, o visitante veria um erro 404.'
        });
      } else if (tipo === 'ancora') {
        C.adicionar('warn', 'O link leva para "#' + d.id + '", mas nenhum elemento tem id="' + d.id + '". A página não se mexe.', { arquivo: motor.arquivoPrincipal(), linha: d.linha });
      } else if (tipo === 'submit') {
        C.adicionar('warn', 'O formulário foi enviado e o navegador RECARREGOU a página. Tudo que estava só na memória se perdeu.', { arquivo: motor.arquivoPrincipal(), linha: d.linha });
        setTimeout(function () { motor._renderInfoPreview(motor.molduraPreview.ultimo.arquivos); }, 400);
      } else if (tipo === 'armazenamento') {
        var t = Lab.estado.turma, id = Lab.estado.aluno.id;
        var arm = Lab.perfis.sandboxLer(t, id, escopoSandbox());
        if (d.op === 'set') arm[d.k] = d.v;
        else if (d.op === 'remove') delete arm[d.k];
        else if (d.op === 'clear') arm = {};
        Lab.perfis.sandboxGravar(t, id, escopoSandbox(), arm);
        motor.renderArmazenamento();
      } else if (tipo === 'sessao') {
        if (d.op === 'set') atual.armazenamentoSessao[d.k] = d.v;
        else if (d.op === 'remove') delete atual.armazenamentoSessao[d.k];
        else atual.armazenamentoSessao = {};
      } else if (tipo === 'titulo') {
        document.getElementById('preview-titulo-aba').textContent = d.titulo || motor.arquivoPrincipal();
      } else if (tipo === 'inspecionado') {
        Lab.inspetor.mostrar(d);
      }
    },

    definirLargura: function (modo) {
      if (modo) motor._largura = modo;
      modo = motor._largura || 'painel';
      var palco = document.getElementById('preview-palco');
      var ifr = document.getElementById('preview-iframe');
      U.$$('#seletor-largura button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-largura') === modo ? 'true' : 'false'); });
      var larguras = { celular: 375, tablet: 768, desktop: 1280 };
      var W = palco.clientWidth, H = palco.clientHeight;
      if (modo === 'painel' || !larguras[modo]) {
        ifr.style.width = '100%'; ifr.style.height = '100%'; ifr.style.transform = ''; ifr.style.left = '0';
        document.getElementById('preview-largura-info').textContent = Math.round(W) + ' px';
        return;
      }
      var w = larguras[modo], s = Math.min(1, W / w);
      ifr.style.width = w + 'px';
      ifr.style.height = (H / s) + 'px';
      ifr.style.transform = s < 1 ? 'scale(' + s + ')' : '';
      ifr.style.left = s < 1 ? '0' : Math.max(0, (W - w) / 2) + 'px';
      document.getElementById('preview-largura-info').textContent = w + ' px' + (s < 1 ? ' (reduzido ' + Math.round(s * 100) + '%)' : '');
    },

    abaInferior: function (nome) {
      U.$$('.bancada-baixo [role=tab]').forEach(function (t) {
        var ativo = t.getAttribute('data-painel') === nome;
        t.setAttribute('aria-selected', ativo ? 'true' : 'false');
        document.getElementById(t.getAttribute('aria-controls')).hidden = !ativo;
      });
      if (nome === 'armazenamento') motor.renderArmazenamento();
      if (nome === 'diario') Lab.diario.renderPainel();
    },

    renderArmazenamento: function () {
      var cont = document.getElementById('tabela-armazenamento');
      if (!cont || !atual.def) return;
      var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox());
      var chaves = Object.keys(arm);
      U.limpar(cont);
      if (!chaves.length) {
        cont.appendChild(el('p', { class: 'vazio' }, 'O localStorage deste site está vazio. Quando o código usar localStorage.setItem(), os dados aparecem aqui — como uma tabela de um banco de dados.'));
        return;
      }
      cont.appendChild(el('table', { class: 'tabela-dados' }, [
        el('thead', null, el('tr', null, [el('th', null, 'Chave'), el('th', null, 'Valor (sempre texto)')])),
        el('tbody', null, chaves.map(function (k) { return el('tr', null, [el('td', null, el('code', null, k)), el('td', null, el('code', null, arm[k]))]); }))
      ]));
    },

    limparDadosSite: function () {
      if (!atual.def) return;
      Lab.ui.confirmar('Limpar dados do site', 'Apaga o localStorage SÓ deste site de treino (como em DevTools → Application → Clear storage). Seu progresso no laboratório não é afetado.', 'Limpar').then(function (ok) {
        if (!ok) return;
        Lab.perfis.sandboxGravar(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox(), {});
        Lab.diario.registrar('execucao', 'Limpou o localStorage do site de treino.');
        motor.renderArmazenamento();
        motor.recarregarPreview(false);
      });
    },

    mostrarArquivos: function () {
      var nomes = atual.def.arquivos.map(function (a) { return a.nome; }).concat(atual.def.assets || []).sort();
      var lista = el('ul', { class: 'arvore' }, nomes.map(function (n) {
        var ehAsset = (atual.def.assets || []).indexOf(n) !== -1;
        return el('li', null, [
          el('code', null, n),
          ehAsset ? el('img', { src: Lab.assets[n], alt: '', class: 'arvore-mini' }) : el('span', { class: 'arvore-tipo' }, 'aba no editor')
        ]);
      }));
      Lab.ui.modal({
        titulo: 'Arquivos do projeto',
        corpo: el('div', null, [
          el('p', null, 'Estes são todos os arquivos do site, com as pastas. Os caminhos que você escreve em href e src são lidos a partir da pasta onde está o ' + motor.arquivoPrincipal() + '. Letras maiúsculas e minúsculas contam.'),
          lista
        ])
      });
    },

    // ======================================================= EXECUTAR
    executar: function () {
      if (atual.ocupado || !atual.def) return;
      if (atual.revisao) { motor._renderInfoPreview(Lab.editor.obterArquivos()); return; }
      var e = etapaDef(), est = estEtapa();
      var arquivos = Lab.editor.obterArquivos();
      salvarCodigo();

      if (est.execucoes > 0 && igualArquivos(arquivos, est.ultimoCodigo)) {
        Lab.ui.aviso('O código está igual ao da última execução. Mude alguma coisa (ou investigue com Inspecionar e o Console) antes de executar de novo.');
        motor._renderInfoPreview(arquivos);
        return;
      }

      var passo = Promise.resolve(true), previsao = null, hipotese = null, mudancas = null;

      if (e.previsao && !est.previsaoFeita) {
        passo = passo.then(function () {
          return motor.pedirPrevisao(e.previsao).then(function (p) { previsao = p; return !!p; });
        });
      } else if (est.precisaHipotese) {
        passo = passo.then(function () {
          return motor.pedirHipotese().then(function (h) { hipotese = h; return !!h; });
        });
      }

      passo = passo.then(function (seguir) {
        if (!seguir) return false;
        if (!est.ultimoCodigo) return true;
        var d = diffArquivos(est.ultimoCodigo, arquivos);
        mudancas = d.total;
        if (d.total > (CFG.limiteLinhasMudadas || 5)) {
          return motor.avisarMudancas(d).then(function (r) {
            if (r === 'voltar') {
              Lab.diario.registrar('diff', 'Recebeu o aviso de ' + d.total + ' linhas mudadas e voltou para mudar menos.');
              Lab.diario.pontuar('metodo', 1, 'voltou para mudar uma coisa por vez', chaveLimite('voltar'), 3);
              if (hipotese) motor._salvarHipotese(hipotese, false);
              est.hipotesePendente = hipotese || est.hipotesePendente || null;
              if (hipotese) est.precisaHipotese = false;
              Lab.estado.salvar();
              return false;
            }
            Lab.diario.registrar('diff', 'Executou com ' + d.total + ' linhas mudadas de uma vez.', { linhas: d.total });
            return true;
          });
        }
        return true;
      });

      return passo.then(function (seguir) {
        if (!seguir) return;
        if (hipotese) motor._salvarHipotese(hipotese, true);
        else if (est.hipotesePendente) { est.tentativasComHipotese++; est.hipotesePendente = null; }
        return motor._rodar(arquivos, previsao, mudancas);
      });
    },

    _salvarHipotese: function (h, conta) {
      var est = estEtapa();
      h.onde = h.onde.replace(/^acho que (o problema|o erro) est[áa] (em|no|na)\s+/i, '');
      h.porque = h.porque.replace(/^porque\s+/i, '');
      var q = qualidadeHipotese(h.onde, h.porque);
      atual.prog.hipoteses.push({ em: Date.now(), etapa: etapaDef().id, onde: h.onde, porque: h.porque, qualidade: q, sessao: Lab.sessao.atual && Lab.sessao.atual.id });
      Lab.sessao.contar('hipoteses');
      Lab.diario.registrar('hipotese', 'Acho que o problema está em ' + h.onde + ' porque ' + h.porque);
      Lab.diario.pontuar('hipoteses', q, 'hipótese registrada', chaveLimite('hip'), 15);
      est.precisaHipotese = false;
      if (conta) est.tentativasComHipotese++;
    },

    _rodar: function (arquivos, previsao, mudancas) {
      var e = etapaDef(), est = estEtapa(), def = atual.def;
      atual.ocupado = true;
      var bt = document.getElementById('bt-executar');
      bt.disabled = true;
      bt.classList.add('rodando');
      document.getElementById('status-execucao').textContent = 'Executando…';

      var anteriorUltimo = est.ultimoCodigo;
      return motor._renderInfoPreview(arquivos).then(function () {
        var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox());
        return Lab.validadores.validar(arquivos, e, { principal: motor.arquivoPrincipal(), assets: motor._assets(), armazenamento: arm });
      }).then(function (res) {
        atual.ocupado = false;
        bt.disabled = false;
        bt.classList.remove('rodando');

        est.execucoes++;
        est.ultimoCodigo = arquivos;
        var resultado = {};
        var falhaValidador = false;
        e.criterios.forEach(function (c) {
          var r = res.checks[c.id];
          resultado[c.id] = !!(r && r.ok);
          if (r && r.falhaValidador) { falhaValidador = true; if (window.console) console.warn('[laboratório] validador', c.id, r.detalhe); }
        });
        est.ultimoResultado = resultado;
        var atendidos = e.criterios.filter(function (c) { return resultado[c.id]; }).length;
        var concluida = !res.travou && atendidos === e.criterios.length;
        var tipos = Lab.validadores.classificar(res, e, atual.errosPreview);
        var detectados = (e.errosPrevistos || []).filter(function (x) { return res.detectores[x.id]; }).map(function (x) { return x.id; });

        // registro da tentativa + snapshot do código
        atual.prog.tentativas.push({
          em: Date.now(), etapa: e.id, sessao: Lab.sessao.atual && Lab.sessao.atual.id, n: est.execucoes,
          atendidos: atendidos, total: e.criterios.length, resolveu: concluida, tiposErro: tipos,
          errosPrevistos: detectados, mudancas: mudancas, errosConsole: atual.errosPreview.map(function (x) { return x.nome + ': ' + x.mensagem; }).slice(0, 5)
        });
        atual.prog.snapshots.push({ em: Date.now(), etapa: e.id, n: est.execucoes, codigo: Lab.editor.obterRegioes() });
        var max = CFG.maxSnapshotsPorMissao || 40;
        if (atual.prog.snapshots.length > max) atual.prog.snapshots.splice(0, atual.prog.snapshots.length - max);
        est.ultimosDetectados = detectados;
        est.ultimosDetalhes = res.detectores;
        Lab.sessao.contar('execucoes');
        Lab.diario.registrar('execucao', 'Execução #' + est.execucoes + ': ' + atendidos + ' de ' + e.criterios.length + ' pedidos do cliente atendidos' +
          (tipos.length ? ' · sinais de erro: ' + tipos.join(', ') : '') + (mudancas !== null && mudancas !== undefined ? ' · ' + mudancas + ' linha(s) mudada(s)' : ''), { tipos: tipos, detectados: detectados });

        if (mudancas && mudancas <= (CFG.limiteLinhasMudadas || 5) && anteriorUltimo) {
          Lab.diario.pontuar('metodo', 1, 'mudança pequena e controlada (' + mudancas + ' linha' + (mudancas > 1 ? 's' : '') + ')', chaveLimite('peq'), 6);
        }

        motor.renderCriterios(resultado);
        document.getElementById('status-execucao').textContent = res.travou ? 'O site travou — veja o Console.' :
          'Execução #' + est.execucoes + ' · ' + atendidos + '/' + e.criterios.length + ' pedidos atendidos';
        if (falhaValidador) Lab.ui.aviso('Um verificador da missão falhou. Avise o professor (detalhes no console do navegador).', 'erro');

        var depois = Promise.resolve();
        if (previsao) {
          est.previsaoFeita = true;
          depois = motor.mostrarComparacao(previsao, res, resultado);
        }
        return depois.then(function () {
          if (concluida) return motor.concluirEtapa();
          est.precisaHipotese = true;
          Lab.estado.salvar();
        });
      }).catch(function (erro) {
        atual.ocupado = false;
        bt.disabled = false;
        bt.classList.remove('rodando');
        document.getElementById('status-execucao').textContent = 'Algo deu errado no laboratório.';
        if (window.console) console.error(erro);
      });
    },

    // ----------------------------------------------------- hipótese
    pedirHipotese: function () {
      var min = CFG.minCaracteresHipotese || 25;
      var onde = el('textarea', { id: 'hip-onde', rows: '2', 'data-foco-inicial': true, placeholder: 'ex.: na linha 14, no <h2> do Cardápio' });
      var porque = el('textarea', { id: 'hip-porque', rows: '3', placeholder: 'ex.: o texto depois dele ficou gigante, então acho que o título não foi fechado' });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      var est = estEtapa();
      var faltam = etapaDef().criterios.filter(function (c) { return !est.ultimoResultado[c.id]; }).map(function (c) { return c.texto; });
      var corpo = el('div', null, [
        el('p', null, 'A última execução ainda não resolveu tudo. Antes de executar de novo, registre o que você está pensando. Não precisa acertar: hipótese é um palpite com motivo.'),
        faltam.length ? el('div', { class: 'caixa-faltam' }, [el('p', { class: 'rotulo-pequeno' }, 'Ainda falta o cliente ver:'), el('ul', null, faltam.map(function (f) { return el('li', null, f); }))]) : null,
        el('label', { for: 'hip-onde', class: 'rotulo' }, 'Acho que o problema está em…'), onde,
        el('label', { for: 'hip-porque', class: 'rotulo' }, '…porque'), porque,
        el('p', { class: 'dica-campo' }, 'Dica: use Inspecionar e o Console para juntar pistas. Citar a linha, a tag ou o seletor ajuda muito.'),
        msg
      ]);
      return Lab.ui.modal({
        titulo: 'Sua hipótese', corpo: corpo, classe: 'modal-hipotese',
        botoes: [
          { texto: 'Voltar a investigar', valor: null },
          {
            texto: 'Registrar e executar', principal: true, antes: function () {
              var o = onde.value.trim(), p = porque.value.trim();
              if (o.length < 4 || p.length < 8 || (o + p).length < min) {
                msg.className = 'msg-campo erro';
                msg.textContent = 'Escreva um pouco mais: onde você acha que está o problema e por quê (pelo menos ' + min + ' letras no total).';
                return false;
              }
              return { onde: o, porque: p };
            }
          }
        ]
      });
    },

    // ------------------------------------------------------ previsão
    pedirPrevisao: function (prev) {
      var campo = el('textarea', { id: 'prev-texto', rows: '4', 'data-foco-inicial': true });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      return Lab.ui.modal({
        titulo: 'Antes de executar: sua previsão',
        classe: 'modal-previsao',
        corpo: el('div', null, [
          el('p', { class: 'pergunta-destaque' }, prev.pergunta),
          el('label', { for: 'prev-texto', class: 'rotulo' }, 'Eu acho que vai acontecer…'), campo, msg,
          el('p', { class: 'dica-campo' }, 'Depois da execução você vai ver lado a lado o que previu e o que aconteceu.')
        ]),
        botoes: [
          { texto: 'Cancelar', valor: null },
          { texto: 'Registrar previsão e executar', principal: true, antes: function () {
            if (campo.value.trim().length < 15) { msg.className = 'msg-campo erro'; msg.textContent = 'Descreva sua previsão com pelo menos uma frase.'; return false; }
            return campo.value.trim();
          } }
        ]
      });
    },

    mostrarComparacao: function (previsao, res, resultado) {
      var e = etapaDef();
      var obs = [];
      if (res.observacao) obs.push(res.observacao);
      if (atual.errosPreview.length) obs.push('O Console mostrou ' + atual.errosPreview.length + ' erro(s).');
      if (res.naoEncontrados && res.naoEncontrados.length) obs.push('O navegador não encontrou: ' + res.naoEncontrados.map(function (n) { return n.caminho; }).join(', ') + '.');
      var atend = e.criterios.filter(function (c) { return resultado[c.id]; }).length;
      obs.push('Pedidos do cliente atendidos: ' + atend + ' de ' + e.criterios.length + '.');
      var observado = obs.join(' ');
      var dif = el('textarea', { id: 'prev-dif', rows: '3' });
      return Lab.ui.modal({
        titulo: 'Previsão × realidade',
        classe: 'modal-largo',
        corpo: el('div', null, [
          el('div', { class: 'lado-a-lado' }, [
            el('div', { class: 'lado' }, [el('h3', null, 'O que você previu'), el('p', null, previsao)]),
            el('div', { class: 'lado real' }, [el('h3', null, 'O que aconteceu'), el('p', null, observado), el('p', { class: 'dica-campo' }, 'Olhe também o preview ao lado: ele é a resposta mais honesta.')])
          ]),
          el('label', { for: 'prev-dif', class: 'rotulo' }, 'O que foi diferente do que você esperava? (opcional)'), dif
        ]),
        botoes: [{ texto: 'Continuar', principal: true, antes: function () { return dif.value.trim(); } }]
      }).then(function (diferenca) {
        atual.prog.previsoes.push({ em: Date.now(), etapa: e.id, previsao: previsao, observado: observado, diferenca: diferenca || '' });
        Lab.sessao.contar('previsoes');
        Lab.diario.registrar('previsao', 'Previu: "' + previsao + '" · Aconteceu: ' + observado);
        Lab.diario.pontuar('reflexao', 2, 'previsão antes de executar', chaveLimite('prev'), 2);
        if (diferenca && diferenca.length > 10) Lab.diario.pontuar('reflexao', 1, 'comparou previsão e realidade', chaveLimite('prevdif'), 1);
      });
    },

    // ------------------------------------------- aviso de "mudou demais"
    avisarMudancas: function (d) {
      var blocos = d.arquivos.map(function (a) {
        var linhas = a.diff.filter(function (x) { return x.tipo !== '='; }).slice(0, 40);
        return el('div', { class: 'diff-arquivo' }, [
          el('p', { class: 'diff-nome' }, a.nome + ' · ' + a.n + ' linha(s)'),
          el('pre', { class: 'diff' }, linhas.map(function (x) {
            return el('span', { class: x.tipo === '+' ? 'mais' : 'menos' }, (x.tipo === '+' ? '+ ' : '− ') + (x.texto || ' ') + '\n');
          }))
        ]);
      });
      return Lab.ui.modal({
        titulo: 'Você mudou ' + d.total + ' linhas de uma vez',
        classe: 'modal-largo',
        corpo: el('div', null, [
          el('p', { class: 'pergunta-destaque' }, 'Se o site melhorar (ou piorar), como você vai saber QUAL dessas mudanças foi a responsável?'),
          el('p', null, 'Programadores experientes mudam uma coisa por vez e executam para ver o efeito. Veja o que mudou desde a última execução:'),
          el('div', null, blocos)
        ]),
        botoes: [
          { texto: 'Executar assim mesmo', valor: 'executar' },
          { texto: 'Voltar e mudar menos', valor: 'voltar', principal: true }
        ]
      }).then(function (v) { return v || 'voltar'; });
    },

    // --------------------------------------------------- inspeção
    registrarInspecao: function (info) {
      if (!atual.def || atual.revisao) return;
      var est = estEtapa();
      est.inspecoes = (est.inspecoes || 0) + 1;
      Lab.diario.registrar('inspecao', 'Inspecionou <' + info.tag + (info.id ? '#' + info.id : '') + (info.classes.length ? '.' + info.classes.join('.') : '') + '>' + (info.linha ? ' (linha ' + info.linha + ' do HTML)' : ''));
      Lab.diario.pontuar('investigacao', 1, 'usou Inspecionar', chaveLimite('insp'), 3);
    },
    registrarConsultaConsole: function () {
      if (!atual.def || atual.revisao) return;
      Lab.diario.pontuar('investigacao', 1, 'seguiu a pista do Console até o código', chaveLimite('cons'), 2);
    },

    // ---------------------------------------------- escada de ajuda
    abrirAjuda: function () {
      if (!atual.def) return;
      if (atual.revisao) { Lab.ui.aviso('Missão concluída: a ajuda fica disponível nas missões em andamento.'); return; }
      var e = etapaDef(), est = estEtapa();
      var precisa = CFG.tentativasParaSolucao || 3;
      // erro previsto detectado na última execução → ajuda contextual
      var det = (est.ultimosDetectados || [])[0];
      var erro = det ? (e.errosPrevistos || []).filter(function (x) { return x.id === det; })[0] : null;
      var dados = erro && est.ultimosDetalhes ? est.ultimosDetalhes[erro.id] : null;
      var evid = erro && erro.evidencia ? preencher(erro.evidencia, dados) : (e.ajuda && e.ajuda.evidencia) || 'Execute o código e observe o preview e o Console.';
      var pista = erro && erro.pista ? preencher(erro.pista, dados) : (e.ajuda && e.ajuda.pista) || '';
      if (!est.execucoes) evid = 'Primeiro execute o código para ver o estado atual do site. ' + ((e.ajuda && e.ajuda.evidencia) || '');

      var cont = el('div', { class: 'escada' });
      function degrau(n, titulo, liberado, motivo, conteudo) {
        var aberto = est.nivelAjuda >= n;
        var d = el('section', { class: 'degrau' + (aberto ? ' aberto' : '') + (liberado ? '' : ' travado') }, [
          el('h3', null, [el('span', { class: 'degrau-n' }, String(n)), titulo])
        ]);
        if (aberto) d.appendChild(conteudo());
        else if (liberado) {
          d.appendChild(el('button', {
            type: 'button', class: 'bt bt-secundario', onclick: function () {
              if (n === 3) { fechar(); motor.mostrarSolucao(); return; }
              motor._usarAjuda(n, n === 1 ? evid : pista);
              atualizarEscada();
            }
          }, 'Mostrar'));
        } else d.appendChild(el('p', { class: 'degrau-motivo' }, motivo));
        return d;
      }
      function atualizarEscada() {
        U.limpar(cont);
        cont.appendChild(el('p', null, 'A ajuda vem em degraus. Cada degrau usado fica registrado no seu diário — e tudo bem usar: o importante é entender.'));
        cont.appendChild(degrau(1, 'Evidência: onde olhar', true, '', function () { return el('p', { class: 'ajuda-texto' }, evid); }));
        cont.appendChild(degrau(2, 'Pista de conceito', est.nivelAjuda >= 1, 'Use primeiro o degrau 1.', function () { return el('p', { class: 'ajuda-texto' }, pista || 'Releia a tarefa e os conceitos da etapa.'); }));
        var podeSolucao = est.nivelAjuda >= 2 && est.tentativasComHipotese >= precisa;
        var motivo3 = est.nivelAjuda < 2 ? 'Use antes os degraus 1 e 2.' : 'Disponível depois de ' + precisa + ' execuções com hipótese nesta etapa (você tem ' + est.tentativasComHipotese + ').';
        cont.appendChild(degrau(3, 'Solução comentada', podeSolucao || est.solucaoVista, motivo3, function () {
          return el('button', { type: 'button', class: 'bt bt-principal', onclick: function () { motor.mostrarSolucao(); } }, 'Ver a solução comentada de novo');
        }));
      }
      atualizarEscada();
      var fechar = function () {};
      Lab.ui.modal({
        titulo: 'Ajuda · ' + e.titulo, corpo: cont, classe: 'modal-ajuda',
        aoAbrir: function (caixa, f) { fechar = function () { f(null); }; }
      });
    },

    _usarAjuda: function (n, texto) {
      var est = estEtapa();
      est.nivelAjuda = Math.max(est.nivelAjuda, n);
      atual.prog.ajudas.push({ em: Date.now(), etapa: etapaDef().id, nivel: n, texto: texto });
      Lab.sessao.contar('ajudas');
      Lab.diario.registrar('ajuda', 'Usou a ajuda nível ' + n + (n === 1 ? ' (evidência)' : ' (pista de conceito)') + ': ' + texto);
    },

    mostrarSolucao: function () {
      var e = etapaDef(), est = estEtapa();
      var sol = e.solucao || { explicacao: 'Sem solução cadastrada.', codigo: '' };
      var primeira = !est.solucaoVista;
      var min = CFG.minCaracteresExplicacao || 40;
      var campo = el('textarea', { id: 'sol-expl', rows: '4', 'data-foco-inicial': true });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      if (primeira) {
        est.nivelAjuda = 3;
        est.solucaoVista = true;
        atual.prog.ajudas.push({ em: Date.now(), etapa: e.id, nivel: 3, texto: 'solução comentada' });
        Lab.sessao.contar('ajudas');
        Lab.diario.registrar('solucao', 'Abriu a solução comentada da etapa.');
      }
      return Lab.ui.modal({
        titulo: 'Solução comentada', classe: 'modal-largo', fecharComEsc: !primeira,
        corpo: el('div', null, [
          el('div', { class: 'solucao-expl', html: sol.explicacao }),
          sol.codigo ? el('pre', { class: 'solucao-codigo' }, sol.codigo) : null,
          el('p', { class: 'dica-campo' }, 'A solução não é colada no seu código: você mesmo faz a mudança no editor.'),
          primeira ? el('div', null, [
            el('label', { for: 'sol-expl', class: 'rotulo' }, 'Antes de seguir: com suas palavras, o que estava errado no seu código e por que isso causava o problema?'),
            campo, msg
          ]) : null
        ]),
        botoes: [primeira ? {
          texto: 'Registrar minha explicação', principal: true, antes: function () {
            if (campo.value.trim().length < min) { msg.className = 'msg-campo erro'; msg.textContent = 'Explique com pelo menos ' + min + ' letras. Pense no que você viu no preview.'; return false; }
            return campo.value.trim();
          }
        } : { texto: 'Fechar', principal: true, valor: null }]
      }).then(function (expl) {
        if (!primeira || !expl) return;
        var reg = atual.prog.ajudas.filter(function (a) { return a.nivel === 3 && a.etapa === e.id; }).pop();
        if (reg) reg.explicacao = expl;
        Lab.diario.registrar('solucao', 'Explicou o erro com as próprias palavras: ' + expl);
        Lab.diario.pontuar('reflexao', 3, 'explicou o erro depois da solução', chaveLimite('expl'), 3);
      });
    },

    // ------------------------------------------- restaurar etapa
    restaurarEtapa: function () {
      if (!atual.def || atual.revisao) return;
      var inicio = atual.prog.inicioEtapa[etapaDef().id];
      Lab.ui.confirmar('Restaurar o código', 'Volta o código para como ele estava no começo desta etapa. As versões que você executou continuam guardadas no diário.', 'Restaurar').then(function (ok) {
        if (!ok) return;
        Lab.editor.definirRegioes(inicio || Lab.editor.regioesOriginais());
        salvarCodigo();
        Lab.diario.registrar('restaurar', 'Restaurou o código do início da etapa.');
      });
    },

    // ------------------------------------------ concluir etapa/missão
    concluirEtapa: function () {
      var def = atual.def, e = etapaDef(), prog = atual.prog;
      if (prog.etapasConcluidas.indexOf(e.id) === -1) prog.etapasConcluidas.push(e.id);
      Lab.sessao.avanco(def.id, e.id, 'etapa');
      Lab.diario.registrar('etapa', 'Concluiu a etapa "' + e.titulo + '".');
      var ultima = atual.etapaIdx === def.etapas.length - 1;
      if (!ultima) {
        atual.etapaIdx++;
        var prox = etapaDef();
        prog.etapaAtual = prox.id;
        prog.inicioEtapa[prox.id] = Lab.editor.obterRegioes();
        // a próxima etapa começa vendo o resultado da anterior (sem hipótese obrigatória)
        estEtapa(prox.id).ultimoCodigo = Lab.editor.obterArquivos();
      }
      Lab.estado.salvar();
      motor.renderPainelEsquerdo();
      var corpo = el('div', { class: 'ponto-salvamento' }, [
        el('p', { class: 'rotulo-pequeno' }, 'Ponto de salvamento'),
        el('div', { class: 'bolha cliente' }, el('p', null, e.aoConcluir || 'Ficou bom!')),
        el('p', null, ultima ? 'Você atendeu todos os pedidos desta missão. Agora vem o Raio-X: veja por dentro como cada parte do site é feita.' : 'Próxima etapa: ' + etapaDef().titulo)
      ]);
      return Lab.ui.modal({
        titulo: 'Etapa concluída: ' + e.titulo, corpo: corpo,
        botoes: [{ texto: ultima ? 'Abrir o Raio-X' : 'Seguir para a próxima etapa', principal: true, valor: true }]
      }).then(function () {
        if (ultima) return Lab.raiox.abrir(def, prog, Lab.editor.obterArquivos());
        motor.renderCriterios({});
        document.getElementById('status-execucao').textContent = 'Nova etapa: leia o pedido do cliente.';
      });
    },

    /** chamado pelo Raio-X depois do insight */
    concluirMissao: function (insight) {
      var def = atual.def, prog = atual.prog;
      prog.insight = insight;
      prog.status = 'concluida';
      prog.concluidaEm = Date.now();
      Lab.sessao.avanco(def.id, null, 'missao');
      Lab.sessao.contar('insights');
      Lab.diario.registrar('insight', insight.pergunta + ' → ' + insight.resposta);
      Lab.diario.pontuar('reflexao', 5, 'respondeu o insight da missão', 'insight:' + def.id, 5);
      Lab.diario.registrar('missao', 'Concluiu a ' + def.titulo + '.');
      Lab.estado.salvar();
      var prox = motor.proximaMissao();
      var corpo = el('div', { class: 'ponto-salvamento' }, [
        el('div', { class: 'bolha cliente' }, el('p', null, def.encerramento || 'Valeu!')),
        el('p', null, prox ? 'Próxima missão: ' + prox.meta.titulo + (prox.situacao === 'em-breve' ? ' (ainda em preparação pelo professor)' : prox.situacao === 'bloqueada-professor' ? ' (o professor vai liberar na hora certa)' : '') : 'Você concluiu todas as missões desta trilha!')
      ]);
      return Lab.ui.modal({ titulo: def.titulo + ' concluída', corpo: corpo, botoes: [{ texto: 'Voltar ao mapa de missões', principal: true, valor: true }] })
        .then(function () { motor.fecharMissao(); Lab.app.mostrarMapa(); });
    }
  };

  Lab.motor = motor;
})();
