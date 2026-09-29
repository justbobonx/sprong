/*
  sprong is tennis pong ?
  NO.  It is SPRONG.
  Goals on the ends. Walls bounce. Mouth eats the ball.
 */
const REF_W = 800;
const MAX_RADIUS = 200;
const WAVE_SPEED = 800;
const TOSS_MS = 1400;
const POINT_PAUSE_MS = 900;
const DEAD_FADE_MS = 520;
const KILL_X_ARM = 9 * 0.8;
const KILL_X_PULL = 0.3;
const TARGET_W_PERC = 0.25;
const TARGET_H_PERC = 0.4;
const GAMES_PER_SET = 3;
const NEON = "#39ff14";
const BALL = "#eeee33";
const BG_COL = "#020805";
const PCOL = ["#ff9900", "#0099ff"];
const PCOL_RGB = ["255,153,0", "0,153,255"];
const MARK_FOR = "#ff3b3b";
const MARK_AGAINST = "#888888";

const CAL_ADJ_MIN = 0.5;
const CAL_ADJ_MAX = 1.5;
const CAL_STEPS = 5;
const CAL_LS_KEY = "sprong-cal";

const RESET_HOLD_MS = 2000;
let resetHoldTimer = 0;
let resetHoldStart = 0;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const APP_VERSION = ((document.getElementById("sprong-version") || {}).textContent || "").trim();

var messageText = "";

var state = {
  w: 0,
  h: 0,
  targetW: 0,
  targetH: 0,
  goalY0: 0,
  goalY1: 0,
  viewW: 0,
  viewH: 0,
  dpr: 1,
  portrait: false,
  mode: "init",
  server: 0,
  scores: [{p:0,g:0,s:0}, {p:0,g:0,s:0}],
  showGames: 0,
  ball: ballFresh(),
  tossT: 0,
  waves: [],
  pauseT: 0,
  scoredBy: -1,
  lastHitter: -1,
  rallyMax: VOLLEY_MAX_START,
  scale: 1,
  marks: [],
  deadFade: 1,
  last: 0,
};

var calPick = { ball: 1, racket: 1 };
var calBtn = { x0: 0, y0: 0, x1: 0, y1: 0 };

function saveState() {
  try {
    localStorage.setItem('state', JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('state');
    if (raw == null) return;
    const loaded = JSON.parse(raw);
    loaded.last = 0;
    if (!loaded.ball || typeof loaded.ball !== "object") loaded.ball = ballFresh();
    else {
      if (!loaded.ball.trail) loaded.ball.trail = [];
      if (loaded.ball.vz == null) loaded.ball.vz = 0;
      if (loaded.ball.trailT == null) loaded.ball.trailT = 0;
    }
    if (loaded.rallyMax == null) loaded.rallyMax = VOLLEY_MAX_START;
    if (!loaded.marks) loaded.marks = [];
    if (loaded.deadFade == null) loaded.deadFade = 1;
    if (loaded.scale == null) loaded.scale = 1;
    state = loaded;
  } catch (e) {
    console.error('loadState failed', e);
  }
}

function calStepValue(i) {
  if (CAL_STEPS <= 1) return CAL_ADJ_MIN;
  return CAL_ADJ_MIN + (CAL_ADJ_MAX - CAL_ADJ_MIN) * i / (CAL_STEPS - 1);
}

function loadCal() {
  try {
    const raw = localStorage.getItem(CAL_LS_KEY);
    if (raw == null) return false;
    const c = JSON.parse(raw);
    if (typeof c.ball !== "number" || typeof c.racket !== "number") return false;
    if (!(c.ball > 0) || !(c.racket > 0)) return false;
    calPick.ball = c.ball;
    calPick.racket = c.racket;
    ballSetUserScale(calPick.ball, calPick.racket);
    return true;
  } catch (e) {
    return false;
  }
}

function saveCal() {
  try {
    localStorage.setItem(CAL_LS_KEY, JSON.stringify({
      ball: calPick.ball,
      racket: calPick.racket
    }));
  } catch (e) {
    console.error('saveCal failed', e);
  }
  ballSetUserScale(calPick.ball, calPick.racket);
}

function requestPageFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
  if (!req) return Promise.resolve();
  try {
    const p = req.call(el);
    if (p && typeof p.then === "function") return p.catch(function () {});
  } catch (err) {}
  return Promise.resolve();
}

