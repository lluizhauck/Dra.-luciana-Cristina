/* =====================================================================
   trilha.js — Capítulo 4: a ordem das 8 missões.
   Missões sem arquivo carregado aparecem como "em preparação".
   Os ids (cap4-m1...) são a chave do progresso salvo: NÃO os mude.
   ===================================================================== */
window.Lab.registrarTrilha({
  id: 'cap4',
  titulo: 'Açaí & Cia: do rascunho ao site de vendas',
  descricao: 'Capítulo 4 do livro Projeto de Aplicações Web: HTML, CSS, JavaScript e DOM, formulários, persistência e organização de código. Cada missão é um pedido do Seu Raimundo, dono da açaíteria.',
  missoes: [
    { id: 'cap4-m1', titulo: 'Estrutura (HTML)', minutos: '60–90', resumo: 'O rascunho do primo é só texto corrido. Transforme em uma página estruturada: títulos, parágrafos, listas, imagem e links.', conceitos: ['head/body', 'h1–h6', 'p e br', 'ul/ol/li', 'img', 'a'] },
    { id: 'cap4-m2', titulo: 'Estilo (CSS)', minutos: '60–90', resumo: 'O primo mandou um CSS que "não pega". Vincule a folha de estilo e conserte seletores, cores, fontes e espaçamentos.', conceitos: ['link', 'seletores', 'id × class', 'cores', 'box model', 'cascata'] },
    { id: 'cap4-m3', titulo: 'Interatividade (JS e DOM)', minutos: '60–100', resumo: 'O botão "Adicionar ao pedido" não faz nada. Faça o contador e o total funcionarem.', conceitos: ['querySelector', 'addEventListener', 'textContent', 'string × número'] },
    { id: 'cap4-m4', titulo: 'Formulário e validação', minutos: '60–100', resumo: 'Clientes mandam pedidos sem telefone. Valide o formulário com mensagens claras.', conceitos: ['input', 'required', '.value', 'preventDefault'] },
    { id: 'cap4-m5', titulo: 'Persistência', minutos: '60–100', resumo: 'O pedido some quando a página recarrega. Use localStorage e JSON como um mini back-end.', conceitos: ['localStorage', 'JSON', 'cliente-servidor', 'tabela'] },
    { id: 'cap4-m6', titulo: 'Organização (MVC)', minutos: '70–100', resumo: 'O código virou um espaguete. Separe Model, View e Controller.', conceitos: ['Model', 'View', 'Controller', 'funções'] },
    { id: 'cap4-m7', titulo: 'Responsivo', minutos: '60–90', resumo: '"O site tá feio no celular da minha mãe." Media queries, flex e grid.', conceitos: ['@media', 'flexbox', 'grid', 'viewport'] },
    { id: 'cap4-m8', titulo: 'Entrega final', minutos: '70–100', resumo: 'Feche o pedido completo, passe o checklist de entrega e apresente ao cliente.', conceitos: ['integração', 'checklist', 'entrega'] }
  ]
});
