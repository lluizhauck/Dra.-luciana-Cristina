/* =====================================================================
   motor.js — o MOTOR das missões (reutilizável para qualquer capítulo)
   Lê as missões como DADOS (missoes/<trilha>/*.js) e conduz o fluxo:
     1. PEDIDO     (tela própria, até 3 balões do cliente)
     2. PREVISÃO   (só nos passos que pedem)
     3. CÓDIGO     (editor + preview)
     4. RESULTADO  (o preview reage; faixa discreta se houver erro)
     5. HIPÓTESE   (obrigatória depois de uma execução que não resolveu)
     6. RAIO-X     (fim da missão, com a pergunta de insight)
   Também cuida do aviso de "mudou demais", da escada de ajuda, dos pontos
   de processo e dos pontos de salvamento.
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
    return nomeM + ' · passo ' + (idx + 1) + ' concluído';
  };

  // ------------------------------------------------------------ estado
  var atual = { def: null, prog: null, etapaIdx: 0, revisao: false, ocupado: false, errosPreview: [], armazenamentoSessao: {} };

  function etapaDef() { return atual.def ? atual.def.etapas[atual.etapaIdx] : null; }
  function estEtapa(id) {
    var p = atual.prog;
    id = id || (etapaDef() && etapaDef().id);
    p.etapas = p.etapas || {};
    if (!p.etapas[id]) p.etapas[id] = { execucoes: 0, tentativasComHipotese: 0, precisaHipotese: false, previsaoFeita: false, previsaoTexto: null, pedidoVisto: false, ultimoCodigo: null, nivelAjuda: 0, solucaoVista: false, ultimoResultado: {} };
    return p.etapas[id];
  }
  function escopoSandbox() { return CFG.trilha + ':' + atual.def.id; }
  function chaveLimite(nome) { return nome + ':' + atual.def.id + ':' + etapaDef().id; }
  function arquivosDoPasso(e) {
    var a = e.arquivo || atual.def.abaInicial || atual.def.principal || 'index.html';
    return Array.isArray(a) ? a : [a];
  }

  function novoProgresso(def) {
    return {
      status: 'em-andamento', iniciadaEm: Date.now(), concluidaEm: null, versaoMissao: def.versao || 1,
      etapaAtual: def.etapas[0].id, etapasConcluidas: [], codigo: null, inicioEtapa: {},
      tempoMs: 0, tentativas: [], hipoteses: [], ajudas: [], previsoes: [], snapshots: [],
      etapas: {}, insight: null, raiox: { vistos: [] }
    };
  }

  // ---------------------------------------------- salvamento automático
  function statusSalvo(texto, classe) {
    var n = document.getElementById('status-salvo');
    if (!n) return;
    n.className = 'status-item ' + (classe || '');
    U.$('.status-salvo-texto', n).textContent = texto;
  }
  function salvarCodigo() {
    if (!atual.prog || atual.revisao) return;
    atual.prog.codigo = Lab.editor.obterRegioes();
    var ok = Lab.estado.salvar();
    statusSalvo(ok === false ? 'Não foi possível salvar' : 'Salvo automaticamente · ' + U.hora(Date.now()), ok === false ? 'erro' : 'ok');
  }
  var salvarCodigoDepois = U.debounce(salvarCodigo, 700);

  function igualArquivos(a, b) {
    if (!a || !b) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) { return a[k] === b[k]; });
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
  function qualidadeHipotese(t) {
    var q = 0;
    if (t.length >= 45) q++;
    if (/linha\s*\d+|<\/?[a-z][a-z0-9]*|[.#][a-z][\w-]*|\b[a-z-]+\s*:|\.(css|html|js)\b|\b(tag|seletor|classe|class|id|propriedade|atributo|caminho|href|src|link|fechamento|abertura)\b/i.test(t)) q++;
    if (/\b(porque|pois|já que|por causa)\b/i.test(t)) q++;
    return Math.max(1, q);
  }

  // ============================================================ MOTOR
  var motor = {
    molduraPreview: null,

    iniciar: function () {
      motor.molduraPreview = new Lab.preview.Moldura(document.getElementById('preview-iframe'), 'preview');
      motor.molduraPreview.aoMensagem = motor._mensagemPreview;
      Lab.validadores.iniciar(document.getElementById('validador-iframe'));
      Lab.editor.aoMudar(function () { statusSalvo('Salvando…', 'salvando'); salvarCodigoDepois(); });

      function ligar(id, fn) { var n = document.getElementById(id); if (n) n.addEventListener('click', fn); }
      ligar('bt-executar', function () { motor.executar(); });
      ligar('bt-recarregar', function () { motor.recarregarPreview(true); });
      ligar('bt-inspecionar', function () { Lab.inspetor.alternar(); });
      ligar('bt-fechar-ficha', function () { Lab.inspetor.fechar(); });
      ligar('bt-ajuda', function () { motor.abrirAjuda(); });
      ligar('bt-pedido', function () { motor.mostrarConversa(); });
      ligar('bt-voltar-mapa', function () { motor.fecharMissao(); Lab.app.mostrarMapa(); });
      ligar('bt-limpar-dados', function () { motor.limparDadosSite(); });
      ligar('bt-detalhes', function () { motor.abrirGaveta('console'); });
      ligar('bt-fechar-faixa', function () { Lab.consolePainel.fecharFaixa(); });
      ligar('bt-fechar-gaveta', function () { document.getElementById('gaveta').hidden = true; });
      ligar('bt-comecar', function () { motor._aposPedido(); });
      ligar('chip-tarefa', function () { motor.alternarChip(); });
      ligar('bt-explicacao', function () { motor.mostrarExplicacao(); });
      document.getElementById('form-previsao').addEventListener('submit', function (ev) { ev.preventDefault(); motor._salvarPrevisao(); });
      U.$$('#seletor-largura button').forEach(function (b) {
        b.addEventListener('click', function () { motor.definirLargura(b.getAttribute('data-largura')); });
      });
      U.$$('.gaveta-abas [role=tab]').forEach(function (t) {
        t.addEventListener('click', function () { motor.abrirGaveta(t.getAttribute('data-painel')); });
      });
      document.addEventListener('keydown', function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter' && document.body.getAttribute('data-tela') === 'tela-bancada' && document.getElementById('camada-modal').hidden) {
          ev.preventDefault();
          motor.executar();
        }
      });
      // recolhe o chip ao clicar fora
      document.addEventListener('pointerdown', function (ev) {
        var p = document.getElementById('chip-painel');
        if (!p.hidden && !ev.target.closest('.faixa-tarefa')) motor.alternarChip(false);
      });
      window.addEventListener('resize', U.debounce(function () { motor.definirLargura(); }, 150));
      motor._divisor();
      setInterval(motor._relogio, 15000);
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
    abrirMissao: function (id) {
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
      var idx = def.etapas.map(function (e) { return e.id; }).indexOf(prog.etapaAtual);
      if (idx === -1) {
        idx = def.etapas.findIndex(function (e) { return prog.etapasConcluidas.indexOf(e.id) === -1; });
        if (idx === -1) idx = def.etapas.length - 1;
        prog.etapaAtual = def.etapas[idx].id;
      }
      atual.etapaIdx = idx;

      Lab.editor.carregar(def.arquivos, prog.codigo, { visiveis: atual.revisao ? def.arquivos.map(function (a) { return a.nome; }) : arquivosDoPasso(etapaDef()) });
      if (!prog.codigo) prog.codigo = Lab.editor.obterRegioes();
      if (!prog.inicioEtapa[prog.etapaAtual]) prog.inicioEtapa[prog.etapaAtual] = U.clone(prog.codigo);
      if (nova) Lab.diario.registrar('sessao', 'Começou a ' + def.titulo);
      Lab.estado.salvar();

      if (!atual.revisao && !estEtapa().pedidoVisto) return motor.mostrarPedido();
      if (!atual.revisao && etapaDef().previsao && !estEtapa().previsaoFeita && !estEtapa().previsaoTexto) return motor.mostrarPrevisao();
      motor._entrarBancada();
    },

    _entrarBancada: function () {
      var def = atual.def;
      Lab.inspetor.alternar(false);
      document.getElementById('bancada-titulo').textContent = 'Missão ' + def.numero + ' · ' + def.titulo;
      document.getElementById('banner-revisao').hidden = !atual.revisao;
      document.getElementById('gaveta').hidden = true;
      motor.renderPassos();
      motor.renderCriterios(estEtapa().ultimoResultado);
      motor.alternarChip(false);
      Lab.consolePainel.limpar();
      motor.renderArmazenamento();
      statusSalvo('Salvo automaticamente', 'ok');
      document.getElementById('status-execucao').textContent = '';
      Lab.ui.mostrarTela('tela-bancada');
      Lab.ui.atualizarPontos();
      motor._relogio();
      motor.definirLargura(motor._largura || 'painel');
      motor.recarregarPreview(false);
      setTimeout(function () { Lab.editor.focar(); }, 60);
    },

    fecharMissao: function () {
      if (atual.def && !atual.revisao) salvarCodigo();
      Lab.inspetor.alternar(false);
      atual.def = null;
      atual.prog = null;
    },

    // ---------------------------------------------------- 1. PEDIDO
    _mensagensDoPasso: function (idx) {
      var def = atual.def, e = def.etapas[idx];
      var msgs = [];
      if (idx === 0 && def.abertura && def.abertura.length) msgs.push(def.abertura[0]);
      else if (idx > 0 && def.etapas[idx - 1].aoConcluir) msgs.push(def.etapas[idx - 1].aoConcluir);
      return msgs.concat(e.mensagens || []).slice(0, 3);
    },
    _balao: function (texto, atraso) {
      var b = el('div', { class: 'balao' }, [el('p', null, texto), el('span', { class: 'balao-hora' }, U.hora(Date.now()))]);
      if (atraso) b.style.animationDelay = atraso + 'ms';
      return b;
    },
    mostrarPedido: function () {
      var def = atual.def, idx = atual.etapaIdx;
      document.getElementById('pedido-sobre').textContent = 'Missão ' + def.numero + ' · Passo ' + (idx + 1) + ' de ' + def.etapas.length;
      document.getElementById('pedido-nome').textContent = def.cliente.nome + ' · ' + def.cliente.negocio.split('·')[0].trim();
      document.getElementById('pedido-avatar').textContent = def.cliente.iniciais || def.cliente.nome.slice(0, 2).toUpperCase();
      var cont = U.limpar(document.getElementById('pedido-baloes'));
      motor._mensagensDoPasso(idx).forEach(function (m, i) { cont.appendChild(motor._balao(m, i * 180)); });
      document.getElementById('bt-comecar').textContent = idx === 0 ? 'Começar a missão' : 'Começar o passo ' + (idx + 1);
      Lab.ui.mostrarTela('tela-pedido');
    },
    _aposPedido: function () {
      var est = estEtapa();
      est.pedidoVisto = true;
      Lab.estado.salvar();
      if (etapaDef().previsao && !est.previsaoFeita && !est.previsaoTexto) return motor.mostrarPrevisao();
      motor._entrarBancada();
    },
    /** botão "Pedido" da barra: a conversa inteira até aqui */
    mostrarConversa: function () {
      var def = atual.def;
      var cont = el('div', { class: 'whats-conversa no-modal' });
      (def.abertura || []).forEach(function (m) { cont.appendChild(motor._balao(m)); });
      def.etapas.forEach(function (e, i) {
        if (i > atual.etapaIdx && !atual.revisao) return;
        (e.mensagens || []).forEach(function (m) { cont.appendChild(motor._balao(m)); });
        if (atual.prog.etapasConcluidas.indexOf(e.id) !== -1) {
          cont.appendChild(el('div', { class: 'marco' }, 'Passo ' + (i + 1) + ' entregue'));
          if (e.aoConcluir) cont.appendChild(motor._balao(e.aoConcluir));
        }
      });
      Lab.ui.modal({ titulo: def.cliente.nome, corpo: cont, classe: 'modal-conversa', aoAbrir: function () { cont.scrollTop = cont.scrollHeight; } });
    },

    // --------------------------------------------------- 2. PREVISÃO
    mostrarPrevisao: function () {
      document.getElementById('previsao-pergunta').textContent = etapaDef().previsao.pergunta;
      document.getElementById('previsao-texto').value = '';
      document.getElementById('msg-previsao').textContent = '';
      Lab.ui.mostrarTela('tela-previsao');
    },
    _salvarPrevisao: function () {
      var t = document.getElementById('previsao-texto').value.trim();
      var msg = document.getElementById('msg-previsao');
      if (t.length < 15) { msg.className = 'msg-campo erro'; msg.textContent = 'Escreva sua previsão em pelo menos uma frase.'; return; }
      estEtapa().previsaoTexto = t;
      Lab.diario.registrar('previsao', 'Previsão registrada: "' + t + '"');
      Lab.estado.salvar();
      motor._entrarBancada();
    },

    // ------------------------------------------------- barra e chip
    renderPassos: function () {
      var cont = U.limpar(document.getElementById('passos'));
      atual.def.etapas.forEach(function (e, i) {
        var feita = atual.prog.etapasConcluidas.indexOf(e.id) !== -1 || atual.revisao;
        cont.appendChild(el('li', { class: (feita ? 'feito' : '') + (i === atual.etapaIdx && !atual.revisao ? ' atual' : '') }));
      });
      document.getElementById('passos-texto').textContent = atual.revisao ? 'Concluída' : 'Passo ' + (atual.etapaIdx + 1) + ' de ' + atual.def.etapas.length;
    },

    /** itens do checklist (no máximo 3). Cada item pode agrupar vários critérios. */
    _checklist: function (e) {
      if (e.checklist) return e.checklist.slice(0, 3);
      return e.criterios.slice(0, 3).map(function (c) { return { texto: c.texto, criterios: [c.id] }; });
    },
    renderCriterios: function (resultado) {
      resultado = resultado || {};
      var e = etapaDef();
      var itens = motor._checklist(e);
      var feitos = 0;
      var cont = U.limpar(document.getElementById('criterios'));
      itens.forEach(function (it) {
        var ok = atual.revisao || it.criterios.every(function (id) { return resultado[id] === true; });
        if (ok) feitos++;
        cont.appendChild(el('li', { class: ok ? 'ok' : '' }, [
          el('span', { class: 'marca', 'aria-hidden': 'true', html: ok ? Lab.icone('check') : '' }),
          el('span', null, it.texto),
          el('span', { class: 'sr' }, ok ? ' (feito)' : ' (pendente)')
        ]));
      });
      document.getElementById('chip-texto').textContent = e.resumo || e.titulo;
      document.getElementById('chip-contagem').textContent = feitos + '/' + itens.length;
      document.getElementById('chip-tarefa').classList.toggle('completo', feitos === itens.length);
    },
    alternarChip: function (forcar) {
      var p = document.getElementById('chip-painel');
      var abrir = typeof forcar === 'boolean' ? forcar : p.hidden;
      p.hidden = !abrir;
      document.getElementById('chip-tarefa').setAttribute('aria-expanded', abrir ? 'true' : 'false');
    },
    mostrarExplicacao: function () {
      var e = etapaDef();
      motor.alternarChip(false);
      Lab.ui.modal({
        titulo: e.titulo, classe: 'modal-explicacao',
        corpo: el('div', null, [
          el('div', { class: 'texto-tarefa', html: e.tarefa }),
          e.conceitos && e.conceitos.length ? el('ul', { class: 'conceitos' }, e.conceitos.map(function (c) { return el('li', null, c); })) : null
        ])
      });
    },

    // ------------------------------------------------------- preview
    _assets: function () {
      var r = {};
      (atual.def.assets || []).forEach(function (k) { if (Lab.assets[k]) r[k] = Lab.assets[k]; });
      return r;
    },
    _renderInfoPreview: function (arquivos) {
      Lab.consolePainel.limpar();
      atual.errosPreview = [];
      document.getElementById('preview-titulo-aba').textContent = '…';
      document.getElementById('preview-palco').classList.add('carregando');
      var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox());
      return motor.molduraPreview.render(arquivos, {
        principal: motor.arquivoPrincipal(), assets: motor._assets(), armazenamento: arm, sessao: atual.armazenamentoSessao
      }).then(function (r) {
        document.getElementById('preview-palco').classList.remove('carregando');
        r.doc.naoEncontrados.forEach(function (n) {
          Lab.consolePainel.adicionar('error', 'GET https://' + CFG.enderecoSite + '/' + n.resolvido + ' 404 (Not Found)', {
            arquivo: n.arquivo, linha: n.linha,
            simples: 'O navegador procurou o arquivo de ' + n.tipo + ' "' + n.caminho + '" e ele não existe nesse caminho.'
          });
        });
        if (!r.pronto) Lab.consolePainel.adicionar('error', 'A página não terminou de carregar.', { simples: 'O código travou o navegador ou demorou demais. Pode ser um laço que nunca termina.' });
        else {
          document.getElementById('preview-titulo-aba').textContent = r.pronto.titulo || motor.arquivoPrincipal();
          if (Lab.inspetor.ativo) motor.molduraPreview.enviar('inspecionar', true);
        }
        return r;
      });
    },
    recarregarPreview: function (manual) {
      if (!atual.def) return Promise.resolve();
      // como um F5 de verdade: recarrega a última versão EXECUTADA
      var arquivos = (!atual.revisao && estEtapa().ultimoCodigo) || Lab.editor.obterArquivos();
      if (manual) Lab.diario.registrar('execucao', 'Recarregou a página do preview (F5).');
      return motor._renderInfoPreview(arquivos);
    },

    _mensagemPreview: function (tipo, d) {
      var C = Lab.consolePainel;
      if (tipo === 'console') C.adicionar(d.nivel, d.texto, d.onde || {});
      else if (tipo === 'erro') { atual.errosPreview.push(d); C.erro(d); if (d.arquivo && d.linha) Lab.editor.marcarErros(motor._errosParaEditor()); }
      else if (tipo === 'recurso') C.adicionar('error', 'Falha ao carregar ' + d.tag + ': "' + d.url + '"', { arquivo: motor.arquivoPrincipal(), linha: d.linha, simples: 'Esse endereço não pôde ser carregado.' });
      else if (tipo === 'link') {
        var externo = /^(https?:|mailto:|tel:)/i.test(d.href);
        var destino = externo ? d.href : 'https://' + CFG.enderecoSite + '/' + Lab.preview.resolver(motor.arquivoPrincipal(), d.href);
        C.adicionar('lab', 'Este link levaria o visitante para: ' + destino, {
          arquivo: motor.arquivoPrincipal(), linha: d.linha,
          simples: externo ? 'No laboratório o preview não sai da página, mas o endereço é este.' : 'Esse endereço fica DENTRO do próprio site. Se não existir uma página com esse nome, o visitante veria um erro 404.'
        });
        Lab.ui.aviso('Link → ' + destino);
      } else if (tipo === 'ancora') C.adicionar('warn', 'O link leva para "#' + d.id + '", mas nenhum elemento tem id="' + d.id + '". A página não se mexe.', { arquivo: motor.arquivoPrincipal(), linha: d.linha, simples: 'O link procura id="' + d.id + '" e não encontra.' });
      else if (tipo === 'submit') {
        C.adicionar('warn', 'O formulário foi enviado e o navegador RECARREGOU a página.', { arquivo: motor.arquivoPrincipal(), linha: d.linha, simples: 'A página recarregou: tudo o que estava só na memória se perdeu.' });
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
      } else if (tipo === 'titulo') document.getElementById('preview-titulo-aba').textContent = d.titulo || motor.arquivoPrincipal();
      else if (tipo === 'inspecionado') Lab.inspetor.mostrar(d);
    },

    _errosParaEditor: function (extras) {
      return atual.errosPreview.filter(function (e) { return e.arquivo && e.linha; })
        .map(function (e) { return { arquivo: e.arquivo, linha: e.linha, mensagem: e.mensagem }; })
        .concat(extras || []);
    },

    definirLargura: function (modo) {
      if (modo) motor._largura = modo;
      modo = motor._largura || 'painel';
      var palco = document.getElementById('preview-palco');
      var ifr = document.getElementById('preview-iframe');
      var info = document.getElementById('preview-largura-info');
      U.$$('#seletor-largura button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-largura') === modo ? 'true' : 'false'); });
      var larguras = { celular: 375, tablet: 768, desktop: 1280 };
      var W = palco.clientWidth, H = palco.clientHeight;
      if (!larguras[modo]) {
        ifr.style.width = '100%'; ifr.style.height = '100%'; ifr.style.transform = ''; ifr.style.left = '0';
        info.textContent = Math.round(W) + ' px';
        return;
      }
      var w = larguras[modo], s = Math.min(1, W / w);
      ifr.style.width = w + 'px';
      ifr.style.height = (H / s) + 'px';
      ifr.style.transform = s < 1 ? 'scale(' + s + ')' : '';
      ifr.style.left = s < 1 ? '0' : Math.max(0, (W - w) / 2) + 'px';
      info.textContent = w + ' px' + (s < 1 ? ' · ' + Math.round(s * 100) + '%' : '');
    },

    /** divisória arrastável entre editor e preview (lembrada por aluno neste navegador) */
    _divisor: function () {
      var area = document.getElementById('area-trabalho');
      var div = document.getElementById('divisor');
      var salvo = null;
      try { salvo = parseFloat(window.localStorage.getItem('lab:v1:ui:divisor')); } catch (e) { salvo = null; }
      function aplicar(p) {
        p = Math.min(75, Math.max(25, p));
        area.style.setProperty('--divisao', p + '%');
        return p;
      }
      if (salvo) aplicar(salvo);
      var arrastando = false, atualP = salvo || 50;
      div.addEventListener('pointerdown', function (ev) {
        arrastando = true;
        div.setPointerCapture(ev.pointerId);
        area.classList.add('arrastando');
      });
      div.addEventListener('pointermove', function (ev) {
        if (!arrastando) return;
        var r = area.getBoundingClientRect();
        atualP = aplicar((ev.clientX - r.left) / r.width * 100);
      });
      function soltar() {
        if (!arrastando) return;
        arrastando = false;
        area.classList.remove('arrastando');
        try { window.localStorage.setItem('lab:v1:ui:divisor', String(atualP)); } catch (e) { /* ok */ }
        motor.definirLargura();
      }
      div.addEventListener('pointerup', soltar);
      div.addEventListener('pointercancel', soltar);
      div.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
          ev.preventDefault();
          atualP = aplicar(atualP + (ev.key === 'ArrowLeft' ? -5 : 5));
          try { window.localStorage.setItem('lab:v1:ui:divisor', String(atualP)); } catch (e) { /* ok */ }
          motor.definirLargura();
        }
      });
    },

    _relogio: function () {
      var n = document.getElementById('status-tempo');
      var s = Lab.sessao.atual;
      if (!n || !s) return;
      var min = Math.floor((Date.now() - s.inicio) / 60000);
      n.textContent = min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
    },

    abrirGaveta: function (nome) {
      document.getElementById('gaveta').hidden = false;
      U.$$('.gaveta-abas [role=tab]').forEach(function (t) {
        var ativo = t.getAttribute('data-painel') === nome;
        t.setAttribute('aria-selected', ativo ? 'true' : 'false');
        document.getElementById(t.getAttribute('aria-controls')).hidden = !ativo;
      });
      if (nome === 'armazenamento') motor.renderArmazenamento();
    },

    renderArmazenamento: function () {
      var cont = document.getElementById('tabela-armazenamento');
      if (!cont || !atual.def) return;
      var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox());
      var chaves = Object.keys(arm);
      U.limpar(cont);
      if (!chaves.length) {
        cont.appendChild(el('p', { class: 'vazio' }, 'Vazio. Quando o código usar localStorage.setItem(), os dados aparecem aqui, como numa tabela de banco de dados.'));
        return;
      }
      cont.appendChild(el('table', { class: 'tabela-dados' }, [
        el('thead', null, el('tr', null, [el('th', null, 'Chave'), el('th', null, 'Valor (sempre texto)')])),
        el('tbody', null, chaves.map(function (k) { return el('tr', null, [el('td', null, el('code', null, k)), el('td', null, el('code', null, arm[k]))]); }))
      ]));
    },

    limparDadosSite: function () {
      if (!atual.def) return;
      Lab.ui.confirmar('Limpar dados do site', 'Apaga o localStorage só deste site de treino. Seu progresso no laboratório não muda.', 'Limpar').then(function (ok) {
        if (!ok) return;
        Lab.perfis.sandboxGravar(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox(), {});
        Lab.diario.registrar('execucao', 'Limpou o localStorage do site de treino.');
        motor.renderArmazenamento();
        motor.recarregarPreview(false);
      });
    },

    // ======================================================= EXECUTAR
    executar: function () {
      if (atual.ocupado || !atual.def) return;
      if (atual.revisao) { motor._renderInfoPreview(Lab.editor.obterArquivos()); return; }
      var e = etapaDef(), est = estEtapa();
      var arquivos = Lab.editor.obterArquivos();
      salvarCodigo();
      motor.alternarChip(false);

      if (est.execucoes > 0 && igualArquivos(arquivos, est.ultimoCodigo)) {
        Lab.ui.aviso('O código está igual ao da última execução. Mude alguma coisa antes de executar de novo.');
        motor._renderInfoPreview(arquivos);
        return;
      }

      var passo = Promise.resolve(true), previsao = null, hipotese = null, mudancas = null;
      if (e.previsao && !est.previsaoFeita) {
        previsao = est.previsaoTexto;
        if (!previsao) passo = motor.pedirPrevisaoModal(e.previsao).then(function (p) { previsao = p; return !!p; });
      } else if (est.precisaHipotese) {
        passo = motor.pedirHipotese().then(function (h) { hipotese = h; return !!h; });
      }

      passo = passo.then(function (seguir) {
        if (!seguir) return false;
        if (!est.ultimoCodigo) return true;
        var d = diffArquivos(est.ultimoCodigo, arquivos);
        mudancas = d.total;
        if (d.total <= (CFG.limiteLinhasMudadas || 5)) return true;
        return motor.avisarMudancas(d).then(function (r) {
          if (r === 'voltar') {
            Lab.diario.registrar('diff', 'Recebeu o aviso de ' + d.total + ' linhas mudadas e voltou para mudar menos.');
            Lab.diario.pontuar('metodo', 1, 'voltou para mudar uma coisa por vez', chaveLimite('voltar'), 3);
            if (hipotese) { motor._salvarHipotese(hipotese, false); est.hipotesePendente = true; }
            Lab.estado.salvar();
            return false;
          }
          Lab.diario.registrar('diff', 'Executou com ' + d.total + ' linhas mudadas de uma vez.', { linhas: d.total });
          return true;
        });
      });

      return passo.then(function (seguir) {
        if (!seguir) return;
        if (hipotese) motor._salvarHipotese(hipotese, true);
        else if (est.hipotesePendente) { est.tentativasComHipotese++; est.hipotesePendente = false; }
        return motor._rodar(arquivos, previsao, mudancas);
      });
    },

    _salvarHipotese: function (texto, conta) {
      var est = estEtapa();
      var q = qualidadeHipotese(texto);
      atual.prog.hipoteses.push({ em: Date.now(), etapa: etapaDef().id, texto: texto, qualidade: q, sessao: Lab.sessao.atual && Lab.sessao.atual.id });
      Lab.sessao.contar('hipoteses');
      Lab.diario.registrar('hipotese', texto);
      Lab.diario.pontuar('hipoteses', q, 'hipótese registrada', chaveLimite('hip'), 15);
      est.precisaHipotese = false;
      if (conta) est.tentativasComHipotese++;
    },

    _rodar: function (arquivos, previsao, mudancas) {
      var e = etapaDef(), est = estEtapa();
      atual.ocupado = true;
      var bt = document.getElementById('bt-executar');
      bt.disabled = true;
      bt.classList.add('rodando');
      U.$('.bt-executar-texto', bt).textContent = 'Executando';
      Lab.editor.marcarErros([]);
      document.getElementById('gaveta').hidden = true;

      var anteriorUltimo = est.ultimoCodigo;
      function liberar() {
        atual.ocupado = false;
        bt.disabled = false;
        bt.classList.remove('rodando');
        U.$('.bt-executar-texto', bt).textContent = 'Executar';
      }
      return motor._renderInfoPreview(arquivos).then(function () {
        var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, escopoSandbox());
        return Lab.validadores.validar(arquivos, e, { principal: motor.arquivoPrincipal(), assets: motor._assets(), armazenamento: arm });
      }).then(function (res) {
        liberar();
        bt.classList.add('confirmado');
        setTimeout(function () { bt.classList.remove('confirmado'); }, 600);

        est.execucoes++;
        est.ultimoCodigo = arquivos;
        var resultado = {}, falhaValidador = false;
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

        // sublinha no editor as linhas apontadas por erros (console e erros previstos com linha)
        var extras = [];
        // erros PREVISTOS não são sublinhados (seria entregar a resposta): eles aparecem só na escada de ajuda
        (res.naoEncontrados || []).forEach(function (n) { extras.push({ arquivo: n.arquivo, linha: n.linha, mensagem: 'Arquivo não encontrado: ' + n.caminho }); });
        Lab.editor.marcarErros(motor._errosParaEditor(extras));

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
        Lab.diario.registrar('execucao', 'Execução #' + est.execucoes + ': ' + atendidos + ' de ' + e.criterios.length + ' pedidos atendidos' +
          (tipos.length ? ' · sinais de erro: ' + tipos.join(', ') : '') + (mudancas !== null ? ' · ' + mudancas + ' linha(s) mudada(s)' : ''), { tipos: tipos, detectados: detectados });
        if (mudancas && mudancas <= (CFG.limiteLinhasMudadas || 5) && anteriorUltimo) {
          Lab.diario.pontuar('metodo', 1, 'mudança pequena e controlada', chaveLimite('peq'), 6);
        }

        motor.renderCriterios(resultado);
        document.getElementById('status-execucao').textContent = res.travou ? 'O site travou' : 'Execução ' + est.execucoes;
        if (falhaValidador) Lab.ui.aviso('Um verificador da missão falhou. Avise o professor.', 'erro');

        var depois = Promise.resolve();
        if (previsao) {
          est.previsaoFeita = true;
          depois = motor.mostrarComparacao(previsao, res, resultado);
        }
        return depois.then(function () {
          if (concluida) return motor.concluirEtapa();
          est.precisaHipotese = true;
          Lab.estado.salvar();
          if (!Lab.consolePainel.principal()) {
            // sem erro no Console: o preview é a evidência; mostra o checklist por um instante
            motor.alternarChip(true);
          }
        });
      }).catch(function (erro) {
        liberar();
        document.getElementById('status-execucao').textContent = 'Algo deu errado no laboratório';
        if (window.console) console.error(erro);
      });
    },

    // ----------------------------------------------------- 5. HIPÓTESE
    pedirHipotese: function () {
      var min = CFG.minCaracteresHipotese || 25;
      var campo = el('textarea', { id: 'hip-texto', rows: '3', 'data-foco-inicial': true, placeholder: 'Acho que o erro está em… porque…' });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      return Lab.ui.modal({
        titulo: 'Sua hipótese', classe: 'modal-pequeno',
        corpo: el('div', null, [el('label', { for: 'hip-texto', class: 'sr' }, 'Sua hipótese'), campo, msg]),
        botoes: [{
          texto: 'Registrar e executar', principal: true, antes: function () {
            var t = campo.value.trim();
            if (t.length < min) { msg.className = 'msg-campo erro'; msg.textContent = 'Diga onde acha que está o erro e por quê (pelo menos ' + min + ' letras).'; return false; }
            return t;
          }
        }]
      });
    },

    /** previsão em janela (só se o aluno pulou a tela de previsão) */
    pedirPrevisaoModal: function (prev) {
      var campo = el('textarea', { id: 'prev-texto', rows: '3', 'data-foco-inicial': true, placeholder: 'Eu acho que vai acontecer…' });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      return Lab.ui.modal({
        titulo: 'Sua previsão', classe: 'modal-pequeno',
        corpo: el('div', null, [el('p', { class: 'pergunta' }, prev.pergunta), campo, msg]),
        botoes: [{ texto: 'Registrar e executar', principal: true, antes: function () {
          if (campo.value.trim().length < 15) { msg.className = 'msg-campo erro'; msg.textContent = 'Escreva pelo menos uma frase.'; return false; }
          return campo.value.trim();
        } }]
      });
    },

    mostrarComparacao: function (previsao, res, resultado) {
      var e = etapaDef();
      var obs = [];
      if (res.observacao) obs.push(res.observacao);
      if (atual.errosPreview.length) obs.push('O Console mostrou ' + atual.errosPreview.length + ' erro(s).');
      if (res.naoEncontrados && res.naoEncontrados.length) obs.push('O navegador não encontrou: ' + res.naoEncontrados.map(function (n) { return n.caminho; }).join(', ') + '.');
      var observado = obs.join(' ') || 'Olhe o preview: ele mostra o que aconteceu.';
      var dif = el('textarea', { id: 'prev-dif', rows: '2', placeholder: 'O que foi diferente do que você esperava? (opcional)' });
      return Lab.ui.modal({
        titulo: 'Previsão × realidade', classe: 'modal-medio',
        corpo: el('div', null, [
          el('div', { class: 'lado-a-lado' }, [
            el('div', { class: 'lado' }, [el('p', { class: 'sobretitulo' }, 'Você previu'), el('p', null, previsao)]),
            el('div', { class: 'lado real' }, [el('p', { class: 'sobretitulo' }, 'Aconteceu'), el('p', null, observado)])
          ]),
          el('label', { for: 'prev-dif', class: 'sr' }, 'Diferença'), dif
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
        titulo: 'Você mudou ' + d.total + ' linhas de uma vez', classe: 'modal-medio',
        corpo: el('div', null, [
          el('p', { class: 'pergunta' }, 'Se o site mudar, como você vai saber qual dessas mudanças foi a responsável?'),
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
    /** mostra UM nível por vez, na ordem: evidência → pista → solução comentada */
    abrirAjuda: function () {
      if (!atual.def) return;
      if (atual.revisao) { Lab.ui.aviso('Missão concluída: a ajuda fica disponível nas missões em andamento.'); return; }
      var e = etapaDef(), est = estEtapa();
      var precisa = CFG.tentativasParaSolucao || 3;
      var det = (est.ultimosDetectados || [])[0];
      var erro = det ? (e.errosPrevistos || []).filter(function (x) { return x.id === det; })[0] : null;
      var dados = erro && est.ultimosDetalhes ? est.ultimosDetalhes[erro.id] : null;
      var evid = erro && erro.evidencia ? preencher(erro.evidencia, dados) : (e.ajuda && e.ajuda.evidencia) || 'Execute o código e observe o preview.';
      var pista = erro && erro.pista ? preencher(erro.pista, dados) : (e.ajuda && e.ajuda.pista) || 'Releia a explicação do passo.';
      if (!est.execucoes) evid = 'Primeiro clique em Executar para ver como o site está agora. ' + ((e.ajuda && e.ajuda.evidencia) || '');

      var nivel = Math.max(1, Math.min(est.nivelAjuda + (est.nivelAjuda === 0 ? 1 : 0), 2));
      if (est.nivelAjuda === 0) motor._usarAjuda(1, evid);
      var titulos = { 1: 'Onde olhar', 2: 'Pista' };
      var textos = { 1: evid, 2: pista };
      var podeSolucao = est.tentativasComHipotese >= precisa;

      var cont = el('div', { class: 'ajuda' });
      function render() {
        U.limpar(cont);
        cont.appendChild(el('ol', { class: 'ajuda-degraus', 'aria-label': 'Níveis de ajuda' }, [1, 2, 3].map(function (n) {
          return el('li', { class: n < nivel ? 'feito' : n === nivel ? 'atual' : '' }, n === 3 ? 'Solução' : titulos[n]);
        })));
        cont.appendChild(el('p', { class: 'ajuda-texto' }, textos[nivel]));
      }
      render();
      var botoes = [];
      if (nivel === 1) botoes.push({ texto: 'Preciso de mais ajuda', valor: 'mais' });
      else if (podeSolucao || est.solucaoVista) botoes.push({ texto: 'Ver a solução comentada', valor: 'solucao' });
      botoes.push({ texto: 'Restaurar código do passo', valor: 'restaurar', classe: 'bt-discreto' });
      botoes.push({ texto: 'Entendi', valor: null, principal: true });
      var nota = nivel === 2 && !podeSolucao && !est.solucaoVista ? el('p', { class: 'nota' }, 'A solução comentada abre depois de ' + precisa + ' execuções com hipótese neste passo (você tem ' + est.tentativasComHipotese + ').') : null;
      if (nota) cont.appendChild(nota);

      Lab.ui.modal({ titulo: 'Ajuda', corpo: cont, classe: 'modal-pequeno', botoes: botoes }).then(function (v) {
        if (v === 'mais') { motor._usarAjuda(2, pista); motor.abrirAjuda(); }
        else if (v === 'solucao') motor.mostrarSolucao();
        else if (v === 'restaurar') motor.restaurarEtapa();
      });
    },

    _usarAjuda: function (n, texto) {
      var est = estEtapa();
      if (est.nivelAjuda >= n) return;
      est.nivelAjuda = n;
      atual.prog.ajudas.push({ em: Date.now(), etapa: etapaDef().id, nivel: n, texto: texto });
      Lab.sessao.contar('ajudas');
      Lab.diario.registrar('ajuda', 'Ajuda nível ' + n + (n === 1 ? ' (onde olhar)' : ' (pista)') + ': ' + texto);
      Lab.estado.salvar();
    },

    mostrarSolucao: function () {
      var e = etapaDef(), est = estEtapa();
      var sol = e.solucao || { explicacao: 'Sem solução cadastrada.', codigo: '' };
      var primeira = !est.solucaoVista;
      var min = CFG.minCaracteresExplicacao || 40;
      var campo = el('textarea', { id: 'sol-expl', rows: '3', 'data-foco-inicial': true, placeholder: 'Com suas palavras: o que estava errado e por que causava o problema?' });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      if (primeira) {
        est.nivelAjuda = 3;
        est.solucaoVista = true;
        atual.prog.ajudas.push({ em: Date.now(), etapa: e.id, nivel: 3, texto: 'solução comentada' });
        Lab.sessao.contar('ajudas');
        Lab.diario.registrar('solucao', 'Abriu a solução comentada do passo.');
      }
      return Lab.ui.modal({
        titulo: 'Solução comentada', classe: 'modal-medio', fecharComEsc: !primeira,
        corpo: el('div', null, [
          el('div', { class: 'solucao-expl', html: sol.explicacao }),
          sol.codigo ? el('pre', { class: 'solucao-codigo' }, sol.codigo) : null,
          el('p', { class: 'nota' }, 'A solução não é colada no seu código: você faz a mudança no editor.'),
          primeira ? el('div', null, [el('label', { for: 'sol-expl', class: 'rotulo' }, 'Antes de seguir, explique com suas palavras'), campo, msg]) : null
        ]),
        botoes: [primeira ? {
          texto: 'Registrar explicação', principal: true, antes: function () {
            if (campo.value.trim().length < min) { msg.className = 'msg-campo erro'; msg.textContent = 'Explique com pelo menos ' + min + ' letras.'; return false; }
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

    restaurarEtapa: function () {
      if (!atual.def || atual.revisao) return;
      var inicio = atual.prog.inicioEtapa[etapaDef().id];
      Lab.ui.confirmar('Restaurar o código', 'O código volta a ficar como no começo deste passo. As versões executadas continuam no diário.', 'Restaurar').then(function (ok) {
        if (!ok) return;
        Lab.editor.definirRegioes(inicio || Lab.editor.regioesOriginais());
        salvarCodigo();
        Lab.diario.registrar('restaurar', 'Restaurou o código do início do passo.');
      });
    },

    // ------------------------------------------ concluir passo/missão
    concluirEtapa: function () {
      var def = atual.def, e = etapaDef(), prog = atual.prog;
      if (prog.etapasConcluidas.indexOf(e.id) === -1) prog.etapasConcluidas.push(e.id);
      Lab.sessao.avanco(def.id, e.id, 'etapa');
      Lab.diario.registrar('etapa', 'Concluiu o passo "' + e.titulo + '".');
      var ultima = atual.etapaIdx === def.etapas.length - 1;
      if (!ultima) {
        atual.etapaIdx++;
        var prox = etapaDef();
        prog.etapaAtual = prox.id;
        prog.inicioEtapa[prox.id] = Lab.editor.obterRegioes();
        estEtapa(prox.id).ultimoCodigo = Lab.editor.obterArquivos();
      }
      Lab.estado.salvar();
      motor.renderPassos();
      var corpo = el('div', { class: 'conclusao' }, [
        el('span', { class: 'conclusao-ico', html: Lab.icone('check') }),
        el('div', { class: 'balao' }, el('p', null, e.aoConcluir || 'Ficou bom!')),
        el('p', { class: 'texto-suave' }, ultima ? 'Todos os pedidos desta missão foram atendidos. Agora, o Raio-X.' : 'Progresso salvo. Próximo: ' + etapaDef().titulo + '.')
      ]);
      return Lab.ui.modal({
        titulo: 'Passo concluído', corpo: corpo, classe: 'modal-pequeno',
        botoes: [{ texto: ultima ? 'Abrir o Raio-X' : 'Ver o próximo pedido', principal: true, valor: true }]
      }).then(function () {
        if (ultima) return Lab.raiox.abrir(def, prog, Lab.editor.obterArquivos());
        Lab.editor.mostrarSo(arquivosDoPasso(etapaDef()));
        motor.mostrarPedido();
      });
    },

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
      var corpo = el('div', { class: 'conclusao' }, [
        el('span', { class: 'conclusao-ico', html: Lab.icone('check') }),
        el('div', { class: 'balao' }, el('p', null, def.encerramento || 'Valeu!')),
        el('p', { class: 'texto-suave' }, prox ? 'Próxima missão: ' + prox.meta.titulo + (prox.situacao === 'em-breve' ? ' (em preparação)' : prox.situacao === 'bloqueada-professor' ? ' (o professor vai liberar)' : '') + '.' : 'Você concluiu todas as missões desta trilha.')
      ]);
      return Lab.ui.modal({ titulo: def.titulo + ' concluída', corpo: corpo, classe: 'modal-pequeno', botoes: [{ texto: 'Voltar às missões', principal: true, valor: true }] })
        .then(function () { motor.fecharMissao(); Lab.app.mostrarMapa(); });
    }
  };

  Lab.motor = motor;
})();
