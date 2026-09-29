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
