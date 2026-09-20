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
const chapter2SplitterElement = document.querySelector(".chapter2-splitter");
const virtualCursorElement = document.querySelector(".virtual-cursor");
const collectedFragmentsElement = document.querySelector(".collected-fragments");
const chapter2FinaleElement = document.querySelector(".chapter2-finale");
const trainBackgroundElement = document.querySelector(".train-background");
const finaleCharacterElement = document.querySelector(".finale-character");
const finaleTrainElement = document.querySelector(".finale-train");
const finaleBoardedElement = document.querySelector(".finale-boarded");
const boardingBubbleElement = document.querySelector(".boarding-bubble");
const boardingProgressElement = document.querySelector(".boarding-progress span");
const brainPanelElement = document.querySelector(".brain-panel");
const brainStageElement = document.querySelector(".brain-stage");
const brainHeadElement = document.querySelector(".brain-head");
const brainGroupElement = document.querySelector(".brain-brain-group");
const brainImageElement = document.querySelector(".brain-image");
const brainTextLayerElement = document.querySelector(".brain-text-layer");
const brainWindowGroupElement = document.querySelector(".brain-window-group");
const brainWindowPromptElement = document.querySelector(".brain-window-prompt");
const chapter2CompleteElement = document.querySelector(".chapter2-complete");
const chapter3Element = document.querySelector(".chapter3-scene");
const curtainCanvas = document.querySelector("#curtain-canvas");
const curtainInputLayer = document.querySelector(".curtain-input-layer");
const birdRearLayer = document.querySelector(".bird-flight-layer--rear");
const birdFrontLayer = document.querySelector(".bird-flight-layer--front");
const chapter3Video = document.querySelector(".chapter3-video");
const chapter3CompleteElement = document.querySelector(".chapter3-complete");
const chapter4Element = document.querySelector(".chapter4-scene");

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
const CHAPTER1_MUSIC_VOLUME_MIN = 0.4;
const NOTIFICATION_VOLUME = 0.75;
const CHAPTER1_MUSIC_VOLUME_MAX = 1;
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
  chapter4Element.setAttribute("aria-hidden", String(currentState !== "chapter4"));
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
const MODAL_DELAY = 1500;

function startChapter1AfterEntry() {
  resetChapter1NotificationTimer();
  window.setTimeout(() => {
    if (currentState !== "idle") return;
    setState("modalOpen");
    confirmButtons[0].focus();
  }, MODAL_DELAY);
}

const experienceEntry = document.querySelector(".experience-entry");
const experienceEntryButton = document.querySelector(".experience-entry-button");
experienceEntryButton.addEventListener("click", async () => {
  if (experienceEntryButton.disabled) return;
  experienceEntryButton.disabled = true;
  unlockAudioSystem();
  // 在真实点击回调内同步发出无声播放请求，为现有 Audio 实例获得播放许可。
  // 不改资源、正式播放函数或计时参数，许可后立即暂停并回到开头。
  const unlockRequests = Object.values(chapter1AudioTracks).filter(Boolean).map(track => {
    const volume = track.volume;
    track.volume = 0;
    try {
      return Promise.resolve(track.play()).then(() => {
        track.pause();
        track.currentTime = 0;
      }).catch(error => {
        console.warn("[audio unlock]", error.name, error.message);
      }).finally(() => { track.volume = volume; });
    } catch (error) {
      track.volume = volume;
      console.warn("[audio unlock]", error);
      return Promise.resolve();
    }
  });
  if (audioContext) unlockRequests.push(audioContext.resume().catch(error => {
    console.warn("[audio unlock] AudioContext resume failed", error);
  }));
  await Promise.all(unlockRequests);
  page.dataset.entry = "entering";
  window.setTimeout(() => {
    experienceEntry.hidden = true;
    page.dataset.entry = "entered";
    startChapter1AfterEntry();
  }, 220);
});

// Glitch 总时长：可在 2000～3000 毫秒之间调整
const GLITCH_DURATION = 3000;
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
const AUDIO_INTENSITY_MAX = 1.0;
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
// 首次通知与弹窗计时由进入按钮完成音频解锁后启动。

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
const CHAPTER2_AUDIO = Object.freeze({
  bgm: "./pic/second/audio/bgm_2.m4a",
  textPickup: "./pic/second/audio/hit.mp3",
  textScatter: "./pic/second/audio/shatter.mp3",
  windowOpen: "./pic/second/audio/window_open.mp3",
  trainArrival: "./pic/second/audio/train in.mp3",
  trainDeparture: "./pic/second/audio/train out.mp3",
});
const CHAPTER2_BG_AUDIO = CHAPTER2_AUDIO.bgm;
const TEXT_PICKUP_AUDIO = CHAPTER2_AUDIO.textPickup;
const TEXT_IMPACT_AUDIO = CHAPTER2_AUDIO.textScatter;
const WINDOW_OPEN_AUDIO = CHAPTER2_AUDIO.windowOpen;
const CHAPTER2_BG_VOLUME = 0.4;
const TEXT_PICKUP_VOLUME = 1;
const TEXT_IMPACT_VOLUME = 0.58;
const WINDOW_OPEN_VOLUME = 0.75;
const CHAPTER2_MUSIC_FADE_IN = 0;
const CHAPTER2_MUSIC_FADE_OUT = 1000;
const TRAIN_ARRIVAL_AUDIO = CHAPTER2_AUDIO.trainArrival;
const TRAIN_DEPARTURE_AUDIO = CHAPTER2_AUDIO.trainDeparture;
const TRAIN_ARRIVAL_VOLUME = 0.45;
const TRAIN_DEPARTURE_VOLUME = 0.2;
const TRAIN_SCENE_SCALE = 0.68;
chapter2FinaleElement.style.setProperty("--train-scene-scale", TRAIN_SCENE_SCALE);
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
const POST_SCATTER_HOLD = 2000;
const SCENE_FADE_DURATION = 900;
const TEXT_FADE_DURATION = 1200;
const TEXT_FADE_DELAY = 100;
const CHARACTER_REVEAL_DURATION = 450;
const CHARACTER_TO_TRAIN_DELAY = 450;
const TRAIN_ENTRY_DURATION = 2200;
const TRAIN_ENTRY_START_X = -0.62;
const TRAIN_SCENE_START_X = 0.5;
const TRAIN_SCENE_START_Y = 0.5;
const TRAIN_STOP_X = 0.5;
const TRAIN_Z_INDEX = 10;
const CHARACTER_Z_INDEX = 20;
const TRAIN_BACKGROUND_Z_INDEX = 0;
const TRAIN_AUDIO_FALLBACK = 1200;
const WINDOW_AUDIO_FALLBACK = 3000;
const BUBBLE_DELAY = 450;
const BOARD_HOLD_DURATION = 1200;
const BOARD_CROSSFADE_DURATION = 240;
const TRAIN_EXIT_DELAY = 550;
const TRAIN_EXIT_DURATION = 2800;
const TRAIN_EXIT_X = 1.05;
const VIRTUAL_CURSOR_MARGIN_X = 48;
const VIRTUAL_CURSOR_MARGIN_TOP = 34;
const TARGET_DISTANCE = 12;
let CH2_SPLIT_RATIO = 0.66;
const LEFT_MIN_RATIO = 0.45;
const RIGHT_MIN_RATIO = 0.25;
const SPLITTER_WIDTH = 6;

chapter2FinaleElement.style.setProperty("--train-scene-start-x", `${TRAIN_SCENE_START_X * 100}%`);
chapter2FinaleElement.style.setProperty("--train-scene-start-y", `${TRAIN_SCENE_START_Y * 100}%`);
chapter2FinaleElement.style.setProperty("--train-z-index", TRAIN_Z_INDEX);
chapter2FinaleElement.style.setProperty("--character-z-index", CHARACTER_Z_INDEX);
chapter2FinaleElement.style.setProperty("--train-background-z", TRAIN_BACKGROUND_Z_INDEX);

const chapter2Scene = new THREE.Scene();
chapter2Scene.background = new THREE.Color(0xededeb);
const chapter2Camera = new THREE.PerspectiveCamera(
  CHAPTER2_CAMERA_FOV,
  (window.innerWidth * CH2_SPLIT_RATIO) / window.innerHeight,
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
let trainDepartureFinished = false;
let trainDepartureAudio = null;
let trainDepartureWatchdog = null;
let windowOpenAudio = null;
let windowOpenWatchdog = null;
let windowOpening = false;

// 第二章右侧 Brain 模块：所有坐标均为 Brain Panel 内 0～1 normalized coordinates。
const BRAIN_LAYOUT = {
  head: { x: 0.5, y: 0.54, scale: 1.62 },
  brain: { x: 0.47, y: 0.36, scale: 1.71 },
  window: { x: 0.46, y: 0.51, scale:1.36},
};
const BRAIN_LAYER_Z = Object.freeze({ head: 10, brain: 20, text: 30, window: 40 });
const BRAIN_ALPHA_THRESHOLD = 30;
const BRAIN_TEXT_COUNTS = Object.freeze([
  [4, 6],
  [5, 8],
  [7, 10],
  [9, 13],
  [12, 18],
]);
const BRAIN_TEXT_SIZE_MIN = 12;
const BRAIN_TEXT_SIZE_MAX = 34;
const BRAIN_TEXT_ROTATION_MIN = -35;
const BRAIN_TEXT_ROTATION_MAX = 35;
const TEXT_SPAWN_INTERVAL_MIN = 70;
const TEXT_SPAWN_INTERVAL_MAX = 180;
const TRAIN_BACKGROUND = {
  scale: 1,
  repeatX: 1,
  repeatY: 1,
  offsetX: -1000,
  offsetY: 10,
  repeatMode: "repeat-x",
};
const TRAIN_BACKGROUND_SOURCE_SIZE = Object.freeze({ width: 1742, height: 560 });

let brainTextMask = null;
let resolveBrainTextMask;
const brainTextMaskReady = new Promise(resolve => { resolveBrainTextMask = resolve; });
const brainSpawnTimers = new Set();
let finalBrainTextBatchComplete = false;

chapter2Element.style.setProperty("--ch2-split-ratio", `${CH2_SPLIT_RATIO * 100}%`);
chapter2Element.style.setProperty("--ch2-splitter-width", `${SPLITTER_WIDTH}px`);
chapter2Element.style.setProperty("--ch2-splitter-half-width", `${SPLITTER_WIDTH / 2}px`);
chapter2Element.style.setProperty("--brain-head-z", BRAIN_LAYER_Z.head);
chapter2Element.style.setProperty("--brain-brain-z", BRAIN_LAYER_Z.brain);
chapter2Element.style.setProperty("--brain-text-z", BRAIN_LAYER_Z.text);
chapter2Element.style.setProperty("--brain-window-z", BRAIN_LAYER_Z.window);

function applyBrainLayout() {
  brainHeadElement.style.left = `${BRAIN_LAYOUT.head.x * 100}%`;
  brainHeadElement.style.top = `${BRAIN_LAYOUT.head.y * 100}%`;
  brainHeadElement.style.setProperty("--head-scale", BRAIN_LAYOUT.head.scale);
  brainGroupElement.style.left = `${BRAIN_LAYOUT.brain.x * 100}%`;
  brainGroupElement.style.top = `${BRAIN_LAYOUT.brain.y * 100}%`;
  brainGroupElement.style.setProperty("--brain-scale", BRAIN_LAYOUT.brain.scale);
  brainWindowGroupElement.style.left = `${BRAIN_LAYOUT.window.x * 100}%`;
  brainWindowGroupElement.style.top = `${BRAIN_LAYOUT.window.y * 100}%`;
  brainWindowGroupElement.style.setProperty("--window-scale", BRAIN_LAYOUT.window.scale);
}

function logBrainAssetMetrics() {
  const rendered = brainImageElement.getBoundingClientRect();
  const naturalWidth = brainImageElement.naturalWidth;
  const naturalHeight = brainImageElement.naturalHeight;
  console.info("[Brain Asset]", {
    naturalWidth,
    naturalHeight,
    aspectRatio: naturalHeight ? naturalWidth / naturalHeight : 0,
    renderedWidth: rendered.width,
    renderedHeight: rendered.height,
  });
}

function buildBrainTextMask() {
  if (!brainImageElement.naturalWidth || !brainImageElement.naturalHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = brainImageElement.naturalWidth;
  canvas.height = brainImageElement.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    resolveBrainTextMask(false);
    return;
  }
  context.drawImage(brainImageElement, 0, 0);
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const alpha = new Uint8Array(canvas.width * canvas.height);
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = pixels[index * 4 + 3];
    brainTextMask = { width: canvas.width, height: canvas.height, alpha };
    resolveBrainTextMask(true);
  } catch (error) {
    console.warn("[chapter2 brain] alpha mask unavailable", error);
    resolveBrainTextMask(false);
  }
}

