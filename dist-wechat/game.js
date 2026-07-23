"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/audio/feedback-audio.constants.ts
var INNER_AUDIO_GENERIC_CLEANUP_TIMEOUT_MS = 1500;
var INNER_AUDIO_COMBO_CLEANUP_TIMEOUT_MS = 5e3;
var COMBO_VOICE_VOLUME = 0.7;

// src/audio/FeedbackAudio.ts
var SAMPLE_RATE = 22050;
var MASTER_VOLUME = 0.7;
var PLACEMENT_STEPS = [
  {
    frequency: 659.25,
    durationSeconds: 0.07,
    volume: 0.2,
    type: "triangle",
    timbre: "glass",
    attackSeconds: 0.012,
    releaseSeconds: 0.045,
    glideFromRatio: 1.018
  },
  {
    frequency: 783.99,
    durationSeconds: 0.08,
    volume: 0.17,
    type: "triangle",
    timbre: "glass",
    delaySeconds: 0.05,
    attackSeconds: 0.012,
    releaseSeconds: 0.05,
    glideFromRatio: 1.014
  },
  {
    frequency: 987.77,
    durationSeconds: 0.11,
    volume: 0.13,
    type: "triangle",
    timbre: "glass",
    delaySeconds: 0.108,
    attackSeconds: 0.014,
    releaseSeconds: 0.06,
    glideFromRatio: 1.01
  }
];
var INVALID_STEPS = [
  {
    frequency: 293.66,
    durationSeconds: 0.08,
    volume: 0.13,
    type: "sine",
    timbre: "warmPulse",
    attackSeconds: 0.01,
    releaseSeconds: 0.055,
    glideFromRatio: 0.995
  },
  {
    frequency: 246.94,
    durationSeconds: 0.12,
    volume: 0.13,
    type: "sine",
    timbre: "warmPulse",
    delaySeconds: 0.055,
    attackSeconds: 0.01,
    releaseSeconds: 0.07,
    glideFromRatio: 0.99
  }
];
var CELEBRATION_STEPS = [
  {
    frequency: 523.25,
    durationSeconds: 0.11,
    volume: 0.16,
    type: "triangle",
    timbre: "softPluck",
    attackSeconds: 0.01,
    releaseSeconds: 0.06,
    glideFromRatio: 1.012
  },
  {
    frequency: 659.25,
    durationSeconds: 0.11,
    volume: 0.16,
    type: "triangle",
    timbre: "softPluck",
    delaySeconds: 0.055,
    attackSeconds: 0.01,
    releaseSeconds: 0.06,
    glideFromRatio: 1.01
  },
  {
    frequency: 783.99,
    durationSeconds: 0.11,
    volume: 0.16,
    type: "triangle",
    timbre: "softPluck",
    delaySeconds: 0.11,
    attackSeconds: 0.01,
    releaseSeconds: 0.06,
    glideFromRatio: 1.008
  },
  {
    frequency: 1046.5,
    durationSeconds: 0.16,
    volume: 0.15,
    type: "triangle",
    timbre: "glass",
    delaySeconds: 0.19,
    attackSeconds: 0.012,
    releaseSeconds: 0.08,
    glideFromRatio: 1.015
  },
  {
    frequency: 1318.51,
    durationSeconds: 0.18,
    volume: 0.11,
    type: "triangle",
    timbre: "glass",
    delaySeconds: 0.28,
    attackSeconds: 0.012,
    releaseSeconds: 0.09,
    glideFromRatio: 1.01
  }
];
function getAudioContextConstructor() {
  var _a;
  const root = globalThis;
  return (_a = root.AudioContext) != null ? _a : root.webkitAudioContext;
}
function getWechatAudioApi() {
  var _a;
  const root = globalThis;
  return (_a = root.wx) != null ? _a : null;
}
function encodeBase64(bytes) {
  var _a, _b, _c;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = (_a = bytes[index]) != null ? _a : 0;
    const b = (_b = bytes[index + 1]) != null ? _b : 0;
    const c = (_c = bytes[index + 2]) != null ? _c : 0;
    const triple = a << 16 | b << 8 | c;
    output += alphabet[triple >> 18 & 63];
    output += alphabet[triple >> 12 & 63];
    output += index + 1 < bytes.length ? alphabet[triple >> 6 & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }
  return output;
}
function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
  return offset + value.length;
}
function toneAmplitude(type, phase) {
  if (type === "sine") {
    return Math.sin(phase * Math.PI * 2);
  }
  if (type === "square") {
    return Math.sign(Math.sin(phase * Math.PI * 2));
  }
  return 2 * Math.asin(Math.sin(phase * Math.PI * 2)) / Math.PI;
}
function timbreAmplitude(step, phase) {
  var _a;
  const timbre = (_a = step.timbre) != null ? _a : "softPluck";
  const base = toneAmplitude(step.type, phase);
  switch (timbre) {
    case "glass":
      return base * 0.76 + toneAmplitude("sine", phase * 2) * 0.18 + toneAmplitude("sine", phase * 3) * 0.08 + toneAmplitude("triangle", phase * 4) * 0.05;
    case "warmPulse":
      return toneAmplitude("sine", phase) * 0.82 + toneAmplitude("triangle", phase * 2) * 0.16 + toneAmplitude("square", phase * 3) * 0.03;
    case "softPluck":
    default:
      return base * 0.8 + toneAmplitude("sine", phase * 2) * 0.16 + toneAmplitude("triangle", phase * 3) * 0.06;
  }
}
function getHarmonicProfile(timbre) {
  switch (timbre) {
    case "glass":
      return [0, 0.82, 0.22, 0.1, 0.05];
    case "warmPulse":
      return [0, 0.88, 0.18, 0.05, 0.02];
    case "softPluck":
    default:
      return [0, 0.86, 0.16, 0.08, 0.03];
  }
}
function buildToneClipDataUri(steps) {
  var _a, _b, _c, _d, _e;
  const releaseSeconds = 0.05;
  let clipLengthSeconds = releaseSeconds;
  for (const step of steps) {
    const start = (_a = step.delaySeconds) != null ? _a : 0;
    clipLengthSeconds = Math.max(
      clipLengthSeconds,
      start + step.durationSeconds + releaseSeconds
    );
  }
  const frameCount = Math.max(1, Math.ceil(clipLengthSeconds * SAMPLE_RATE));
  const samples = new Float32Array(frameCount);
  for (const step of steps) {
    const startFrame = Math.max(0, Math.floor(((_b = step.delaySeconds) != null ? _b : 0) * SAMPLE_RATE));
    const durationFrames = Math.max(1, Math.floor(step.durationSeconds * SAMPLE_RATE));
    const attackFrames = Math.max(
      1,
      Math.floor(((_c = step.attackSeconds) != null ? _c : Math.min(0.018, step.durationSeconds * 0.3)) * SAMPLE_RATE)
    );
    const releaseFrames = Math.max(
      1,
      Math.floor(((_d = step.releaseSeconds) != null ? _d : Math.min(0.06, step.durationSeconds * 0.45)) * SAMPLE_RATE)
    );
    const glideFromRatio = (_e = step.glideFromRatio) != null ? _e : 1;
    for (let frame = 0; frame < durationFrames; frame += 1) {
      const sampleIndex = startFrame + frame;
      if (sampleIndex >= frameCount) {
        break;
      }
      const progress = durationFrames <= 1 ? 1 : frame / (durationFrames - 1);
      const glideRatio = glideFromRatio + (1 - glideFromRatio) * progress;
      const phase = frame * step.frequency * glideRatio / SAMPLE_RATE;
      let envelope = 1;
      if (frame < attackFrames) {
        envelope = frame / attackFrames;
      } else if (frame > durationFrames - releaseFrames) {
        envelope = Math.max(0, (durationFrames - frame) / releaseFrames);
      }
      samples[sampleIndex] += timbreAmplitude(step, phase) * step.volume * envelope * MASTER_VOLUME;
    }
  }
  const bytesPerSample = 2;
  const dataSize = frameCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;
  offset = writeAscii(view, offset, "RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  offset = writeAscii(view, offset, "WAVE");
  offset = writeAscii(view, offset, "fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, SAMPLE_RATE, true);
  offset += 4;
  view.setUint32(offset, SAMPLE_RATE * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  offset = writeAscii(view, offset, "data");
  view.setUint32(offset, dataSize, true);
  offset += 4;
  for (let index = 0; index < frameCount; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }
  return `data:audio/wav;base64,${encodeBase64(new Uint8Array(buffer))}`;
}
var WebAudioBackend = class {
  constructor() {
    __publicField(this, "context", null);
    __publicField(this, "masterGain", null);
    __publicField(this, "periodicWaveCache", /* @__PURE__ */ new Map());
    __publicField(this, "activeComboAudio", null);
  }
  prime() {
    const context = this.ensureContext();
    if (!context || context.state !== "suspended") {
      return;
    }
    void context.resume().catch(() => void 0);
  }
  playPlacement() {
    this.playSteps(PLACEMENT_STEPS);
  }
  playInvalid() {
    this.playSteps(INVALID_STEPS);
  }
  playCelebration() {
    this.playSteps(CELEBRATION_STEPS);
  }
  playComboVoice(url) {
    this.stopComboVoice();
    const audio = new Audio(url);
    audio.volume = COMBO_VOICE_VOLUME;
    this.activeComboAudio = audio;
    audio.onended = () => {
      if (this.activeComboAudio === audio) {
        this.activeComboAudio = null;
      }
    };
    audio.onerror = () => {
      if (this.activeComboAudio === audio) {
        this.activeComboAudio = null;
      }
    };
    audio.play().catch(() => {
      if (this.activeComboAudio === audio) {
        this.activeComboAudio = null;
      }
    });
  }
  stopComboVoice() {
    const audio = this.activeComboAudio;
    if (!audio) {
      return;
    }
    this.activeComboAudio = null;
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
    }
  }
  playSteps(steps) {
    var _a, _b, _c, _d, _e;
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      void context.resume().catch(() => void 0);
    }
    const masterGain = this.masterGain;
    if (!masterGain) {
      return;
    }
    const baseTime = context.currentTime;
    for (const step of steps) {
      const startTime = baseTime + ((_a = step.delaySeconds) != null ? _a : 0);
      const endTime = startTime + step.durationSeconds;
      const oscillator = context.createOscillator();
      const overtoneOscillator = context.createOscillator();
      const gainNode = context.createGain();
      const shimmerGain = context.createGain();
      const attackSeconds = (_b = step.attackSeconds) != null ? _b : Math.min(0.018, step.durationSeconds * 0.3);
      const releaseSeconds = (_c = step.releaseSeconds) != null ? _c : Math.min(0.06, step.durationSeconds * 0.45);
      const glideFromRatio = (_d = step.glideFromRatio) != null ? _d : 1;
      const timbre = (_e = step.timbre) != null ? _e : "softPluck";
      oscillator.setPeriodicWave(this.getPeriodicWave(context, timbre));
      overtoneOscillator.type = "sine";
      oscillator.frequency.setValueAtTime(step.frequency * glideFromRatio, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(step.frequency, startTime + step.durationSeconds);
      overtoneOscillator.frequency.setValueAtTime(step.frequency * 2, startTime);
      gainNode.gain.setValueAtTime(1e-4, startTime);
      gainNode.gain.exponentialRampToValueAtTime(step.volume, startTime + attackSeconds);
      gainNode.gain.exponentialRampToValueAtTime(1e-4, endTime + releaseSeconds * 0.35);
      shimmerGain.gain.setValueAtTime(1e-4, startTime);
      shimmerGain.gain.exponentialRampToValueAtTime(step.volume * 0.14, startTime + attackSeconds * 1.2);
      shimmerGain.gain.exponentialRampToValueAtTime(1e-4, endTime);
      oscillator.connect(gainNode);
      overtoneOscillator.connect(shimmerGain);
      gainNode.connect(masterGain);
      shimmerGain.connect(masterGain);
      oscillator.start(startTime);
      overtoneOscillator.start(startTime);
      oscillator.stop(endTime + releaseSeconds);
      overtoneOscillator.stop(endTime + releaseSeconds * 0.75);
    }
  }
  getPeriodicWave(context, timbre) {
    const cached = this.periodicWaveCache.get(timbre);
    if (cached) {
      return cached;
    }
    const profile = getHarmonicProfile(timbre);
    const real = new Float32Array(profile.length);
    const imag = new Float32Array(profile.length);
    for (let index = 1; index < profile.length; index += 1) {
      imag[index] = profile[index];
    }
    const wave = context.createPeriodicWave(real, imag);
    this.periodicWaveCache.set(timbre, wave);
    return wave;
  }
  ensureContext() {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }
    if (!this.context) {
      this.context = new AudioContextConstructor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.18;
      this.masterGain.connect(this.context.destination);
    }
    return this.context;
  }
};
var InnerAudioBackend = class {
  constructor() {
    __publicField(this, "clipMap", {
      placement: buildToneClipDataUri(PLACEMENT_STEPS),
      invalid: buildToneClipDataUri(INVALID_STEPS),
      celebration: buildToneClipDataUri(CELEBRATION_STEPS)
    });
    __publicField(this, "primed", false);
    __publicField(this, "activeComboAudio", null);
    __publicField(this, "activeComboCleanupTimeoutId", null);
    __publicField(this, "comboCleanupInProgress", false);
  }
  prime() {
    this.primed = true;
  }
  playPlacement() {
    this.playClip(this.clipMap.placement);
  }
  playInvalid() {
    this.playClip(this.clipMap.invalid);
  }
  playCelebration() {
    this.playClip(this.clipMap.celebration);
  }
  playComboVoice(url) {
    var _a, _b, _c;
    this.stopComboVoice();
    const audio = this.createInnerAudio(url, COMBO_VOICE_VOLUME);
    if (!audio) {
      return;
    }
    this.activeComboAudio = audio;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.cleanupComboVoice(audio);
    };
    (_a = audio.onEnded) == null ? void 0 : _a.call(audio, () => cleanup());
    (_b = audio.onStop) == null ? void 0 : _b.call(audio, () => cleanup());
    (_c = audio.onError) == null ? void 0 : _c.call(audio, () => cleanup());
    try {
      audio.play();
      this.activeComboCleanupTimeoutId = globalThis.setTimeout(() => {
        cleanup();
      }, INNER_AUDIO_COMBO_CLEANUP_TIMEOUT_MS);
    } catch (e) {
      cleanup();
    }
  }
  stopComboVoice() {
    this.cleanupComboVoice();
  }
  playClip(source, cleanupTimeoutMs = INNER_AUDIO_GENERIC_CLEANUP_TIMEOUT_MS) {
    var _a, _b, _c;
    const audio = this.createInnerAudio(source, 0.9);
    if (!audio) {
      return;
    }
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.disposeInnerAudio(audio);
    };
    (_a = audio.onEnded) == null ? void 0 : _a.call(audio, () => cleanup());
    (_b = audio.onStop) == null ? void 0 : _b.call(audio, () => cleanup());
    (_c = audio.onError) == null ? void 0 : _c.call(audio, () => cleanup());
    try {
      audio.play();
      globalThis.setTimeout(() => {
        cleanup();
      }, cleanupTimeoutMs);
    } catch (e) {
      cleanup();
    }
  }
  createInnerAudio(source, volume) {
    var _a;
    const wxAudio = getWechatAudioApi();
    const audio = (_a = wxAudio == null ? void 0 : wxAudio.createInnerAudioContext) == null ? void 0 : _a.call(wxAudio);
    if (!audio) {
      return null;
    }
    audio.autoplay = false;
    audio.src = source;
    audio.volume = volume;
    if ("obeyMuteSwitch" in audio) {
      audio.obeyMuteSwitch = false;
    }
    if (!this.primed) {
      this.primed = true;
    }
    return audio;
  }
  cleanupComboVoice(expectedAudio = this.activeComboAudio) {
    if (this.comboCleanupInProgress) {
      return;
    }
    const audio = expectedAudio;
    if (!audio) {
      return;
    }
    this.comboCleanupInProgress = true;
    try {
      if (this.activeComboCleanupTimeoutId !== null) {
        globalThis.clearTimeout(this.activeComboCleanupTimeoutId);
        this.activeComboCleanupTimeoutId = null;
      }
      if (this.activeComboAudio === audio) {
        this.activeComboAudio = null;
      }
      this.disposeInnerAudio(audio);
    } finally {
      this.comboCleanupInProgress = false;
    }
  }
  disposeInnerAudio(audio) {
    var _a, _b;
    try {
      (_a = audio.stop) == null ? void 0 : _a.call(audio);
    } catch (e) {
    }
    try {
      (_b = audio.destroy) == null ? void 0 : _b.call(audio);
    } catch (e) {
    }
  }
};
var SilentBackend = class {
  prime() {
  }
  playPlacement() {
  }
  playInvalid() {
  }
  playCelebration() {
  }
  playComboVoice(_url) {
  }
  stopComboVoice() {
  }
};
function createAudioBackend() {
  const wechatAudio = getWechatAudioApi();
  if (wechatAudio == null ? void 0 : wechatAudio.createInnerAudioContext) {
    return new InnerAudioBackend();
  }
  if (getAudioContextConstructor()) {
    return new WebAudioBackend();
  }
  return new SilentBackend();
}
var FeedbackAudio = class {
  constructor(comboVoiceUrls = {}) {
    __publicField(this, "backend", createAudioBackend());
    __publicField(this, "enabled", true);
    __publicField(this, "comboVoiceUrls");
    this.comboVoiceUrls = comboVoiceUrls;
  }
  prime() {
    if (!this.enabled) {
      return;
    }
    this.backend.prime();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.backend.stopComboVoice();
    }
  }
  playPlacement() {
    if (!this.enabled) {
      return;
    }
    this.backend.playPlacement();
  }
  playInvalid() {
    if (!this.enabled) {
      return;
    }
    this.backend.playInvalid();
  }
  playCelebration() {
    if (!this.enabled) {
      return;
    }
    this.backend.stopComboVoice();
    this.backend.playCelebration();
  }
  playComboVoice(name) {
    if (!this.enabled) {
      return;
    }
    const url = this.comboVoiceUrls[name];
    if (!url) {
      return;
    }
    this.backend.playComboVoice(url);
  }
};

// src/audio/BackgroundMusic.ts
function getWechatAudioApi2() {
  var _a;
  const root = globalThis;
  return (_a = root.wx) != null ? _a : null;
}
var BackgroundMusic = class {
  constructor(source) {
    __publicField(this, "source");
    __publicField(this, "context", null);
    __publicField(this, "enabled", true);
    __publicField(this, "shouldPlay", true);
    __publicField(this, "primed", false);
    this.source = source;
  }
  prime() {
    var _a, _b, _c;
    if (this.primed) {
      return;
    }
    const wxAudio = getWechatAudioApi2();
    if (!(wxAudio == null ? void 0 : wxAudio.createInnerAudioContext)) {
      return;
    }
    const audio = wxAudio.createInnerAudioContext();
    audio.autoplay = false;
    audio.src = this.source;
    audio.volume = 0.48;
    if ("obeyMuteSwitch" in audio) {
      audio.obeyMuteSwitch = false;
    }
    (_a = audio.onEnded) == null ? void 0 : _a.call(audio, () => {
      var _a2;
      if (!this.enabled || !this.shouldPlay) {
        return;
      }
      try {
        (_a2 = this.context) == null ? void 0 : _a2.play();
      } catch (e) {
      }
    });
    (_b = audio.onStop) == null ? void 0 : _b.call(audio, () => {
      if (this.enabled && this.shouldPlay) {
        return;
      }
    });
    (_c = audio.onError) == null ? void 0 : _c.call(audio, () => {
      if (this.enabled && this.shouldPlay) {
        return;
      }
    });
    this.context = audio;
    this.primed = true;
    this.sync();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    this.shouldPlay = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    this.sync();
  }
  stop() {
    var _a, _b;
    this.shouldPlay = false;
    if (!this.context) {
      return;
    }
    try {
      (_b = (_a = this.context).stop) == null ? void 0 : _b.call(_a);
    } catch (e) {
    }
  }
  dispose() {
    var _a, _b, _c, _d;
    this.shouldPlay = false;
    this.enabled = false;
    if (!this.context) {
      return;
    }
    try {
      (_b = (_a = this.context).stop) == null ? void 0 : _b.call(_a);
    } catch (e) {
    }
    try {
      (_d = (_c = this.context).destroy) == null ? void 0 : _d.call(_c);
    } catch (e) {
    }
    this.context = null;
    this.primed = false;
  }
  sync() {
    if (!this.enabled || !this.shouldPlay || !this.context) {
      return;
    }
    try {
      this.context.play();
    } catch (e) {
    }
  }
};

// src/game/logic.ts
function normalizeRect(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1
  };
}
function rectArea(rect) {
  return rect.width * rect.height;
}
function rectContainsCell(rect, cell) {
  return cell.x >= rect.x && cell.x < rect.x + rect.width && cell.y >= rect.y && cell.y < rect.y + rect.height;
}
function rectsOverlap(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}
function findCluesInRect(level, rect) {
  return level.clues.filter((clue) => rectContainsCell(rect, clue));
}
function isRectInBounds(level, rect) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= level.width && rect.y + rect.height <= level.height;
}
function reason(key, values) {
  return { key, values };
}
function validatePlacement(level, placements, rect) {
  if (!isRectInBounds(level, rect)) {
    return {
      ok: false,
      area: rectArea(rect),
      clue: null,
      reason: reason("logic.validationOutOfBounds")
    };
  }
  const overlappingPlacement = placements.find((placement) => rectsOverlap(placement.rect, rect));
  if (overlappingPlacement) {
    return {
      ok: false,
      area: rectArea(rect),
      clue: null,
      reason: reason("logic.validationOverlap")
    };
  }
  const containedClues = findCluesInRect(level, rect);
  if (containedClues.length !== 1) {
    return {
      ok: false,
      area: rectArea(rect),
      clue: null,
      reason: reason("logic.validationSingleClue")
    };
  }
  const [clue] = containedClues;
  const area = rectArea(rect);
  if (clue.value !== area) {
    return {
      ok: false,
      area,
      clue,
      reason: reason("logic.validationArea", { value: clue.value })
    };
  }
  return {
    ok: true,
    area,
    clue,
    reason: null
  };
}
function getCoveredCellCount(level, placements) {
  const covered = Array.from({ length: level.height }, () => Array(level.width).fill(false));
  for (const placement of placements) {
    for (let dy = 0; dy < placement.rect.height; dy += 1) {
      for (let dx = 0; dx < placement.rect.width; dx += 1) {
        covered[placement.rect.y + dy][placement.rect.x + dx] = true;
      }
    }
  }
  let count = 0;
  for (const row of covered) {
    for (const cell of row) {
      if (cell) {
        count += 1;
      }
    }
  }
  return count;
}
function clueKey(clue) {
  return `${clue.x},${clue.y}`;
}
function getUnusedClues(level, placements) {
  const usedClueKeys = new Set(placements.map((placement) => clueKey(placement.clue)));
  return level.clues.filter((clue) => !usedClueKeys.has(clueKey(clue)));
}
function getRectKey(rect) {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}
function getFactorPairs(area) {
  const pairs = [];
  for (let width = 1; width <= Math.sqrt(area); width += 1) {
    if (area % width !== 0) {
      continue;
    }
    const height = area / width;
    pairs.push({ width, height });
    if (width !== height) {
      pairs.push({ width: height, height: width });
    }
  }
  return pairs;
}
function getLegalPlacementsForClue(level, placements, clue) {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  for (const { width, height } of getFactorPairs(clue.value)) {
    const startX = clue.x - width + 1;
    const endX = clue.x;
    const startY = clue.y - height + 1;
    const endY = clue.y;
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        const rect = { x, y, width, height };
        const key = getRectKey(rect);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const validation = validatePlacement(level, placements, rect);
        if (!validation.ok || !validation.clue) {
          continue;
        }
        candidates.push({
          rect,
          clue: validation.clue,
          area: validation.area,
          candidateCount: 0
        });
      }
    }
  }
  candidates.sort((a, b) => {
    if (a.rect.y !== b.rect.y) {
      return a.rect.y - b.rect.y;
    }
    if (a.rect.x !== b.rect.x) {
      return a.rect.x - b.rect.x;
    }
    if (a.rect.height !== b.rect.height) {
      return a.rect.height - b.rect.height;
    }
    return a.rect.width - b.rect.width;
  });
  return candidates;
}
function findHintSuggestion(level, placements) {
  const unusedClues = getUnusedClues(level, placements);
  let bestSuggestion = null;
  for (const clue of unusedClues) {
    const candidates = getLegalPlacementsForClue(level, placements, clue);
    if (candidates.length === 0) {
      continue;
    }
    const [firstCandidate] = candidates;
    const suggestion = {
      ...firstCandidate,
      candidateCount: candidates.length
    };
    if (!bestSuggestion || suggestion.candidateCount < bestSuggestion.candidateCount) {
      bestSuggestion = suggestion;
      continue;
    }
    if (bestSuggestion && suggestion.candidateCount === bestSuggestion.candidateCount && clue.value < bestSuggestion.clue.value) {
      bestSuggestion = suggestion;
    }
  }
  return bestSuggestion;
}
function isBoardSolved(level, placements) {
  var _a;
  if (placements.length === 0) {
    return false;
  }
  const covered = Array.from({ length: level.height }, () => Array(level.width).fill(false));
  const clueHits = /* @__PURE__ */ new Map();
  for (const clue of level.clues) {
    clueHits.set(`${clue.x},${clue.y}`, 0);
  }
  for (const placement of placements) {
    const validation = validatePlacement(
      level,
      placements.filter((candidate) => candidate.id !== placement.id),
      placement.rect
    );
    if (!validation.ok) {
      return false;
    }
    for (let dy = 0; dy < placement.rect.height; dy += 1) {
      for (let dx = 0; dx < placement.rect.width; dx += 1) {
        const x = placement.rect.x + dx;
        const y = placement.rect.y + dy;
        if (covered[y][x]) {
          return false;
        }
        covered[y][x] = true;
      }
    }
    const clueKey2 = `${placement.clue.x},${placement.clue.y}`;
    clueHits.set(clueKey2, ((_a = clueHits.get(clueKey2)) != null ? _a : 0) + 1);
  }
  for (const row of covered) {
    for (const cell of row) {
      if (!cell) {
        return false;
      }
    }
  }
  for (const hits of clueHits.values()) {
    if (hits !== 1) {
      return false;
    }
  }
  return true;
}

// src/game/game-controller.constants.ts
var COMBO_GOOD_THRESHOLD = 3;
var COMBO_GREAT_THRESHOLD = 4;
var COMBO_NICE_THRESHOLD = 5;
var COMBO_AMAZING_THRESHOLD = 7;

