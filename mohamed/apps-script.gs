/**
 * Mohamed — recebe o relatório do app (doPost) e grava numa Planilha Google privada.
 *
 * Publicar em 5 passos:
 * 1. Crie uma Planilha Google (ela continua privada, só sua).
 * 2. Na planilha: Extensões › Apps Script. Apague tudo, cole este código e salve.
 * 3. Implantar › Nova implantação › App da Web. Executar como: Eu. Quem pode acessar: Qualquer pessoa.
 * 4. Autorize com sua conta e copie a URL que termina em /exec.
 * 5. Cole a URL em URL_RELATORIO, no topo de relatorio.js.
 *
 * A planilha não fica pública: o link só aceita gravar novas linhas.
 * Mudou o código? Implantar › Gerenciar implantações › Editar › Nova versão.
 */

const ABA = 'Relatórios';
const COLUNAS = [
  'Recebido (servidor)', 'Nome', 'Turma', 'Data/hora (aparelho)', 'Tempo ativo', 'Segundos',
  'Dia', 'Lição', 'Acertos', 'Erros', 'XP', '3 mais erradas', 'ID'
];

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const aba = pegarAba_();
    // o app pode reenviar a fila: ignora o mesmo ID
    if (d.id && aba.getRange(1, COLUNAS.length, aba.getLastRow(), 1)
      .createTextFinder(String(d.id)).matchEntireCell(true).findNext()) {
      return resposta_('repetido');
    }
    aba.appendRow([
      new Date(), // horário do servidor
      d.nome, d.turma, d.dataHora, d.tempoAtivo, d.segundos,
      d.dia, d.licao, d.acertos, d.erros, d.xp, d.maisErradas, d.id
    ].map(limpar_));
    return resposta_('ok');
  } catch (err) {
    return resposta_('erro: ' + err.message);
  } finally {
    trava.releaseLock();
  }
}

// abrir a URL no navegador mostra se o script está no ar
function doGet() {
  return resposta_('Mohamed: relatório no ar ✔');
}

function pegarAba_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
  }
  return aba;
}

// impede que um texto enviado vire fórmula na planilha
function limpar_(v) {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function resposta_(txt) {
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.TEXT);
}
