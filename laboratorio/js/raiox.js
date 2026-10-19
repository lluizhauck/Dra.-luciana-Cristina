/* =====================================================================
   raiox.js — cena final de cada missão
   O site fica "transparente": cada elemento mostra a linha de HTML, as
   regras de CSS e as linhas de JS que o produzem. Depois de explorar,
   o aluno responde UMA pergunta aberta de insight (sem correção automática).
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;
  var MIN_EXPLORAR = 3;

  var estado = { moldura: null, vistos: {}, def: null, prog: null, arquivos: null, revisao: false };

  function atualizarContador() {
    var n = Object.keys(estado.vistos).length;
    var falta = Math.max(0, MIN_EXPLORAR - n);
    document.getElementById('raiox-contador').textContent = n + ' elemento' + (n === 1 ? '' : 's') + ' explorado' + (n === 1 ? '' : 's');
    var bloco = document.getElementById('raiox-insight');
    var aviso = document.getElementById('raiox-falta');
    if (falta > 0 && !estado.revisao) {
      bloco.hidden = true;
      aviso.hidden = false;
      aviso.textContent = 'Clique em mais ' + falta + ' elemento' + (falta > 1 ? 's' : '') + ' do site para liberar a pergunta final.';
    } else {
      bloco.hidden = false;
      aviso.hidden = true;
    }
  }

  function aoMensagem(tipo, info) {
    if (tipo !== 'raiox') return;
    Lab.inspetor.renderInfo(document.getElementById('raiox-ficha'), info, { navegar: false, arquivos: estado.arquivos });
    var chave = info.tag + '@' + info.linha + '@' + info.uid;
    if (!estado.vistos[chave]) {
      estado.vistos[chave] = true;
      if (!estado.revisao) {
        estado.prog.raiox = estado.prog.raiox || { vistos: [] };
        estado.prog.raiox.vistos.push({ tag: info.tag, linha: info.linha, em: Date.now() });
        Lab.diario.registrar('raiox', 'Explorou <' + info.tag + '> no Raio-X (HTML linha ' + info.linha + ', ' + info.css.length + ' regra(s) de CSS, ' + info.js.length + ' ligação(ões) com JS).');
        Lab.diario.pontuar('investigacao', 1, 'explorou o Raio-X', 'raiox:' + estado.def.id, 5);
      }
    }
    atualizarContador();
  }

  var raiox = {
    /** abre o Raio-X. revisao=true: missão já concluída (só para rever) */
    abrir: function (def, prog, arquivos, revisao) {
      estado.def = def; estado.prog = prog; estado.arquivos = arquivos; estado.vistos = {}; estado.revisao = !!revisao;
      if (!estado.moldura) {
        estado.moldura = new Lab.preview.Moldura(document.getElementById('raiox-iframe'), 'raiox');
        estado.moldura.aoMensagem = aoMensagem;
      }
      var ov = document.getElementById('raiox');
      document.getElementById('raiox-titulo').textContent = 'Raio-X · ' + def.titulo;
      document.getElementById('raiox-intro').textContent = (def.raiox && def.raiox.intro) || 'Passe o mouse e clique nos elementos do site. Cada um mostra a linha de HTML que o cria, as regras de CSS que o enfeitam e as linhas de JavaScript que mexem nele.';
      U.limpar(document.getElementById('raiox-ficha')).appendChild(el('p', { class: 'vazio' }, 'Clique em um elemento do site à esquerda.'));
      var perg = (def.raiox && def.raiox.pergunta) || 'O que você aprendeu nesta missão?';
      document.getElementById('raiox-pergunta').textContent = perg;
      var campo = document.getElementById('raiox-resposta');
      var msg = document.getElementById('raiox-msg');
      var bt = document.getElementById('raiox-concluir');
      msg.textContent = '';
      if (revisao) {
        campo.value = prog.insight ? prog.insight.resposta : '';
        campo.readOnly = true;
        bt.textContent = 'Fechar';
      } else {
        campo.value = '';
        campo.readOnly = false;
        bt.textContent = 'Salvar resposta e concluir a missão';
      }
      bt.onclick = function () {
        if (revisao) { raiox.fechar(); return; }
        var r = campo.value.trim();
        if (r.length < (Lab.cfg.minCaracteresExplicacao || 40)) {
          msg.className = 'msg-campo erro';
          msg.textContent = 'Responda com suas palavras (pelo menos ' + (Lab.cfg.minCaracteresExplicacao || 40) + ' letras). Não existe resposta "certa" aqui: vale o seu raciocínio.';
          return;
        }
        raiox.fechar();
        Lab.motor.concluirMissao({ pergunta: perg, resposta: r, em: Date.now() });
      };
      document.getElementById('raiox-sair').hidden = !revisao;
      atualizarContador();
      Lab.ui.abrirOverlay(ov);
      var assets = {};
      (def.assets || []).forEach(function (k) { assets[k] = Lab.assets[k]; });
      var arm = Lab.perfis.sandboxLer(Lab.estado.turma, Lab.estado.aluno.id, Lab.cfg.trilha + ':' + def.id);
      return estado.moldura.render(arquivos, { principal: def.principal || 'index.html', assets: assets, armazenamento: arm });
    },

    fechar: function () {
      Lab.ui.fecharOverlay(document.getElementById('raiox'));
      if (estado.moldura) estado.moldura.limpar();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var sair = document.getElementById('raiox-sair');
    if (sair) sair.addEventListener('click', raiox.fechar);
  });

  Lab.raiox = raiox;
})();
