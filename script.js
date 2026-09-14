import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// 页面状态：idle → modalOpen → glitch → cubeScene
const page = document.querySelector(".page");
const modal = document.querySelector(".message-modal");
const phoneScreen = document.querySelector(".phone-screen");
const confirmButtons = document.querySelectorAll("[data-confirm]");
const glitchOverlay = document.querySelector(".glitch-overlay");
const glitchTears = document.querySelector(".glitch-tears");
const glitchPixels = document.querySelector(".glitch-pixels");
const glitchNoise = document.querySelector(".glitch-noise");
const cubeSceneElement = document.querySelector(".cube-scene");
const canvas = document.querySelector("#cube-canvas");
const escapeButton = document.querySelector(".escape-button");
const chapterCompleteElement = document.querySelector(".chapter-complete");
const chapter2Element = document.querySelector(".chapter2-scene");
const chapter2Canvas = document.querySelector("#chapter2-canvas");
const virtualCursorElement = document.querySelector(".virtual-cursor");
const collectedFragmentsElement = document.querySelector(".collected-fragments");
const chapter2FinaleElement = document.querySelector(".chapter2-finale");
const finaleCharacterElement = document.querySelector(".finale-character");
const finaleTrainElement = document.querySelector(".finale-train");
const finaleBoardedElement = document.querySelector(".finale-boarded");
const boardingBubbleElement = document.querySelector(".boarding-bubble");
const boardingProgressElement = document.querySelector(".boarding-progress span");
const chapter2CompleteElement = document.querySelector(".chapter2-complete");
const chapter3Element = document.querySelector(".chapter3-scene");
const curtainCanvas = document.querySelector("#curtain-canvas");
const curtainInputLayer = document.querySelector(".curtain-input-layer");
const birdRearLayer = document.querySelector(".bird-flight-layer--rear");
const birdFrontLayer = document.querySelector(".bird-flight-layer--front");
const chapter3Video = document.querySelector(".chapter3-video");
const chapter3CompleteElement = document.querySelector(".chapter3-complete");

let currentState = "idle";
let glitchTimer = null;
let glitchInterval = null;
let glitchImpactTimer = null;
let audioContext = null;

// 统一音效事件接口：后续音频模块只需订阅事件，不必改交互逻辑
const SOUND_EVENTS = Object.freeze({
  notification: "notification",
  buttonClick: "buttonClick",
  glitchStart: "glitchStart",
  glitchImpact: "glitchImpact",
  glitchEnd: "glitchEnd",
  environmentStart: "environmentStart",
  cardHover: "cardHover",
  escapeAppear: "escapeAppear",
  escapeClick: "escapeClick",
  chapter2MusicStart: "chapter2MusicStart",
  chapter2TextPickup: "chapter2TextPickup",
  chapter2Impact: "chapter2Impact",
  trainArrival: "trainArrival",
  trainDeparture: "trainDeparture",
  birdFly: "birdFly",
});
const soundEventTarget = new EventTarget();

function triggerSoundEvent(eventName, detail = {}) {
  cubeSceneElement.dataset.lastSoundEvent = eventName;
  soundEventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
  window.dispatchEvent(
    new CustomEvent("fomo:sound", {
      detail: { name: eventName, ...detail },
    })
  );
}

window.fomoSoundEvents = Object.freeze({
  names: SOUND_EVENTS,
  subscribe(eventName, handler) {
    soundEventTarget.addEventListener(eventName, handler);
    return () => soundEventTarget.removeEventListener(eventName, handler);
  },
});

// 第一章音频资源插槽：替换素材只需修改这里，空路径或加载失败安全静音。
const CHAPTER1_AUDIO = Object.freeze({
  notification: "./pic/first/audio/message_notifi.mp3",
  //confirm: "./pic/first/audio/button click.mp3",
  glitch: "./pic/first/audio/glitch.mp3",
  cardHover: "./pic/first/audio/card_hover.wav",
  doorOpen: "./pic/first/audio/door_open.mp3",
  bgm: "./pic/first/audio/bgm.mp3",
});
const CHAPTER1_MUSIC_VOLUME_MIN = 0.08;
const NOTIFICATION_VOLUME = 0.75;
const CHAPTER1_MUSIC_VOLUME_MAX = 0.24;
const CHAPTER1_MUSIC_FADE_OUT = 500;
const chapter1AudioTracks = {};
let chapter1MusicFadeFrame = null;
for (const [name, path] of Object.entries(CHAPTER1_AUDIO)) {
  if (!path) continue;
  try {
    const track = new Audio(new URL(path, import.meta.url).href);
    track.preload = "auto";
    track.volume = name === "bgm" ? CHAPTER1_MUSIC_VOLUME_MIN : name === "notification" ? NOTIFICATION_VOLUME : 0.45;
    track.loop = name === "bgm";
    track.addEventListener("error", () => {
      console.warn(`[Chapter1 audio] ${name} 加载失败`, { src: track.src, code: track.error?.code, message: track.error?.message });
      chapter1AudioTracks[name] = null;
    });
    chapter1AudioTracks[name] = track;
  } catch { chapter1AudioTracks[name] = null; }
}
function playChapter1Audio(name) {
  const track = chapter1AudioTracks[name];
  if (!track) return;
  try {
    track.pause();
    track.currentTime = 0;
    const playback = track.play();
    playback?.catch((error) => {
      console.warn(`[Chapter1 audio] ${name} 播放失败`, { name: error.name, message: error.message, src: track.src });
    });
  } catch (error) { console.warn(`[Chapter1 audio] ${name} 重置/播放失败`, error); }
}
async function playNotificationSound() {
  const notificationAudio = chapter1AudioTracks.notification;
  if (!notificationAudio) {
    console.warn("[notification] play failed: 音频未初始化或加载失败", CHAPTER1_AUDIO.notification);
    return;
  }
  function printDebug(stage) {
    console.log('[notification debug]', {
      stage,
      src: notificationAudio.src, currentSrc: notificationAudio.currentSrc,
      readyState: notificationAudio.readyState, networkState: notificationAudio.networkState,
      duration: notificationAudio.duration, currentTime: notificationAudio.currentTime,
      volume: notificationAudio.volume, muted: notificationAudio.muted,
      paused: notificationAudio.paused, ended: notificationAudio.ended,
    });
  }
  printDebug('before');
  notificationAudio.pause();
  notificationAudio.currentTime = 0;
  notificationAudio.volume = 1;
  notificationAudio.muted = false;
  printDebug('reset');
  try {
    await notificationAudio.play();
    console.log('[notification] PLAY SUCCESS');
  } catch (err) {
    console.error('[notification] PLAY FAILED', err.name, err.message);
  }
  printDebug('after');
  // 只追踪这个实例，不影响其他音频；500ms 后恢复原 pause 方法。
  const hadOwnPause = Object.prototype.hasOwnProperty.call(notificationAudio, 'pause');
  const originalPause = notificationAudio.pause;
  function tracedPause(...args) {
    console.trace('[notification] pause() called within 500ms');
    return originalPause.apply(this, args);
  }
  notificationAudio.pause = tracedPause;
  window.setTimeout(() => {
    printDebug('after 500ms');
    if (notificationAudio.pause === tracedPause) {
      if (hadOwnPause) notificationAudio.pause = originalPause;
      else delete notificationAudio.pause;
    }
  }, 500);
}
chapter1AudioTracks.notification?.addEventListener("loadeddata", () => {
  console.info("[notification] loaded");
}, { once: true });
function playConfirmSound() { playChapter1Audio("confirm"); }
function playGlitchSound() { playChapter1Audio("glitch"); }
function playCardHoverSound() { playChapter1Audio("cardHover"); }
function playDoorOpenSound() { playChapter1Audio("doorOpen"); }
function startChapter1Music() {
  if (chapter1MusicFadeFrame !== null) cancelAnimationFrame(chapter1MusicFadeFrame);
  chapter1MusicFadeFrame = null;
  playChapter1Audio("bgm");
}
function stopChapter1Music() {
  const track = chapter1AudioTracks.bgm;
  if (!track) return;
  const initialVolume = track.volume;
  const start = performance.now();
  function fade(now) {
    const progress = Math.min((now - start) / CHAPTER1_MUSIC_FADE_OUT, 1);
    track.volume = initialVolume * (1 - progress);
    if (progress < 1) chapter1MusicFadeFrame = requestAnimationFrame(fade);
    else {
      track.pause();
      try { track.currentTime = 0; } catch { /* 安全降级 */ }
      chapter1MusicFadeFrame = null;
    }
  }
  chapter1MusicFadeFrame = requestAnimationFrame(fade);
}
const NOTIFICATION_DELAY = 1000;
let notificationTimer = null;
let notificationPlayedThisEntry = false;

function resetChapter1NotificationTimer() {
  window.clearTimeout(notificationTimer);
  notificationPlayedThisEntry = false;
  notificationTimer = window.setTimeout(() => {
    notificationTimer = null;
    if (notificationPlayedThisEntry) return;
    notificationPlayedThisEntry = true;
    playNotificationSound();
  }, NOTIFICATION_DELAY);
}
soundEventTarget.addEventListener(SOUND_EVENTS.buttonClick, playConfirmSound);
soundEventTarget.addEventListener(SOUND_EVENTS.glitchStart, playGlitchSound);
soundEventTarget.addEventListener(SOUND_EVENTS.cardHover, playCardHoverSound);
soundEventTarget.addEventListener(SOUND_EVENTS.escapeClick, playDoorOpenSound);
soundEventTarget.addEventListener(SOUND_EVENTS.environmentStart, startChapter1Music);

function setState(nextState) {
  const previousState = currentState;
  currentState = nextState;
  // 第一章返回入口即新一轮；只重置通知计时，不改变其他状态逻辑。
  if (nextState === "idle") resetChapter1NotificationTimer();
  if (nextState === "chapter2" || nextState === "chapter3") {
    window.clearTimeout(notificationTimer);
    notificationTimer = null;
  }
  if (previousState === "chapter2" && nextState !== "chapter2") {
    stopChapter2Music();
  }
  page.dataset.state = currentState;
  const cubeIsVisible = currentState === "cubeScene" || currentState === "escapeAvailable";
  modal.setAttribute("aria-hidden", String(currentState !== "modalOpen"));
  glitchOverlay.setAttribute("aria-hidden", String(currentState !== "glitch"));
  cubeSceneElement.setAttribute("aria-hidden", String(!cubeIsVisible));
  chapterCompleteElement.setAttribute(
    "aria-hidden",
    String(currentState !== "chapterOneComplete")
  );
  chapter2Element.setAttribute("aria-hidden", String(currentState !== "chapter2"));
  chapter2CompleteElement.setAttribute(
    "aria-hidden",
    String(currentState !== "chapter2Complete")
  );
  chapter3Element.setAttribute("aria-hidden", String(currentState !== "chapter3"));
  chapter3CompleteElement.setAttribute(
    "aria-hidden",
    String(currentState !== "chapter3Complete")
  );
}

// 1A 弹窗延迟：单位为毫秒
const MODAL_DELAY = 1800;

window.setTimeout(() => {
  if (currentState !== "idle") return;
  setState("modalOpen");
  confirmButtons[0].focus();
}, MODAL_DELAY);

// Glitch 总时长：可在 2000～3000 毫秒之间调整
const GLITCH_DURATION = 2500;
const GLITCH_REFRESH_RATE = 85;
page.style.setProperty("--glitch-duration", `${GLITCH_DURATION}ms`);

function createGlitchBlocks(container, className, count) {
  return Array.from({ length: count }, () => {
    const block = document.createElement("div");
    block.className = className;
    container.appendChild(block);
    return block;
  });
}

const tearBlocks = createGlitchBlocks(glitchTears, "glitch-tear", 11);
const pixelBlocks = createGlitchBlocks(glitchPixels, "glitch-pixel", 15);
const noiseBlocks = createGlitchBlocks(glitchNoise, "glitch-noise-block", 28);
const grayscale = ["#111111", "#4b4b4b", "#8d8d8d", "#c8c8c8", "#ffffff"];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// 随机更新三类故障：横向撕裂、局部像素错位、矩形噪点
function refreshGlitchFrame() {
  tearBlocks.forEach((block, index) => {
    block.style.top = `${randomBetween(0, 98)}%`;
    block.style.height = `${randomBetween(0.8, index % 3 === 0 ? 5 : 2.5)}%`;
    block.style.translate = `${randomBetween(-13, 13)}vw 0`;
    block.style.opacity = randomBetween(0.45, 1);
  });

  pixelBlocks.forEach((block) => {
    block.style.left = `${randomBetween(4, 88)}%`;
    block.style.top = `${randomBetween(3, 92)}%`;
    block.style.width = `${randomBetween(3, 18)}vw`;
    block.style.height = `${randomBetween(1, 8)}vh`;
    block.style.translate = `${randomBetween(-7, 7)}vw ${randomBetween(-1.5, 1.5)}vh`;
    block.style.background = grayscale[Math.floor(Math.random() * grayscale.length)];
    block.style.opacity = randomBetween(0.35, 0.95);
  });

  noiseBlocks.forEach((block) => {
    block.style.left = `${randomBetween(0, 97)}%`;
    block.style.top = `${randomBetween(0, 97)}%`;
    block.style.width = `${randomBetween(0.4, 7)}vw`;
    block.style.height = `${randomBetween(0.3, 3.5)}vh`;
    block.style.background = grayscale[Math.floor(Math.random() * grayscale.length)];
    block.style.opacity = Math.random() > 0.22 ? randomBetween(0.5, 1) : 0;
  });
}

function startGlitch() {
  refreshGlitchFrame();
  glitchInterval = window.setInterval(refreshGlitchFrame, GLITCH_REFRESH_RATE);
  glitchImpactTimer = window.setTimeout(() => {
    triggerSoundEvent(SOUND_EVENTS.glitchImpact);
  }, GLITCH_DURATION * 0.55);

  glitchTimer = window.setTimeout(() => {
    window.clearInterval(glitchInterval);
    window.clearTimeout(glitchImpactTimer);
    triggerSoundEvent(SOUND_EVENTS.glitchEnd);
    setState("cubeScene");
    phoneScreen.hidden = true;
    startCardSystem();
    startAudioExperience();
  }, GLITCH_DURATION);
}

// 两个按钮共用同一处理函数，并在第一次点击后立即锁定
function confirmMessage() {
  if (currentState !== "modalOpen") return;

  confirmButtons.forEach((button) => {
    button.disabled = true;
  });

  // 用户手势发生时先解锁音频环境，但此时不播放声音
  unlockAudioSystem();
  triggerSoundEvent(SOUND_EVENTS.buttonClick);
  document.activeElement?.blur();
  setState("glitch");
  triggerSoundEvent(SOUND_EVENTS.glitchStart);
  startGlitch();
}

confirmButtons.forEach((button) => {
  button.addEventListener("click", confirmMessage);
});

// 音频权限初始化入口：只创建 / 恢复 AudioContext，不产生声音
function unlockAudioSystem() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // 某些浏览器仍可能限制音频；正式素材接入时在这里处理提示。
    });
  }

  cubeSceneElement.dataset.audioState = "unlocked";
}

// 正式进入 cubeScene 时统一调用；后续在这里接入安全音量的多轨环境音
function startAudioExperience() {
  cubeSceneElement.dataset.audioState = "started";
  updateAudioPressure(0);
  triggerSoundEvent(SOUND_EVENTS.environmentStart);
}