// src/game/GameController.ts
var GameController = class {
  constructor(levels2, options = {}) {
    __publicField(this, "levels");
    __publicField(this, "listeners", /* @__PURE__ */ new Set());
    __publicField(this, "onRecordsChange");
    __publicField(this, "onProgressChange");
    __publicField(this, "levelIndex", 0);
    __publicField(this, "placements", []);
    __publicField(this, "selectedPlacementId", null);
    __publicField(this, "history", []);
    __publicField(this, "preview", null);
    __publicField(this, "hintSuggestion", null);
    __publicField(this, "hintMessage", null);
    __publicField(this, "dragOrigin", null);
    __publicField(this, "records");
    __publicField(this, "mode", "play");
    __publicField(this, "comboCount", 0);
    __publicField(this, "effects", {
      placement: null,
      invalidId: 0,
      celebrationId: 0,
      comboVoice: null
    });
    __publicField(this, "status", { key: "status.baseInstruction" });
    __publicField(this, "solved", false);
    __publicField(this, "placementSequence", 0);
    __publicField(this, "attemptStartedAt", Date.now());
    var _a;
    this.levels = levels2;
    this.records = options.initialRecords ? this.cloneRecords(options.initialRecords) : {};
    this.onRecordsChange = options.onRecordsChange;
    this.onProgressChange = options.onProgressChange;
    this.restoreInitialProgress((_a = options.initialProgress) != null ? _a : null);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }
  getSnapshot() {
    var _a;
    return {
      levelIndex: this.levelIndex,
      level: this.level,
      placements: [...this.placements],
      selectedPlacementId: this.selectedPlacementId,
      preview: this.preview,
      hintSuggestion: this.hintSuggestion,
      hintMessage: this.hintMessage,
      mode: this.mode,
      currentRecord: (_a = this.records[this.level.id]) != null ? _a : null,
      records: this.records,
      effects: this.effects,
      comboCount: this.comboCount,
      status: this.status,
      solved: this.solved,
      canUndo: this.history.length > 0,
      hasNextLevel: this.levelIndex < this.levels.length - 1
    };
  }
  startDrag(cell) {
    if (this.mode === "record") {
      return;
    }
    this.selectedPlacementId = null;
    this.dragOrigin = cell;
    this.clearHintSuggestion();
    this.updateDrag(cell);
  }
  updateDrag(cell) {
    var _a;
    if (!this.dragOrigin || this.mode === "record") {
      return;
    }
    const rect = normalizeRect(this.dragOrigin, cell);
    const validation = validatePlacement(this.level, this.placements, rect);
    this.preview = {
      start: this.dragOrigin,
      end: cell,
      rect,
      validation
    };
    if (validation.ok) {
      this.status = { key: "status.previewValid", values: { area: validation.area } };
    } else {
      this.status = (_a = validation.reason) != null ? _a : { key: "status.invalidGeneric" };
    }
    this.emit();
    this.persistProgress();
  }
  finishDrag() {
    var _a;
    if (this.mode === "record") {
      return;
    }
    if (!this.preview) {
      this.dragOrigin = null;
      return;
    }
    if (this.preview.validation.ok && this.preview.validation.clue) {
      this.history.push(this.clonePlacements(this.placements));
      this.placements = [
        ...this.placements,
        {
          id: `placement-${this.placementSequence}`,
          rect: this.preview.rect,
          clue: this.preview.validation.clue,
          area: this.preview.validation.area
        }
      ];
      const latestPlacementId = `placement-${this.placementSequence}`;
      this.placementSequence += 1;
      this.comboCount += 1;
      const solved = isBoardSolved(this.level, this.placements);
      if (solved) {
        this.solved = true;
        const record = this.saveCompletionRecord();
        const comboVoice = this.resolveComboVoice(this.comboCount);
        this.effects = {
          placement: {
            id: this.effects.placement ? this.effects.placement.id + 1 : 1,
            placementId: latestPlacementId
          },
          invalidId: this.effects.invalidId,
          celebrationId: this.effects.celebrationId + 1,
          comboVoice: comboVoice === "amazing" || comboVoice === "prefect" ? null : comboVoice
        };
        this.comboCount = 0;
        this.status = {
          key: "status.solvedWithDuration",
          values: { duration: this.formatDuration(record.durationMs) }
        };
      } else {
        const comboVoice = this.resolveComboVoice(this.comboCount);
        this.effects = {
          placement: {
            id: this.effects.placement ? this.effects.placement.id + 1 : 1,
            placementId: latestPlacementId
          },
          invalidId: this.effects.invalidId,
          celebrationId: this.effects.celebrationId,
          comboVoice
        };
        const covered = getCoveredCellCount(this.level, this.placements);
        this.status = {
          key: "status.coveredProgress",
          values: { covered, total: this.level.width * this.level.height }
        };
      }
    } else {
      this.comboCount = 0;
      this.effects = {
        ...this.effects,
        invalidId: this.effects.invalidId + 1,
        comboVoice: null
      };
      this.status = (_a = this.preview.validation.reason) != null ? _a : { key: "status.invalidGeneric" };
    }
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.emit();
    this.persistProgress();
  }
  cancelDrag() {
    if (this.mode === "record") {
      return;
    }
    if (!this.dragOrigin && !this.preview) {
      return;
    }
    this.dragOrigin = null;
    this.preview = null;
    this.clearHintSuggestion();
    this.status = this.solved ? { key: "status.solvedBoardCovered" } : { key: "status.baseInstruction" };
    this.emit();
  }
  undo() {
    if (this.mode === "record") {
      return;
    }
    const previous = this.history.pop();
    if (!previous) {
      return;
    }
    this.placements = previous;
    this.selectedPlacementId = null;
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.comboCount = 0;
    this.solved = isBoardSolved(this.level, this.placements);
    this.status = this.solved ? { key: "status.solvedBoardCovered" } : { key: "status.undo" };
    this.emit();
    this.persistProgress();
  }
  resetLevel() {
    this.resetInternalState({ key: "status.reset" });
    this.emit();
    this.persistProgress();
  }
  getPlacementAtCell(cell) {
    for (let index = this.placements.length - 1; index >= 0; index -= 1) {
      const placement = this.placements[index];
      const { rect } = placement;
      if (cell.x >= rect.x && cell.x < rect.x + rect.width && cell.y >= rect.y && cell.y < rect.y + rect.height) {
        return placement;
      }
    }
    return null;
  }
  selectPlacement(placementId) {
    if (this.mode === "record") {
      return;
    }
    if (!this.placements.some((placement) => placement.id === placementId)) {
      return;
    }
    if (this.selectedPlacementId === placementId) {
      return;
    }
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.selectedPlacementId = placementId;
    this.emit();
  }
  clearSelectedPlacement() {
    if (!this.selectedPlacementId) {
      return;
    }
    this.selectedPlacementId = null;
    this.emit();
  }
  removeSelectedPlacement() {
    if (this.mode === "record" || !this.selectedPlacementId) {
      return;
    }
    const selectedIndex = this.placements.findIndex(
      (placement) => placement.id === this.selectedPlacementId
    );
    if (selectedIndex < 0) {
      this.selectedPlacementId = null;
      return;
    }
    this.history.push(this.clonePlacements(this.placements));
    this.placements = this.placements.filter((placement) => placement.id !== this.selectedPlacementId);
    this.selectedPlacementId = null;
    this.preview = null;
    this.dragOrigin = null;
    this.comboCount = 0;
    this.clearHintSuggestion();
    this.solved = isBoardSolved(this.level, this.placements);
    this.status = { key: "status.removedPlacement" };
    this.emit();
    this.persistProgress();
  }
  requestHint() {
    if (this.solved) {
      this.hintSuggestion = null;
      this.hintMessage = { key: "hint.solved" };
      this.status = { key: "status.hintSolved" };
      this.emit();
      return;
    }
    this.preview = null;
    this.dragOrigin = null;
    this.selectedPlacementId = null;
    const suggestion = findHintSuggestion(this.level, this.placements);
    this.hintSuggestion = suggestion;
    if (!suggestion) {
      this.hintMessage = { key: "hint.noHint" };
      this.status = { key: "status.noHint" };
      this.emit();
      return;
    }
    this.status = suggestion.candidateCount === 1 ? { key: "status.hintSingle", values: { value: suggestion.clue.value } } : {
      key: "status.hintTryRect",
      values: {
        value: suggestion.clue.value,
        width: suggestion.rect.width,
        height: suggestion.rect.height
      }
    };
    this.hintMessage = suggestion.candidateCount === 1 ? {
      key: "hint.single",
      values: {
        value: suggestion.clue.value,
        rowStart: suggestion.rect.y + 1,
        rowEnd: suggestion.rect.y + suggestion.rect.height,
        colStart: suggestion.rect.x + 1,
        colEnd: suggestion.rect.x + suggestion.rect.width
      }
    } : {
      key: "hint.tryRect",
      values: {
        value: suggestion.clue.value,
        width: suggestion.rect.width,
        height: suggestion.rect.height,
        rowStart: suggestion.rect.y + 1,
        rowEnd: suggestion.rect.y + suggestion.rect.height,
        colStart: suggestion.rect.x + 1,
        colEnd: suggestion.rect.x + suggestion.rect.width
      }
    };
    this.emit();
  }
  nextLevel() {
    if (this.levelIndex >= this.levels.length - 1) {
      this.status = { key: "status.lastLevel" };
      this.emit();
      return;
    }
    this.levelIndex += 1;
    this.resetInternalState({ key: "status.enteredLevel", values: { levelNumber: this.level.number } });
    this.emit();
    this.persistProgress();
  }
  previousLevel() {
    if (this.levelIndex <= 0) {
      return;
    }
    this.levelIndex -= 1;
    this.resetInternalState({ key: "status.enteredLevel", values: { levelNumber: this.level.number } });
    this.emit();
    this.persistProgress();
  }
  setLevel(index) {
    if (index < 0 || index >= this.levels.length) {
      return;
    }
    this.levelIndex = index;
    this.resetInternalState({ key: "status.enteredLevel", values: { levelNumber: this.level.number } });
    this.emit();
    this.persistProgress();
  }
  viewRecordedLevel(index) {
    if (index < 0 || index >= this.levels.length) {
      return;
    }
    const targetLevel = this.levels[index];
    const record = this.records[targetLevel.id];
    if (!record) {
      this.setLevel(index);
      return;
    }
    this.levelIndex = index;
    this.placements = this.clonePlacements(record.placements);
    this.selectedPlacementId = null;
    this.history = [];
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.mode = "record";
    this.comboCount = 0;
    this.solved = true;
    this.effects = {
      ...this.effects,
      comboVoice: null
    };
    this.status = {
      key: "status.viewingRecord",
      values: { duration: this.formatDuration(record.durationMs) }
    };
    this.emit();
  }
  resetCampaign() {
    var _a;
    this.records = {};
    this.levelIndex = 0;
    this.resetInternalState({
      key: "status.enteredLevel",
      values: { levelNumber: this.level.number }
    });
    (_a = this.onRecordsChange) == null ? void 0 : _a.call(this, {});
    this.emit();
    this.persistProgress();
  }
  isInteractionLocked() {
    return this.mode === "record";
  }
  get level() {
    return this.levels[this.levelIndex];
  }
  emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
  clonePlacements(placements) {
    return placements.map((placement) => ({
      id: placement.id,
      rect: { ...placement.rect },
      clue: { ...placement.clue },
      area: placement.area
    }));
  }
  cloneRecords(records) {
    const cloned = {};
    for (const [levelId, record] of Object.entries(records)) {
      cloned[levelId] = {
        levelId: record.levelId,
        completedAt: record.completedAt,
        durationMs: record.durationMs,
        placements: this.clonePlacements(record.placements)
      };
    }
    return cloned;
  }
  resetInternalState(status) {
    this.placements = [];
    this.selectedPlacementId = null;
    this.history = [];
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.mode = "play";
    this.solved = false;
    this.placementSequence = 0;
    this.comboCount = 0;
    this.attemptStartedAt = Date.now();
    this.effects = {
      ...this.effects,
      placement: null,
      comboVoice: null
    };
    this.status = status;
  }
  clearHintSuggestion() {
    this.hintSuggestion = null;
    this.hintMessage = null;
  }
  saveCompletionRecord() {
    var _a;
    const record = {
      levelId: this.level.id,
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      durationMs: Math.max(0, Date.now() - this.attemptStartedAt),
      placements: this.clonePlacements(this.placements)
    };
    this.records = {
      ...this.records,
      [record.levelId]: record
    };
    (_a = this.onRecordsChange) == null ? void 0 : _a.call(this, this.cloneRecords(this.records));
    return record;
  }
  restoreInitialProgress(progress) {
    if (!progress) {
      return;
    }
    const restoredLevelIndex = this.levels.findIndex((level) => level.id === progress.levelId);
    if (restoredLevelIndex < 0) {
      return;
    }
    this.levelIndex = restoredLevelIndex;
    this.placements = this.clonePlacements(progress.placements);
    this.selectedPlacementId = null;
    this.history = progress.history.map((snapshot) => this.clonePlacements(snapshot));
    this.preview = null;
    this.dragOrigin = null;
    this.hintSuggestion = null;
    this.hintMessage = null;
    this.mode = "play";
    this.placementSequence = progress.placementSequence;
    this.comboCount = 0;
    this.attemptStartedAt = progress.attemptStartedAt;
    this.solved = isBoardSolved(this.level, this.placements);
    const covered = getCoveredCellCount(this.level, this.placements);
    this.status = this.solved ? { key: "status.solvedBoardCovered" } : covered > 0 ? {
      key: "status.coveredProgress",
      values: { covered, total: this.level.width * this.level.height }
    } : { key: "status.baseInstruction" };
  }
  buildSavedProgress() {
    return {
      levelId: this.level.id,
      placements: this.clonePlacements(this.placements),
      history: this.history.map((snapshot) => this.clonePlacements(snapshot)),
      placementSequence: this.placementSequence,
      attemptStartedAt: this.attemptStartedAt
    };
  }
  persistProgress() {
    var _a;
    if (this.mode !== "play") {
      return;
    }
    (_a = this.onProgressChange) == null ? void 0 : _a.call(this, this.buildSavedProgress());
  }
  formatDuration(durationMs) {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1e3));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  resolveComboVoice(comboCount) {
    if (comboCount === COMBO_GOOD_THRESHOLD) {
      return "good";
    }
    if (comboCount === COMBO_GREAT_THRESHOLD) {
      return "great";
    }
    if (comboCount === COMBO_NICE_THRESHOLD) {
      return "nice";
    }
    if (comboCount === COMBO_AMAZING_THRESHOLD) {
      return Math.random() < 0.5 ? "amazing" : "prefect";
    }
    return null;
  }
};

// src/game/levels.ts
var variantTransforms = ["identity", "mirrorX", "mirrorY"];
var templates = [
  {
    titleKey: "level.title.warmup",
    hintKey: "level.hint.warmup",
    width: 4,
    height: 4,
    pieces: [
      { x: 0, y: 0, width: 2, height: 2, clueX: 0, clueY: 0 },
      { x: 2, y: 0, width: 2, height: 1, clueX: 2, clueY: 0 },
      { x: 2, y: 1, width: 2, height: 1, clueX: 3, clueY: 1 },
      { x: 0, y: 2, width: 1, height: 2, clueX: 0, clueY: 2 },
      { x: 1, y: 2, width: 3, height: 2, clueX: 2, clueY: 2 }
    ]
  },
  {
    titleKey: "level.title.cross",
    hintKey: "level.hint.cross",
    width: 5,
    height: 5,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 2, height: 3, clueX: 4, clueY: 1 },
      { x: 2, y: 2, width: 1, height: 1, clueX: 2, clueY: 2 },
      { x: 0, y: 2, width: 2, height: 3, clueX: 0, clueY: 3 },
      { x: 2, y: 3, width: 3, height: 2, clueX: 3, clueY: 4 }
    ]
  },
  {
    titleKey: "level.title.stairs",
    hintKey: "level.hint.stairs",
    width: 6,
    height: 5,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 0, clueY: 1 },
      { x: 3, y: 0, width: 3, height: 2, clueX: 3, clueY: 0 },
      { x: 3, y: 2, width: 2, height: 2, clueX: 4, clueY: 3 },
      { x: 5, y: 2, width: 1, height: 2, clueX: 5, clueY: 2 },
      { x: 0, y: 2, width: 2, height: 2, clueX: 1, clueY: 3 },
      { x: 0, y: 4, width: 6, height: 1, clueX: 2, clueY: 4 },
      { x: 2, y: 2, width: 1, height: 2, clueX: 2, clueY: 3 }
    ]
  },
  {
    titleKey: "level.title.switchback",
    hintKey: "level.hint.switchback",
    width: 6,
    height: 6,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 3, height: 1, clueX: 4, clueY: 0 },
      { x: 3, y: 1, width: 2, height: 3, clueX: 3, clueY: 2 },
      { x: 5, y: 1, width: 1, height: 3, clueX: 5, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 2, clueX: 2, clueY: 3 },
      { x: 0, y: 4, width: 2, height: 2, clueX: 1, clueY: 4 },
      { x: 2, y: 4, width: 4, height: 2, clueX: 4, clueY: 5 }
    ]
  },
  {
    titleKey: "level.title.corridor",
    hintKey: "level.hint.corridor",
    width: 7,
    height: 6,
    pieces: [
      { x: 0, y: 0, width: 2, height: 3, clueX: 0, clueY: 1 },
      { x: 2, y: 0, width: 3, height: 2, clueX: 3, clueY: 0 },
      { x: 5, y: 0, width: 2, height: 1, clueX: 6, clueY: 0 },
      { x: 5, y: 1, width: 2, height: 3, clueX: 5, clueY: 2 },
      { x: 2, y: 2, width: 3, height: 2, clueX: 4, clueY: 3 },
      { x: 0, y: 3, width: 2, height: 3, clueX: 1, clueY: 4 },
      { x: 2, y: 4, width: 3, height: 2, clueX: 2, clueY: 5 },
      { x: 5, y: 4, width: 2, height: 2, clueX: 6, clueY: 5 }
    ]
  },
  {
    titleKey: "level.title.courtyard",
    hintKey: "level.hint.courtyard",
    width: 7,
    height: 7,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 1 },
      { x: 3, y: 0, width: 2, height: 1, clueX: 4, clueY: 0 },
      { x: 5, y: 0, width: 2, height: 3, clueX: 6, clueY: 1 },
      { x: 3, y: 1, width: 2, height: 2, clueX: 3, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 3, clueX: 2, clueY: 3 },
      { x: 3, y: 3, width: 4, height: 2, clueX: 5, clueY: 4 },
      { x: 0, y: 5, width: 2, height: 2, clueX: 0, clueY: 5 },
      { x: 2, y: 5, width: 3, height: 2, clueX: 3, clueY: 6 },
      { x: 5, y: 5, width: 2, height: 2, clueX: 6, clueY: 5 }
    ]
  },
  {
    titleKey: "level.title.bridge",
    hintKey: "level.hint.bridge",
    width: 8,
    height: 6,
    pieces: [
      { x: 0, y: 0, width: 2, height: 2, clueX: 0, clueY: 0 },
      { x: 2, y: 0, width: 3, height: 2, clueX: 3, clueY: 1 },
      { x: 5, y: 0, width: 3, height: 1, clueX: 6, clueY: 0 },
      { x: 5, y: 1, width: 3, height: 2, clueX: 5, clueY: 2 },
      { x: 0, y: 2, width: 2, height: 4, clueX: 1, clueY: 3 },
      { x: 2, y: 2, width: 2, height: 2, clueX: 3, clueY: 2 },
      { x: 4, y: 2, width: 1, height: 4, clueX: 4, clueY: 4 },
      { x: 5, y: 3, width: 3, height: 3, clueX: 7, clueY: 4 },
      { x: 2, y: 4, width: 2, height: 2, clueX: 2, clueY: 5 }
    ]
  },
  {
    titleKey: "level.title.offset",
    hintKey: "level.hint.offset",
    width: 8,
    height: 7,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 3, height: 1, clueX: 5, clueY: 0 },
      { x: 6, y: 0, width: 2, height: 3, clueX: 6, clueY: 1 },
      { x: 3, y: 1, width: 3, height: 2, clueX: 4, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 3, clueX: 2, clueY: 3 },
      { x: 3, y: 3, width: 2, height: 2, clueX: 3, clueY: 4 },
      { x: 5, y: 3, width: 3, height: 2, clueX: 6, clueY: 4 },
      { x: 0, y: 5, width: 2, height: 2, clueX: 0, clueY: 6 },
      { x: 2, y: 5, width: 4, height: 2, clueX: 4, clueY: 5 },
      { x: 6, y: 5, width: 2, height: 2, clueX: 7, clueY: 6 }
    ]
  },
  {
    titleKey: "level.title.ring",
    hintKey: "level.hint.ring",
    width: 8,
    height: 8,
    pieces: [
      { x: 0, y: 0, width: 2, height: 3, clueX: 1, clueY: 1 },
      { x: 2, y: 0, width: 3, height: 2, clueX: 3, clueY: 0 },
      { x: 5, y: 0, width: 3, height: 1, clueX: 7, clueY: 0 },
      { x: 5, y: 1, width: 3, height: 3, clueX: 6, clueY: 2 },
      { x: 2, y: 2, width: 3, height: 2, clueX: 4, clueY: 3 },
      { x: 0, y: 3, width: 2, height: 3, clueX: 0, clueY: 5 },
      { x: 2, y: 4, width: 2, height: 4, clueX: 3, clueY: 6 },
      { x: 4, y: 4, width: 4, height: 2, clueX: 6, clueY: 5 },
      { x: 0, y: 6, width: 2, height: 2, clueX: 1, clueY: 6 },
      { x: 4, y: 6, width: 3, height: 2, clueX: 5, clueY: 7 },
      { x: 7, y: 6, width: 1, height: 2, clueX: 7, clueY: 7 }
    ]
  },
  {
    titleKey: "level.title.endgame",
    hintKey: "level.hint.endgame",
    width: 9,
    height: 8,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 2, height: 3, clueX: 4, clueY: 1 },
      { x: 5, y: 0, width: 4, height: 1, clueX: 7, clueY: 0 },
      { x: 5, y: 1, width: 2, height: 2, clueX: 5, clueY: 2 },
      { x: 7, y: 1, width: 2, height: 2, clueX: 8, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 3, clueX: 2, clueY: 3 },
      { x: 3, y: 3, width: 2, height: 2, clueX: 3, clueY: 4 },
      { x: 5, y: 3, width: 4, height: 2, clueX: 6, clueY: 4 },
      { x: 0, y: 5, width: 2, height: 3, clueX: 1, clueY: 6 },
      { x: 2, y: 5, width: 3, height: 3, clueX: 4, clueY: 6 },
      { x: 5, y: 5, width: 2, height: 3, clueX: 6, clueY: 7 },
      { x: 7, y: 5, width: 2, height: 3, clueX: 8, clueY: 6 }
    ]
  }
];
function transformPiece(piece, width, height, transform) {
  if (transform === "mirrorX") {
    return {
      ...piece,
      x: width - piece.x - piece.width,
      clueX: width - piece.clueX - 1
    };
  }
  if (transform === "mirrorY") {
    return {
      ...piece,
      y: height - piece.y - piece.height,
      clueY: height - piece.clueY - 1
    };
  }
  return { ...piece };
}
function buildClues(pieces) {
  return pieces.map((piece) => ({
    x: piece.clueX,
    y: piece.clueY,
    value: piece.width * piece.height
  }));
}
function assertValidTemplate(template) {
  const occupied = Array.from({ length: template.height }, () => Array(template.width).fill(0));
  for (const piece of template.pieces) {
    if (piece.x < 0 || piece.y < 0 || piece.x + piece.width > template.width || piece.y + piece.height > template.height) {
      throw new Error(`Template "${template.titleKey}" has an out-of-bounds rectangle.`);
    }
    if (piece.clueX < piece.x || piece.clueX >= piece.x + piece.width || piece.clueY < piece.y || piece.clueY >= piece.y + piece.height) {
      throw new Error(`Template "${template.titleKey}" has a clue outside its rectangle.`);
    }
    for (let dy = 0; dy < piece.height; dy += 1) {
      for (let dx = 0; dx < piece.width; dx += 1) {
        occupied[piece.y + dy][piece.x + dx] += 1;
      }
    }
  }
  for (const row of occupied) {
    for (const cell of row) {
      if (cell !== 1) {
        throw new Error(`Template "${template.titleKey}" does not cover the board exactly once.`);
      }
    }
  }
}
templates.forEach(assertValidTemplate);
var levels = templates.flatMap(
  (template, templateIndex) => variantTransforms.map((transform, variantIndex) => {
    const pieces = template.pieces.map(
      (piece) => transformPiece(piece, template.width, template.height, transform)
    );
    const number = templateIndex * 3 + variantIndex + 1;
    return {
      id: `level-${String(number).padStart(2, "0")}`,
      number,
      titleKey: template.titleKey,
      hintKey: template.hintKey,
      width: template.width,
      height: template.height,
      clues: buildClues(pieces)
    };
  })
);

// src/i18n.ts
var messages = {
  "zh-CN": {
    "locale.label": "语言",
    "locale.name.zh-CN": "中文",
    "locale.name.en-US": "English",
    "app.eyebrow": "",
    "app.title": "填满格子",
    "app.heroCopy": "拖拽生成矩形，让每个矩形只包含一个数字，并且面积等于该数字。",
    "home.subtitle": "把棋盘完整填满，让每个数字恰好对应一个矩形。",
    "home.progress": "已完成 {completed} / {total} 关",
    "home.currentLevel": "当前进度：第 {level} 关",
    "home.continue": "继续挑战",
    "home.start": "从第一关开始",
    "home.resumeTip": "会恢复你上次的局面，并保留已通关记录。",
    "home.freshTip": "会从第 1 关重新开始当前进度，已通关记录会保留。",
    "landing.weeklyLeaderboard": "本周排行榜",
    "landing.localWeeklyNote": "当前展示的是本机本周通关总用时排行。",
    "landing.emptyLeaderboard": "本周还没有完整通关记录，先开始一局吧。",
    "landing.bestTime": "总用时 {duration}",
    "landing.completedAt": "完成于 {completedAt}",
    "landing.close": "点击空白处返回",
    "landing.helpTitle": "玩法说明",
    "landing.goalTitle": "通关目标",
    "landing.ruleSection": "基本规则",
    "landing.goalSection": "目标说明",
    "landing.toolSection": "辅助功能",
    "landing.helpRule1": "在棋盘上拖拽生成一个矩形区域。",
    "landing.helpRule2": "每个矩形必须恰好包含一个数字提示。",
    "landing.helpRule3": "矩形面积必须等于它所包含数字的值。",
    "landing.helpRule4": "所有格子都要被完整覆盖，不能重叠，也不能遗漏。",
    "landing.goalRule1": "每一关都要用合法矩形完整填满棋盘才算通关。",
    "landing.goalRule2": "从第 1 关开始连续完成全部关卡后，才会记录本次总用时。",
    "landing.goalRule3": "本周排行榜按完整通关总用时排序，用时越短排名越靠前。",
    "landing.toolHint": "提示：推荐当前局面中的一个可放置合法矩形。",
    "landing.toolUndo": "撤销：回退上一步操作，方便重新推理。",
    "landing.toolRestart": "重开：清空当前关卡并重新开始挑战。",
    "landing.gotIt": "我知道了",
    "settings.title": "设置",
    "settings.sound": "声音",
    "settings.vibration": "震动",
    "settings.vibrationUnavailable": "当前浏览器不支持震动反馈。",
    "settings.backHome": "回到主页",
    "settings.close": "关闭",
    "settings.continue": "继续游戏",
    "section.levels": "关卡",
    "section.hints": "提示",
    "section.record": "本关记录",
    "section.progress": "当前进度",
    "section.actions": "操作",
    "section.rules": "规则",
    "button.undo": "撤销",
    "button.restart": "重开",
    "button.retry": "重新挑战",
    "button.hint": "提示",
    "button.next": "下一关",
    "rule.area": "矩形面积必须等于其包含数字的值",
    "rule.singleClue": "每个矩形只能包含一个数字",
    "rule.cover": "所有格子必须被完整覆盖，不能重叠",
    "rule.input": "桌面可鼠标拖拽，移动端可触摸拖拽",
    "fallback.unknownTime": "时间未知",
    "record.noneSummary": "尚未完成这一关。",
    "record.noneDetail": "完成后会记录通关用时和当时的解法。",
    "record.summary": "最近通关用时：{duration}",
    "record.detailViewing": "正在查看已保存解法，共 {count} 个矩形，完成于 {completedAt}。",
    "record.detailSaved": "已记录 {count} 个矩形的解法，完成于 {completedAt}。点击关卡格子可直接查看。",
    "level.progress": "第 {current} / {total} 关",
    "level.name": "第 {number} 关 · {title}",
    "level.collectionMeta": "已完成 {completed} / {total} 关。点击已完成关卡可直接查看记录。",
    "board.meta": "{width} × {height} · {clues} 个数字",
    "hint.placeholder": "点击“提示”后，这里会显示当前局面的一步建议。",
    "coverage.play": "已覆盖 {covered} / {total} 格",
    "coverage.record": "记录解法覆盖 {covered} / {total} 格",
    "chip.record": "查看记录",
    "chip.solved": "已完成",
    "chip.ready": "就绪",
    "chip.active": "进行中",
    "tile.completed": "{levelName}，已完成，用时 {duration}",
    "tile.incomplete": "{levelName}，未完成",
    "tile.locked": "{levelName}，尚未解锁",
    "aria.quickActions": "快捷操作",
    "aria.gameInformation": "游戏信息",
    "aria.gameBoard": "填满格子棋盘",
    "aria.gameActions": "游戏操作",
    "aria.closeDialog": "关闭弹层",
    "renderer.badgeSolved": "通关",
    "renderer.badgeRecord": "记录",
    "banner.nextLevel": "即将进入下一关",
    "banner.allCleared": "全部关卡完成",
    "status.baseInstruction": "拖拽创建矩形，让每块面积等于其数字。",
    "status.previewValid": "可放置：面积 {area}",
    "status.invalidGeneric": "当前矩形不合法",
    "status.selectedPlacement": "已选中一个矩形，点击红叉可删除。",
    "status.removedPlacement": "已移除这个矩形",
    "status.solvedWithDuration": "通关成功，用时 {duration}。",
    "status.coveredProgress": "已覆盖 {covered} / {total} 格",
    "status.solvedBoardCovered": "通关成功，棋盘已完整覆盖。",
    "status.undo": "已撤销上一步",
    "status.reset": "已重开当前关卡",
    "status.hintSolved": "当前关卡已经通关，无需提示。",
    "status.noHint": "当前局面没有可推荐的合法矩形，可以尝试撤销或重开。",
    "status.hintSingle": "提示：数字 {value} 目前只剩 1 种合法矩形。",
    "status.hintTryRect": "提示：试试围绕数字 {value} 放置一个 {width}×{height} 的矩形。",
    "status.lastLevel": "已经是最后一关",
    "status.enteredLevel": "已进入第 {levelNumber} 关",
    "status.viewingRecord": "正在查看通关记录，用时 {duration}。",
    "hint.solved": "当前关卡已经通关，不需要额外提示。",
    "hint.noHint": "当前局面没有可推荐的合法矩形，可以尝试撤销上一步或直接重开本关。",
    "hint.single": "推荐先看数字 {value}。它在当前局面只剩 1 个合法矩形，位置覆盖第 {rowStart} 行到第 {rowEnd} 行、第 {colStart} 列到第 {colEnd} 列。",
    "hint.tryRect": "推荐围绕数字 {value} 放置一个 {width}×{height} 的合法矩形。它覆盖第 {rowStart} 行到第 {rowEnd} 行、第 {colStart} 列到第 {colEnd} 列。",
    "logic.validationOutOfBounds": "矩形必须完整落在棋盘内",
    "logic.validationOverlap": "矩形不能与已放置区域重叠",
    "logic.validationSingleClue": "每个矩形必须恰好包含一个数字",
    "logic.validationArea": "矩形面积需要等于数字 {value}",
    "level.title.warmup": "热身",
    "level.title.cross": "十字",
    "level.title.stairs": "阶梯",
    "level.title.switchback": "折返",
    "level.title.corridor": "回廊",
    "level.title.courtyard": "中庭",
    "level.title.bridge": "长桥",
    "level.title.offset": "错层",
    "level.title.ring": "环带",
    "level.title.endgame": "终局",
    "level.hint.warmup": "先找面积为 6 的大块，再看剩余的小矩形。",
    "level.hint.cross": "注意中间的小数字，它通常能快速收窄候选矩形。",
    "level.hint.stairs": "把边缘的长条先定下来，会更容易看清中间结构。",
    "level.hint.switchback": "6、8 这类大数字很适合先观察可以延伸到哪些边界。",
    "level.hint.corridor": "试着先定位那些只能贴着边界摆放的大矩形。",
    "level.hint.courtyard": "中部的大矩形会强烈约束四角区域，别只盯着单个数字。",
    "level.hint.bridge": "横向和纵向的长条会互相卡位，观察它们的交界最有效。",
    "level.hint.offset": "这一组里 8、9 这样的数字可能是整片结构的主心骨。",
    "level.hint.ring": "大面积矩形和边角小块会互相限制，优先找“只能这样放”的一块。",
    "level.hint.endgame": "先定位最受边界约束的大块，再利用剩余空间反推其他矩形。"
  },
  "en-US": {
    "locale.label": "Language",
    "locale.name.zh-CN": "中文",
    "locale.name.en-US": "English",
    "app.eyebrow": "",
    "app.title": "Fill Grid",
    "app.heroCopy": "Drag to create rectangles. Each rectangle must contain exactly one number and match its area.",
    "home.subtitle": "Cover the whole board so each clue belongs to exactly one matching rectangle.",
    "home.progress": "{completed} / {total} levels cleared",
    "home.currentLevel": "Current progress: Level {level}",
    "home.continue": "Continue",
    "home.start": "Start From 1",
    "home.resumeTip": "Resume your previous board and keep all cleared records.",
    "home.freshTip": "Restart the current run from level 1 while keeping cleared records.",
    "landing.weeklyLeaderboard": "Weekly Leaderboard",
    "landing.localWeeklyNote": "This leaderboard currently shows this device's weekly total clear times.",
    "landing.emptyLeaderboard": "No full clear has been recorded this week yet. Start a new run first.",
    "landing.bestTime": "Total time {duration}",
    "landing.completedAt": "Completed at {completedAt}",
    "landing.close": "Tap outside to return",
    "landing.helpTitle": "How To Play",
    "landing.goalTitle": "Goals",
    "landing.ruleSection": "Basic Rules",
    "landing.goalSection": "Clear Goals",
    "landing.toolSection": "Support Tools",
    "landing.helpRule1": "Drag on the board to create a rectangle.",
    "landing.helpRule2": "Each rectangle must contain exactly one clue number.",
    "landing.helpRule3": "The rectangle area must equal the value of that clue.",
    "landing.helpRule4": "Cover the whole board with no overlap and no empty cells.",
    "landing.goalRule1": "You clear a level only after the whole board is covered legally.",
    "landing.goalRule2": "A full run is recorded only after you finish every level from level 1 onward.",
    "landing.goalRule3": "The weekly leaderboard ranks full-run total times. Shorter time ranks higher.",
    "landing.toolHint": "Hint: suggests one legal rectangle for the current position.",
    "landing.toolUndo": "Undo: step back one move and rethink the board.",
    "landing.toolRestart": "Restart: clear the current level and begin it again.",
    "landing.gotIt": "Got it",
    "settings.title": "Settings",
    "settings.sound": "Sound",
    "settings.vibration": "Vibration",
    "settings.vibrationUnavailable": "Vibration feedback is not supported in this browser.",
    "settings.backHome": "Back Home",
    "settings.close": "Close",
    "settings.continue": "Continue",
    "section.levels": "Levels",
    "section.hints": "Hint",
    "section.record": "Level Record",
    "section.progress": "Progress",
    "section.actions": "Actions",
    "section.rules": "Rules",
    "button.undo": "Undo",
    "button.restart": "Restart",
    "button.retry": "Retry",
    "button.hint": "Hint",
    "button.next": "Next",
    "rule.area": "A rectangle area must equal the number it contains",
    "rule.singleClue": "Each rectangle may contain exactly one number",
    "rule.cover": "The whole board must be covered with no overlap",
    "rule.input": "Mouse drag on desktop, touch drag on mobile",
    "fallback.unknownTime": "Unknown time",
    "record.noneSummary": "This level is not completed yet.",
    "record.noneDetail": "Completion time and the solved layout will be saved after you clear it.",
    "record.summary": "Best clear shown here: {duration}",
    "record.detailViewing": "Viewing the saved solution with {count} rectangles, completed at {completedAt}.",
    "record.detailSaved": "Saved solution with {count} rectangles, completed at {completedAt}. Click the level tile to review it.",
    "level.progress": "Level {current} / {total}",
    "level.name": "Level {number} · {title}",
    "level.collectionMeta": "{completed} / {total} levels completed. Click a cleared tile to review its record.",
    "board.meta": "{width} × {height} · {clues} clues",
    "hint.placeholder": 'Click "Hint" to reveal one suggested move for the current board state.',
    "coverage.play": "{covered} / {total} cells covered",
    "coverage.record": "Saved solution covers {covered} / {total} cells",
    "chip.record": "Record",
    "chip.solved": "Solved",
    "chip.ready": "Ready",
    "chip.active": "Active",
    "tile.completed": "{levelName}, solved in {duration}",
    "tile.incomplete": "{levelName}, not solved yet",
    "tile.locked": "{levelName}, locked",
    "aria.quickActions": "Quick actions",
    "aria.gameInformation": "Game information",
    "aria.gameBoard": "Fill Grid game board",
    "aria.gameActions": "Game actions",
    "aria.closeDialog": "Close dialog",
    "renderer.badgeSolved": "Solved",
    "renderer.badgeRecord": "Record",
    "banner.nextLevel": "Next level incoming",
    "banner.allCleared": "All levels cleared",
    "status.baseInstruction": "Drag to create rectangles whose areas match their numbers.",
    "status.previewValid": "Valid placement: area {area}",
    "status.invalidGeneric": "This rectangle is not valid",
    "status.selectedPlacement": "Rectangle selected. Tap the red X to remove it.",
    "status.removedPlacement": "Removed the selected rectangle",
    "status.solvedWithDuration": "Solved in {duration}.",
    "status.coveredProgress": "{covered} / {total} cells covered",
    "status.solvedBoardCovered": "Solved. The whole board is covered.",
    "status.undo": "Undid the last move",
    "status.reset": "Restarted the current level",
    "status.hintSolved": "This level is already solved, so no hint is needed.",
    "status.noHint": "No recommended legal rectangle is available right now. Try undo or restart.",
    "status.hintSingle": "Hint: clue {value} has only one legal rectangle left.",
    "status.hintTryRect": "Hint: try a {width}×{height} rectangle around clue {value}.",
    "status.lastLevel": "This is already the final level",
    "status.enteredLevel": "Entered level {levelNumber}",
    "status.viewingRecord": "Viewing the saved record, clear time {duration}.",
    "hint.solved": "This level is already solved, so no extra hint is needed.",
    "hint.noHint": "There is no recommended legal rectangle for this position. Try undoing or restarting the level.",
    "hint.single": "Start with clue {value}. It has only one legal rectangle left: rows {rowStart}-{rowEnd}, columns {colStart}-{colEnd}.",
    "hint.tryRect": "Try a legal {width}×{height} rectangle around clue {value}. It covers rows {rowStart}-{rowEnd}, columns {colStart}-{colEnd}.",
    "logic.validationOutOfBounds": "The rectangle must stay entirely inside the board",
    "logic.validationOverlap": "The rectangle cannot overlap an existing placement",
    "logic.validationSingleClue": "Each rectangle must contain exactly one clue",
    "logic.validationArea": "The rectangle area must equal clue {value}",
    "level.title.warmup": "Warmup",
    "level.title.cross": "Crossroads",
    "level.title.stairs": "Stairs",
    "level.title.switchback": "Switchback",
    "level.title.corridor": "Corridor",
    "level.title.courtyard": "Courtyard",
    "level.title.bridge": "Bridge",
    "level.title.offset": "Offset",
    "level.title.ring": "Ring",
    "level.title.endgame": "Endgame",
    "level.hint.warmup": "Find the large area-6 block first, then clean up the remaining small rectangles.",
    "level.hint.cross": "The small center clue is a strong anchor and quickly narrows the options.",
    "level.hint.stairs": "Lock in the long edge strips first and the middle shape becomes easier to read.",
    "level.hint.switchback": "Large values like 6 and 8 are easiest when you check how far they can extend to the borders.",
    "level.hint.corridor": "Start with the large rectangles that can only fit against the outer boundary.",
    "level.hint.courtyard": "The central large rectangle strongly constrains the corners, so look at the whole shape.",
    "level.hint.bridge": "Long horizontal and vertical strips block each other, so inspect their intersections.",
    "level.hint.offset": "Large values like 8 and 9 often act as the structural anchors of the whole board.",
    "level.hint.ring": "Large blocks and corner pieces constrain each other. Find the one that can only fit one way.",
    "level.hint.endgame": "Fix the large edge-constrained blocks first, then use the remaining space to infer the rest."
  }
};
function detectLocale() {
  if (typeof navigator === "undefined") {
    return "zh-CN";
  }
  const preferred = navigator.language;
  if (preferred.startsWith("zh")) {
    return "zh-CN";
  }
  return "en-US";
}
function t(locale, key, values = {}) {
  var _a;
  const template = (_a = messages[locale][key]) != null ? _a : messages["zh-CN"][key];
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = values[token];
    return value === void 0 ? `{${token}}` : String(value);
  });
}
function tm(locale, message) {
  return t(locale, message.key, message.values);
}
function formatLevelName(locale, levelNumber, titleKey) {
  return t(locale, "level.name", {
    number: levelNumber,
    title: t(locale, titleKey)
  });
}
function formatLocaleDate(locale, isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

// src/input/WechatPointerInputSource.ts
function readTouchPoint(event) {
  var _a, _b, _c, _d, _e, _f, _g;
  const touch = (_c = (_a = event.touches) == null ? void 0 : _a[0]) != null ? _c : (_b = event.changedTouches) == null ? void 0 : _b[0];
  if (!touch) {
    return null;
  }
  const x = (_e = (_d = touch.clientX) != null ? _d : touch.x) != null ? _e : touch.pageX;
  const y = (_g = (_f = touch.clientY) != null ? _f : touch.y) != null ? _g : touch.pageY;
  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }
  return { x, y };
}
function toPointerSample(event) {
  const point = readTouchPoint(event);
  if (!point) {
    return null;
  }
  return {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    pointerType: "touch",
    clientX: point.x,
    clientY: point.y
  };
}
var WechatPointerInputSource = class {
  bind(handlers) {
    wx.onTouchStart((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerStart(sample);
      }
    });
    wx.onTouchMove((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerMove(sample);
      }
    });
    wx.onTouchEnd((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerEnd(sample);
      }
    });
    wx.onTouchCancel((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerCancel(sample);
      }
    });
  }
};