function beginPlay() {
  loadState();
  resize();
  ballSetUserScale(calPick.ball, calPick.racket);
  const startServer = state.scoredBy >=0 ? state.scoredBy : Math.round(Math.random());
  newPoint(startServer);
}

function enterCal(which) {
  state.mode = which === "racket" ? "cal-racket" : "cal-ball";
}

function leaveTitle(forceCal) {
  requestPageFullscreen();
  if (forceCal || !loadCal()) {
    enterCal("ball");
    return;
  }
  beginPlay();
}

function startGame() {
  if (state.mode !== "title") return;
  leaveTitle(false);
}

function inGoalMouth(y) {
  return y >= state.goalY0 && y <= state.goalY1;
}

function inTargetZone(side, x, y) {
  if (!inGoalMouth(y)) return false;
  return side === 0 ? x <= state.targetW : x >= state.w - state.targetW;
}

function resize() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  const wasPortrait = state.portrait;
  const oldW = state.w;
  const oldH = state.h;
  state.viewW = viewW;
  state.viewH = viewH;
  state.dpr = dpr;
  state.portrait = viewH > viewW;
  state.w = Math.max(viewW, viewH);
  state.h = Math.min(viewW, viewH);
  state.targetW = state.w * 0.5 * TARGET_W_PERC;
  state.targetH = state.h * TARGET_H_PERC;
  state.goalY0 = (state.h - state.targetH) * 0.5;
  state.goalY1 = state.goalY0 + state.targetH;
  const prevScale = state.scale || 0;
  state.scale = state.w / REF_W;
  ballSetScale(state.scale);
  ballSetUserScale(calPick.ball, calPick.racket);
  if (oldW > 0 && oldH > 0 && (oldW !== state.w || oldH !== state.h) && state.marks) {
    const sx = state.w / oldW;
    const sy = state.h / oldH;
    for (let i = 0; i < state.marks.length; i++) {
      state.marks[i].x *= sx;
      state.marks[i].y *= sy;
    }
  }
  const scaleJump = prevScale > 0 && Math.abs(state.scale - prevScale) / prevScale > 0.08;
  if (state.mode === "serve") ballPark(state.ball);
  else if (wasPortrait !== state.portrait || (scaleJump && state.mode === "play")) newPoint(state.server);
}

function screenToWorld(sx, sy) {
  if (!state.portrait) return { x: sx, y: sy };
  return { x: sy, y: state.h - sx };
}

function sideOf(x) {
  return x < state.w * 0.5 ? 0 : 1;
}

function newPoint(server) {
  state.server = server;
  state.mode = "serve";
  state.tossT = 0;
  state.waves.length = 0;
  state.pauseT = 0;
  state.scoredBy = -1;
  state.lastHitter = -1;
  state.rallyMax = ballVolleyStart();
  state.deadFade = 1;
  ballPark(state.ball);
}

function startToss(x, y) {
  state.mode = "toss";
  state.tossT = 0;
  ballBeginToss(state.ball, x, y);
}

function pinBallToCourt(b) {
  if (b.x < 0) b.x = 0;
  else if (b.x > state.w) b.x = state.w;
  if (b.y < 0) b.y = 0;
  else if (b.y > state.h) b.y = state.h;
}

function scoreFor(winner) {
  const winscore = state.scores[winner];
  winscore.p+=1;
  if( winscore.p==4 ){
    winscore.g+=1;
    state.scores[0].p=0;
    state.scores[1].p=0;
    state.showGames=1;
  }

  const b = state.ball;
  pinBallToCourt(b);
  const arm = KILL_X_ARM * state.scale;
  const pull = KILL_X_PULL * arm * 2;
  const spd = Math.hypot(b.vx, b.vy);
  let mx = b.x;
  let my = b.y;
  if (spd > 0 && pull > 0) {
    mx -= (b.vx / spd) * pull;
    my -= (b.vy / spd) * pull;
  }
  state.marks.push({ x: mx, y: my, for: winner === state.server });

  state.mode = "pause";
  messageText = "POINT FOR "+(winner==state.server ? "SERVE" : "RECV");
  setTimeout( ()=>{ messageText="" }, POINT_PAUSE_MS );
  state.pauseT = 0;
  state.scoredBy = winner;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  state.deadFade = 1;

  saveState();
}