// 利用已有自然操作提前解锁；不增加授权 UI，也不补播错过的通知音。
function unlockChapter1AudioOnGesture() {
  if (currentState === "idle" || currentState === "modalOpen") unlockAudioSystem();
}
window.addEventListener("pointerdown", unlockChapter1AudioOnGesture, { capture: true });
window.addEventListener("keydown", unlockChapter1AudioOnGesture, { capture: true });

// 统一压力值驱动独立背景音乐的安全音量。
function updateAudioPressure(progress) {
  const intensity = THREE.MathUtils.lerp(
    AUDIO_INTENSITY_MIN,
    AUDIO_INTENSITY_MAX,
    progress
  );
  const stage = progress < 0.3 ? "light" : progress < 0.7 ? "building" : "dense";
  cubeSceneElement.dataset.audioIntensity = intensity.toFixed(3);
  cubeSceneElement.dataset.audioStage = stage;
  const music = chapter1AudioTracks.bgm;
  if (music && chapter1MusicFadeFrame === null) {
    music.volume = THREE.MathUtils.lerp(
      CHAPTER1_MUSIC_VOLUME_MIN, CHAPTER1_MUSIC_VOLUME_MAX, progress
    );
  }
}

function stopAudioExperience() {
  stopChapter1Music();
  cubeSceneElement.dataset.audioState = "stopped";
  cubeSceneElement.dataset.audioIntensity = "0";
  cubeSceneElement.dataset.audioStage = "stopped";
}

// Three.js：静止的单点透视线稿空间
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f7f5);

// PerspectiveCamera 参数：视野角、宽高比、近裁切面、远裁切面
const CAMERA_FOV = 58;
const camera = new THREE.PerspectiveCamera(
  CAMERA_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, -8);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const roomMaterial = new THREE.LineBasicMaterial({ color: 0x202020 });
const detailMaterial = new THREE.LineBasicMaterial({ color: 0x606060 });
const doorMaterial = new THREE.LineBasicMaterial({ color: 0x080808 });
const roomGroup = new THREE.Group();
scene.add(roomGroup);
let mainRoomLineObject = null;
let detailRoomLineObject = null;
let doorLineObject = null;
let doorHandleObject = null;

// 第一章墙面正式素材：三面墙复用贴图，随现有房间收缩更新顶点。
const chapter1WallMeshes = [];
const WALL_REPEAT_X = 1.5;
const WALL_SCROLL_SPEED = 0.12;
let wallScrollProgress = 0;
const chapter1WallTexture = new THREE.TextureLoader().load(
  new URL("./pic/first/wall_loop_strip.png", import.meta.url).href,
  () => {
    chapter1WallMeshes.forEach(mesh => { mesh.material.map.needsUpdate = true; });
  }, undefined, () => {
    chapter1WallMeshes.forEach((mesh) => { mesh.visible = false; });
  }
);
chapter1WallTexture.colorSpace = THREE.SRGBColorSpace;
chapter1WallTexture.wrapS = THREE.RepeatWrapping;
chapter1WallTexture.wrapT = THREE.ClampToEdgeWrapping;
const chapter1WallMaterial = new THREE.MeshBasicMaterial({
  map: chapter1WallTexture, side: THREE.DoubleSide, toneMapped: false,
});
for (let index = 0; index < 3; index += 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(8), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const material = index < 2 ? chapter1WallMaterial.clone() : chapter1WallMaterial;
  if (index < 2) {
    material.map = chapter1WallTexture.clone();
    material.map.repeat.set(WALL_REPEAT_X, 1);
    material.map.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  roomGroup.add(mesh);
  chapter1WallMeshes.push(mesh);
}
function updateChapter1Walls(near, far) {
  const faces = [
    [near[0], far[0], far[3], near[3]],
    [far[1], near[1], near[2], far[2]],
    [far[0], far[1], far[2], far[3]],
  ];
  faces.forEach((corners, index) => {
    const geometry = chapter1WallMeshes[index].geometry;
    const positions = geometry.getAttribute("position");
    corners.forEach((point, i) => positions.setXYZ(i, ...point));
    positions.needsUpdate = true;
    const width = Math.hypot(...corners[0].map((v, i) => v - corners[1][i]));
    const leftHeight = Math.abs(corners[0][1] - corners[3][1]);
    const rightHeight = Math.abs(corners[1][1] - corners[2][1]);
    // 以原图比例设置横向循环；梯形两端分别按高度映射，避免强行铺满拉伸。
    const tileHeight = Math.max(Math.min(leftHeight, rightHeight), 0.01);
    const repeat = width / (tileHeight * (3344 / 471));
    const uv = geometry.getAttribute("uv");
    if (index < 2) {
      // 两侧 U=0 为近端、U=1 为远端；V 固定覆盖完整墙高，不重复。
      uv.setXY(0, index === 1 ? 1 : 0, 1);
      uv.setXY(1, index === 1 ? 0 : 1, 1);
      uv.setXY(2, index === 1 ? 0 : 1, 0);
      uv.setXY(3, index === 1 ? 1 : 0, 0);
      uv.needsUpdate = true;
      return;
    }
    uv.setXY(0, 0, leftHeight / tileHeight);
    uv.setXY(1, repeat, rightHeight / tileHeight);
    uv.setXY(2, repeat, 0);
    uv.setXY(3, 0, 0);
    uv.needsUpdate = true;
  });
}

// 1C 卡片基础参数 + 1D 统一压力参数：集中在这里调整
const PRESSURE_DURATION = 15000;
const ROOM_MIN_WIDTH_FACTOR = 0.45;
const ROOM_MIN_HEIGHT_FACTOR = 0.5;
const ROOM_CRITICAL_WIDTH_FACTOR = 0.2;
const ROOM_CRITICAL_HEIGHT_FACTOR = 0.24;
const CRITICAL_PRESSURE_TIME_CONSTANT = 10000;
const PERSPECTIVE_LINE_EXTENSION = 1;
const PERSPECTIVE_LINE_EXTENSION_MAX = 1.35;
const CARD_SPAWN_START = 850;
const CARD_SPAWN_END = 220;
const ESCAPE_REVEAL_THRESHOLD = 0.75;
const AUDIO_INTENSITY_MIN = 0.08;
const AUDIO_INTENSITY_MAX = 0.72;
const ESCAPE_PULSE_DURATION_START = 1500;
const ESCAPE_PULSE_DURATION_MIN = 550;
const ESCAPE_PULSE_ACCELERATION = 1.2;
const ESCAPE_PULSE_RAMP_DURATION = 7000;
const ESCAPE_PULSE_SCALE_START = 1.1;
const ESCAPE_PULSE_SCALE_MAX = 1.16;
const MAX_CARDS = 30;
const CARD_FALL_SPEED_MIN = 0.65;
const CARD_FALL_SPEED_MAX = 1.2;
const CARD_ROTATION_SPEED = 0.28;
const CARD_MIN_SCALE = 0.65;
const CARD_MAX_SCALE = 1.3;
const CARD_HOVER_SCALE = 1.8;
const CARD_HOVER_BRIGHTNESS = 1.08;
const ESCAPE_AUDIO_FALLBACK = 1200;
const CHAPTER1_FADE_OUT_DURATION = 800;
const CHAPTER2_FADE_IN_DURATION = 1000;
let chapter1ExitPending = false;
const HOVER_ROTATION_SPEED = 7;
const HOVER_FALL_MULTIPLIER = 0;

// 十张正式纹理随机复用；活动卡片上限与素材数量无关。
const cardGeometry = new THREE.PlaneGeometry(1, 1);
const cardBorderGeometry = new THREE.EdgesGeometry(cardGeometry);
const CARD_TEXTURE_FILES = Array.from({ length: 10 }, (_, index) =>
  `./pic/first/card_${String(index + 1).padStart(2, "0")}.png`
);
const cardTextureLoader = new THREE.TextureLoader();
const cardTexturePool = CARD_TEXTURE_FILES.map((path) => {
  const entry = {
    path, aspect: 1.55,
    material: new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, opacity: 1, transparent: false,
      depthTest: true, depthWrite: true, alphaTest: 0.01, toneMapped: false,
    }),
  };
  cardTextureLoader.load(new URL(path, import.meta.url).href, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    entry.aspect = texture.image.width / texture.image.height;
    entry.material.map = texture;
    entry.material.needsUpdate = true;
    for (const card of cards) {
      if (card.textureEntry === entry) {
        card.mesh.material.map = texture;
        card.mesh.material.needsUpdate = true;
        card.mesh.scale.x = entry.aspect;
        card.border.scale.x = entry.aspect;
      }
    }
  }, undefined, () => { /* 缺失图片保留白色占位，不中断掉落。 */ });
  return entry;
});
let lastCardTextureIndex = -1;
let cardTextureRepeatCount = 0;
function pickCardTexture() {
  let index = Math.floor(Math.random() * cardTexturePool.length);
  if (index === lastCardTextureIndex && cardTextureRepeatCount >= 2) {
    index = (index + 1 + Math.floor(Math.random() * (cardTexturePool.length - 1)))
      % cardTexturePool.length;
  }
  cardTextureRepeatCount = index === lastCardTextureIndex ? cardTextureRepeatCount + 1 : 1;
  lastCardTextureIndex = index;
  return cardTexturePool[index];
}
const cardBorderMaterial = new THREE.LineBasicMaterial({ color: 0x111111 });
const cardGroup = new THREE.Group();
scene.add(cardGroup);

const cards = [];
const cardMeshes = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(2, 2);
const targetScaleVector = new THREE.Vector3();
let pointerIsInside = false;
let hoveredCard = null;
let cardSystemStarted = false;
let previousFrameTime = 0;
let nextCardSpawnTime = 0;
let animationFrameId = null;
let currentNearHalfWidth = 1;
let currentNearHalfHeight = 1;
let totalCardsCreated = 0;
let totalCardsRemoved = 0;
let pressureProgress = 0;
let pressureStartTime = 0;
let pressureSystemActive = false;
let escapeIsAvailable = false;
let currentRoomWidthFactor = 1;
let currentRoomHeightFactor = 1;
let currentPerspectiveLineExtension = PERSPECTIVE_LINE_EXTENSION;
let escapeRevealTime = null;
const escapeAnchor = new THREE.Vector3();

// 纵深尺寸：nearZ 是观者附近，farZ 是远端墙面
const ROOM_DEPTH = {
  nearZ: 4,
  farZ: -14,
};

// 远端墙面尺寸：halfWidth / halfHeight 是半宽和半高
const FAR_WALL = {
  halfWidth: 4.8,
  halfHeight: 3.25,
};

function updateLineObject(lineObject, points, material, LineType = THREE.LineSegments) {
  if (!lineObject) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const newLineObject = new LineType(geometry, material);
    newLineObject.frustumCulled = false;
    roomGroup.add(newLineObject);
    return newLineObject;
  }

  const position = lineObject.geometry.getAttribute("position");
  if (!position || position.count !== points.length) {
    lineObject.geometry.setFromPoints(points);
  } else {
    points.forEach((point, index) => {
      position.setXYZ(index, point.x, point.y, point.z);
    });
    position.needsUpdate = true;
  }

  return lineObject;
}

function segment(a, b, output) {
  output.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
}

function buildRoom() {
  const cameraDistance = camera.position.z - ROOM_DEPTH.nearZ;
  const nearHalfHeight =
    Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * cameraDistance * 1.02;
  const nearHalfWidth = nearHalfHeight * camera.aspect;
  currentNearHalfWidth = nearHalfWidth;
  currentNearHalfHeight = nearHalfHeight;
  const nearOuterHalfWidth = nearHalfWidth * currentPerspectiveLineExtension;
  const nearOuterHalfHeight = nearHalfHeight * currentPerspectiveLineExtension;
  const farHalfWidth = FAR_WALL.halfWidth * currentRoomWidthFactor;
  const farHalfHeight = FAR_WALL.halfHeight * currentRoomHeightFactor;
  const { nearZ, farZ } = ROOM_DEPTH;

  const nearCorners = [
    [-nearOuterHalfWidth, nearOuterHalfHeight, nearZ],
    [nearOuterHalfWidth, nearOuterHalfHeight, nearZ],
    [nearOuterHalfWidth, -nearOuterHalfHeight, nearZ],
    [-nearOuterHalfWidth, -nearOuterHalfHeight, nearZ],
  ];
  const farCorners = [
    [-farHalfWidth, farHalfHeight, farZ],
    [farHalfWidth, farHalfHeight, farZ],
    [farHalfWidth, -farHalfHeight, farZ],
    [-farHalfWidth, -farHalfHeight, farZ],
  ];
  updateChapter1Walls(nearCorners, farCorners);

  // 四条主透视线 + 远端墙面边框
  const mainLines = [];
  for (let index = 0; index < 4; index += 1) {
    segment(nearCorners[index], farCorners[index], mainLines);
    segment(farCorners[index], farCorners[(index + 1) % 4], mainLines);
  }
  mainRoomLineObject = updateLineObject(mainRoomLineObject, mainLines, roomMaterial);

  // 沿深度方向的截面线与墙面辅助线，强化近大远小
  const detailLines = [];
  [0.22, 0.48, 0.72].forEach((progress) => {
    const corners = nearCorners.map((nearCorner, index) =>
      nearCorner.map(
        (value, axis) => value + (farCorners[index][axis] - value) * progress
      )
    );
    for (let index = 0; index < 4; index += 1) {
      segment(corners[index], corners[(index + 1) % 4], detailLines);
    }
  });

  [-0.5, 0, 0.5].forEach((position) => {
    segment(
      [nearOuterHalfWidth * position, nearOuterHalfHeight, nearZ],
      [farHalfWidth * position, farHalfHeight, farZ],
      detailLines
    );
    segment(
      [nearOuterHalfWidth * position, -nearOuterHalfHeight, nearZ],
      [farHalfWidth * position, -farHalfHeight, farZ],
      detailLines
    );
  });

  [-0.5, 0, 0.5].forEach((position) => {
    segment(
      [-nearOuterHalfWidth, nearOuterHalfHeight * position, nearZ],
      [-farHalfWidth, farHalfHeight * position, farZ],
      detailLines
    );
    segment(
      [nearOuterHalfWidth, nearOuterHalfHeight * position, nearZ],
      [farHalfWidth, farHalfHeight * position, farZ],
      detailLines
    );
  });
  detailRoomLineObject = updateLineObject(
    detailRoomLineObject,
    detailLines,
    detailMaterial
  );

  buildDoor(farZ + 0.04, currentRoomWidthFactor, currentRoomHeightFactor);
}

// 门的位置和大小均在这里调整
function buildDoor(zPosition, widthFactor, heightFactor) {
  const door = {
    centerX: 0,
    bottomY: -FAR_WALL.halfHeight * heightFactor,
    width: 1.75 * widthFactor,
    height: 3.7 * heightFactor,
    handleX: 0.57 * widthFactor,
    handleY: -1.45 * heightFactor,
    handleRadius: 0.09 * Math.min(widthFactor, heightFactor),
  };

  const left = door.centerX - door.width / 2;
  const right = door.centerX + door.width / 2;
  const top = door.bottomY + door.height;
  const doorLines = [];
  segment([left, door.bottomY, zPosition], [left, top, zPosition], doorLines);
  segment([left, top, zPosition], [right, top, zPosition], doorLines);
  segment([right, top, zPosition], [right, door.bottomY, zPosition], doorLines);
  segment(
    [left + 0.12 * widthFactor, door.bottomY, zPosition],
    [left + 0.12 * widthFactor, top - 0.12 * heightFactor, zPosition],
    doorLines
  );
  doorLineObject = updateLineObject(doorLineObject, doorLines, doorMaterial);

  const handleCurve = new THREE.EllipseCurve(
    door.handleX,
    door.handleY,
    door.handleRadius,
    door.handleRadius,
    0,
    Math.PI * 2
  );
  const handlePoints = handleCurve
    .getPoints(18)
    .map((point) => new THREE.Vector3(point.x, point.y, zPosition + 0.02));
  doorHandleObject = updateLineObject(
    doorHandleObject,
    handlePoints,
    doorMaterial,
    THREE.Line
  );
}