// src/input/PointerController.ts
var PointerController = class {
  constructor(inputSource, surface, renderer, game, options = {}) {
    __publicField(this, "renderer");
    __publicField(this, "game");
    __publicField(this, "surface");
    __publicField(this, "shouldIgnoreInput");
    __publicField(this, "activePointerId", null);
    __publicField(this, "handlePointerStart", (sample) => {
      var _a;
      if (this.game.isInteractionLocked() || this.shouldIgnoreInput()) {
        return;
      }
      if (!sample.isPrimary) {
        return;
      }
      if (sample.pointerType === "mouse" && sample.button !== 0) {
        return;
      }
      const point = this.toSurfacePoint(sample.clientX, sample.clientY);
      if (!point) {
        return;
      }
      const cell = this.renderer.getCellFromSurfacePoint(point);
      if (!cell) {
        this.game.clearSelectedPlacement();
        return;
      }
      const snapshot = this.game.getSnapshot();
      const selectedPlacement = snapshot.selectedPlacementId ? (_a = snapshot.placements.find((placement2) => placement2.id === snapshot.selectedPlacementId)) != null ? _a : null : null;
      if (selectedPlacement && this.renderer.isPlacementDeleteBadgeHit(point, selectedPlacement)) {
        this.game.removeSelectedPlacement();
        return;
      }
      const placement = this.game.getPlacementAtCell(cell);
      if (placement) {
        this.game.selectPlacement(placement.id);
        return;
      }
      this.activePointerId = sample.pointerId;
      this.game.startDrag(cell);
    });
    __publicField(this, "handlePointerMove", (sample) => {
      if (this.shouldIgnoreInput()) {
        return;
      }
      if (sample.pointerId !== this.activePointerId) {
        const point2 = this.toSurfacePoint(sample.clientX, sample.clientY);
        if (!point2) {
          this.game.clearSelectedPlacement();
          return;
        }
        const cell2 = this.renderer.getCellFromSurfacePoint(point2);
        if (!cell2) {
          this.game.clearSelectedPlacement();
          return;
        }
        const placement = this.game.getPlacementAtCell(cell2);
        if (placement) {
          this.game.selectPlacement(placement.id);
        } else {
          this.game.clearSelectedPlacement();
        }
        return;
      }
      const point = this.toSurfacePoint(sample.clientX, sample.clientY);
      if (!point) {
        return;
      }
      const cell = this.renderer.getCellFromSurfacePoint(point, true);
      if (!cell) {
        return;
      }
      this.game.updateDrag(cell);
    });
    __publicField(this, "handlePointerEnd", (sample) => {
      if (sample.pointerId !== this.activePointerId) {
        return;
      }
      this.activePointerId = null;
      this.game.finishDrag();
    });
    __publicField(this, "handlePointerCancel", (sample) => {
      if (sample.pointerId !== this.activePointerId) {
        return;
      }
      this.activePointerId = null;
      this.game.cancelDrag();
    });
    var _a;
    this.surface = surface;
    this.renderer = renderer;
    this.game = game;
    this.shouldIgnoreInput = (_a = options.shouldIgnoreInput) != null ? _a : () => false;
    inputSource.bind({
      onPointerStart: this.handlePointerStart,
      onPointerMove: this.handlePointerMove,
      onPointerEnd: this.handlePointerEnd,
      onPointerCancel: this.handlePointerCancel
    });
  }
  toSurfacePoint(clientX, clientY) {
    return this.surface.clientToSurfacePoint(clientX, clientY);
  }
};

// src/render/CanvasRenderer.ts
var PLACEMENT_COLORS = [
  "#ffb9cc",
  "#ffc89f",
  "#ffe76b",
  "#a9efcc",
  "#8fd8ff",
  "#cbc4ff",
  "#ffd1ea"
];
var KAWAII_SELECTION_THEMES = [
  "pink",
  "yellow",
  "green",
  "blue",
  "purple"
];
var KAWAII_SELECTION_PALETTE = {
  pink: {
    start: "rgba(255, 214, 230, 0.70)",
    mid: "rgba(255, 181, 209, 0.56)",
    end: "rgba(255, 157, 193, 0.52)",
    border: "rgba(255, 236, 243, 0.98)",
    shadow: "rgba(232, 130, 172, 0.28)",
    checkerA: "rgba(255, 255, 255, 0.12)",
    checkerB: "rgba(255, 182, 211, 0.08)",
    vector: "#ff9fc8"
  },
  yellow: {
    start: "rgba(255, 239, 176, 0.70)",
    mid: "rgba(255, 220, 122, 0.58)",
    end: "rgba(255, 200, 94, 0.52)",
    border: "rgba(255, 247, 221, 0.98)",
    shadow: "rgba(222, 172, 80, 0.30)",
    checkerA: "rgba(255, 255, 255, 0.12)",
    checkerB: "rgba(255, 217, 135, 0.08)",
    vector: "#ffcc62"
  },
  green: {
    start: "rgba(205, 248, 212, 0.66)",
    mid: "rgba(165, 232, 179, 0.52)",
    end: "rgba(130, 216, 155, 0.48)",
    border: "rgba(239, 255, 241, 0.98)",
    shadow: "rgba(104, 188, 125, 0.28)",
    checkerA: "rgba(255, 255, 255, 0.11)",
    checkerB: "rgba(170, 233, 185, 0.08)",
    vector: "#8ad79c"
  },
  blue: {
    start: "rgba(201, 235, 255, 0.66)",
    mid: "rgba(157, 214, 250, 0.52)",
    end: "rgba(120, 189, 240, 0.48)",
    border: "rgba(239, 249, 255, 0.98)",
    shadow: "rgba(112, 162, 224, 0.28)",
    checkerA: "rgba(255, 255, 255, 0.11)",
    checkerB: "rgba(166, 214, 247, 0.08)",
    vector: "#88c9ff"
  },
  purple: {
    start: "rgba(229, 218, 255, 0.66)",
    mid: "rgba(203, 181, 249, 0.52)",
    end: "rgba(176, 149, 235, 0.48)",
    border: "rgba(247, 241, 255, 0.98)",
    shadow: "rgba(158, 127, 219, 0.30)",
    checkerA: "rgba(255, 255, 255, 0.11)",
    checkerB: "rgba(208, 191, 251, 0.08)",
    vector: "#c4adff"
  }
};
function getNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
var CanvasRenderer = class {
  constructor(surface) {
    __publicField(this, "surface");
    __publicField(this, "context");
    __publicField(this, "metrics", {
      cellSize: 0,
      offsetX: 0,
      offsetY: 0,
      boardWidth: 0,
      boardHeight: 0
    });
    __publicField(this, "placementAnimations", []);
    __publicField(this, "shakeStartedAt", -1);
    __publicField(this, "celebrationStartedAt", -1);
    __publicField(this, "celebrationParticles", []);
    __publicField(this, "lastPlacementEffectId", 0);
    __publicField(this, "lastInvalidEffectId", 0);
    __publicField(this, "lastCelebrationEffectId", 0);
    __publicField(this, "insets", {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    });
    __publicField(this, "backdropImage", null);
    __publicField(this, "theme", "default");
    __publicField(this, "selectionAssets", null);
    this.surface = surface;
    this.context = surface.getContext2D();
  }
  render(snapshot, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const now = getNow();
    const surfaceSize = this.surface.syncSize();
    this.insets = {
      top: (_b = (_a = options.insets) == null ? void 0 : _a.top) != null ? _b : 0,
      right: (_d = (_c = options.insets) == null ? void 0 : _c.right) != null ? _d : 0,
      bottom: (_f = (_e = options.insets) == null ? void 0 : _e.bottom) != null ? _f : 0,
      left: (_h = (_g = options.insets) == null ? void 0 : _g.left) != null ? _h : 0
    };
    this.backdropImage = (_i = options.backdropImage) != null ? _i : null;
    this.theme = (_j = options.theme) != null ? _j : "default";
    this.selectionAssets = (_k = options.selectionAssets) != null ? _k : null;
    this.metrics = this.computeMetrics(snapshot.level, surfaceSize.width, surfaceSize.height);
    this.consumeEffects(snapshot.effects, now);
    this.pruneEffects(now);
    const { level, mode, placements, preview, solved, hintSuggestion, selectedPlacementId } = snapshot;
    const { context } = this;
    const { width, height } = surfaceSize;
    context.clearRect(0, 0, width, height);
    this.drawBackdrop(width, height);
    context.save();
    const shakeOffset = this.getShakeOffset(now);
    context.translate(shakeOffset, 0);
    this.drawBoardSurface();
    this.drawGrid(level);
    if (options.showPlacementFills !== false) {
      this.drawPlacements(placements, now);
    }
    if (hintSuggestion) {
      this.drawHint(hintSuggestion.rect);
    }
    if (preview) {
      this.drawPreview(preview.rect, preview.validation.ok, preview.validation.clue);
    }
    this.drawClues(level, placements);
    const selectedPlacement = (_l = placements.find((placement) => placement.id === selectedPlacementId)) != null ? _l : null;
    if (selectedPlacement) {
      this.drawSelectedPlacement(selectedPlacement);
    }
    context.restore();
    if (solved) {
      this.drawSolvedBadge(
        mode === "record" ? options.labels.recordBadge : options.labels.solvedBadge
      );
    }
    this.drawCelebration(now);
  }
  hasActiveEffects() {
    return this.placementAnimations.length > 0 || this.shakeStartedAt >= 0 || this.celebrationStartedAt >= 0;
  }
  getBoardSurfaceRect() {
    return {
      x: this.metrics.offsetX,
      y: this.metrics.offsetY,
      width: this.metrics.boardWidth,
      height: this.metrics.boardHeight
    };
  }
  getSurfaceRectForGridRect(rect) {
    return this.getSurfaceRect(rect);
  }
  getCellFromSurfacePoint(point, clamp = false) {
    const localX = point.x;
    const localY = point.y;
    if (this.metrics.cellSize <= 0) {
      return null;
    }
    if (!clamp) {
      if (localX < this.metrics.offsetX || localY < this.metrics.offsetY || localX >= this.metrics.offsetX + this.metrics.boardWidth || localY >= this.metrics.offsetY + this.metrics.boardHeight) {
        return null;
      }
    }
    const boundedX = clamp ? Math.min(
      Math.max(localX, this.metrics.offsetX),
      this.metrics.offsetX + this.metrics.boardWidth - 1
    ) : localX;
    const boundedY = clamp ? Math.min(
      Math.max(localY, this.metrics.offsetY),
      this.metrics.offsetY + this.metrics.boardHeight - 1
    ) : localY;
    return {
      x: Math.floor((boundedX - this.metrics.offsetX) / this.metrics.cellSize),
      y: Math.floor((boundedY - this.metrics.offsetY) / this.metrics.cellSize)
    };
  }
  isPlacementDeleteBadgeHit(point, placement) {
    const badgeRect = this.getPlacementDeleteBadgeRect(placement);
    return point.x >= badgeRect.x && point.x <= badgeRect.x + badgeRect.width && point.y >= badgeRect.y && point.y <= badgeRect.y + badgeRect.height;
  }
  computeMetrics(level, width, height) {
    const basePadding = this.theme === "kawaii" ? Math.max(10, Math.min(width, height) * 0.03) : Math.max(18, Math.min(width, height) * 0.05);
    const availableLeft = basePadding + this.insets.left;
    const availableRight = width - basePadding - this.insets.right;
    const availableTop = basePadding + this.insets.top;
    const availableBottom = height - basePadding - this.insets.bottom;
    const usableWidth = availableRight - availableLeft;
    const usableHeight = availableBottom - availableTop;
    const cellSize = Math.max(24, Math.floor(Math.min(usableWidth / level.width, usableHeight / level.height)));
    const boardWidth = cellSize * level.width;
    const boardHeight = cellSize * level.height;
    const originWidth = Math.max(availableLeft, availableLeft + (usableWidth - boardWidth) / 2);
    const originHeight = Math.max(availableTop, availableTop + (usableHeight - boardHeight) / 2);
    return {
      cellSize,
      offsetX: Math.floor(originWidth),
      offsetY: Math.floor(originHeight),
      boardWidth,
      boardHeight
    };
  }
  drawBackdrop(width, height) {
    if (this.backdropImage) {
      this.drawImageCover(this.backdropImage, 0, 0, width, height);
      this.context.save();
      const veil = this.context.createLinearGradient(0, 0, 0, height);
      veil.addColorStop(0, "rgba(255, 210, 230, 0.08)");
      veil.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
      veil.addColorStop(1, "rgba(196, 231, 255, 0.08)");
      this.context.fillStyle = veil;
      this.context.fillRect(0, 0, width, height);
      this.context.restore();
      return;
    }
    const gradient = this.context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#ff968f");
    gradient.addColorStop(0.48, "#f29ac8");
    gradient.addColorStop(1, "#a9e7ff");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);
    this.drawCloudCluster(width * 0.18, height * 0.15, 0.85);
    this.drawCloudCluster(width * 0.87, height * 0.12, 0.7);
    this.drawCloudCluster(width * 0.12, height * 0.92, 1.1);
    this.drawCloudCluster(width * 0.82, height * 0.95, 0.95);
    this.drawSkySparkles(width, height);
  }
  drawBoardSurface() {
    const { context, metrics } = this;
    const frameInset = this.theme === "kawaii" ? 18 : 14;
    context.save();
    const frameX = metrics.offsetX - frameInset;
    const frameY = metrics.offsetY - frameInset;
    const frameWidth = metrics.boardWidth + frameInset * 2;
    const frameHeight = metrics.boardHeight + frameInset * 2;
    const gradient = context.createLinearGradient(frameX, frameY, frameX, frameY + frameHeight);
    if (this.theme === "kawaii") {
      gradient.addColorStop(0, "rgba(255, 252, 248, 0.97)");
      gradient.addColorStop(1, "rgba(255, 245, 238, 0.92)");
      context.strokeStyle = "rgba(255, 192, 204, 0.92)";
      context.lineWidth = 3;
      context.shadowColor = "rgba(162, 111, 148, 0.26)";
      context.shadowBlur = 28;
      context.shadowOffsetY = 12;
    } else {
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(1, "rgba(234, 249, 255, 0.86)");
      context.strokeStyle = "rgba(255,255,255,0.88)";
      context.lineWidth = 2.8;
      context.shadowColor = "rgba(167, 123, 165, 0.24)";
      context.shadowBlur = 24;
      context.shadowOffsetY = 10;
    }
    context.fillStyle = gradient;
    this.roundRect(frameX, frameY, frameWidth, frameHeight, this.theme === "kawaii" ? 26 : 20);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    if (this.theme === "kawaii") {
      context.save();
      context.setLineDash([6, 5]);
      context.strokeStyle = "rgba(255, 170, 188, 0.88)";
      context.lineWidth = 1.8;
      this.roundRect(frameX + 8, frameY + 8, frameWidth - 16, frameHeight - 16, 22);
      context.stroke();
      context.restore();
    }
    context.restore();
  }
  consumeEffects(effects, now) {
    const placementEffect = effects.placement;
    if (placementEffect && placementEffect.id !== this.lastPlacementEffectId) {
      this.lastPlacementEffectId = placementEffect.id;
      this.startPlacementAnimation(placementEffect, now);
    }
    if (effects.invalidId !== this.lastInvalidEffectId) {
      this.lastInvalidEffectId = effects.invalidId;
      this.shakeStartedAt = now;
    }
    if (effects.celebrationId !== this.lastCelebrationEffectId) {
      this.lastCelebrationEffectId = effects.celebrationId;
      this.startCelebration(now);
    }
  }
  pruneEffects(now) {
    this.placementAnimations = this.placementAnimations.filter(
      (animation) => now - animation.startedAt < 220
    );
    if (this.shakeStartedAt >= 0 && now - this.shakeStartedAt > 260) {
      this.shakeStartedAt = -1;
    }
    if (this.celebrationStartedAt >= 0 && now - this.celebrationStartedAt > 1100) {
      this.celebrationStartedAt = -1;
      this.celebrationParticles = [];
    }
  }
  drawPlacements(placements, now) {
    placements.forEach((placement, index) => {
      if (this.theme === "kawaii") {
        this.drawKawaiiPlacement(placement, index, now);
        return;
      }
      const color = PLACEMENT_COLORS[index % PLACEMENT_COLORS.length];
      const animation = this.placementAnimations.find(
        (candidate) => candidate.placementId === placement.id
      );
      if (!animation) {
        this.fillRect(placement.rect, color, "#5a4c3a", 0.92);
        return;
      }
      const progress = Math.min(1, (now - animation.startedAt) / 220);
      const eased = 1 - (1 - progress) * (1 - progress);
      const scale = 0.94 + eased * 0.06;
      const alpha = 0.35 + eased * 0.57;
      this.fillRectAnimated(placement.rect, color, "#5a4c3a", alpha, scale);
    });
  }
  drawKawaiiPlacement(placement, index, now) {
    const theme = KAWAII_SELECTION_THEMES[index % KAWAII_SELECTION_THEMES.length];
    const animation = this.placementAnimations.find(
      (candidate) => candidate.placementId === placement.id
    );
    const progress = animation ? Math.min(1, (now - animation.startedAt) / 220) : 1;
    const eased = 1 - (1 - progress) * (1 - progress);
    const scale = animation ? 0.94 + eased * 0.06 : 1;
    const alpha = animation ? 0.42 + eased * 0.5 : 0.92;
    const surfaceRect = this.getSurfaceRect(placement.rect);
    const inset = Math.max(4, this.metrics.cellSize * 0.035);
    const rect = {
      x: surfaceRect.x + inset,
      y: surfaceRect.y + inset,
      width: surfaceRect.width - inset * 2,
      height: surfaceRect.height - inset * 2
    };
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    this.context.save();
    this.context.globalAlpha = alpha;
    this.context.translate(centerX, centerY);
    this.context.scale(scale, scale);
    this.context.translate(-centerX, -centerY);
    this.drawKawaiiPlacementSurface(rect, theme, placement);
    this.context.restore();
  }
  drawKawaiiPlacementSurface(rect, theme, placement) {
    var _a;
    const palette = KAWAII_SELECTION_PALETTE[theme];
    const radius = Math.max(18, this.metrics.cellSize * 0.22);
    const innerInset = Math.max(6, this.metrics.cellSize * 0.09);
    const checkerSize = Math.max(16, this.metrics.cellSize * 0.48);
    const highlightHeight = Math.max(20, Math.min(rect.height * 0.32, this.metrics.cellSize * 0.9));
    this.context.save();
    this.context.shadowColor = palette.shadow;
    this.context.shadowBlur = Math.max(18, this.metrics.cellSize * 0.46);
    this.context.shadowOffsetY = Math.max(4, this.metrics.cellSize * 0.06);
    const fill = this.context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    fill.addColorStop(0, palette.start);
    fill.addColorStop(0.52, palette.mid);
    fill.addColorStop(1, palette.end);
    this.context.fillStyle = fill;
    this.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    this.context.fill();
    this.context.restore();
    this.context.save();
    this.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    this.context.clip();
    for (let y = rect.y; y < rect.y + rect.height; y += checkerSize) {
      for (let x = rect.x; x < rect.x + rect.width; x += checkerSize) {
        const offsetIndex = Math.floor((x - rect.x) / checkerSize) + Math.floor((y - rect.y) / checkerSize);
        this.context.fillStyle = offsetIndex % 2 === 0 ? palette.checkerA : palette.checkerB;
        this.context.fillRect(x, y, checkerSize, checkerSize);
      }
    }
    const topGlow = this.context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + highlightHeight);
    topGlow.addColorStop(0, "rgba(255,255,255,0.34)");
    topGlow.addColorStop(1, "rgba(255,255,255,0)");
    this.context.fillStyle = topGlow;
    this.context.fillRect(rect.x, rect.y, rect.width, highlightHeight);
    this.context.globalAlpha = 0.74;
    this.context.fillStyle = "rgba(255,255,255,0.84)";
    this.roundRect(
      rect.x + innerInset * 0.8,
      rect.y + innerInset * 0.65,
      Math.max(28, rect.width * 0.34),
      Math.max(12, highlightHeight * 0.52),
      Math.max(10, highlightHeight * 0.28)
    );
    this.context.fill();
    this.context.restore();
    this.context.save();
    this.context.strokeStyle = palette.border;
    this.context.lineWidth = 2.6;
    this.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    this.context.stroke();
    this.context.restore();
    this.context.save();
    this.context.setLineDash([8, 6]);
    this.context.strokeStyle = "rgba(255,255,255,0.92)";
    this.context.lineWidth = 1.8;
    this.roundRect(
      rect.x + innerInset,
      rect.y + innerInset,
      rect.width - innerInset * 2,
      rect.height - innerInset * 2,
      Math.max(14, radius - innerInset * 0.6)
    );
    this.context.stroke();
    this.context.restore();
    if (theme === "yellow" && placement.rect.width >= 2 && placement.rect.width * placement.rect.height >= 4 && ((_a = this.selectionAssets) == null ? void 0 : _a.dripYellow)) {
      const dripHeight = Math.min(rect.height * 0.23, this.metrics.cellSize * 0.75);
      this.drawImageClipped(
        this.selectionAssets.dripYellow,
        rect.x,
        rect.y + 1,
        rect.width,
        dripHeight,
        radius
      );
    }
    this.drawKawaiiPlacementDecorations(rect, theme, placement);
  }
  drawKawaiiPlacementDecorations(rect, theme, placement) {
    const minSide = Math.min(rect.width, rect.height);
    const baseSize = Math.max(12, Math.min(28, minSide * 0.18));
    const area = placement.rect.width * placement.rect.height;
    const random = this.createPlacementRandom(`${placement.id}:${theme}:${placement.rect.width}x${placement.rect.height}`);
    const specs = [];
    const themeFilter = this.getSelectionImageFilter(theme);
    if (theme === "pink") {
      if (area >= 4) {
        specs.push({ kind: "strawberry", anchor: "tl", size: baseSize * 1.05, alpha: 0.96 });
      }
      specs.push({ kind: "heartPink", anchor: "tr", size: baseSize * 0.9, alpha: 0.88 });
      specs.push({ kind: "bubblePink", anchor: "bl", size: baseSize * 0.9, alpha: 0.84 });
      specs.push({ kind: "sparkleWhite", anchor: "br", size: baseSize * 0.68, alpha: 0.82 });
    } else if (theme === "yellow") {
      specs.push({ kind: "starYellow", anchor: "tl", size: baseSize * 0.95, alpha: 0.9 });
      specs.push({ kind: "heartPink", anchor: "tr", size: baseSize * 0.78, alpha: 0.74 });
      specs.push({ kind: "bubbleYellow", anchor: "br", size: baseSize * 0.84, alpha: 0.78 });
      specs.push({ kind: "sparkleWhite", anchor: "bl", size: baseSize * 0.66, alpha: 0.8 });
    } else {
      specs.push({ kind: "starYellow", anchor: "tl", size: baseSize * 0.88, alpha: 0.76, filter: themeFilter });
      specs.push({ kind: "heartPink", anchor: "tr", size: baseSize * 0.8, alpha: 0.72, filter: themeFilter });
      specs.push({ kind: "bubblePink", anchor: "br", size: baseSize * 0.78, alpha: 0.7, filter: themeFilter });
      specs.push({ kind: "sparkleWhite", anchor: "bl", size: baseSize * 0.62, alpha: 0.76 });
      if (area >= 4 && random() > 0.4) {
        specs.push({ kind: "bubbleYellow", anchor: "center", size: baseSize * 0.62, alpha: 0.58, filter: themeFilter });
      }
    }
    specs.forEach((spec) => this.drawKawaiiDecoration(rect, spec, random));
  }
  drawKawaiiDecoration(rect, spec, random) {
    var _a;
    const point = this.getDecorationPoint(rect, spec.anchor, spec.size, random);
    const image = (_a = this.selectionAssets) == null ? void 0 : _a[spec.kind];
    if (!image) {
      return;
    }
    this.context.save();
    this.context.globalAlpha = spec.alpha;
    if (spec.filter) {
      this.context.filter = spec.filter;
    }
    this.context.drawImage(image, point.x, point.y, spec.size, spec.size);
    this.context.filter = "none";
    this.context.restore();
  }
  getSelectionImageFilter(theme) {
    switch (theme) {
      case "green":
        return "hue-rotate(86deg) saturate(1.08) brightness(0.96)";
      case "blue":
        return "hue-rotate(188deg) saturate(1.08) brightness(0.98)";
      case "purple":
        return "hue-rotate(250deg) saturate(1.05) brightness(0.98)";
      default:
        return "";
    }
  }
  getDecorationPoint(rect, anchor, size, random) {
    const insetX = Math.max(12, size * 0.32);
    const insetY = Math.max(10, size * 0.3);
    const jitterX = (random() - 0.5) * Math.min(size * 0.35, rect.width * 0.08);
    const jitterY = (random() - 0.5) * Math.min(size * 0.35, rect.height * 0.08);
    switch (anchor) {
      case "tl":
        return { x: rect.x + insetX + jitterX, y: rect.y + insetY + jitterY };
      case "tr":
        return { x: rect.x + rect.width - size - insetX + jitterX, y: rect.y + insetY + jitterY };
      case "bl":
        return { x: rect.x + insetX + jitterX, y: rect.y + rect.height - size - insetY + jitterY };
      case "br":
        return { x: rect.x + rect.width - size - insetX + jitterX, y: rect.y + rect.height - size - insetY + jitterY };
      case "top":
        return { x: rect.x + rect.width * 0.48 - size / 2 + jitterX, y: rect.y + insetY + jitterY };
      case "bottom":
        return { x: rect.x + rect.width * 0.28 - size / 2 + jitterX, y: rect.y + rect.height - size - insetY + jitterY };
      case "center":
      default:
        return { x: rect.x + rect.width * 0.56 - size / 2 + jitterX, y: rect.y + rect.height * 0.56 - size / 2 + jitterY };
    }
  }
  createPlacementRandom(seedText) {
    let seed = 2166136261;
    for (let index = 0; index < seedText.length; index += 1) {
      seed ^= seedText.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }
    let state = seed >>> 0;
    return () => {
      state = Math.imul(state ^ state >>> 15, 2246822519);
      state = Math.imul(state ^ state >>> 13, 3266489917);
      state ^= state >>> 16;
      return (state >>> 0) / 4294967295;
    };
  }
  drawImageClipped(image, x, y, width, height, radius) {
    this.context.save();
    this.roundRect(x, y, width, height + radius, radius);
    this.context.clip();
    this.context.drawImage(image, x, y, width, height);
    this.context.restore();
  }
  drawPreview(rect, valid, clue) {
    const fillColor = valid ? "#8fe8c2" : "#ffab99";
    const strokeColor = valid ? "#53c793" : "#f26f5b";
    this.fillRect(rect, fillColor, strokeColor, 0.45, [10, 6]);
    this.drawPreviewAccent(rect, strokeColor);
    this.drawPreviewCorners(rect, strokeColor);
    if (clue) {
      this.drawPreviewClueHighlight(clue, strokeColor);
    }
  }
  drawHint(rect) {
    this.fillRect(rect, "#8fd8ff", "#4ba8e6", 0.24, [8, 6]);
  }
  drawSelectedPlacement(placement) {
    const badgeRect = this.getPlacementDeleteBadgeRect(placement);
    const { context } = this;
    this.drawPreviewAccent(placement.rect, "#ffb627");
    this.drawPreviewCorners(placement.rect, "#ffb627");
    context.save();
    context.fillStyle = "#fff8fb";
    context.strokeStyle = "#f16673";
    context.lineWidth = 2;
    this.roundRect(badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height, 11);
    context.fill();
    context.stroke();
    context.strokeStyle = "#f16673";
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(badgeRect.x + 7, badgeRect.y + 7);
    context.lineTo(badgeRect.x + badgeRect.width - 7, badgeRect.y + badgeRect.height - 7);
    context.moveTo(badgeRect.x + badgeRect.width - 7, badgeRect.y + 7);
    context.lineTo(badgeRect.x + 7, badgeRect.y + badgeRect.height - 7);
    context.stroke();
    context.restore();
  }
  fillRect(rect, fillColor, strokeColor, alpha, dash = []) {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = fillColor;
    this.roundRect(x + 2, y + 2, width - 4, height - 4, Math.max(8, metrics.cellSize * 0.18));
    context.fill();
    context.restore();
    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2.6;
    context.setLineDash(dash);
    this.roundRect(x + 1.5, y + 1.5, width - 3, height - 3, Math.max(9, metrics.cellSize * 0.2));
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "rgba(255,255,255,0.18)";
    this.roundRect(x + 4, y + 4, Math.max(10, width * 0.18), Math.max(8, height * 0.12), 8);
    context.fill();
    context.restore();
  }
  fillRectAnimated(rect, fillColor, strokeColor, alpha, scale) {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    context.save();
    context.translate(centerX, centerY);
    context.scale(scale, scale);
    context.translate(-centerX, -centerY);
    this.fillRect(rect, fillColor, strokeColor, alpha);
    context.restore();
  }
  drawPreviewAccent(rect, strokeColor) {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;
    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.shadowColor = strokeColor;
    context.shadowBlur = 14;
    context.strokeRect(x + 3, y + 3, width - 6, height - 6);
    context.restore();
  }
  drawPreviewCorners(rect, strokeColor) {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;
    const length = Math.max(8, Math.min(16, metrics.cellSize * 0.28));
    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 3;
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(x + 3, y + length);
    context.lineTo(x + 3, y + 3);
    context.lineTo(x + length, y + 3);
    context.moveTo(x + width - length, y + 3);
    context.lineTo(x + width - 3, y + 3);
    context.lineTo(x + width - 3, y + length);
    context.moveTo(x + 3, y + height - length);
    context.lineTo(x + 3, y + height - 3);
    context.lineTo(x + length, y + height - 3);
    context.moveTo(x + width - length, y + height - 3);
    context.lineTo(x + width - 3, y + height - 3);
    context.lineTo(x + width - 3, y + height - length);
    context.stroke();
    context.restore();
  }
  drawPreviewClueHighlight(clue, strokeColor) {
    const { context, metrics } = this;
    const centerX = metrics.offsetX + (clue.x + 0.5) * metrics.cellSize;
    const centerY = metrics.offsetY + (clue.y + 0.5) * metrics.cellSize;
    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.36)";
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.shadowColor = strokeColor;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(centerX, centerY, metrics.cellSize * 0.34, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }
  getPlacementDeleteBadgeRect(placement) {
    const surfaceRect = this.getSurfaceRect(placement.rect);
    const size = Math.max(22, Math.min(28, this.metrics.cellSize * 0.55));
    return {
      x: surfaceRect.x + surfaceRect.width - size - 4,
      y: surfaceRect.y + 4,
      width: size,
      height: size
    };
  }
  getSurfaceRect(rect) {
    return {
      x: this.metrics.offsetX + rect.x * this.metrics.cellSize,
      y: this.metrics.offsetY + rect.y * this.metrics.cellSize,
      width: rect.width * this.metrics.cellSize,
      height: rect.height * this.metrics.cellSize
    };
  }
  drawGrid(level) {
    if (this.theme === "kawaii") {
      this.drawKawaiiGrid(level);
      return;
    }
    const { context, metrics } = this;
    context.save();
    context.strokeStyle = "rgba(255, 244, 252, 0.98)";
    context.shadowColor = "rgba(47, 118, 214, 0.38)";
    context.shadowBlur = 4;
    context.lineWidth = 1.4;
    for (let x = 0; x <= level.width; x += 1) {
      const lineX = metrics.offsetX + x * metrics.cellSize + 0.5;
      context.beginPath();
      context.moveTo(lineX, metrics.offsetY);
      context.lineTo(lineX, metrics.offsetY + metrics.boardHeight);
      context.stroke();
    }
    for (let y = 0; y <= level.height; y += 1) {
      const lineY = metrics.offsetY + y * metrics.cellSize + 0.5;
      context.beginPath();
      context.moveTo(metrics.offsetX, lineY);
      context.lineTo(metrics.offsetX + metrics.boardWidth, lineY);
      context.stroke();
    }
    context.restore();
  }
  drawKawaiiGrid(level) {
    const { context, metrics } = this;
    const gap = Math.max(4, Math.round(metrics.cellSize * 0.05));
    const radius = Math.max(12, Math.round(metrics.cellSize * 0.14));
    context.save();
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const cellX = metrics.offsetX + x * metrics.cellSize + gap / 2;
        const cellY = metrics.offsetY + y * metrics.cellSize + gap / 2;
        const cellSize = metrics.cellSize - gap;
        const fill = context.createLinearGradient(cellX, cellY, cellX, cellY + cellSize);
        fill.addColorStop(0, "rgba(255, 249, 241, 0.98)");
        fill.addColorStop(1, "rgba(255, 241, 229, 0.96)");
        context.fillStyle = fill;
        context.strokeStyle = "rgba(255, 206, 196, 0.92)";
        context.lineWidth = 1.4;
        context.shadowColor = "rgba(255, 255, 255, 0.85)";
        context.shadowBlur = 6;
        this.roundRect(cellX, cellY, cellSize, cellSize, radius);
        context.fill();
        context.shadowColor = "transparent";
        context.stroke();
      }
    }
    context.restore();
  }
  drawClues(level, placements) {
    const coveredClues = new Set(placements.map((placement) => `${placement.clue.x},${placement.clue.y}`));
    const kawaiiColors = ["#ffaec4", "#acdfff", "#c9a5ff", "#ffd16a", "#b5e58a"];
    this.context.save();
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.font = `600 ${Math.max(16, Math.floor(this.metrics.cellSize * 0.34))}px "Avenir Next", "Trebuchet MS", sans-serif`;
    for (const clue of level.clues) {
      const centerX = this.metrics.offsetX + (clue.x + 0.5) * this.metrics.cellSize;
      const centerY = this.metrics.offsetY + (clue.y + 0.5) * this.metrics.cellSize;
      const covered = coveredClues.has(`${clue.x},${clue.y}`);
      this.context.beginPath();
      this.context.arc(centerX, centerY, this.metrics.cellSize * (this.theme === "kawaii" ? 0.255 : 0.24), 0, Math.PI * 2);
      this.context.fillStyle = covered ? "rgba(255, 250, 252, 0.96)" : "rgba(255, 255, 255, 0.94)";
      this.context.fill();
      this.context.strokeStyle = this.theme === "kawaii" ? kawaiiColors[Math.abs((clue.x + clue.y + clue.value) % kawaiiColors.length)] : covered ? "#d997b6" : "#ffe17a";
      this.context.lineWidth = this.theme === "kawaii" ? 3 : 2;
      this.context.stroke();
      if (this.theme === "kawaii") {
        this.context.save();
        this.context.setLineDash([4, 3]);
        this.context.strokeStyle = "rgba(137, 87, 103, 0.25)";
        this.context.lineWidth = 1.2;
        this.context.beginPath();
        this.context.arc(centerX, centerY, this.metrics.cellSize * 0.19, 0, Math.PI * 2);
        this.context.stroke();
        this.context.restore();
      }
      this.context.fillStyle = covered ? "#6b4258" : "#6a4f5d";
      this.context.fillText(String(clue.value), centerX, centerY + 1);
    }
    this.context.restore();
  }
  drawSolvedBadge(label) {
    const { context, metrics } = this;
    const badgeWidth = Math.min(180, metrics.boardWidth * 0.55);
    const badgeHeight = 42;
    const x = metrics.offsetX + metrics.boardWidth - badgeWidth;
    const y = Math.max(16, metrics.offsetY - 52);
    context.save();
    const gradient = context.createLinearGradient(x, y, x, y + badgeHeight);
    if (this.theme === "kawaii") {
      gradient.addColorStop(0, "#ffe78e");
      gradient.addColorStop(1, "#ffc94b");
      context.strokeStyle = "rgba(255,255,255,0.94)";
      context.lineWidth = 2;
    } else {
      gradient.addColorStop(0, "#a9ef77");
      gradient.addColorStop(1, "#64c949");
    }
    context.fillStyle = gradient;
    this.roundRect(x, y, badgeWidth, badgeHeight, 16);
    context.fill();
    if (this.theme === "kawaii") {
      context.stroke();
    }
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '700 16px "Avenir Next", "Trebuchet MS", sans-serif';
    context.fillText(label, x + badgeWidth / 2, y + badgeHeight / 2 + 1);
    context.restore();
  }
  drawCelebration(now) {
    if (this.celebrationStartedAt < 0) {
      return;
    }
    const progress = Math.min(1, (now - this.celebrationStartedAt) / 1100);
    const fade = 1 - progress;
    this.context.save();
    this.context.globalAlpha = fade * 0.9;
    for (const particle of this.celebrationParticles) {
      const x = particle.x + particle.velocityX * progress + Math.sin(progress * 7 + particle.drift) * 6;
      const y = particle.y + particle.velocityY * progress;
      const radius = Math.max(1.5, particle.size * (1 - progress * 0.35));
      this.context.fillStyle = particle.color;
      this.context.beginPath();
      this.context.arc(x, y, radius, 0, Math.PI * 2);
      this.context.fill();
    }
    this.context.restore();
  }
  startPlacementAnimation(effect, now) {
    this.placementAnimations = this.placementAnimations.filter(
      (animation) => animation.placementId !== effect.placementId
    );
    this.placementAnimations.push({
      placementId: effect.placementId,
      startedAt: now
    });
  }
  getShakeOffset(now) {
    if (this.shakeStartedAt < 0) {
      return 0;
    }
    const progress = Math.min(1, (now - this.shakeStartedAt) / 260);
    const strength = (1 - progress) * 9;
    return Math.sin(progress * Math.PI * 7) * strength;
  }
  startCelebration(now) {
    this.celebrationStartedAt = now;
    const centerX = this.metrics.offsetX + this.metrics.boardWidth / 2;
    const topY = this.metrics.offsetY + 24;
    const colors = ["#ffd766", "#8fd8ff", "#ffb9cc", "#a9efcc", "#cbc4ff"];
    this.celebrationParticles = Array.from({ length: 18 }, (_, index) => ({
      x: centerX + (index - 9) * 10,
      y: topY + index % 3 * 10,
      size: 3 + index % 4,
      velocityX: (index % 2 === 0 ? -1 : 1) * (24 + index % 5 * 9),
      velocityY: -70 - index % 6 * 14,
      color: colors[index % colors.length],
      drift: index * 0.8
    }));
  }
  roundRect(x, y, width, height, radius) {
    this.context.beginPath();
    this.context.moveTo(x + radius, y);
    this.context.arcTo(x + width, y, x + width, y + height, radius);
    this.context.arcTo(x + width, y + height, x, y + height, radius);
    this.context.arcTo(x, y + height, x, y, radius);
    this.context.arcTo(x, y, x + width, y, radius);
    this.context.closePath();
  }
  drawCloudCluster(centerX, centerY, scale) {
    const puffs = [
      { x: -38, y: 14, r: 22 },
      { x: -10, y: 2, r: 28 },
      { x: 20, y: 8, r: 24 },
      { x: 48, y: 18, r: 18 }
    ];
    this.context.save();
    this.context.fillStyle = "rgba(255,255,255,0.54)";
    this.context.shadowColor = "rgba(255,255,255,0.24)";
    this.context.shadowBlur = 16;
    for (const puff of puffs) {
      this.context.beginPath();
      this.context.arc(
        centerX + puff.x * scale,
        centerY + puff.y * scale,
        puff.r * scale,
        0,
        Math.PI * 2
      );
      this.context.fill();
    }
    this.context.restore();
  }
  drawSkySparkles(width, height) {
    const sparkles = [
      { x: width * 0.26, y: height * 0.24, size: 4 },
      { x: width * 0.78, y: height * 0.3, size: 5 },
      { x: width * 0.18, y: height * 0.74, size: 4 },
      { x: width * 0.86, y: height * 0.84, size: 5 }
    ];
    this.context.save();
    this.context.strokeStyle = "rgba(255,255,255,0.68)";
    this.context.lineWidth = 1.4;
    this.context.lineCap = "round";
    for (const sparkle of sparkles) {
      this.context.beginPath();
      this.context.moveTo(sparkle.x - sparkle.size, sparkle.y);
      this.context.lineTo(sparkle.x + sparkle.size, sparkle.y);
      this.context.moveTo(sparkle.x, sparkle.y - sparkle.size);
      this.context.lineTo(sparkle.x, sparkle.y + sparkle.size);
      this.context.stroke();
    }
    this.context.restore();
  }
  drawImageCover(image, x, y, width, height) {
    var _a, _b;
    const source = image;
    const sourceWidth = (_a = source.width) != null ? _a : width;
    const sourceHeight = (_b = source.height) != null ? _b : height;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return;
    }
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }
    this.context.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }
};

