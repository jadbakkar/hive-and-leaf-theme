const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const msgEl = document.getElementById('msg');

const SIZE = 18;
const CELL = canvas.width / SIZE;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

let bee, dir, nextDir, flower, score, timer, running;
let best = Number(localStorage.getItem('beeSnakeBest')) || 0;
bestEl.textContent = best;

function reset() {
  bee = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }];
  dir = nextDir = DIRS.right;
  score = 0;
  scoreEl.textContent = 0;
  placeFlower();
  draw();
}

function placeFlower() {
  do {
    flower = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
  } while (bee.some(s => s.x === flower.x && s.y === flower.y));
}

function start() {
  if (running) return;
  reset();
  running = true;
  msgEl.textContent = 'Collect the flowers!';
  timer = setInterval(tick, 120);
}

function gameOver() {
  clearInterval(timer);
  running = false;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    try { localStorage.setItem('beeSnakeBest', best); } catch (e) {}
  }
  msgEl.textContent = `Game over! ${score} pollen. Press a direction to retry.`;
}

function tick() {
  dir = nextDir;
  const head = { x: bee[0].x + dir[0], y: bee[0].y + dir[1] };
  const hitWall = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
  if (hitWall || bee.some(s => s.x === head.x && s.y === head.y)) return gameOver();

  bee.unshift(head);
  if (head.x === flower.x && head.y === flower.y) {
    score++;
    scoreEl.textContent = score;
    placeFlower();
  } else {
    bee.pop();
  }
  draw();
}

function emoji(char, cell) {
  ctx.font = `${CELL * 0.85}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2 + 1);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  emoji('🌼', flower);
  bee.forEach((s, i) => {
    if (i === 0) return emoji('🐝', s);
    ctx.fillStyle = i % 2 ? '#f5b700' : '#3b2a10';
    ctx.beginPath();
    ctx.arc(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, CELL * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function steer(name) {
  const d = DIRS[name];
  if (!running) start();
  // block 180° turns
  if (d[0] !== -dir[0] || d[1] !== -dir[1]) nextDir = d;
}

const KEYS = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
};
document.addEventListener('keydown', e => {
  const name = KEYS[e.key];
  if (name) { e.preventDefault(); steer(name); }
});

document.querySelectorAll('.pad button').forEach(b =>
  b.addEventListener('click', () => steer(b.dataset.dir)));

let touch;
canvas.addEventListener('touchstart', e => { touch = e.touches[0]; });
canvas.addEventListener('touchend', e => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.clientX;
  const dy = e.changedTouches[0].clientY - touch.clientY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

reset();
