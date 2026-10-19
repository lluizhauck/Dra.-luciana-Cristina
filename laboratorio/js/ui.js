/* =====================================================================
   ui.js — telas, janelas (modais) acessíveis, avisos e senha do professor
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;

  var pilhaFoco = [];

  function focaveis(cont) {
    return U.$$('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', cont)
      .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }

  function prenderFoco(cont, ev) {
    if (ev.key !== 'Tab') return;
    var f = focaveis(cont);
    if (!f.length) return;
    var primeiro = f[0], ultimo = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  }

  var ui = {
    mostrarTela: function (id) {
      U.$$('.tela').forEach(function (t) { t.hidden = t.id !== id; });
      document.body.setAttribute('data-tela', id);
      var tela = document.getElementById(id);
      var alvo = tela && (U.$('[data-foco-inicial]', tela) || U.$('h1, h2', tela));
      if (alvo) {
        if (!alvo.hasAttribute('tabindex') && !/INPUT|BUTTON|TEXTAREA|SELECT/.test(alvo.tagName)) alvo.setAttribute('tabindex', '-1');
        setTimeout(function () { alvo.focus(); }, 30);
      }
      ui.atualizarCabecalho();
    },

    /**
     * Janela modal. opcoes:
     *  titulo, corpo (Node | string), classe, fecharComEsc (padrão true)
     *  botoes: [{texto, valor, classe, principal, antes: fn(cont) → valor|false}]
     * Resolve com o "valor" do botão (ou null se fechar).
     */
    modal: function (opcoes) {
      return new Promise(function (resolver) {
        var raiz = document.getElementById('camada-modal');
        var anterior = document.activeElement;
        var idTitulo = U.uid('t');
        var caixa = el('div', { class: 'modal ' + (opcoes.classe || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo });
        var fundo = el('div', { class: 'modal-fundo' }, caixa);
        caixa.appendChild(el('h2', { class: 'modal-titulo', id: idTitulo }, opcoes.titulo || ''));
        var corpo = el('div', { class: 'modal-corpo' });
        if (typeof opcoes.corpo === 'string') corpo.appendChild(el('p', null, opcoes.corpo));
        else if (opcoes.corpo) corpo.appendChild(opcoes.corpo);
        caixa.appendChild(corpo);
        var rodape = el('div', { class: 'modal-botoes' });
        function fechar(valor) {
          document.removeEventListener('keydown', teclas, true);
          fundo.remove();
          pilhaFoco.pop();
          if (!raiz.children.length) raiz.hidden = true;
          if (anterior && anterior.focus) { try { anterior.focus(); } catch (e) { /* ok */ } }
          resolver(valor);
        }
        (opcoes.botoes || [{ texto: 'Fechar', valor: null, principal: true }]).forEach(function (b) {
          rodape.appendChild(el('button', {
            type: 'button', class: 'bt ' + (b.principal ? 'bt-principal ' : 'bt-secundario ') + (b.classe || ''),
            onclick: function () {
              if (b.antes) {
                var v = b.antes(corpo);
                if (v === false) return;
                fechar(v === undefined ? b.valor : v);
              } else fechar(b.valor);
            }
          }, b.texto));
        });
        caixa.appendChild(rodape);
        function teclas(ev) {
          if (pilhaFoco[pilhaFoco.length - 1] !== caixa) return;
          if (caixa.contains(document.activeElement)) prenderFoco(caixa, ev);
          else if (ev.key === 'Tab') { ev.preventDefault(); var f = focaveis(caixa); if (f[0]) f[0].focus(); }
          if (ev.key === 'Escape' && opcoes.fecharComEsc !== false) { ev.stopPropagation(); fechar(null); }
        }
        document.addEventListener('keydown', teclas, true);
        raiz.appendChild(fundo);
        raiz.hidden = false;
        pilhaFoco.push(caixa);
        setTimeout(function () {
          var alvo = U.$('[data-foco-inicial]', caixa) || U.$('textarea, input', caixa) || U.$('.bt-principal', caixa);
          if (alvo) alvo.focus();
        }, 30);
        if (opcoes.aoAbrir) opcoes.aoAbrir(caixa, fechar);
      });
    },

    confirmar: function (titulo, texto, textoOk, perigo) {
      return ui.modal({
        titulo: titulo, corpo: texto,
        botoes: [{ texto: 'Cancelar', valor: false }, { texto: textoOk || 'Confirmar', valor: true, principal: true, classe: perigo ? 'bt-perigo' : '' }]
      }).then(function (v) { return v === true; });
    },

    aviso: function (texto, tipo) {
      var raiz = document.getElementById('avisos');
      var n = el('div', { class: 'aviso ' + (tipo || ''), role: tipo === 'erro' ? 'alert' : 'status' }, texto);
      raiz.appendChild(n);
      setTimeout(function () { n.classList.add('saindo'); }, tipo === 'erro' ? 7000 : 3800);
      setTimeout(function () { n.remove(); }, tipo === 'erro' ? 7600 : 4400);
    },

    abrirOverlay: function (ov) {
      ov.hidden = false;
      ov._anterior = document.activeElement;
      document.body.classList.add('com-overlay');
      if (!ov._preso) {
        ov.addEventListener('keydown', function (ev) { prenderFoco(ov, ev); });
        ov._preso = true;
      }
      var alvo = U.$('[data-foco-inicial]', ov) || U.$('h1, h2', ov);
      if (alvo) { if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1'); setTimeout(function () { alvo.focus(); }, 30); }
    },
    fecharOverlay: function (ov) {
      ov.hidden = true;
      if (!U.$$('.overlay').some(function (o) { return !o.hidden; })) document.body.classList.remove('com-overlay');
      if (ov._anterior && ov._anterior.focus) { try { ov._anterior.focus(); } catch (e) { /* ok */ } }
    },

    /** pede a senha do professor. Resolve true se liberou. */
    pedirSenhaProfessor: function (motivo) {
      if (Lab.auth.valido()) return Promise.resolve(true);
      var intervalo = null;
      var input = el('input', { type: 'password', id: 'campo-senha-prof', autocomplete: 'current-password', 'aria-describedby': 'msg-senha-prof' });
      var msg = el('p', { id: 'msg-senha-prof', class: 'msg-campo', 'aria-live': 'polite' });
      var corpo = el('div', null, [
        el('p', null, motivo || 'Esta ação precisa da senha do professor.'),
        el('label', { for: 'campo-senha-prof', class: 'rotulo' }, 'Senha do professor'),
        input, msg
      ]);
      function atualizarBloqueio() {
        var b = Lab.auth.bloqueio();
        if (b.restanteMs > 0) {
          input.disabled = true;
          msg.className = 'msg-campo erro';
          msg.textContent = 'Senha bloqueada por segurança. Tente de novo em ' + Math.ceil(b.restanteMs / 1000) + ' s.';
          return true;
        }
        if (input.disabled) { input.disabled = false; msg.textContent = ''; input.focus(); }
        return false;
      }
      return ui.modal({
        titulo: 'Senha do professor', corpo: corpo, classe: 'modal-estreito',
        aoAbrir: function (caixa, fechar) {
          atualizarBloqueio();
          intervalo = setInterval(atualizarBloqueio, 1000);
          var verificando = false;
          function tentar() {
            if (verificando || atualizarBloqueio()) return;
            if (!input.value) { msg.textContent = 'Digite a senha.'; return; }
            verificando = true;
            msg.className = 'msg-campo';
            msg.textContent = 'Verificando…';
            Lab.auth.verificar(input.value).then(function (r) {
              verificando = false;
              if (r.ok) { clearInterval(intervalo); fechar(true); return; }
              input.value = '';
              if (r.semSenha) { msg.className = 'msg-campo erro'; msg.textContent = 'Nenhuma senha configurada em config.js (veja gerar-hash.html).'; return; }
              atualizarBloqueio();
            });
          }
          input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tentar(); });
          U.$('.bt-principal', caixa).onclick = tentar;
        },
        botoes: [{ texto: 'Cancelar', valor: false }, { texto: 'Liberar', principal: true, antes: function () { return false; } }]
      }).then(function (v) { clearInterval(intervalo); return v === true; });
    },

    atualizarPontos: function () {
      var a = Lab.estado.aluno;
      var n = document.getElementById('cab-pontos');
      if (!n || !a) return;
      var t = Lab.diario.totais(a);
      n.textContent = t.total + ' pts de processo';
      n.title = Object.keys(Lab.diario.CATEGORIAS).map(function (k) { return Lab.diario.CATEGORIAS[k] + ': ' + t[k]; }).join('\n');
    },

    atualizarCabecalho: function () {
      var a = Lab.estado.aluno;
      var turma = Lab.estado.turma ? Lab.turmas.porId(Lab.estado.turma) : null;
      var cab = document.getElementById('cabecalho');
      var logado = !!a;
      U.$$('[data-so-logado]', cab).forEach(function (n) { n.hidden = !logado; });
      document.getElementById('cab-aluno').textContent = a ? a.nome : '';
      document.getElementById('cab-turma').textContent = turma ? turma.nome : '';
      ui.atualizarPontos();
    }
  };

  Lab.ui = ui;
})();