// src/render/WechatCanvasSurface.ts
var WechatCanvasSurface = class {
  constructor(options) {
    __publicField(this, "canvas");
    __publicField(this, "context");
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "dpr");
    const context = options.canvas.getContext("2d");
    if (!context) {
      throw new Error("WeChat 2D context is not available");
    }
    this.canvas = options.canvas;
    this.context = context;
    this.width = options.width;
    this.height = options.height;
    this.dpr = options.dpr;
  }
  getContext2D() {
    return this.context;
  }
  syncSize() {
    const displayWidth = Math.round(this.width * this.dpr);
    const displayHeight = Math.round(this.height * this.dpr);
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return {
      width: this.width,
      height: this.height,
      dpr: this.dpr
    };
  }
  clientToSurfacePoint(clientX, clientY) {
    return {
      x: clientX,
      y: clientY
    };
  }
};

// src/storage/BrowserGameStorage.ts
var RECORDS_KEY = "patch-grid-records-v2";
var PROGRESS_KEY = "patch-grid-progress-v2";
var CAMPAIGN_KEY = "patch-grid-campaign-v1";
var WEEKLY_LEADERBOARD_KEY = "patch-grid-weekly-leaderboard-v1";
function getWeeklyBucketKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const weekday = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - weekday);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function isPlacementLike(value) {
  var _a, _b, _c, _d, _e, _f, _g;
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.id === "string" && typeof candidate.area === "number" && typeof ((_a = candidate.rect) == null ? void 0 : _a.x) === "number" && typeof ((_b = candidate.rect) == null ? void 0 : _b.y) === "number" && typeof ((_c = candidate.rect) == null ? void 0 : _c.width) === "number" && typeof ((_d = candidate.rect) == null ? void 0 : _d.height) === "number" && typeof ((_e = candidate.clue) == null ? void 0 : _e.x) === "number" && typeof ((_f = candidate.clue) == null ? void 0 : _f.y) === "number" && typeof ((_g = candidate.clue) == null ? void 0 : _g.value) === "number";
}
function isPlacementHistoryLike(value) {
  return Array.isArray(value) && value.every((item) => Array.isArray(item) && item.every(isPlacementLike));
}
function isLevelRecordLike(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.levelId === "string" && typeof candidate.completedAt === "string" && typeof candidate.durationMs === "number" && Array.isArray(candidate.placements) && candidate.placements.every(isPlacementLike);
}
function isSavedProgressLike(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.levelId === "string" && Array.isArray(candidate.placements) && candidate.placements.every(isPlacementLike) && isPlacementHistoryLike(candidate.history) && typeof candidate.placementSequence === "number" && typeof candidate.attemptStartedAt === "number";
}
function isCampaignRunStateLike(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.startedAt === "number" && typeof candidate.weekKey === "string";
}
function isWeeklyLeaderboardEntryLike(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.id === "string" && typeof candidate.weekKey === "string" && typeof candidate.durationMs === "number" && typeof candidate.completedAt === "string";
}
var BrowserGameStorage = class {
  constructor(adapter) {
    this.adapter = adapter;
  }
  load(levels2) {
    const allowedIds = new Set(levels2.map((level) => level.id));
    return {
      records: this.loadRecords(allowedIds),
      progress: this.loadProgress(allowedIds)
    };
  }
  saveRecords(records) {
    this.adapter.setItem(RECORDS_KEY, JSON.stringify(records));
  }
  saveProgress(progress) {
    if (!progress) {
      this.adapter.removeItem(PROGRESS_KEY);
      return;
    }
    this.adapter.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }
  loadCampaignState() {
    const raw = this.adapter.getItem(CAMPAIGN_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!isCampaignRunStateLike(parsed)) {
        return null;
      }
      return parsed.weekKey === getWeeklyBucketKey() ? parsed : null;
    } catch (e) {
      return null;
    }
  }
  saveCampaignState(state) {
    if (!state) {
      this.adapter.removeItem(CAMPAIGN_KEY);
      return;
    }
    this.adapter.setItem(CAMPAIGN_KEY, JSON.stringify(state));
  }
  loadWeeklyLeaderboard() {
    const raw = this.adapter.getItem(WEEKLY_LEADERBOARD_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const currentWeekKey = getWeeklyBucketKey();
      return parsed.filter(isWeeklyLeaderboardEntryLike).filter((entry) => entry.weekKey === currentWeekKey).sort((left, right) => left.durationMs - right.durationMs).slice(0, 20);
    } catch (e) {
      return [];
    }
  }
  saveWeeklyLeaderboard(entries) {
    this.adapter.setItem(WEEKLY_LEADERBOARD_KEY, JSON.stringify(entries));
  }
  resetGameData() {
    this.adapter.removeItem(RECORDS_KEY);
    this.adapter.removeItem(PROGRESS_KEY);
    this.adapter.removeItem(CAMPAIGN_KEY);
  }
  recordWeeklyLeaderboardEntry(durationMs, completedAt) {
    const weekKey = getWeeklyBucketKey(Date.parse(completedAt));
    const entries = this.loadWeeklyLeaderboard();
    const nextEntries = [
      ...entries.filter((entry) => entry.weekKey === weekKey),
      {
        id: `${weekKey}-${completedAt}-${Math.round(durationMs)}`,
        weekKey,
        durationMs,
        completedAt
      }
    ].sort((left, right) => left.durationMs - right.durationMs).slice(0, 20);
    this.saveWeeklyLeaderboard(nextEntries);
    return nextEntries;
  }
  loadRecords(allowedIds) {
    const raw = this.adapter.getItem(RECORDS_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      const records = {};
      for (const [levelId, value] of Object.entries(parsed)) {
        if (!allowedIds.has(levelId) || !isLevelRecordLike(value)) {
          continue;
        }
        records[levelId] = value;
      }
      return records;
    } catch (e) {
      return {};
    }
  }
  loadProgress(allowedIds) {
    const raw = this.adapter.getItem(PROGRESS_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!isSavedProgressLike(parsed) || !allowedIds.has(parsed.levelId)) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }
};

// src/storage/WechatStorageAdapter.ts
var WechatStorageAdapter = class {
  getItem(key) {
    try {
      const value = wx.getStorageSync(key);
      return typeof value === "string" ? value : null;
    } catch (e) {
      return null;
    }
  }
  setItem(key, value) {
    try {
      wx.setStorageSync(key, value);
    } catch (e) {
    }
  }
  removeItem(key) {
    try {
      wx.removeStorageSync(key);
    } catch (e) {
    }
  }
};

// src/wechat/main.ts
var THEME = {
  backgroundStart: "#ff958f",
  backgroundMid: "#f39ac9",
  backgroundEnd: "#aae6ff",
  surfaceStrong: "rgba(255, 255, 255, 0.92)",
  surface: "rgba(255, 255, 255, 0.84)",
  surfaceSoft: "rgba(255, 255, 255, 0.76)",
  surfaceMuted: "rgba(255, 255, 255, 0.46)",
  border: "rgba(255, 255, 255, 0.82)",
  borderSoft: "rgba(255, 255, 255, 0.58)",
  borderAccent: "rgba(255, 214, 74, 0.95)",
  shadow: "rgba(182, 110, 137, 0.24)",
  overlay: "rgba(123, 95, 124, 0.20)",
  textPrimary: "#684355",
  textSecondary: "#8d7080",
  textMuted: "#a18899",
  accent: "#ffab27",
  accentStrong: "#ff8315",
  accentSoft: "#fff1b9",
  accentFill: "#ffd54b",
  success: "#7cc95d",
  successSoft: "#ecffd8",
  info: "#55a7e3",
  infoSoft: "#dcf5ff",
  white: "#fffefe",
  disabledText: "#cbbbc4",
  candyPink: "#ffb9cc",
  candyPeach: "#ffc392",
  candyYellow: "#ffe369",
  candyMint: "#8fe8c2",
  candyBlue: "#7cc8ff",
  candyLavender: "#cbc4ff"
};
var cachedCanvas = null;
var WECHAT_ASSET_PATHS = {
  background: "dist-wechat/assets/wechat/bg.jpg",
  gameplayBackground: "dist-wechat/assets/wechat/bg_kawaii.png",
  backgroundMusic: "dist-wechat/assets/wechat/audio/perfect_match_bloom.mp3",
  comboGood: "dist-wechat/assets/wechat/audio/combo/combo_good.mp3",
  comboGreat: "dist-wechat/assets/wechat/audio/combo/combo_great.mp3",
  comboNice: "dist-wechat/assets/wechat/audio/combo/combo_nice.mp3",
  comboAmazing: "dist-wechat/assets/wechat/audio/combo/combo_amazing.mp3",
  comboPrefect: "dist-wechat/assets/wechat/audio/combo/combo_prefect.mp3",
  newGameButton: "dist-wechat/assets/wechat/new_game2.png",
  leaderboardButton: "dist-wechat/assets/wechat/rank_cutout.png",
  checkIcon: "dist-wechat/assets/wechat/check_icon.png",
  helpIcon: "dist-wechat/assets/wechat/help_icon.png",
  sunIcon: "dist-wechat/assets/wechat/kawaii/icon-sun.png",
  trophyIcon: "dist-wechat/assets/wechat/kawaii/icon-trophy.png",
  lightbulbIcon: "dist-wechat/assets/wechat/kawaii/icon-lightbulb.png",
  noteIcon: "dist-wechat/assets/wechat/kawaii/icon-note.png",
  flagIcon: "dist-wechat/assets/wechat/kawaii/icon-flag.png",
  checklistIcon: "dist-wechat/assets/wechat/kawaii/icon-checklist.png",
  cloudFaceIcon: "dist-wechat/assets/wechat/kawaii/icon-cloud-face.png",
  mascotCatCloud: "dist-wechat/assets/wechat/kawaii/mascot-cat-cloud.png",
  bottomButtonIcons: "dist-wechat/assets/wechat/kawaii/bottom-btn.png",
  decorSheet: "dist-wechat/assets/wechat/kawaii/icon-star-heart-cloud.png",
  selectionStrawberry: "dist-wechat/assets/wechat/selection/selection_decor_strawberry.png",
  selectionHeartPink: "dist-wechat/assets/wechat/selection/selection_decor_heart_pink.png",
  selectionStarYellow: "dist-wechat/assets/wechat/selection/selection_decor_star_yellow.png",
  selectionSparkleWhite: "dist-wechat/assets/wechat/selection/selection_decor_sparkle_white.png",
  selectionBubblePink: "dist-wechat/assets/wechat/selection/selection_decor_bubble_pink.png",
  selectionBubbleYellow: "dist-wechat/assets/wechat/selection/selection_decor_bubble_yellow.png",
  selectionDripYellow: "dist-wechat/assets/wechat/selection/selection_top_drip_yellow.png",
  settingsCloudSmileHeart: "dist-wechat/assets/wechat/settings/decor_cloud_smile_heart.png",
  settingsStarPinkBig: "dist-wechat/assets/wechat/settings/decor_star_pink_big.png",
  settingsMusicBadge: "dist-wechat/assets/wechat/settings/icon_music_badge.png",
  settingsVibrationBadge: "dist-wechat/assets/wechat/settings/icon_vibration_badge.png",
  settingsCloudClusterLeft: "dist-wechat/assets/wechat/settings/decor_cloud_cluster_left.png",
  settingsHeartCorner: "dist-wechat/assets/wechat/settings/decor_heart_corner.png",
  settingsHeartSmall: "dist-wechat/assets/wechat/settings/decor_heart_small.png",
  settingsSparkleWhite: "dist-wechat/assets/wechat/settings/decor_sparkle_white.png",
  settingsStarYellowSmall: "dist-wechat/assets/wechat/settings/decor_star_yellow_small_transparent.png",
  levelPanelCloudLeft: "dist-wechat/assets/wechat/level-panel/decor_cloud_cluster_left.png",
  levelPanelCloudRight: "dist-wechat/assets/wechat/level-panel/decor_cloud_cluster_right.png",
  levelPanelCloudSmileHeart: "dist-wechat/assets/wechat/level-panel/decor_cloud_smile_heart.png",
  levelPanelHeartPink: "dist-wechat/assets/wechat/level-panel/decor_heart_pink.png",
  levelPanelRibbonPink: "dist-wechat/assets/wechat/level-panel/decor_ribbon_pink.png",
  leaderboardRibbonPurple: "dist-wechat/assets/wechat/leaderboard/decor_ribbon_leaderboard_purple.png",
  leaderboardBunnyPeekLeft: "dist-wechat/assets/wechat/leaderboard/decor_bunny_peek_left.png",
  leaderboardRainbowCloud: "dist-wechat/assets/wechat/leaderboard/decor_rainbow_cloud.png",
  leaderboardEmptyTrophyBunny: "dist-wechat/assets/wechat/leaderboard/empty_trophy_bunny.png",
  levelPanelStarBigYellow: "dist-wechat/assets/wechat/level-panel/decor_star_big_yellow.png",
  levelPanelStarBlue: "dist-wechat/assets/wechat/level-panel/decor_star_blue.png",
  levelPanelStarFaceYellow: "dist-wechat/assets/wechat/level-panel/decor_star_face_yellow.png",
  levelPanelStarPink: "dist-wechat/assets/wechat/level-panel/decor_star_pink.png",
  levelPanelSparkleWhite: "dist-wechat/assets/wechat/level-panel/decor_sparkle_white.png"
};
var SETTINGS_STORAGE_KEY = "patch-grid-wechat-settings-v1";
function isWechatCanvasLike(value) {
  return typeof value === "object" && value !== null && "getContext" in value && typeof value.getContext === "function";
}
function resolveWechatCanvas() {
  if (cachedCanvas) {
    return cachedCanvas;
  }
  const globalCanvas = globalThis.canvas;
  cachedCanvas = isWechatCanvasLike(globalCanvas) ? globalCanvas : wx.createCanvas();
  return cachedCanvas;
}
function scheduleFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(() => callback());
  }
  return setTimeout(callback, 16);
}
function createWechatImage(canvas) {
  const canvasWithImage = canvas;
  if (typeof canvasWithImage.createImage === "function") {
    return canvasWithImage.createImage();
  }
  if (typeof wx.createImage === "function") {
    return wx.createImage();
  }
  return null;
}
function loadWechatImage(canvas, source) {
  const image = createWechatImage(canvas);
  if (!image) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}
