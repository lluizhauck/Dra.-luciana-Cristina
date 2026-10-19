/* =====================================================================
   config.js — configuração do Laboratório de Código: Missões
   Este é o ÚNICO arquivo que o professor precisa editar.
   ===================================================================== */
window.LAB_CONFIG = {
  nomeSistema: 'Laboratório de Código',
  subtitulo: 'Missões',

  // Turmas que aparecem na primeira tela. O "id" entra na chave de
  // armazenamento (lab:v1:turma300:...). NÃO mude o id de uma turma que já
  // tem dados: crie uma nova entrada. Pode mudar o "nome" à vontade.
  turmas: [
    { id: '300', nome: 'Turma 300' },
    { id: '301', nome: 'Turma 301' }
  ],

  // Hash da senha do professor (PBKDF2-SHA256). Gere um novo em gerar-hash.html
  // e cole aqui. A senha em si NUNCA deve ser escrita neste arquivo.
  // (O hash abaixo é o da senha de teste descrita no README. Troque!)
  senhaProfessor: {
    algoritmo: 'PBKDF2-SHA256',
    iteracoes: 120000,
    sal: 'f9eb0631dcb4aef98952dce7c8aa9788',
    hash: '3f0c74e169a6114e71dfbc7544177999757129732d1d3620dd3a98dd221a4370'
  },

  // Quanto tempo o modo professor fica desbloqueado (só na memória).
  minutosDesbloqueio: 10,

  // Bloqueio progressivo depois de senha errada (em segundos).
  bloqueiosSenha: [30, 60, 300],

  // Trilha ativa e arquivos de missão (carregados nesta ordem).
  // Para trocar de capítulo: crie missoes/cap5/..., mude "trilha" e a lista.
  // O progresso de cada trilha fica guardado separado; nada é apagado.
  trilha: 'cap4',
  arquivosMissoes: [
    'missoes/cap4/assets.js',
    'missoes/cap4/trilha.js',
    'missoes/cap4/m01-estrutura.js',
    'missoes/cap4/m02-estilo.js'
  ],

  // Regras pedagógicas
  limiteLinhasMudadas: 5,        // acima disso aparece o aviso "mudou coisa demais"
  tentativasParaSolucao: 3,      // tentativas COM hipótese antes de liberar a solução comentada
  minCaracteresHipotese: 25,
  minCaracteresExplicacao: 40,
  maxSnapshotsPorMissao: 40,

  // Endereço que aparece na barra falsa do navegador
  enderecoSite: 'acaiecia.com.br'
};
