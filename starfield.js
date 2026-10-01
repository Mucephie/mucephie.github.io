const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");

const DENSITY = 0.002;
const flicker = 0.005;   // flicker/twinkle speed
const TINTS = ["#9bb0ff", "#cad7ff", "#f8f7ff", "#fff4ea", "#ffd2a1", "#ffb56c", "#ff7700"];
let stars = [];

// ---- Nebula ----
const NEB_SCALE = 10;          // bigger = cheaper, blurrier
const NEB_INTERVAL = 100;     // ms between nebula recomputes
const NEB_INTENSITY = 0.55;
const neb = document.createElement("canvas");
const nctx = neb.getContext("2d");
let nebImg;
let lastNeb = -Infinity;
const seedX = Math.random() * 1000;
const seedY = Math.random() * 1000;

function hash(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, octaves) {
    let sum = 0, amp = 0.5;
    for (let i = 0; i < octaves; i++) {
        sum += amp * noise(x, y);
        x = x * 2 + 17; y = y * 2 + 31;
        amp *= 0.5;
    }
    return sum;
}

const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

function renderNebula(t) {
    const w = neb.width, h = neb.height, d = nebImg.data;
    const drift = t * 0.00001; // sets the drift speed 0.00002
    let i = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const nx = (x / h) * 2.5 + seedX;
            const ny = (y / h) * 2.5 + seedY;

            const q = fbm(nx + drift, ny, 3);                          // warp field
            const n = fbm(nx + q * 1.5 + drift, ny + q * 1.5 - drift * 0.5, 5);
            const mask = smoothstep(0.38, 0.8, n);

            const c = smoothstep(0.3, 0.7, fbm(nx * 0.5 + 50, ny * 0.5 + 50, 3));
            // purple -> teal blend, pink highlights in dense regions
            d[i++] = 100 - 80 * c + 90 * mask * mask;   // R
            d[i++] = 80 + 70 * c;                       // G 40
            d[i++] = 100 + 10 * c;                      // B 160
            d[i++] = mask * NEB_INTENSITY * 255;        // A
        }
    }
    nctx.putImageData(nebImg, 0, 0);
}

// ---- Stars ----
// ---- Parallax ----
const PARALLAX = 40;        // max px shift for nearest stars
const NEB_PARALLAX = 10;    // max px shift for nebula
const EASE = 0.05;          // lower = floatier
let tx = 0, ty = 0, mx = 0, my = 0;

addEventListener("mousemove", e => {
    tx = (e.clientX / innerWidth - 0.5) * 2;   // -1..1
    ty = (e.clientY / innerHeight - 0.5) * 2;
});

// ---- Attraction ----
const RADIUS = 160;     // px, pull range
const PULL = 0.7;       // pull strength at the cursor
const SPRING = 0.03;    // snap-back stiffness
const DAMP = 0.86;      // lower = less bouncy
let cx = -9999, cy = -9999;

addEventListener("pointermove", e => { cx = e.clientX; cy = e.clientY; });
document.addEventListener("mouseleave", () => { cx = cy = -9999; });

function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    neb.width = Math.ceil(innerWidth / NEB_SCALE);
    neb.height = Math.ceil(innerHeight / NEB_SCALE);
    nebImg = nctx.createImageData(neb.width, neb.height);
    lastNeb = -Infinity;

    const n = Math.floor(innerWidth * innerHeight * DENSITY);
    stars = Array.from({ length: n }, () => {
        const r = Math.random() ** 3 * 1.6 + 0.3;
        return {
            x: Math.random() * innerWidth,
            y: Math.random() * innerHeight,
            r,
            z: (r - 0.3) / 1.6,                       // 0 = far, 1 = near
            color: TINTS[Math.floor(Math.random() * TINTS.length)],
            phase: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 1.5,
            ox: 0, 
            oy: 0, 
            vx: 0, 
            vy: 0,
        };
    });
}

function draw(t) {
  const w = innerWidth, h = innerHeight;
  mx += (tx - mx) * EASE;
  my += (ty - my) * EASE;

  ctx.clearRect(0, 0, w, h);

  if (t - lastNeb > NEB_INTERVAL) { renderNebula(t); lastNeb = t; }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const p = NEB_PARALLAX;
  ctx.drawImage(neb, -p - mx * p, -p - my * p, w + 2 * p, h + 2 * p);

  for (const s of stars) {
  const k = PARALLAX * (0.15 + s.z);
  const bx = (((s.x - mx * k) % w) + w) % w;
  const by = (((s.y - my * k) % h) + h) % h;

  // pull toward cursor
  const dx = cx - (bx + s.ox), dy = cy - (by + s.oy);
  const d = Math.hypot(dx, dy);
  if (d < RADIUS && d > 1) {
    const f = (1 - d / RADIUS) * PULL;
    s.vx += (dx / d) * f;
    s.vy += (dy / d) * f;
  }

  // spring home + damping
  s.vx = (s.vx - s.ox * SPRING) * DAMP;
  s.vy = (s.vy - s.oy * SPRING) * DAMP;
  s.ox += s.vx;
  s.oy += s.vy;

  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * flicker * s.speed + s.phase);
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(bx + s.ox, by + s.oy, s.r, 0, Math.PI * 2);
  ctx.fill();
}
  requestAnimationFrame(draw);
}

addEventListener("resize", resize);
resize();
requestAnimationFrame(draw);