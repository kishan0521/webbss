
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 480;
const H = 640;

canvas.width = W;
canvas.height = H;

const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("messageTitle");
const textEl = document.getElementById("messageText");
const startBtn = document.getElementById("startBtn");

let running = false;
let score = 0;
let coins = 0;
let speed = 0.42;
let spawnTimer = 0;
let lastTime = 0;
let distance = 0;
let objects = [];
let best = 0;

try {
  best = Number(localStorage.getItem("runnerBest")) || 0;
} catch (error) {
  best = 0;
}

bestEl.textContent = best;

const player = {
  lane: 0,
  x: 0,
  jump: 0,
  slide: 0
};

function resetGame() {
  score = 0;
  coins = 0;
  speed = 0.42;
  spawnTimer = 0;
  distance = 0;
  objects = [];

  player.lane = 0;
  player.x = 0;
  player.jump = 0;
  player.slide = 0;

  scoreEl.textContent = "0";
  coinsEl.textContent = "0";

  running = true;
  overlay.classList.add("hidden");
  lastTime = performance.now();
}

function endGame() {
  running = false;

  if (score > best) {
    best = score;
    bestEl.textContent = best;

    try {
      localStorage.setItem("runnerBest", best);
    } catch (error) {
      // The game still works if storage is unavailable.
    }
  }

  titleEl.textContent = "GAME OVER!";
  textEl.textContent =
    `Score: ${score} | Coins: ${coins}. Try again!`;
  startBtn.textContent = "PLAY AGAIN";
  overlay.classList.remove("hidden");
}

function moveLeft() {
  if (running) {
    player.lane = Math.max(-1, player.lane - 1);
  }
}

function moveRight() {
  if (running) {
    player.lane = Math.min(1, player.lane + 1);
  }
}

function jump() {
  if (running && player.jump <= 0 && player.slide <= 0) {
    player.jump = 0.85;
  }
}

function slide() {
  if (running && player.slide <= 0 && player.jump <= 0) {
    player.slide = 0.65;
  }
}

function handleAction(action) {
  if (action === "left") moveLeft();
  if (action === "right") moveRight();
  if (action === "jump") jump();
  if (action === "slide") slide();
}

document.addEventListener("keydown", event => {
  const keys = [
    "ArrowLeft", "ArrowRight", "ArrowUp",
    "ArrowDown", "Space"
  ];

  if (keys.includes(event.code)) event.preventDefault();

  if (event.repeat) return;

  if (event.code === "ArrowLeft" || event.code === "KeyA")
    moveLeft();

  if (event.code === "ArrowRight" || event.code === "KeyD")
    moveRight();

  if (event.code === "ArrowUp" || event.code === "Space" ||
      event.code === "KeyW")
    jump();

  if (event.code === "ArrowDown" || event.code === "KeyS")
    slide();
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    handleAction(button.dataset.action);
  });
});

startBtn.addEventListener("click", resetGame);

// Draw the sky, city and perspective railway tracks.
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#58bde9");
  sky.addColorStop(0.45, "#d0f2ff");
  sky.addColorStop(1, "#7eaf70");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  ctx.fillStyle = "#fff3a0";
  ctx.beginPath();
  ctx.arc(385, 80, 36, 0, Math.PI * 2);
  ctx.fill();

  // City buildings
  for (let i = 0; i < 12; i++) {
    const bw = 28 + (i % 3) * 12;
    const bh = 55 + ((i * 37) % 85);
    const bx = i * 43 - 10;
    const by = 205 - bh;

    ctx.fillStyle = i % 2 ? "#779ab4" : "#8baec3";
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = "#d6eddf";
    for (let wy = by + 12; wy < 190; wy += 18) {
      for (let wx = bx + 7; wx < bx + bw - 5; wx += 14) {
        ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }

  // Grass beside the tracks
  ctx.fillStyle = "#56894e";
  ctx.fillRect(0, 205, W, H - 205);

  // Track trapezoid
  ctx.fillStyle = "#5c626a";
  ctx.beginPath();
  ctx.moveTo(207, 190);
  ctx.lineTo(273, 190);
  ctx.lineTo(470, H);
  ctx.lineTo(10, H);
  ctx.closePath();
  ctx.fill();

  // Outer track edges
  ctx.strokeStyle = "#f6e9c5";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(207, 190);
  ctx.lineTo(10, H);
  ctx.moveTo(273, 190);
  ctx.lineTo(470, H);
  ctx.stroke();

  // Three lanes and moving sleepers
  for (let i = 1; i <= 2; i++) {
    const topX = 207 + i * 22;
    const bottomX = 10 + i * (460 / 3);

    ctx.strokeStyle = "#c1c6ca";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(topX, 190);
    ctx.lineTo(bottomX, H);
    ctx.stroke();
  }

  // Railway sleepers moving toward the player
  for (let i = 0; i < 18; i++) {
    let z = ((i / 18) + distance) % 1;
    const y = 190 + z * z * 450;
    const halfWidth = 33 + z * 197;

    ctx.strokeStyle = "#343d47";
    ctx.lineWidth = 2 + z * 5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfWidth, y);
    ctx.lineTo(W / 2 + halfWidth, y);
    ctx.stroke();
  }
}

function laneX(lane, z) {
  return W / 2 + lane * (22 + z * 105);
}

function objectY(z) {
  return 190 + z * z * 450;
}

function spawnObject() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const choice = Math.random();

  if (choice < 0.40) {
    objects.push({ lane, z: 0, type: "coin" });
    objects.push({ lane, z: -0.13, type: "coin" });
    objects.push({ lane, z: -0.26, type: "coin" });
  } else if (choice < 0.72) {
    objects.push({ lane, z: 0, type: "block" });
  } else if (choice < 0.87) {
    objects.push({ lane, z: 0, type: "barrier" });
  } else {
    objects.push({ lane, z: 0, type: "overhead" });
  }
}