function spawnWave(x, y, side) {
  state.waves.push({ x, y, side, r: 0, prev: 0, born: true });
}

function tryStrike(tapX, tapY, side, isServe) {
  if (sideOf(tapX) !== side) return false;
  if (!isServe && state.lastHitter === side) return false;
  const b = state.ball;
  const power = ballTapPower(b, tapX, tapY);
  if (power < 0) return false;

  let speed;
  if (isServe) {
    const boost = ballServeBoost(b.z);
    speed = ballServeMin() + (ballServeMax() - ballServeMin()) * boost;
  } else {
    const vmin = ballVolleyMin();
    speed = vmin + power * (state.rallyMax - vmin);
    state.rallyMax += ballVolleyStep();
    const cap = ballMaxSpeed();
    if (state.rallyMax > cap) state.rallyMax = cap;
  }

  ballLaunch(b, tapX, tapY, side, speed, power);
  state.lastHitter = side;
  return true;
}

function onTap(x, y) {
  if (x < 0 || y < 0 || x > state.w || y > state.h) return;
  const side = sideOf(x);
  if (state.mode === "pause") return;
  if (state.mode === "serve") {
    if (side === state.server && inTargetZone(side, x, y) ) startToss(x, y);
    return;
  }
  if (state.mode === "toss") {
    if (side !== state.server) return;
    spawnWave(x, y, side);
    if (tryStrike(x, y, side, true)) state.mode = "play";
    return;
  }
  if (state.mode === "play") {
    spawnWave(x, y, side);
    tryStrike(x, y, side, false);
  }
}

function resetDown() {
  if( state.mode!=="serve" ) return;

  clearTimeout(resetHoldTimer);
  resetHoldTimer = setTimeout(() => {
    resetHoldStart = 0;
    messageText = "";
    state.scores = [{p:0,g:0,s:0}, {p:0,g:0,s:0}];
    state.marks = [];
    newPoint(Math.round(Math.random()));
    saveState();
  }, RESET_HOLD_MS);
  resetHoldStart = state.now;
}

function resetUp() {
  clearTimeout(resetHoldTimer);
  messageText = "";
  resetHoldTimer = 0;
  resetHoldStart = 0;
}

function inCalibrateButton(p) {
  return p.x >= calBtn.x0 && p.x <= calBtn.x1 && p.y >= calBtn.y0 && p.y <= calBtn.y1;
}

function calSlotIndex(x) {
  const pad = state.w * 0.06;
  const usable = state.w - pad * 2;
  if (x < pad || x > state.w - pad) {
    if (x < pad) return 0;
    return CAL_STEPS - 1;
  }
  let i = Math.floor((x - pad) / (usable / CAL_STEPS));
  if (i < 0) i = 0;
  if (i >= CAL_STEPS) i = CAL_STEPS - 1;
  return i;
}

function onCalTap(x, y) {
  if (y < state.h * 0.18 || y > state.h * 0.88) return;
  const adj = calStepValue(calSlotIndex(x));
  if (state.mode === "cal-ball") {
    calPick.ball = adj;
    ballSetUserScale(calPick.ball, calPick.racket);
    enterCal("racket");
    return;
  }
  calPick.racket = adj;
  saveCal();
  beginPlay();
}

function bindInput() {
  canvas.addEventListener("pointerdown", (ev) => {
    const r = canvas.getBoundingClientRect();
    const p = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);    
    if (state.mode === "cal-ball" || state.mode === "cal-racket") {
      onCalTap(p.x, p.y);
      return;
    }
    if( !inTargetZone(0, p.x, p.y) && !inTargetZone(1, p.x, p.y) ){
      resetDown();
    }
    onTap(p.x, p.y);
  }, { passive: false });

  canvas.addEventListener('pointerup', () => resetUp());

  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const p = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    ev.preventDefault();
    if (state.mode === "title") {
      if (inCalibrateButton(p)) leaveTitle(true);
      else leaveTitle(false);
      return;
    }
  });

  canvas.addEventListener('pointercancel', () => resetUp());
  canvas.addEventListener('lostpointercapture', () => resetUp());

  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  window.addEventListener("keydown", (ev) => {
    if (ev.code === "Space") {
      ev.preventDefault();
      onTap(state.ball.x, state.ball.y + 8);
    }
  });
}