function renderCubeScene() {
  renderer.render(scene, camera);
}

function roomHalfSizeAtDepth(zPosition) {
  const progress = THREE.MathUtils.clamp(
    (zPosition - ROOM_DEPTH.nearZ) / (ROOM_DEPTH.farZ - ROOM_DEPTH.nearZ),
    0,
    1
  );

  return {
    width: THREE.MathUtils.lerp(
      currentNearHalfWidth * currentPerspectiveLineExtension,
      FAR_WALL.halfWidth * currentRoomWidthFactor,
      progress
    ),
    height: THREE.MathUtils.lerp(
      currentNearHalfHeight * currentPerspectiveLineExtension,
      FAR_WALL.halfHeight * currentRoomHeightFactor,
      progress
    ),
  };
}

function createCard() {
  if (cards.length >= MAX_CARDS) return;

  const zPosition = randomBetween(ROOM_DEPTH.farZ + 2.5, ROOM_DEPTH.nearZ - 2);
  const roomSize = roomHalfSizeAtDepth(zPosition);
  const baseScale = randomBetween(CARD_MIN_SCALE, CARD_MAX_SCALE);
  const textureEntry = pickCardTexture();
  const mesh = new THREE.Mesh(
    cardGeometry,
    textureEntry.material.clone()
  );
  const border = new THREE.LineSegments(cardBorderGeometry, cardBorderMaterial);
  mesh.scale.x = textureEntry.aspect;
  border.scale.x = textureEntry.aspect;
  border.position.z = 0.006;

  const group = new THREE.Group();
  group.add(mesh, border);
  group.position.set(
    randomBetween(-roomSize.width * 0.76, roomSize.width * 0.76),
    roomSize.height + randomBetween(0.7, 1.8),
    zPosition
  );
  group.rotation.set(
    randomBetween(-0.55, 0.55),
    randomBetween(-0.7, 0.7),
    randomBetween(-Math.PI, Math.PI)
  );
  group.scale.setScalar(baseScale);

  const card = {
    group,
    mesh,
    border,
    textureEntry,
    baseScale,
    fallSpeed: randomBetween(CARD_FALL_SPEED_MIN, CARD_FALL_SPEED_MAX),
    driftSpeed: randomBetween(-0.14, 0.14),
    rotationSpeed: new THREE.Vector3(
      randomBetween(-CARD_ROTATION_SPEED, CARD_ROTATION_SPEED),
      randomBetween(-CARD_ROTATION_SPEED, CARD_ROTATION_SPEED),
      randomBetween(-CARD_ROTATION_SPEED, CARD_ROTATION_SPEED)
    ),
    isHovered: false,
  };

  mesh.userData.card = card;
  cards.push(card);
  cardMeshes.push(mesh);
  cardGroup.add(group);
  totalCardsCreated += 1;
  cubeSceneElement.dataset.activeCards = String(cards.length);
  cubeSceneElement.dataset.totalCardsCreated = String(totalCardsCreated);
}

function removeCard(card) {
  if (hoveredCard === card) {
    hoveredCard = null;
    canvas.style.cursor = "default";
  }

  cardGroup.remove(card.group);
  const cardIndex = cards.indexOf(card);
  const meshIndex = cardMeshes.indexOf(card.mesh);
  if (cardIndex !== -1) cards.splice(cardIndex, 1);
  if (meshIndex !== -1) cardMeshes.splice(meshIndex, 1);
  totalCardsRemoved += 1;
  cubeSceneElement.dataset.activeCards = String(cards.length);
  cubeSceneElement.dataset.totalCardsRemoved = String(totalCardsRemoved);

  // Geometry 和 Material 是共享资源，此处移除对象引用即可复用。
  card.mesh.userData.card = null;
  card.mesh.material.dispose(); // 独立亮度材质释放，共享纹理仍保留在资源池。
}

function setHoveredCard(nextCard) {
  if (hoveredCard === nextCard) return;

  if (hoveredCard) hoveredCard.isHovered = false;
  hoveredCard = nextCard;
  if (hoveredCard) hoveredCard.isHovered = true;
  canvas.style.cursor = hoveredCard ? "pointer" : "default";
  cubeSceneElement.dataset.readingCard = String(Boolean(hoveredCard));
  if (hoveredCard) triggerSoundEvent(SOUND_EVENTS.cardHover);
}

// Raycaster 每帧只检测当前仍存在的卡片 Mesh
function updateCardHover() {
  if (!pointerIsInside || cardMeshes.length === 0) {
    setHoveredCard(null);
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.intersectObjects(cardMeshes, false)[0];
  setHoveredCard(intersection ? intersection.object.userData.card : null);
}

function updateCards(deltaTime) {
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const motionMultiplier = card.isHovered ? HOVER_FALL_MULTIPLIER : 1;
    const targetBrightness = card.isHovered ? CARD_HOVER_BRIGHTNESS : 1;
    const brightness = THREE.MathUtils.lerp(card.mesh.material.color.r, targetBrightness, 1 - Math.exp(-8 * deltaTime));
    card.mesh.material.color.setRGB(brightness, brightness, brightness);

    card.group.position.y -= card.fallSpeed * deltaTime * motionMultiplier;
    card.group.position.x += card.driftSpeed * deltaTime * motionMultiplier;

    if (card.isHovered) {
      // 使用四元数平滑朝向摄像机，避免瞬间“啪”地摆正
      const alignment = 1 - Math.exp(-HOVER_ROTATION_SPEED * deltaTime);
      card.group.quaternion.slerp(camera.quaternion, alignment);
      const targetScale = card.baseScale * CARD_HOVER_SCALE;
      targetScaleVector.setScalar(targetScale);
      card.group.scale.lerp(targetScaleVector, alignment);
    } else {
      // Mouse Leave 后从当前姿态继续自然旋转，不跳回旧角度
      card.group.rotateX(card.rotationSpeed.x * deltaTime);
      card.group.rotateY(card.rotationSpeed.y * deltaTime);
      card.group.rotateZ(card.rotationSpeed.z * deltaTime);
      const scaleRecovery = 1 - Math.exp(-6 * deltaTime);
      targetScaleVector.setScalar(card.baseScale);
      card.group.scale.lerp(targetScaleVector, scaleRecovery);
    }

    const bottomLimit = -roomHalfSizeAtDepth(card.group.position.z).height - 2.5;
    if (card.group.position.y < bottomLimit) {
      removeCard(card);
    }
  }
}

function updateEscapeButtonPosition() {
  // 门板中心世界坐标；随房间收缩与响应式投影同步移动
  escapeAnchor.set(
    0,
    -1.4 * currentRoomHeightFactor,
    ROOM_DEPTH.farZ + 0.15
  );
  escapeAnchor.project(camera);

  escapeButton.style.left = `${(escapeAnchor.x * 0.5 + 0.5) * window.innerWidth}px`;
  escapeButton.style.top = `${(-escapeAnchor.y * 0.5 + 0.5) * window.innerHeight}px`;
}

function revealEscape(currentTime) {
  if (escapeIsAvailable) return;
  escapeIsAvailable = true;
  escapeRevealTime = currentTime;
  escapeButton.disabled = false;
  escapeButton.setAttribute("aria-hidden", "false");
  setState("escapeAvailable");
  updateEscapeButtonPosition();
  triggerSoundEvent(SOUND_EVENTS.escapeAppear);
}

function updateEscapePulse(currentTime) {
  if (!escapeIsAvailable || escapeRevealTime === null) return;

  const elapsed = Math.max(0, currentTime - escapeRevealTime);
  const rampProgress = THREE.MathUtils.clamp(
    elapsed / ESCAPE_PULSE_RAMP_DURATION,
    0,
    1
  );
  const urgency = Math.pow(rampProgress, ESCAPE_PULSE_ACCELERATION);
  const pulseDuration = THREE.MathUtils.lerp(
    ESCAPE_PULSE_DURATION_START,
    ESCAPE_PULSE_DURATION_MIN,
    urgency
  );
  const pulseScale = THREE.MathUtils.lerp(
    ESCAPE_PULSE_SCALE_START,
    ESCAPE_PULSE_SCALE_MAX,
    urgency
  );

  escapeButton.style.setProperty("--escape-pulse-duration", `${pulseDuration}ms`);
  escapeButton.style.setProperty("--escape-pulse-scale", pulseScale.toFixed(3));
  cubeSceneElement.dataset.escapePulseDuration = Math.round(pulseDuration);
}

function updatePressure(currentTime) {
  if (!pressureSystemActive) return;

  const elapsedPressureTime = Math.max(0, currentTime - pressureStartTime);
  pressureProgress = THREE.MathUtils.clamp(elapsedPressureTime / PRESSURE_DURATION, 0, 1);
  const criticalElapsed = Math.max(0, elapsedPressureTime - PRESSURE_DURATION);
  // 15 秒后缓慢逼近安全极限，永远不会缩到 0。
  const criticalProgress = 1 - Math.exp(-criticalElapsed / CRITICAL_PRESSURE_TIME_CONSTANT);

  // 远端墙与内部截面收缩；近端透视线外点保持宽阔并适度向外延长
  currentRoomWidthFactor = THREE.MathUtils.lerp(
    1,
    ROOM_MIN_WIDTH_FACTOR,
    pressureProgress
  );
  currentRoomHeightFactor = THREE.MathUtils.lerp(
    1,
    ROOM_MIN_HEIGHT_FACTOR,
    pressureProgress
  );
  if (criticalElapsed > 0) {
    currentRoomWidthFactor = THREE.MathUtils.lerp(
      ROOM_MIN_WIDTH_FACTOR,
      ROOM_CRITICAL_WIDTH_FACTOR,
      criticalProgress
    );
    currentRoomHeightFactor = THREE.MathUtils.lerp(
      ROOM_MIN_HEIGHT_FACTOR,
      ROOM_CRITICAL_HEIGHT_FACTOR,
      criticalProgress
    );
  }
  currentPerspectiveLineExtension = THREE.MathUtils.lerp(
    PERSPECTIVE_LINE_EXTENSION,
    PERSPECTIVE_LINE_EXTENSION_MAX,
    pressureProgress
  );
  buildRoom();

  cubeSceneElement.dataset.pressureProgress = pressureProgress.toFixed(3);
  cubeSceneElement.dataset.roomWidthFactor = currentRoomWidthFactor.toFixed(3);
  cubeSceneElement.dataset.roomHeightFactor = currentRoomHeightFactor.toFixed(3);
  cubeSceneElement.dataset.perspectiveLineExtension =
    currentPerspectiveLineExtension.toFixed(3);
  cubeSceneElement.dataset.pressurePhase =
    criticalElapsed > 0 ? "criticalPressure" : "pressureActive";
  cubeSceneElement.dataset.criticalPressureProgress = criticalProgress.toFixed(3);
  updateAudioPressure(pressureProgress);

  if (pressureProgress >= ESCAPE_REVEAL_THRESHOLD) {
    revealEscape(currentTime);
  }

  if (escapeIsAvailable) {
    updateEscapeButtonPosition();
    updateEscapePulse(currentTime);
  }
}

function scheduleNextCard(currentTime) {
  const baseInterval = THREE.MathUtils.lerp(
    CARD_SPAWN_START,
    CARD_SPAWN_END,
    pressureProgress
  );
  nextCardSpawnTime = currentTime + baseInterval * randomBetween(0.75, 1.25);
}

function isCubeExperienceActive() {
  return currentState === "cubeScene" || currentState === "escapeAvailable";
}

function animateCubeScene(currentTime) {
  if (!isCubeExperienceActive()) {
    animationFrameId = null;
    return;
  }

  const deltaTime = Math.min((currentTime - previousFrameTime) / 1000, 0.05);
  previousFrameTime = currentTime;
  wallScrollProgress = (wallScrollProgress + WALL_SCROLL_SPEED * deltaTime) % 1;
  chapter1WallMeshes[0].material.map.offset.set(wallScrollProgress, 0);
  chapter1WallMeshes[1].material.map.offset.set((1 - wallScrollProgress) % 1, 0);
  updatePressure(currentTime);

  if (currentTime >= nextCardSpawnTime) {
    createCard();
    scheduleNextCard(currentTime);
  }

  updateCardHover();
  updateCards(deltaTime);
  renderCubeScene();
  animationFrameId = window.requestAnimationFrame(animateCubeScene);
}

function startCardSystem() {
  if (cardSystemStarted) return;
  cardSystemStarted = true;
  previousFrameTime = performance.now();
  pressureStartTime = previousFrameTime;
  pressureProgress = 0;
  pressureSystemActive = true;
  currentRoomWidthFactor = 1;
  currentRoomHeightFactor = 1;
  currentPerspectiveLineExtension = PERSPECTIVE_LINE_EXTENSION;
  escapeRevealTime = null;
  escapeButton.style.removeProperty("--escape-pulse-duration");
  escapeButton.style.removeProperty("--escape-pulse-scale");
  buildRoom();
  cubeSceneElement.dataset.pressureProgress = "0.000";
  nextCardSpawnTime = previousFrameTime + 180;
  animationFrameId = window.requestAnimationFrame(animateCubeScene);
}

function exitChapterOne() {
  if (currentState !== "escapeAvailable" || chapter1ExitPending) return;
  chapter1ExitPending = true;

  triggerSoundEvent(SOUND_EVENTS.escapeClick);
  // 停止生成、压力增长、房间收缩、Hover 检测和音频递进
  pressureSystemActive = false;
  cardSystemStarted = false;
  pointerIsInside = false;
  setHoveredCard(null);
  escapeButton.disabled = true;
  escapeButton.setAttribute("aria-hidden", "true");
  stopAudioExperience();

  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 保留当前 canvas 快照和卡片，等音效结束后再清理和进入第二章。
  const doorAudio = chapter1AudioTracks.doorOpen;
  let transitioned = false;
  let fallbackTimer;
  function beginTransition() {
    if (transitioned) return;
    transitioned = true;
    clearTimeout(fallbackTimer);
    doorAudio?.removeEventListener("ended", beginTransition);
    doorAudio?.removeEventListener("loadedmetadata", updateFallback);
    cubeSceneElement.classList.add("is-ch1-exiting");
    cubeSceneElement.style.transition = `opacity ${CHAPTER1_FADE_OUT_DURATION}ms ease`;
    chapter2Element.style.transition = `opacity ${CHAPTER2_FADE_IN_DURATION}ms ease`;
    chapter2Element.style.opacity = "0";
    setState("chapter2");
    startChapter2();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cubeSceneElement.style.opacity = "0";
      chapter2Element.style.opacity = "1";
    }));
    setTimeout(() => {
      for (let index = cards.length - 1; index >= 0; index -= 1) removeCard(cards[index]);
      cubeSceneElement.classList.remove("is-ch1-exiting");
      cubeSceneElement.style.removeProperty("opacity");
      cubeSceneElement.style.removeProperty("transition");
      chapter2Element.style.removeProperty("opacity");
      chapter2Element.style.removeProperty("transition");
    }, Math.max(CHAPTER1_FADE_OUT_DURATION, CHAPTER2_FADE_IN_DURATION) + 100);
  }
  function updateFallback() {
    if (transitioned) return;
    clearTimeout(fallbackTimer);
    const remaining = doorAudio && Number.isFinite(doorAudio.duration) && doorAudio.duration > 0
      ? Math.max(0, doorAudio.duration - doorAudio.currentTime) * 1000 + ESCAPE_AUDIO_FALLBACK
      : ESCAPE_AUDIO_FALLBACK;
    fallbackTimer = setTimeout(beginTransition, remaining);
  }
  doorAudio?.addEventListener("ended", beginTransition, { once: true });
  doorAudio?.addEventListener("loadedmetadata", updateFallback);
  updateFallback();
}