function drawObject(obj) {
  const x = laneX(obj.lane, obj.z);
  const y = objectY(obj.z);
  const s = 0.25 + obj.z * 1.5;

  if (obj.type === "coin") {
    ctx.fillStyle = "#ffcb22";
    ctx.strokeStyle = "#fff19a";
    ctx.lineWidth = 2 * s;

    ctx.beginPath();
    ctx.ellipse(x, y, 10 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e58c00";
    ctx.font = `bold ${Math.max(8, 13 * s)}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("$", x, y + 5 * s);
    return;
  }

  if (obj.type === "block") {
    ctx.fillStyle = "#d94836";
    ctx.fillRect(x - 18 * s, y - 42 * s, 36 * s, 42 * s);

    ctx.fillStyle = "#ffb19a";
    ctx.fillRect(x - 12 * s, y - 35 * s, 24 * s, 7 * s);

    ctx.fillStyle = "#933225";
    ctx.fillRect(x - 18 * s, y - 8 * s, 36 * s, 8 * s);
  }

  if (obj.type === "barrier") {
    ctx.fillStyle = "#f8f1dd";
    ctx.fillRect(x - 24 * s, y - 24 * s, 48 * s, 24 * s);

    ctx.fillStyle = "#e84c3d";
    ctx.fillRect(x - 24 * s, y - 24 * s, 48 * s, 7 * s);
    ctx.fillRect(x - 24 * s, y - 8 * s, 48 * s, 7 * s);
  }

  if (obj.type === "overhead") {
    ctx.fillStyle = "#3b465b";
    ctx.fillRect(x - 25 * s, y - 55 * s, 50 * s, 13 * s);

    ctx.fillStyle = "#ffcf35";
    ctx.fillRect(x - 22 * s, y - 52 * s, 44 * s, 4 * s);
  }
}

function drawPlayer() {
  const groundY = 560;
  const x = laneX(player.x, 1);
  const lift = player.jump > 0
    ? Math.sin((player.jump / 0.85) * Math.PI) * 110
    : 0;

  const y = groundY - lift;
  const sliding = player.slide > 0;

  // Shadow
  ctx.fillStyle = "#17212b55";
  ctx.beginPath();
  ctx.ellipse(x, groundY + 4, sliding ? 35 : 22, 8, 0, 0,
    Math.PI * 2);
  ctx.fill();

  if (sliding) {
    // Sliding body
    ctx.fillStyle = "#ffb52e";
    ctx.fillRect(x - 29, y - 28, 54, 22);

    ctx.fillStyle = "#ffd5a4";
    ctx.beginPath();
    ctx.arc(x + 24, y - 20, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#263b63";
    ctx.fillRect(x - 24, y - 8, 30, 9);
    return;
  }

  // Legs
  ctx.strokeStyle = "#23375e";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";

  const run = running ? Math.sin(distance * 65) * 10 : 0;

  ctx.beginPath();
  ctx.moveTo(x - 7, y - 30);
  ctx.lineTo(x - 10 + run, y - 4);
  ctx.moveTo(x + 7, y - 30);
  ctx.lineTo(x + 10 - run, y - 4);
  ctx.stroke();

  // Arms
  ctx.strokeStyle = "#ffd0a1";
  ctx.lineWidth = 8;

  ctx.beginPath();
  ctx.moveTo(x - 12, y - 68);
  ctx.lineTo(x - 23 - run, y - 45);
  ctx.moveTo(x + 12, y - 68);
  ctx.lineTo(x + 23 + run, y - 48);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#ff9f1c";
  ctx.fillRect(x - 15, y - 75, 30, 43);

  // Face
  ctx.fillStyle = "#f4bd8b";
  ctx.beginPath();
  ctx.arc(x, y - 87, 16, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = "#36251e";
  ctx.beginPath();
  ctx.arc(x, y - 94, 15, Math.PI, Math.PI * 2);
  ctx.fill();

  // Backpack
  ctx.fillStyle = "#3279e8";
  ctx.fillRect(x - 21, y - 72, 8, 27);
}

function update(dt) {
  if (!running) return;

  distance += dt * speed * 0.15;
  score += Math.floor(dt * 20);
  speed = Math.min(0.85, speed + dt * 0.008);

  player.x += (player.lane - player.x) *
    Math.min(1, dt * 12);

  player.jump = Math.max(0, player.jump - dt);
  player.slide = Math.max(0, player.slide - dt);

  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    spawnObject();
    spawnTimer = Math.max(0.48, 0.95 - speed * 0.4);
  }

  for (const obj of objects) {
    obj.z += dt * speed;

    if (obj.z > 0.87 && obj.z < 1.02 &&
        Math.abs(player.x - obj.lane) < 0.34) {

      if (obj.type === "coin" && !obj.collected) {
        obj.collected = true;
        coins++;
        score += 50;
      }

      if (obj.type !== "coin" && !obj.checked) {
        obj.checked = true;

        const avoided =
          (obj.type === "barrier" && player.jump > 0.12) ||
          (obj.type === "overhead" && player.slide > 0.10);

        if (!avoided) {
          endGame();
          return;
        }
      }
    }
  }

  objects = objects.filter(obj =>
    obj.z < 1.15 && !obj.collected
  );

  scoreEl.textContent = score;
  coinsEl.textContent = coins;
}

function render() {
  drawBackground();

  // Draw objects from farthest to nearest
  const sorted = [...objects].sort((a, b) => a.z - b.z);

  for (const obj of sorted) {
    if (obj.z >= 0) drawObject(obj);
  }

  drawPlayer();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.04);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(timestamp => {
  lastTime = timestamp;
  loop(timestamp);
});