function updateWaves(dt) {
  for (let i = state.waves.length - 1; i >= 0; i--) {
    const w = state.waves[i];
    w.prev = w.r;
    if (w.born) w.born = false;
    else w.r += WAVE_SPEED * state.scale * dt;
    if (w.r >= MAX_RADIUS * state.scale) state.waves.splice(i, 1);
  }
}

function updatePlay(dt) {
  const b = state.ball;
  ballStep(b, dt);
  const r = ballSize() * 0.5;

  if (b.y - r < 0) {
    b.y = r;
    if (b.vy < 0) b.vy = -b.vy;
  } else if (b.y + r > state.h) {
    b.y = state.h - r;
    if (b.vy > 0) b.vy = -b.vy;
  }

  if (b.x - r < 0) {
    if (inGoalMouth(b.y)) scoreFor(1);
    else {
      b.x = r;
      if (b.vx < 0) b.vx = -b.vx;
    }
  } else if (b.x + r > state.w) {
    if (inGoalMouth(b.y)) scoreFor(0);
    else {
      b.x = state.w - r;
      if (b.vx > 0) b.vx = -b.vx;
    }
  }
}

function update(dt) {
  if (state.mode === "title" || state.mode === "cal-ball" || state.mode === "cal-racket") return;
  const ms = dt * 1000;
  if (state.mode === "toss") {
    state.tossT += ms;
    const t = Math.max(0, Math.min(1, state.tossT / TOSS_MS));
    const b = state.ball;
    b.z = ballTossZ(t);
    b.r += b.vr * dt;
    if (state.tossT >= TOSS_MS) {
      state.mode = "serve";
      state.tossT = 0;
      state.waves.length = 0;
      ballPark(b);
    }
  } else if (state.mode === "play") {
    updatePlay(dt);
  } else if (state.mode === "pause") {
    state.pauseT += ms;
    state.deadFade -= ms / DEAD_FADE_MS;
    if (state.deadFade < 0) state.deadFade = 0;
    if (state.pauseT >= POINT_PAUSE_MS) newPoint(state.scoredBy);
  }
  updateWaves(dt);
}

function beginDraw() {
  const dpr = state.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.portrait) {
    ctx.translate(state.viewW, 0);
    ctx.rotate(Math.PI / 2);
  }

  ctx.fillStyle = BG_COL;
  ctx.fillRect(0, 0, state.w, state.h);
}

function drawTitle() {
  const font = Math.min(state.w * 0.2, state.h * 0.6);
  const small = font / 8;  
  ctx.save();
  ctx.fillStyle = NEON;
  ctx.lineWidth = 3;
  ctx.strokeStyle = NEON;  
  ctx.font = "900 " + font + "px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = .2;
  ctx.fillText("SPRONG", state.w * 0.5, state.h * 0.5);
  ctx.globalAlpha = 1;
  ctx.strokeText("SPRONG", state.w * 0.5, state.h * 0.5);

  const by = state.h * 0.96;
  ctx.font = "400 " + small + "px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  const bx = state.w * 0.04;
  ctx.fillText("calibrate", bx, by);
  const tw = ctx.measureText("calibrate").width;
  const pad = Math.max(14, small * 0.9);
  calBtn.x0 = bx - pad;
  calBtn.y0 = by - small - pad * 0.35;
  calBtn.x1 = bx + tw + pad;
  calBtn.y1 = by + small + pad * 0.35;

  ctx.textAlign = "right";
  ctx.fillText(APP_VERSION, state.w * 0.96, by);
  ctx.restore();
}

