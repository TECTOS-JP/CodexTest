import * as THREE from 'three';
import { LEVELS } from './levels.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const container = document.getElementById('canvas-container');
const levelNumEl = document.getElementById('level-num');
const moveCountEl = document.getElementById('move-count');
const currentValueEl = document.getElementById('current-value');
const targetValueEl = document.getElementById('target-value');
const restartBtn = document.getElementById('restart-btn');
const overlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageBtn = document.getElementById('message-btn');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TILE_SIZE = 1.6;
const TILE_THICKNESS = 0.22;
const CUBE_SIZE = TILE_SIZE * 0.92;
const HALF_CUBE = CUBE_SIZE / 2;
const ROLL_DURATION = 260; // ms

const DIRECTIONS = {
  north: { dr: -1, dc: 0 },
  south: { dr: 1, dc: 0 },
  east: { dr: 0, dc: 1 },
  west: { dr: 0, dc: -1 },
};

const TILE_COLORS = {
  start: 0x4cc9f0,
  plain: 0x335577,
  goal: 0xf72585,
  op: {
    '+': 0x6fcf97,
    '-': 0xf2994a,
    '*': 0x9b5de5,
    '/': 0x4895ef,
  },
};

// ---------------------------------------------------------------------------
// Three.js scene setup
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1018);
scene.fog = new THREE.FogExp2(0x0c1018, 0.05);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x1a1f2b, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(6, 10, 4);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 40;
dirLight.shadow.camera.left = -12;
dirLight.shadow.camera.right = 12;
dirLight.shadow.camera.top = 12;
dirLight.shadow.camera.bottom = -12;
scene.add(dirLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function worldX(col) {
  return col * TILE_SIZE;
}
function worldZ(row) {
  return row * TILE_SIZE;
}

function makeLabelTexture(text, bgColor, textColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = textColor;
  ctx.font = 'bold 110px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function colorToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function formatNumber(n) {
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---------------------------------------------------------------------------
// Tile construction
// ---------------------------------------------------------------------------
function tileLabel(cell) {
  if (cell.type === 'goal') return `=${cell.target}`;
  if (cell.type === 'op') {
    const symbol = { '+': '+', '-': '-', '*': '×', '/': '÷' }[cell.op];
    return `${symbol}${cell.value}`;
  }
  return '';
}

function tileColor(cell) {
  if (cell.type === 'op') return TILE_COLORS.op[cell.op];
  return TILE_COLORS[cell.type] ?? TILE_COLORS.plain;
}

function buildTileMesh(cell, row, col) {
  const group = new THREE.Group();
  const baseColor = tileColor(cell);
  const geo = new THREE.BoxGeometry(TILE_SIZE * 0.94, TILE_THICKNESS, TILE_SIZE * 0.94);
  const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.55, metalness: 0.1 });
  const base = new THREE.Mesh(geo, mat);
  base.position.y = -TILE_THICKNESS / 2;
  base.receiveShadow = true;
  group.add(base);

  const label = tileLabel(cell);
  if (label) {
    const texture = makeLabelTexture(label, colorToCss(baseColor), '#ffffff');
    const planeGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.7, TILE_SIZE * 0.7);
    const planeMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01;
    group.add(plane);
  }

  group.position.set(worldX(col), 0, worldZ(row));
  return group;
}

// ---------------------------------------------------------------------------
// Cube construction
// ---------------------------------------------------------------------------
let cube;
let cubeMaterials;

function createCube() {
  cubeMaterials = [];
  const geo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  for (let i = 0; i < 6; i++) {
    cubeMaterials.push(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 }));
  }
  const mesh = new THREE.Mesh(geo, cubeMaterials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function updateCubeFaces(value) {
  const texture = makeLabelTexture(formatNumber(value), '#ffe066', '#222244');
  for (const mat of cubeMaterials) {
    if (mat.map) mat.map.dispose();
    mat.map = texture;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let levelIndex = 0;
let level = null;
let cubeRowCol = { row: 0, col: 0 };
let currentValue = 0;
let moveCount = 0;
let isAnimating = false;
let isGameActive = false;
let levelGroup = null;

const cameraOffset = new THREE.Vector3(6.5, 7.5, 7.5);
const cameraTarget = new THREE.Vector3();
const cameraLookAt = new THREE.Vector3();

function cellAt(row, col) {
  if (row < 0 || row >= level.grid.length) return null;
  if (col < 0 || col >= level.grid[row].length) return null;
  return level.grid[row][col];
}

function clearLevelGroup() {
  if (levelGroup) {
    scene.remove(levelGroup);
    levelGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    levelGroup = null;
  }
}

function loadLevel(index) {
  clearLevelGroup();
  levelIndex = index;
  level = LEVELS[index];

  levelGroup = new THREE.Group();
  for (let r = 0; r < level.grid.length; r++) {
    for (let c = 0; c < level.grid[r].length; c++) {
      const cell = level.grid[r][c];
      if (cell) {
        levelGroup.add(buildTileMesh(cell, r, c));
      }
    }
  }
  scene.add(levelGroup);

  if (!cube) {
    cube = createCube();
    scene.add(cube);
  }

  cubeRowCol = { row: level.start.row, col: level.start.col };
  currentValue = level.startValue;
  moveCount = 0;
  cube.position.set(worldX(cubeRowCol.col), HALF_CUBE, worldZ(cubeRowCol.row));
  cube.quaternion.identity();
  updateCubeFaces(currentValue);
  updateHUD();

  // Position camera immediately at the follow target (no lerp-in from old spot)
  cameraTarget.set(worldX(cubeRowCol.col), 0, worldZ(cubeRowCol.row));
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);

  isAnimating = false;
  isGameActive = true;

  showMessage(level.title, level.intro, 'はじめる', () => hideMessage());
}

// ---------------------------------------------------------------------------
// HUD & overlay
// ---------------------------------------------------------------------------
function updateHUD() {
  levelNumEl.textContent = `${levelIndex + 1} / ${LEVELS.length}`;
  moveCountEl.textContent = `${moveCount}`;
  currentValueEl.textContent = formatNumber(currentValue);
  targetValueEl.textContent = formatNumber(findGoalTarget());
}

function findGoalTarget() {
  for (const row of level.grid) {
    for (const cell of row) {
      if (cell && cell.type === 'goal') return cell.target;
    }
  }
  return 0;
}

let messageAction = null;
function showMessage(title, text, buttonLabel, action) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  messageBtn.textContent = buttonLabel;
  messageAction = action;
  overlay.classList.remove('hidden');
}
function hideMessage() {
  overlay.classList.add('hidden');
  messageAction = null;
}
messageBtn.addEventListener('click', () => {
  const action = messageAction;
  hideMessage();
  if (action) action();
});

// ---------------------------------------------------------------------------
// Movement & game logic
// ---------------------------------------------------------------------------
function attemptMove(direction) {
  if (!isGameActive || isAnimating) return;
  const delta = DIRECTIONS[direction];
  if (!delta) return;

  const targetRow = cubeRowCol.row + delta.dr;
  const targetCol = cubeRowCol.col + delta.dc;
  const targetCell = cellAt(targetRow, targetCol);

  if (!targetCell) {
    bumpCube(delta);
    return;
  }

  rollCube(delta, targetRow, targetCol, targetCell);
}

function bumpCube(delta) {
  if (isAnimating) return;
  isAnimating = true;
  const dir = new THREE.Vector3(delta.dc, 0, delta.dr).normalize();
  const start = cube.position.clone();
  const peak = start.clone().add(dir.multiplyScalar(0.18));
  const startTime = performance.now();
  const duration = 160;

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const phase = Math.sin(t * Math.PI); // 0 -> 1 -> 0
    cube.position.lerpVectors(start, peak, phase);
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      cube.position.copy(start);
      isAnimating = false;
    }
  }
  requestAnimationFrame(animate);
}