function resolveLocale() {
  var _a;
  const systemInfo = wx.getSystemInfoSync();
  const language = (_a = systemInfo.language) != null ? _a : "";
  if (language.startsWith("zh")) {
    return "zh-CN";
  }
  return detectLocale();
}
function getWindowMetrics() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  const windowInfo = (_a = wx.getWindowInfo) == null ? void 0 : _a.call(wx);
  const systemInfo = wx.getSystemInfoSync();
  const width = (_c = (_b = windowInfo == null ? void 0 : windowInfo.windowWidth) != null ? _b : systemInfo.windowWidth) != null ? _c : 375;
  const height = (_e = (_d = windowInfo == null ? void 0 : windowInfo.windowHeight) != null ? _d : systemInfo.windowHeight) != null ? _e : 667;
  const dpr = (_g = (_f = windowInfo == null ? void 0 : windowInfo.pixelRatio) != null ? _f : systemInfo.pixelRatio) != null ? _g : 2;
  const statusBarHeight = (_h = systemInfo.statusBarHeight) != null ? _h : 0;
  const safeArea = systemInfo.safeArea;
  const menuButtonBottom = (_j = (_i = wx.getMenuButtonBoundingClientRect) == null ? void 0 : _i.call(wx).bottom) != null ? _j : 0;
  return {
    width,
    height,
    dpr,
    safeTop: Math.max(statusBarHeight, (_k = safeArea == null ? void 0 : safeArea.top) != null ? _k : 0, menuButtonBottom + 4),
    safeBottom: Math.max(0, height - ((_l = safeArea == null ? void 0 : safeArea.bottom) != null ? _l : height))
  };
}
function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1e3));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function formatCompletedAt(locale, isoString) {
  var _a;
  return (_a = formatLocaleDate(locale, isoString)) != null ? _a : t(locale, "fallback.unknownTime");
}
function loadUserSettings(adapter) {
  try {
    const raw = adapter.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        soundEnabled: true,
        vibrationEnabled: true
      };
    }
    const parsed = JSON.parse(raw);
    return {
      soundEnabled: parsed.soundEnabled !== false,
      vibrationEnabled: parsed.vibrationEnabled !== false
    };
  } catch (e) {
    return {
      soundEnabled: true,
      vibrationEnabled: true
    };
  }
}
function saveUserSettings(adapter, settings) {
  adapter.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
function wrapLinesByLength(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }
  const lines = [];
  for (let index = 0; index < text.length; index += maxLength) {
    lines.push(text.slice(index, index + maxLength));
  }
  return lines;
}
function drawBootstrapSplash() {
  try {
    const canvas = resolveWechatCanvas();
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const metrics = getWindowMetrics();
    canvas.width = Math.round(metrics.width * metrics.dpr);
    canvas.height = Math.round(metrics.height * metrics.dpr);
    context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    const gradient = context.createLinearGradient(0, 0, metrics.width, metrics.height);
    gradient.addColorStop(0, THEME.backgroundStart);
    gradient.addColorStop(0.5, THEME.backgroundMid);
    gradient.addColorStop(1, THEME.backgroundEnd);
    context.fillStyle = gradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.fillStyle = THEME.textPrimary;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 26px sans-serif";
    context.fillText("填满格子", metrics.width / 2, metrics.height / 2 - 16);
    context.font = "500 14px sans-serif";
    context.fillStyle = THEME.textSecondary;
    context.fillText("Loading mini game...", metrics.width / 2, metrics.height / 2 + 18);
  } catch (e) {
  }
}
function drawBootstrapError(error) {
  try {
    const canvas = resolveWechatCanvas();
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const metrics = getWindowMetrics();
    canvas.width = Math.round(metrics.width * metrics.dpr);
    canvas.height = Math.round(metrics.height * metrics.dpr);
    context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    context.fillStyle = THEME.backgroundStart;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.fillStyle = THEME.textPrimary;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.font = "700 20px sans-serif";
    context.fillText("填满格子", 20, 24);
    context.font = "500 14px sans-serif";
    context.fillStyle = THEME.accentStrong;
    context.fillText("Mini game bootstrap failed.", 20, 58);
    context.fillStyle = THEME.textSecondary;
    context.font = "12px sans-serif";
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error != null ? error : "Unknown error");
    wrapLinesByLength(message, 36).forEach((line, index) => {
      context.fillText(line, 20, 94 + index * 18);
    });
  } catch (e) {
  }
}
function roundRect(context, rect, radius) {
  context.beginPath();
  context.moveTo(rect.x + radius, rect.y);
  context.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, radius);
  context.arcTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height,
    radius
  );
  context.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y, radius);
  context.arcTo(rect.x, rect.y, rect.x + rect.width, rect.y, radius);
  context.closePath();
}
function isPointInsideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
function computeLayout(metrics) {
  const compact = metrics.height < 780;
  const padding = compact ? 12 : 14;
  const gap = compact ? 8 : 9;
  const topBarHeight = compact ? 30 : 32;
  const headerHeight = compact ? 96 : 104;
  const infoHeight = compact ? 74 : 82;
  const rulesHeight = compact ? 78 : 84;
  const actionsHeight = compact ? 86 : 94;
  const bottomSafeSpacing = Math.max(18, metrics.safeBottom + 10);
  const topBarY = Math.max(2, metrics.safeTop - (compact ? 22 : 24));
  const headerRect = {
    x: padding,
    y: topBarY + topBarHeight + 2,
    width: metrics.width - padding * 2,
    height: headerHeight
  };
  const infoY = headerRect.y + headerHeight + gap;
  const cardWidth = Math.floor((metrics.width - padding * 2 - gap * 2) / 3);
  const hintRect = {
    x: padding,
    y: infoY,
    width: cardWidth,
    height: infoHeight
  };
  const recordRect = {
    x: hintRect.x + hintRect.width + gap,
    y: infoY,
    width: cardWidth,
    height: infoHeight
  };
  const progressRect = {
    x: recordRect.x + recordRect.width + gap,
    y: infoY,
    width: metrics.width - padding - (recordRect.x + recordRect.width + gap),
    height: infoHeight
  };
  const actionsRect = {
    x: padding,
    y: metrics.height - bottomSafeSpacing - padding - actionsHeight,
    width: metrics.width - padding * 2,
    height: actionsHeight
  };
  const rulesRect = {
    x: padding,
    y: actionsRect.y - gap - rulesHeight,
    width: metrics.width - padding * 2,
    height: rulesHeight
  };
  const topInset = infoY + infoHeight + 8;
  const bottomInset = Math.max(106, metrics.height - rulesRect.y + 10);
  return {
    headerRect,
    chipRect: {
      x: headerRect.x + headerRect.width - (compact ? 108 : 116),
      y: headerRect.y + (compact ? 18 : 22),
      width: compact ? 94 : 102,
      height: compact ? 42 : 46
    },
    hintRect,
    recordRect,
    progressRect,
    rulesRect,
    actionsRect,
    safeTop: metrics.safeTop,
    safeBottom: metrics.safeBottom,
    topInset,
    bottomInset
  };
}
function drawCardShell(context, rect) {
  const radius = 22;
  context.save();
  const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, "rgba(255, 252, 248, 0.97)");
  gradient.addColorStop(1, "rgba(255, 247, 241, 0.92)");
  context.fillStyle = gradient;
  context.strokeStyle = "rgba(255, 203, 214, 0.95)";
  context.lineWidth = 2.2;
  context.shadowColor = "rgba(188, 115, 149, 0.2)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  roundRect(context, rect, radius);
  context.fill();
  context.shadowColor = "transparent";
  context.stroke();
  context.save();
  context.setLineDash([5, 4]);
  context.strokeStyle = "rgba(255, 174, 189, 0.88)";
  context.lineWidth = 1.3;
  roundRect(context, {
    x: rect.x + 7,
    y: rect.y + 7,
    width: rect.width - 14,
    height: rect.height - 14
  }, Math.max(10, radius - 6));
  context.stroke();
  context.restore();
  context.restore();
}
function drawTextFrame(context, rect, options = {}) {
  var _a, _b, _c;
  context.save();
  context.fillStyle = (_a = options.fill) != null ? _a : "rgba(255, 255, 255, 0.56)";
  context.strokeStyle = (_b = options.stroke) != null ? _b : THEME.borderSoft;
  context.lineWidth = 1.1;
  roundRect(context, rect, (_c = options.radius) != null ? _c : 10);
  context.fill();
  context.stroke();
  context.restore();
}
function drawCatCloudMascot(context, rect, image) {
  if (image) {
    drawImageFit(context, image, rect);
    return;
  }
  const cloud = {
    x: rect.x + 4,
    y: rect.y + rect.height - 52,
    width: 86,
    height: 58
  };
  context.save();
  const cloudGradient = context.createLinearGradient(cloud.x, cloud.y, cloud.x, cloud.y + cloud.height);
  cloudGradient.addColorStop(0, "#ffb3d0");
  cloudGradient.addColorStop(1, "#ff8db8");
  context.fillStyle = cloudGradient;
  context.shadowColor = "rgba(255, 154, 191, 0.28)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 6;
  roundRect(context, cloud, 28);
  context.fill();
  context.shadowColor = "transparent";
  context.fillStyle = "#fff8f4";
  context.beginPath();
  context.arc(rect.x + 34, rect.y + 28, 18, Math.PI * 0.2, Math.PI * 1.95);
  context.arc(rect.x + 52, rect.y + 30, 18, Math.PI * 1.1, Math.PI * 0.1, true);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(rect.x + 25, rect.y + 18);
  context.lineTo(rect.x + 19, rect.y + 7);
  context.lineTo(rect.x + 31, rect.y + 12);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(rect.x + 55, rect.y + 12);
  context.lineTo(rect.x + 66, rect.y + 8);
  context.lineTo(rect.x + 61, rect.y + 20);
  context.closePath();
  context.fill();
  context.strokeStyle = "#7a4858";
  context.lineWidth = 2;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(rect.x + 31, rect.y + 31);
  context.lineTo(rect.x + 35, rect.y + 28);
  context.moveTo(rect.x + 49, rect.y + 28);
  context.lineTo(rect.x + 53, rect.y + 31);
  context.stroke();
  context.beginPath();
  context.moveTo(rect.x + 40, rect.y + 36);
  context.quadraticCurveTo(rect.x + 43, rect.y + 40, rect.x + 46, rect.y + 36);
  context.stroke();
  context.fillStyle = "#ffb1ba";
  context.beginPath();
  context.arc(rect.x + 28, rect.y + 37, 4, 0, Math.PI * 2);
  context.arc(rect.x + 57, rect.y + 37, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#fff8f4";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(cloud.x + 22, cloud.y + 10);
  context.lineTo(cloud.x + 14, cloud.y + 24);
  context.moveTo(cloud.x + 64, cloud.y + 10);
  context.lineTo(cloud.x + 72, cloud.y + 24);
  context.stroke();
  context.restore();
}
function drawRuleBunnyPeek(context, rect) {
  const bodyRect = {
    x: rect.x + rect.width * 0.1,
    y: rect.y + rect.height * 0.34,
    width: rect.width * 0.8,
    height: rect.height * 0.54
  };
  const earWidth = rect.width * 0.24;
  const earHeight = rect.height * 0.54;
  context.save();
  context.shadowColor = "rgba(255, 170, 195, 0.24)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;
  const faceGradient = context.createLinearGradient(
    bodyRect.x,
    bodyRect.y,
    bodyRect.x,
    bodyRect.y + bodyRect.height
  );
  faceGradient.addColorStop(0, "#fffdf8");
  faceGradient.addColorStop(1, "#fff2e8");
  context.fillStyle = faceGradient;
  roundRect(context, bodyRect, bodyRect.height / 2);
  context.fill();
  context.shadowColor = "transparent";
  const drawEar = (ear, leanLeft) => {
    context.save();
    const earGradient = context.createLinearGradient(ear.x, ear.y, ear.x, ear.y + ear.height);
    earGradient.addColorStop(0, "#fffdf8");
    earGradient.addColorStop(1, "#ffe9f0");
    context.fillStyle = earGradient;
    context.strokeStyle = "rgba(255, 196, 212, 0.92)";
    context.lineWidth = 2;
    roundRect(context, ear, ear.width / 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffb7ca";
    context.beginPath();
    context.ellipse(
      ear.x + ear.width * 0.55,
      ear.y + ear.height * 0.54,
      ear.width * 0.22,
      ear.height * 0.3,
      leanLeft ? -0.18 : 0.18,
      0,
      Math.PI * 2
    );
    context.fill();
    context.restore();
  };
  drawEar(
    {
      x: rect.x + rect.width * 0.18,
      y: rect.y + rect.height * 0.02,
      width: earWidth,
      height: earHeight
    },
    true
  );
  drawEar(
    {
      x: rect.x + rect.width * 0.47,
      y: rect.y,
      width: earWidth,
      height: earHeight
    },
    false
  );
  context.fillStyle = "#7a4b3d";
  context.beginPath();
  context.arc(bodyRect.x + bodyRect.width * 0.38, bodyRect.y + bodyRect.height * 0.42, 2.6, 0, Math.PI * 2);
  context.arc(bodyRect.x + bodyRect.width * 0.62, bodyRect.y + bodyRect.height * 0.42, 2.6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ff8fa8";
  context.beginPath();
  context.arc(bodyRect.x + bodyRect.width * 0.25, bodyRect.y + bodyRect.height * 0.54, 4.5, 0, Math.PI * 2);
  context.arc(bodyRect.x + bodyRect.width * 0.75, bodyRect.y + bodyRect.height * 0.54, 4.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#7a4b3d";
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(bodyRect.x + bodyRect.width * 0.5, bodyRect.y + bodyRect.height * 0.46);
  context.quadraticCurveTo(
    bodyRect.x + bodyRect.width * 0.47,
    bodyRect.y + bodyRect.height * 0.54,
    bodyRect.x + bodyRect.width * 0.5,
    bodyRect.y + bodyRect.height * 0.61
  );
  context.stroke();
  context.fillStyle = "#fff2e8";
  context.beginPath();
  context.arc(bodyRect.x + bodyRect.width * 0.14, bodyRect.y + bodyRect.height * 0.88, 5, 0, Math.PI * 2);
  context.arc(bodyRect.x + bodyRect.width * 0.86, bodyRect.y + bodyRect.height * 0.88, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
function drawCardBadge(context, centerX, centerY, palette, icon, image, size = 36) {
  const half = size / 2;
  const scale = size / 36;
  if (image) {
    drawImageFit(context, image, {
      x: centerX - half,
      y: centerY - half,
      width: size,
      height: size
    });
    return;
  }
  const gradient = context.createLinearGradient(centerX, centerY - half, centerX, centerY + half);
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(1, palette.end);
  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = "rgba(255,255,255,0.92)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(178, 116, 145, 0.16)";
  context.shadowBlur = 10;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(centerX, centerY, half, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = "transparent";
  context.stroke();
  context.strokeStyle = palette.outline;
  context.fillStyle = palette.outline;
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (icon === "hint") {
    context.beginPath();
    context.arc(centerX, centerY - 2 * scale, 5 * scale, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3 * scale, centerY + 6 * scale);
    context.lineTo(centerX + 3 * scale, centerY + 6 * scale);
    context.moveTo(centerX - 1.5 * scale, centerY + 9 * scale);
    context.lineTo(centerX + 1.5 * scale, centerY + 9 * scale);
    context.stroke();
  } else if (icon === "note") {
    roundRect(context, {
      x: centerX - 7 * scale,
      y: centerY - 8 * scale,
      width: 14 * scale,
      height: 16 * scale
    }, 4 * scale);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3 * scale, centerY - 10 * scale);
    context.lineTo(centerX - 3 * scale, centerY - 6 * scale);
    context.moveTo(centerX + 3 * scale, centerY - 10 * scale);
    context.lineTo(centerX + 3 * scale, centerY - 6 * scale);
    context.moveTo(centerX - 4 * scale, centerY - 2 * scale);
    context.lineTo(centerX + 4 * scale, centerY - 2 * scale);
    context.moveTo(centerX - 4 * scale, centerY + 2 * scale);
    context.lineTo(centerX + 2 * scale, centerY + 2 * scale);
    context.stroke();
  } else if (icon === "flag") {
    context.beginPath();
    context.moveTo(centerX - 4 * scale, centerY + 9 * scale);
    context.lineTo(centerX - 4 * scale, centerY - 9 * scale);
    context.lineTo(centerX + 7 * scale, centerY - 5 * scale);
    context.lineTo(centerX - 4 * scale, centerY - 1 * scale);
    context.stroke();
  } else {
    roundRect(context, {
      x: centerX - 7 * scale,
      y: centerY - 9 * scale,
      width: 14 * scale,
      height: 18 * scale
    }, 4 * scale);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3 * scale, centerY - 11 * scale);
    context.lineTo(centerX - 3 * scale, centerY - 7 * scale);
    context.moveTo(centerX + 3 * scale, centerY - 11 * scale);
    context.lineTo(centerX + 3 * scale, centerY - 7 * scale);
    context.moveTo(centerX - 4 * scale, centerY - 1 * scale);
    context.lineTo(centerX - 1 * scale, centerY + 3 * scale);
    context.lineTo(centerX + 4 * scale, centerY - 5 * scale);
    context.stroke();
  }
  context.restore();
}
function drawDecorSprite(context, sheet, index, rect) {
  var _a, _b;
  if (!sheet) {
    return false;
  }
  const frameWidth = ((_a = sheet.width) != null ? _a : 2172) / 7;
  const frameHeight = (_b = sheet.height) != null ? _b : 724;
  drawImageFrame(context, sheet, {
    x: frameWidth * index,
    y: 0,
    width: frameWidth,
    height: frameHeight
  }, rect);
  return true;
}
function drawImageCover(context, image, rect) {
  var _a, _b;
  const sourceWidth = (_a = image.width) != null ? _a : rect.width;
  const sourceHeight = (_b = image.height) != null ? _b : rect.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return;
  }
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = rect.width / rect.height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  context.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );
}
function drawImageFit(context, image, rect) {
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );
}
function drawSticker(context, image, rect, options = {}) {
  var _a, _b, _c, _d, _e;
  if (!image) {
    return false;
  }
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  context.save();
  context.globalAlpha = (_a = options.alpha) != null ? _a : 1;
  context.shadowColor = (_b = options.shadowColor) != null ? _b : "rgba(255, 255, 255, 0.34)";
  context.shadowBlur = (_c = options.shadowBlur) != null ? _c : 16;
  context.shadowOffsetY = (_d = options.shadowOffsetY) != null ? _d : 4;
  context.translate(centerX, centerY);
  context.rotate(((_e = options.rotation) != null ? _e : 0) * Math.PI / 180);
  context.drawImage(
    image,
    -rect.width / 2,
    -rect.height / 2,
    rect.width,
    rect.height
  );
  context.restore();
  return true;
}
function drawImageFrame(context, image, sourceRect, targetRect) {
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    targetRect.x,
    targetRect.y,
    targetRect.width,
    targetRect.height
  );
}
function drawLandingTopIconBar(context, assets, buttons, pressedId) {
  const minX = Math.min(...buttons.map((button) => button.rect.x));
  const minY = Math.min(...buttons.map((button) => button.rect.y));
  const maxX = Math.max(...buttons.map((button) => button.rect.x + button.rect.width));
  const maxY = Math.max(...buttons.map((button) => button.rect.y + button.rect.height));
  const barRect = {
    x: minX - 10,
    y: Math.max(2, minY - 8),
    width: maxX - minX + 20,
    height: maxY - minY + 16
  };
  context.save();
  context.fillStyle = "rgba(255,255,255,0.96)";
  context.strokeStyle = "rgba(255,255,255,0.98)";
  context.lineWidth = 1.2;
  context.shadowColor = "rgba(144, 118, 153, 0.22)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 6;
  roundRect(context, barRect, 19);
  context.fill();
  context.shadowColor = "transparent";
  context.stroke();
  context.strokeStyle = "rgba(238, 230, 241, 0.82)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(barRect.x + barRect.width / 2, barRect.y + 8);
  context.lineTo(barRect.x + barRect.width / 2, barRect.y + barRect.height - 8);
  context.stroke();
  buttons.forEach((button) => {
    const isPressed = pressedId === `icon:${button.id}`;
    const renderRect = {
      ...button.rect,
      y: button.rect.y + (isPressed ? 1.5 : 0)
    };
    const image = button.id === "goal" ? assets.checkIcon : assets.helpIcon;
    if (image) {
      drawImageFit(context, image, renderRect);
    }
  });
  context.restore();
}
function drawRoundTopIcon(context, rect, palette, icon, pressed) {
  const renderRect = {
    ...rect,
    y: rect.y + (pressed ? 1.5 : 0)
  };
  const centerX = renderRect.x + renderRect.width / 2;
  const centerY = renderRect.y + renderRect.height / 2;
  const radius = renderRect.width / 2;
  const gradient = context.createLinearGradient(
    renderRect.x,
    renderRect.y,
    renderRect.x,
    renderRect.y + renderRect.height
  );
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(1, palette.end);
  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = "rgba(255,255,255,0.92)";
  context.lineWidth = 1.2;
  context.shadowColor = "rgba(147, 114, 163, 0.18)";
  context.shadowBlur = 10;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = "transparent";
  context.stroke();
  context.strokeStyle = palette.outline;
  context.fillStyle = palette.outline;
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (icon === "gear") {
    context.beginPath();
    context.arc(centerX, centerY, 4.2, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = Math.PI * 2 * index / 8;
      const inner = 6.3;
      const outer = 8.4;
      context.beginPath();
      context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
      context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
      context.stroke();
    }
    context.beginPath();
    context.arc(centerX, centerY, 1.4, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(centerX - 5.5, centerY - 6);
    context.lineTo(centerX - 3.8, centerY + 1.5);
    context.lineTo(centerX + 3.8, centerY + 1.5);
    context.lineTo(centerX + 5.5, centerY - 6);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3, centerY + 1.5);
    context.lineTo(centerX - 2.2, centerY + 5.4);
    context.moveTo(centerX + 3, centerY + 1.5);
    context.lineTo(centerX + 2.2, centerY + 5.4);
    context.moveTo(centerX - 4.2, centerY + 6.6);
    context.lineTo(centerX + 4.2, centerY + 6.6);
    context.stroke();
  }
  context.restore();
}
function drawGameTopIconBar(context, buttons, pressedId, assets) {
  const minX = Math.min(...buttons.map((button) => button.rect.x));
  const minY = Math.min(...buttons.map((button) => button.rect.y));
  const maxX = Math.max(...buttons.map((button) => button.rect.x + button.rect.width));
  const maxY = Math.max(...buttons.map((button) => button.rect.y + button.rect.height));
  const barRect = {
    x: minX - 8,
    y: Math.max(0, minY - 10),
    width: maxX - minX + 16,
    height: maxY - minY + 14
  };
  context.save();
  const barGradient = context.createLinearGradient(barRect.x, barRect.y, barRect.x, barRect.y + barRect.height);
  barGradient.addColorStop(0, "rgba(255,255,255,0.36)");
  barGradient.addColorStop(1, "rgba(255,255,255,0.18)");
  context.fillStyle = barGradient;
  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.lineWidth = 1.6;
  context.shadowColor = "rgba(255,255,255,0.9)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 0;
  roundRect(context, barRect, barRect.height / 2);
  context.fill();
  context.stroke();
  context.shadowColor = "transparent";
  context.strokeStyle = "rgba(255,255,255,0.28)";
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(barRect.x + barRect.width / 2, barRect.y + 7);
  context.lineTo(barRect.x + barRect.width / 2, barRect.y + barRect.height - 7);
  context.stroke();
  buttons.forEach((button) => {
    const pressed = pressedId === `icon:${button.id}`;
    const renderRect = {
      ...button.rect,
      y: button.rect.y + (pressed ? 1.5 : 0)
    };
    if (button.id === "settings" && assets.sunIcon) {
      drawImageFit(context, assets.sunIcon, renderRect);
    } else if (button.id === "leaderboardTop" && assets.trophyIcon) {
      drawImageFit(context, assets.trophyIcon, renderRect);
    } else if (button.id === "settings") {
      drawRoundTopIcon(
        context,
        button.rect,
        {
          start: "#fff0ba",
          end: "#ffc96a",
          outline: "#de9229"
        },
        "gear",
        pressed
      );
    } else {
      drawRoundTopIcon(
        context,
        button.rect,
        {
          start: "#fff4c7",
          end: "#ffd987",
          outline: "#cc9a32"
        },
        "trophy",
        pressed
      );
    }
  });
  context.restore();
}
function drawInfoMenuPill(context, rect, pressed) {
  const renderRect = {
    ...rect,
    y: rect.y + (pressed ? 1.5 : 0)
  };
  const gradient = context.createLinearGradient(
    renderRect.x,
    renderRect.y,
    renderRect.x,
    renderRect.y + renderRect.height
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.42)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.24)");
  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = "rgba(255,255,255,0.96)";
  context.lineWidth = 1.2;
  context.shadowColor = "rgba(145, 112, 153, 0.18)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 4;
  roundRect(context, renderRect, renderRect.height / 2);
  context.fill();
  context.shadowColor = "transparent";
  context.stroke();
  context.strokeStyle = "rgba(255,255,255,0.88)";
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(renderRect.x + renderRect.width * 0.58, renderRect.y + 6);
  context.lineTo(renderRect.x + renderRect.width * 0.58, renderRect.y + renderRect.height - 6);
  context.stroke();
  context.fillStyle = "#ffffff";
  const dotY = renderRect.y + renderRect.height / 2;
  [renderRect.x + 20, renderRect.x + 30, renderRect.x + 40].forEach((dotX) => {
    context.beginPath();
    context.arc(dotX, dotY, 3.2, 0, Math.PI * 2);
    context.fill();
  });
  const ringX = renderRect.x + renderRect.width - 20;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2.2;
  context.beginPath();
  context.arc(ringX, dotY, 10, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(ringX, dotY, 4.5, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}
function getToolbarButtonStyle(button) {
  if (!button.enabled) {
    return {
      fillStart: "rgba(255, 255, 255, 0.78)",
      fillEnd: "rgba(245, 238, 243, 0.68)",
      textColor: THEME.disabledText,
      iconColor: THEME.disabledText,
      stroke: THEME.borderSoft
    };
  }
  switch (button.id) {
    case "levels":
      return {
        fillStart: "#ffd469",
        fillEnd: "#ffb649",
        textColor: "#ffffff",
        iconColor: "#ffffff",
        stroke: "rgba(255,255,255,0.9)"
      };
    case "undo":
      return {
        fillStart: "#cba6ff",
        fillEnd: "#9c7bf1",
        textColor: "#ffffff",
        iconColor: "#ffffff",
        stroke: "rgba(255,255,255,0.92)"
      };
    case "restart":
      return {
        fillStart: "#ff938d",
        fillEnd: "#ff6b74",
        textColor: "#ffffff",
        iconColor: "#ffffff",
        stroke: "rgba(255,255,255,0.92)"
      };
    case "hint":
      return {
        fillStart: "#ffb6df",
        fillEnd: "#f48ec8",
        textColor: "#ffffff",
        iconColor: "#ffffff",
        stroke: "rgba(255,255,255,0.92)"
      };
    case "next":
      return {
        fillStart: "#bdeea7",
        fillEnd: "#7ed466",
        textColor: "#ffffff",
        iconColor: "#ffffff",
        stroke: "rgba(255,255,255,0.92)"
      };
  }
}
function drawToolbarIcon(context, button, color, spriteSheet) {
  var _a, _b;
  if (spriteSheet) {
    const frameWidth = ((_a = spriteSheet.width) != null ? _a : 2172) / 5;
    const frameHeight = (_b = spriteSheet.height) != null ? _b : 724;
    const frameIndexMap = {
      levels: 0,
      undo: 1,
      restart: 2,
      hint: 3,
      next: 4
    };
    const frameIndex = frameIndexMap[button.id];
    const iconRect = {
      x: button.rect.x + button.rect.width * 0.18,
      y: button.rect.y + button.rect.height * 0.12,
      width: button.rect.width * 0.64,
      height: button.rect.height * 0.42
    };
    drawImageFrame(context, spriteSheet, {
      x: frameWidth * frameIndex,
      y: 0,
      width: frameWidth,
      height: frameHeight
    }, iconRect);
    return;
  }
  const centerX = button.rect.x + button.rect.width / 2;
  const centerY = button.rect.y + button.rect.height * 0.38;
  const iconColor = color != null ? color : button.enabled ? THEME.accent : THEME.disabledText;
  context.save();
  context.strokeStyle = iconColor;
  context.fillStyle = iconColor;
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.lineJoin = "round";
  switch (button.id) {
    case "levels": {
      const size = 5;
      const gap = 3;
      const startX = centerX - size - gap / 2;
      const startY = centerY - size - gap / 2;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          context.strokeRect(
            startX + col * (size + gap),
            startY + row * (size + gap),
            size,
            size
          );
        }
      }
      break;
    }
    case "undo": {
      context.beginPath();
      context.moveTo(centerX + 7, centerY - 4);
      context.quadraticCurveTo(centerX - 2, centerY - 9, centerX - 7, centerY - 1);
      context.stroke();
      context.beginPath();
      context.moveTo(centerX - 7, centerY - 1);
      context.lineTo(centerX - 2, centerY - 5);
      context.moveTo(centerX - 7, centerY - 1);
      context.lineTo(centerX - 1, centerY + 2);
      context.stroke();
      break;
    }
    case "restart": {
      context.beginPath();
      context.arc(centerX, centerY, 7, Math.PI * 0.15, Math.PI * 1.7);
      context.stroke();
      context.beginPath();
      context.moveTo(centerX + 5, centerY - 8);
      context.lineTo(centerX + 9, centerY - 8);
      context.lineTo(centerX + 9, centerY - 4);
      context.stroke();
      break;
    }
    case "hint": {
      context.beginPath();
      context.arc(centerX, centerY - 2, 5.5, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(centerX - 3, centerY + 5);
      context.lineTo(centerX + 3, centerY + 5);
      context.moveTo(centerX - 2, centerY + 8);
      context.lineTo(centerX + 2, centerY + 8);
      context.stroke();
      break;
    }
    case "next": {
      context.beginPath();
      context.moveTo(centerX - 6, centerY - 6);
      context.lineTo(centerX, centerY);
      context.lineTo(centerX - 6, centerY + 6);
      context.moveTo(centerX, centerY - 6);
      context.lineTo(centerX + 6, centerY);
      context.lineTo(centerX, centerY + 6);
      context.stroke();
      break;
    }
  }
  context.restore();
}
function measureWrappedText(context, text, maxWidth) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [""];
  }
  const lines = [];
  let current = "";
  for (const char of normalized) {
    const next = `${current}${char}`;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}
