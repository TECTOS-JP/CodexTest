// Grid coordinate system: row increases southward (+Z), column increases eastward (+X).
// A cell is either `null` (a hole — rolling onto it ends the attempt) or an object:
//   { type: 'plain' }                      – just a tile, no effect
//   { type: 'start' }                      – where the cube begins
//   { type: 'goal', target: number }       – reach this with the matching current value to win
//   { type: 'op', op: '+'|'-'|'*'|'/', value: number } – applies to the current value on arrival

function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

function buildLevel({ rows, cols, cells, start, startValue, title, intro }) {
  const grid = emptyGrid(rows, cols);
  for (const [r, c, cell] of cells) {
    grid[r][c] = cell;
  }
  grid[start[0]][start[1]] = { type: 'start' };
  return { grid, start: { row: start[0], col: start[1] }, startValue, title, intro };
}

const op = (operator, value) => ({ type: 'op', op: operator, value });
const plain = { type: 'plain' };
const goal = (target) => ({ type: 'goal', target });

export const LEVELS = [
  // Level 1 — straight line, learn rolling + addition
  buildLevel({
    title: 'はじめての一歩',
    intro: '立方体を転がして上面の数字を変えながらゴールへ。\nまずは足し算タイルだけのシンプルな道。',
    rows: 3,
    cols: 5,
    start: [1, 0],
    startValue: 2,
    cells: [
      [1, 1, plain],
      [1, 2, op('+', 3)],
      [1, 3, plain],
      [1, 4, goal(5)],
    ],
  }),

  // Level 2 — introduces a turn and subtraction
  buildLevel({
    title: '曲がり角と引き算',
    intro: '道が曲がります。引き算タイルで数字を減らそう。\nぴったり目標値でゴールに止まろう。',
    rows: 5,
    cols: 4,
    start: [1, 0],
    startValue: 6,
    cells: [
      [1, 1, plain],
      [1, 2, op('-', 2)],
      [1, 3, plain],
      [2, 3, plain],
      [3, 3, goal(4)],
    ],
  }),

  // Level 3 — introduces multiplication
  buildLevel({
    title: 'かけ算で一気に',
    intro: 'かけ算タイルは数字を一気に増やす。\n通る順番をよく考えよう。',
    rows: 4,
    cols: 5,
    start: [2, 0],
    startValue: 3,
    cells: [
      [2, 1, plain],
      [2, 2, op('*', 3)],
      [2, 3, plain],
      [1, 3, op('+', 1)],
      [0, 3, goal(10)],
    ],
  }),

  // Level 4 — introduces division
  buildLevel({
    title: '割り算で調整',
    intro: '割り算タイルでぴったりの数に近づけよう。\n割り切れない数で踏むと中途半端な値になるので注意。',
    rows: 5,
    cols: 5,
    start: [4, 0],
    startValue: 8,
    cells: [
      [4, 1, op('/', 2)],
      [4, 2, plain],
      [4, 3, op('+', 5)],
      [3, 3, plain],
      [2, 3, op('*', 2)],
      [1, 3, plain],
      [0, 3, goal(18)],
    ],
  }),

  // Level 5 — negative numbers appear
  buildLevel({
    title: 'マイナスの世界',
    intro: '引きすぎるとマイナスになることも。\n負の数のまま計算が続くので符号に気をつけて。',
    rows: 5,
    cols: 6,
    start: [2, 0],
    startValue: 5,
    cells: [
      [2, 1, op('-', 8)],
      [2, 2, op('+', 10)],
      [2, 3, op('*', 2)],
      [2, 4, plain],
      [1, 4, op('-', 6)],
      [0, 4, goal(8)],
    ],
  }),

  // Level 6 — final, long combined challenge
  buildLevel({
    title: '最終チャレンジ',
    intro: 'すべてのタイルが登場する集大成のステージ。\n一手ごとに数字を計算しながら、ぴったりの道を見つけよう。',
    rows: 6,
    cols: 6,
    start: [5, 0],
    startValue: 1,
    cells: [
      [5, 1, op('*', 6)],
      [5, 2, op('+', 7)],
      [5, 3, plain],
      [4, 3, op('-', 4)],
      [3, 3, op('*', 3)],
      [3, 2, plain],
      [3, 1, op('/', 3)],
      [2, 1, op('+', 1)],
      [1, 1, plain],
      [0, 1, goal(10)],
    ],
  }),
];
