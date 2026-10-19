/* =====================================================================
   app.js — fluxo de telas: turma → perfil (PIN) → retomar → mapa → bancada
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el, CFG = Lab.cfg;

  function carregarScripts(lista) {
    return lista.reduce(function (p, src) {
      return p.then(function () {
        return new Promise(function (ok) {
          var s = document.createElement('script');
          s.src = src;
          s.onload = ok;
          s.onerror = function () { console.error('Não consegui carregar ' + src); ok(); };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  var app = {
    iniciar: function () {
      if (!Lab.armazem.disponivel()) {
        document.getElementById('erro-armazenamento').hidden = false;
      }
      Lab.armazem.migrarGlobal();
      carregarScripts(CFG.arquivosMissoes || []).then(function () {
        Lab.motor.iniciar();
        app.ligarCabecalho();
        Lab.auth.aoExpirar(function () {
          if (document.body.getAttribute('data-tela') === 'tela-professor') {
            Lab.ui.aviso('O modo professor expirou. Digite a senha de novo para continuar.');
            app.telaInicial();
          }
        });
        app.telaInicial();
      });
    },

    telaInicial: function () {
      var t = Lab.turmas.travada();
      if (t) app.mostrarPerfis(t);
      else app.mostrarTurmas();
    },

    // ----------------------------------------------------------- turma
    mostrarTurmas: function () {
      var travada = Lab.turmas.travada();
      var cont = U.limpar(document.getElementById('lista-turmas'));
      Lab.turmas.lista().forEach(function (t) {
        var ehTravada = travada === t.id;
        var precisaSenha = travada && !ehTravada;
        cont.appendChild(el('button', {
          type: 'button', class: 'cartao-turma' + (ehTravada ? ' travada' : '') + (precisaSenha ? ' com-senha' : ''),
          onclick: function () { app.escolherTurma(t.id); }
        }, [
          el('span', { class: 'cartao-turma-num' }, t.id),
          el('span', { class: 'cartao-turma-nome' }, t.nome),
          el('span', { class: 'cartao-turma-info' }, ehTravada ? 'turma deste computador' : precisaSenha ? 'trocar exige a senha do professor' : 'escolher')
        ]));
      });
      document.getElementById('aviso-trava').hidden = !!travada;
      Lab.ui.mostrarTela('tela-turma');
    },

    escolherTurma: function (id) {
      var travada = Lab.turmas.travada();
      if (!travada) {
        var t = Lab.turmas.porId(id);
        return Lab.ui.confirmar('Confirmar turma', 'Este computador vai ficar na ' + t.nome + '. Para trocar depois, só com a senha do professor. Confirma?', 'Sim, sou da ' + t.nome)
          .then(function (ok) { if (ok) { Lab.turmas.travar(id); app.mostrarPerfis(id); } });
      }
      if (travada === id) return app.mostrarPerfis(id);
      return Lab.ui.pedirSenhaProfessor('Este computador está travado em outra turma. Para trocar para a ' + Lab.turmas.porId(id).nome + ', digite a senha do professor. Os dados da outra turma continuam guardados.')
        .then(function (ok) {
          if (!ok) return;
          Lab.turmas.travar(id); // também encerra o desbloqueio do professor
          Lab.ui.aviso('Computador agora na ' + Lab.turmas.porId(id).nome + '.');
          app.mostrarPerfis(id);
        });
    },

    // ---------------------------------------------------------- perfis
    mostrarPerfis: function (turmaId) {
      Lab.estado.turma = turmaId;
      var turma = Lab.turmas.porId(turmaId);
      document.getElementById('perfil-turma').textContent = turma.nome;
      var cont = U.limpar(document.getElementById('lista-perfis'));
      var lista = Lab.perfis.listar(turmaId);
      if (!lista.length) cont.appendChild(el('p', { class: 'vazio' }, 'Ainda não há perfis nesta turma neste computador. Crie o seu ao lado.'));
      lista.forEach(function (p) {
        cont.appendChild(el('li', null, el('button', { type: 'button', class: 'bt-perfil', onclick: function () { app.pedirPin(turmaId, p); } }, [
          el('span', { class: 'bt-perfil-ini', 'aria-hidden': 'true' }, p.nome.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase()),
          el('span', null, p.nome)
        ])));
      });
      var form = document.getElementById('form-novo-perfil');
      form.reset();
      document.getElementById('msg-novo-perfil').textContent = '';
      Lab.ui.mostrarTela('tela-perfil');
    },

    pedirPin: function (turmaId, perfil) {
      var input = el('input', { type: 'password', inputmode: 'numeric', maxlength: '4', pattern: '[0-9]*', id: 'campo-pin', class: 'campo-pin', autocomplete: 'off', 'aria-describedby': 'msg-pin' });
      var msg = el('p', { id: 'msg-pin', class: 'msg-campo', 'aria-live': 'polite' });
      return Lab.ui.modal({
        titulo: 'Olá, ' + perfil.nome.split(' ')[0] + '!', classe: 'modal-estreito',
        corpo: el('div', null, [el('label', { for: 'campo-pin', class: 'rotulo' }, 'Digite seu PIN de 4 números'), input, msg,
          el('p', { class: 'dica-campo' }, 'Esqueceu o PIN? Peça ao professor para redefinir.')]),
        aoAbrir: function (caixa, fechar) {
          var ocupado = false;
          function tentar() {
            if (ocupado) return;
            if (!/^\d{4}$/.test(input.value)) { msg.className = 'msg-campo erro'; msg.textContent = 'O PIN tem 4 números.'; return; }
            ocupado = true;
            msg.className = 'msg-campo'; msg.textContent = 'Conferindo…';
            Lab.perfis.verificarPin(turmaId, perfil.id, input.value).then(function (r) {
              ocupado = false;
              if (r.ok) { fechar(true); app.entrar(turmaId, perfil.id); return; }
              input.value = '';
              msg.className = 'msg-campo erro';
              msg.textContent = r.bloqueadoMs ? 'Muitas tentativas. Espere ' + Math.ceil(r.bloqueadoMs / 1000) + ' segundos.' : 'PIN incorreto.';
              input.focus();
            });
          }
          input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tentar(); });
          input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 4); if (input.value.length === 4) tentar(); });
          U.$('.bt-principal', caixa).onclick = tentar;
        },
        botoes: [{ texto: 'Voltar', valor: false }, { texto: 'Entrar', principal: true, antes: function () { return false; } }]
      });
    },

    criarPerfil: function (ev) {
      ev.preventDefault();
      var nome = document.getElementById('novo-nome').value;
      var pin = document.getElementById('novo-pin').value;
      var pin2 = document.getElementById('novo-pin2').value;
      var msg = document.getElementById('msg-novo-perfil');
      msg.className = 'msg-campo erro';
      if (pin !== pin2) { msg.textContent = 'Os dois PINs não são iguais.'; return; }
      msg.className = 'msg-campo';
      msg.textContent = 'Criando…';
      Lab.perfis.criar(Lab.estado.turma, nome, pin).then(function (r) {
        if (!r.ok) { msg.className = 'msg-campo erro'; msg.textContent = r.erro; return; }
        Lab.ui.aviso('Perfil criado. Guarde seu PIN!');
        app.entrar(Lab.estado.turma, r.perfil.id);
      });
    },

    importarCodigo: function () {
      var campo = el('textarea', { id: 'campo-codigo', rows: '5', class: 'mono', placeholder: 'LAB1.…' });
      var arquivo = el('input', { type: 'file', accept: '.txt,text/plain', id: 'arquivo-codigo' });
      var msg = el('p', { class: 'msg-campo', 'aria-live': 'polite' });
      arquivo.addEventListener('change', function () {
        if (arquivo.files[0]) U.lerArquivo(arquivo.files[0]).then(function (t) { campo.value = t.trim(); });
      });
      return Lab.ui.modal({
        titulo: 'Importar código de progresso',
        corpo: el('div', null, [
          el('p', null, 'Cole o código que você exportou em outro computador (ou escolha o arquivo .txt). Ele traz seu perfil, seu PIN e todo o progresso.'),
          el('label', { for: 'campo-codigo', class: 'rotulo' }, 'Código'), campo,
          el('label', { for: 'arquivo-codigo', class: 'rotulo' }, 'ou arquivo'), arquivo, msg
        ]),
        botoes: [{ texto: 'Cancelar', valor: null }, {
          texto: 'Importar', principal: true, antes: function () {
            var r = Lab.perfis.lerCodigo(campo.value);
            if (!r.ok) { msg.className = 'msg-campo erro'; msg.textContent = r.erro; return false; }
            return r.dados;
          }
        }]
      }).then(function (dados) {
        if (!dados) return;
        var turmaAtual = Lab.estado.turma;
        var passo = Promise.resolve(true);
        if (dados.turma !== turmaAtual) {
          passo = Lab.ui.pedirSenhaProfessor('Este código é da ' + ((Lab.turmas.porId(dados.turma) || {}).nome || 'turma ' + dados.turma) + ', mas este computador está na ' + Lab.turmas.porId(turmaAtual).nome + '. Para importar mesmo assim (para a turma deste computador), o professor precisa liberar.');
        }
        return passo.then(function (ok) {
          if (!ok) return;
          var existe = Lab.perfis.listar(turmaAtual).filter(function (p) { return p.id === dados.perfil.id || p.nome.toLowerCase() === dados.perfil.nome.toLowerCase(); })[0];
          var conf = existe ? Lab.ui.confirmar('Substituir progresso?', 'Já existe o perfil "' + existe.nome + '" neste computador. O progresso dele será trocado pelo do código (uma cópia de segurança é guardada antes).', 'Substituir') : Promise.resolve(true);
          return conf.then(function (ok2) {
            if (!ok2) return;
            var r = Lab.perfis.importar(turmaAtual, dados);
            Lab.ui.aviso('Progresso de ' + r.perfil.nome + ' importado. Entre com seu PIN.');
            app.mostrarPerfis(turmaAtual);
          });
        });
      });
    },

    // ------------------------------------------------------------ entrar
    entrar: function (turmaId, alunoId) {
      Lab.estado.turma = turmaId;
      Lab.estado.aluno = Lab.perfis.carregarAluno(turmaId, alunoId);
      var tinhaSessoes = Lab.estado.aluno.sessoes.length > 0;
      Lab.sessao.iniciar();
      Lab.diario.registrar('sessao', 'Início da sessão ' + Lab.sessao.atual.numero + '.');
      Lab.ui.atualizarCabecalho();
      if (tinhaSessoes) app.mostrarRetomar();
      else app.mostrarMapa(true);
    },

    // ----------------------------------------------------------- retomar
    mostrarRetomar: function () {
      var a = Lab.estado.aluno;
      var ant = Lab.sessao.anterior();
      var trilha = Lab.estado.trilha();
      var missaoId = trilha.missaoAtual;
      var def = missaoId ? Lab.missoes[missaoId] : null;
      var prog = missaoId ? trilha.missoes[missaoId] : null;
      var cont = U.limpar(document.getElementById('retomar-resumo'));
      document.getElementById('retomar-nome').textContent = a.nome.split(' ')[0];

      var itens = [];
      if (ant) itens.push(['Última aula', U.dataHora(ant.inicio) + ' · ' + U.duracao(ant.ativoMs) + ' de trabalho' + (ant.encerrada ? '' : ' (a sessão não foi encerrada pelo botão)')]);
      if (ant && ant.avancos.length) itens.push(['Naquela aula você', ant.avancos.map(Lab.descreverAvanco).join(' · ')]);
      if (def && prog) {
        var idx = def.etapas.map(function (e) { return e.id; }).indexOf(prog.etapaAtual);
        itens.push(['Onde você parou', prog.status === 'concluida' ? def.titulo + ' (concluída)' : 'Missão ' + def.numero + ' · ' + def.titulo + ' — Etapa ' + (idx + 1) + ': ' + (def.etapas[idx] ? def.etapas[idx].titulo : '')]);
      }
      // último insight e última hipótese (de qualquer missão)
      var insights = [], hips = [];
      Object.keys(trilha.missoes).forEach(function (k) {
        var p = trilha.missoes[k];
        if (p.insight) insights.push(p.insight);
        (p.hipoteses || []).forEach(function (h) { hips.push(h); });
      });
      insights.sort(function (x, y) { return x.em - y.em; });
      hips.sort(function (x, y) { return x.em - y.em; });
      if (insights.length) itens.push(['Seu último insight', '“' + insights[insights.length - 1].resposta + '”']);
      if (hips.length) { var h = hips[hips.length - 1]; itens.push(['Sua última hipótese', '“Acho que o problema está em ' + h.onde + ' porque ' + h.porque + '”']); }
      cont.appendChild(el('dl', { class: 'recap' }, itens.reduce(function (acc, i) { return acc.concat([el('dt', null, i[0]), el('dd', null, i[1])]); }, [])));

      // aquecimento: 1 pergunta aberta sobre a aula anterior
      var ultimaMissao = def;
      if (prog && prog.status !== 'concluida' && prog.etapasConcluidas.length === 0) {
        // ainda no começo dessa missão: pergunta sobre a missão anterior concluída
        var t = Lab.trilhaAtiva();
        var i = t.missoes.map(function (m) { return m.id; }).indexOf(missaoId);
        if (i > 0 && Lab.missoes[t.missoes[i - 1].id]) ultimaMissao = Lab.missoes[t.missoes[i - 1].id];
      }
      var perguntas = (ultimaMissao && ultimaMissao.aquecimento) || ['Conte em duas frases o que você fez na última aula e qual foi o erro mais difícil de encontrar.'];
      var pergunta = perguntas[(a.sessoes.length - 1) % perguntas.length];
      document.getElementById('aquecimento-pergunta').textContent = pergunta;
      var campo = document.getElementById('aquecimento-resposta');
      campo.value = '';
      var msg = document.getElementById('msg-aquecimento');
      msg.textContent = '';
      document.getElementById('form-aquecimento').onsubmit = function (ev) {
        ev.preventDefault();
        var r = campo.value.trim();
        if (r.length < 20) { msg.className = 'msg-campo erro'; msg.textContent = 'Escreva pelo menos uma frase completa — é só para aquecer a memória.'; return; }
        Lab.sessao.atual.aquecimento = { pergunta: pergunta, resposta: r, em: Date.now() };
        Lab.diario.registrar('aquecimento', pergunta + ' → ' + r);
        Lab.diario.pontuar('reflexao', 2, 'aquecimento da aula', 'aquec:' + Lab.sessao.atual.id, 2);
        if (missaoId && Lab.missoes[missaoId] && prog && prog.status !== 'concluida' && Lab.motor.situacao(missaoId) !== 'bloqueada-professor') {
          Lab.motor.abrirMissao(missaoId);
        } else app.mostrarMapa();
      };
      Lab.ui.mostrarTela('tela-retomar');
    },

    // -------------------------------------------------------------- mapa
    mostrarMapa: function (boasVindas) {
      var trilha = Lab.trilhaAtiva();
      document.getElementById('mapa-titulo').textContent = trilha.titulo;
      document.getElementById('mapa-sub').textContent = trilha.descricao || '';
      var cont = U.limpar(document.getElementById('lista-missoes'));
      var rotulos = {
        'concluida': 'Concluída', 'em-andamento': 'Em andamento', 'disponivel': 'Disponível',
        'bloqueada-professor': 'Aguardando o professor liberar', 'bloqueada-sequencia': 'Termine a missão anterior', 'em-breve': 'Em preparação'
      };
      trilha.missoes.forEach(function (m, i) {
        var s = Lab.motor.situacao(m.id);
        var prog = Lab.estado.trilha().missoes[m.id];
        var def = Lab.missoes[m.id];
        var progresso = def && prog ? prog.etapasConcluidas.length + '/' + def.etapas.length + ' etapas' : def ? def.etapas.length + ' etapas' : '';
        var acoes = [];
        if (s === 'em-andamento') acoes.push(el('button', { type: 'button', class: 'bt bt-principal', onclick: function () { Lab.motor.abrirMissao(m.id); } }, 'Continuar'));
        if (s === 'disponivel') acoes.push(el('button', { type: 'button', class: 'bt bt-principal', onclick: function () { Lab.motor.abrirMissao(m.id); } }, 'Começar'));
        if (s === 'concluida') {
          acoes.push(el('button', { type: 'button', class: 'bt bt-secundario', onclick: function () { Lab.motor.abrirMissao(m.id); } }, 'Rever código'));
          acoes.push(el('button', { type: 'button', class: 'bt bt-secundario', onclick: function () {
            Lab.raiox.abrir(def, prog, app.arquivosDe(def, prog), true);
          } }, 'Rever Raio-X'));
        }
        cont.appendChild(el('li', { class: 'cartao-missao estado-' + s }, [
          el('div', { class: 'cartao-missao-num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
          el('div', { class: 'cartao-missao-corpo' }, [
            el('p', { class: 'cartao-missao-estado' }, rotulos[s] + (progresso ? ' · ' + progresso : '') + (m.minutos ? ' · ≈ ' + m.minutos + ' min' : '')),
            el('h2', null, 'Missão ' + (i + 1) + ': ' + m.titulo),
            el('p', null, m.resumo),
            m.conceitos ? el('p', { class: 'cartao-missao-conceitos' }, m.conceitos.join(' · ')) : null,
            acoes.length ? el('div', { class: 'cartao-missao-acoes' }, acoes) : null
          ])
        ]));
      });
      Lab.ui.mostrarTela('tela-mapa');
      if (boasVindas) {
        Lab.ui.modal({
          titulo: 'Bem-vindo(a) ao laboratório',
          corpo: el('div', { class: 'boas-vindas' }, [
            el('p', null, 'Você acabou de ser contratado(a) como dev júnior. Seu primeiro cliente é a Açaí & Cia, uma açaíteria do bairro. O site deles foi começado por um primo do dono… e está cheio de problemas.'),
            el('p', null, 'Como funciona aqui:'),
            el('ul', null, [
              el('li', null, 'Você edita código de verdade e clica em Executar. O site reage ao seu código — ninguém vai dizer "errado".'),
              el('li', null, 'Quando algo não funcionar, investigue: Inspecionar mostra de que linha vem cada parte do site, e o Console mostra os erros.'),
              el('li', null, 'Antes de executar de novo, você escreve uma hipótese. Mudar uma coisa por vez vale pontos.'),
              el('li', null, 'Tudo é salvo sozinho. No fim da aula, use "Encerrar sessão".')
            ])
          ]),
          botoes: [{ texto: 'Bora trabalhar', principal: true, valor: true }]
        });
      }
    },

    /** monta os arquivos completos de uma missão a partir das regiões salvas (sem usar o editor) */
    arquivosDe: function (def, prog) {
      var r = {};
      def.arquivos.forEach(function (a) {
        var salvo = (prog.codigo || {})[a.nome] || {};
        r[a.nome] = Lab.editor.parseModelo(a.modelo).map(function (b) {
          return b.tipo === 'editavel' && typeof salvo[b.id] === 'string' ? salvo[b.id] : b.texto;
        }).join('\n');
      });
      return r;
    },

    // --------------------------------------------------------- cabeçalho
    ligarCabecalho: function () {
      document.getElementById('bt-mapa').addEventListener('click', function () { Lab.motor.fecharMissao(); app.mostrarMapa(); });
      document.getElementById('bt-relatorio').addEventListener('click', function () { Lab.diario.abrirRelatorio(Lab.estado.aluno, Lab.estado.turma); });
      document.getElementById('bt-exportar').addEventListener('click', function () { app.exportarCodigo(); });
      document.getElementById('bt-encerrar').addEventListener('click', function () { app.encerrarSessao(); });
      document.getElementById('form-novo-perfil').addEventListener('submit', app.criarPerfil);
      document.getElementById('bt-importar').addEventListener('click', app.importarCodigo);
      document.getElementById('bt-trocar-turma').addEventListener('click', app.mostrarTurmas);
      U.$$('.bt-modo-professor').forEach(function (b) { b.addEventListener('click', function () { Lab.professor.abrir(); }); });
      document.getElementById('rel-fechar').addEventListener('click', function () { Lab.ui.fecharOverlay(document.getElementById('relatorio')); });
      document.getElementById('rel-imprimir').addEventListener('click', function () { window.print(); });
    },

    exportarCodigo: function (alunoId, turmaId) {
      turmaId = turmaId || Lab.estado.turma;
      alunoId = alunoId || Lab.estado.aluno.id;
      if (Lab.estado.aluno && Lab.estado.aluno.id === alunoId) Lab.estado.salvar();
      var codigo = Lab.perfis.exportarCodigo(turmaId, alunoId);
      var perfil = Lab.perfis.porId(turmaId, alunoId);
      var campo = el('textarea', { rows: '6', readonly: true, class: 'mono', 'aria-label': 'Código de progresso' });
      campo.value = codigo;
      var nomeArq = 'progresso-' + Lab.diario.slug(perfil.nome) + '-turma' + turmaId + '-' + U.data(Date.now()).replace(/\//g, '-') + '.txt';
      return Lab.ui.modal({
        titulo: 'Código de progresso',
        corpo: el('div', null, [
          el('p', null, 'Este código é o seu backup: traz perfil, PIN e todo o progresso. Guarde no seu pendrive, e-mail ou Drive. Em outro computador, use "Importar código de progresso".'),
          campo,
          el('div', { class: 'linha-botoes' }, [
            el('button', { type: 'button', class: 'bt bt-secundario', onclick: function () {
              campo.select();
              var ok = false;
              try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
              if (navigator.clipboard) navigator.clipboard.writeText(codigo).then(function () { Lab.ui.aviso('Código copiado.'); }, function () { if (ok) Lab.ui.aviso('Código copiado.'); });
              else if (ok) Lab.ui.aviso('Código copiado.');
            } }, 'Copiar'),
            el('button', { type: 'button', class: 'bt bt-secundario', onclick: function () { U.baixar(nomeArq, codigo, 'text/plain;charset=utf-8'); } }, 'Baixar arquivo .txt')
          ])
        ])
      });
    },

    encerrarSessao: function () {
      var s = Lab.sessao.atual;
      if (!s) return;
      Lab.motor.fecharMissao();
      Lab.diario.registrar('sessao', 'Sessão ' + s.numero + ' encerrada.');
      Lab.sessao.encerrar();
      var c = s.contadores;
      var prox = Lab.motor.proximaMissao();
      var proxTexto = 'Você concluiu todas as missões disponíveis!';
      if (prox && Lab.missoes[prox.meta.id]) {
        var def = Lab.missoes[prox.meta.id];
        var prog = Lab.estado.trilha().missoes[prox.meta.id];
        var idx = prog ? def.etapas.map(function (e) { return e.id; }).indexOf(prog.etapaAtual) : 0;
        proxTexto = 'Missão ' + def.numero + ' · ' + def.titulo + ' — Etapa ' + (idx + 1) + ': ' + def.etapas[Math.max(0, idx)].titulo + '. ' + (def.etapas[Math.max(0, idx)].teaser || '');
      } else if (prox) proxTexto = 'Missão: ' + prox.meta.titulo + ' (em preparação).';
      var corpo = el('div', { class: 'resumo-sessao' }, [
        el('dl', { class: 'recap' }, [
          el('dt', null, 'Tempo de trabalho'), el('dd', null, U.duracao(s.ativoMs)),
          el('dt', null, 'O que você avançou'), el('dd', null, s.avancos.length ? s.avancos.map(Lab.descreverAvanco).join(' · ') : 'Investigação (nenhuma etapa fechada hoje — tudo bem, está salvo)'),
          el('dt', null, 'Execuções'), el('dd', null, String(c.execucoes || 0)),
          el('dt', null, 'Hipóteses escritas'), el('dd', null, String(c.hipoteses || 0)),
          el('dt', null, 'Ajudas usadas'), el('dd', null, String(c.ajudas || 0)),
          el('dt', null, 'Insights'), el('dd', null, String(c.insights || 0)),
          el('dt', null, 'Na próxima aula'), el('dd', null, proxTexto)
        ]),
        el('div', { class: 'lembrete' }, [
          el('strong', null, 'Lembrete: '), 'exporte seu código de progresso. Se este computador for formatado ou você usar outra máquina, é com ele que você continua.'
        ])
      ]);
      Lab.ui.modal({
        titulo: 'Sessão encerrada', corpo: corpo, fecharComEsc: false,
        botoes: [
          { texto: 'Exportar código de progresso', valor: 'exportar' },
          { texto: 'Sair', principal: true, valor: 'sair' }
        ]
      }).then(function (v) {
        var depois = v === 'exportar' ? app.exportarCodigo() : Promise.resolve();
        depois.then(function () {
          var t = Lab.estado.turma;
          Lab.estado.sair();
          Lab.ui.atualizarCabecalho();
          app.mostrarPerfis(t);
        });
      });
    }
  };

  Lab.app = app;
  document.addEventListener('DOMContentLoaded', app.iniciar);
})();