function drawCal() {
  const racket = state.mode === "cal-racket";
  const label = racket ? "RACKET SIZE" : "BALL SIZE";
  const current = racket ? calPick.racket : calPick.ball;
  const pad = state.w * 0.06;
  const usable = state.w - pad * 2;
  const slotW = usable / CAL_STEPS;
  const cy = state.h * 0.52;
  const titleFont = Math.max(18, Math.min(state.w, state.h) * 0.07);

  ctx.save();
  ctx.fillStyle = NEON;
  ctx.font = "700 " + titleFont + "px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, state.w * 0.5, state.h * 0.16);

  for (let i = 0; i < CAL_STEPS; i++) {
    const adj = calStepValue(i);
    const cx = pad + slotW * (i + 0.5);
    const selected = Math.abs(adj - current) < 0.001;

    if (racket) {
      const r = HIT_RADIUS_MUL * BALL_BASE * state.scale * adj;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, r), 0, Math.PI * 2);
      ctx.fillStyle = selected ? "rgba(12,90,18,0.92)" : "rgba(8,56,12,0.88)";
      ctx.fill();
      ctx.lineWidth = selected ? 4 : 2.5;
      ctx.strokeStyle = NEON;
      ctx.stroke();
    } else {
      const s = BALL_BASE * state.scale * adj;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = BALL;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = NEON;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.5 + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function strokeGoalBox(xBack, xFront, y0, y1) {
  ctx.beginPath();
  ctx.moveTo(xFront, y0);
  ctx.lineTo(xBack, y0);
  ctx.lineTo(xBack, y1);
  ctx.lineTo(xFront, y1);
  ctx.stroke();
}

function drawGoalBoxes() {
  const w = state.w;
  const depth = state.targetW;
  const y0 = state.goalY0;
  const y1 = state.goalY1;
  ctx.save();
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000000";
  ctx.globalAlpha = 1;
  strokeGoalBox(0, depth, y0, y1);
  strokeGoalBox(w, w - depth, y0, y1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = NEON;
  ctx.globalAlpha = 0.6;
  strokeGoalBox(0, depth, y0, y1);
  strokeGoalBox(w, w - depth, y0, y1);
  ctx.restore();
}

function drawNet() {
  ctx.save();
  ctx.lineWidth = 8;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(state.w * 0.5, 0);
  ctx.lineTo(state.w * 0.5, state.h);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = NEON;
  ctx.beginPath();
  ctx.moveTo(state.w * 0.5, 0);
  ctx.lineTo(state.w * 0.5, state.h);
  ctx.stroke();
  ctx.restore();
}

function drawChevron() {
  if (state.mode !== "serve") return;
  const w = state.w, h = state.h;
  const s = Math.min(w, h)*.5;
  const arm = s * 0.11;
  const thick = Math.max(8, s * 0.018);
  const cx = state.server === 0 ? w * 0.18 : w * 0.82;
  const cy = h * 0.5;
  const ang = state.server === 1 ? Math.PI : 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.lineWidth = thick+2;
  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(-arm * 0.15, -arm * 0.85);
  ctx.lineTo(arm * 1.05, 0);
  ctx.lineTo(-arm * 0.15, arm * 0.85);
  ctx.stroke();
  ctx.lineWidth = thick;
  ctx.strokeStyle = NEON;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(-arm * 0.15, -arm * 0.85);
  ctx.lineTo(arm * 1.05, 0);
  ctx.lineTo(-arm * 0.15, arm * 0.85);
  ctx.stroke();
  
  ctx.restore();
}

const POINT_SCORE_FORMAT = ["0", "15","30","40"];

function drawScores() {
  const w = state.w;
  const h = state.h;
  const targetW = state.targetW;
  const woffset = targetW / 2;
  const hoffset = h * 0.07;
  const font = Math.max(28, Math.min(w, h) * 0.12);
  const scores = state.scores;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 " + font + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  ctx.fillStyle = "rgba(" + PCOL_RGB[0] + ",0.55)";
  ctx.fillText(POINT_SCORE_FORMAT[scores[0].p], woffset, hoffset);

  ctx.fillStyle = "rgba(" + PCOL_RGB[1] + ",0.55)";  
  ctx.fillText(POINT_SCORE_FORMAT[scores[1].p], w - woffset, hoffset);

  const boxH = 10;
  const gamesW = targetW * .7;
  const gamesX = (targetW - gamesW) / 2;
  const slotW = gamesW / GAMES_PER_SET;
  const pad = Math.max(8, Math.min(8, slotW * 0.18));
  const boxW = slotW - pad * 2;
  const gamesY = hoffset + font * 0.42 + boxH * 0.5;

  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const won = scores[i].g;
    const areaLeft = i === 0 ? gamesX: w - gamesW-gamesX;
    ctx.strokeStyle = "rgba(" + PCOL_RGB[i] + ",0.35)";
    ctx.fillStyle = "rgba(" + PCOL_RGB[i] + ",0.65)";
    for (let g = 0; g < GAMES_PER_SET; g++) {
      const x = areaLeft + g * slotW + pad;
      const y = gamesY - boxH / 2;
      ctx.beginPath();
      ctx.rect(x, y, boxW, boxH);
      if (g < won) ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWaves() {
  ctx.save();
  ctx.lineCap = "round";
  for (const w of state.waves) {
    const t = Math.max(0, Math.min(1, w.r / (MAX_RADIUS * state.scale)));
    const a = (1 - t) * (1 - t);
    if (a < 0.02) continue;
    ctx.strokeStyle = "rgba(" + PCOL_RGB[w.side] + "," + (0.95 * a).toFixed(3) + ")";
    ctx.lineWidth = Math.max(1.2, 10 * (1 - t));
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(0.5, w.r), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawKillMarks() {
  const marks = state.marks;
  if (!marks || !marks.length) return;
  const outer = KILL_X_ARM * state.scale;
  const inner = outer * 0.42;
  const n = marks.length;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const m = marks[i];
    const t = n <= 1 ? 1 : i / (n - 1);
    const a = i === n - 1 ? 0.6 : 0.2 + 0.5 * t;
    ctx.globalAlpha = a;
    ctx.fillStyle = m.for ? MARK_FOR : MARK_AGAINST;
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const ang = -Math.PI / 2 + k * Math.PI / 6;
      const rad = (k & 1) ? inner : outer;
      const x = m.x + Math.cos(ang) * rad;
      const y = m.y + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBallStamp(x, y, z, r, alpha) {
  const rad = ballDrawSize(z) * 0.5;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(r);
  ctx.fillStyle = BALL;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,20,0,0.38)";
  ctx.lineWidth = Math.max(1, rad * 0.14);
  ctx.beginPath();
  ctx.moveTo(0, -rad);
  ctx.lineTo(0, rad);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.55, -0.85, 0.85);
  ctx.stroke();
  ctx.restore();
}

function drawBall() {
  if (state.mode === "serve") return;
  const b = state.ball;
  const fade = state.mode === "pause" ? state.deadFade : 1;
  if (fade <= 0) return;
  const trail = b.trail;
  if (trail && trail.length) {
    const n = trail.length;
    for (let i = 0; i < n; i++) {
      const a = (0.18 + 0.17 * (i / Math.max(1, n - 1))) * fade;
      drawBallStamp(trail[i].x, trail[i].y, trail[i].z, b.r, a);
    }
  }
  drawBallStamp(b.x, b.y, b.z, b.r, fade);
}

function drawMessage() {
  if (messageText === "") return;
  ctx.save();  
  ctx.font = "600 " + Math.max(20, Math.min(state.w, state.h) * 0.1) + "px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.strokeText(messageText, state.w * 0.5, state.h * 0.75);
  ctx.fillText(messageText, state.w * 0.5, state.h * 0.75);
  ctx.fillStyle = "rgba(57,255,20,0.35)";
  ctx.fillText(messageText, state.w * 0.5, state.h * 0.75);
  ctx.restore();
}

const RESET_HOLD_DELAY = 300;
function draw() {
  beginDraw();
  if (state.mode === "title") {
    drawTitle();
    return;
  }
  if (state.mode === "cal-ball" || state.mode === "cal-racket") {
    drawCal();
    return;
  }  
  drawNet();
  drawGoalBoxes();
  drawKillMarks();
  drawChevron();
  drawScores();
  drawWaves();
  drawBall();

  if( resetHoldStart>0 ){
    const elapse = state.now-resetHoldStart;

    if( elapse < RESET_HOLD_DELAY ){  return; }

    messageText = "RESET GAME?";
    const t = (elapse-RESET_HOLD_DELAY) / (RESET_HOLD_MS-RESET_HOLD_DELAY);

    ctx.save();
    ctx.strokeStyle = NEON;
    ctx.lineWidth = 10;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(state.w * 0.5, state.h * 0.5, 20,
      -Math.PI/2,
      -Math.PI/2 + t * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawMessage();
}

const FPS_GOAL = 60;
const FRAME_MS = 1000 / FPS_GOAL;

function frame(now) {
  requestAnimationFrame(frame);
  if (!state.last) state.last = now;
  const elapsed = now - state.last;
  if (elapsed < FRAME_MS) return;

  state.now = now;
  state.last = now - (elapsed % FRAME_MS);
  let dt = elapsed / 1000;
  if (dt > 0.05) dt = 0.05;

  update(dt);
  draw();
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 80));
loadCal();
resize();
bindInput();

setTimeout( ()=> {
  state.mode="title";
  requestAnimationFrame(frame);
}, 100 );