if (brainImageElement.complete) buildBrainTextMask();
else brainImageElement.addEventListener("load", buildBrainTextMask, { once: true });
brainImageElement.addEventListener("error", () => resolveBrainTextMask(false), { once: true });

function getRandomBrainMaskPoint() {
  if (!brainTextMask) return null;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const x = Math.floor(Math.random() * brainTextMask.width);
    const y = Math.floor(Math.random() * brainTextMask.height);
    if (brainTextMask.alpha[y * brainTextMask.width + x] > BRAIN_ALPHA_THRESHOLD) {
      return { x: (x + 0.5) / brainTextMask.width, y: (y + 0.5) / brainTextMask.height };
    }
  }
  return null;
}

function appendBrainThought(fragment, pickupNumber) {
  const point = getRandomBrainMaskPoint();
  if (!point) return;
  const progress = THREE.MathUtils.clamp((pickupNumber - 1) / 4, 0, 1);
  const sizeCurve = THREE.MathUtils.lerp(1.9, 0.82, progress);
  const fontSize = THREE.MathUtils.lerp(
    BRAIN_TEXT_SIZE_MIN,
    BRAIN_TEXT_SIZE_MAX,
    Math.pow(Math.random(), sizeCurve)
  );
  const thought = document.createElement("span");
  thought.className = "brain-thought";
  thought.textContent = fragment;
  thought.style.left = `${point.x * 100}%`;
  thought.style.top = `${point.y * 100}%`;
  thought.style.fontSize = `${fontSize.toFixed(1)}px`;
  thought.style.setProperty(
    "--thought-rotation",
    `${randomBetween(BRAIN_TEXT_ROTATION_MIN, BRAIN_TEXT_ROTATION_MAX).toFixed(1)}deg`
  );
  thought.style.setProperty("--thought-opacity", randomBetween(0.72, 0.96).toFixed(2));
  brainTextLayerElement.appendChild(thought);
}

async function spawnBrainTextBatch(fragment, pickupNumber) {
  await brainTextMaskReady;
  if (!brainTextMask) return;
  brainPanelElement.dataset.brainState = pickupNumber >= 5 ? "crowded" : "accumulating";
  const [minimum, maximum] = BRAIN_TEXT_COUNTS[pickupNumber - 1];
  const count = Math.floor(randomBetween(minimum, maximum + 1));
  return new Promise(resolve => {
    let spawned = 0;
    const spawnNext = () => {
      appendBrainThought(fragment, pickupNumber);
      spawned += 1;
      if (spawned >= count) {
        resolve();
        return;
      }
      const timer = window.setTimeout(() => {
        brainSpawnTimers.delete(timer);
        spawnNext();
      }, randomBetween(TEXT_SPAWN_INTERVAL_MIN, TEXT_SPAWN_INTERVAL_MAX));
      brainSpawnTimers.add(timer);
    };
    spawnNext();
  });
}

applyBrainLayout();

function applyTrainBackground() {
  const bounds = chapter2FinaleElement.getBoundingClientRect();
  const containerWidth = bounds.width || window.innerWidth;
  const containerHeight = bounds.height || window.innerHeight;
  const fitX = containerWidth / (TRAIN_BACKGROUND_SOURCE_SIZE.width * TRAIN_BACKGROUND.repeatX);
  const fitY = containerHeight / (TRAIN_BACKGROUND_SOURCE_SIZE.height * TRAIN_BACKGROUND.repeatY);
  const uniformScale = Math.min(fitX, fitY) * TRAIN_BACKGROUND.scale;
  const tileWidth = TRAIN_BACKGROUND_SOURCE_SIZE.width * uniformScale;
  const tileHeight = TRAIN_BACKGROUND_SOURCE_SIZE.height * uniformScale;
  trainBackgroundElement.style.setProperty("--train-bg-tile-width", `${tileWidth}px`);
  trainBackgroundElement.style.setProperty("--train-bg-tile-height", `${tileHeight}px`);
  trainBackgroundElement.style.setProperty("--train-bg-offset-x", `${TRAIN_BACKGROUND.offsetX}px`);
  trainBackgroundElement.style.setProperty("--train-bg-offset-y", `${TRAIN_BACKGROUND.offsetY}px`);
  trainBackgroundElement.style.setProperty("--train-bg-repeat-mode", TRAIN_BACKGROUND.repeatMode);
}

applyTrainBackground();

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
    chapter2BackgroundMusic.addEventListener("error", () => {
      console.warn("[chapter2 bgm] media load/decode failed", chapter2BackgroundMusic.error);
    });
  }
  chapter2BackgroundMusic.volume = 0;
  chapter2BackgroundMusic.currentTime = 0;
  chapter2BackgroundMusic.play().then(() => {
    chapter2Element.dataset.musicState = "playing";
    fadeChapter2Music(CHAPTER2_BG_VOLUME, CHAPTER2_MUSIC_FADE_IN);
  }).catch((error) => {
    chapter2Element.dataset.musicState = "unavailable";
    console.warn("[chapter2 bgm] play failed", error.name, error.message);
  });
}

