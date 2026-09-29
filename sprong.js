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
const TARGET_W_PERC = 0.2;
const TARGET_H_PERC = 0.4;
const REST_SIDE = 1;
const REST_BACK = 0.18;
const REST_BUMPER = 1;
const BOUNCE_FRICTION = 0.96;
const BUMPER_FADE_MS = 480;
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
  bumpers: [{ live: null, fade: null }, { live: null, fade: null }],
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
    if (!loaded.bumpers || loaded.bumpers.length !== 2) {
      loaded.bumpers = [{ live: null, fade: null }, { live: null, fade: null }];
    }
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