escapeButton.addEventListener("click", exitChapterOne);

canvas.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  pointerIsInside = true;
});

canvas.addEventListener("pointerleave", () => {
  pointerIsInside = false;
  pointer.set(2, 2);
  setHoveredCard(null);
});

// 浏览器尺寸变化时同步 renderer、camera 和房间近端尺寸
function resizeCubeScene() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  buildRoom();

  if (isCubeExperienceActive()) {
    if (escapeIsAvailable) updateEscapeButtonPosition();
    renderCubeScene();
  }
}

window.addEventListener("resize", resizeCubeScene);
resizeCubeScene();
// 第一章场景初始化完成后启动独立通知计时，与 popup 状态无关。
resetChapter1NotificationTimer();

// 2A：每条世界空间文字与拾取后的三个字严格一一对应
const CHAPTER2_TARGETS = [
  {
    id: 1,
    displayText:
      "人家四点就起来读书健身了，我八点起床还困得要死。我是不是这辈子就这样了？不行，明天我也四点起，起不来我就是狗。",
    collectedFragment: "我还要",
    worldDirection: { yaw: 42, pitch: 2 },
  },
  {
    id: 2,
    displayText:
      "同学跟我说，他手上已经有两份大厂 SSP offer 了，字节和网易都在催他签，爸妈还让他顺便申藤校。我连简历都还没敢投……我到底在干嘛啊？",
    collectedFragment: "在别人",
    worldDirection: { yaw: -88, pitch: -4 },
  },
  {
    id: 3,
    displayText:
      "网上随便输几个字，AI 生成的海报都比我熬三天做出来的好看。我还在这儿一本一本看设计书……我看这些到底还有没有用啊？",
    collectedFragment: "的精彩",
    worldDirection: { yaw: 132, pitch: 5 },
  },
  {
    id: 4,
    displayText:
      "网上怎么感觉大家都在花钱请人装龙虾啊，也太夸张了吧。算了……我是不是也该去装一个？总不能朋友圈里就我没有吧。",
    collectedFragment: "里消耗",
    worldDirection: { yaw: -142, pitch: 24 },
  },
  {
    id: 5,
    displayText:
      "别人都已经开始用 AI 搞副业赚钱了，我还在这儿傻乎乎画画。画了一整天，最后还被人说“画得不错，下次别画了”。我到底在坚持什么啊？",
    collectedFragment: "自己吗",
    worldDirection: { yaw: 176, pitch: -10 },
  },
];

const CHAPTER2_CAMERA_FOV = 65;
const CHAPTER2_LOOK_SENSITIVITY = 0.18;
const CHAPTER2_PITCH_LIMIT = 12;
const PANORAMA_RADIUS = 40;
const PANORAMA_HEIGHT = 84;
const PANORAMA_SEGMENTS = 64;
const PANORAMA_ROTATION_OFFSET = 0;
const TEXTURE_REPEAT_X = 1;
const TEXTURE_OFFSET_X = 0;
const TEXTURE_FLIP_X = true;
// PNG 原图为 128×128；热点按 112px 显示尺寸对准顶部指向尖端。
const VIRTUAL_CURSOR_SIZE = 112;
const CURSOR_HOTSPOT_X = 64;
const CURSOR_HOTSPOT_Y = 96;
// 第二章音频集中配置：正式素材到位后只需填写路径并调整独立音量。
const CHAPTER2_BG_AUDIO = "";
const TEXT_PICKUP_AUDIO = "";
const TEXT_IMPACT_AUDIO = "";
const CHAPTER2_BG_VOLUME = 0.22;
const TEXT_PICKUP_VOLUME = 0.45;
const TEXT_IMPACT_VOLUME = 0.58;
const CHAPTER2_MUSIC_FADE_IN = 1200;
const CHAPTER2_MUSIC_FADE_OUT = 700;
const TRAIN_ARRIVAL_AUDIO = "";
const TRAIN_DEPARTURE_AUDIO = "";
const TRAIN_ARRIVAL_VOLUME = 0.45;
const TRAIN_DEPARTURE_VOLUME = 0.45;
// 2B 可调参数：移动响应不因重量降低，负重由向下重力表现。
const CURSOR_MOVE_SPEED = 420;
const BASE_GRAVITY = 4;
const GRAVITY_PER_COLLECTION = 42;
const MAX_GRAVITY = 220;
const UPWARD_FORCE = 620;
const DOWNWARD_FORCE = 400;
const CURSOR_VERTICAL_DAMPING = 1.35;
const MAX_CURSOR_VERTICAL_SPEED = 260;
const CHAIN_TOP_OFFSET = 40;
const CHAIN_SPACING = 23;
const CHAIN_FOLLOW = 54;
const CHAIN_DAMPING = 8;
const CHAIN_SWAY_LIMIT = 64;
// 2C 最终完整句、强制下坠与散落参数。
const FINAL_SENTENCE_HOLD = 1100;
const FORCED_FALL_GRAVITY = 1600;
const FORCED_FALL_MAX_SPEED = 900;
const IMPACT_BOUNCE = 8;
const IMPACT_DURATION = 180;
const SCATTER_X_FORCE = 150;
const SCATTER_Y_FORCE = 280;
const SCATTER_ROTATION = 150;
const SCATTER_GRAVITY = 900;
const SCATTER_DAMPING = 0.72;
const SCATTER_FLOOR_OFFSET = 14;
const SCATTER_SETTLE_SPEED = 18;
const SCATTER_MAX_DURATION = 5000;
// 2D 火车离场节奏与位置：时间单位为毫秒，X 为视口宽度倍数。
const POST_SCATTER_HOLD = 1400;
const SCENE_FADE_DURATION = 900;
const TEXT_FADE_DURATION = 1200;
const TEXT_FADE_DELAY = 100;
const CHARACTER_REVEAL_DURATION = 450;
const CHARACTER_TO_TRAIN_DELAY = 450;
const TRAIN_ENTRY_DURATION = 2200;
const TRAIN_ENTRY_START_X = -0.62;
const TRAIN_STOP_X = 0.18;
const BUBBLE_DELAY = 450;
const BOARD_HOLD_DURATION = 1200;
const BOARD_CROSSFADE_DURATION = 240;
const TRAIN_EXIT_DELAY = 550;
const TRAIN_EXIT_DURATION = 2800;
const TRAIN_EXIT_X = 1.05;
const VIRTUAL_CURSOR_MARGIN_X = 48;
const VIRTUAL_CURSOR_MARGIN_TOP = 34;
const TARGET_DISTANCE = 12;