function stopChapter2Music(immediate = false) {
  if (!chapter2BackgroundMusic) {
    chapter2Element.dataset.musicState = "stopped";
    return;
  }
  if (immediate) {
    if (chapter2MusicFadeFrame !== null) cancelAnimationFrame(chapter2MusicFadeFrame);
    chapter2MusicFadeFrame = null;
    chapter2BackgroundMusic.pause();
    chapter2BackgroundMusic.currentTime = 0;
    chapter2BackgroundMusic.volume = 0;
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
  try {
    const sound = new Audio(new URL(path, import.meta.url).href);
    sound.volume = volume;
    sound.addEventListener("error", () => console.warn("[chapter2 sfx] media load/decode failed", path, sound.error), { once: true });
    sound.play().catch(error => {
      console.warn("[chapter2 sfx] play failed", path, error.name, error.message);
    });
  } catch (error) { console.warn("[chapter2 sfx] unavailable", path, error); }
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

function playWindowOpenSound() {
  if (windowOpenWatchdog !== null) clearTimeout(windowOpenWatchdog);
  windowOpenAudio?.pause();
  return new Promise(resolve => {
    const sound = new Audio(new URL(WINDOW_OPEN_AUDIO, import.meta.url).href);
    windowOpenAudio = sound;
    sound.preload = "auto";
    sound.volume = WINDOW_OPEN_VOLUME;
    let finished = false;
    const finish = () => {
      if (finished || windowOpenAudio !== sound) return;
      finished = true;
      clearTimeout(windowOpenWatchdog);
      windowOpenWatchdog = null;
      resolve();
    };
    const armFallback = delay => {
      clearTimeout(windowOpenWatchdog);
      windowOpenWatchdog = setTimeout(finish, delay);
    };
    sound.addEventListener("ended", finish, { once: true });
    sound.addEventListener("error", () => {
      console.warn("[chapter2 window open] media load/decode failed", sound.error);
      armFallback(WINDOW_AUDIO_FALLBACK);
    }, { once: true });
    armFallback(WINDOW_AUDIO_FALLBACK);
    sound.play().catch(error => {
      console.warn("[chapter2 window open] play failed", error.name, error.message);
      armFallback(WINDOW_AUDIO_FALLBACK);
    });
  });
}

function playTrainDepartureSound() {
  triggerSoundEvent(SOUND_EVENTS.trainDeparture);
  trainDepartureFinished = false;
  if (trainDepartureWatchdog !== null) clearTimeout(trainDepartureWatchdog);
  trainDepartureAudio?.pause();
  const sound = new Audio(new URL(TRAIN_DEPARTURE_AUDIO, import.meta.url).href);
  trainDepartureAudio = sound;
  sound.volume = TRAIN_DEPARTURE_VOLUME;
  const finish = () => {
    if (trainDepartureAudio !== sound) return;
    clearTimeout(trainDepartureWatchdog);
    trainDepartureWatchdog = null;
    trainDepartureFinished = true;
  };
  const armWatchdog = () => {
    clearTimeout(trainDepartureWatchdog);
    const delay = Number.isFinite(sound.duration) && sound.duration > 0
      ? sound.duration * 1000 + 1000 : TRAIN_AUDIO_FALLBACK;
    trainDepartureWatchdog = setTimeout(finish, delay);
  };
  sound.addEventListener("ended", finish, { once: true });
  sound.addEventListener("loadedmetadata", armWatchdog, { once: true });
  sound.addEventListener("error", () => {
    console.warn("[chapter2 departure] media load/decode failed", sound.error);
    clearTimeout(trainDepartureWatchdog);
    trainDepartureWatchdog = setTimeout(finish, TRAIN_AUDIO_FALLBACK);
  }, { once: true });
  sound.play().then(armWatchdog).catch(error => {
    console.warn("[chapter2 departure] play failed", error.name, error.message);
    clearTimeout(trainDepartureWatchdog);
    trainDepartureWatchdog = setTimeout(finish, TRAIN_AUDIO_FALLBACK);
  });
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

function getChapter2ViewportSize() {
  const bounds = chapter2Canvas.getBoundingClientRect();
  return {
    width: bounds.width || window.innerWidth * CH2_SPLIT_RATIO,
    height: bounds.height || window.innerHeight,
  };
}

function updateVirtualCursorPosition() {
  const viewport = getChapter2ViewportSize();
  const hangingHeight = CHAIN_TOP_OFFSET + collectedCharacterNodes.length * CHAIN_SPACING;
  const maxY = Math.max(VIRTUAL_CURSOR_MARGIN_TOP, viewport.height - hangingHeight);
  const nextX = THREE.MathUtils.clamp(
    virtualCursorX,
    VIRTUAL_CURSOR_MARGIN_X,
    viewport.width - (VIRTUAL_CURSOR_SIZE - CURSOR_HOTSPOT_X) - VIRTUAL_CURSOR_MARGIN_X
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
      node.y = Math.min(node.y, getChapter2ViewportSize().height - 12);
    }

    previousX = node.x;
    previousY = node.y;
  });
  renderCharacterChain();
}

function raycastFromVirtualCursor() {
  if (!activeTextTarget) return false;
  const viewport = getChapter2ViewportSize();
  virtualCursorNdc.set(
    (virtualCursorX / viewport.width) * 2 - 1,
    -(virtualCursorY / viewport.height) * 2 + 1
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
  const pickupNumber = collectedFragments.length;
  const brainTextBatch = spawnBrainTextBatch(fragment, pickupNumber);
  if (pickupNumber === CHAPTER2_TARGETS.length) {
    finalBrainTextBatchComplete = false;
    Promise.resolve(brainTextBatch).finally(() => {
      finalBrainTextBatchComplete = true;
    });
  }
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
  return getChapter2ViewportSize().height - SCATTER_FLOOR_OFFSET;
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
  const viewportWidth = getChapter2ViewportSize().width;

  // 链条在撞击后解除：每个汉字转为独立、轻量的屏幕空间运动节点。
  collectedCharacterNodes.forEach((node) => {
    node.x = THREE.MathUtils.clamp(node.x, 18, viewportWidth - 18);
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
  const viewportWidth = getChapter2ViewportSize().width;

  collectedCharacterNodes.forEach((node) => {
    if (node.settled) return;
    allSettled = false;
    node.velocityY += SCATTER_GRAVITY * deltaTime;
    node.x += node.velocityX * deltaTime;
    node.y += node.velocityY * deltaTime;
    node.rotation += node.angularVelocity * deltaTime;
    node.velocityX *= Math.exp(-1.2 * deltaTime);
    node.angularVelocity *= Math.exp(-1.4 * deltaTime);

    if (node.x <= sideMargin || node.x >= viewportWidth - sideMargin) {
      node.x = THREE.MathUtils.clamp(node.x, sideMargin, viewportWidth - sideMargin);
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
  const sharedStartX = window.innerWidth * TRAIN_SCENE_START_X;
  element.style.transform = `translate3d(${x - sharedStartX}px, ${verticalOffset}px, 0)`;
}

function setFinalePhase(nextPhase, currentTime) {
  chapter2Phase = nextPhase;
  finalPhaseStartTime = currentTime;
  chapter2Element.dataset.phase = chapter2Phase;
}

function showBrainWindowClose(currentTime) {
  if (chapter2Phase !== "scatterComplete") return;
  brainPanelElement.dataset.brainState = "windowReady";
  brainPanelElement.dataset.windowState = "close";
  brainWindowGroupElement.classList.add("is-visible");
  brainWindowGroupElement.setAttribute("aria-hidden", "false");
  setFinalePhase("waitingForWindow", currentTime);
}

function openBrainWindow() {
  if (chapter2Phase !== "waitingForWindow" || windowOpening) return;
  windowOpening = true;
  brainWindowPromptElement.disabled = true;
  brainPanelElement.dataset.brainState = "windowOpen";
  brainPanelElement.dataset.windowState = "open";
  setFinalePhase("windowOpening", performance.now());
  playWindowOpenSound().then(() => {
    if (chapter2Phase === "windowOpening") startSceneFade(performance.now());
  });
}

brainWindowPromptElement.addEventListener("click", openBrainWindow);

function startSceneFade(currentTime) {
  stopChapter2Music();
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
  playTrainDepartureSound();
}

function completeChapter2() {
  stopChapter2Music(true);
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
    if (elapsed >= POST_SCATTER_HOLD && finalBrainTextBatchComplete) {
      showBrainWindowClose(currentTime);
    }
    return;
  }

  if (chapter2Phase === "waitingForWindow") return;

  if (chapter2Phase === "windowOpening") {
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
    if (progress >= 1 && trainDepartureFinished) completeChapter2();
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
  if (windowOpenWatchdog !== null) clearTimeout(windowOpenWatchdog);
  windowOpenWatchdog = null;
  windowOpenAudio?.pause();
  windowOpenAudio = null;
  windowOpening = false;
  brainWindowPromptElement.disabled = false;
  if (trainDepartureWatchdog !== null) clearTimeout(trainDepartureWatchdog);
  trainDepartureWatchdog = null;
  trainDepartureAudio?.pause();
  trainDepartureAudio = null;
  trainDepartureFinished = false;
  chapter2Started = true;
  chapter2Yaw = 0;
  chapter2Pitch = 0;
  chapter2Phase = "targetActive";
  chapter2Element.dataset.phase = chapter2Phase;
  brainSpawnTimers.forEach(timer => window.clearTimeout(timer));
  brainSpawnTimers.clear();
  brainTextLayerElement.replaceChildren();
  brainPanelElement.dataset.brainState = "empty";
  brainPanelElement.dataset.windowState = "close";
  brainWindowGroupElement.classList.remove("is-visible");
  brainWindowGroupElement.setAttribute("aria-hidden", "true");
  finalBrainTextBatchComplete = false;
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
  const chapter2Viewport = getChapter2ViewportSize();
  virtualCursorX = chapter2Viewport.width / 2;
  virtualCursorY = chapter2Viewport.height / 2;
  virtualCursorVelocityY = 0;
  updateChapter2Camera();
  updateVirtualCursorPosition();
  activateCurrentTarget();
  resizeChapter2();
  window.requestAnimationFrame(logBrainAssetMetrics);
  startChapter2Music();
  chapter2PreviousTime = performance.now();
  chapter2AnimationFrame = window.requestAnimationFrame(animateChapter2);
}

chapter2Canvas.addEventListener("pointerdown", (event) => {
  if (currentState !== "chapter2" || event.button !== 0) return;
  if (
    [
      "scatterComplete",
      "waitingForWindow",
      "windowOpening",
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
  const viewport = getChapter2ViewportSize();
  chapter2Camera.aspect = viewport.width / viewport.height;
  chapter2Camera.updateProjectionMatrix();
  chapter2Renderer.setSize(viewport.width, viewport.height, false);
  applyTrainBackground();
  updateVirtualCursorPosition();
  if (currentState === "chapter2") window.requestAnimationFrame(logBrainAssetMetrics);
  if (["trainStopped", "waitingForBoard", "boardingHold"].includes(chapter2Phase)) {
    setFinaleTrainPosition(finaleTrainElement, window.innerWidth * TRAIN_STOP_X);
  }
  if (chapter2Phase === "boarded") {
    setFinaleTrainPosition(finaleBoardedElement, window.innerWidth * TRAIN_STOP_X);
  }
}

let chapter2SplitPointerId = null;

function setChapter2SplitRatio(nextRatio) {
  CH2_SPLIT_RATIO = THREE.MathUtils.clamp(
    nextRatio,
    LEFT_MIN_RATIO,
    1 - RIGHT_MIN_RATIO
  );
  chapter2Element.style.setProperty("--ch2-split-ratio", `${CH2_SPLIT_RATIO * 100}%`);
  chapter2SplitterElement.setAttribute("aria-valuenow", String(Math.round(CH2_SPLIT_RATIO * 100)));
  resizeChapter2();
}

chapter2SplitterElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || currentState !== "chapter2") return;
  chapter2SplitPointerId = event.pointerId;
  chapter2SplitterElement.setPointerCapture(event.pointerId);
  chapter2SplitterElement.classList.add("is-resizing");
  chapter2Element.classList.add("is-resizing");
  event.preventDefault();
});

chapter2SplitterElement.addEventListener("pointermove", (event) => {
  if (event.pointerId !== chapter2SplitPointerId) return;
  const bounds = chapter2Element.getBoundingClientRect();
  if (bounds.width <= 0) return;
  setChapter2SplitRatio((event.clientX - bounds.left) / bounds.width);
});

function finishChapter2SplitResize(event) {
  if (event.pointerId !== chapter2SplitPointerId) return;
  if (chapter2SplitterElement.hasPointerCapture(event.pointerId)) {
    chapter2SplitterElement.releasePointerCapture(event.pointerId);
  }
  chapter2SplitPointerId = null;
  chapter2SplitterElement.classList.remove("is-resizing");
  chapter2Element.classList.remove("is-resizing");
}

chapter2SplitterElement.addEventListener("pointerup", finishChapter2SplitResize);
chapter2SplitterElement.addEventListener("pointercancel", finishChapter2SplitResize);

window.addEventListener("resize", resizeChapter2);
resizeChapter2();

// 3A 米珠帘参数：中间保持较高细节，两侧降低密度以控制性能。
const BEAD_STRAND_COUNT_CENTER = 56;
const BEAD_STRAND_COUNT_SIDE = 14;
const BEAD_VERTICAL_COUNT_CENTER = 52;
const BEAD_VERTICAL_COUNT_SIDE = 34;
const BEAD_SPACING_X_CENTER = 1;
const BEAD_SPACING_X_SIDE = 1.04;
const BEAD_SPACING_Y = 1;
const BEAD_SIZE = Object.freeze({ width: 0.2, height: 0.8 });
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

// 3A/3B 音频：独立预载入，缺失或播放失败均不阻塞帘幕与鸟群逻辑。
const CHAPTER3_AUDIO = Object.freeze({
  beam: "./pic/third/audio/bead.mp3",
  birdsong: "./pic/third/audio/Birdsong.mp3",
});
const BEAM_SFX_VOLUME = 0.45;
const BEAM_SFX_COOLDOWN = 160;
const MIN_BEAM_MOVEMENT = 4;
const BIRDSONG_SFX_VOLUME = 0.60;
const chapter3AudioTracks = {};
const chapter3AudioWarnings = new Set();

function warnChapter3AudioOnce(name, message, error) {
  const key = `${name}:${message}`;
  if (chapter3AudioWarnings.has(key)) return;
  chapter3AudioWarnings.add(key);
  console.warn(`[chapter3 audio] ${name} ${message}`, error || "");
}

for (const [name, path] of Object.entries(CHAPTER3_AUDIO)) {
  if (!path) {
    chapter3AudioTracks[name] = null;
    continue;
  }
  try {
    const track = new Audio(new URL(path, import.meta.url).href);
    track.preload = "auto";
    track.volume = name === "beam" ? BEAM_SFX_VOLUME : BIRDSONG_SFX_VOLUME;
    track.addEventListener("error", () => {
      warnChapter3AudioOnce(name, "asset not loaded", track.error);
      chapter3AudioTracks[name] = null;
    }, { once: true });
    chapter3AudioTracks[name] = track;
  } catch (error) {
    chapter3AudioTracks[name] = null;
    warnChapter3AudioOnce(name, "asset not loaded", error);
  }
}

function playChapter3Sound(name) {
  const track = chapter3AudioTracks[name];
  if (!track) {
    warnChapter3AudioOnce(name, "asset not loaded");
    return;
  }
  try {
    track.pause();
    track.currentTime = 0;
    track.play().catch(error => warnChapter3AudioOnce(name, "play failed", error));
  } catch (error) {
    warnChapter3AudioOnce(name, "play failed", error);
  }
}

function playBeamSound() {
  playChapter3Sound("beam");
}

function playBirdsong() {
  triggerSoundEvent(SOUND_EVENTS.birdFly);
  playChapter3Sound("birdsong");
}

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
  lastBeamTime: 0,
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
  playBirdsong();

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
  setState("chapter4");
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
  curtainDrag.lastBeamTime = 0;
  curtainInputLayer.setPointerCapture(event.pointerId);
  curtainInputLayer.classList.add("is-dragging");
  requestCurtainFrame();
});

curtainInputLayer.addEventListener("pointermove", (event) => {
  if (!curtainDrag.active || event.pointerId !== curtainDrag.pointerId) return;
  const bounds = curtainInputLayer.getBoundingClientRect();
  const nextX = event.clientX - bounds.left;
  const nextY = event.clientY - bounds.top;
  const getEffectiveDragOffset = (pointerX) => {
    const rawDistance = pointerX - curtainDrag.startX;
    const direction = Math.sign(rawDistance);
    const activeDistance = Math.abs(rawDistance) > DRAG_THRESHOLD
      ? (Math.abs(rawDistance) - DRAG_THRESHOLD) * direction * DRAG_SENSITIVITY
      : 0;
    return THREE.MathUtils.clamp(activeDistance, -DRAG_MAX_OFFSET, DRAG_MAX_OFFSET);
  };
  const previousOffset = getEffectiveDragOffset(curtainDrag.currentX);
  const nextOffset = getEffectiveDragOffset(nextX);
  const movement = Math.abs(nextOffset - previousOffset);
  const now = performance.now();
  curtainDrag.currentX = nextX;
  curtainDrag.currentY = nextY;
  if (
    Math.abs(nextOffset) > 0 &&
    movement >= MIN_BEAM_MOVEMENT &&
    now - curtainDrag.lastBeamTime >= BEAM_SFX_COOLDOWN
  ) {
    curtainDrag.lastBeamTime = now;
    playBeamSound();
  }
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

// 第四章新增音效集中管理；加载或播放失败时只静默降级，不中断交互。
const CHAPTER4_AUDIO = Object.freeze({
  letterTear: "./pic/forth/audio/tear.mp3",
  aiSend: "./pic/forth/audio/sent.mp3",
  puzzleSuccess: "./pic/forth/audio/shine.mp3",
});
const CHAPTER4_AUDIO_VOLUME = Object.freeze({
  letterTear: 0.65,
  aiSend: 0.5,
  puzzleSuccess: 0.6,
});
const chapter4AudioTracks = {};
const chapter4AudioWarnings = new Set();

function warnChapter4AudioOnce(name, error) {
  if (chapter4AudioWarnings.has(name)) return;
  chapter4AudioWarnings.add(name);
  console.warn(`[chapter4 audio] ${name} unavailable`, error || "");
}

for (const [name, path] of Object.entries(CHAPTER4_AUDIO)) {
  if (!path) {
    chapter4AudioTracks[name] = null;
    continue;
  }
  try {
    const track = new Audio(new URL(path, import.meta.url).href);
    track.preload = "auto";
    track.volume = CHAPTER4_AUDIO_VOLUME[name];
    track.addEventListener("error", () => {
      warnChapter4AudioOnce(name, track.error);
      chapter4AudioTracks[name] = null;
    }, { once: true });
    chapter4AudioTracks[name] = track;
  } catch (error) {
    chapter4AudioTracks[name] = null;
    warnChapter4AudioOnce(name, error);
  }
}

function playChapter4Sound(name) {
  const track = chapter4AudioTracks[name];
  if (!track) {
    warnChapter4AudioOnce(name);
    return;
  }
  try {
    track.pause();
    track.currentTime = 0;
    track.play().catch(error => warnChapter4AudioOnce(name, error));
  } catch (error) {
    warnChapter4AudioOnce(name, error);
  }
}

function playLetterTearSound() { playChapter4Sound("letterTear"); }
function playSendButtonSound() { playChapter4Sound("aiSend"); }
function playPuzzleSuccessSound() { playChapter4Sound("puzzleSuccess"); }

// 第四章 LETTER 模块参数与局部状态。
const LETTER_ENVELOPE_ASPECT = 1835 / 1032;
const TEAR_COMPLETE_THRESHOLD = 0.82;
const TEAR_MAX_ROTATION = 18;
const TEAR_PEEL_ROTATE_X = 68;
const TEAR_PEEL_TRANSLATE_X = 50;
const TEAR_PEEL_TRANSLATE_Y = -30;
const TEAR_PEEL_TRANSLATE_Z = 42;
const TEAR_PERSPECTIVE = 900;
const TEAR_SKEW = -6;
const PAPER_MODAL_WIDTH = "76vw";
const PAPER_MODAL_MAX_HEIGHT = "72vh";
const PAPER_REVEAL_DURATION = 600;
const TYPE_INTERVAL = 18;
const TEAR_DRAG_DISTANCE_RATIO = 1.25;
const LETTER_PAGE_TURN_THRESHOLD = 70;
// 正式信件文案：后期润色时只修改这个数组，不要改下方分页、翻页或打字机函数。
const LETTER_PAGES = Object.freeze([
  `FOMO（错失焦虑）指担心自己缺席他人有意义的经历、信息或机会，从而产生持续焦虑与强迫性查看行为的心理状态。它不完全是个人缺陷，更是环境产物：社交媒体把他人筛选后的高光片段集中、连续、可量化地呈现给你，你拿它跟自己的日常全程对比，统计上必然吃亏。

它常常伴随注意力碎片化、自尊波动，以及不断刷新、不断比较的冲动。更重要的是，它不会因为“得到更多”而自动消失，因为它的机制不是“我缺一个东西”，而是“永远还有下一个”。

JOMO（错失的快乐）则是一种态度转向：允许自己错过一部分，因为更清楚自己真正要什么，把注意力从“别人在发生什么”转回“我正在经历什么”。`,
  `具体做法可以只选两到三项，持续两周以上，再评估是否适合自己：
1. 把待办清单强制排序，只保留前 5 项，其余删除或移入“以后再说”。
2. 建立固定断联时段：每天留出 30—60 分钟远离电子设备，散步、做饭、阅读，做能够滋养自己的事。重点不在偶尔一次，而在规律。
3. 发展一种长期输出型爱好，如画画、运动、烹饪、写作。它的评价标准主要在自己手里，而不依赖平台算法。
4. 保持长期记录，写日记、拍视频、做手账都可以。目的不是展示，而是看见自己的轨迹。
5. 给“比较”设一个物理门槛：取关、屏蔽、把 App 移到第二屏，或者设置时限。减少触发源，往往比逼自己“看了也不焦虑”更现实。
6. 建立“完成即休息”的规则。做完一件重要的事，强制休息，不立刻跳入下一件；也可以区分“信息”和“刺激”，问自己打开它，是为了获得有用信息，还是只是为了缓解怕错过的刺激。
7. 接受错过本来就是常态。你不可能读完所有书、追上所有热点，这是注意力的物理上限。目标不是变成没有欲望的人，而是把有限注意力放在真正选择的地方。`,
  `
写给会玩这个网站的你：

真诚地感谢每一个看到这封信的人。
你好。
首先送你《大学》里一句话：“知止而后能定，定而后能静，静而后能安，安而后能虑，虑而后能得。”
从认识到自己的无能后，我就一直被一种东西追着跑。那种东西叫 FOMO。怕错过，怕落后，怕别人都在往前走，而自己停在原地。打开手机，满屏都是别人的作品、生活，和“我又完成了一件了不起的事”。
如果那个人恰好是你身边的人，那种感觉会更重——不是嫉妒，而是一种说不清的焦躁：怎么他们都这么厉害，那我呢？
我小时候画画。被夸过，得过奖，也被亲戚当作小画家。那时候我很确定，画画就是我存在的价值。我固执地把画画放在了“一切”的位置上。未来太复杂，只有画画的时候，世界才会变得简单。
后来我长大了，世界没有变简单，反而越来越吵。我开始在小红书上焦虑，脑子里总有两个声音打架：一个说，你别比了，过好自己就行；另一个却说，为什么我的世界里，我不是最优秀、最独特的那个。`,
  `所以我想在这里说的是：
生命是一份慷慨的礼物，每一天都是了解自我的机会。去看看自己真正喜欢什么，真正做什么的时候会觉得幸福到想流泪，会在夜晚盼着新一轮太阳升起。
我把这个过程叫作“靠近自满的自己”。这里的自满，不是骄傲，而是终于允许自己对自己满意。
是做完一件事，不管有没有人认可，你都能对自己说一句：嗯，我喜欢这个。是哪怕今天什么都没做，你也知道自己不是空的。
我知道这很难，我到现在也还在学。有时候我还是会忍不住去看有没有人认可我，还是会失落，还是会觉得，丢掉那个“引以为傲的东西”之后，自己什么都不剩。
但我也慢慢发现，那个东西没有丢，它只是从“别人给我的证明”，变成了“就只是因为我自己想做”。
这个网站，就是我想做的事之一。它不完美，可能也没多少人会来。但我在做它的时候，是安静的，是开心的，是觉得自己有趣的。
如果你也正在被 FOMO 追着跑，我想跟你说：你不必事事求全，也不必总对自己苛刻。你可以只是画，只是玩，只是做一个有趣的人，不用每一下都被看见。你可以慢下来，可以错过一些东西，可以不是最优秀的那个。
你可以对自己满意，这不是需要付出巨大代价后才配拥有的权利，而是你从出生起就拥有的。
如果 18 岁算步入成年，那 20 岁的我们，也只是一个刚两岁的成年人而已。
愿我们都能靠近那个自满的自己。愿我们都能在吵闹的世界里，找到一小块闲适和平和，来安放自己。
“我是旧时代的残党，新时代没有能载我的船，但我深知并排总会站着战友，我什么都不怕。”
共勉。
—— 一个也还在路上的人`,
]);

const letterEnvelope = document.querySelector(".letter-envelope");
const chapter4Letter = document.querySelector(".chapter4-letter");
const letterAImage = document.querySelector(".letter-envelope-a");
const letterBImage = document.querySelector(".letter-envelope-b");
const letterTearHandle = document.querySelector(".letter-tear-handle");
const letterReadingLayer = document.querySelector(".letter-reading-layer");
const letterCancel = document.querySelector(".letter-cancel");
const letterReadingBackdrop = document.querySelector(".letter-reading-backdrop");
const letterPaperStack = document.querySelector(".letter-paper-stack");
const letterPaper = document.querySelector(".letter-paper");
const letterTypewriter = document.querySelector(".letter-typewriter");
const letterPageContent = document.querySelector(".letter-page-content");
const letterPageHint = document.querySelector(".letter-page-hint");
const letterPageCount = document.querySelector(".letter-page-count");
let letterState = "sealed";
let letterPointerId = null;
let letterDragStartY = 0;
let tearProgress = 0;
let typingTimer = null;
let letterRevealTimer = null;
let currentLetterPage = 0;
let currentCharIndex = 0;
let isLetterTyping = false;
let canTurnLetterPage = false;
let typingRunId = 0;
let firstPageTypingStarted = false;
let letterPagePointerId = null;
let letterPageDragStartX = 0;
let letterPageDragX = 0;
let letterPageTurning = false;

letterEnvelope.style.setProperty("--letter-envelope-aspect", String(LETTER_ENVELOPE_ASPECT));
letterEnvelope.dataset.aspect = String(LETTER_ENVELOPE_ASPECT);
letterEnvelope.dataset.maxRotation = String(TEAR_MAX_ROTATION);
chapter4Letter.style.setProperty("--tear-perspective", `${TEAR_PERSPECTIVE}px`);
document.documentElement.style.setProperty("--letter-paper-width", PAPER_MODAL_WIDTH);
document.documentElement.style.setProperty("--letter-paper-max-height", PAPER_MODAL_MAX_HEIGHT);
document.documentElement.style.setProperty("--letter-paper-reveal-duration", `${PAPER_REVEAL_DURATION}ms`);

function syncLetterAssetGeometry() {
  if (letterAImage.naturalWidth && letterAImage.naturalHeight) {
    const aspect = letterAImage.naturalWidth / letterAImage.naturalHeight;
    letterEnvelope.style.setProperty("--letter-envelope-aspect", String(aspect));
    letterEnvelope.dataset.aspect = String(aspect);
  }
  if (!letterBImage.naturalWidth || !letterBImage.naturalHeight) return;

  const canvas = document.createElement("canvas");
  canvas.width = letterBImage.naturalWidth;
  canvas.height = letterBImage.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  context.drawImage(letterBImage, 0, 0);
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let maxX = -1;
    for (let index = 3, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      if (pixels[index] <= 32) continue;
      const x = pixel % canvas.width;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (maxX < minX) return;
    const start = minX / canvas.width * 100;
    const origin = ((minX + maxX) / 2) / canvas.width * 100;
    letterEnvelope.style.setProperty("--letter-b-start", `${start}%`);
    letterEnvelope.style.setProperty("--letter-b-origin-x", `${origin}%`);
  } catch (error) {
    console.warn("[chapter4 letter] unable to read B alpha bounds", error);
  }
}

if (letterAImage.complete && letterBImage.complete) syncLetterAssetGeometry();
else {
  letterAImage.addEventListener("load", syncLetterAssetGeometry, { once: true });
  letterBImage.addEventListener("load", syncLetterAssetGeometry, { once: true });
}

function setLetterProgress(value) {
  tearProgress = THREE.MathUtils.clamp(value, 0, 1);
  letterEnvelope.style.setProperty("--tear-progress", tearProgress.toFixed(4));
  letterEnvelope.style.setProperty("--tear-rotation", `${-tearProgress * TEAR_MAX_ROTATION}deg`);
  letterEnvelope.style.setProperty("--tear-rotate-x", `${tearProgress * TEAR_PEEL_ROTATE_X}deg`);
  letterEnvelope.style.setProperty("--tear-translate-x", `${tearProgress * TEAR_PEEL_TRANSLATE_X}px`);
  letterEnvelope.style.setProperty("--tear-translate-y", `${tearProgress * TEAR_PEEL_TRANSLATE_Y}px`);
  letterEnvelope.style.setProperty("--tear-translate-z", `${tearProgress * TEAR_PEEL_TRANSLATE_Z}px`);
  letterEnvelope.style.setProperty("--tear-skew", `${tearProgress * TEAR_SKEW}deg`);
  letterEnvelope.style.setProperty("--tear-scale-y", String(1 - tearProgress * 0.1));
  letterEnvelope.style.setProperty("--tear-opacity", String(1 - tearProgress * 0.92));
}

function clearTypewriter() {
  if (typingTimer !== null) window.clearTimeout(typingTimer);
  typingTimer = null;
  isLetterTyping = false;
  canTurnLetterPage = false;
  typingRunId += 1;
}

function startTypewriter(pageIndex = currentLetterPage) {
  clearTypewriter();
  currentLetterPage = THREE.MathUtils.clamp(pageIndex, 0, LETTER_PAGES.length - 1);
  currentCharIndex = 0;
  isLetterTyping = true;
  canTurnLetterPage = false;
  const activeTypingRunId = typingRunId;
  letterState = "typing";
  letterTypewriter.textContent = "";
  updateLetterPageChrome();
  const pageText = LETTER_PAGES[currentLetterPage] || "";
  if (!pageText) {
    isLetterTyping = false;
    letterState = "complete";
    console.warn("[chapter4 letter] current page has no text", currentLetterPage);
    return;
  }
  const typeNext = () => {
    if (!isLetterTyping || activeTypingRunId !== typingRunId) return;
    letterTypewriter.textContent += pageText[currentCharIndex] ?? "";
    currentCharIndex += 1;
    if (currentCharIndex < pageText.length) {
      typingTimer = window.setTimeout(typeNext, TYPE_INTERVAL);
    } else {
      typingTimer = null;
      isLetterTyping = false;
      canTurnLetterPage = true;
      letterState = "complete";
      updateLetterPageChrome();
    }
  };
  typeNext();
}

function startFirstPageTypewriterAfterReveal() {
  if (firstPageTypingStarted || !letterReadingLayer.classList.contains("is-visible")) return;
  firstPageTypingStarted = true;
  window.clearTimeout(letterRevealTimer);
  letterRevealTimer = null;
  startTypewriter(0);
}

letterPaperStack.addEventListener("transitionend", event => {
  if (event.propertyName === "opacity") startFirstPageTypewriterAfterReveal();
});

function updateLetterPageChrome() {
  letterPageCount.textContent = `${currentLetterPage + 1} / ${LETTER_PAGES.length}`;
  if (isLetterTyping || !canTurnLetterPage || currentLetterPage === LETTER_PAGES.length - 1) {
    letterPageHint.hidden = true;
  } else {
    letterPageHint.hidden = false;
    letterPageHint.textContent = "拖拽翻页";
  }
}

function setLetterPage(index, shouldType = true) {
  clearTypewriter();
  currentLetterPage = THREE.MathUtils.clamp(index, 0, LETTER_PAGES.length - 1);
  currentCharIndex = 0;
  updateLetterPageChrome();
  letterTypewriter.textContent = "";
  if (shouldType) startTypewriter(currentLetterPage);
}

async function turnLetterPage(direction) {
  const nextIndex = currentLetterPage + direction;
  if (!canTurnLetterPage || letterPageTurning || nextIndex < 0 || nextIndex >= LETTER_PAGES.length) return;
  letterPageTurning = true;
  clearTypewriter();
  letterState = "turning";
  const width = letterPaper.getBoundingClientRect().width;
  const outgoingX = direction > 0 ? -width * 0.32 : width * 0.32;
  const outgoingAnimation = letterPaper.animate(
    [{ transform: `translateX(${letterPageDragX}px)`, opacity: 1 }, { transform: `translateX(${outgoingX}px)`, opacity: 0 }],
    { duration: 190, easing: "ease-in", fill: "forwards" }
  );
  await outgoingAnimation.finished.catch(() => {});
  letterPageDragX = 0;
  letterPaper.style.setProperty("--letter-page-drag-x", "0px");
  setLetterPage(nextIndex, false);
  const incomingAnimation = letterPaper.animate(
    [{ transform: `translateX(${-outgoingX}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
    { duration: 230, easing: "ease-out", fill: "forwards" }
  );
  outgoingAnimation.cancel();
  await incomingAnimation.finished.catch(() => {});
  incomingAnimation.cancel();
  letterPageTurning = false;
  startTypewriter(currentLetterPage);
}

function openLetterReading() {
  window.clearTimeout(letterRevealTimer);
  clearTypewriter();
  firstPageTypingStarted = false;
  letterState = "reading";
  letterReadingLayer.classList.add("is-visible");
  letterReadingLayer.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => {
    setLetterPage(0, false);
    letterRevealTimer = window.setTimeout(
      startFirstPageTypewriterAfterReveal,
      PAPER_REVEAL_DURATION + 40
    );
  });
  letterCancel.focus();
}

function closeLetterReading() {
  window.clearTimeout(letterRevealTimer);
  letterRevealTimer = null;
  clearTypewriter();
  firstPageTypingStarted = false;
  letterState = "closedReading";
  letterReadingLayer.classList.remove("is-visible");
  letterReadingLayer.setAttribute("aria-hidden", "true");
  letterTypewriter.textContent = "";
  letterPaper.style.setProperty("--letter-page-drag-x", "0px");
  letterEnvelope.dataset.letterState = "opened";
}

letterPaper.addEventListener("pointerdown", event => {
  if (event.button !== 0 || !canTurnLetterPage || letterPageTurning || event.target.closest("button")) return;
  letterPagePointerId = event.pointerId;
  letterPageDragStartX = event.clientX;
  letterPageDragX = 0;
  letterPaper.classList.add("is-dragging");
  letterPaper.setPointerCapture(event.pointerId);
});
letterPaper.addEventListener("pointermove", event => {
  if (event.pointerId !== letterPagePointerId) return;
  letterPageDragX = THREE.MathUtils.clamp(event.clientX - letterPageDragStartX, -180, 180);
  letterPaper.style.setProperty("--letter-page-drag-x", `${letterPageDragX}px`);
});
function finishLetterPageDrag(event) {
  if (event.pointerId !== letterPagePointerId) return;
  if (letterPaper.hasPointerCapture(event.pointerId)) letterPaper.releasePointerCapture(event.pointerId);
  letterPagePointerId = null;
  letterPaper.classList.remove("is-dragging");
  const direction = letterPageDragX <= -LETTER_PAGE_TURN_THRESHOLD
    ? 1
    : letterPageDragX >= LETTER_PAGE_TURN_THRESHOLD
      ? -1
      : 0;
  if (direction && currentLetterPage + direction >= 0 && currentLetterPage + direction < LETTER_PAGES.length) {
    turnLetterPage(direction);
  } else {
    letterPageDragX = 0;
    letterPaper.style.setProperty("--letter-page-drag-x", "0px");
  }
}
letterPaper.addEventListener("pointerup", finishLetterPageDrag);
letterPaper.addEventListener("pointercancel", finishLetterPageDrag);

letterTearHandle.addEventListener("pointerdown", event => {
  if (letterState !== "sealed" || event.button !== 0) return;
  event.preventDefault();
  letterState = "tearing";
  letterPointerId = event.pointerId;
  letterDragStartY = event.clientY;
  letterEnvelope.dataset.letterState = "tearing";
  letterTearHandle.setPointerCapture(event.pointerId);
});

letterTearHandle.addEventListener("pointermove", event => {
  if (letterState !== "tearing" || event.pointerId !== letterPointerId) return;
  const dragDistance = letterEnvelope.getBoundingClientRect().height * TEAR_DRAG_DISTANCE_RATIO;
  setLetterProgress((letterDragStartY - event.clientY) / dragDistance);
});

function finishLetterTear(event) {
  if (letterState !== "tearing" || event.pointerId !== letterPointerId) return;
  if (letterTearHandle.hasPointerCapture(event.pointerId)) {
    letterTearHandle.releasePointerCapture(event.pointerId);
  }
  letterPointerId = null;
  if (tearProgress >= TEAR_COMPLETE_THRESHOLD) {
    setLetterProgress(1);
    letterState = "opened";
    letterEnvelope.dataset.letterState = "opened";
    playLetterTearSound();
    openLetterReading();
  } else {
    setLetterProgress(0);
    letterState = "sealed";
    letterEnvelope.dataset.letterState = "sealed";
  }
}

letterTearHandle.addEventListener("pointerup", finishLetterTear);
letterTearHandle.addEventListener("pointercancel", finishLetterTear);
letterEnvelope.addEventListener("click", () => {
  if (["opened", "closedReading"].includes(letterState)) openLetterReading();
});
letterCancel.addEventListener("click", closeLetterReading);
letterReadingBackdrop.addEventListener("click", closeLetterReading);

// 第四章猫咪：保留既有容器位置和尺寸，点击只刷新提示气泡。
const CAT_FRAME_INTERVAL = 600;
const CAT_FRAMES = Object.freeze([
  "./pic/forth/cat1.png",
  "./pic/forth/cat2.png",
  "./pic/forth/cat3.png"
]);
const CAT_BUBBLE_DURATION = 3200;
const puzzleCatButton = document.querySelector(".puzzle-cat-button");
const puzzleCatFrame = document.querySelector(".puzzle-cat-frame");
const catSpeechBubble = document.querySelector(".cat-speech-bubble");
let catBubbleTimer = null;
let catFrameTimer = null;
let catFrameIndex = 0;

function preloadCatFrames() {
  return Promise.all(CAT_FRAMES.map(source => new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(new URL(source, import.meta.url).href), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = new URL(source, import.meta.url).href;
  })));
}

function startCatFrameAnimation(frameSources) {
  if (catFrameTimer !== null || !frameSources.length) return;
  puzzleCatFrame.src = frameSources[0];
  catFrameTimer = window.setInterval(() => {
    catFrameIndex = (catFrameIndex + 1) % frameSources.length;
    puzzleCatFrame.src = frameSources[catFrameIndex];
  }, CAT_FRAME_INTERVAL);
}

preloadCatFrames()
  .then(startCatFrameAnimation)
  .catch(error => console.warn("[chapter4 cat] frame preload failed", error));

puzzleCatButton.addEventListener("click", () => {
  if (currentState !== "chapter4") return;
  if (catBubbleTimer !== null) window.clearTimeout(catBubbleTimer);
  catSpeechBubble.classList.add("is-visible");
  catBubbleTimer = window.setTimeout(() => {
    catSpeechBubble.classList.remove("is-visible");
    catBubbleTimer = null;
  }, CAT_BUBBLE_DURATION);
});

// 第四章 CD 模块：每张唱片固定对应一条歌曲。
const CD_RECORDS = [
  { image: "./pic/forth/cd/cd1.png", audio: "./pic/forth/audio/1.mp3" },
  { image: "./pic/forth/cd/cd2.png", audio: "./pic/forth/audio/2.mp3" },
  { image: "./pic/forth/cd/cd3.png", audio: "./pic/forth/audio/3.mp3" },
  { image: "./pic/forth/cd/cd4.png", audio: "./pic/forth/audio/4.mp3" }
];
const CD_LAYOUT = {
  base: { x: 0.5, y: 0.49, scale: 0.9 },
  record: { x: 0.49, y: 0.51, scale: 1.19 },
  tonearm: { x: 0.58, y: 0.45, scale: 1, rotation: 0 }
};
const RECORD_ROTATION_SPEED = 8000;
const RECORD_SWITCH_DURATION = 520;
const NOTE_SPAWN_MIN = 500;
const NOTE_SPAWN_MAX = 900;
const AUDIO_LEVEL_SMOOTHING = 0.85;
const MUSIC_NOTE_ASSETS = Object.freeze([
  "./pic/forth/music/1.png",
  "./pic/forth/music/2.png",
  "./pic/forth/music/3.png",
  "./pic/forth/music/4.png",
  "./pic/forth/music/5.png"
]);
const PUZZLE_AUDIO_MOTION = Object.freeze({
  sky: Object.freeze({ x: 2, y: -3 }),
  nature: Object.freeze({ x: -4, y: 2 }),
  self: Object.freeze({ x: 5, y: 3 }),
  pet: Object.freeze({ x: -6, y: -4 })
});

const chapter4Cd = document.querySelector(".chapter4-cd");
const cdStage = document.querySelector(".cd-player-stage");
const cdBase = document.querySelector(".cd-player-base");
const cdRecordPosition = document.querySelector(".cd-record-position");
const cdRecordImage = document.querySelector(".cd-record-spin");
const cdTonearm = document.querySelector(".cd-tonearm");
const cdPlayButton = document.querySelector('[data-cd-action="play"]');
const cdPreviousButton = document.querySelector('[data-cd-action="previous"]');
const cdNextButton = document.querySelector('[data-cd-action="next"]');
const cdTrackStatus = document.querySelector(".cd-track-status");
const cdMusicNotes = document.querySelector(".cd-music-notes");
const cdAudio = new Audio();
let cdRecordIndex = 0;
let cdIsPlaying = false;
let cdIsSwitching = false;
let noteEmitterTimer = null;
let cdMediaSource = null;
let cdAnalyser = null;
let cdAnalyserData = null;
let smoothedAudioLevel = 0;
let renderedAudioLevel = 0;
let reactiveRAFId = null;

cdRecordImage.style.animationDuration = `${RECORD_ROTATION_SPEED}ms`;
cdAudio.loop = true;
cdAudio.preload = "auto";
cdAudio.muted = false;
cdAudio.volume = 1;

function applyCdLayout() {
  cdBase.style.left = `${CD_LAYOUT.base.x * 100}%`;
  cdBase.style.top = `${CD_LAYOUT.base.y * 100}%`;
  cdBase.style.transform = `translate(-50%, -50%) scale(${CD_LAYOUT.base.scale})`;
  cdRecordPosition.style.left = `${CD_LAYOUT.record.x * 100}%`;
  cdRecordPosition.style.top = `${CD_LAYOUT.record.y * 100}%`;
  cdRecordPosition.style.setProperty("--cd-record-scale", CD_LAYOUT.record.scale);
  cdTonearm.style.left = `${CD_LAYOUT.tonearm.x * 100}%`;
  cdTonearm.style.top = `${CD_LAYOUT.tonearm.y * 100}%`;
  cdTonearm.style.transform = `translate(-50%, -50%) scale(${CD_LAYOUT.tonearm.scale}) rotate(${CD_LAYOUT.tonearm.rotation}deg)`;
}

function setCdPlaying(nextPlaying) {
  cdIsPlaying = nextPlaying;
  cdRecordPosition.classList.toggle("is-playing", nextPlaying);
  cdPlayButton.textContent = nextPlaying ? "Pause" : "Play";
  if (nextPlaying) {
    startNoteEmitter();
    ensurePuzzleReactiveLoop();
  } else {
    stopNoteEmitter();
    ensurePuzzleReactiveLoop();
  }
}

function musicRandomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function emitMusicNote() {
  if (!cdIsPlaying || !cdMusicNotes) return;
  const note = document.createElement("img");
  const asset = MUSIC_NOTE_ASSETS[Math.floor(Math.random() * MUSIC_NOTE_ASSETS.length)];
  const scale = musicRandomBetween(0.6, 1.4);
  note.className = "cd-music-note";
  note.src = new URL(asset, import.meta.url).href;
  note.alt = "";
  note.setAttribute("aria-hidden", "true");
  note.style.setProperty("--note-x", `${musicRandomBetween(28, 72).toFixed(2)}%`);
  note.style.setProperty("--note-y", `${musicRandomBetween(34, 72).toFixed(2)}%`);
  note.style.setProperty("--note-drift-x", `${musicRandomBetween(-24, 24).toFixed(2)}px`);
  note.style.setProperty("--note-drift-y", `${-musicRandomBetween(42, 82).toFixed(2)}px`);
  note.style.setProperty("--note-rotation", `${musicRandomBetween(-25, 25).toFixed(2)}deg`);
  note.style.setProperty("--note-drift-rotation", `${musicRandomBetween(-8, 8).toFixed(2)}deg`);
  note.style.setProperty("--note-scale", scale.toFixed(2));
  note.style.setProperty("--note-start-scale", (scale * 0.88).toFixed(2));
  note.style.setProperty("--note-end-scale", (scale * 1.04).toFixed(2));
  note.style.setProperty("--note-lifetime", `${musicRandomBetween(1800, 3200).toFixed(0)}ms`);
  cdMusicNotes.appendChild(note);
  note.addEventListener("animationend", () => note.remove(), { once: true });
}

function scheduleNextMusicNote() {
  if (!cdIsPlaying || noteEmitterTimer !== null) return;
  noteEmitterTimer = window.setTimeout(() => {
    noteEmitterTimer = null;
    if (!cdIsPlaying) return;
    emitMusicNote();
    scheduleNextMusicNote();
  }, musicRandomBetween(NOTE_SPAWN_MIN, NOTE_SPAWN_MAX));
}

function startNoteEmitter() {
  if (noteEmitterTimer !== null) return;
  emitMusicNote();
  scheduleNextMusicNote();
}

function stopNoteEmitter() {
  if (noteEmitterTimer !== null) window.clearTimeout(noteEmitterTimer);
  noteEmitterTimer = null;
}

async function ensureCdAudioAnalyser() {
  unlockAudioSystem();
  if (!audioContext) return false;
  if (!cdMediaSource) {
    cdMediaSource = audioContext.createMediaElementSource(cdAudio);
    cdAnalyser = audioContext.createAnalyser();
    cdAnalyser.fftSize = 256;
    cdAnalyser.smoothingTimeConstant = 0;
    cdAnalyserData = new Uint8Array(cdAnalyser.fftSize);
    cdMediaSource.connect(cdAnalyser);
    cdAnalyser.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") await audioContext.resume();
  return true;
}

function readCdAudioLevel() {
  if (!cdAnalyser || !cdAnalyserData || !cdIsPlaying) return 0;
  cdAnalyser.getByteTimeDomainData(cdAnalyserData);
  let squaredTotal = 0;
  for (const sample of cdAnalyserData) {
    const centered = (sample - 128) / 128;
    squaredTotal += centered * centered;
  }
  return THREE.MathUtils.clamp(Math.sqrt(squaredTotal / cdAnalyserData.length) * 3.2, 0, 1);
}

function applyPuzzleAudioMotion(audioLevel, time) {
  for (const [layerId, maximum] of Object.entries(PUZZLE_AUDIO_MOTION)) {
    const layer = document.querySelector(`[data-puzzle-layer="${layerId}"]`);
    if (!layer) continue;
    const phase = time * 0.001 * (layerId.length * 0.19 + 0.52);
    const xVariation = 0.9 + Math.sin(phase) * 0.1;
    const yVariation = 0.9 + Math.cos(phase * 1.13) * 0.1;
    layer.style.setProperty("--puzzle-audio-x", `${maximum.x * audioLevel * xVariation}px`);
    layer.style.setProperty("--puzzle-audio-y", `${maximum.y * audioLevel * yVariation}px`);
  }
}

function runPuzzleReactiveFrame(time) {
  reactiveRAFId = null;
  const rawAudioLevel = readCdAudioLevel();
  smoothedAudioLevel = smoothedAudioLevel * AUDIO_LEVEL_SMOOTHING
    + rawAudioLevel * (1 - AUDIO_LEVEL_SMOOTHING);
  const reactiveEnabled = puzzleComplete && cdIsPlaying;
  const targetLevel = reactiveEnabled ? smoothedAudioLevel : 0;
  renderedAudioLevel += (targetLevel - renderedAudioLevel) * (reactiveEnabled ? 0.22 : 0.1);
  if (renderedAudioLevel < 0.0005 && !reactiveEnabled) renderedAudioLevel = 0;
  applyPuzzleAudioMotion(renderedAudioLevel, time);
  if (cdIsPlaying || renderedAudioLevel > 0) {
    reactiveRAFId = window.requestAnimationFrame(runPuzzleReactiveFrame);
  }
}

function ensurePuzzleReactiveLoop() {
  if (reactiveRAFId !== null) return;
  if (!cdIsPlaying && renderedAudioLevel <= 0) return;
  reactiveRAFId = window.requestAnimationFrame(runPuzzleReactiveFrame);
}

function loadCdRecordAudio() {
  cdAudio.pause();
  cdAudio.currentTime = 0;
  setCdPlaying(false);
  const audioPath = CD_RECORDS[cdRecordIndex].audio;
  if (!audioPath) {
    cdAudio.removeAttribute("src");
    cdAudio.load();
    cdTrackStatus.textContent = `Record ${cdRecordIndex + 1} · audio pending`;
    return;
  }
  cdAudio.src = new URL(audioPath, import.meta.url).href;
  cdAudio.load();
  cdTrackStatus.textContent = `Record ${cdRecordIndex + 1}`;
}

function switchCdRecord(direction) {
  if (cdIsSwitching) return;
  cdIsSwitching = true;
  cdPreviousButton.disabled = true;
  cdNextButton.disabled = true;
  loadCdRecordAudio();
  const stageWidth = cdStage.getBoundingClientRect().width || chapter4Cd.clientWidth;
  const incomingOffset = direction * stageWidth;
  const outgoingOffset = -incomingOffset;
  const scale = CD_LAYOUT.record.scale;
  const ghost = cdRecordImage.cloneNode(false);
  ghost.className = "cd-record-ghost";
  ghost.style.left = `${CD_LAYOUT.record.x * 100}%`;
  ghost.style.top = `${CD_LAYOUT.record.y * 100}%`;
  ghost.style.setProperty("--cd-record-scale", scale);
  cdStage.appendChild(ghost);

  cdRecordIndex = (cdRecordIndex + direction + CD_RECORDS.length) % CD_RECORDS.length;
  cdRecordImage.src = new URL(CD_RECORDS[cdRecordIndex].image, import.meta.url).href;
  cdRecordImage.alt = `唱片 ${cdRecordIndex + 1}`;
  const centerTransform = `translate(-50%, -50%) translateX(0px) scale(${scale})`;
  const incomingTransform = `translate(-50%, -50%) translateX(${incomingOffset}px) scale(${scale})`;
  const outgoingTransform = `translate(-50%, -50%) translateX(${outgoingOffset}px) scale(${scale})`;
  ghost.animate(
    [{ transform: centerTransform, opacity: 1 }, { transform: outgoingTransform, opacity: 0 }],
    { duration: RECORD_SWITCH_DURATION, easing: "ease-in-out", fill: "forwards" }
  ).finished.finally(() => ghost.remove());
  cdRecordPosition.animate(
    [{ transform: incomingTransform, opacity: 0 }, { transform: centerTransform, opacity: 1 }],
    { duration: RECORD_SWITCH_DURATION, easing: "ease-out" }
  ).finished.finally(() => {
    loadCdRecordAudio();
    cdIsSwitching = false;
    cdPreviousButton.disabled = false;
    cdNextButton.disabled = false;
  });
}

cdPreviousButton.addEventListener("click", () => switchCdRecord(-1));
cdNextButton.addEventListener("click", () => switchCdRecord(1));
cdPlayButton.addEventListener("click", async () => {
  if (!CD_RECORDS[cdRecordIndex].audio) {
    console.warn(`[chapter4 cd] Record ${cdRecordIndex + 1} audio is not provided yet.`);
    setCdPlaying(!cdIsPlaying);
    cdTrackStatus.textContent = cdIsPlaying
      ? `Record ${cdRecordIndex + 1} · visual preview`
      : `Record ${cdRecordIndex + 1} · audio pending`;
    return;
  }
  if (cdIsPlaying) {
    cdAudio.pause();
    setCdPlaying(false);
    return;
  }
  try {
    // 先在这次真实点击的用户手势内启动媒体；分析器失败不能再阻断音乐和音符。
    cdAudio.muted = false;
    await cdAudio.play();
    setCdPlaying(true);
    console.log("[CD DEBUG]", {
      isPlaying: cdIsPlaying,
      paused: cdAudio.paused,
      muted: cdAudio.muted,
      volume: cdAudio.volume,
      currentSrc: cdAudio.currentSrc || cdAudio.src
    });
  } catch (error) {
    console.warn("[chapter4 cd] play failed", error.name, error.message);
    setCdPlaying(false);
    return;
  }
  try {
    await ensureCdAudioAnalyser();
  } catch (error) {
    // Web Audio 只负责 Puzzle 响应；不能让它的失败中断已经开始的歌曲。
    console.warn("[chapter4 cd] analyser unavailable", error.name, error.message);
  }
});
cdAudio.addEventListener("pause", () => {
  if (!cdAudio.ended) setCdPlaying(false);
});
cdAudio.addEventListener("error", () => {
  console.warn("[chapter4 cd] audio failed to load", cdAudio.error);
  setCdPlaying(false);
});

applyCdLayout();
loadCdRecordAudio();

// 第四章 PUZZLE：position.png 永远是底图，其余图层由对应 Icon 激活。
const PUZZLE_ITEMS = [
  { id: "sky", icon: "./pic/forth/icon/cloud_icon.png", layer: "./pic/forth/sky.png" },
  { id: "nature", icon: "./pic/forth/icon/grass.png", layer: "./pic/forth/tree.png" },
  { id: "self", icon: "./pic/forth/icon/girl_icon.png", layer: "./pic/forth/girl.png" },
  { id: "pet", icon: "./pic/forth/icon/dog_icon.png", layer: "./pic/forth/dog.png" }
];
const ICON_LAYOUT = {
  sky: { x: 0.08, y: 0.14, scale: 1.64 },
  nature: { x: 0.19, y: 0.13, scale: 1.84 },
  self: { x: 0.84, y: 0.13, scale: 1.31 },
  pet: { x: 0.93, y: 0.13, scale: 1.46 }
};
const PUZZLE_ALPHA_THRESHOLD = 32;
const PUZZLE_CONTENT_OFFSET_X = 8;
const PLANT_VIDEO_X = 0.015;
const PLANT_VIDEO_Y = 0.82;
const PLANT_VIDEO_SCALE = 3.5;
const PLANT_VIDEO_WIDTH = 0.16;
const PLANT_VIDEO_HEIGHT = 0.32;
const PLANT_VIDEO_VOLUME = 0.75;
const PUZZLE_LAYER_Z_INDEX = 10;
const PLANT_VIDEO_Z_INDEX = 20;

const chapter4Puzzle = document.querySelector(".chapter4-puzzle");
const puzzleStage = document.querySelector(".puzzle-stage");
const puzzleArtwork = document.querySelector(".puzzle-artwork");
const plantVideoArea = document.querySelector(".turtle-plant-video-area");
const plantVideo = document.querySelector(".turtle-plant-video");
const plantVideoFallback = document.querySelector(".turtle-plant-play-fallback");
const plantHintBubble = document.querySelector(".plant-hint-bubble");
const puzzleLayerMasks = new Map();
const puzzleStates = new Map();
let completedCount = 0;
let puzzleComplete = false;
let plantVideoTriggered = false;
let plantHintTimer = null;

chapter4Puzzle.style.setProperty("--puzzle-content-offset-x", `${PUZZLE_CONTENT_OFFSET_X}%`);
chapter4Puzzle.style.setProperty("--plant-video-x", `${PLANT_VIDEO_X * 100}%`);
chapter4Puzzle.style.setProperty("--plant-video-y", `${PLANT_VIDEO_Y * 100}%`);
chapter4Puzzle.style.setProperty("--plant-video-scale", PLANT_VIDEO_SCALE);
chapter4Puzzle.style.setProperty("--plant-video-width", `${PLANT_VIDEO_WIDTH * 100}%`);
chapter4Puzzle.style.setProperty("--plant-video-height", `${PLANT_VIDEO_HEIGHT * 100}%`);
chapter4Puzzle.style.setProperty("--puzzle-layer-z-index", PUZZLE_LAYER_Z_INDEX);
chapter4Puzzle.style.setProperty("--plant-video-z-index", PLANT_VIDEO_Z_INDEX);
plantVideo.volume = PLANT_VIDEO_VOLUME;
plantVideo.muted = false;
plantVideo.loop = false;
plantVideo.pause();
plantVideo.currentTime = 0;

plantVideo.addEventListener("loadeddata", () => {
  if (plantVideoTriggered) return;
  plantVideo.pause();
  plantVideo.currentTime = 0;
}, { once: true });

function hidePlantHint() {
  if (plantHintTimer !== null) window.clearTimeout(plantHintTimer);
  plantHintTimer = null;
  plantHintBubble.classList.remove("is-visible");
}

function showPlantHint() {
  if (puzzleComplete) return;
  if (plantHintTimer !== null) window.clearTimeout(plantHintTimer);
  plantHintBubble.classList.add("is-visible");
  plantHintTimer = window.setTimeout(hidePlantHint, 3200);
}

plantVideo.addEventListener("click", showPlantHint);

function attemptPlantVideoPlayback() {
  plantVideoFallback.hidden = true;
  const playPromise = plantVideo.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(error => {
      console.warn("[chapter4 puzzle] plant video playback blocked or unavailable", error);
      plantVideoFallback.hidden = false;
    });
  }
}

function startPlantVideo() {
  if (plantVideoTriggered) return;
  plantVideoTriggered = true;
  plantVideoArea.classList.add("is-visible");
  plantVideoArea.setAttribute("aria-hidden", "false");
  plantVideo.currentTime = 0;
  plantVideo.muted = false;
  plantVideo.loop = false;
  attemptPlantVideoPlayback();
}

plantVideoFallback.addEventListener("click", attemptPlantVideoPlayback);
plantVideo.addEventListener("ended", () => {
  plantVideoArea.dataset.playbackState = "ended";
});
plantVideo.addEventListener("error", () => {
  console.warn("[chapter4 puzzle] plant video failed to load", plantVideo.error);
  if (plantVideoTriggered) plantVideoFallback.hidden = false;
}, { once: true });

function applyPuzzleIconLayout(id) {
  const element = document.querySelector(`[data-puzzle-item="${id}"]`);
  const layout = ICON_LAYOUT[id];
  element.style.left = `${layout.x * 100}%`;
  element.style.top = `${layout.y * 100}%`;
  element.style.setProperty("--icon-scale", layout.scale);
}

function preparePuzzleLayerMask(layerId) {
  const image = document.querySelector(`[data-puzzle-layer="${layerId}"]`);
  const buildMask = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    try {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8Array(canvas.width * canvas.height);
      for (let pixelIndex = 0; pixelIndex < alpha.length; pixelIndex += 1) {
        alpha[pixelIndex] = pixels[pixelIndex * 4 + 3];
      }
      puzzleLayerMasks.set(layerId, { width: canvas.width, height: canvas.height, alpha });
    } catch (error) {
      console.warn(`[puzzle] unable to build alpha mask for ${layerId}:`, error);
    }
  };

  if (image.complete) buildMask();
  else image.addEventListener("load", buildMask, { once: true });
  image.addEventListener("error", () => {
    console.warn(`[puzzle] layer image failed to load: ${image.currentSrc || image.src}`);
  }, { once: true });
}

function resolvePuzzleObjectPosition(value, freeSpace) {
  if (value.endsWith("%")) return freeSpace * Number.parseFloat(value) / 100;
  if (value.endsWith("px")) return Number.parseFloat(value);
  return freeSpace / 2;
}

function getPuzzleLayerDrawRect(image, mask, containerRect) {
  const style = window.getComputedStyle(image);
  const fit = style.objectFit;
  const widthRatio = containerRect.width / mask.width;
  const heightRatio = containerRect.height / mask.height;
  let drawWidth = containerRect.width;
  let drawHeight = containerRect.height;

  if (fit === "contain" || fit === "scale-down") {
    const scale = fit === "scale-down"
      ? Math.min(1, widthRatio, heightRatio)
      : Math.min(widthRatio, heightRatio);
    drawWidth = mask.width * scale;
    drawHeight = mask.height * scale;
  } else if (fit === "cover") {
    const scale = Math.max(widthRatio, heightRatio);
    drawWidth = mask.width * scale;
    drawHeight = mask.height * scale;
  } else if (fit === "none") {
    drawWidth = mask.width;
    drawHeight = mask.height;
  }

  const positionTokens = style.objectPosition.trim().split(/\s+/);
  const positionX = positionTokens[0] || "50%";
  const positionY = positionTokens[1] || "50%";
  return {
    left: containerRect.left + resolvePuzzleObjectPosition(positionX, containerRect.width - drawWidth),
    top: containerRect.top + resolvePuzzleObjectPosition(positionY, containerRect.height - drawHeight),
    width: drawWidth,
    height: drawHeight
  };
}

// pointerX / pointerY 是相对于 puzzleStage 的 Icon 中心点（0~1）。
function isPointInsideLayerMask(layerId, pointerX, pointerY) {
  const mask = puzzleLayerMasks.get(layerId);
  const image = document.querySelector(`[data-puzzle-layer="${layerId}"]`);
  if (!mask || !image) return false;

  const stageRect = puzzleStage.getBoundingClientRect();
  const artworkRect = puzzleArtwork.getBoundingClientRect();
  const drawRect = getPuzzleLayerDrawRect(image, mask, artworkRect);
  const clientX = stageRect.left + pointerX * stageRect.width;
  const clientY = stageRect.top + pointerY * stageRect.height;
  const localX = clientX - drawRect.left;
  const localY = clientY - drawRect.top;

  if (localX < 0 || localY < 0 || localX >= drawRect.width || localY >= drawRect.height) return false;
  const imageX = Math.min(mask.width - 1, Math.floor(localX / drawRect.width * mask.width));
  const imageY = Math.min(mask.height - 1, Math.floor(localY / drawRect.height * mask.height));
  return mask.alpha[imageY * mask.width + imageX] > PUZZLE_ALPHA_THRESHOLD;
}

function activatePuzzleItem(id, icon) {
  const state = puzzleStates.get(id);
  if (state.status === "completed") return;
  state.status = "completed";
  playPuzzleSuccessSound();
  document.querySelector(`[data-puzzle-layer="${id}"]`).classList.add("is-active");
  icon.classList.remove("is-dragging", "is-returning");
  icon.classList.add("is-completed");
  window.setTimeout(() => { icon.hidden = true; }, 280);
  completedCount += 1;
  puzzleComplete = completedCount === PUZZLE_ITEMS.length;
  puzzleStage.dataset.completedCount = String(completedCount);
  puzzleStage.dataset.puzzleComplete = String(puzzleComplete);
  if (puzzleComplete) {
    hidePlantHint();
    startPlantVideo();
    ensurePuzzleReactiveLoop();
  }
}

function returnPuzzleIcon(id, icon) {
  const state = puzzleStates.get(id);
  state.status = "returning";
  icon.classList.remove("is-dragging");
  icon.classList.add("is-returning");
  applyPuzzleIconLayout(id);
  window.setTimeout(() => {
    if (state.status === "returning") state.status = "idle";
    icon.classList.remove("is-returning");
  }, 340);
}

PUZZLE_ITEMS.forEach(item => {
  const icon = document.querySelector(`[data-puzzle-item="${item.id}"]`);
  const state = { status: "idle", pointerId: null, offsetX: 0, offsetY: 0, x: 0, y: 0 };
  puzzleStates.set(item.id, state);
  applyPuzzleIconLayout(item.id);
  icon.addEventListener("pointerdown", event => {
    if (currentState !== "chapter4" || state.status !== "idle" || event.button !== 0) return;
    event.preventDefault();
    const bounds = puzzleStage.getBoundingClientRect();
    state.status = "dragging";
    state.pointerId = event.pointerId;
    state.x = ICON_LAYOUT[item.id].x;
    state.y = ICON_LAYOUT[item.id].y;
    state.offsetX = (event.clientX - bounds.left) / bounds.width - ICON_LAYOUT[item.id].x;
    state.offsetY = (event.clientY - bounds.top) / bounds.height - ICON_LAYOUT[item.id].y;
    icon.classList.add("is-dragging");
    icon.setPointerCapture(event.pointerId);
  });
  icon.addEventListener("pointermove", event => {
    if (state.status !== "dragging" || event.pointerId !== state.pointerId) return;
    const bounds = puzzleStage.getBoundingClientRect();
    state.x = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width - state.offsetX, 0, 1);
    state.y = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height - state.offsetY, 0, 1);
    icon.style.left = `${state.x * 100}%`;
    icon.style.top = `${state.y * 100}%`;
  });
  const finishDrag = event => {
    if (state.status !== "dragging" || event.pointerId !== state.pointerId) return;
    if (icon.hasPointerCapture(event.pointerId)) icon.releasePointerCapture(event.pointerId);
    state.pointerId = null;
    if (isPointInsideLayerMask(item.id, state.x, state.y)) activatePuzzleItem(item.id, icon);
    else returnPuzzleIcon(item.id, icon);
  };
  icon.addEventListener("pointerup", finishDrag);
  icon.addEventListener("pointercancel", event => {
    if (state.status !== "dragging" || event.pointerId !== state.pointerId) return;
    state.pointerId = null;
    returnPuzzleIcon(item.id, icon);
  });
});

PUZZLE_ITEMS.forEach(item => preparePuzzleLayerMask(item.id));
puzzleStage.dataset.completedCount = "0";
puzzleStage.dataset.puzzleComplete = "false";

// 第四章 AI：只建立输入、请求与消息显示的最小对话链路。
const aiChatMessages = document.querySelector("#ai-chat-messages");
const aiInput = document.querySelector("#ai-chat-input");
const aiSendButton = document.querySelector("#ai-send-button");
const aiCharacter = document.querySelector("#ai-character");
const aiStatusBubble = document.querySelector(".ai-status-bubble");
const aiCharacterArea = document.querySelector(".ai-character-area");
const AI_CHARACTER_BUBBLE_GAP = 12;
aiCharacterArea.style.setProperty("--ai-character-bubble-gap", `${AI_CHARACTER_BUBBLE_GAP}px`);
const CHAT_ASSETS = Object.freeze({
  userAvatar: "./pic/forth/icon/user_icon.png",
  aiAvatar: "./pic/forth/icon/ai_icon.png",
});
const AI_ANIMATION_ASSETS = Object.freeze({
  idle: Object.freeze([
    "./pic/forth/IDLE/idle_1.png",
    "./pic/forth/IDLE/idle_2.png",
    "./pic/forth/IDLE/idle_3.png",
  ]),
  thinking: Object.freeze([
    "./pic/forth/think/think_1.png",
    "./pic/forth/think/think_2.png",
    "./pic/forth/think/think_3.png",
  ]),
});
const IDLE_FRAME_INTERVAL = 320;
const THINK_FRAME_INTERVAL = 240;
const AI_STATUS_TEXT = Object.freeze({
  idle: "泥嚎丫，偶是本站雇佣的小助手，很高兴听到您的声音 ^^ ",
  thinking: "等等，小主人，偶正在努力组织词语中：3 ",
});
const conversationMessages = [];
let aiRequestPending = false;
let AI_STATE = "idle";
let aiAnimationTimer = null;
let aiAnimationFrameIndex = 0;

Object.values(AI_ANIMATION_ASSETS).flat().forEach(source => {
  const image = new Image();
  image.src = new URL(source, import.meta.url).href;
});

function stopAIAnimation() {
  if (aiAnimationTimer !== null) window.clearInterval(aiAnimationTimer);
  aiAnimationTimer = null;
}

function startFrameAnimation(frames, interval) {
  stopAIAnimation();
  aiAnimationFrameIndex = 0;
  aiCharacter.src = new URL(frames[aiAnimationFrameIndex], import.meta.url).href;
  aiAnimationTimer = window.setInterval(() => {
    aiAnimationFrameIndex = (aiAnimationFrameIndex + 1) % frames.length;
    aiCharacter.src = new URL(frames[aiAnimationFrameIndex], import.meta.url).href;
  }, interval);
}

function setAIState(nextState) {
  if (!Object.hasOwn(AI_ANIMATION_ASSETS, nextState)) return;
  AI_STATE = nextState;
  aiCharacter.dataset.aiState = nextState;
  aiCharacter.alt = nextState === "thinking" ? "AI 思考中" : "AI 空闲中";
  aiStatusBubble.textContent = AI_STATUS_TEXT[nextState];
  aiStatusBubble.dataset.aiState = nextState;
  startFrameAnimation(
    AI_ANIMATION_ASSETS[nextState],
    nextState === "thinking" ? THINK_FRAME_INTERVAL : IDLE_FRAME_INTERVAL
  );
}

function appendChatMessage(role, text, isError = false) {
  if (role !== "user" && role !== "assistant") return;
  const isUser = role === "user";
  const row = document.createElement("div");
  const avatar = document.createElement("img");
  const bubble = document.createElement("div");
  row.className = `message-row ${role}`;
  avatar.className = `chat-avatar ${isUser ? "user-avatar" : "ai-avatar"}`;
  avatar.src = new URL(
    isUser ? CHAT_ASSETS.userAvatar : CHAT_ASSETS.aiAvatar,
    import.meta.url
  ).href;
  avatar.alt = isUser ? "用户头像" : "AI 头像";
  bubble.className = `message-bubble ${isUser ? "user-bubble" : "ai-bubble"}${isError ? " error-message" : ""}`;
  bubble.textContent = text;

  if (isUser) row.append(bubble, avatar);
  else row.append(avatar, bubble);
  aiChatMessages.appendChild(row);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

async function sendAiMessage() {
  if (aiRequestPending) return;
  const userText = aiInput.value.trim();
  if (!userText) return;

  playSendButtonSound();
  conversationMessages.push({ role: "user", content: userText });
  appendChatMessage("user", userText);
  aiInput.value = "";
  aiRequestPending = true;
  aiSendButton.disabled = true;
  aiSendButton.textContent = "Sending...";
  setAIState("thinking");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationMessages }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[chapter4 ai] request failed", response.status, data.error);
      appendChatMessage(
        "assistant",
        response.status === 429
          ? "现在有点忙，请稍后再试。"
          : "暂时连接不上，请稍后再试。",
        true
      );
      return;
    }

    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    if (!reply) throw new Error("Empty AI reply");
    conversationMessages.push({ role: "assistant", content: reply });
    appendChatMessage("assistant", reply);
  } catch (error) {
    console.error("[chapter4 ai] request error", error);
    appendChatMessage("assistant", "暂时连接不上，请稍后再试。", true);
  } finally {
    aiRequestPending = false;
    aiSendButton.disabled = false;
    aiSendButton.textContent = "Send";
    setAIState("idle");
  }
}

aiSendButton.addEventListener("click", sendAiMessage);
aiInput.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  sendAiMessage();
});

setAIState("idle");