function drawWrappedText(context, text, rect, options) {
  context.save();
  context.font = options.font;
  context.fillStyle = options.color;
  context.textAlign = "left";
  context.textBaseline = "top";
  const lines = measureWrappedText(context, text, rect.width).slice(0, options.maxLines);
  lines.forEach((line, index) => {
    context.fillText(line, rect.x, rect.y + index * options.lineHeight);
  });
  context.restore();
}
function getRecordSummary(locale, record) {
  if (!record) {
    return t(locale, "record.noneSummary");
  }
  return t(locale, "record.summary", {
    duration: formatDuration(record.durationMs)
  });
}
function getRecordDetail(locale, record, mode) {
  if (!record) {
    return t(locale, "record.noneDetail");
  }
  return t(locale, mode === "record" ? "record.detailViewing" : "record.detailSaved", {
    count: record.placements.length,
    completedAt: formatCompletedAt(locale, record.completedAt)
  });
}
async function bootstrapWechatGame() {
  const locale = resolveLocale();
  const canvas = resolveWechatCanvas();
  const landingAssets = {
    background: null,
    gameplayBackground: null,
    newGameButton: null,
    leaderboardButton: null,
    checkIcon: null,
    helpIcon: null,
    sunIcon: null,
    trophyIcon: null,
    lightbulbIcon: null,
    noteIcon: null,
    flagIcon: null,
    checklistIcon: null,
    cloudFaceIcon: null,
    mascotCatCloud: null,
    bottomButtonIcons: null,
    decorSheet: null,
    selectionStrawberry: null,
    selectionHeartPink: null,
    selectionStarYellow: null,
    selectionSparkleWhite: null,
    selectionBubblePink: null,
    selectionBubbleYellow: null,
    selectionDripYellow: null,
    settingsCloudSmileHeart: null,
    settingsStarPinkBig: null,
    settingsMusicBadge: null,
    settingsVibrationBadge: null,
    settingsCloudClusterLeft: null,
    settingsHeartCorner: null,
    settingsHeartSmall: null,
    settingsSparkleWhite: null,
    settingsStarYellowSmall: null,
    levelPanelCloudLeft: null,
    levelPanelCloudRight: null,
    levelPanelCloudSmileHeart: null,
    levelPanelHeartPink: null,
    levelPanelRibbonPink: null,
    leaderboardRibbonPurple: null,
    leaderboardBunnyPeekLeft: null,
    leaderboardRainbowCloud: null,
    leaderboardEmptyTrophyBunny: null,
    levelPanelStarBigYellow: null,
    levelPanelStarBlue: null,
    levelPanelStarFaceYellow: null,
    levelPanelStarPink: null,
    levelPanelSparkleWhite: null
  };
  const metrics = getWindowMetrics();
  const layout = computeLayout(metrics);
  const storageAdapter = new WechatStorageAdapter();
  const storage = new BrowserGameStorage(storageAdapter);
  let userSettings = loadUserSettings(storageAdapter);
  const loadedGameState = storage.load(levels);
  let campaignState = storage.loadCampaignState();
  let weeklyLeaderboard = storage.loadWeeklyLeaderboard();
  const game = new GameController(levels, {
    initialRecords: loadedGameState.records,
    initialProgress: loadedGameState.progress,
    onRecordsChange: (records) => {
      storage.saveRecords(records);
    },
    onProgressChange: (progress) => {
      storage.saveProgress(progress);
    }
  });
  const surface = new WechatCanvasSurface({
    canvas,
    width: metrics.width,
    height: metrics.height,
    dpr: metrics.dpr
  });
  const renderer = new CanvasRenderer(surface);
  const comboVoiceUrls = {
    good: WECHAT_ASSET_PATHS.comboGood,
    great: WECHAT_ASSET_PATHS.comboGreat,
    nice: WECHAT_ASSET_PATHS.comboNice,
    amazing: WECHAT_ASSET_PATHS.comboAmazing,
    prefect: WECHAT_ASSET_PATHS.comboPrefect
  };
  const audio = new FeedbackAudio(comboVoiceUrls);
  const backgroundMusic = new BackgroundMusic(WECHAT_ASSET_PATHS.backgroundMusic);
  audio.setEnabled(userSettings.soundEnabled);
  backgroundMusic.setEnabled(userSettings.soundEnabled);
  const inputSource = new WechatPointerInputSource();
  const uiState = {
    levelPanelOpen: false,
    homeOpen: true,
    leaderboardOpen: false,
    helpOpen: false,
    goalOpen: false,
    settingsOpen: false,
    pressedUiId: null
  };
  new PointerController(inputSource, surface, renderer, game, {
    shouldIgnoreInput: () => uiState.levelPanelOpen || uiState.homeOpen || uiState.leaderboardOpen || uiState.helpOpen || uiState.goalOpen || uiState.settingsOpen
  });
  let currentSnapshot = game.getSnapshot();
  let animationFrameId = 0;
  let buttons = [];
  let homeButtons = [];
  let topIconButtons = [];
  let gameTopButtons = [];
  let levelTiles = [];
  let leaderboardPanelRect = null;
  let infoDialogPanelRect = null;
  let infoDialogButtonRect = null;
  let infoDialogLeaderboardButtonRect = null;
  let infoDialogMenuRect = null;
  let infoDialogTopButtons = [];
  let settingsDialogPanelRect = null;
  let settingsBackButtonRect = null;
  let settingsContinueButtonRect = null;
  let soundToggleRect = null;
  let vibrationToggleRect = null;
  let lastPlacementEffectId = 0;
  let lastInvalidEffectId = 0;
  let lastCelebrationEffectId = 0;
  let lastComboVoice = null;
  let autoAdvanceTimeoutId = 0;
  let lastAutoAdvanceCelebrationId = 0;
  let autoAdvanceBannerUntil = 0;
  let lastCampaignCompletionCelebrationId = 0;
  let infoDialogOpenAt = 0;
  const [
    backgroundImage,
    gameplayBackgroundImage,
    newGameButtonImage,
    leaderboardButtonImage,
    checkIconImage,
    helpIconImage,
    sunIconImage,
    trophyIconImage,
    lightbulbIconImage,
    noteIconImage,
    flagIconImage,
    checklistIconImage,
    cloudFaceIconImage,
    mascotCatCloudImage,
    bottomButtonIconsImage,
    decorSheetImage,
    selectionStrawberryImage,
    selectionHeartPinkImage,
    selectionStarYellowImage,
    selectionSparkleWhiteImage,
    selectionBubblePinkImage,
    selectionBubbleYellowImage,
    selectionDripYellowImage,
    settingsCloudSmileHeartImage,
    settingsStarPinkBigImage,
    settingsMusicBadgeImage,
    settingsVibrationBadgeImage,
    settingsCloudClusterLeftImage,
    settingsHeartCornerImage,
    settingsHeartSmallImage,
    settingsSparkleWhiteImage,
    settingsStarYellowSmallImage,
    levelPanelCloudLeftImage,
    levelPanelCloudRightImage,
    levelPanelCloudSmileHeartImage,
    levelPanelHeartPinkImage,
    levelPanelRibbonPinkImage,
    leaderboardRibbonPurpleImage,
    leaderboardBunnyPeekLeftImage,
    leaderboardRainbowCloudImage,
    leaderboardEmptyTrophyBunnyImage,
    levelPanelStarBigYellowImage,
    levelPanelStarBlueImage,
    levelPanelStarFaceYellowImage,
    levelPanelStarPinkImage,
    levelPanelSparkleWhiteImage
  ] = await Promise.all([
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.background),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.gameplayBackground),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.newGameButton),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardButton),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.checkIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.helpIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.sunIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.trophyIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.lightbulbIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.noteIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.flagIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.checklistIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.cloudFaceIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.mascotCatCloud),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.bottomButtonIcons),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.decorSheet),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionStrawberry),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionHeartPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionStarYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionSparkleWhite),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionBubblePink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionBubbleYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionDripYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsCloudSmileHeart),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsStarPinkBig),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsMusicBadge),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsVibrationBadge),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsCloudClusterLeft),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsHeartCorner),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsHeartSmall),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsSparkleWhite),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsStarYellowSmall),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelCloudLeft),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelCloudRight),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelCloudSmileHeart),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelHeartPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelRibbonPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardRibbonPurple),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardBunnyPeekLeft),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardRainbowCloud),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardEmptyTrophyBunny),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarBigYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarBlue),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarFaceYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelSparkleWhite)
  ]);
  landingAssets.background = backgroundImage;
  landingAssets.gameplayBackground = gameplayBackgroundImage;
  landingAssets.newGameButton = newGameButtonImage;
  landingAssets.leaderboardButton = leaderboardButtonImage;
  landingAssets.checkIcon = checkIconImage;
  landingAssets.helpIcon = helpIconImage;
  landingAssets.sunIcon = sunIconImage;
  landingAssets.trophyIcon = trophyIconImage;
  landingAssets.lightbulbIcon = lightbulbIconImage;
  landingAssets.noteIcon = noteIconImage;
  landingAssets.flagIcon = flagIconImage;
  landingAssets.checklistIcon = checklistIconImage;
  landingAssets.cloudFaceIcon = cloudFaceIconImage;
  landingAssets.mascotCatCloud = mascotCatCloudImage;
  landingAssets.bottomButtonIcons = bottomButtonIconsImage;
  landingAssets.decorSheet = decorSheetImage;
  landingAssets.selectionStrawberry = selectionStrawberryImage;
  landingAssets.selectionHeartPink = selectionHeartPinkImage;
  landingAssets.selectionStarYellow = selectionStarYellowImage;
  landingAssets.selectionSparkleWhite = selectionSparkleWhiteImage;
  landingAssets.selectionBubblePink = selectionBubblePinkImage;
  landingAssets.selectionBubbleYellow = selectionBubbleYellowImage;
  landingAssets.selectionDripYellow = selectionDripYellowImage;
  landingAssets.settingsCloudSmileHeart = settingsCloudSmileHeartImage;
  landingAssets.settingsStarPinkBig = settingsStarPinkBigImage;
  landingAssets.settingsMusicBadge = settingsMusicBadgeImage;
  landingAssets.settingsVibrationBadge = settingsVibrationBadgeImage;
  landingAssets.settingsCloudClusterLeft = settingsCloudClusterLeftImage;
  landingAssets.settingsHeartCorner = settingsHeartCornerImage;
  landingAssets.settingsHeartSmall = settingsHeartSmallImage;
  landingAssets.settingsSparkleWhite = settingsSparkleWhiteImage;
  landingAssets.settingsStarYellowSmall = settingsStarYellowSmallImage;
  landingAssets.levelPanelCloudLeft = levelPanelCloudLeftImage;
  landingAssets.levelPanelCloudRight = levelPanelCloudRightImage;
  landingAssets.levelPanelCloudSmileHeart = levelPanelCloudSmileHeartImage;
  landingAssets.levelPanelHeartPink = levelPanelHeartPinkImage;
  landingAssets.levelPanelRibbonPink = levelPanelRibbonPinkImage;
  landingAssets.leaderboardRibbonPurple = leaderboardRibbonPurpleImage;
  landingAssets.leaderboardBunnyPeekLeft = leaderboardBunnyPeekLeftImage;
  landingAssets.leaderboardRainbowCloud = leaderboardRainbowCloudImage;
  landingAssets.leaderboardEmptyTrophyBunny = leaderboardEmptyTrophyBunnyImage;
  landingAssets.levelPanelStarBigYellow = levelPanelStarBigYellowImage;
  landingAssets.levelPanelStarBlue = levelPanelStarBlueImage;
  landingAssets.levelPanelStarFaceYellow = levelPanelStarFaceYellowImage;
  landingAssets.levelPanelStarPink = levelPanelStarPinkImage;
  landingAssets.levelPanelSparkleWhite = levelPanelSparkleWhiteImage;
  function drawHeader(snapshot) {
    var _a, _b, _c;
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const textStartX = layout.headerRect.x + (compact ? 126 : 138);
    drawCardShell(context, layout.headerRect);
    const topButtonSize = compact ? 34 : 36;
    const topButtonGap = compact ? 10 : 12;
    const topButtonY = Math.max(0, metrics.safeTop - (compact ? 38 : 40));
    gameTopButtons = [
      {
        id: "settings",
        rect: {
          x: 22,
          y: topButtonY,
          width: topButtonSize,
          height: topButtonSize
        }
      },
      {
        id: "leaderboardTop",
        rect: {
          x: 22 + topButtonSize + topButtonGap,
          y: topButtonY,
          width: topButtonSize,
          height: topButtonSize
        }
      }
    ];
    drawGameTopIconBar(context, gameTopButtons, uiState.pressedUiId, landingAssets);
    drawCatCloudMascot(context, {
      x: layout.headerRect.x + (compact ? 10 : 12),
      y: layout.headerRect.y + (compact ? 12 : 14),
      width: compact ? 92 : 100,
      height: compact ? 92 : 100
    }, landingAssets.mascotCatCloud);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = THEME.textPrimary;
    context.font = `${compact ? "700 24px" : "700 28px"} sans-serif`;
    context.fillText(t(locale, "app.title"), textStartX, layout.headerRect.y + 18);
    context.fillStyle = THEME.textSecondary;
    context.font = `${compact ? "600 11px" : "600 12px"} sans-serif`;
    context.fillText(
      t(locale, "level.progress", {
        current: snapshot.levelIndex + 1,
        total: levels.length
      }),
      textStartX,
      layout.headerRect.y + 50
    );
    context.fillText(
      t(locale, "board.meta", {
        width: snapshot.level.width,
        height: snapshot.level.height,
        clues: snapshot.level.clues.length
      }),
      textStartX + (compact ? 92 : 102),
      layout.headerRect.y + 50
    );
    context.fillStyle = THEME.textPrimary;
    context.font = `${compact ? "700 15px" : "700 16px"} sans-serif`;
    context.fillText(
      formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey),
      textStartX,
      layout.headerRect.y + 70
    );
    context.restore();
    context.save();
    const chipGradient = context.createLinearGradient(
      layout.chipRect.x,
      layout.chipRect.y,
      layout.chipRect.x,
      layout.chipRect.y + layout.chipRect.height
    );
    const chipStart = snapshot.mode === "record" ? "#dff5ff" : snapshot.solved ? "#e4ffd7" : ((_a = snapshot.preview) == null ? void 0 : _a.validation.ok) ? "#ffe78f" : "#ffe78f";
    const chipEnd = snapshot.mode === "record" ? "#c8edff" : snapshot.solved ? "#c6ffb7" : ((_b = snapshot.preview) == null ? void 0 : _b.validation.ok) ? "#ffc948" : "#ffc948";
    chipGradient.addColorStop(0, chipStart);
    chipGradient.addColorStop(1, chipEnd);
    context.fillStyle = chipGradient;
    context.strokeStyle = "rgba(255,255,255,0.94)";
    context.lineWidth = 2;
    roundRect(context, layout.chipRect, layout.chipRect.height / 2);
    context.fill();
    context.stroke();
    context.save();
    context.setLineDash([5, 4]);
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 1.2;
    roundRect(context, {
      x: layout.chipRect.x + 6,
      y: layout.chipRect.y + 5,
      width: layout.chipRect.width - 12,
      height: layout.chipRect.height - 10
    }, Math.max(10, layout.chipRect.height / 2 - 6));
    context.stroke();
    context.restore();
    context.fillStyle = snapshot.mode === "record" ? THEME.info : snapshot.solved ? THEME.success : "#9a5b00";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${compact ? "700 17px" : "700 19px"} sans-serif`;
    context.fillText(
      snapshot.mode === "record" ? t(locale, "chip.record") : snapshot.solved ? t(locale, "chip.solved") : ((_c = snapshot.preview) == null ? void 0 : _c.validation.ok) ? t(locale, "chip.ready") : t(locale, "chip.active"),
      layout.chipRect.x + layout.chipRect.width / 2,
      layout.chipRect.y + layout.chipRect.height / 2 + 1
    );
    context.restore();
  }
  function drawInfoCards(snapshot) {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const hintText = snapshot.hintMessage ? tm(locale, snapshot.hintMessage) : t(locale, "button.hint");
    const covered = getCoveredCellCount(snapshot.level, snapshot.placements);
    const total = snapshot.level.width * snapshot.level.height;
    const progressPrimary = t(
      locale,
      snapshot.mode === "record" ? "coverage.record" : "coverage.play",
      { covered, total }
    );
    const recordSummary = snapshot.currentRecord ? formatDuration(snapshot.currentRecord.durationMs) : "--";
    const statusSummary = snapshot.mode === "record" ? t(locale, "chip.record") : tm(locale, snapshot.status);
    drawCardShell(context, layout.hintRect);
    drawCardShell(context, layout.recordRect);
    drawCardShell(context, layout.progressRect);
    drawCardBadge(context, layout.hintRect.x + 18, layout.hintRect.y + 16, {
      start: "#ffe18d",
      end: "#ffb85f",
      outline: "#ea7e2b"
    }, "hint", landingAssets.lightbulbIcon);
    drawCardBadge(context, layout.recordRect.x + 18, layout.recordRect.y + 16, {
      start: "#ffd59a",
      end: "#ffb65a",
      outline: "#e5852f"
    }, "note", landingAssets.noteIcon);
    drawCardBadge(context, layout.progressRect.x + 18, layout.progressRect.y + 16, {
      start: "#bff0b5",
      end: "#93dc86",
      outline: "#57a856"
    }, "flag", landingAssets.flagIcon);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = "#ff4f8d";
    context.font = "700 11px sans-serif";
    context.fillText(t(locale, "section.hints"), layout.hintRect.x + 42, layout.hintRect.y + 10);
    context.fillStyle = "#ef8f2f";
    context.fillText(t(locale, "section.record"), layout.recordRect.x + 42, layout.recordRect.y + 10);
    context.fillStyle = "#51a24e";
    context.fillText(t(locale, "section.progress"), layout.progressRect.x + 42, layout.progressRect.y + 10);
    context.fillStyle = THEME.textPrimary;
    context.font = "700 13px sans-serif";
    context.fillText(recordSummary, layout.recordRect.x + 14, layout.recordRect.y + 34);
    context.fillText(progressPrimary, layout.progressRect.x + 14, layout.progressRect.y + 34);
    context.fillStyle = THEME.textSecondary;
    context.font = "11px sans-serif";
    drawWrappedText(
      context,
      hintText,
      {
        x: layout.hintRect.x + 14,
        y: layout.hintRect.y + 34,
        width: layout.hintRect.width - 24,
        height: layout.hintRect.height - 42
      },
      {
        font: "11px sans-serif",
        color: THEME.textSecondary,
        lineHeight: 14,
        maxLines: 3
      }
    );
    drawWrappedText(
      context,
      snapshot.currentRecord ? getRecordDetail(locale, snapshot.currentRecord, snapshot.mode) : getRecordSummary(locale, snapshot.currentRecord),
      {
        x: layout.recordRect.x + 14,
        y: layout.recordRect.y + 50,
        width: layout.recordRect.width - 24,
        height: layout.recordRect.height - 58
      },
      {
        font: "10px sans-serif",
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 2
      }
    );
    drawWrappedText(
      context,
      statusSummary,
      {
        x: layout.progressRect.x + 14,
        y: layout.progressRect.y + 50,
        width: layout.progressRect.width - 24,
        height: layout.progressRect.height - 58
      },
      {
        font: "10px sans-serif",
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 2
      }
    );
    context.restore();
    drawCardShell(context, layout.rulesRect);
    const rulesCenterY = layout.rulesRect.y + layout.rulesRect.height / 2;
    const rulesBadgeSize = compact ? 44 : 48;
    const rulesBadgeCenterX = layout.rulesRect.x + (compact ? 34 : 38);
    const rulesTitleX = layout.rulesRect.x + (compact ? 62 : 70);
    const rulesBodyX = layout.rulesRect.x + (compact ? 118 : 128);
    drawCardBadge(context, rulesBadgeCenterX, rulesCenterY, {
      start: "#ffd8dc",
      end: "#ffb0bb",
      outline: "#ef7f8e"
    }, "rules", landingAssets.checklistIcon, rulesBadgeSize);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = "#ff4f8d";
    context.font = "700 12px sans-serif";
    context.fillText(t(locale, "section.rules"), rulesTitleX, rulesCenterY - 9);
    context.restore();
    drawWrappedText(
      context,
      `${t(locale, "rule.area")}  ·  ${t(locale, "rule.singleClue")}  ·  ${t(locale, "rule.cover")}`,
      {
        x: rulesBodyX,
        y: rulesCenterY - 16,
        width: layout.rulesRect.width - (rulesBodyX - layout.rulesRect.x) - 16,
        height: 34
      },
      {
        font: "11px sans-serif",
        color: THEME.textSecondary,
        lineHeight: 16,
        maxLines: 2
      }
    );
  }
  function drawButtons(snapshot) {
    const context = surface.getContext2D();
    const gap = 6;
    const buttonHeight = layout.actionsRect.height;
    const actionWidth = Math.floor((layout.actionsRect.width - gap * 4) / 5);
    buttons = [
      {
        id: "levels",
        label: t(locale, "section.levels"),
        rect: {
          x: layout.actionsRect.x,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight
        },
        enabled: true
      },
      {
        id: "undo",
        label: t(locale, "button.undo"),
        rect: {
          x: layout.actionsRect.x + (actionWidth + gap),
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight
        },
        enabled: snapshot.canUndo && snapshot.mode !== "record"
      },
      {
        id: "restart",
        label: t(locale, snapshot.mode === "record" ? "button.retry" : "button.restart"),
        rect: {
          x: layout.actionsRect.x + (actionWidth + gap) * 2,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight
        },
        enabled: true
      },
      {
        id: "hint",
        label: t(locale, "button.hint"),
        rect: {
          x: layout.actionsRect.x + (actionWidth + gap) * 3,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight
        },
        enabled: !snapshot.solved && snapshot.mode !== "record"
      },
      {
        id: "next",
        label: t(locale, "button.next"),
        rect: {
          x: layout.actionsRect.x + (actionWidth + gap) * 4,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight
        },
        enabled: snapshot.hasNextLevel
      }
    ];
    context.save();
    for (const button of buttons) {
      const isPressed = uiState.pressedUiId === `toolbar:${button.id}`;
      const buttonY = isPressed ? button.rect.y + 1.5 : button.rect.y;
      const buttonRect = { ...button.rect, y: buttonY };
      const style = getToolbarButtonStyle(button);
      const gradient = context.createLinearGradient(
        buttonRect.x,
        buttonRect.y,
        buttonRect.x,
        buttonRect.y + buttonRect.height
      );
      gradient.addColorStop(0, style.fillStart);
      gradient.addColorStop(1, style.fillEnd);
      context.fillStyle = gradient;
      context.strokeStyle = style.stroke;
      context.lineWidth = 2;
      context.shadowColor = "rgba(177, 113, 143, 0.18)";
      context.shadowBlur = 12;
      context.shadowOffsetY = 5;
      roundRect(context, buttonRect, 20);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.fillStyle = "rgba(255,255,255,0.26)";
      roundRect(context, {
        x: buttonRect.x + 8,
        y: buttonRect.y + 6,
        width: buttonRect.width - 16,
        height: Math.max(14, buttonRect.height * 0.22)
      }, 10);
      context.fill();
      drawToolbarIcon(
        context,
        { ...button, rect: buttonRect },
        style.iconColor,
        landingAssets.bottomButtonIcons
      );
      context.fillStyle = style.textColor;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 12px sans-serif";
      context.fillText(
        button.label,
        buttonRect.x + buttonRect.width / 2,
        buttonRect.y + buttonRect.height - 18
      );
    }
    context.restore();
  }
  function drawBoardDecorations() {
    const context = surface.getContext2D();
    const boardRect = renderer.getBoardSurfaceRect();
    if (landingAssets.cloudFaceIcon) {
      drawImageFit(context, landingAssets.cloudFaceIcon, {
        x: boardRect.x + boardRect.width - 66,
        y: boardRect.y + boardRect.height - 34,
        width: 72,
        height: 54
      });
    }
    if (landingAssets.decorSheet) {
      drawDecorSprite(context, landingAssets.decorSheet, 0, {
        x: boardRect.x - 22,
        y: boardRect.y - 18,
        width: 28,
        height: 28
      });
      drawDecorSprite(context, landingAssets.decorSheet, 1, {
        x: boardRect.x + boardRect.width - 10,
        y: boardRect.y + 8,
        width: 22,
        height: 22
      });
      drawDecorSprite(context, landingAssets.decorSheet, 2, {
        x: boardRect.x - 18,
        y: boardRect.y + boardRect.height - 14,
        width: 30,
        height: 30
      });
      drawDecorSprite(context, landingAssets.decorSheet, 4, {
        x: layout.rulesRect.x + layout.rulesRect.width - 20,
        y: layout.rulesRect.y + 8,
        width: 16,
        height: 16
      });
    }
  }
  function drawFallbackLandingButton(context, rect, label, palette) {
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    if (palette === "orange") {
      gradient.addColorStop(0, "#ffd85f");
      gradient.addColorStop(1, "#ff9f20");
    } else {
      gradient.addColorStop(0, "#dab7ff");
      gradient.addColorStop(1, "#a96df0");
    }
    context.save();
    context.fillStyle = gradient;
    context.strokeStyle = "rgba(255,255,255,0.92)";
    context.lineWidth = 2;
    context.shadowColor = "rgba(255, 220, 140, 0.42)";
    context.shadowBlur = 28;
    roundRect(context, rect, 24);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 26px sans-serif";
    context.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 2);
    context.restore();
  }
  function drawLandingScreen() {
    const context = surface.getContext2D();
    const buttonSize = Math.min(metrics.width * 0.72, 280);
    const firstButtonTop = metrics.height * 0.58;
    const secondButtonTop = firstButtonTop + buttonSize * 0.52;
    const iconBarY = Math.max(2, metrics.safeTop - 24);
    const iconBarX = 14;
    const iconBarWidth = 148;
    const iconBarHeight = 62;
    const iconSize = 50;
    const leftCenterX = iconBarX + iconBarWidth * 0.25;
    const rightCenterX = iconBarX + iconBarWidth * 0.75;
    const iconTop = iconBarY + (iconBarHeight - iconSize) / 2;
    homeButtons = [
      {
        id: "newGame",
        rect: {
          x: (metrics.width - buttonSize) / 2,
          y: firstButtonTop,
          width: buttonSize,
          height: buttonSize
        }
      },
      {
        id: "leaderboard",
        rect: {
          x: (metrics.width - buttonSize) / 2,
          y: secondButtonTop,
          width: buttonSize,
          height: buttonSize
        }
      }
    ];
    topIconButtons = [
      {
        id: "goal",
        rect: {
          x: leftCenterX - iconSize / 2,
          y: iconTop,
          width: iconSize,
          height: iconSize
        }
      },
      {
        id: "help",
        rect: {
          x: rightCenterX - iconSize / 2,
          y: iconTop,
          width: iconSize,
          height: iconSize
        }
      }
    ];
    context.save();
    context.clearRect(0, 0, metrics.width, metrics.height);
    if (landingAssets.background) {
      drawImageCover(context, landingAssets.background, {
        x: 0,
        y: 0,
        width: metrics.width,
        height: metrics.height
      });
    } else {
      const gradient = context.createLinearGradient(0, 0, 0, metrics.height);
      gradient.addColorStop(0, THEME.backgroundStart);
      gradient.addColorStop(0.5, THEME.backgroundMid);
      gradient.addColorStop(1, THEME.backgroundEnd);
      context.fillStyle = gradient;
      context.fillRect(0, 0, metrics.width, metrics.height);
    }
    const newGameRect = homeButtons[0].rect;
    const leaderboardRect = homeButtons[1].rect;
    const newGamePressed = uiState.pressedUiId === "home:newGame";
    const leaderboardPressed = uiState.pressedUiId === "home:leaderboard";
    const newGameRenderRect = {
      ...newGameRect,
      y: newGameRect.y + (newGamePressed ? 3 : 0)
    };
    const leaderboardRenderRect = {
      ...leaderboardRect,
      y: leaderboardRect.y + (leaderboardPressed ? 3 : 0)
    };
    if (landingAssets.newGameButton) {
      drawImageFit(context, landingAssets.newGameButton, newGameRenderRect);
    } else {
      drawFallbackLandingButton(context, newGameRenderRect, t(locale, "home.start"), "orange");
    }
    if (landingAssets.leaderboardButton) {
      drawImageFit(context, landingAssets.leaderboardButton, leaderboardRenderRect);
    } else {
      drawFallbackLandingButton(
        context,
        leaderboardRenderRect,
        t(locale, "landing.weeklyLeaderboard"),
        "purple"
      );
    }
    drawLandingTopIconBar(context, landingAssets, topIconButtons, uiState.pressedUiId);
    context.restore();
  }
  function drawInfoDialog(mode) {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const openProgress = infoDialogOpenAt > 0 ? Math.min(1, (Date.now() - infoDialogOpenAt) / 240) : 1;
    const pop = 0.96 + 0.04 * (1 - Math.pow(1 - openProgress, 3));
    const topButtonY = Math.max(0, metrics.safeTop - (compact ? 38 : 40));
    infoDialogTopButtons = [];
    const menuRect = {
      x: metrics.width - (compact ? 136 : 144),
      y: topButtonY,
      width: compact ? 118 : 126,
      height: compact ? 34 : 36
    };
    infoDialogMenuRect = menuRect;
    const panelWidth = Math.min(metrics.width - (compact ? 24 : 30), compact ? 340 : 368);
    const panelHeight = mode === "help" ? compact ? 576 : 624 : compact ? 514 : 560;
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: topButtonY + menuRect.height + (compact ? 20 : 24),
      width: panelWidth,
      height: panelHeight
    };
    infoDialogPanelRect = panelRect;
    const renderPanelRect = {
      x: panelRect.x + (1 - pop) * panelRect.width / 2,
      y: panelRect.y + (1 - pop) * panelRect.height / 2 - (1 - pop) * 10,
      width: panelRect.width * pop,
      height: panelRect.height * pop
    };
    const ruleHeaderHeight = compact ? 36 : 38;
    const ruleCardHeight = mode === "help" ? compact ? 198 : 214 : compact ? 168 : 182;
    const toolHeaderHeight = compact ? 36 : 38;
    const toolCardHeight = compact ? 130 : 142;
    const buttonHeight = compact ? 48 : 50;
    const buttonWidth = Math.min(renderPanelRect.width - 84, compact ? 176 : 188);
    const closeButtonRect = {
      x: renderPanelRect.x + (renderPanelRect.width - buttonWidth) / 2,
      y: renderPanelRect.y + renderPanelRect.height - buttonHeight - (compact ? 18 : 20),
      width: buttonWidth,
      height: buttonHeight
    };
    infoDialogButtonRect = closeButtonRect;
    infoDialogLeaderboardButtonRect = null;
    const drawPillLabel = (rect, fillStart, fillEnd, text, textColor, iconColor) => {
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      gradient.addColorStop(0, fillStart);
      gradient.addColorStop(1, fillEnd);
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255,255,255,0.95)";
      context.lineWidth = 1.2;
      context.shadowColor = "rgba(188, 115, 149, 0.16)";
      context.shadowBlur = 10;
      context.shadowOffsetY = 4;
      roundRect(context, rect, rect.height / 2);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.fillStyle = iconColor;
      context.beginPath();
      context.arc(rect.x + 18, rect.y + rect.height / 2, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = "700 11px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("✿", rect.x + 18, rect.y + rect.height / 2 + 0.2);
      context.fillStyle = textColor;
      context.font = "700 16px sans-serif";
      context.textAlign = "left";
      context.fillText(text, rect.x + 32, rect.y + rect.height / 2 + 0.5);
      context.restore();
    };
    const drawNumberBadge = (centerX, centerY, value) => {
      const size = compact ? 26 : 28;
      const gradient = context.createLinearGradient(centerX, centerY - size / 2, centerX, centerY + size / 2);
      gradient.addColorStop(0, "#fff3f7");
      gradient.addColorStop(1, "#ffd7e5");
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255, 166, 189, 0.92)";
      context.lineWidth = 2;
      context.shadowColor = "rgba(188, 115, 149, 0.12)";
      context.shadowBlur = 8;
      context.shadowOffsetY = 3;
      context.beginPath();
      context.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.fillStyle = "#ff5b8f";
      context.font = `700 ${compact ? 14 : 15}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(value), centerX, centerY + 0.5);
      context.restore();
    };
    const drawFeatureBadge = (rect, fillStart, fillEnd, glyph) => {
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      gradient.addColorStop(0, fillStart);
      gradient.addColorStop(1, fillEnd);
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.lineWidth = 1.4;
      context.shadowColor = "rgba(188, 115, 149, 0.16)";
      context.shadowBlur = 10;
      context.shadowOffsetY = 4;
      roundRect(context, rect, 8);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 13px sans-serif";
      context.fillText(glyph, rect.x + rect.width / 2, rect.y + rect.height / 2 + 0.5);
      context.restore();
    };
    const bodyLines = mode === "help" ? [
      t(locale, "landing.helpRule1"),
      t(locale, "landing.helpRule2"),
      t(locale, "landing.helpRule3"),
      t(locale, "landing.helpRule4")
    ] : [
      t(locale, "landing.goalRule1"),
      t(locale, "landing.goalRule2"),
      t(locale, "landing.goalRule3")
    ];
    context.save();
    const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
    overlayGradient.addColorStop(0, "rgba(255, 199, 222, 0.34)");
    overlayGradient.addColorStop(0.55, "rgba(255, 250, 252, 0.18)");
    overlayGradient.addColorStop(1, "rgba(161, 210, 255, 0.18)");
    context.fillStyle = overlayGradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.restore();
    drawInfoMenuPill(context, menuRect, uiState.pressedUiId === "dialog:menu");
    context.save();
    const panelGradient = context.createLinearGradient(
      renderPanelRect.x,
      renderPanelRect.y,
      renderPanelRect.x,
      renderPanelRect.y + renderPanelRect.height
    );
    panelGradient.addColorStop(0, "rgba(255, 252, 244, 0.96)");
    panelGradient.addColorStop(1, "rgba(255, 244, 231, 0.96)");
    context.fillStyle = panelGradient;
    context.strokeStyle = "rgba(255, 184, 198, 0.90)";
    context.lineWidth = 3.8;
    context.shadowColor = "rgba(120, 70, 100, 0.22)";
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    roundRect(context, renderPanelRect, compact ? 38 : 42);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.save();
    context.setLineDash([7, 6]);
    context.strokeStyle = "rgba(255, 165, 188, 0.66)";
    context.lineWidth = 1.5;
    roundRect(context, {
      x: renderPanelRect.x + 8,
      y: renderPanelRect.y + 8,
      width: renderPanelRect.width - 16,
      height: renderPanelRect.height - 16
    }, compact ? 32 : 36);
    context.stroke();
    context.restore();
    context.restore();
    if (landingAssets.levelPanelCloudLeft) {
      drawSticker(context, landingAssets.levelPanelCloudLeft, {
        x: renderPanelRect.x - 18,
        y: renderPanelRect.y + renderPanelRect.height - (compact ? 52 : 58),
        width: compact ? 60 : 66,
        height: compact ? 46 : 52
      }, { shadowBlur: 6, alpha: 0.98 });
    }
    if (landingAssets.levelPanelCloudRight) {
      drawSticker(context, landingAssets.levelPanelCloudRight, {
        x: renderPanelRect.x + renderPanelRect.width - (compact ? 52 : 58),
        y: renderPanelRect.y + renderPanelRect.height - (compact ? 50 : 56),
        width: compact ? 58 : 64,
        height: compact ? 50 : 56
      }, { shadowBlur: 6, alpha: 0.98 });
    }
    if (landingAssets.levelPanelStarBigYellow) {
      drawSticker(context, landingAssets.levelPanelStarBigYellow, {
        x: renderPanelRect.x - 26,
        y: renderPanelRect.y + 12,
        width: compact ? 50 : 56,
        height: compact ? 50 : 56
      }, { shadowBlur: 4, alpha: 0.92 });
    }
    if (landingAssets.levelPanelStarPink) {
      drawSticker(context, landingAssets.levelPanelStarPink, {
        x: renderPanelRect.x + renderPanelRect.width - (compact ? 34 : 38),
        y: renderPanelRect.y + 82,
        width: compact ? 28 : 32,
        height: compact ? 28 : 32
      }, { shadowBlur: 4, alpha: 0.94 });
    }
    if (landingAssets.levelPanelSparkleWhite) {
      drawSticker(context, landingAssets.levelPanelSparkleWhite, {
        x: renderPanelRect.x + 18,
        y: renderPanelRect.y + 58,
        width: 16,
        height: 16
      }, { shadowBlur: 3, alpha: 0.88 });
    }
    const ribbonRect = {
      x: renderPanelRect.x + 28,
      y: renderPanelRect.y - (compact ? 24 : 28),
      width: renderPanelRect.width - 56,
      height: compact ? 68 : 72
    };
    if (landingAssets.levelPanelRibbonPink) {
      drawSticker(context, landingAssets.levelPanelRibbonPink, ribbonRect, {
        shadowBlur: 10,
        shadowOffsetY: 4,
        alpha: 0.98
      });
    } else {
      const ribbonGradient = context.createLinearGradient(ribbonRect.x, ribbonRect.y, ribbonRect.x, ribbonRect.y + ribbonRect.height);
      ribbonGradient.addColorStop(0, "#ffa6c7");
      ribbonGradient.addColorStop(1, "#ff7fb1");
      context.save();
      context.fillStyle = ribbonGradient;
      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.lineWidth = 1.4;
      context.shadowColor = "rgba(186, 88, 132, 0.25)";
      context.shadowBlur = 14;
      context.shadowOffsetY = 5;
      roundRect(context, ribbonRect, ribbonRect.height / 2);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.beginPath();
      context.moveTo(ribbonRect.x + 14, ribbonRect.y + 8);
      context.lineTo(ribbonRect.x - 18, ribbonRect.y + ribbonRect.height / 2);
      context.lineTo(ribbonRect.x + 14, ribbonRect.y + ribbonRect.height - 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(ribbonRect.x + ribbonRect.width - 14, ribbonRect.y + 8);
      context.lineTo(ribbonRect.x + ribbonRect.width + 18, ribbonRect.y + ribbonRect.height / 2);
      context.lineTo(ribbonRect.x + ribbonRect.width - 14, ribbonRect.y + ribbonRect.height - 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
    drawRuleBunnyPeek(context, {
      x: ribbonRect.x + ribbonRect.width - (compact ? 82 : 92),
      y: ribbonRect.y - (compact ? 8 : 10),
      width: compact ? 78 : 88,
      height: compact ? 78 : 88
    });
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 6;
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#ff5fa3";
    context.font = `${compact ? "900 31px" : "900 34px"} sans-serif`;
    const titleText = mode === "help" ? t(locale, "landing.helpTitle") : t(locale, "landing.goalTitle");
    context.strokeText(titleText, ribbonRect.x + ribbonRect.width / 2 - 8, ribbonRect.y + ribbonRect.height / 2 + 2);
    context.fillText(titleText, ribbonRect.x + ribbonRect.width / 2 - 8, ribbonRect.y + ribbonRect.height / 2 + 2);
    context.restore();
    const sectionTop = renderPanelRect.y + (compact ? 76 : 82);
    const sectionTitleRect = {
      x: renderPanelRect.x + 16,
      y: sectionTop,
      width: compact ? 160 : 172,
      height: ruleHeaderHeight
    };
    drawPillLabel(
      sectionTitleRect,
      mode === "help" ? "#ffe7ee" : "#efe4ff",
      mode === "help" ? "#ffd0df" : "#dac8ff",
      mode === "help" ? t(locale, "landing.ruleSection") : t(locale, "landing.goalSection"),
      mode === "help" ? "#ff5fa3" : "#8b67df",
      mode === "help" ? "#ff9dbc" : "#b79aff"
    );
    const ruleCardRect = {
      x: renderPanelRect.x + 16,
      y: sectionTitleRect.y + (compact ? 36 : 40),
      width: renderPanelRect.width - 32,
      height: ruleCardHeight
    };
    drawTextFrame(context, ruleCardRect, {
      radius: 18,
      fill: "rgba(255,255,255,0.72)",
      stroke: "rgba(236, 226, 246, 0.95)"
    });
    const maxRules = mode === "help" ? 4 : 3;
    const ruleRowStep = mode === "help" ? compact ? 42 : 46 : compact ? 50 : 54;
    const ruleRowTop = compact ? 24 : 26;
    bodyLines.slice(0, maxRules).forEach((line, index) => {
      const rowY = ruleCardRect.y + ruleRowTop + index * ruleRowStep;
      drawNumberBadge(ruleCardRect.x + 20, rowY + 11, index + 1);
      drawWrappedText(
        context,
        line,
        {
          x: ruleCardRect.x + 42,
          y: rowY,
          width: ruleCardRect.width - 58,
          height: ruleRowStep - 6
        },
        {
          font: `${compact ? "12px" : "13px"} sans-serif`,
          color: THEME.textPrimary,
          lineHeight: compact ? 15 : 16,
          maxLines: 2
        }
      );
    });
    if (mode === "help") {
      const toolHeaderRect = {
        x: renderPanelRect.x + 16,
        y: ruleCardRect.y + ruleCardRect.height + (compact ? 24 : 26),
        width: compact ? 166 : 178,
        height: toolHeaderHeight
      };
      drawPillLabel(
        toolHeaderRect,
        "#f1e7ff",
        "#e4d3ff",
        t(locale, "landing.toolSection"),
        "#8f61df",
        "#b892ff"
      );
      const toolCardRect = {
        x: renderPanelRect.x + 16,
        y: toolHeaderRect.y + (compact ? 36 : 38),
        width: renderPanelRect.width - 32,
        height: toolCardHeight
      };
      drawTextFrame(context, toolCardRect, {
        radius: 18,
        fill: "rgba(255,255,255,0.72)",
        stroke: "rgba(236, 226, 246, 0.95)"
      });
      const toolRows = [
        { fillStart: "#7cc8ff", fillEnd: "#4ba4ea", glyph: "?", text: t(locale, "landing.toolHint") },
        { fillStart: "#ffc878", fillEnd: "#ff9e34", glyph: "↶", text: t(locale, "landing.toolUndo") },
        { fillStart: "#ffb2d4", fillEnd: "#ef7bb0", glyph: "↺", text: t(locale, "landing.toolRestart") }
      ];
      toolRows.forEach((tool, index) => {
        const rowTop = toolCardRect.y + (compact ? 16 : 18) + index * (compact ? 36 : 38);
        const iconRect = {
          x: toolCardRect.x + 14,
          y: rowTop,
          width: compact ? 24 : 26,
          height: compact ? 24 : 26
        };
        drawFeatureBadge(iconRect, tool.fillStart, tool.fillEnd, tool.glyph);
        drawWrappedText(
          context,
          tool.text,
          {
            x: iconRect.x + (compact ? 34 : 38),
            y: rowTop - 1,
            width: toolCardRect.width - (compact ? 52 : 56),
            height: 26
          },
          {
            font: `${compact ? "12px" : "13px"} sans-serif`,
            color: THEME.textPrimary,
            lineHeight: compact ? 15 : 16,
            maxLines: 1
          }
        );
      });
    }
    const closeGradient = context.createLinearGradient(
      closeButtonRect.x,
      closeButtonRect.y,
      closeButtonRect.x,
      closeButtonRect.y + closeButtonRect.height
    );
    closeGradient.addColorStop(0, "#5fbaf6");
    closeGradient.addColorStop(1, "#2c89f3");
    context.save();
    context.fillStyle = closeGradient;
    context.strokeStyle = "rgba(255,255,255,0.95)";
    context.lineWidth = 1.2;
    context.shadowColor = "rgba(83, 143, 232, 0.24)";
    context.shadowBlur = 14;
    context.shadowOffsetY = 6;
    roundRect(context, closeButtonRect, closeButtonRect.height / 2);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.save();
    context.setLineDash([5, 4]);
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 1.1;
    roundRect(context, {
      x: closeButtonRect.x + 6,
      y: closeButtonRect.y + 6,
      width: closeButtonRect.width - 12,
      height: closeButtonRect.height - 12
    }, closeButtonRect.height / 2 - 5);
    context.stroke();
    context.restore();
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 16px sans-serif";
    context.fillText(
      t(locale, "landing.gotIt"),
      closeButtonRect.x + closeButtonRect.width / 2,
      closeButtonRect.y + closeButtonRect.height / 2 + 1
    );
    context.restore();
  }
  function drawSettingsDialog() {
    const context = surface.getContext2D();
    const panelWidth = Math.min(metrics.width - 32, 286);
    const panelHeight = Math.min(metrics.height - 88, 430);
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(metrics.safeTop + 42, (metrics.height - panelHeight) / 2 + 2),
      width: panelWidth,
      height: panelHeight
    };
    settingsDialogPanelRect = panelRect;
    const rowX = panelRect.x + 16;
    const rowWidth = panelRect.width - 32;
    const rowHeight = 72;
    const rowGap = 10;
    const row1Rect = {
      x: rowX,
      y: panelRect.y + 96,
      width: rowWidth,
      height: rowHeight
    };
    const row2Rect = {
      x: rowX,
      y: row1Rect.y + rowHeight + rowGap,
      width: rowWidth,
      height: rowHeight
    };
    const buttonY = panelRect.y + panelRect.height - 62;
    const buttonWidth = 107;
    const buttonGap = 14;
    const buttonX = panelRect.x + (panelRect.width - buttonWidth * 2 - buttonGap) / 2;
    soundToggleRect = {
      x: row1Rect.x + row1Rect.width - 72,
      y: row1Rect.y + 22,
      width: 54,
      height: 28
    };
    vibrationToggleRect = {
      x: row2Rect.x + row2Rect.width - 72,
      y: row2Rect.y + 22,
      width: 54,
      height: 28
    };
    settingsBackButtonRect = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 42
    };
    settingsContinueButtonRect = {
      x: buttonX + buttonWidth + buttonGap,
      y: buttonY,
      width: buttonWidth,
      height: 42
    };
    const drawToggleRow = (rowRect, label, enabled, toggleRect, icon) => {
      const cardGradient = context.createLinearGradient(
        rowRect.x,
        rowRect.y,
        rowRect.x,
        rowRect.y + rowRect.height
      );
      cardGradient.addColorStop(0, "rgba(255, 255, 255, 0.82)");
      cardGradient.addColorStop(1, "rgba(255, 247, 250, 0.72)");
      context.save();
      context.fillStyle = cardGradient;
      context.strokeStyle = "rgba(255, 224, 232, 0.96)";
      context.lineWidth = 1.1;
      context.shadowColor = "rgba(194, 126, 165, 0.16)";
      context.shadowBlur = 14;
      context.shadowOffsetY = 6;
      roundRect(context, rowRect, 18);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.save();
      context.setLineDash([5, 4]);
      context.strokeStyle = "rgba(255, 255, 255, 0.92)";
      context.lineWidth = 1;
      roundRect(context, {
        x: rowRect.x + 6,
        y: rowRect.y + 6,
        width: rowRect.width - 12,
        height: rowRect.height - 12
      }, 14);
      context.stroke();
      context.restore();
      if (icon) {
        drawSticker(context, icon, {
          x: rowRect.x + 10,
          y: rowRect.y + 10,
          width: 42,
          height: 42
        }, { shadowBlur: 10, shadowOffsetY: 3 });
      }
      context.fillStyle = THEME.textPrimary;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.font = "700 18px sans-serif";
      context.fillText(label, rowRect.x + 60, rowRect.y + rowRect.height / 2 + 0.5);
      const toggleGradient = context.createLinearGradient(
        toggleRect.x,
        toggleRect.y,
        toggleRect.x,
        toggleRect.y + toggleRect.height
      );
      if (enabled) {
        toggleGradient.addColorStop(0, "#88df78");
        toggleGradient.addColorStop(1, "#3eaf47");
      } else {
        toggleGradient.addColorStop(0, "#ebe4eb");
        toggleGradient.addColorStop(1, "#d1c7d2");
      }
      context.save();
      context.fillStyle = toggleGradient;
      context.strokeStyle = "rgba(255,255,255,0.96)";
      context.lineWidth = 1;
      context.shadowColor = enabled ? "rgba(69, 169, 76, 0.18)" : "rgba(160, 148, 161, 0.14)";
      context.shadowBlur = 10;
      context.shadowOffsetY = 4;
      roundRect(context, toggleRect, toggleRect.height / 2);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      const knobX = enabled ? toggleRect.x + toggleRect.width - 12 : toggleRect.x + 12;
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(knobX, toggleRect.y + toggleRect.height / 2, 9, 0, Math.PI * 2);
      context.fill();
      context.restore();
      drawSticker(context, landingAssets.settingsHeartSmall, {
        x: rowRect.x + rowRect.width - 14,
        y: rowRect.y + 20,
        width: 18,
        height: 18
      }, { shadowBlur: 4, alpha: 0.95 });
    };
    const drawSettingsButton = (rect, kind, label) => {
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      if (kind === "back") {
        gradient.addColorStop(0, "rgba(245, 236, 246, 0.98)");
        gradient.addColorStop(1, "rgba(223, 208, 236, 0.98)");
      } else {
        gradient.addColorStop(0, "#7cc7ff");
        gradient.addColorStop(1, "#4c97f0");
      }
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255,255,255,0.96)";
      context.lineWidth = 1.2;
      context.shadowColor = kind === "back" ? "rgba(170, 141, 182, 0.18)" : "rgba(84, 145, 230, 0.24)";
      context.shadowBlur = 14;
      context.shadowOffsetY = 6;
      roundRect(context, rect, 16);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.save();
      context.setLineDash([5, 4]);
      context.strokeStyle = kind === "back" ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.92)";
      context.lineWidth = 1.1;
      roundRect(context, {
        x: rect.x + 6,
        y: rect.y + 6,
        width: rect.width - 12,
        height: rect.height - 12
      }, 12);
      context.stroke();
      context.restore();
      context.fillStyle = kind === "back" ? "#8a7797" : "#ffffff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 15px sans-serif";
      context.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 0.5);
      context.restore();
    };
    const drawSimpleSparkle = (image, x, y, width, height, alpha = 1) => {
      drawSticker(context, image, { x, y, width, height }, { shadowBlur: 5, alpha });
    };
    const drawPanelShell = () => {
      const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
      overlayGradient.addColorStop(0, "rgba(255, 188, 214, 0.38)");
      overlayGradient.addColorStop(0.6, "rgba(247, 219, 233, 0.30)");
      overlayGradient.addColorStop(1, "rgba(255, 245, 249, 0.24)");
      context.fillStyle = overlayGradient;
      context.fillRect(0, 0, metrics.width, metrics.height);
      const panelGradient = context.createLinearGradient(
        panelRect.x,
        panelRect.y,
        panelRect.x,
        panelRect.y + panelRect.height
      );
      panelGradient.addColorStop(0, "rgba(255, 253, 252, 0.98)");
      panelGradient.addColorStop(1, "rgba(255, 241, 245, 0.95)");
      context.fillStyle = panelGradient;
      context.strokeStyle = "rgba(255, 213, 225, 0.98)";
      context.lineWidth = 2;
      context.shadowColor = "rgba(226, 142, 175, 0.26)";
      context.shadowBlur = 28;
      context.shadowOffsetY = 12;
      roundRect(context, panelRect, 28);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.save();
      context.setLineDash([6, 5]);
      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.lineWidth = 1.3;
      roundRect(context, {
        x: panelRect.x + 8,
        y: panelRect.y + 8,
        width: panelRect.width - 16,
        height: panelRect.height - 16
      }, 22);
      context.stroke();
      context.restore();
      drawSimpleSparkle(landingAssets.settingsCloudSmileHeart, panelRect.x - 36, panelRect.y - 28, 96, 74, 0.98);
      drawSimpleSparkle(landingAssets.settingsStarPinkBig, panelRect.x + panelRect.width - 76, panelRect.y - 18, 58, 58, 0.96);
      drawSimpleSparkle(landingAssets.settingsCloudClusterLeft, panelRect.x - 22, panelRect.y + panelRect.height - 78, 84, 66, 0.94);
      drawSimpleSparkle(landingAssets.settingsHeartCorner, panelRect.x + panelRect.width - 32, panelRect.y + panelRect.height - 38, 38, 38, 0.98);
      drawSimpleSparkle(landingAssets.settingsSparkleWhite, panelRect.x + 18, panelRect.y + 74, 18, 18, 0.92);
      drawSimpleSparkle(landingAssets.settingsSparkleWhite, panelRect.x + panelRect.width - 34, panelRect.y + 94, 14, 14, 0.84);
      drawSimpleSparkle(landingAssets.settingsSparkleWhite, panelRect.x + 38, panelRect.y + panelRect.height - 84, 12, 12, 0.76);
    };
    context.save();
    drawPanelShell();
    context.textAlign = "center";
    context.textBaseline = "top";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(255, 255, 255, 0.92)";
    context.fillStyle = "#6a63d8";
    context.font = "700 28px sans-serif";
    context.shadowColor = "rgba(255, 194, 220, 0.56)";
    context.shadowBlur = 6;
    context.strokeText(t(locale, "settings.title"), panelRect.x + panelRect.width / 2, panelRect.y + 18);
    context.fillText(t(locale, "settings.title"), panelRect.x + panelRect.width / 2, panelRect.y + 18);
    drawToggleRow(
      row1Rect,
      t(locale, "settings.sound"),
      userSettings.soundEnabled,
      soundToggleRect,
      landingAssets.settingsMusicBadge
    );
    drawToggleRow(
      row2Rect,
      t(locale, "settings.vibration"),
      userSettings.vibrationEnabled,
      vibrationToggleRect,
      landingAssets.settingsVibrationBadge
    );
    context.save();
    context.strokeStyle = "rgba(245, 205, 148, 0.88)";
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(panelRect.x + 22, panelRect.y + 252);
    context.lineTo(panelRect.x + panelRect.width - 22, panelRect.y + 252);
    context.stroke();
    context.restore();
    drawSimpleSparkle(
      landingAssets.settingsStarYellowSmall,
      panelRect.x + panelRect.width / 2 - 8,
      panelRect.y + 242,
      16,
      16,
      1
    );
    drawSettingsButton(settingsBackButtonRect, "back", t(locale, "settings.backHome"));
    drawSettingsButton(settingsContinueButtonRect, "continue", t(locale, "settings.continue"));
    context.restore();
  }
  function drawLeaderboardPanel() {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const panelWidth = Math.min(metrics.width - (compact ? 36 : 48), compact ? 336 : 360);
    const panelHeight = Math.min(metrics.height - (compact ? 108 : 128), compact ? 548 : 590);
    const modalTopExtra = compact ? 48 : 52;
    const modalBottomExtra = compact ? 12 : 16;
    const modalVisualHeight = panelHeight + modalTopExtra + modalBottomExtra;
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(
        layout.topInset + modalTopExtra - (compact ? 6 : 8),
        (metrics.height - modalVisualHeight) / 2 + modalTopExtra
      ),
      width: panelWidth,
      height: panelHeight
    };
    leaderboardPanelRect = {
      x: panelRect.x - 18,
      y: panelRect.y - modalTopExtra,
      width: panelRect.width + 36,
      height: panelRect.height + modalTopExtra + modalBottomExtra
    };
    context.save();
    const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
    overlayGradient.addColorStop(0, "rgba(255, 179, 210, 0.38)");
    overlayGradient.addColorStop(0.55, "rgba(255, 232, 240, 0.28)");
    overlayGradient.addColorStop(1, "rgba(255, 245, 250, 0.20)");
    context.fillStyle = overlayGradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.restore();
    const panelGradient = context.createLinearGradient(panelRect.x, panelRect.y, panelRect.x, panelRect.y + panelRect.height);
    panelGradient.addColorStop(0, "rgba(255, 252, 247, 0.98)");
    panelGradient.addColorStop(1, "rgba(255, 241, 247, 0.95)");
    context.save();
    context.fillStyle = panelGradient;
    context.strokeStyle = "rgba(255, 210, 224, 0.98)";
    context.lineWidth = 2.2;
    context.shadowColor = "rgba(226, 142, 175, 0.26)";
    context.shadowBlur = 30;
    context.shadowOffsetY = 12;
    roundRect(context, panelRect, compact ? 30 : 34);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.save();
    context.setLineDash([6, 5]);
    context.strokeStyle = "rgba(255,255,255,0.94)";
    context.lineWidth = 1.3;
    roundRect(context, {
      x: panelRect.x + 8,
      y: panelRect.y + 8,
      width: panelRect.width - 16,
      height: panelRect.height - 16
    }, compact ? 24 : 28);
    context.stroke();
    context.restore();
    context.restore();
    const drawRibbon = (rect) => {
      if (landingAssets.leaderboardRibbonPurple) {
        drawSticker(context, landingAssets.leaderboardRibbonPurple, rect, {
          shadowColor: "rgba(167, 118, 214, 0.22)",
          shadowBlur: 18,
          shadowOffsetY: 6,
          alpha: 0.98
        });
        return;
      }
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      gradient.addColorStop(0, "#dca8ff");
      gradient.addColorStop(1, "#b77bf2");
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255,255,255,0.96)";
      context.lineWidth = 1.4;
      context.shadowColor = "rgba(167, 118, 214, 0.24)";
      context.shadowBlur = 18;
      context.shadowOffsetY = 6;
      roundRect(context, rect, rect.height / 2);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.beginPath();
      context.moveTo(rect.x + 16, rect.y + 10);
      context.lineTo(rect.x - 20, rect.y + rect.height * 0.46);
      context.lineTo(rect.x + 16, rect.y + rect.height - 10);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(rect.x + rect.width - 16, rect.y + 10);
      context.lineTo(rect.x + rect.width + 20, rect.y + rect.height * 0.46);
      context.lineTo(rect.x + rect.width - 16, rect.y + rect.height - 10);
      context.closePath();
      context.fill();
      context.stroke();
      context.save();
      context.setLineDash([7, 5]);
      context.strokeStyle = "rgba(255,255,255,0.46)";
      context.lineWidth = 1;
      roundRect(context, {
        x: rect.x + 8,
        y: rect.y + 8,
        width: rect.width - 16,
        height: rect.height - 16
      }, rect.height / 2 - 8);
      context.stroke();
      context.restore();
      context.restore();
    };
    const drawEmptyTrophy = (centerX, topY, scale) => {
      const cupW = 96 * scale;
      const cupH = 90 * scale;
      const cupX = centerX - cupW / 2;
      const cupY = topY;
      const gradient = context.createLinearGradient(cupX, cupY, cupX, cupY + cupH);
      gradient.addColorStop(0, "#fff3aa");
      gradient.addColorStop(0.55, "#ffd85c");
      gradient.addColorStop(1, "#f4ab12");
      context.save();
      context.shadowColor = "rgba(255, 193, 72, 0.24)";
      context.shadowBlur = 16;
      context.shadowOffsetY = 6;
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255,255,255,0.82)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cupX + 14 * scale, cupY + 10 * scale);
      context.lineTo(cupX + cupW - 14 * scale, cupY + 10 * scale);
      context.quadraticCurveTo(cupX + cupW - 6 * scale, cupY + 34 * scale, cupX + cupW - 22 * scale, cupY + 46 * scale);
      context.lineTo(cupX + cupW - 28 * scale, cupY + 60 * scale);
      context.lineTo(cupX + cupW - 40 * scale, cupY + 70 * scale);
      context.lineTo(cupX + cupW - 56 * scale, cupY + 70 * scale);
      context.lineTo(cupX + cupW - 58 * scale, cupY + 62 * scale);
      context.lineTo(cupX + cupW - 34 * scale, cupY + 58 * scale);
      context.quadraticCurveTo(cupX + cupW - 10 * scale, cupY + 46 * scale, cupX + cupW - 12 * scale, cupY + 28 * scale);
      context.lineTo(cupX + cupW - 12 * scale, cupY + 16 * scale);
      context.lineTo(cupX + 12 * scale, cupY + 16 * scale);
      context.lineTo(cupX + 12 * scale, cupY + 28 * scale);
      context.quadraticCurveTo(cupX + 10 * scale, cupY + 46 * scale, cupX + 34 * scale, cupY + 58 * scale);
      context.lineTo(cupX + 58 * scale, cupY + 62 * scale);
      context.lineTo(cupX + 56 * scale, cupY + 70 * scale);
      context.lineTo(cupX + 40 * scale, cupY + 70 * scale);
      context.lineTo(cupX + 28 * scale, cupY + 60 * scale);
      context.lineTo(cupX + 22 * scale, cupY + 46 * scale);
      context.quadraticCurveTo(cupX + 6 * scale, cupY + 34 * scale, cupX + 14 * scale, cupY + 10 * scale);
      context.closePath();
      context.fill();
      context.stroke();
      context.lineWidth = 10 * scale;
      context.strokeStyle = "rgba(255, 226, 118, 0.88)";
      context.beginPath();
      context.moveTo(cupX + 16 * scale, cupY + 18 * scale);
      context.lineTo(cupX + cupW - 16 * scale, cupY + 18 * scale);
      context.stroke();
      context.lineWidth = 2.5 * scale;
      context.strokeStyle = "#f3a61a";
      context.beginPath();
      context.arc(cupX - 8 * scale, cupY + 34 * scale, 16 * scale, -Math.PI * 0.18, Math.PI * 0.75);
      context.stroke();
      context.beginPath();
      context.arc(cupX + cupW + 8 * scale, cupY + 34 * scale, 16 * scale, Math.PI * 0.25, Math.PI * 1.18);
      context.stroke();
      const baseRect = {
        x: centerX - 22 * scale,
        y: cupY + cupH + 6 * scale,
        width: 44 * scale,
        height: 14 * scale
      };
      const baseGradient = context.createLinearGradient(baseRect.x, baseRect.y, baseRect.x, baseRect.y + baseRect.height);
      baseGradient.addColorStop(0, "#c07cff");
      baseGradient.addColorStop(1, "#8a56ef");
      context.fillStyle = baseGradient;
      context.strokeStyle = "rgba(255,255,255,0.84)";
      context.lineWidth = 2;
      roundRect(context, baseRect, 6 * scale);
      context.fill();
      context.stroke();
      context.restore();
    };
    const drawEmptyState = (rect) => {
      var _a, _b;
      const illustrationRect = {
        x: rect.x + 16,
        y: rect.y + 12,
        width: rect.width - 32,
        height: rect.height * 0.56
      };
      if (landingAssets.leaderboardEmptyTrophyBunny) {
        const sourceWidth = (_a = landingAssets.leaderboardEmptyTrophyBunny.width) != null ? _a : 1710;
        const sourceHeight = (_b = landingAssets.leaderboardEmptyTrophyBunny.height) != null ? _b : 611;
        const sourceRatio = sourceWidth / sourceHeight;
        const maxWidth = illustrationRect.width - (compact ? 8 : 12);
        const maxHeight = illustrationRect.height * 0.82;
        let drawWidth = maxWidth;
        let drawHeight = drawWidth / sourceRatio;
        if (drawHeight > maxHeight) {
          drawHeight = maxHeight;
          drawWidth = drawHeight * sourceRatio;
        }
        drawSticker(context, landingAssets.leaderboardEmptyTrophyBunny, {
          x: illustrationRect.x + (illustrationRect.width - drawWidth) / 2,
          y: illustrationRect.y + 4,
          width: drawWidth,
          height: drawHeight
        }, { shadowBlur: 8, alpha: 0.98 });
      } else {
        if (landingAssets.levelPanelCloudSmileHeart) {
          drawSticker(context, landingAssets.levelPanelCloudSmileHeart, {
            x: illustrationRect.x + illustrationRect.width * 0.1,
            y: illustrationRect.y + 14,
            width: 64,
            height: 48
          }, { shadowBlur: 8, alpha: 0.94 });
        }
        if (landingAssets.levelPanelCloudLeft) {
          drawSticker(context, landingAssets.levelPanelCloudLeft, {
            x: illustrationRect.x + illustrationRect.width * 0.04,
            y: illustrationRect.y + illustrationRect.height * 0.5,
            width: 54,
            height: 42
          }, { shadowBlur: 6, alpha: 0.86 });
        }
        if (landingAssets.levelPanelCloudRight) {
          drawSticker(context, landingAssets.levelPanelCloudRight, {
            x: illustrationRect.x + illustrationRect.width - 58,
            y: illustrationRect.y + illustrationRect.height * 0.48,
            width: 54,
            height: 42
          }, { shadowBlur: 6, alpha: 0.86 });
        }
        drawEmptyTrophy(illustrationRect.x + illustrationRect.width / 2 - 8, illustrationRect.y + 10, compact ? 1 : 1.04);
        drawRuleBunnyPeek(context, {
          x: illustrationRect.x + illustrationRect.width * 0.54,
          y: illustrationRect.y + illustrationRect.height * 0.25,
          width: compact ? 84 : 92,
          height: compact ? 84 : 92
        });
      }
      if (landingAssets.levelPanelSparkleWhite) {
        drawSticker(context, landingAssets.levelPanelSparkleWhite, {
          x: illustrationRect.x + 10,
          y: illustrationRect.y + 28,
          width: 14,
          height: 14
        }, { shadowBlur: 2, alpha: 0.92 });
        drawSticker(context, landingAssets.levelPanelSparkleWhite, {
          x: illustrationRect.x + illustrationRect.width - 26,
          y: illustrationRect.y + 34,
          width: 12,
          height: 12
        }, { shadowBlur: 2, alpha: 0.84 });
      }
      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#7f5c69";
      context.font = `${compact ? "700 18px" : "700 20px"} sans-serif`;
      const emptyMessage = t(locale, "landing.emptyLeaderboard");
      const lines = measureWrappedText(context, emptyMessage, rect.width - 44).slice(0, 2);
      const lineHeight = compact ? 24 : 27;
      const startY = rect.y + rect.height * 0.62;
      lines.forEach((line, index) => {
        context.fillText(line, rect.x + rect.width / 2, startY + index * lineHeight);
      });
      context.restore();
    };
    const drawCenteredNote = (text, x, y, width) => {
      context.save();
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "rgba(156, 105, 124, 0.76)";
      context.font = `${compact ? "600 12px" : "600 13px"} sans-serif`;
      const lines = measureWrappedText(context, text, width).slice(0, 2);
      const lineHeight = compact ? 15 : 16;
      lines.forEach((line, index) => {
        context.fillText(line, x, y + index * lineHeight);
      });
      context.restore();
    };
    const drawCurvedTitle = (text, centerX, centerY) => {
      const chars = Array.from(text);
      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = compact ? 6 : 6.5;
      context.strokeStyle = "rgba(255,255,255,0.98)";
      context.fillStyle = "#8457ee";
      context.shadowColor = "rgba(143, 101, 229, 0.30)";
      context.shadowBlur = compact ? 8 : 10;
      context.shadowOffsetY = compact ? 2 : 3;
      context.font = `${compact ? "900 28px" : "900 31px"} sans-serif`;
      const charWidths = chars.map((char) => context.measureText(char).width);
      const totalTextWidth = charWidths.reduce((sum, value) => sum + value, 0);
      const letterSpacing = compact ? 0.5 : 0.8;
      const totalWidth = totalTextWidth + letterSpacing * Math.max(0, chars.length - 1);
      const arcStrength = compact ? 7.2 : 8.4;
      const startX = centerX - totalWidth / 2;
      let cursorX = startX;
      chars.forEach((char, index) => {
        const width = charWidths[index];
        const progress = chars.length <= 1 ? 0 : index / (chars.length - 1);
        const curve = Math.sin(progress * Math.PI) * arcStrength;
        const charX = cursorX + width / 2;
        context.save();
        context.translate(charX, centerY - curve);
        context.rotate((progress - 0.5) * 0.05);
        context.strokeText(char, 0, 0);
        context.fillText(char, 0, 0);
        context.restore();
        cursorX += width + letterSpacing;
      });
      context.restore();
    };
    const titleRibbonWidth = panelRect.width - (compact ? 26 : 32);
    const titleRibbonRect = {
      x: panelRect.x + (panelRect.width - titleRibbonWidth) / 2,
      y: panelRect.y - (compact ? 22 : 24),
      width: titleRibbonWidth,
      height: Math.round(titleRibbonWidth / (2074 / 571))
    };
    const titleAreaHeight = compact ? 152 : 166;
    const contentRect = {
      x: panelRect.x + (compact ? 16 : 18),
      y: panelRect.y + titleAreaHeight,
      width: panelRect.width - (compact ? 32 : 36),
      height: panelRect.height - titleAreaHeight - (compact ? 56 : 60)
    };
    drawSticker(context, landingAssets.levelPanelStarBigYellow, {
      x: panelRect.x - (compact ? 16 : 20),
      y: panelRect.y + (compact ? 14 : 18),
      width: compact ? 44 : 50,
      height: compact ? 44 : 50
    }, { shadowBlur: 4, alpha: 0.94 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + 18,
      y: panelRect.y + 92,
      width: 16,
      height: 16
    }, { shadowBlur: 3, alpha: 0.9 });
    drawSticker(context, landingAssets.levelPanelHeartPink, {
      x: panelRect.x + panelRect.width - (compact ? 38 : 42),
      y: panelRect.y + 72,
      width: compact ? 24 : 28,
      height: compact ? 24 : 28
    }, { shadowBlur: 4, alpha: 0.96 });
    drawSticker(context, landingAssets.settingsCloudClusterLeft, {
      x: panelRect.x - (compact ? 8 : 10),
      y: panelRect.y + panelRect.height - (compact ? 46 : 54),
      width: compact ? 70 : 78,
      height: compact ? 56 : 62
    }, { shadowBlur: 6, alpha: 0.94 });
    if (landingAssets.levelPanelCloudRight) {
      drawSticker(context, landingAssets.levelPanelCloudRight, {
        x: panelRect.x + panelRect.width - (compact ? 58 : 66),
        y: panelRect.y + panelRect.height - (compact ? 58 : 64),
        width: compact ? 58 : 66,
        height: compact ? 58 : 66
      }, { shadowBlur: 6, alpha: 0.92 });
    }
    drawRibbon(titleRibbonRect);
    if (landingAssets.leaderboardBunnyPeekLeft) {
      drawSticker(context, landingAssets.leaderboardBunnyPeekLeft, {
        x: titleRibbonRect.x - (compact ? 6 : 8),
        y: titleRibbonRect.y - (compact ? 26 : 30),
        width: compact ? 90 : 98,
        height: compact ? 94 : 102
      }, { shadowBlur: 8, alpha: 0.98 });
    } else {
      drawRuleBunnyPeek(context, {
        x: titleRibbonRect.x + (compact ? 4 : 6),
        y: titleRibbonRect.y - (compact ? 10 : 12),
        width: compact ? 84 : 92,
        height: compact ? 84 : 92
      });
    }
    if (landingAssets.leaderboardRainbowCloud) {
      drawSticker(context, landingAssets.leaderboardRainbowCloud, {
        x: titleRibbonRect.x + titleRibbonRect.width - (compact ? 54 : 64),
        y: titleRibbonRect.y + titleRibbonRect.height - (compact ? 18 : 22),
        width: compact ? 72 : 82,
        height: compact ? 40 : 46
      }, { shadowBlur: 6, alpha: 0.96 });
    }
    drawSticker(context, landingAssets.levelPanelHeartPink, {
      x: titleRibbonRect.x + titleRibbonRect.width - (compact ? 34 : 38),
      y: titleRibbonRect.y + (compact ? 20 : 24),
      width: compact ? 22 : 24,
      height: compact ? 22 : 24
    }, { shadowBlur: 4, alpha: 0.96 });
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 5;
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#7d5ae6";
    context.font = `${compact ? "900 27px" : "900 30px"} sans-serif`;
    const leaderboardTitle = t(locale, "landing.weeklyLeaderboard");
    if (/^[\u4e00-\u9fff]+$/.test(leaderboardTitle) && leaderboardTitle.length <= 8) {
      drawCurvedTitle(leaderboardTitle, titleRibbonRect.x + titleRibbonRect.width / 2, titleRibbonRect.y + titleRibbonRect.height / 2 + 1);
    } else {
      context.strokeText(leaderboardTitle, titleRibbonRect.x + titleRibbonRect.width / 2, titleRibbonRect.y + titleRibbonRect.height / 2 + 1);
      context.fillText(leaderboardTitle, titleRibbonRect.x + titleRibbonRect.width / 2, titleRibbonRect.y + titleRibbonRect.height / 2 + 1);
    }
    context.restore();
    drawCenteredNote(
      t(locale, "landing.localWeeklyNote"),
      panelRect.x + panelRect.width / 2,
      panelRect.y + (compact ? 108 : 114),
      panelRect.width - (compact ? 68 : 80)
    );
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + (compact ? 44 : 52),
      y: panelRect.y + (compact ? 112 : 118),
      width: 10,
      height: 10
    }, { shadowBlur: 2, alpha: 0.82 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + panelRect.width - (compact ? 54 : 62),
      y: panelRect.y + (compact ? 112 : 118),
      width: 10,
      height: 10
    }, { shadowBlur: 2, alpha: 0.82 });
    drawTextFrame(context, contentRect, {
      radius: compact ? 24 : 26,
      fill: "rgba(255,255,255,0.82)",
      stroke: "rgba(255, 206, 221, 0.95)"
    });
    context.save();
    context.setLineDash([7, 6]);
    context.strokeStyle = "rgba(255, 168, 194, 0.52)";
    context.lineWidth = 1.2;
    roundRect(context, {
      x: contentRect.x + 8,
      y: contentRect.y + 8,
      width: contentRect.width - 16,
      height: contentRect.height - 16
    }, (compact ? 24 : 26) - 6);
    context.stroke();
    context.restore();
    const entries = weeklyLeaderboard.slice(0, 6);
    if (entries.length === 0) {
      drawEmptyState(contentRect);
    } else {
      const rowCount = entries.length;
      const rowGap = compact ? 8 : 10;
      const rowArea = {
        x: contentRect.x + (compact ? 10 : 12),
        y: contentRect.y + (compact ? 12 : 14),
        width: contentRect.width - (compact ? 20 : 24),
        height: contentRect.height - (compact ? 24 : 28)
      };
      const rowHeight = Math.max(
        compact ? 40 : 44,
        Math.min(
          compact ? 48 : 52,
          Math.floor((rowArea.height - rowGap * (rowCount - 1)) / rowCount)
        )
      );
      const totalRowsHeight = rowCount * rowHeight + rowGap * (rowCount - 1);
      const rowStartY = rowArea.y + Math.max(0, (rowArea.height - totalRowsHeight) / 2);
      entries.forEach((entry, index) => {
        const rowRect = {
          x: rowArea.x,
          y: rowStartY + index * (rowHeight + rowGap),
          width: rowArea.width,
          height: rowHeight
        };
        const topThree = index < 3;
        const rowGradient = context.createLinearGradient(rowRect.x, rowRect.y, rowRect.x, rowRect.y + rowRect.height);
        if (index === 0) {
          rowGradient.addColorStop(0, "rgba(255, 248, 220, 0.96)");
          rowGradient.addColorStop(1, "rgba(255, 233, 181, 0.92)");
        } else if (index === 1) {
          rowGradient.addColorStop(0, "rgba(245, 236, 255, 0.96)");
          rowGradient.addColorStop(1, "rgba(229, 216, 255, 0.92)");
        } else if (index === 2) {
          rowGradient.addColorStop(0, "rgba(236, 247, 255, 0.96)");
          rowGradient.addColorStop(1, "rgba(211, 236, 255, 0.92)");
        } else {
          rowGradient.addColorStop(0, "rgba(255,255,255,0.74)");
          rowGradient.addColorStop(1, "rgba(255,247,250,0.58)");
        }
        context.save();
        context.fillStyle = rowGradient;
        context.strokeStyle = topThree ? "rgba(255, 208, 221, 0.96)" : "rgba(255, 225, 233, 0.94)";
        context.lineWidth = 1.2;
        context.shadowColor = topThree ? "rgba(180, 128, 158, 0.16)" : "rgba(180, 128, 158, 0.10)";
        context.shadowBlur = topThree ? 10 : 8;
        context.shadowOffsetY = 4;
        roundRect(context, rowRect, compact ? 15 : 16);
        context.fill();
        context.shadowColor = "transparent";
        context.stroke();
        context.save();
        context.setLineDash([5, 4]);
        context.strokeStyle = "rgba(255,255,255,0.88)";
        context.lineWidth = 1;
        roundRect(context, {
          x: rowRect.x + 6,
          y: rowRect.y + 6,
          width: rowRect.width - 12,
          height: rowRect.height - 12
        }, (compact ? 15 : 16) - 5);
        context.stroke();
        context.restore();
        if (index < rowCount - 1) {
          context.save();
          context.setLineDash([4, 5]);
          context.strokeStyle = "rgba(250, 194, 213, 0.74)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(rowRect.x + 18, rowRect.y + rowRect.height + 4);
          context.lineTo(rowRect.x + rowRect.width - 18, rowRect.y + rowRect.height + 4);
          context.stroke();
          context.restore();
        }
        const badgeSize = compact ? 30 : 32;
        const badgeRect = {
          x: rowRect.x + 14,
          y: rowRect.y + (rowRect.height - badgeSize) / 2,
          width: badgeSize,
          height: badgeSize
        };
        const badgeGradient = context.createLinearGradient(badgeRect.x, badgeRect.y, badgeRect.x, badgeRect.y + badgeRect.height);
        if (index === 0) {
          badgeGradient.addColorStop(0, "#ffd86e");
          badgeGradient.addColorStop(1, "#ffae19");
        } else if (index === 1) {
          badgeGradient.addColorStop(0, "#d9c8ff");
          badgeGradient.addColorStop(1, "#a278ff");
        } else if (index === 2) {
          badgeGradient.addColorStop(0, "#c9eeff");
          badgeGradient.addColorStop(1, "#66bfff");
        } else {
          badgeGradient.addColorStop(0, "#fff6f3");
          badgeGradient.addColorStop(1, "#ffe4eb");
        }
        context.save();
        context.fillStyle = badgeGradient;
        context.strokeStyle = topThree ? "rgba(255,255,255,0.95)" : "rgba(255, 216, 227, 0.95)";
        context.lineWidth = 1.4;
        context.shadowColor = topThree ? "rgba(178, 117, 146, 0.20)" : "rgba(178, 117, 146, 0.10)";
        context.shadowBlur = 8;
        context.shadowOffsetY = 3;
        roundRect(context, badgeRect, badgeRect.height / 2 - 2);
        context.fill();
        context.shadowColor = "transparent";
        context.stroke();
        context.fillStyle = index < 3 ? "#ffffff" : "#7b5364";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `700 ${compact ? 15 : 16}px sans-serif`;
        context.fillText(String(index + 1), badgeRect.x + badgeRect.width / 2, badgeRect.y + badgeRect.height / 2 + 0.5);
        context.restore();
        context.save();
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillStyle = topThree ? "#7a4b61" : "#8a6573";
        context.font = `${compact ? "700 16px" : "700 18px"} sans-serif`;
        context.fillText(
          formatDuration(entry.durationMs),
          badgeRect.x + badgeRect.width + (compact ? 12 : 14),
          rowRect.y + rowRect.height / 2 + 0.5
        );
        context.restore();
      });
    }
    if (landingAssets.levelPanelSparkleWhite) {
      drawSticker(context, landingAssets.levelPanelSparkleWhite, {
        x: panelRect.x + 14,
        y: panelRect.y + panelRect.height - (compact ? 30 : 32),
        width: 12,
        height: 12
      }, { shadowBlur: 2, alpha: 0.82 });
      drawSticker(context, landingAssets.levelPanelSparkleWhite, {
        x: panelRect.x + panelRect.width - 26,
        y: panelRect.y + panelRect.height - (compact ? 32 : 34),
        width: 12,
        height: 12
      }, { shadowBlur: 2, alpha: 0.82 });
    }
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(185, 140, 159, 0.62)";
    context.font = `${compact ? "600 12px" : "600 13px"} sans-serif`;
    context.fillText(
      t(locale, "landing.close"),
      panelRect.x + panelRect.width / 2,
      panelRect.y + panelRect.height - (compact ? 24 : 26)
    );
    context.restore();
  }
  function drawLevelPanel(snapshot) {
    var _a;
    const context = surface.getContext2D();
    const totalLevels = levels.length;
    const columns = 6;
    const rows = Math.ceil(totalLevels / columns);
    const completedCount = Object.keys(snapshot.records).length;
    const unlockedCount = Math.min(totalLevels, Math.max(1, completedCount + 1));
    const gap = Math.max(8, Math.round(Math.min(metrics.width, metrics.height) * 0.018));
    const panelWidth = Math.min(metrics.width - 20, 388);
    const tileSizeByWidth = Math.floor((panelWidth - 32 - gap * (columns - 1)) / columns);
    const tileSizeByHeight = Math.floor(
      (metrics.height - layout.safeTop - layout.safeBottom - 190 - gap * (rows - 1)) / rows
    );
    const tileSize = Math.max(40, Math.min(tileSizeByWidth, tileSizeByHeight));
    const gridWidth = columns * tileSize + gap * (columns - 1);
    const gridHeight = rows * tileSize + gap * (rows - 1);
    const titleAreaHeight = 92;
    const panelHeight = titleAreaHeight + gridHeight + 28;
    const panelX = (metrics.width - panelWidth) / 2;
    const panelY = Math.max(layout.topInset + 18, (metrics.height - panelHeight) / 2 - 4);
    const panelRect = {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight
    };
    const gridShellRect = {
      x: panelX + 12,
      y: panelY + titleAreaHeight - 4,
      width: panelWidth - 24,
      height: gridHeight + 24
    };
    const gridStartX = gridShellRect.x + Math.max(0, (gridShellRect.width - gridWidth) / 2);
    const gridStartY = gridShellRect.y + 10;
    levelTiles = [];
    context.save();
    const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
    overlayGradient.addColorStop(0, "rgba(255, 185, 211, 0.42)");
    overlayGradient.addColorStop(0.52, "rgba(255, 214, 228, 0.30)");
    overlayGradient.addColorStop(1, "rgba(255, 243, 249, 0.24)");
    context.fillStyle = overlayGradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    const glow = context.createRadialGradient(
      metrics.width / 2,
      panelRect.y + panelRect.height * 0.45,
      24,
      metrics.width / 2,
      panelRect.y + panelRect.height * 0.45,
      metrics.width * 0.72
    );
    glow.addColorStop(0, "rgba(255,255,255,0.18)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, metrics.width, metrics.height);
    const panelGradient = context.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panelGradient.addColorStop(0, "rgba(255, 252, 250, 0.98)");
    panelGradient.addColorStop(0.6, "rgba(255, 244, 247, 0.96)");
    panelGradient.addColorStop(1, "rgba(255, 239, 245, 0.94)");
    context.fillStyle = panelGradient;
    context.strokeStyle = "rgba(255, 208, 221, 0.98)";
    context.lineWidth = 2;
    context.shadowColor = "rgba(228, 132, 172, 0.24)";
    context.shadowBlur = 30;
    context.shadowOffsetY = 12;
    roundRect(context, panelRect, 30);
    context.fill();
    context.stroke();
    context.shadowColor = "transparent";
    context.save();
    context.setLineDash([6, 5]);
    context.strokeStyle = "rgba(255,255,255,0.92)";
    context.lineWidth = 1.4;
    roundRect(context, {
      x: panelRect.x + 8,
      y: panelRect.y + 8,
      width: panelRect.width - 16,
      height: panelRect.height - 16
    }, 22);
    context.stroke();
    context.restore();
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#dc4b79";
    context.font = "700 28px sans-serif";
    context.shadowColor = "rgba(255,255,255,0.52)";
    context.shadowBlur = 2;
    context.fillText(t(locale, "section.levels"), panelRect.x + panelRect.width / 2, panelRect.y + 24);
    const subtitleText = t(locale, "level.collectionMeta", {
      completed: completedCount,
      total: totalLevels
    });
    drawWrappedText(
      context,
      subtitleText,
      {
        x: panelRect.x + 30,
        y: panelRect.y + 58,
        width: panelRect.width - 60,
        height: 28
      },
      {
        font: "500 12px sans-serif",
        color: THEME.textSecondary,
        lineHeight: 15,
        maxLines: 2
      }
    );
    context.shadowColor = "transparent";
    context.save();
    const gridShellGradient = context.createLinearGradient(
      gridShellRect.x,
      gridShellRect.y,
      gridShellRect.x,
      gridShellRect.y + gridShellRect.height
    );
    gridShellGradient.addColorStop(0, "rgba(255, 255, 255, 0.93)");
    gridShellGradient.addColorStop(1, "rgba(255, 244, 247, 0.90)");
    context.fillStyle = gridShellGradient;
    context.strokeStyle = "rgba(255, 211, 223, 0.96)";
    context.lineWidth = 1.8;
    context.shadowColor = "rgba(224, 133, 168, 0.18)";
    context.shadowBlur = 20;
    context.shadowOffsetY = 8;
    roundRect(context, gridShellRect, 24);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.save();
    context.setLineDash([6, 6]);
    context.strokeStyle = "rgba(255,255,255,0.92)";
    context.lineWidth = 1.2;
    roundRect(context, {
      x: gridShellRect.x + 8,
      y: gridShellRect.y + 8,
      width: gridShellRect.width - 16,
      height: gridShellRect.height - 16
    }, 18);
    context.stroke();
    context.restore();
    context.restore();
    for (let slot = 0; slot < totalLevels; slot += 1) {
      const col = slot % columns;
      const row = Math.floor(slot / columns);
      const x = gridStartX + col * (tileSize + gap);
      const y = gridStartY + row * (tileSize + gap);
      const level = levels[slot];
      const record = (_a = snapshot.records[level.id]) != null ? _a : null;
      const completed = Boolean(record);
      const isCurrent = snapshot.levelIndex === slot;
      const isViewing = isCurrent && snapshot.mode === "record";
      const isLocked = !completed && slot >= unlockedCount && !isCurrent;
      const tileRect = { x, y, width: tileSize, height: tileSize };
      const tileRadius = 14;
      const tileGradient = context.createLinearGradient(x, y, x, y + tileSize);
      if (isCurrent) {
        if (isViewing) {
          tileGradient.addColorStop(0, "#e8f8ff");
          tileGradient.addColorStop(1, "#c9eeff");
        } else {
          tileGradient.addColorStop(0, "#fff2a5");
          tileGradient.addColorStop(1, "#ffc84e");
        }
      } else if (completed) {
        tileGradient.addColorStop(0, "#fffdf9");
        tileGradient.addColorStop(1, "#fff1e8");
      } else if (isLocked) {
        tileGradient.addColorStop(0, "rgba(255,255,255,0.58)");
        tileGradient.addColorStop(1, "rgba(245, 239, 243, 0.44)");
      } else {
        tileGradient.addColorStop(0, "#fffdf9");
        tileGradient.addColorStop(1, "#fff8f1");
      }
      context.save();
      context.fillStyle = tileGradient;
      context.strokeStyle = isCurrent ? isViewing ? "rgba(121, 191, 255, 0.98)" : "rgba(255, 211, 102, 0.98)" : completed ? "rgba(244, 208, 182, 0.92)" : isLocked ? "rgba(222, 211, 219, 0.78)" : "rgba(248, 211, 204, 0.92)";
      context.lineWidth = isCurrent ? 2.4 : 1.5;
      context.shadowColor = isCurrent ? isViewing ? "rgba(113, 184, 255, 0.28)" : "rgba(255, 198, 81, 0.50)" : completed ? "rgba(221, 156, 119, 0.18)" : isLocked ? "rgba(0,0,0,0.04)" : "rgba(226, 133, 158, 0.14)";
      context.shadowBlur = isCurrent ? 18 : 10;
      context.shadowOffsetY = 4;
      roundRect(context, tileRect, tileRadius);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.restore();
      context.save();
      context.setLineDash([4, 4]);
      context.strokeStyle = isCurrent ? isViewing ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.96)" : isLocked ? "rgba(255,255,255,0.54)" : "rgba(255,255,255,0.86)";
      context.lineWidth = 1.2;
      roundRect(context, {
        x: x + 4,
        y: y + 4,
        width: tileSize - 8,
        height: tileSize - 8
      }, Math.max(8, tileRadius - 4));
      context.stroke();
      context.restore();
      context.save();
      context.fillStyle = "rgba(255,255,255,0.26)";
      roundRect(context, { x: x + 4, y: y + 4, width: tileSize - 8, height: Math.max(4, tileSize * 0.16) }, 8);
      context.fill();
      context.restore();
      if (isCurrent) {
        context.save();
        context.fillStyle = isViewing ? "rgba(121, 191, 255, 0.28)" : "rgba(255, 244, 180, 0.44)";
        roundRect(context, { x: x + 5, y: y + 5, width: tileSize - 10, height: 7 }, 4);
        context.fill();
        context.restore();
      }
      context.save();
      if (isLocked) {
        context.globalAlpha = 0.62;
      }
      context.fillStyle = isCurrent ? isViewing ? "#5aa9ef" : "#9a5b00" : completed ? "#5d4351" : isLocked ? "#b49ea6" : THEME.textPrimary;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = isCurrent ? "800 18px sans-serif" : "700 17px sans-serif";
      context.fillText(String(slot + 1), x + tileSize / 2, y + tileSize / 2 + 1);
      context.restore();
      if (completed) {
        context.save();
        context.fillStyle = "rgba(122, 205, 90, 0.98)";
        context.beginPath();
        context.arc(x + tileSize - 11, y + 11, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = THEME.white;
        context.font = "700 10px sans-serif";
        context.fillText("✓", x + tileSize - 11, y + 11.5);
        context.restore();
      }
      if (isViewing) {
        context.save();
        context.fillStyle = THEME.infoSoft;
        roundRect(context, { x: x + 6, y: y + tileSize - 14, width: tileSize - 12, height: 8 }, 4);
        context.fill();
        context.restore();
      }
      if (isCurrent && !isViewing) {
        drawSticker(context, landingAssets.levelPanelStarFaceYellow, {
          x: x - 12,
          y: y - 12,
          width: Math.min(32, tileSize * 0.44),
          height: Math.min(32, tileSize * 0.44)
        }, { rotation: -8, shadowBlur: 8 });
      }
      if (isLocked) {
        context.save();
        const lockW = Math.max(9, Math.round(tileSize * 0.18));
        const lockH = Math.max(10, Math.round(tileSize * 0.18));
        const lockX = x + tileSize - lockW - 10;
        const lockY = y + 8;
        context.fillStyle = "rgba(255,255,255,0.78)";
        context.strokeStyle = "rgba(182, 164, 176, 0.70)";
        context.lineWidth = 1.1;
        roundRect(context, {
          x: lockX,
          y: lockY + 4,
          width: lockW,
          height: lockH
        }, 3);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(lockX + lockW / 2, lockY + 4, lockW / 3.2, Math.PI, 0);
        context.stroke();
        context.restore();
      }
      levelTiles.push({
        index: slot,
        rect: tileRect
      });
    }
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + 14,
      y: panelRect.y + panelRect.height - 44,
      width: 16,
      height: 16
    }, { shadowBlur: 6, alpha: 0.92 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + panelRect.width - 28,
      y: panelRect.y + panelRect.height - 42,
      width: 14,
      height: 14
    }, { shadowBlur: 6, alpha: 0.86 });
    drawSticker(context, landingAssets.levelPanelStarBigYellow, {
      x: panelRect.x - 8,
      y: panelRect.y - 18,
      width: 56,
      height: 56
    }, { rotation: -10, shadowBlur: 12 });
    drawSticker(context, landingAssets.levelPanelRibbonPink, {
      x: panelRect.x + 52,
      y: panelRect.y - 14,
      width: 56,
      height: 68
    }, { rotation: 4, shadowBlur: 12 });
    drawSticker(context, landingAssets.levelPanelCloudSmileHeart, {
      x: panelRect.x + panelRect.width - 112,
      y: panelRect.y - 18,
      width: 110,
      height: 84
    }, { rotation: 0, shadowBlur: 14 });
    drawSticker(context, landingAssets.levelPanelCloudLeft, {
      x: panelRect.x - 16,
      y: panelRect.y + panelRect.height - 62,
      width: 88,
      height: 66
    }, { rotation: -4, shadowBlur: 10 });
    drawSticker(context, landingAssets.levelPanelCloudRight, {
      x: panelRect.x + panelRect.width - 82,
      y: panelRect.y + panelRect.height - 58,
      width: 96,
      height: 64
    }, { rotation: 2, shadowBlur: 10 });
    drawSticker(context, landingAssets.levelPanelStarPink, {
      x: panelRect.x - 4,
      y: panelRect.y + panelRect.height - 104,
      width: 28,
      height: 28
    }, { rotation: -10, shadowBlur: 8 });
    drawSticker(context, landingAssets.levelPanelStarBlue, {
      x: panelRect.x + panelRect.width - 22,
      y: panelRect.y + 162,
      width: 26,
      height: 26
    }, { rotation: 8, shadowBlur: 8 });
    drawSticker(context, landingAssets.levelPanelHeartPink, {
      x: panelRect.x + panelRect.width - 30,
      y: panelRect.y + panelRect.height / 2 + 8,
      width: 34,
      height: 34
    }, { rotation: 10, shadowBlur: 8 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + 22,
      y: panelRect.y + 82,
      width: 18,
      height: 18
    }, { shadowBlur: 6, alpha: 0.95 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + panelRect.width - 42,
      y: panelRect.y + 86,
      width: 16,
      height: 16
    }, { shadowBlur: 6, alpha: 0.88 });
    context.restore();
  }
  function drawOverlay(snapshot) {
    if (uiState.homeOpen) {
      drawLandingScreen();
      if (uiState.leaderboardOpen) {
        drawLeaderboardPanel();
      }
      if (uiState.helpOpen) {
        drawInfoDialog("help");
      }
      if (uiState.goalOpen) {
        drawInfoDialog("goal");
      }
      return;
    }
    drawHeader(snapshot);
    drawInfoCards(snapshot);
    drawBoardDecorations();
    drawButtons(snapshot);
    drawAutoAdvanceBanner(snapshot);
    if (uiState.levelPanelOpen) {
      drawLevelPanel(snapshot);
    }
    if (uiState.leaderboardOpen) {
      drawLeaderboardPanel();
    }
    if (uiState.settingsOpen) {
      drawSettingsDialog();
    }
  }
  function render() {
    var _a;
    if (!uiState.homeOpen) {
      renderer.render(currentSnapshot, {
        labels: {
          solvedBadge: t(locale, "renderer.badgeSolved"),
          recordBadge: t(locale, "renderer.badgeRecord")
        },
        backdropImage: (_a = landingAssets.gameplayBackground) != null ? _a : landingAssets.background,
        theme: "kawaii",
        selectionAssets: {
          strawberry: landingAssets.selectionStrawberry,
          heartPink: landingAssets.selectionHeartPink,
          starYellow: landingAssets.selectionStarYellow,
          sparkleWhite: landingAssets.selectionSparkleWhite,
          bubblePink: landingAssets.selectionBubblePink,
          bubbleYellow: landingAssets.selectionBubbleYellow,
          dripYellow: landingAssets.selectionDripYellow
        },
        insets: {
          top: layout.topInset,
          bottom: layout.bottomInset
        }
      });
    }
    drawOverlay(currentSnapshot);
    syncFeedbackAudio(currentSnapshot);
    syncWeeklyLeaderboard(currentSnapshot);
    scheduleAutoAdvance(currentSnapshot);
  }
  function ensureAnimationLoop() {
    if (animationFrameId !== 0 || !renderer.hasActiveEffects() && !hasOverlayEffects()) {
      return;
    }
    animationFrameId = scheduleFrame(tick);
  }
  function tick() {
    animationFrameId = 0;
    render();
    if (renderer.hasActiveEffects() || hasOverlayEffects()) {
      animationFrameId = scheduleFrame(tick);
    }
  }
  function hasOverlayEffects() {
    return Date.now() < autoAdvanceBannerUntil;
  }
  function syncWeeklyLeaderboard(snapshot) {
    if (snapshot.mode !== "play" || !snapshot.solved || snapshot.hasNextLevel || Object.keys(snapshot.records).length !== levels.length || snapshot.effects.celebrationId === 0 || snapshot.effects.celebrationId === lastCampaignCompletionCelebrationId) {
      return;
    }
    lastCampaignCompletionCelebrationId = snapshot.effects.celebrationId;
    if (!campaignState) {
      return;
    }
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
    const durationMs = Math.max(0, Date.now() - campaignState.startedAt);
    weeklyLeaderboard = storage.recordWeeklyLeaderboardEntry(durationMs, completedAt);
    campaignState = null;
    storage.saveCampaignState(null);
  }
  function triggerVibration(type) {
    var _a;
    if (!userSettings.vibrationEnabled) {
      return;
    }
    try {
      (_a = wx.vibrateShort) == null ? void 0 : _a.call(wx, { type });
    } catch (e) {
    }
  }
  function syncFeedbackAudio(snapshot) {
    var _a, _b;
    const celebrationEffectId = snapshot.effects.celebrationId;
    const celebrationChanged = celebrationEffectId !== lastCelebrationEffectId;
    const suppressPlacement = celebrationChanged && celebrationEffectId > 0;
    const placementEffectId = (_b = (_a = snapshot.effects.placement) == null ? void 0 : _a.id) != null ? _b : 0;
    if (placementEffectId !== lastPlacementEffectId) {
      lastPlacementEffectId = placementEffectId;
      if (placementEffectId > 0 && !suppressPlacement) {
        audio.playPlacement();
        triggerVibration("light");
      }
    }
    if (snapshot.effects.invalidId !== lastInvalidEffectId) {
      lastInvalidEffectId = snapshot.effects.invalidId;
      if (snapshot.effects.invalidId > 0) {
        audio.playInvalid();
        triggerVibration("medium");
      }
    }
    if (celebrationChanged) {
      lastCelebrationEffectId = celebrationEffectId;
      if (celebrationEffectId > 0) {
        audio.playCelebration();
        triggerVibration("heavy");
      }
    }
    const comboVoice = snapshot.effects.comboVoice;
    if (comboVoice && comboVoice !== lastComboVoice) {
      lastComboVoice = comboVoice;
      audio.playComboVoice(comboVoice);
    }
    if (!comboVoice) {
      lastComboVoice = null;
    }
  }
  function scheduleAutoAdvance(snapshot) {
    if (snapshot.mode !== "play" || !snapshot.solved || !snapshot.hasNextLevel || snapshot.effects.celebrationId === 0 || snapshot.effects.celebrationId === lastAutoAdvanceCelebrationId) {
      return;
    }
    if (autoAdvanceTimeoutId !== 0) {
      globalThis.clearTimeout(autoAdvanceTimeoutId);
      autoAdvanceTimeoutId = 0;
    }
    lastAutoAdvanceCelebrationId = snapshot.effects.celebrationId;
    autoAdvanceBannerUntil = Date.now() + 1200;
    autoAdvanceTimeoutId = globalThis.setTimeout(() => {
      autoAdvanceTimeoutId = 0;
      const latest = game.getSnapshot();
      if (latest.mode === "play" && latest.solved && latest.hasNextLevel) {
        game.nextLevel();
      }
    }, 1200);
  }
  function drawAutoAdvanceBanner(snapshot) {
    if (!snapshot.solved || Date.now() >= autoAdvanceBannerUntil) {
      return;
    }
    const context = surface.getContext2D();
    const width = Math.min(metrics.width - 52, 248);
    const height = 62;
    const rect = {
      x: (metrics.width - width) / 2,
      y: layout.topInset + 10,
      width,
      height
    };
    context.save();
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, "#fff9da");
    gradient.addColorStop(1, "rgba(255,255,255,0.92)");
    context.fillStyle = gradient;
    context.strokeStyle = THEME.borderAccent;
    context.lineWidth = 1.2;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 22;
    context.shadowOffsetY = 10;
    roundRect(context, rect, 18);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = THEME.accent;
    context.font = "700 12px sans-serif";
    context.fillText(
      snapshot.hasNextLevel ? t(locale, "banner.nextLevel") : t(locale, "banner.allCleared"),
      rect.x + rect.width / 2,
      rect.y + 22
    );
    context.fillStyle = THEME.textPrimary;
    context.font = "700 18px sans-serif";
    context.fillText(
      snapshot.hasNextLevel ? t(locale, "renderer.badgeSolved") : t(locale, "banner.allCleared"),
      rect.x + rect.width / 2,
      rect.y + 42
    );
    context.restore();
  }
  function handleUiTap(x, y) {
    if (uiState.homeOpen) {
      uiState.pressedUiId = null;
      if (uiState.helpOpen || uiState.goalOpen) {
        const insidePanel = infoDialogPanelRect ? isPointInsideRect(x, y, infoDialogPanelRect) : false;
        const topButton = infoDialogTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
        if (topButton) {
          infoDialogOpenAt = Date.now();
          uiState.helpOpen = topButton.id === "help";
          uiState.goalOpen = topButton.id === "goal";
          render();
          return true;
        }
        if (infoDialogMenuRect && isPointInsideRect(x, y, infoDialogMenuRect)) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
          render();
          return true;
        }
        const closeButtonHit = infoDialogButtonRect ? isPointInsideRect(x, y, infoDialogButtonRect) : false;
        if (closeButtonHit) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
          render();
          return true;
        }
        if (infoDialogLeaderboardButtonRect && isPointInsideRect(x, y, infoDialogLeaderboardButtonRect)) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
          uiState.leaderboardOpen = true;
        }
        if (closeButtonHit || !insidePanel) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
        }
        render();
        return true;
      }
      if (uiState.leaderboardOpen) {
        if (!leaderboardPanelRect || !isPointInsideRect(x, y, leaderboardPanelRect)) {
          uiState.leaderboardOpen = false;
        }
        render();
        return true;
      }
      const topIconButton = topIconButtons.find((item) => isPointInsideRect(x, y, item.rect));
      if (topIconButton) {
        if (topIconButton.id === "help") {
          uiState.helpOpen = true;
          uiState.goalOpen = false;
        } else {
          uiState.goalOpen = true;
          uiState.helpOpen = false;
        }
        infoDialogOpenAt = Date.now();
        render();
        return true;
      }
      const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
      if (!homeButton) {
        render();
        return true;
      }
      if (homeButton.id === "newGame") {
        game.resetCampaign();
        campaignState = {
          startedAt: Date.now(),
          weekKey: getWeeklyBucketKey()
        };
        storage.saveCampaignState(campaignState);
        uiState.homeOpen = false;
        uiState.leaderboardOpen = false;
        uiState.helpOpen = false;
        uiState.goalOpen = false;
        render();
        return true;
      }
      uiState.leaderboardOpen = true;
      render();
      return true;
    }
    if (uiState.settingsOpen) {
      uiState.pressedUiId = null;
      const insidePanel = settingsDialogPanelRect ? isPointInsideRect(x, y, settingsDialogPanelRect) : false;
      if (soundToggleRect && isPointInsideRect(x, y, soundToggleRect)) {
        userSettings = {
          ...userSettings,
          soundEnabled: !userSettings.soundEnabled
        };
        audio.setEnabled(userSettings.soundEnabled);
        backgroundMusic.setEnabled(userSettings.soundEnabled);
        saveUserSettings(storageAdapter, userSettings);
        render();
        return true;
      }
      if (vibrationToggleRect && isPointInsideRect(x, y, vibrationToggleRect)) {
        userSettings = {
          ...userSettings,
          vibrationEnabled: !userSettings.vibrationEnabled
        };
        saveUserSettings(storageAdapter, userSettings);
        if (userSettings.vibrationEnabled) {
          triggerVibration("light");
        }
        render();
        return true;
      }
      if (settingsBackButtonRect && isPointInsideRect(x, y, settingsBackButtonRect)) {
        uiState.settingsOpen = false;
        uiState.leaderboardOpen = false;
        uiState.levelPanelOpen = false;
        uiState.homeOpen = true;
        render();
        return true;
      }
      if (settingsContinueButtonRect && isPointInsideRect(x, y, settingsContinueButtonRect)) {
        uiState.settingsOpen = false;
        render();
        return true;
      }
      if (!insidePanel) {
        uiState.settingsOpen = false;
        render();
        return true;
      }
      render();
      return true;
    }
    if (uiState.leaderboardOpen) {
      if (!leaderboardPanelRect || !isPointInsideRect(x, y, leaderboardPanelRect)) {
        uiState.leaderboardOpen = false;
      }
      render();
      return true;
    }
    const gameTopButton = gameTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
    if (gameTopButton) {
      uiState.pressedUiId = null;
      if (gameTopButton.id === "settings") {
        uiState.settingsOpen = true;
      } else {
        uiState.leaderboardOpen = true;
      }
      render();
      return true;
    }
    if (uiState.levelPanelOpen) {
      const tile = levelTiles.find((item) => isPointInsideRect(x, y, item.rect));
      uiState.pressedUiId = null;
      if (tile) {
        const snapshot = game.getSnapshot();
        const level = levels[tile.index];
        const completed = Boolean(snapshot.records[level.id]);
        const unlockedCount = Math.min(levels.length, Math.max(1, Object.keys(snapshot.records).length + 1));
        const isLocked = !completed && tile.index >= unlockedCount && snapshot.levelIndex !== tile.index;
        if (completed) {
          game.viewRecordedLevel(tile.index);
          uiState.levelPanelOpen = false;
          render();
          return true;
        }
        if (!isLocked) {
          game.setLevel(tile.index);
          uiState.levelPanelOpen = false;
          render();
          return true;
        }
        render();
        return true;
      }
      uiState.levelPanelOpen = false;
      render();
      return true;
    }
    const button = buttons.find((item) => item.enabled && isPointInsideRect(x, y, item.rect));
    uiState.pressedUiId = null;
    if (!button) {
      render();
      return false;
    }
    switch (button.id) {
      case "levels":
        uiState.levelPanelOpen = true;
        render();
        return true;
      case "undo":
        game.undo();
        return true;
      case "restart":
        game.resetLevel();
        return true;
      case "hint":
        game.requestHint();
        return true;
      case "next":
        game.nextLevel();
        return true;
    }
  }
  function updatePressedUi(x, y) {
    if (uiState.homeOpen) {
      if (uiState.helpOpen || uiState.goalOpen) {
        const topButton = infoDialogTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
        if (topButton) {
          uiState.pressedUiId = `icon:${topButton.id}`;
        } else if (infoDialogMenuRect && isPointInsideRect(x, y, infoDialogMenuRect)) {
          uiState.pressedUiId = "dialog:menu";
        } else if (infoDialogButtonRect && isPointInsideRect(x, y, infoDialogButtonRect)) {
          uiState.pressedUiId = "dialog:close";
        } else if (infoDialogLeaderboardButtonRect && isPointInsideRect(x, y, infoDialogLeaderboardButtonRect)) {
          uiState.pressedUiId = "dialog:leaderboard";
        } else {
          uiState.pressedUiId = null;
        }
        render();
        return;
      }
      if (uiState.leaderboardOpen) {
        uiState.pressedUiId = null;
        render();
        return;
      }
      const topIconButton = topIconButtons.find((item) => isPointInsideRect(x, y, item.rect));
      if (topIconButton) {
        uiState.pressedUiId = `icon:${topIconButton.id}`;
        render();
        return;
      }
      const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
      uiState.pressedUiId = homeButton ? `home:${homeButton.id}` : null;
      render();
      return;
    }
    if (uiState.levelPanelOpen || uiState.leaderboardOpen || uiState.settingsOpen) {
      uiState.pressedUiId = null;
      render();
      return;
    }
    const gameTopButton = gameTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
    if (gameTopButton) {
      uiState.pressedUiId = `icon:${gameTopButton.id}`;
      render();
      return;
    }
    const button = buttons.find((item) => item.enabled && isPointInsideRect(x, y, item.rect));
    uiState.pressedUiId = button ? `toolbar:${button.id}` : null;
    render();
  }
  game.subscribe((snapshot) => {
    currentSnapshot = snapshot;
    render();
    ensureAnimationLoop();
  });
  wx.onTouchStart((event) => {
    var _a, _b, _c, _d, _e, _f, _g;
    audio.prime();
    backgroundMusic.prime();
    const touch = (_c = (_a = event.changedTouches) == null ? void 0 : _a[0]) != null ? _c : (_b = event.touches) == null ? void 0 : _b[0];
    if (!touch) {
      return;
    }
    const x = (_e = (_d = touch.clientX) != null ? _d : touch.x) != null ? _e : touch.pageX;
    const y = (_g = (_f = touch.clientY) != null ? _f : touch.y) != null ? _g : touch.pageY;
    if (typeof x !== "number" || typeof y !== "number") {
      return;
    }
    updatePressedUi(x, y);
  });
  wx.onTouchEnd((event) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const touch = (_c = (_a = event.changedTouches) == null ? void 0 : _a[0]) != null ? _c : (_b = event.touches) == null ? void 0 : _b[0];
    if (!touch) {
      return;
    }
    const x = (_e = (_d = touch.clientX) != null ? _d : touch.x) != null ? _e : touch.pageX;
    const y = (_g = (_f = touch.clientY) != null ? _f : touch.y) != null ? _g : touch.pageY;
    if (typeof x !== "number" || typeof y !== "number") {
      return;
    }
    handleUiTap(x, y);
  });
  wx.onTouchCancel(() => {
    if (uiState.pressedUiId) {
      uiState.pressedUiId = null;
      render();
    }
  });
  const debugApi = {
    nextLevel: () => game.nextLevel(),
    resetLevel: () => game.resetLevel(),
    undo: () => game.undo(),
    hint: () => game.requestHint(),
    setLevel: (index) => game.setLevel(index),
    snapshot: () => game.getSnapshot()
  };
  globalThis.__PATCH_GRID_DEBUG__ = debugApi;
  render();
}
try {
  drawBootstrapSplash();
  void bootstrapWechatGame().catch((error) => {
    console.error("[Fill Grid] WeChat bootstrap failed:", error);
    drawBootstrapError(error);
  });
} catch (error) {
  console.error("[Fill Grid] WeChat bootstrap failed:", error);
  drawBootstrapError(error);
}