function rollCube(delta, targetRow, targetCol, targetCell) {
  isAnimating = true;
  moveCount += 1;
  updateHUD();

  const dir = new THREE.Vector3(delta.dc, 0, delta.dr);
  const axis = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const pivotPos = cube.position
    .clone()
    .add(dir.clone().multiplyScalar(HALF_CUBE))
    .add(new THREE.Vector3(0, -HALF_CUBE, 0));

  const pivot = new THREE.Group();
  pivot.position.copy(pivotPos);
  scene.add(pivot);
  pivot.attach(cube);

  const startQuat = pivot.quaternion.clone();
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, -Math.PI / 2);
  const endQuat = deltaQuat.clone().multiply(startQuat);

  const startTime = performance.now();

  function animate(now) {
    const t = Math.min((now - startTime) / ROLL_DURATION, 1);
    const eased = easeInOutQuad(t);
    pivot.quaternion.slerpQuaternions(startQuat, endQuat, eased);
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.attach(cube);
      scene.remove(pivot);
      cube.position.set(worldX(targetCol), HALF_CUBE, worldZ(targetRow));
      cubeRowCol = { row: targetRow, col: targetCol };
      isAnimating = false;
      resolveLanding(targetCell);
    }
  }
  requestAnimationFrame(animate);
}

function resolveLanding(cell) {
  if (cell.type === 'op') {
    switch (cell.op) {
      case '+': currentValue += cell.value; break;
      case '-': currentValue -= cell.value; break;
      case '*': currentValue *= cell.value; break;
      case '/': currentValue /= cell.value; break;
    }
    currentValue = Math.round(currentValue * 1000) / 1000;
  }
  updateCubeFaces(currentValue);
  updateHUD();

  if (cell.type === 'goal' && Math.abs(currentValue - cell.target) < 1e-6) {
    handleWin();
  }
}

function handleWin() {
  isGameActive = false;
  const isLast = levelIndex === LEVELS.length - 1;
  if (isLast) {
    showMessage(
      'クリア！',
      `全レベルをクリアしました！\n手数: ${moveCount}\nおめでとうございます！`,
      'もう一度遊ぶ',
      () => loadLevel(0)
    );
  } else {
    showMessage(
      'ゴール！',
      `ぴったり ${formatNumber(currentValue)} でゴールしました。\n手数: ${moveCount}`,
      '次のレベルへ',
      () => loadLevel(levelIndex + 1)
    );
  }
}

restartBtn.addEventListener('click', () => {
  if (!level) return;
  loadLevel(levelIndex);
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const KEY_DIRECTIONS = {
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowLeft: 'west',
  ArrowRight: 'east',
  w: 'north',
  s: 'south',
  a: 'west',
  d: 'east',
};

window.addEventListener('keydown', (e) => {
  const direction = KEY_DIRECTIONS[e.key];
  if (direction) {
    e.preventDefault();
    attemptMove(direction);
  }
});

for (const btn of document.querySelectorAll('.ctrl-btn')) {
  btn.addEventListener('click', () => attemptMove(btn.dataset.dir));
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
function tick() {
  requestAnimationFrame(tick);

  if (cube) {
    cameraTarget.lerp(new THREE.Vector3(cube.position.x, 0, cube.position.z), 0.12);
    const desiredCamPos = cameraTarget.clone().add(cameraOffset);
    camera.position.lerp(desiredCamPos, 0.12);
    cameraLookAt.lerp(new THREE.Vector3(cube.position.x, cube.position.y, cube.position.z), 0.2);
    camera.lookAt(cameraLookAt);
  }

  renderer.render(scene, camera);
}

loadLevel(0);
tick();