const chapter2Scene = new THREE.Scene();
chapter2Scene.background = new THREE.Color(0xededeb);
const chapter2Camera = new THREE.PerspectiveCamera(
  CHAPTER2_CAMERA_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
const chapter2Renderer = new THREE.WebGLRenderer({
  canvas: chapter2Canvas,
  antialias: true,
});
chapter2Renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 卧室横向展开图完整贴到圆柱内壁；圆柱仍保持开放，不铺地板和天花板。
const panoramaGeometry = new THREE.CylinderGeometry(
  PANORAMA_RADIUS,
  PANORAMA_RADIUS,
  PANORAMA_HEIGHT,
  PANORAMA_SEGMENTS,
  1,
  true
);
const panoramaTexture = new THREE.TextureLoader().load(
  new URL("./pic/second/room.png", import.meta.url).href,
  (texture) => {
    chapter2Element.dataset.panoramaTexture = "loaded";
    chapter2Element.dataset.panoramaSize = `${texture.image.width}x${texture.image.height}`;
    if (currentState === "chapter2") chapter2Renderer.render(chapter2Scene, chapter2Camera);
  },
  undefined,
  () => {
    chapter2Element.dataset.panoramaTexture = "error";
  }
);
panoramaTexture.colorSpace = THREE.SRGBColorSpace;
panoramaTexture.wrapS = THREE.RepeatWrapping;
panoramaTexture.repeat.x = TEXTURE_FLIP_X ? -TEXTURE_REPEAT_X : TEXTURE_REPEAT_X;
panoramaTexture.offset.x = TEXTURE_OFFSET_X + (TEXTURE_FLIP_X ? 1 : 0);
const panoramaMaterial = new THREE.MeshBasicMaterial({
  map: panoramaTexture,
  side: THREE.BackSide,
});
const panoramaMesh = new THREE.Mesh(panoramaGeometry, panoramaMaterial);
panoramaMesh.rotation.y = PANORAMA_ROTATION_OFFSET;
chapter2Scene.add(panoramaMesh);

const chapter2Raycaster = new THREE.Raycaster();
const virtualCursorNdc = new THREE.Vector2();
const chapter2LookDirection = new THREE.Vector3();
const chapter2Keys = new Set();
const collectedFragments = [];
// 每个汉字都是独立节点；2B 可直接为节点增加位置、速度和约束数据。
const collectedCharacterNodes = [];
let chapter2Started = false;
let chapter2AnimationFrame = null;
let chapter2PreviousTime = 0;
let chapter2Yaw = 0;
let chapter2Pitch = 0;
let currentTargetIndex = 0;
let activeTextTarget = null;
let virtualCursorX = window.innerWidth / 2;
let virtualCursorY = window.innerHeight / 2;
let virtualCursorVelocityY = 0;
let isDraggingChapter2 = false;
let dragPointerId = null;
let previousDragX = 0;
let previousDragY = 0;
let chapter2Phase = "targetActive";
let finalPhaseStartTime = 0;
let forcedFallVelocityY = 0;
let impactFloorY = 0;
let scatterStartTime = 0;
let chapter2BackgroundMusic = null;
let chapter2MusicFadeFrame = null;
let chapter2ImpactSoundPlayed = false;
let boardingHoldStartTime = null;
let finaleTrainX = 0;

chapter2Element.style.setProperty("--virtual-cursor-size", `${VIRTUAL_CURSOR_SIZE}px`);
chapter2Element.style.setProperty(
  "--scene-fade-duration",
  `${SCENE_FADE_DURATION}ms`
);
chapter2Element.style.setProperty(
  "--text-fade-duration",
  `${TEXT_FADE_DURATION}ms`
);
chapter2Element.style.setProperty("--text-fade-delay", `${TEXT_FADE_DELAY}ms`);
chapter2FinaleElement.style.setProperty(
  "--board-crossfade-duration",
  `${BOARD_CROSSFADE_DURATION}ms`
);

function fadeChapter2Music(targetVolume, duration, onComplete) {
  if (!chapter2BackgroundMusic) return;
  if (chapter2MusicFadeFrame !== null) {
    window.cancelAnimationFrame(chapter2MusicFadeFrame);
  }
  const startVolume = chapter2BackgroundMusic.volume;
  const startTime = performance.now();

  function updateFade(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    chapter2BackgroundMusic.volume = THREE.MathUtils.lerp(
      startVolume,
      targetVolume,
      progress
    );
    if (progress < 1) {
      chapter2MusicFadeFrame = window.requestAnimationFrame(updateFade);
      return;
    }
    chapter2MusicFadeFrame = null;
    onComplete?.();
  }

  chapter2MusicFadeFrame = window.requestAnimationFrame(updateFade);
}

function startChapter2Music() {
  triggerSoundEvent(SOUND_EVENTS.chapter2MusicStart);
  if (!CHAPTER2_BG_AUDIO) {
    chapter2Element.dataset.musicState = "waitingForAsset";
    return;
  }

  if (!chapter2BackgroundMusic) {
    chapter2BackgroundMusic = new Audio(
      new URL(CHAPTER2_BG_AUDIO, import.meta.url).href
    );
    chapter2BackgroundMusic.loop = true;
    chapter2BackgroundMusic.preload = "auto";
  }
  chapter2BackgroundMusic.volume = 0;
  chapter2BackgroundMusic.currentTime = 0;
  chapter2BackgroundMusic.play().then(() => {
    chapter2Element.dataset.musicState = "playing";
    fadeChapter2Music(CHAPTER2_BG_VOLUME, CHAPTER2_MUSIC_FADE_IN);
  }).catch(() => {
    chapter2Element.dataset.musicState = "unavailable";
  });
}

function stopChapter2Music() {
  if (!chapter2BackgroundMusic) {
    chapter2Element.dataset.musicState = "stopped";
    return;
  }
  fadeChapter2Music(0, CHAPTER2_MUSIC_FADE_OUT, () => {
    chapter2BackgroundMusic.pause();
    chapter2BackgroundMusic.currentTime = 0;
    chapter2Element.dataset.musicState = "stopped";
  });
}

function playChapter2OneShot(path, volume) {
  if (!path) return;
  const sound = new Audio(new URL(path, import.meta.url).href);
  sound.volume = volume;
  sound.play().catch(() => {
    // 音频缺失或浏览器拒绝播放时，不中断文字与动画逻辑。
  });
}

function playTextPickupSound() {
  triggerSoundEvent(SOUND_EVENTS.chapter2TextPickup);
  playChapter2OneShot(TEXT_PICKUP_AUDIO, TEXT_PICKUP_VOLUME);
}

function playFinalImpactSound() {
  if (chapter2ImpactSoundPlayed) return;
  chapter2ImpactSoundPlayed = true;
  triggerSoundEvent(SOUND_EVENTS.chapter2Impact);
  playChapter2OneShot(TEXT_IMPACT_AUDIO, TEXT_IMPACT_VOLUME);
}

function playTrainArrivalSound() {
  triggerSoundEvent(SOUND_EVENTS.trainArrival);
  playChapter2OneShot(TRAIN_ARRIVAL_AUDIO, TRAIN_ARRIVAL_VOLUME);
}

function playTrainDepartureSound() {
  triggerSoundEvent(SOUND_EVENTS.trainDeparture);
  playChapter2OneShot(TRAIN_DEPARTURE_AUDIO, TRAIN_DEPARTURE_VOLUME);
}

window.fomoChapter2Audio = Object.freeze({
  startChapter2Music,
  stopChapter2Music,
  playTextPickupSound,
  playFinalImpactSound,
  playTrainArrivalSound,
  playTrainDepartureSound,
});

function wrapCanvasText(context, text, maxWidth) {
  const forbiddenLineStart = new Set("，。！？；：、……”）》】");
  const forbiddenLineEnd = new Set("“（《【");
  const lines = [];
  let line = "";

  Array.from(text).forEach((character) => {
    const testLine = line + character;
    if (line && context.measureText(testLine).width > maxWidth) {
      if (forbiddenLineStart.has(character)) {
        // 结束标点留在上一行，允许这一行轻微超出理想宽度。
        lines.push(testLine);
        line = "";
      } else if (forbiddenLineEnd.has(line.at(-1))) {
        const openingMark = line.at(-1);
        lines.push(line.slice(0, -1));
        line = openingMark + character;
      } else {
        lines.push(line);
        line = character;
      }
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function createTextTarget(targetData) {
  const textCanvas = document.createElement("canvas");
  textCanvas.width = 1024;
  const context = textCanvas.getContext("2d");
  context.font = '900 32px Arial, "Microsoft YaHei", sans-serif';
  // 如需人工控制换行，可为单条数据增加 manualLines 数组，原文无需改动。
  const lines = targetData.manualLines ?? wrapCanvasText(context, targetData.displayText, 820);
  const lineHeight = 48;
  const fontSize = 32;
  const horizontalPadding = 28;
  const verticalPadding = 20;
  const contentWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  textCanvas.width = Math.ceil(contentWidth + horizontalPadding * 2);
  textCanvas.height =
    (lines.length - 1) * lineHeight + fontSize + verticalPadding * 2;

  context.fillStyle = "rgba(250, 250, 248, 0.94)";
  context.fillRect(0, 0, textCanvas.width, textCanvas.height);
  context.strokeStyle = "#111111";
  context.lineWidth = 2;
  context.strokeRect(1, 1, textCanvas.width - 2, textCanvas.height - 2);
  context.fillStyle = "#111111";
  context.font = '900 32px Arial, "Microsoft YaHei", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "top";
  lines.forEach((line, index) => {
    context.fillText(line, textCanvas.width / 2, verticalPadding + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(textCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  const yaw = THREE.MathUtils.degToRad(targetData.worldDirection.yaw);
  const pitch = THREE.MathUtils.degToRad(targetData.worldDirection.pitch);
  sprite.position.set(
    Math.sin(yaw) * Math.cos(pitch) * TARGET_DISTANCE,
    Math.sin(pitch) * TARGET_DISTANCE,
    -Math.cos(yaw) * Math.cos(pitch) * TARGET_DISTANCE
  );
  const spriteWidth = 10.5 * (textCanvas.width / 1024);
  sprite.scale.set(spriteWidth, spriteWidth * (textCanvas.height / textCanvas.width), 1);
  sprite.renderOrder = 2;
  sprite.userData.targetData = targetData;
  return { sprite, texture, material };
}

function activateCurrentTarget() {
  if (activeTextTarget) {
    chapter2Scene.remove(activeTextTarget.sprite);
    activeTextTarget.material.dispose();
    activeTextTarget.texture.dispose();
    activeTextTarget = null;
  }

  if (currentTargetIndex >= CHAPTER2_TARGETS.length) {
    chapter2Element.dataset.currentTargetIndex = String(currentTargetIndex);
    virtualCursorElement.classList.remove("is-aiming");
    return;
  }

  activeTextTarget = createTextTarget(CHAPTER2_TARGETS[currentTargetIndex]);
  chapter2Scene.add(activeTextTarget.sprite);
  chapter2Phase = "targetActive";
  chapter2Element.dataset.phase = chapter2Phase;
  chapter2Element.dataset.currentTargetIndex = String(currentTargetIndex);
}

function updateVirtualCursorPosition() {
  const hangingHeight = CHAIN_TOP_OFFSET + collectedCharacterNodes.length * CHAIN_SPACING;
  const maxY = Math.max(VIRTUAL_CURSOR_MARGIN_TOP, window.innerHeight - hangingHeight);
  const nextX = THREE.MathUtils.clamp(
    virtualCursorX,
    VIRTUAL_CURSOR_MARGIN_X,
    window.innerWidth - (VIRTUAL_CURSOR_SIZE - CURSOR_HOTSPOT_X) - VIRTUAL_CURSOR_MARGIN_X
  );
  const nextY = THREE.MathUtils.clamp(
    virtualCursorY,
    VIRTUAL_CURSOR_MARGIN_TOP,
    maxY
  );
  if (nextY !== virtualCursorY) virtualCursorVelocityY = 0;
  virtualCursorX = nextX;
  virtualCursorY = nextY;
  renderVirtualCursor();
}

function renderVirtualCursor() {
  virtualCursorElement.style.left = `${virtualCursorX - CURSOR_HOTSPOT_X}px`;
  virtualCursorElement.style.top = `${virtualCursorY - CURSOR_HOTSPOT_Y}px`;
}

function renderCharacterChain() {
  collectedCharacterNodes.forEach((node) => {
    node.element.style.left = `${node.x}px`;
    node.element.style.top = `${node.y}px`;
  });
}

function updateCharacterChain(deltaTime, constraintsActive = true) {
  let previousX = virtualCursorX;
  let previousY = virtualCursorY + CHAIN_TOP_OFFSET;
  const damping = Math.exp(-CHAIN_DAMPING * deltaTime);

  collectedCharacterNodes.forEach((node, index) => {
    const targetX = previousX;
    const targetY = previousY + (index === 0 ? 0 : CHAIN_SPACING);
    const depthFollow = CHAIN_FOLLOW / (1 + index * 0.045);

    node.velocityX += (targetX - node.x) * depthFollow * deltaTime;
    node.velocityY += (targetY - node.y) * depthFollow * deltaTime;
    node.velocityX *= damping;
    node.velocityY *= damping;
    node.x += node.velocityX * deltaTime;
    node.y += node.velocityY * deltaTime;

    const allowedSway = CHAIN_SWAY_LIMIT * (0.45 + index * 0.04);
    node.x = THREE.MathUtils.clamp(
      node.x,
      virtualCursorX - allowedSway,
      virtualCursorX + allowedSway
    );
    if (constraintsActive) {
      node.y = THREE.MathUtils.clamp(
        node.y,
        previousY + (index === 0 ? -4 : CHAIN_SPACING * 0.62),
        previousY + (index === 0 ? 8 : CHAIN_SPACING * 2)
      );
      node.y = Math.min(node.y, window.innerHeight - 12);
    }

    previousX = node.x;
    previousY = node.y;
  });
  renderCharacterChain();
}

function raycastFromVirtualCursor() {
  if (!activeTextTarget) return false;
  virtualCursorNdc.set(
    (virtualCursorX / window.innerWidth) * 2 - 1,
    -(virtualCursorY / window.innerHeight) * 2 + 1
  );
  chapter2Raycaster.setFromCamera(virtualCursorNdc, chapter2Camera);
  return chapter2Raycaster.intersectObject(activeTextTarget.sprite, false).length > 0;
}

function appendCharacterNode(character, isPunctuation = false) {
  const characterElement = document.createElement("span");
  characterElement.className = "collected-character";
  characterElement.textContent = character;
  const previousNode = collectedCharacterNodes.at(-1);
  const characterNode = {
    character,
    element: characterElement,
    x: previousNode?.x ?? virtualCursorX,
    y: previousNode
      ? previousNode.y + CHAIN_SPACING
      : virtualCursorY + CHAIN_TOP_OFFSET,
    velocityX: previousNode?.velocityX ?? 0,
    velocityY: previousNode?.velocityY ?? 0,
    rotation: 0,
    angularVelocity: 0,
    floorY: 0,
    settled: false,
    isPunctuation,
  };
  characterElement.dataset.chainIndex = String(collectedCharacterNodes.length);
  if (isPunctuation) characterElement.dataset.punctuation = "true";
  collectedCharacterNodes.push(characterNode);
  collectedFragmentsElement.appendChild(characterElement);
}

function beginFinalChainSequence() {
  appendCharacterNode("？", true);
  chapter2Phase = "finalChainComplete";
  finalPhaseStartTime = performance.now();
  chapter2Element.dataset.phase = chapter2Phase;
  chapter2Element.dataset.finalSentence = `${collectedFragments.join("")}？`;
  updateVirtualCursorPosition();
  renderCharacterChain();
}

function collectCurrentTarget() {
  if (!raycastFromVirtualCursor() || !activeTextTarget) return;

  playTextPickupSound();
  const fragment = CHAPTER2_TARGETS[currentTargetIndex].collectedFragment;
  collectedFragments.push(fragment);
  Array.from(fragment).forEach((character) => appendCharacterNode(character));
  currentTargetIndex += 1;
  chapter2Element.dataset.collectedCount = String(collectedFragments.length);
  chapter2Element.dataset.collectedText = collectedFragments.join("");
  updateVirtualCursorPosition();
  renderCharacterChain();
  activateCurrentTarget();
  if (currentTargetIndex >= CHAPTER2_TARGETS.length) beginFinalChainSequence();
}

function updateChapter2Camera() {
  const yaw = THREE.MathUtils.degToRad(chapter2Yaw);
  const pitch = THREE.MathUtils.degToRad(chapter2Pitch);
  chapter2LookDirection.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
  chapter2Camera.lookAt(chapter2LookDirection);
  chapter2Element.dataset.cameraYaw = chapter2Yaw.toFixed(2);
  chapter2Element.dataset.cameraPitch = chapter2Pitch.toFixed(2);
}

function updateVirtualCursor(deltaTime) {
  let horizontal = 0;
  if (chapter2Keys.has("KeyA") || chapter2Keys.has("ArrowLeft")) horizontal -= 1;
  if (chapter2Keys.has("KeyD") || chapter2Keys.has("ArrowRight")) horizontal += 1;
  const movingUp = chapter2Keys.has("KeyW") || chapter2Keys.has("ArrowUp");
  const movingDown = chapter2Keys.has("KeyS") || chapter2Keys.has("ArrowDown");
  const gravity = Math.min(
    BASE_GRAVITY + collectedFragments.length * GRAVITY_PER_COLLECTION,
    MAX_GRAVITY
  );
  const verticalForce =
    gravity + (movingDown ? DOWNWARD_FORCE : 0) - (movingUp ? UPWARD_FORCE : 0);

  virtualCursorX += horizontal * CURSOR_MOVE_SPEED * deltaTime;
  virtualCursorVelocityY += verticalForce * deltaTime;
  virtualCursorVelocityY *= Math.exp(-CURSOR_VERTICAL_DAMPING * deltaTime);
  virtualCursorVelocityY = THREE.MathUtils.clamp(
    virtualCursorVelocityY,
    -MAX_CURSOR_VERTICAL_SPEED,
    MAX_CURSOR_VERTICAL_SPEED
  );
  virtualCursorY += virtualCursorVelocityY * deltaTime;
  updateVirtualCursorPosition();
  chapter2Element.dataset.cursorVelocityY = virtualCursorVelocityY.toFixed(2);
  chapter2Element.dataset.cursorGravity = gravity.toFixed(2);
}

function getScatterFloorY() {
  return window.innerHeight - SCATTER_FLOOR_OFFSET;
}

function startForcedFall(currentTime) {
  chapter2Phase = "forcedFall";
  chapter2Element.dataset.phase = chapter2Phase;
  chapter2Keys.clear();
  forcedFallVelocityY = Math.max(80, virtualCursorVelocityY);
  finalPhaseStartTime = currentTime;
}

function startImpact(currentTime) {
  chapter2Phase = "impact";
  chapter2Element.dataset.phase = chapter2Phase;
  finalPhaseStartTime = currentTime;
  impactFloorY = virtualCursorY;
  forcedFallVelocityY = 0;
  playFinalImpactSound();
}

function updateForcedFall(deltaTime, currentTime) {
  forcedFallVelocityY = Math.min(
    forcedFallVelocityY + FORCED_FALL_GRAVITY * deltaTime,
    FORCED_FALL_MAX_SPEED
  );
  virtualCursorY += forcedFallVelocityY * deltaTime;

  const floorY = getScatterFloorY();
  const cursorBottom = virtualCursorY - CURSOR_HOTSPOT_Y + VIRTUAL_CURSOR_SIZE;
  if (cursorBottom >= floorY) {
    virtualCursorY = floorY - VIRTUAL_CURSOR_SIZE + CURSOR_HOTSPOT_Y;
    renderVirtualCursor();
    updateCharacterChain(deltaTime, false);
    startImpact(currentTime);
    return;
  }

  renderVirtualCursor();
  updateCharacterChain(deltaTime, false);
}

function startCharacterScatter(currentTime) {
  chapter2Phase = "characterScatter";
  chapter2Element.dataset.phase = chapter2Phase;
  scatterStartTime = currentTime;
  const floorY = getScatterFloorY();

  // 链条在撞击后解除：每个汉字转为独立、轻量的屏幕空间运动节点。
  collectedCharacterNodes.forEach((node) => {
    node.x = THREE.MathUtils.clamp(node.x, 18, window.innerWidth - 18);
    node.y = Math.min(node.y, floorY - randomBetween(10, 60));
    node.velocityX = randomBetween(-SCATTER_X_FORCE, SCATTER_X_FORCE);
    node.velocityY = -randomBetween(SCATTER_Y_FORCE * 0.35, SCATTER_Y_FORCE);
    node.rotation = randomBetween(-8, 8);
    node.angularVelocity = randomBetween(-SCATTER_ROTATION, SCATTER_ROTATION);
    node.floorY = floorY - randomBetween(0, 20);
    node.settled = false;
  });
}

function updateImpact(currentTime) {
  const impactProgress = THREE.MathUtils.clamp(
    (currentTime - finalPhaseStartTime) / IMPACT_DURATION,
    0,
    1
  );
  virtualCursorY = impactFloorY - Math.sin(impactProgress * Math.PI) * IMPACT_BOUNCE;
  renderVirtualCursor();
  renderCharacterChain();
  if (impactProgress >= 1) startCharacterScatter(currentTime);
}

function updateCharacterScatter(deltaTime, currentTime) {
  let allSettled = true;
  const sideMargin = 14;

  collectedCharacterNodes.forEach((node) => {
    if (node.settled) return;
    allSettled = false;
    node.velocityY += SCATTER_GRAVITY * deltaTime;
    node.x += node.velocityX * deltaTime;
    node.y += node.velocityY * deltaTime;
    node.rotation += node.angularVelocity * deltaTime;
    node.velocityX *= Math.exp(-1.2 * deltaTime);
    node.angularVelocity *= Math.exp(-1.4 * deltaTime);

    if (node.x <= sideMargin || node.x >= window.innerWidth - sideMargin) {
      node.x = THREE.MathUtils.clamp(node.x, sideMargin, window.innerWidth - sideMargin);
      node.velocityX *= -0.35;
    }

    if (node.y >= node.floorY) {
      node.y = node.floorY;
      if (Math.abs(node.velocityY) > SCATTER_SETTLE_SPEED) {
        node.velocityY = -Math.abs(node.velocityY) * SCATTER_DAMPING;
        node.velocityX *= SCATTER_DAMPING;
        node.angularVelocity *= SCATTER_DAMPING;
      } else {
        node.velocityY = 0;
        node.velocityX *= 0.82;
        node.angularVelocity *= 0.8;
        if (
          Math.abs(node.velocityX) < SCATTER_SETTLE_SPEED &&
          Math.abs(node.angularVelocity) < SCATTER_SETTLE_SPEED
        ) {
          node.velocityX = 0;
          node.angularVelocity = 0;
          node.settled = true;
        }
      }
    }

    node.element.style.rotate = `${node.rotation}deg`;
  });

  renderCharacterChain();
  if (allSettled || currentTime - scatterStartTime >= SCATTER_MAX_DURATION) {
    collectedCharacterNodes.forEach((node) => {
      node.velocityX = 0;
      node.velocityY = 0;
      node.angularVelocity = 0;
      node.settled = true;
    });
    chapter2Phase = "scatterComplete";
    finalPhaseStartTime = currentTime;
    chapter2Element.dataset.phase = chapter2Phase;
    chapter2Element.dataset.scatterCount = String(collectedCharacterNodes.length);
  }
}

function setFinaleTrainPosition(element, x, verticalOffset = 0) {
  element.style.transform = `translate3d(${x}px, ${verticalOffset}px, 0)`;
}

function setFinalePhase(nextPhase, currentTime) {
  chapter2Phase = nextPhase;
  finalPhaseStartTime = currentTime;
  chapter2Element.dataset.phase = chapter2Phase;
}

function startSceneFade(currentTime) {
  setFinalePhase("sceneFading", currentTime);
  chapter2Element.classList.add("is-scene-fading");
  chapter2FinaleElement.classList.add("is-active");
  chapter2FinaleElement.setAttribute("aria-hidden", "false");
  virtualCursorElement.classList.add("is-finale-hidden");
  collectedFragmentsElement.style.opacity = "0";
  if (dragPointerId !== null && chapter2Canvas.hasPointerCapture?.(dragPointerId)) {
    chapter2Canvas.releasePointerCapture(dragPointerId);
  }
  isDraggingChapter2 = false;
  dragPointerId = null;
  chapter2Canvas.classList.remove("is-dragging");
  chapter2Keys.clear();
}

function finishSceneFade(currentTime) {
  setFinalePhase("flat2DScene", currentTime);
  chapter2Element.classList.remove("is-scene-fading");
  chapter2Element.classList.add("is-flat-2d");
  virtualCursorElement.classList.remove("is-aiming");
}

function startCharacterReveal(currentTime) {
  setFinalePhase("characterReveal", currentTime);
  finaleCharacterElement.classList.add("is-visible");
  finaleTrainX = window.innerWidth * TRAIN_ENTRY_START_X;
  setFinaleTrainPosition(finaleTrainElement, finaleTrainX);
}

function startTrainEntry(currentTime) {
  setFinalePhase("trainEntering", currentTime);
  finaleTrainElement.classList.add("is-visible");
  playTrainArrivalSound();
}

function showBoardingPrompt(currentTime) {
  setFinalePhase("waitingForBoard", currentTime);
  boardingBubbleElement.classList.add("is-visible");
  boardingBubbleElement.style.setProperty("--boarding-progress", "0%");
}

function beginBoardingHold(currentTime) {
  if (chapter2Phase !== "waitingForBoard") return;
  setFinalePhase("boardingHold", currentTime);
  boardingHoldStartTime = currentTime;
  boardingBubbleElement.classList.add("is-holding");
}

function cancelBoardingHold() {
  if (chapter2Phase !== "boardingHold") return;
  setFinalePhase("waitingForBoard", performance.now());
  boardingHoldStartTime = null;
  boardingBubbleElement.classList.remove("is-holding");
  boardingBubbleElement.style.setProperty("--boarding-progress", "0%");
}

function completeBoarding(currentTime) {
  if (chapter2Phase !== "boardingHold") return;
  setFinalePhase("boarded", currentTime);
  boardingHoldStartTime = null;
  boardingBubbleElement.classList.remove("is-visible", "is-holding");
  boardingBubbleElement.style.setProperty("--boarding-progress", "100%");
  finaleCharacterElement.classList.remove("is-visible");
  finaleTrainElement.classList.remove("is-visible");
  setFinaleTrainPosition(finaleBoardedElement, window.innerWidth * TRAIN_STOP_X);
  finaleBoardedElement.classList.add("is-visible");
  virtualCursorElement.classList.add("is-finale-hidden");
  chapter2Keys.clear();
}

function startTrainExit(currentTime) {
  setFinalePhase("trainLeaving", currentTime);
  stopChapter2Music();
  playTrainDepartureSound();
}

function completeChapter2() {
  finaleBoardedElement.classList.remove("is-visible");
  chapter2FinaleElement.classList.remove("is-active");
  chapter2FinaleElement.setAttribute("aria-hidden", "true");
  setState("chapter3");
  chapter2Element.dataset.phase = "chapter2Complete";
  window.dispatchEvent(new CustomEvent("fomo:chapter2Complete"));
  startChapter3();
}

function updateChapter2Finale(currentTime) {
  const elapsed = currentTime - finalPhaseStartTime;

  if (chapter2Phase === "scatterComplete") {
    if (elapsed >= POST_SCATTER_HOLD) startSceneFade(currentTime);
    return;
  }

  if (chapter2Phase === "sceneFading") {
    const completeFadeDuration = Math.max(
      SCENE_FADE_DURATION,
      TEXT_FADE_DELAY + TEXT_FADE_DURATION
    );
    if (elapsed >= completeFadeDuration) finishSceneFade(currentTime);
    return;
  }

  if (chapter2Phase === "flat2DScene") {
    startCharacterReveal(currentTime);
    return;
  }

  if (chapter2Phase === "characterReveal") {
    if (elapsed >= CHARACTER_REVEAL_DURATION + CHARACTER_TO_TRAIN_DELAY) {
      startTrainEntry(currentTime);
    }
    return;
  }

  if (chapter2Phase === "trainEntering") {
    const progress = THREE.MathUtils.clamp(elapsed / TRAIN_ENTRY_DURATION, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    finaleTrainX = THREE.MathUtils.lerp(
      window.innerWidth * TRAIN_ENTRY_START_X,
      window.innerWidth * TRAIN_STOP_X,
      eased
    );
    setFinaleTrainPosition(finaleTrainElement, finaleTrainX);
    if (progress >= 1) setFinalePhase("trainStopped", currentTime);
    return;
  }

  if (chapter2Phase === "trainStopped") {
    setFinaleTrainPosition(finaleTrainElement, window.innerWidth * TRAIN_STOP_X);
    if (elapsed >= BUBBLE_DELAY) showBoardingPrompt(currentTime);
    return;
  }

  if (chapter2Phase === "boardingHold" && boardingHoldStartTime !== null) {
    const progress = THREE.MathUtils.clamp(
      (currentTime - boardingHoldStartTime) / BOARD_HOLD_DURATION,
      0,
      1
    );
    boardingBubbleElement.style.setProperty(
      "--boarding-progress",
      `${(progress * 100).toFixed(1)}%`
    );
    if (progress >= 1) completeBoarding(currentTime);
    return;
  }

  if (chapter2Phase === "boarded") {
    setFinaleTrainPosition(finaleBoardedElement, window.innerWidth * TRAIN_STOP_X);
    if (elapsed >= BOARD_CROSSFADE_DURATION + TRAIN_EXIT_DELAY) {
      startTrainExit(currentTime);
    }
    return;
  }

  if (chapter2Phase === "trainLeaving") {
    const progress = THREE.MathUtils.clamp(elapsed / TRAIN_EXIT_DURATION, 0, 1);
    const eased = progress * progress;
    finaleTrainX = THREE.MathUtils.lerp(
      window.innerWidth * TRAIN_STOP_X,
      window.innerWidth * TRAIN_EXIT_X,
      eased
    );
    const runningOffset = Math.sin(progress * Math.PI * 8) * 2;
    setFinaleTrainPosition(finaleBoardedElement, finaleTrainX, runningOffset);
    if (progress >= 1) completeChapter2();
  }
}

function animateChapter2(currentTime) {
  if (currentState !== "chapter2") {
    chapter2AnimationFrame = null;
    return;
  }
  const deltaTime = Math.min((currentTime - chapter2PreviousTime) / 1000, 0.05);
  chapter2PreviousTime = currentTime;

  if (chapter2Phase === "finalChainComplete") {
    updateVirtualCursor(deltaTime);
    updateCharacterChain(deltaTime);
    if (currentTime - finalPhaseStartTime >= FINAL_SENTENCE_HOLD) {
      startForcedFall(currentTime);
    }
  } else if (chapter2Phase === "forcedFall") {
    updateForcedFall(deltaTime, currentTime);
  } else if (chapter2Phase === "impact") {
    updateImpact(currentTime);
  } else if (chapter2Phase === "characterScatter") {
    updateCharacterScatter(deltaTime, currentTime);
  } else if (chapter2Phase === "targetActive") {
    updateVirtualCursor(deltaTime);
    updateCharacterChain(deltaTime);
  }

  updateChapter2Finale(currentTime);
  if (currentState !== "chapter2") {
    chapter2AnimationFrame = null;
    return;
  }

  const isInFlat2DScene = [
    "sceneFading",
    "flat2DScene",
    "characterReveal",
    "trainEntering",
    "trainStopped",
    "waitingForBoard",
    "boardingHold",
    "boarded",
    "trainLeaving",
  ].includes(chapter2Phase);
  if (!isInFlat2DScene) {
    const isAiming = chapter2Phase === "targetActive" && raycastFromVirtualCursor();
    virtualCursorElement.classList.toggle("is-aiming", isAiming);
    if (activeTextTarget) activeTextTarget.material.opacity = isAiming ? 1 : 0.9;
    chapter2Renderer.render(chapter2Scene, chapter2Camera);
  }
  chapter2AnimationFrame = window.requestAnimationFrame(animateChapter2);
}

function startChapter2() {
  if (chapter2Started) return;
  chapter2Started = true;
  chapter2Yaw = 0;
  chapter2Pitch = 0;
  chapter2Phase = "targetActive";
  chapter2Element.dataset.phase = chapter2Phase;
  chapter2ImpactSoundPlayed = false;
  boardingHoldStartTime = null;
  collectedFragmentsElement.style.opacity = "1";
  virtualCursorElement.classList.remove("is-finale-hidden");
  chapter2Element.classList.remove("is-scene-fading", "is-flat-2d");
  chapter2FinaleElement.classList.remove("is-active");
  finaleCharacterElement.classList.remove("is-visible");
  finaleTrainElement.classList.remove("is-visible");
  finaleBoardedElement.classList.remove("is-visible");
  boardingBubbleElement.classList.remove("is-visible", "is-holding");
  boardingBubbleElement.style.setProperty("--boarding-progress", "0%");
  virtualCursorX = window.innerWidth / 2;
  virtualCursorY = window.innerHeight / 2;
  virtualCursorVelocityY = 0;
  updateChapter2Camera();
  updateVirtualCursorPosition();
  activateCurrentTarget();
  resizeChapter2();
  startChapter2Music();
  chapter2PreviousTime = performance.now();
  chapter2AnimationFrame = window.requestAnimationFrame(animateChapter2);
}

chapter2Canvas.addEventListener("pointerdown", (event) => {
  if (currentState !== "chapter2" || event.button !== 0) return;
  if (
    [
      "scatterComplete",
      "sceneFading",
      "flat2DScene",
      "characterReveal",
      "trainEntering",
      "trainStopped",
      "waitingForBoard",
      "boardingHold",
      "boarded",
      "trainLeaving",
    ].includes(chapter2Phase)
  ) return;
  isDraggingChapter2 = true;
  dragPointerId = event.pointerId;
  previousDragX = event.clientX;
  previousDragY = event.clientY;
  try {
    chapter2Canvas.setPointerCapture(event.pointerId);
  } catch {
    // 合成测试事件或旧浏览器可能没有可捕获的活动指针。
  }
  chapter2Canvas.classList.add("is-dragging");
});

chapter2Canvas.addEventListener("pointermove", (event) => {
  if (!isDraggingChapter2 || event.pointerId !== dragPointerId) return;
  const deltaX = event.clientX - previousDragX;
  const deltaY = event.clientY - previousDragY;
  previousDragX = event.clientX;
  previousDragY = event.clientY;
  chapter2Yaw += deltaX * CHAPTER2_LOOK_SENSITIVITY;
  chapter2Pitch = THREE.MathUtils.clamp(
    chapter2Pitch - deltaY * CHAPTER2_LOOK_SENSITIVITY,
    -CHAPTER2_PITCH_LIMIT,
    CHAPTER2_PITCH_LIMIT
  );
  updateChapter2Camera();
});

function stopChapter2Drag(event) {
  if (!isDraggingChapter2 || event.pointerId !== dragPointerId) return;
  isDraggingChapter2 = false;
  dragPointerId = null;
  chapter2Canvas.classList.remove("is-dragging");
}

chapter2Canvas.addEventListener("pointerup", stopChapter2Drag);
chapter2Canvas.addEventListener("pointercancel", stopChapter2Drag);

window.addEventListener("keydown", (event) => {
  if (currentState !== "chapter2") return;
  const controlKeys = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ];
  if (!controlKeys.includes(event.code)) return;
  event.preventDefault();
  if (event.code === "Space") {
    if (!event.repeat && chapter2Phase === "targetActive") collectCurrentTarget();
    if (!event.repeat && chapter2Phase === "waitingForBoard") {
      beginBoardingHold(performance.now());
    }
    return;
  }
  const cursorInputAllowed = ["targetActive", "finalChainComplete"].includes(
    chapter2Phase
  );
  if (!cursorInputAllowed) return;
  chapter2Keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") cancelBoardingHold();
  chapter2Keys.delete(event.code);
});

window.addEventListener("blur", () => {
  cancelBoardingHold();
  chapter2Keys.clear();
});

function resizeChapter2() {
  chapter2Camera.aspect = window.innerWidth / window.innerHeight;
  chapter2Camera.updateProjectionMatrix();
  chapter2Renderer.setSize(window.innerWidth, window.innerHeight, false);
  updateVirtualCursorPosition();
  if (["trainStopped", "waitingForBoard", "boardingHold"].includes(chapter2Phase)) {
    setFinaleTrainPosition(finaleTrainElement, window.innerWidth * TRAIN_STOP_X);
  }
  if (chapter2Phase === "boarded") {
    setFinaleTrainPosition(finaleBoardedElement, window.innerWidth * TRAIN_STOP_X);
  }
}

window.addEventListener("resize", resizeChapter2);
resizeChapter2();

// 3A 米珠帘参数：中间保持较高细节，两侧降低密度以控制性能。
const BEAD_STRAND_COUNT_CENTER = 56;
const BEAD_STRAND_COUNT_SIDE = 14;
const BEAD_VERTICAL_COUNT_CENTER = 52;
const BEAD_VERTICAL_COUNT_SIDE = 34;
const BEAD_SPACING_X_CENTER = 1;
const BEAD_SPACING_X_SIDE = 1.04;
const BEAD_SPACING_Y = 1.02;
const BEAD_SIZE = Object.freeze({ width: 0.2, height: 0.1 });
const CENTER_DETAIL_WIDTH = 0.58;
const CENTER_RESOLUTION_SCALE = 1;
const SIDE_RESOLUTION_SCALE = 1;
const DRAG_REGION_WIDTH = 420;
const DRAG_SENSITIVITY = 2.15;
const DRAG_THRESHOLD = 1;
const DRAG_MAX_OFFSET = 260;
const DRAG_FORCE = 125;
const OPENING_SPREAD = 250;
const CURVE_STRENGTH = 2.25;
const TOP_ANCHOR_STIFFNESS = 100;
const CHAIN_STIFFNESS = 60;
const CURTAIN_CHAIN_DAMPING = 3.4;
const RETURN_SPRING = 12;
const RETURN_DAMPING = 3;
const IDLE_SWAY_AMPLITUDE = 6;
const IDLE_SWAY_SPEED = 0.95;
const IDLE_SWAY_PHASE_VARIATION = 2;
// Canvas 直接在 sRGB 颜色空间显示原图采样；默认不额外压暗或降饱和。
const COLOR_SATURATION_FIX = 1.8;
const COLOR_BRIGHTNESS_FIX = 1;
const CURTAIN_MAX_DPR = 1.5;
const CURTAIN_FRAME_INTERVAL = 1000 / 30;

// 3B 鸟群触发、大小、错峰和曲线飞行参数集中在这里。
const BIRD_TRIGGER_THRESHOLD = 0.42;
const BIRD_COUNT = 7;
const BIRD_SCALE_MIN = 0.2;
const BIRD_SCALE_MAX = 0.25;
const BIRD_STAGGER_MIN = 80;
const BIRD_STAGGER_MAX = 300;
const BIRD_FLIGHT_DURATION_MIN = 2200;
const BIRD_FLIGHT_DURATION_MAX = 4600;
const BIRD_PATH_SPREAD_X = 0.46;
const BIRD_PATH_SPREAD_Y = 0.78;
const BIRD_FADE_IN_DURATION = 180;
const BIRD_FADE_OUT_DURATION = 460;
const BIRD_TRIGGER_DELAY = 150;
const BIRD_FRAME_DURATION = 105;
const BIRD_MIN_OPENING_WIDTH = 34;
const BIRD_FRAME_SETS = Object.freeze([
  Object.freeze([
    new URL("./pic/third/上扬.png", import.meta.url).href,
    new URL("./pic/third/平展 .png", import.meta.url).href,
    new URL("./pic/third/下压.png", import.meta.url).href,
    new URL("./pic/third/平展 .png", import.meta.url).href,
  ]),
  Object.freeze([
    new URL("./pic/third/上扬1.png", import.meta.url).href,
    new URL("./pic/third/平展1.png", import.meta.url).href,
    new URL("./pic/third/下压1.png", import.meta.url).href,
    new URL("./pic/third/平展1.png", import.meta.url).href,
  ]),
]);

// 3C 视频进入、滚轮时间轴与结束判定参数。
const SPACE_HINT_FADE = 1800;
const CURTAIN_EXIT_DURATION = 720;
const VIDEO_SCRUB_SENSITIVITY = 0.0034;
const VIDEO_SCRUB_SMOOTHING = 0.2;
const WHEEL_IDLE_RESUME_DELAY = 550;
const VIDEO_END_THRESHOLD = 0.04;
chapter3Element.style.setProperty("--space-hint-fade", `${SPACE_HINT_FADE}ms`);
chapter3Element.style.setProperty("--curtain-exit-duration", `${CURTAIN_EXIT_DURATION}ms`);

const curtainContext = curtainCanvas.getContext("2d", { alpha: true });
const curtainSourceImage = new Image();
const curtainDrag = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};
let curtainStrands = [];
let curtainWidth = 0;
let curtainHeight = 0;
let curtainImageReady = false;
let curtainStarted = false;
let curtainAnimationFrame = null;
let curtainPreviousTime = 0;
let curtainLastDrawTime = 0;
let curtainOpenProgress = 0;
let birdsTriggered = false;
let currentOpeningPoint = { x: 0, y: 0, width: 0 };
let chapter3Phase = "curtainScene";
let chapter3Completed = false;
let videoTargetTime = 0;
let videoScrubFrame = null;
let videoResumeTimer = null;
let chapter3EnterTimer = null;

function getCurtainSourceCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }

  const height = sourceWidth / targetAspect;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

function getCorrectedCurtainColor(red, green, blue, alpha) {
  const average = (red + green + blue) / 3;
  const adjust = (channel) =>
    Math.round(
      THREE.MathUtils.clamp(
        (average + (channel - average) * COLOR_SATURATION_FIX) *
          COLOR_BRIGHTNESS_FIX,
        0,
        255
      )
    );
  return `rgba(${adjust(red)}, ${adjust(green)}, ${adjust(blue)}, ${alpha / 255})`;
}

function buildCurtainNodes() {
  if (!curtainImageReady || curtainWidth <= 0 || curtainHeight <= 0) return;

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 512;
  sampleCanvas.height = Math.max(
    1,
    Math.min(512, Math.round(sampleCanvas.width * (curtainHeight / curtainWidth)))
  );
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  // 直接取原图代表色，避免缩小采样时过度平均而发灰。
  sampleContext.imageSmoothingEnabled = false;
  const crop = getCurtainSourceCrop(
    curtainSourceImage.naturalWidth,
    curtainSourceImage.naturalHeight,
    curtainWidth,
    curtainHeight
  );
  sampleContext.drawImage(
    curtainSourceImage,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height
  );
  const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  curtainStrands = [];

  const centerWidth = curtainWidth * CENTER_DETAIL_WIDTH;
  const sideWidth = (curtainWidth - centerWidth) / 2;
  const centerStrandCount = Math.max(
    2,
    Math.round(BEAD_STRAND_COUNT_CENTER * CENTER_RESOLUTION_SCALE)
  );
  const sideStrandCount = Math.max(
    1,
    Math.round(BEAD_STRAND_COUNT_SIDE * SIDE_RESOLUTION_SCALE)
  );
  const centerVerticalCount = Math.max(
    2,
    Math.round(BEAD_VERTICAL_COUNT_CENTER * CENTER_RESOLUTION_SCALE)
  );
  const sideVerticalCount = Math.max(
    2,
    Math.round(BEAD_VERTICAL_COUNT_SIDE * SIDE_RESOLUTION_SCALE)
  );
  const strandLayout = [];

  function addStrandRegion(startX, regionWidth, count, verticalCount, spacingScale) {
    const cellWidth = regionWidth / count;
    for (let index = 0; index < count; index += 1) {
      strandLayout.push({
        baseX: startX + (index + 0.5) * cellWidth,
        cellWidth: cellWidth * spacingScale,
        verticalCount,
      });
    }
  }

  addStrandRegion(0, sideWidth, sideStrandCount, sideVerticalCount, BEAD_SPACING_X_SIDE);
  addStrandRegion(
    sideWidth,
    centerWidth,
    centerStrandCount,
    centerVerticalCount,
    BEAD_SPACING_X_CENTER
  );
  addStrandRegion(
    sideWidth + centerWidth,
    sideWidth,
    sideStrandCount,
    sideVerticalCount,
    BEAD_SPACING_X_SIDE
  );

  for (let column = 0; column < strandLayout.length; column += 1) {
    const layout = strandLayout[column];
    const lengthVariation = column % 11 === 0 ? 2 : column % 7 === 0 ? 1 : 0;
    const strandLength = layout.verticalCount - lengthVariation;
    const spacingY = (curtainHeight / (layout.verticalCount - 1)) * BEAD_SPACING_Y;
    const startY = (curtainHeight - spacingY * (layout.verticalCount - 1)) / 2;
    const strand = {
      baseX: layout.baseX,
      idlePhase: column * 0.47,
      beads: [],
    };

    for (let row = 0; row < strandLength; row += 1) {
      const verticalProgress = strandLength > 1 ? row / (strandLength - 1) : 0;
      const baseY = startY + row * spacingY;
      const sampleX = THREE.MathUtils.clamp(
        Math.round((layout.baseX / curtainWidth) * (sampleCanvas.width - 1)),
        0,
        sampleCanvas.width - 1
      );
      const sampleY = THREE.MathUtils.clamp(
        Math.round((baseY / curtainHeight) * (sampleCanvas.height - 1)),
        0,
        sampleCanvas.height - 1
      );
      const pixelIndex = (sampleY * sampleCanvas.width + sampleX) * 4;
      strand.beads.push({
        baseY,
        width: Math.max(5, layout.cellWidth * BEAD_SIZE.width),
        height: Math.max(9, spacingY * BEAD_SIZE.height),
        verticalProgress,
        offsetX: 0,
        velocityX: 0,
        accelerationX: 0,
        idleWeight: Math.pow(verticalProgress, 2.6),
        color: getCorrectedCurtainColor(
          pixels[pixelIndex],
          pixels[pixelIndex + 1],
          pixels[pixelIndex + 2],
          pixels[pixelIndex + 3]
        ),
      });
    }

    curtainStrands.push(strand);
  }

  curtainCanvas.classList.add("is-ready");
  if (currentState === "chapter3") requestCurtainFrame();
}

function resizeCurtain() {
  curtainWidth = window.innerWidth;
  curtainHeight = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, CURTAIN_MAX_DPR);
  curtainCanvas.width = Math.round(curtainWidth * dpr);
  curtainCanvas.height = Math.round(curtainHeight * dpr);
  curtainContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildCurtainNodes();
}

// 预载入三帧振翅素材，避免第一次飞出时临时等待图片。
BIRD_FRAME_SETS.flat().forEach((source) => {
  const image = new Image();
  image.src = source;
});

function playBirdFlySound() {
  triggerSoundEvent(SOUND_EVENTS.birdFly);
}

function getCurtainOpeningPoint() {
  if (!curtainStrands.length) {
    return { x: curtainDrag.startX, y: curtainDrag.startY, width: 0 };
  }

  const openingY = THREE.MathUtils.clamp(
    curtainDrag.startY + (curtainDrag.currentY - curtainDrag.startY) * 0.35,
    curtainHeight * 0.18,
    curtainHeight * 0.8
  );
  let widestGap = 0;
  let openingX = curtainDrag.startX;

  for (let index = 1; index < curtainStrands.length; index += 1) {
    const previousStrand = curtainStrands[index - 1];
    const strand = curtainStrands[index];
    const baseMidpoint = (previousStrand.baseX + strand.baseX) / 2;
    if (Math.abs(baseMidpoint - curtainDrag.startX) > DRAG_REGION_WIDTH * 0.62) continue;

    const previousBeadIndex = Math.round(
      THREE.MathUtils.clamp(openingY / curtainHeight, 0, 1) *
        (previousStrand.beads.length - 1)
    );
    const beadIndex = Math.round(
      THREE.MathUtils.clamp(openingY / curtainHeight, 0, 1) * (strand.beads.length - 1)
    );
    const previousX =
      previousStrand.baseX + previousStrand.beads[previousBeadIndex].offsetX;
    const strandX = strand.baseX + strand.beads[beadIndex].offsetX;
    const gap = strandX - previousX;

    if (gap > widestGap) {
      widestGap = gap;
      openingX = (previousX + strandX) / 2;
    }
  }

  return {
    x: THREE.MathUtils.clamp(openingX, 0, curtainWidth),
    y: openingY,
    width: Math.max(0, widestGap),
  };
}

function cubicBezier(start, controlA, controlB, end, progress) {
  const inverse = 1 - progress;
  return (
    inverse * inverse * inverse * start +
    3 * inverse * inverse * progress * controlA +
    3 * inverse * progress * progress * controlB +
    progress * progress * progress * end
  );
}

function startBirdFlight(index, openingPoint) {
  if (currentState !== "chapter3") return;

  const bird = document.createElement("img");
  const scale = randomBetween(BIRD_SCALE_MIN, BIRD_SCALE_MAX);
  const displaySize = 447 * scale;
  const directionPattern = [-1, 0.72, -0.48, 1, 0.18];
  const direction = directionPattern[index % directionPattern.length];
  const birdFrames = BIRD_FRAME_SETS[index % BIRD_FRAME_SETS.length];
  const start = {
    x: openingPoint.x + randomBetween(-16, 16),
    y: openingPoint.y + randomBetween(-12, 12),
  };
  const end = {
    x: start.x + direction * curtainWidth * BIRD_PATH_SPREAD_X * randomBetween(0.76, 1.08),
    y: start.y - curtainHeight * BIRD_PATH_SPREAD_Y * randomBetween(0.78, 1.08),
  };
  const controlA = {
    x: start.x + direction * curtainWidth * randomBetween(0.08, 0.16),
    y: start.y - curtainHeight * randomBetween(0.12, 0.24),
  };
  const controlB = {
    x: end.x - direction * curtainWidth * randomBetween(0.05, 0.14),
    y: start.y - curtainHeight * randomBetween(0.42, 0.64),
  };
  const duration = randomBetween(BIRD_FLIGHT_DURATION_MIN, BIRD_FLIGHT_DURATION_MAX);
  const startTime = performance.now();
  let movedToFront = false;
  let previousFrameIndex = -1;

  bird.className = "flying-bird";
  bird.alt = "";
  bird.decoding = "async";
  bird.style.width = `${displaySize}px`;
  birdRearLayer.appendChild(bird);

  function animateBird(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    const easedProgress = progress * progress * (3 - 2 * progress);
    const frameIndex = Math.floor(elapsed / BIRD_FRAME_DURATION) % birdFrames.length;

    if (frameIndex !== previousFrameIndex) {
      bird.src = birdFrames[frameIndex];
      previousFrameIndex = frameIndex;
    }

    if (!movedToFront && progress >= 0.16) {
      birdFrontLayer.appendChild(bird);
      movedToFront = true;
    }

    const x = cubicBezier(start.x, controlA.x, controlB.x, end.x, easedProgress);
    const y = cubicBezier(start.y, controlA.y, controlB.y, end.y, easedProgress);
    const nextProgress = Math.min(1, easedProgress + 0.012);
    const nextX = cubicBezier(start.x, controlA.x, controlB.x, end.x, nextProgress);
    const nextY = cubicBezier(start.y, controlA.y, controlB.y, end.y, nextProgress);
    const rotation = Math.atan2(nextY - y, nextX - x) * (180 / Math.PI);
    const depthScale = 0.72 + progress * 0.28;
    const facing = direction < 0 ? -1 : 1;
    const fadeIn = Math.min(1, elapsed / BIRD_FADE_IN_DURATION);
    const fadeOut = Math.min(1, (duration - elapsed) / BIRD_FADE_OUT_DURATION);

    bird.style.opacity = String(Math.max(0, Math.min(fadeIn, fadeOut)));
    bird.style.transform = `translate3d(${x - displaySize / 2}px, ${
      y - displaySize / 2
    }px, 0) rotate(${rotation}deg) scale(${depthScale}) scaleX(${facing})`;

    if (progress < 1) {
      window.requestAnimationFrame(animateBird);
    } else {
      bird.remove();
    }
  }

  window.requestAnimationFrame(animateBird);
}

function triggerBirdGroup(openingPoint) {
  if (birdsTriggered) return;
  birdsTriggered = true;
  chapter3Element.dataset.birdsTriggered = "true";
  playBirdFlySound();

  let stagger = BIRD_TRIGGER_DELAY;
  for (let index = 0; index < BIRD_COUNT; index += 1) {
    const capturedOpening = { ...openingPoint };
    window.setTimeout(() => startBirdFlight(index, capturedOpening), stagger);
    stagger += randomBetween(BIRD_STAGGER_MIN, BIRD_STAGGER_MAX);
  }
}

function setChapter3Phase(nextPhase) {
  chapter3Phase = nextPhase;
  chapter3Element.dataset.phase = nextPhase;
  requestAnimationFrame(() => logChapter3VideoDiagnostics(`phase:${nextPhase}`));
}

// 仅诊断，不改变播放、样式、层级或状态。
function logChapter3VideoDiagnostics(reason) {
  const video = chapter3Video;
  if (!video) { console.error("[chapter3 video] video 元素不存在"); return; }
  const style = getComputedStyle(video);
  const rect = video.getBoundingClientRect();
  const ancestors = [];
  for (let node = video.parentElement; node; node = node.parentElement) {
    const css = getComputedStyle(node);
    const bounds = node.getBoundingClientRect();
    ancestors.push({ element: node.className || node.tagName, display: css.display,
      visibility: css.visibility, opacity: css.opacity, zIndex: css.zIndex,
      transform: css.transform, width: bounds.width, height: bounds.height });
  }
  console.log("[chapter3 video diagnostics]", {
    reason, src: video.currentSrc || video.src, duration: video.duration,
    videoWidth: video.videoWidth, videoHeight: video.videoHeight,
    readyState: video.readyState, paused: video.paused, currentTime: video.currentTime,
    inDOM: video.isConnected, width: rect.width, height: rect.height,
    x: rect.x, y: rect.y, opacity: style.opacity, display: style.display,
    visibility: style.visibility, zIndex: style.zIndex, position: style.position,
    transform: style.transform, objectFit: style.objectFit, objectPosition: style.objectPosition,
    state: currentState, phase: chapter3Phase,
    error: video.error && { code: video.error.code, message: video.error.message },
    ancestors,
    centerLayers: document.elementsFromPoint(innerWidth / 2, innerHeight / 2)
      .map(node => ({ element: node.id || node.className || node.tagName,
        opacity: getComputedStyle(node).opacity, zIndex: getComputedStyle(node).zIndex })),
  });
}
for (const event of ["loadedmetadata", "loadeddata", "playing", "error"]) {
  chapter3Video.addEventListener(event, () => logChapter3VideoDiagnostics(event));
}
logChapter3VideoDiagnostics("initial");

function holdChapter3VideoAtFirstFrame() {
  if (chapter3Phase !== "curtainScene") return;
  chapter3Video.pause();
  chapter3Video.muted = true;
  if (chapter3Video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    chapter3Video.currentTime = 0;
    videoTargetTime = 0;
  }
}

function enterNextChapter() {
  if (chapter3Completed) return;
  chapter3Completed = true;
  setChapter3Phase("chapter3Complete");
  window.clearTimeout(videoResumeTimer);
  window.clearTimeout(chapter3EnterTimer);
  if (videoScrubFrame !== null) {
    window.cancelAnimationFrame(videoScrubFrame);
    videoScrubFrame = null;
  }
  chapter3Video.pause();
  chapter3Video.muted = true;
  setState("chapter3Complete");
}

function checkChapter3VideoEnd() {
  if (chapter3Phase !== "videoExperience" || chapter3Completed) return;
  const duration = chapter3Video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  if (chapter3Video.currentTime >= duration - VIDEO_END_THRESHOLD) enterNextChapter();
}

function animateVideoScrub() {
  videoScrubFrame = null;
  if (chapter3Phase !== "videoExperience" || chapter3Completed) return;
  const duration = chapter3Video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;

  const difference = videoTargetTime - chapter3Video.currentTime;
  if (Math.abs(difference) <= 0.008) {
    chapter3Video.currentTime = THREE.MathUtils.clamp(videoTargetTime, 0, duration);
    checkChapter3VideoEnd();
    return;
  }

  chapter3Video.currentTime = THREE.MathUtils.clamp(
    chapter3Video.currentTime + difference * VIDEO_SCRUB_SMOOTHING,
    0,
    duration
  );
  checkChapter3VideoEnd();
  if (!chapter3Completed) videoScrubFrame = window.requestAnimationFrame(animateVideoScrub);
}

function resumeChapter3VideoAfterWheel() {
  if (chapter3Phase !== "videoExperience" || chapter3Completed) return;
  videoTargetTime = chapter3Video.currentTime;
  chapter3Video.play().catch(() => {
    chapter3Element.dataset.videoPlayback = "blocked";
  });
}

function beginVideoExperience() {
  if (currentState !== "chapter3" || chapter3Phase !== "curtainScene") return;
  setChapter3Phase("enteringVideo");
  curtainDrag.active = false;
  curtainDrag.pointerId = null;
  curtainInputLayer.classList.remove("is-dragging");
  chapter3Video.muted = false;
  chapter3Video.volume = 0;
  chapter3Video.play().then(
    () => {
      chapter3Element.dataset.videoPlayback = "playing";
    },
    () => {
      chapter3Element.dataset.videoPlayback = "blocked";
    }
  );

  chapter3EnterTimer = window.setTimeout(() => {
    if (chapter3Phase !== "enteringVideo") return;
    setChapter3Phase("videoExperience");
    chapter3Video.volume = 1;
    videoTargetTime = chapter3Video.currentTime;
    chapter3Video.play().catch(() => {
      chapter3Element.dataset.videoPlayback = "blocked";
    });
  }, CURTAIN_EXIT_DURATION);
}

chapter3Video.addEventListener("loadedmetadata", holdChapter3VideoAtFirstFrame);
chapter3Video.addEventListener("loadeddata", () => {
  holdChapter3VideoAtFirstFrame();
  chapter3Element.dataset.videoFirstFrame = "ready";
  chapter3Element.dataset.videoDuration = Number.isFinite(chapter3Video.duration)
    ? chapter3Video.duration.toFixed(3)
    : "unknown";
});
chapter3Video.addEventListener("timeupdate", () => {
  if (chapter3Phase === "curtainScene" && chapter3Video.currentTime > 0.01) {
    holdChapter3VideoAtFirstFrame();
    return;
  }
  checkChapter3VideoEnd();
});
chapter3Video.addEventListener("ended", enterNextChapter);

chapter3Element.addEventListener(
  "wheel",
  (event) => {
    if (chapter3Phase !== "videoExperience" || chapter3Completed) return;
    event.preventDefault();
    const duration = chapter3Video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;

    chapter3Video.pause();
    window.clearTimeout(videoResumeTimer);
    const baseTime = videoScrubFrame === null ? chapter3Video.currentTime : videoTargetTime;
    // 浏览器中 deltaY < 0 表示滚轮向上：按规格映射为视频向前。
    videoTargetTime = THREE.MathUtils.clamp(
      baseTime - event.deltaY * VIDEO_SCRUB_SENSITIVITY,
      0,
      duration
    );
    if (videoScrubFrame === null) {
      videoScrubFrame = window.requestAnimationFrame(animateVideoScrub);
    }
    videoResumeTimer = window.setTimeout(
      resumeChapter3VideoAfterWheel,
      WHEEL_IDLE_RESUME_DELAY
    );
  },
  { passive: false }
);

function updateCurtainInteraction(deltaTime, currentTime) {
  const rawDragDistance = curtainDrag.currentX - curtainDrag.startX;
  const dragDirection = Math.sign(rawDragDistance);
  const activeDragDistance =
    Math.abs(rawDragDistance) > DRAG_THRESHOLD
      ? (Math.abs(rawDragDistance) - DRAG_THRESHOLD) * dragDirection * DRAG_SENSITIVITY
      : 0;
  const clampedDragDistance = THREE.MathUtils.clamp(
    activeDragDistance,
    -DRAG_MAX_OFFSET,
    DRAG_MAX_OFFSET
  );
  const halfRegion = DRAG_REGION_WIDTH / 2;
  const dragProgress = Math.min(Math.abs(activeDragDistance) / DRAG_MAX_OFFSET, 1);

  for (const strand of curtainStrands) {
    let pullOffset = 0;
    let spreadOffset = 0;

    if (curtainDrag.active) {
      const relativeDistance = (strand.baseX - curtainDrag.startX) / halfRegion;
      const distanceFromDrag = Math.abs(relativeDistance) * halfRegion;
      if (distanceFromDrag < halfRegion) {
        const normalizedInfluence = 1 - distanceFromDrag / halfRegion;
        const smoothInfluence =
          normalizedInfluence * normalizedInfluence * (3 - 2 * normalizedInfluence);
        pullOffset = clampedDragDistance * Math.pow(smoothInfluence, 0.32);
        // 相邻珠链沿中心向两侧展开，动态增大拨开处的链间距。
        spreadOffset =
          relativeDistance *
          OPENING_SPREAD *
          Math.pow(smoothInfluence, 0.55) *
          dragProgress;
      }
    }

    // 第一遍只计算力，避免逐个更新造成链条方向偏差。
    for (let index = 0; index < strand.beads.length; index += 1) {
      const bead = strand.beads[index];
      if (index === 0) {
        bead.accelerationX = 0;
        continue;
      }

      const progress = bead.verticalProgress;
      const curveProfile = Math.pow(progress, 1.42) * CURVE_STRENGTH;
      const idleTarget = curtainDrag.active
        ? 0
        : Math.sin(
            currentTime * IDLE_SWAY_SPEED +
              strand.idlePhase +
              progress * IDLE_SWAY_PHASE_VARIATION
          ) *
          IDLE_SWAY_AMPLITUDE *
          bead.idleWeight;
      const targetOffset = (pullOffset + spreadOffset) * curveProfile + idleTarget;
      const driveStrength = curtainDrag.active ? DRAG_FORCE : RETURN_SPRING;
      const previousOffset = strand.beads[index - 1].offsetX;
      const nextOffset =
        index < strand.beads.length - 1 ? strand.beads[index + 1].offsetX : bead.offsetX;
      const neighborForce =
        (previousOffset + nextOffset - bead.offsetX * 2) * CHAIN_STIFFNESS;
      const upperAnchorForce =
        -bead.offsetX * TOP_ANCHOR_STIFFNESS * Math.pow(1 - progress, 5);

      bead.accelerationX =
        (targetOffset - bead.offsetX) * driveStrength + neighborForce + upperAnchorForce;
    }

    // 第二遍独立积分；每颗米珠都有自己的速度与位移。
    for (let index = 0; index < strand.beads.length; index += 1) {
      const bead = strand.beads[index];
      if (index === 0) {
        bead.offsetX = 0;
        bead.velocityX = 0;
        continue;
      }

      bead.velocityX += bead.accelerationX * deltaTime;
      const damping =
        CURTAIN_CHAIN_DAMPING + (curtainDrag.active ? 0 : RETURN_DAMPING * 0.28);
      bead.velocityX *= Math.exp(-damping * deltaTime);
      bead.offsetX += bead.velocityX * deltaTime;
    }
  }

  currentOpeningPoint = getCurtainOpeningPoint();
  const visibleOpeningProgress = THREE.MathUtils.clamp(
    (currentOpeningPoint.width - BIRD_MIN_OPENING_WIDTH) / (DRAG_MAX_OFFSET * 0.25),
    0,
    1
  );
  const targetOpenProgress = curtainDrag.active
    ? Math.min(dragProgress, visibleOpeningProgress)
    : 0;
  const openProgressEase = 1 - Math.exp(-8 * deltaTime);
  curtainOpenProgress = THREE.MathUtils.lerp(
    curtainOpenProgress,
    targetOpenProgress,
    openProgressEase
  );
  chapter3Element.dataset.curtainOpenProgress = curtainOpenProgress.toFixed(3);

  if (
    curtainDrag.active &&
    dragProgress >= BIRD_TRIGGER_THRESHOLD &&
    curtainOpenProgress >= BIRD_TRIGGER_THRESHOLD &&
    currentOpeningPoint.width >= BIRD_MIN_OPENING_WIDTH
  ) {
    triggerBirdGroup(currentOpeningPoint);
  }
}

function drawCurtain() {
  curtainContext.clearRect(0, 0, curtainWidth, curtainHeight);

  for (const strand of curtainStrands) {
    for (const bead of strand.beads) {
      curtainContext.fillStyle = bead.color;
      const x = strand.baseX + bead.offsetX - bead.width / 2;
      const y = bead.baseY - bead.height / 2;
      const radius = Math.min(bead.width, bead.height) / 2;
      curtainContext.beginPath();
      curtainContext.roundRect(x, y, bead.width, bead.height, radius);
      curtainContext.fill();
    }
  }
}

function animateCurtain(currentTime) {
  if (currentState !== "chapter3" || chapter3Phase !== "curtainScene") {
    curtainAnimationFrame = null;
    return;
  }
  if (currentTime - curtainLastDrawTime < CURTAIN_FRAME_INTERVAL) {
    curtainAnimationFrame = window.requestAnimationFrame(animateCurtain);
    return;
  }
  const deltaTime = Math.min((currentTime - curtainPreviousTime) / 1000, 0.05);
  curtainPreviousTime = currentTime;
  curtainLastDrawTime = currentTime;
  updateCurtainInteraction(deltaTime, currentTime);
  drawCurtain();
  curtainAnimationFrame = window.requestAnimationFrame(animateCurtain);
}

function requestCurtainFrame() {
  if (
    currentState !== "chapter3" ||
    chapter3Phase !== "curtainScene" ||
    curtainAnimationFrame !== null
  ) return;
  curtainPreviousTime = performance.now();
  curtainLastDrawTime = 0;
  curtainAnimationFrame = window.requestAnimationFrame(animateCurtain);
}

function startChapter3() {
  if (curtainStarted) return;
  curtainStarted = true;
  chapter3Completed = false;
  setChapter3Phase("curtainScene");
  curtainDrag.active = false;
  curtainOpenProgress = 0;
  birdsTriggered = false;
  chapter3Element.dataset.curtainOpenProgress = "0.000";
  chapter3Element.dataset.birdsTriggered = "false";
  chapter3Video.pause();
  chapter3Video.muted = true;
  if (chapter3Video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    chapter3Video.currentTime = 0;
  }
  videoTargetTime = 0;
  resizeCurtain();
  requestCurtainFrame();
}

curtainSourceImage.addEventListener("load", () => {
  curtainImageReady = true;
  buildCurtainNodes();
});
curtainSourceImage.src = new URL("./pic/third/帘子2.png", import.meta.url).href;

curtainInputLayer.addEventListener("pointerdown", (event) => {
  if (
    currentState !== "chapter3" ||
    chapter3Phase !== "curtainScene" ||
    event.button !== 0
  ) return;
  const bounds = curtainInputLayer.getBoundingClientRect();
  // 每次新的拉帘手势允许触发一组鸟；同一次持续拖拽仍只触发一次。
  birdsTriggered = false;
  chapter3Element.dataset.birdsTriggered = "false";
  curtainDrag.active = true;
  curtainDrag.pointerId = event.pointerId;
  curtainDrag.startX = event.clientX - bounds.left;
  curtainDrag.startY = event.clientY - bounds.top;
  curtainDrag.currentX = curtainDrag.startX;
  curtainDrag.currentY = curtainDrag.startY;
  curtainInputLayer.setPointerCapture(event.pointerId);
  curtainInputLayer.classList.add("is-dragging");
  requestCurtainFrame();
});

curtainInputLayer.addEventListener("pointermove", (event) => {
  if (!curtainDrag.active || event.pointerId !== curtainDrag.pointerId) return;
  const bounds = curtainInputLayer.getBoundingClientRect();
  curtainDrag.currentX = event.clientX - bounds.left;
  curtainDrag.currentY = event.clientY - bounds.top;
  requestCurtainFrame();
});

function stopCurtainDrag(event) {
  if (!curtainDrag.active || event.pointerId !== curtainDrag.pointerId) return;
  curtainDrag.active = false;
  curtainDrag.pointerId = null;
  curtainInputLayer.classList.remove("is-dragging");
  requestCurtainFrame();
}

curtainInputLayer.addEventListener("pointerup", stopCurtainDrag);
curtainInputLayer.addEventListener("pointercancel", stopCurtainDrag);

window.addEventListener("keydown", (event) => {
  if (
    currentState !== "chapter3" ||
    chapter3Phase !== "curtainScene" ||
    event.code !== "Space" ||
    event.repeat
  ) return;
  event.preventDefault();
  beginVideoExperience();
});

window.addEventListener("resize", () => {
  if (curtainStarted) resizeCurtain();
});
