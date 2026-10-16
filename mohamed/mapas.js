/* Mohamed — mapas.js: os mapas da masmorra em texto, fáceis de editar.

   LEGENDA (uma letra por casa; todas as linhas de um mapa com o mesmo tamanho)
   #  parede                 .  chão                   ~  água (no vulcão é lava): não passa
   =  ponte                  M  mato alto (passa)      S  espinhos: não passa
   o  moeda                  B  baú com desafio        P  porta trancada com desafio
   T  tocha na parede        F  braseiro no chão       (luz e ponto de salvamento)
   @  início                 X  saída: abre quando o objetivo do mapa é cumprido
   m  monstro                E  monstro à espreita (parado no escuro, acorda quando você chega perto)
   C  chefão

   TAMANHO: de 1,5 a 3 telas (a tela mostra 11 casas de largura e uns 16 de altura); no máximo 40 × 30.
   OBJETIVO: 'monstros' (derrotar todos) ou 'chefe' (derrotar o chefão).
   Os baús ficam em becos; a decoração (biomas.js) é espalhada sozinha, sempre igual para cada mapa. */

const MAPAS = {
  // corredores em L e T, clareira com lago, ala atrás da porta e desvio pelo sul (24 × 22)
  clareira: { nome: 'Clareira', objetivo: 'monstros', mapa: [
    '#################T######',
    '#B...####T######.......#',
    '####...o......o......X.#',
    '##########.#####...m...#',
    '##########o#####..o....#',
    '##########.#####......o#',
    '###...........##########',
    '#..M..~~m...F...###...o#',
    '#.....~~~....M..###.o..#',
    'TM...~~~~~.o......P....#',
    '#....~~~....M...###....#',
    '#.E.M......Mm...#####.##',
    '###...........#######o##',
    '###.##########.######B##',
    '###.##########.T########',
    '#.....######.....#######',
    '#...o.T#####.o...#######',
    '#.@...######...m....oo##',
    '#........o.......#######',
    '#.....######....o#######',
    '#....o##################',
    '########################'
  ] },
  // ilhas ligadas por pontes, ilhota de desvio e dois becos com baú (30 × 24)
  ilhas: { nome: 'Ilhas', objetivo: 'monstros', mapa: [
    '##############################',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~.....~~#',
    '#~~~~~~~~~~~.B~~~~~~~.....X.~#',
    '#~~~.....~~~...~~~~~~..o....~#',
    '#~~.F...o.==.o.~~~~~~.......~#',
    '#~~...m...~~~~~~~~~~~......o~#',
    '#~~M......~~~~~~~~~~~.F.....~#',
    '#~~.o.....~~~~~~~~~~~~.....~~#',
    '#~~....M..==~....M~~~~~~=~.B~#',
    '#~~~.....~~=....T#.~~~~~=~.o~#',
    '#~~~~=~~~~~~.......~~~~~=~=~~#',
    '#~~~~=~~~~~~...m..S~~~~~=~=~~#',
    '#~~~~=~~~~~~.o.....~~......~~#',
    '#~~~~=~~~~~~.....o.=........~#',
    '#~~~~=~~~~~~~.....~~........~#',
    '#~~.....~~~~~~=~~~~~..o....M~#',
    '#~.o...Fo~~~....~~~~.S......~#',
    '#~.......===o...~~~~....m...~#',
    '#~..@....~~~..E.~~~~........~#',
    '#~.M.....~~~...~~~~~..M...o.~#',
    '#~~.....~~~~~~~~~~~~~......~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '##############################'
  ] },
  // corredor em T, ala oeste com beco, cofre atrás da porta e salão do chefão (26 × 28)
  fortaleza: { nome: 'Fortaleza', objetivo: 'chefe', mapa: [
    '##########################',
    '##########################',
    '######S.....X......S######',
    '######...o..........######',
    '#..M.#..T...C....T..######',
    '#..o.#.............m######',
    'T.m..#..............######',
    '#....#..#........#..######',
    '#....#.o........o...######',
    '##.#.#S............S######',
    '##.#.#######..############',
    '##o#.#######..############',
    '##.#.#######.o############',
    '##B#.#######..############',
    '####.#######m.############',
    '####.#######..############',
    '####.######T..T###########',
    '####.o..........SS....T###',
    '####................o.####',
    '############..#######.####',
    '############..#######E####',
    '############..#######.####',
    '########..........###P####',
    '#######T..o....o..T.....##',
    '########.F......F.#.o...##',
    '########....@.....#...o.##',
    '########M........M#....B##',
    '##########################'
  ] }
};

// Mapas de cada dia, em ordem: o aluno passa de um para o outro pela saída; o último tem o chefão.
// Para um mundo usar outros mapas: ROTEIRO_MASMORRA[2] = ['ilhas', 'clareira', 'fortaleza'] (0 = mundo 1).
const ROTEIRO_MASMORRA = {
  padrao: ['clareira', 'ilhas', 'fortaleza']
};
