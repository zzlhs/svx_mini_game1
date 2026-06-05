"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
    playClip(source) {
      var _a, _b, _c, _d;
      const wxAudio = getWechatAudioApi();
      const audio = (_a = wxAudio == null ? void 0 : wxAudio.createInnerAudioContext) == null ? void 0 : _a.call(wxAudio);
      if (!audio) {
        return;
      }
      audio.autoplay = false;
      audio.src = source;
      audio.volume = 0.9;
      if ("obeyMuteSwitch" in audio) {
        audio.obeyMuteSwitch = false;
      }
      const cleanup = () => {
        var _a2, _b2;
        try {
          (_a2 = audio.stop) == null ? void 0 : _a2.call(audio);
        } catch (e) {
        }
        (_b2 = audio.destroy) == null ? void 0 : _b2.call(audio);
      };
      (_b = audio.onEnded) == null ? void 0 : _b.call(audio, () => cleanup());
      (_c = audio.onStop) == null ? void 0 : _c.call(audio, () => cleanup());
      (_d = audio.onError) == null ? void 0 : _d.call(audio, () => cleanup());
      if (!this.primed) {
        this.primed = true;
      }
      try {
        audio.play();
        globalThis.setTimeout(() => {
          cleanup();
        }, 1500);
      } catch (e) {
        cleanup();
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
    constructor() {
      __publicField(this, "backend", createAudioBackend());
      __publicField(this, "enabled", true);
    }
    prime() {
      if (!this.enabled) {
        return;
      }
      this.backend.prime();
    }
    setEnabled(enabled) {
      this.enabled = enabled;
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
      this.backend.playCelebration();
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
      __publicField(this, "effects", {
        placement: null,
        invalidId: 0,
        celebrationId: 0
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
        this.effects = {
          ...this.effects,
          placement: {
            id: this.effects.placement ? this.effects.placement.id + 1 : 1,
            placementId: latestPlacementId
          }
        };
        const covered = getCoveredCellCount(this.level, this.placements);
        this.solved = isBoardSolved(this.level, this.placements);
        if (this.solved) {
          const record = this.saveCompletionRecord();
          this.effects = {
            ...this.effects,
            celebrationId: this.effects.celebrationId + 1
          };
          this.status = {
            key: "status.solvedWithDuration",
            values: { duration: this.formatDuration(record.durationMs) }
          };
        } else {
          this.status = {
            key: "status.coveredProgress",
            values: { covered, total: this.level.width * this.level.height }
          };
        }
      } else {
        this.effects = {
          ...this.effects,
          invalidId: this.effects.invalidId + 1
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
      this.solved = true;
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
      this.attemptStartedAt = Date.now();
      this.effects = {
        ...this.effects,
        placement: null
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
      "settings.backHome": "回到主页",
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
      "chip.solved": "通关",
      "chip.ready": "可放置",
      "chip.active": "进行中",
      "tile.completed": "{levelName}，已完成，用时 {duration}",
      "tile.incomplete": "{levelName}，未完成",
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
      "settings.backHome": "Back Home",
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
      this.surface = surface;
      this.context = surface.getContext2D();
    }
    render(snapshot, options) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const now = getNow();
      const surfaceSize = this.surface.syncSize();
      this.insets = {
        top: (_b = (_a = options.insets) == null ? void 0 : _a.top) != null ? _b : 0,
        right: (_d = (_c = options.insets) == null ? void 0 : _c.right) != null ? _d : 0,
        bottom: (_f = (_e = options.insets) == null ? void 0 : _e.bottom) != null ? _f : 0,
        left: (_h = (_g = options.insets) == null ? void 0 : _g.left) != null ? _h : 0
      };
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
      this.drawPlacements(placements, now);
      if (hintSuggestion) {
        this.drawHint(hintSuggestion.rect);
      }
      if (preview) {
        this.drawPreview(preview.rect, preview.validation.ok, preview.validation.clue);
      }
      this.drawGrid(level);
      this.drawClues(level, placements);
      const selectedPlacement = (_i = placements.find((placement) => placement.id === selectedPlacementId)) != null ? _i : null;
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
      const basePadding = Math.max(18, Math.min(width, height) * 0.05);
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
      const frameInset = 14;
      context.save();
      const gradient = context.createLinearGradient(
        metrics.offsetX,
        metrics.offsetY - frameInset,
        metrics.offsetX,
        metrics.offsetY + metrics.boardHeight + frameInset
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(1, "rgba(234, 249, 255, 0.86)");
      context.fillStyle = gradient;
      context.strokeStyle = "rgba(255,255,255,0.88)";
      context.lineWidth = 2.8;
      context.shadowColor = "rgba(167, 123, 165, 0.24)";
      context.shadowBlur = 24;
      context.shadowOffsetY = 10;
      this.roundRect(
        metrics.offsetX - frameInset,
        metrics.offsetY - frameInset,
        metrics.boardWidth + frameInset * 2,
        metrics.boardHeight + frameInset * 2,
        20
      );
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
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
    drawClues(level, placements) {
      const coveredClues = new Set(placements.map((placement) => `${placement.clue.x},${placement.clue.y}`));
      this.context.save();
      this.context.textAlign = "center";
      this.context.textBaseline = "middle";
      this.context.font = `600 ${Math.max(16, Math.floor(this.metrics.cellSize * 0.34))}px "Avenir Next", "Trebuchet MS", sans-serif`;
      for (const clue of level.clues) {
        const centerX = this.metrics.offsetX + (clue.x + 0.5) * this.metrics.cellSize;
        const centerY = this.metrics.offsetY + (clue.y + 0.5) * this.metrics.cellSize;
        const covered = coveredClues.has(`${clue.x},${clue.y}`);
        this.context.fillStyle = covered ? "#6b4258" : "#7a5c69";
        this.context.beginPath();
        this.context.arc(centerX, centerY, this.metrics.cellSize * 0.24, 0, Math.PI * 2);
        this.context.fillStyle = covered ? "rgba(255, 250, 252, 0.96)" : "rgba(255, 255, 255, 0.94)";
        this.context.fill();
        this.context.strokeStyle = covered ? "#d997b6" : "#ffe17a";
        this.context.lineWidth = 2;
        this.context.stroke();
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
      gradient.addColorStop(0, "#a9ef77");
      gradient.addColorStop(1, "#64c949");
      context.fillStyle = gradient;
      this.roundRect(x, y, badgeWidth, badgeHeight, 16);
      context.fill();
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
    background: "assets/wechat/bg.jpg",
    newGameButton: "assets/wechat/new_game2.png",
    leaderboardButton: "assets/wechat/rank_cutout.png",
    checkIcon: "assets/wechat/check_icon.png",
    helpIcon: "assets/wechat/help_icon.png"
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
    const padding = 12;
    const gap = 6;
    const headerHeight = 56;
    const infoHeight = 56;
    const rulesHeight = 72;
    const actionsHeight = 42;
    const bottomSafeSpacing = Math.max(16, metrics.safeBottom + 6);
    const headerRect = {
      x: padding,
      y: metrics.safeTop + 14,
      width: metrics.width - padding * 2,
      height: headerHeight
    };
    const infoY = headerRect.y + headerHeight + 8;
    const hintWidth = Math.max(156, Math.floor((metrics.width - padding * 2 - gap * 2) * 0.42));
    const smallCardWidth = Math.floor((metrics.width - padding * 2 - gap * 2 - hintWidth) / 2);
    const hintRect = {
      x: padding,
      y: infoY,
      width: hintWidth,
      height: infoHeight
    };
    const recordRect = {
      x: hintRect.x + hintRect.width + gap,
      y: infoY,
      width: smallCardWidth,
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
    const topInset = infoY + infoHeight + 12;
    const bottomInset = metrics.height - (rulesRect.y - 10);
    return {
      headerRect,
      chipRect: {
        x: headerRect.x + headerRect.width - 92,
        y: headerRect.y + 6,
        width: 78,
        height: 26
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
    context.save();
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, THEME.surfaceStrong);
    gradient.addColorStop(1, THEME.surfaceSoft);
    context.fillStyle = gradient;
    context.strokeStyle = THEME.border;
    context.lineWidth = 1.2;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    roundRect(context, rect, 14);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.restore();
  }
  function drawHudShell(context, rect) {
    context.save();
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.72)");
    context.fillStyle = gradient;
    context.strokeStyle = THEME.border;
    context.lineWidth = 1.1;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 14;
    context.shadowOffsetY = 5;
    roundRect(context, rect, 18);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.restore();
  }
  function drawToolbarShell(context, rect) {
    context.save();
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.96)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.82)");
    context.fillStyle = gradient;
    context.strokeStyle = THEME.border;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 22;
    context.shadowOffsetY = 10;
    roundRect(context, rect, 22);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
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
  function drawLandingTopIconBar(context, metrics, assets, buttons, pressedId) {
    const barRect = {
      x: 16,
      y: metrics.safeTop + 6,
      width: 148,
      height: 62
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
  function drawGameTopIconBar(context, metrics, buttons, pressedId) {
    const barRect = {
      x: 16,
      y: Math.max(0, metrics.safeTop - 14),
      width: 68,
      height: 26
    };
    context.save();
    const barGradient = context.createLinearGradient(barRect.x, barRect.y, barRect.x, barRect.y + barRect.height);
    barGradient.addColorStop(0, "rgba(255,255,255,0.98)");
    barGradient.addColorStop(1, "rgba(248,244,255,0.92)");
    context.fillStyle = barGradient;
    context.strokeStyle = "rgba(255,255,255,0.98)";
    context.lineWidth = 1;
    context.shadowColor = "rgba(144, 118, 153, 0.14)";
    context.shadowBlur = 10;
    context.shadowOffsetY = 3;
    roundRect(context, barRect, 13);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.strokeStyle = "rgba(238, 230, 241, 0.82)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(barRect.x + barRect.width / 2, barRect.y + 5);
    context.lineTo(barRect.x + barRect.width / 2, barRect.y + barRect.height - 5);
    context.stroke();
    buttons.forEach((button) => {
      const pressed = pressedId === `icon:${button.id}`;
      if (button.id === "settings") {
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
          fillStart: "#ffe3bd",
          fillEnd: "#ffd18a",
          textColor: "#8d5c2f",
          iconColor: "#e08d31",
          stroke: "rgba(255,255,255,0.9)"
        };
      case "undo":
        return {
          fillStart: "#7dc6ff",
          fillEnd: "#539cf4",
          textColor: "#ffffff",
          iconColor: "#ffffff",
          stroke: "rgba(255,255,255,0.92)"
        };
      case "restart":
        return {
          fillStart: "#ffb04c",
          fillEnd: "#ff7f19",
          textColor: "#ffffff",
          iconColor: "#ffffff",
          stroke: "rgba(255,255,255,0.92)"
        };
      case "hint":
        return {
          fillStart: "#ffc8e5",
          fillEnd: "#f5a7d0",
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
  function drawToolbarIcon(context, button, color) {
    const centerX = button.rect.x + button.rect.width / 2;
    const centerY = button.rect.y + 15;
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
      newGameButton: null,
      leaderboardButton: null,
      checkIcon: null,
      helpIcon: null
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
    const audio = new FeedbackAudio();
    audio.setEnabled(userSettings.soundEnabled);
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
    let settingsDialogPanelRect = null;
    let settingsBackButtonRect = null;
    let settingsContinueButtonRect = null;
    let soundToggleRect = null;
    let vibrationToggleRect = null;
    let lastPlacementEffectId = 0;
    let lastInvalidEffectId = 0;
    let lastCelebrationEffectId = 0;
    let autoAdvanceTimeoutId = 0;
    let lastAutoAdvanceCelebrationId = 0;
    let autoAdvanceBannerUntil = 0;
    let lastCampaignCompletionCelebrationId = 0;
    const [backgroundImage, newGameButtonImage, leaderboardButtonImage, checkIconImage, helpIconImage] = await Promise.all([
      loadWechatImage(canvas, WECHAT_ASSET_PATHS.background),
      loadWechatImage(canvas, WECHAT_ASSET_PATHS.newGameButton),
      loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardButton),
      loadWechatImage(canvas, WECHAT_ASSET_PATHS.checkIcon),
      loadWechatImage(canvas, WECHAT_ASSET_PATHS.helpIcon)
    ]);
    landingAssets.background = backgroundImage;
    landingAssets.newGameButton = newGameButtonImage;
    landingAssets.leaderboardButton = leaderboardButtonImage;
    landingAssets.checkIcon = checkIconImage;
    landingAssets.helpIcon = helpIconImage;
    function drawHeader(snapshot) {
      var _a, _b, _c;
      const context = surface.getContext2D();
      const textStartX = layout.headerRect.x + 104;
      drawHudShell(context, layout.headerRect);
      gameTopButtons = [
        {
          id: "settings",
          rect: {
            x: 22,
            y: Math.max(1, metrics.safeTop - 11),
            width: 18,
            height: 18
          }
        },
        {
          id: "leaderboardTop",
          rect: {
            x: 46,
            y: Math.max(1, metrics.safeTop - 11),
            width: 18,
            height: 18
          }
        }
      ];
      drawGameTopIconBar(context, metrics, gameTopButtons, uiState.pressedUiId);
      context.save();
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = THEME.accent;
      context.font = "600 10px sans-serif";
      context.fillText(t(locale, "app.eyebrow"), textStartX, layout.headerRect.y + 7);
      context.fillStyle = THEME.textPrimary;
      context.font = "700 19px sans-serif";
      context.fillText(t(locale, "app.title"), textStartX, layout.headerRect.y + 16);
      context.fillStyle = THEME.textSecondary;
      context.font = "600 10px sans-serif";
      context.fillText(
        t(locale, "level.progress", {
          current: snapshot.levelIndex + 1,
          total: levels.length
        }),
        textStartX,
        layout.headerRect.y + 34
      );
      context.fillText(
        t(locale, "board.meta", {
          width: snapshot.level.width,
          height: snapshot.level.height,
          clues: snapshot.level.clues.length
        }),
        textStartX + 74,
        layout.headerRect.y + 34
      );
      context.fillStyle = THEME.textPrimary;
      context.font = "700 11px sans-serif";
      context.fillText(
        formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey),
        textStartX,
        layout.headerRect.y + 46
      );
      context.restore();
      context.save();
      const chipGradient = context.createLinearGradient(
        layout.chipRect.x,
        layout.chipRect.y,
        layout.chipRect.x,
        layout.chipRect.y + layout.chipRect.height
      );
      const chipStart = snapshot.mode === "record" ? "#dff5ff" : snapshot.solved ? "#e4ffd7" : ((_a = snapshot.preview) == null ? void 0 : _a.validation.ok) ? "#fff2bb" : "rgba(255,255,255,0.82)";
      const chipEnd = snapshot.mode === "record" ? "#c8edff" : snapshot.solved ? "#c6ffb7" : ((_b = snapshot.preview) == null ? void 0 : _b.validation.ok) ? "#ffd96a" : "rgba(255,255,255,0.62)";
      chipGradient.addColorStop(0, chipStart);
      chipGradient.addColorStop(1, chipEnd);
      context.fillStyle = chipGradient;
      context.strokeStyle = THEME.border;
      roundRect(context, layout.chipRect, 13);
      context.fill();
      context.stroke();
      context.fillStyle = snapshot.mode === "record" ? THEME.info : snapshot.solved ? THEME.success : THEME.accent;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 12px sans-serif";
      context.fillText(
        snapshot.mode === "record" ? t(locale, "chip.record") : snapshot.solved ? t(locale, "chip.solved") : ((_c = snapshot.preview) == null ? void 0 : _c.validation.ok) ? t(locale, "chip.ready") : t(locale, "chip.active"),
        layout.chipRect.x + layout.chipRect.width / 2,
        layout.chipRect.y + layout.chipRect.height / 2 + 0.5
      );
      context.restore();
    }
    function drawInfoCards(snapshot) {
      const context = surface.getContext2D();
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
      drawHudShell(context, layout.hintRect);
      drawHudShell(context, layout.recordRect);
      drawHudShell(context, layout.progressRect);
      context.save();
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = THEME.accent;
      context.font = "700 10px sans-serif";
      context.fillText(t(locale, "section.hints"), layout.hintRect.x + 12, layout.hintRect.y + 8);
      context.fillText(t(locale, "section.record"), layout.recordRect.x + 12, layout.recordRect.y + 8);
      context.fillText(t(locale, "section.progress"), layout.progressRect.x + 12, layout.progressRect.y + 8);
      context.fillStyle = THEME.textPrimary;
      context.font = "700 12px sans-serif";
      context.fillText(recordSummary, layout.recordRect.x + 12, layout.recordRect.y + 22);
      context.fillText(progressPrimary, layout.progressRect.x + 12, layout.progressRect.y + 22);
      context.fillStyle = THEME.textSecondary;
      context.font = "11px sans-serif";
      drawWrappedText(
        context,
        hintText,
        {
          x: layout.hintRect.x + 12,
          y: layout.hintRect.y + 22,
          width: layout.hintRect.width - 24,
          height: layout.hintRect.height - 36
        },
        {
          font: "11px sans-serif",
          color: THEME.textSecondary,
          lineHeight: 14,
          maxLines: 2
        }
      );
      drawWrappedText(
        context,
        snapshot.currentRecord ? getRecordDetail(locale, snapshot.currentRecord, snapshot.mode) : getRecordSummary(locale, snapshot.currentRecord),
        {
          x: layout.recordRect.x + 12,
          y: layout.recordRect.y + 34,
          width: layout.recordRect.width - 24,
          height: layout.recordRect.height - 46
        },
        {
          font: "10px sans-serif",
          color: THEME.textSecondary,
          lineHeight: 12,
          maxLines: 1
        }
      );
      drawWrappedText(
        context,
        statusSummary,
        {
          x: layout.progressRect.x + 12,
          y: layout.progressRect.y + 34,
          width: layout.progressRect.width - 24,
          height: layout.progressRect.height - 46
        },
        {
          font: "10px sans-serif",
          color: THEME.textSecondary,
          lineHeight: 12,
          maxLines: 1
        }
      );
      context.restore();
      drawCardShell(context, layout.rulesRect);
      const ruleInnerRect = {
        x: layout.rulesRect.x + 10,
        y: layout.rulesRect.y + 8,
        width: layout.rulesRect.width - 20,
        height: layout.rulesRect.height - 18
      };
      drawTextFrame(context, ruleInnerRect, { radius: 10 });
      context.save();
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = THEME.accent;
      context.font = "700 10px sans-serif";
      context.fillText(t(locale, "section.rules"), ruleInnerRect.x + 10, ruleInnerRect.y + 7);
      context.restore();
      drawWrappedText(
        context,
        `${t(locale, "rule.area")}  ·  ${t(locale, "rule.singleClue")}  ·  ${t(locale, "rule.cover")}`,
        {
          x: ruleInnerRect.x + 10,
          y: ruleInnerRect.y + 24,
          width: ruleInnerRect.width - 20,
          height: ruleInnerRect.height - 34
        },
        {
          font: "10px sans-serif",
          color: THEME.textSecondary,
          lineHeight: 12,
          maxLines: 2
        }
      );
    }
    function drawButtons(snapshot) {
      const context = surface.getContext2D();
      const gap = 8;
      const buttonHeight = layout.actionsRect.height;
      const levelButtonWidth = 72;
      const actionWidth = Math.floor((layout.actionsRect.width - levelButtonWidth - gap * 4) / 4);
      buttons = [
        {
          id: "levels",
          label: t(locale, "section.levels"),
          rect: {
            x: layout.actionsRect.x,
            y: layout.actionsRect.y,
            width: levelButtonWidth,
            height: buttonHeight
          },
          enabled: true
        },
        {
          id: "undo",
          label: t(locale, "button.undo"),
          rect: {
            x: layout.actionsRect.x + levelButtonWidth + gap,
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
            x: layout.actionsRect.x + levelButtonWidth + gap * 2 + actionWidth,
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
            x: layout.actionsRect.x + levelButtonWidth + gap * 3 + actionWidth * 2,
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
            x: layout.actionsRect.x + levelButtonWidth + gap * 4 + actionWidth * 3,
            y: layout.actionsRect.y,
            width: actionWidth,
            height: buttonHeight
          },
          enabled: snapshot.hasNextLevel
        }
      ];
      context.save();
      drawToolbarShell(context, {
        x: layout.actionsRect.x - 2,
        y: layout.actionsRect.y - 4,
        width: layout.actionsRect.width + 4,
        height: layout.actionsRect.height + 8
      });
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
        context.lineWidth = 1.2;
        context.shadowColor = "rgba(255,255,255,0.28)";
        context.shadowBlur = 0;
        roundRect(context, buttonRect, 14);
        context.fill();
        context.stroke();
        drawToolbarIcon(context, { ...button, rect: buttonRect }, style.iconColor);
        context.fillStyle = style.textColor;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "600 10px sans-serif";
        context.fillText(
          button.label,
          buttonRect.x + buttonRect.width / 2,
          buttonRect.y + buttonRect.height - 12
        );
      }
      context.restore();
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
      const iconBarY = metrics.safeTop + 6;
      const iconBarX = 16;
      const iconBarWidth = 148;
      const iconBarHeight = 62;
      const iconSize = 48;
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
      drawLandingTopIconBar(context, metrics, landingAssets, topIconButtons, uiState.pressedUiId);
      context.restore();
    }
    function drawInfoDialog(mode) {
      const context = surface.getContext2D();
      const panelWidth = Math.min(metrics.width - 40, 336);
      const panelHeight = mode === "help" ? 490 : 398;
      const panelRect = {
        x: (metrics.width - panelWidth) / 2,
        y: Math.max(metrics.safeTop + 54, (metrics.height - panelHeight) / 2),
        width: panelWidth,
        height: panelHeight
      };
      const actionRect = {
        x: panelRect.x + 84,
        y: panelRect.y + panelRect.height - 58,
        width: panelRect.width - 168,
        height: 42
      };
      infoDialogPanelRect = panelRect;
      infoDialogButtonRect = actionRect;
      context.save();
      context.fillStyle = "rgba(83, 62, 95, 0.22)";
      context.fillRect(0, 0, metrics.width, metrics.height);
      const panelGradient = context.createLinearGradient(
        panelRect.x,
        panelRect.y,
        panelRect.x,
        panelRect.y + panelRect.height
      );
      panelGradient.addColorStop(0, "rgba(255,255,255,0.98)");
      panelGradient.addColorStop(1, "rgba(252,247,255,0.96)");
      context.fillStyle = panelGradient;
      context.strokeStyle = "rgba(255,255,255,0.96)";
      context.lineWidth = 1.2;
      context.shadowColor = "rgba(123, 97, 147, 0.22)";
      context.shadowBlur = 24;
      context.shadowOffsetY = 10;
      roundRect(context, panelRect, 22);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      const titleChipRect = {
        x: panelRect.x + 68,
        y: panelRect.y + 18,
        width: panelRect.width - 136,
        height: 38
      };
      const titleChipGradient = context.createLinearGradient(
        titleChipRect.x,
        titleChipRect.y,
        titleChipRect.x,
        titleChipRect.y + titleChipRect.height
      );
      titleChipGradient.addColorStop(0, "#fff4fa");
      titleChipGradient.addColorStop(1, "#ffe3ef");
      context.fillStyle = titleChipGradient;
      context.strokeStyle = "rgba(255,255,255,0.95)";
      context.lineWidth = 1;
      roundRect(context, titleChipRect, 18);
      context.fill();
      context.stroke();
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "#ff8e9c";
      context.font = "700 24px sans-serif";
      context.fillText(
        mode === "help" ? t(locale, "landing.helpTitle") : t(locale, "landing.goalTitle"),
        panelRect.x + panelRect.width / 2,
        panelRect.y + 24
      );
      context.textAlign = "left";
      context.fillStyle = "#4f63c6";
      context.font = "700 18px sans-serif";
      context.fillText(
        mode === "help" ? t(locale, "landing.ruleSection") : t(locale, "landing.goalSection"),
        panelRect.x + 20,
        panelRect.y + 74
      );
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
      const ruleCardRect = {
        x: panelRect.x + 18,
        y: panelRect.y + 104,
        width: panelRect.width - 36,
        height: mode === "help" ? 152 : 132
      };
      drawTextFrame(context, ruleCardRect, {
        radius: 16,
        fill: "rgba(255,255,255,0.72)",
        stroke: "rgba(236, 226, 246, 0.95)"
      });
      context.fillStyle = THEME.textPrimary;
      context.font = "13px sans-serif";
      bodyLines.forEach((line, index) => {
        const rowY = ruleCardRect.y + 16 + index * 34;
        context.fillStyle = "#7b8cff";
        context.font = "700 13px sans-serif";
        context.fillText(`${index + 1}.`, ruleCardRect.x + 14, rowY);
        drawWrappedText(
          context,
          line,
          {
            x: ruleCardRect.x + 34,
            y: rowY,
            width: ruleCardRect.width - 50,
            height: 28
          },
          {
            font: "13px sans-serif",
            color: THEME.textPrimary,
            lineHeight: 17,
            maxLines: 2
          }
        );
      });
      const toolsTop = ruleCardRect.y + ruleCardRect.height + 18;
      if (mode === "help") {
        context.fillStyle = "#4f63c6";
        context.font = "700 18px sans-serif";
        context.fillText(t(locale, "landing.toolSection"), panelRect.x + 20, toolsTop);
        const toolCardRect = {
          x: panelRect.x + 18,
          y: toolsTop + 26,
          width: panelRect.width - 36,
          height: 102
        };
        drawTextFrame(context, toolCardRect, {
          radius: 16,
          fill: "rgba(255,255,255,0.72)",
          stroke: "rgba(236, 226, 246, 0.95)"
        });
        const toolRows = [
          { colorStart: "#7cc8ff", colorEnd: "#4ba4ea", text: t(locale, "landing.toolHint") },
          { colorStart: "#ffc878", colorEnd: "#ff9e34", text: t(locale, "landing.toolUndo") },
          { colorStart: "#ffb2d4", colorEnd: "#ef7bb0", text: t(locale, "landing.toolRestart") }
        ];
        toolRows.forEach((tool, index) => {
          const iconRect = {
            x: toolCardRect.x + 14,
            y: toolCardRect.y + 14 + index * 28,
            width: 20,
            height: 20
          };
          const iconGradient = context.createLinearGradient(
            iconRect.x,
            iconRect.y,
            iconRect.x,
            iconRect.y + iconRect.height
          );
          iconGradient.addColorStop(0, tool.colorStart);
          iconGradient.addColorStop(1, tool.colorEnd);
          context.fillStyle = iconGradient;
          roundRect(context, iconRect, 6);
          context.fill();
          context.fillStyle = "#ffffff";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = "700 13px sans-serif";
          context.fillText(index === 0 ? "?" : index === 1 ? "↶" : "↺", iconRect.x + 10, iconRect.y + 10.5);
          context.textAlign = "left";
          context.textBaseline = "top";
          drawWrappedText(
            context,
            tool.text,
            {
              x: iconRect.x + 30,
              y: iconRect.y + 1,
              width: toolCardRect.width - 50,
              height: 24
            },
            {
              font: "12px sans-serif",
              color: THEME.textPrimary,
              lineHeight: 16,
              maxLines: 1
            }
          );
        });
      }
      const buttonGradient = context.createLinearGradient(
        actionRect.x,
        actionRect.y,
        actionRect.x,
        actionRect.y + actionRect.height
      );
      buttonGradient.addColorStop(0, "#57b9ff");
      buttonGradient.addColorStop(1, "#2c89f3");
      context.fillStyle = buttonGradient;
      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.lineWidth = 1.2;
      roundRect(context, actionRect, 14);
      context.fill();
      context.stroke();
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 16px sans-serif";
      context.fillText(t(locale, "landing.gotIt"), actionRect.x + actionRect.width / 2, actionRect.y + actionRect.height / 2 + 1);
      context.restore();
    }
    function drawSettingsDialog() {
      const context = surface.getContext2D();
      const panelRect = {
        x: (metrics.width - 248) / 2,
        y: Math.max(metrics.safeTop + 54, (metrics.height - 244) / 2),
        width: 248,
        height: 244
      };
      settingsDialogPanelRect = panelRect;
      soundToggleRect = {
        x: panelRect.x + panelRect.width - 62,
        y: panelRect.y + 70,
        width: 40,
        height: 22
      };
      vibrationToggleRect = {
        x: panelRect.x + panelRect.width - 62,
        y: panelRect.y + 112,
        width: 40,
        height: 22
      };
      settingsBackButtonRect = {
        x: panelRect.x + 22,
        y: panelRect.y + panelRect.height - 52,
        width: 92,
        height: 34
      };
      settingsContinueButtonRect = {
        x: panelRect.x + panelRect.width - 114,
        y: panelRect.y + panelRect.height - 52,
        width: 92,
        height: 34
      };
      const drawToggleRow = (y, iconColorStart, iconColorEnd, label, enabled, toggleRect, glyph) => {
        const iconRect = {
          x: panelRect.x + 24,
          y,
          width: 22,
          height: 22
        };
        const iconGradient = context.createLinearGradient(
          iconRect.x,
          iconRect.y,
          iconRect.x,
          iconRect.y + iconRect.height
        );
        iconGradient.addColorStop(0, iconColorStart);
        iconGradient.addColorStop(1, iconColorEnd);
        context.fillStyle = iconGradient;
        roundRect(context, iconRect, 7);
        context.fill();
        context.fillStyle = "#ffffff";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "700 13px sans-serif";
        context.fillText(glyph, iconRect.x + 11, iconRect.y + 11.5);
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillStyle = THEME.textPrimary;
        context.font = "700 15px sans-serif";
        context.fillText(label, iconRect.x + 32, iconRect.y + 11);
        const toggleGradient = context.createLinearGradient(
          toggleRect.x,
          toggleRect.y,
          toggleRect.x,
          toggleRect.y + toggleRect.height
        );
        if (enabled) {
          toggleGradient.addColorStop(0, "#6dd66c");
          toggleGradient.addColorStop(1, "#3eaf47");
        } else {
          toggleGradient.addColorStop(0, "#e9e3ea");
          toggleGradient.addColorStop(1, "#cfc3d1");
        }
        context.fillStyle = toggleGradient;
        context.strokeStyle = "rgba(255,255,255,0.92)";
        context.lineWidth = 1;
        roundRect(context, toggleRect, toggleRect.height / 2);
        context.fill();
        context.stroke();
        const knobX = enabled ? toggleRect.x + toggleRect.width - 11 : toggleRect.x + 11;
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(knobX, toggleRect.y + toggleRect.height / 2, 8.5, 0, Math.PI * 2);
        context.fill();
      };
      context.save();
      context.fillStyle = "rgba(77, 60, 89, 0.22)";
      context.fillRect(0, 0, metrics.width, metrics.height);
      const panelGradient = context.createLinearGradient(
        panelRect.x,
        panelRect.y,
        panelRect.x,
        panelRect.y + panelRect.height
      );
      panelGradient.addColorStop(0, "rgba(255,255,255,0.98)");
      panelGradient.addColorStop(1, "rgba(248,244,255,0.95)");
      context.fillStyle = panelGradient;
      context.strokeStyle = "rgba(255,255,255,0.96)";
      context.lineWidth = 1.2;
      context.shadowColor = "rgba(123, 97, 147, 0.2)";
      context.shadowBlur = 24;
      context.shadowOffsetY = 10;
      roundRect(context, panelRect, 22);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "#4f63c6";
      context.font = "700 22px sans-serif";
      context.fillText(t(locale, "settings.title"), panelRect.x + panelRect.width / 2, panelRect.y + 20);
      drawToggleRow(
        panelRect.y + 66,
        "#82db78",
        "#46b957",
        t(locale, "settings.sound"),
        userSettings.soundEnabled,
        soundToggleRect,
        "♪"
      );
      drawToggleRow(
        panelRect.y + 108,
        "#c57fff",
        "#9b5ce5",
        t(locale, "settings.vibration"),
        userSettings.vibrationEnabled,
        vibrationToggleRect,
        "≈"
      );
      const backGradient = context.createLinearGradient(
        settingsBackButtonRect.x,
        settingsBackButtonRect.y,
        settingsBackButtonRect.x,
        settingsBackButtonRect.y + settingsBackButtonRect.height
      );
      backGradient.addColorStop(0, "#f7f7f7");
      backGradient.addColorStop(1, "#dddddd");
      context.fillStyle = backGradient;
      context.strokeStyle = "rgba(255,255,255,0.95)";
      roundRect(context, settingsBackButtonRect, 12);
      context.fill();
      context.stroke();
      context.fillStyle = "#7c727f";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 14px sans-serif";
      context.fillText(
        t(locale, "settings.backHome"),
        settingsBackButtonRect.x + settingsBackButtonRect.width / 2,
        settingsBackButtonRect.y + settingsBackButtonRect.height / 2 + 1
      );
      const continueGradient = context.createLinearGradient(
        settingsContinueButtonRect.x,
        settingsContinueButtonRect.y,
        settingsContinueButtonRect.x,
        settingsContinueButtonRect.y + settingsContinueButtonRect.height
      );
      continueGradient.addColorStop(0, "#58bcff");
      continueGradient.addColorStop(1, "#2d89f4");
      context.fillStyle = continueGradient;
      context.strokeStyle = "rgba(255,255,255,0.95)";
      roundRect(context, settingsContinueButtonRect, 12);
      context.fill();
      context.stroke();
      context.fillStyle = "#ffffff";
      context.fillText(
        t(locale, "settings.continue"),
        settingsContinueButtonRect.x + settingsContinueButtonRect.width / 2,
        settingsContinueButtonRect.y + settingsContinueButtonRect.height / 2 + 1
      );
      context.restore();
    }
    function drawLeaderboardPanel() {
      const context = surface.getContext2D();
      const panelWidth = Math.min(metrics.width - 30, 340);
      const panelHeight = Math.min(metrics.height - 110, 446);
      const panelRect = {
        x: (metrics.width - panelWidth) / 2,
        y: Math.max(metrics.safeTop + 36, (metrics.height - panelHeight) / 2),
        width: panelWidth,
        height: panelHeight
      };
      leaderboardPanelRect = panelRect;
      context.save();
      context.fillStyle = "rgba(71, 49, 82, 0.22)";
      context.fillRect(0, 0, metrics.width, metrics.height);
      const panelGradient = context.createLinearGradient(
        panelRect.x,
        panelRect.y,
        panelRect.x,
        panelRect.y + panelRect.height
      );
      panelGradient.addColorStop(0, "rgba(255,255,255,0.96)");
      panelGradient.addColorStop(1, "rgba(249,239,255,0.92)");
      context.fillStyle = panelGradient;
      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.lineWidth = 1.4;
      context.shadowColor = "rgba(116, 77, 143, 0.26)";
      context.shadowBlur = 28;
      context.shadowOffsetY = 12;
      roundRect(context, panelRect, 24);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      const headerChipRect = {
        x: panelRect.x + 72,
        y: panelRect.y + 16,
        width: panelRect.width - 144,
        height: 38
      };
      const headerChipGradient = context.createLinearGradient(
        headerChipRect.x,
        headerChipRect.y,
        headerChipRect.x,
        headerChipRect.y + headerChipRect.height
      );
      headerChipGradient.addColorStop(0, "#f7ecff");
      headerChipGradient.addColorStop(1, "#eddcff");
      context.fillStyle = headerChipGradient;
      context.strokeStyle = "rgba(255,255,255,0.95)";
      context.lineWidth = 1;
      roundRect(context, headerChipRect, 18);
      context.fill();
      context.stroke();
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = "#9b61db";
      context.font = "700 20px sans-serif";
      context.textAlign = "center";
      context.fillText(
        t(locale, "landing.weeklyLeaderboard"),
        panelRect.x + panelRect.width / 2,
        panelRect.y + 22
      );
      drawWrappedText(
        context,
        t(locale, "landing.localWeeklyNote"),
        {
          x: panelRect.x + 22,
          y: panelRect.y + 66,
          width: panelRect.width - 44,
          height: 36
        },
        {
          font: "11px sans-serif",
          color: THEME.textSecondary,
          lineHeight: 14,
          maxLines: 2
        }
      );
      const listTop = panelRect.y + 110;
      const listLeft = panelRect.x + 18;
      const rowWidth = panelRect.width - 36;
      const rowHeight = 56;
      const rowGap = 10;
      const entries = weeklyLeaderboard.slice(0, 6);
      if (entries.length === 0) {
        drawHudShell(context, {
          x: listLeft,
          y: listTop + 18,
          width: rowWidth,
          height: 104
        });
        drawWrappedText(
          context,
          t(locale, "landing.emptyLeaderboard"),
          {
            x: listLeft + 18,
            y: listTop + 48,
            width: rowWidth - 36,
            height: 40
          },
          {
            font: "13px sans-serif",
            color: THEME.textPrimary,
            lineHeight: 18,
            maxLines: 2
          }
        );
      } else {
        entries.forEach((entry, index) => {
          const rowRect = {
            x: listLeft,
            y: listTop + index * (rowHeight + rowGap),
            width: rowWidth,
            height: rowHeight
          };
          drawHudShell(context, rowRect);
          const badgeRect = {
            x: rowRect.x + 14,
            y: rowRect.y + 12,
            width: 26,
            height: 26
          };
          const badgeGradient = context.createLinearGradient(
            badgeRect.x,
            badgeRect.y,
            badgeRect.x,
            badgeRect.y + badgeRect.height
          );
          if (index === 0) {
            badgeGradient.addColorStop(0, "#ffd56d");
            badgeGradient.addColorStop(1, "#ff9e1a");
          } else if (index === 1) {
            badgeGradient.addColorStop(0, "#d9c9ff");
            badgeGradient.addColorStop(1, "#8a77ff");
          } else {
            badgeGradient.addColorStop(0, "#a8e0ff");
            badgeGradient.addColorStop(1, "#53b7ff");
          }
          context.fillStyle = badgeGradient;
          roundRect(context, badgeRect, 9);
          context.fill();
          context.fillStyle = "#ffffff";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = "700 15px sans-serif";
          context.fillText(String(index + 1), badgeRect.x + badgeRect.width / 2, badgeRect.y + badgeRect.height / 2 + 0.5);
          context.fillStyle = THEME.textPrimary;
          context.textAlign = "left";
          context.textBaseline = "top";
          context.font = "700 14px sans-serif";
          context.fillText(
            t(locale, "landing.bestTime", { duration: formatDuration(entry.durationMs) }),
            rowRect.x + 52,
            rowRect.y + 10
          );
          context.fillStyle = THEME.textSecondary;
          context.font = "11px sans-serif";
          context.fillText(
            t(locale, "landing.completedAt", {
              completedAt: formatCompletedAt(locale, entry.completedAt)
            }),
            rowRect.x + 52,
            rowRect.y + 32
          );
        });
      }
      context.fillStyle = THEME.textMuted;
      context.font = "10px sans-serif";
      context.textAlign = "center";
      context.fillText(
        t(locale, "landing.close"),
        panelRect.x + panelRect.width / 2,
        panelRect.y + panelRect.height - 24
      );
      context.restore();
    }
    function drawLevelPanel(snapshot) {
      const context = surface.getContext2D();
      const panelMargin = 18;
      const panelWidth = metrics.width - panelMargin * 2;
      const panelHeight = Math.min(metrics.height - layout.topInset - 28, 440);
      const panelX = panelMargin;
      const panelY = Math.max(layout.topInset - 8, (metrics.height - panelHeight) / 2);
      const innerPadding = 16;
      const columns = 6;
      const rows = 6;
      const gap = 6;
      const gridWidth = panelWidth - innerPadding * 2;
      const tileSize = Math.floor((gridWidth - gap * (columns - 1)) / columns);
      const gridStartX = panelX + innerPadding;
      const gridStartY = panelY + 56;
      levelTiles = [];
      context.save();
      context.fillStyle = THEME.overlay;
      context.fillRect(0, 0, metrics.width, metrics.height);
      const panelGradient = context.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
      panelGradient.addColorStop(0, "rgba(255,255,255,0.95)");
      panelGradient.addColorStop(1, "rgba(255,255,255,0.84)");
      context.fillStyle = panelGradient;
      context.strokeStyle = THEME.border;
      context.lineWidth = 1.2;
      roundRect(context, { x: panelX, y: panelY, width: panelWidth, height: panelHeight }, 20);
      context.fill();
      context.stroke();
      context.fillStyle = THEME.textPrimary;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.font = "700 17px sans-serif";
      context.fillText(t(locale, "section.levels"), panelX + innerPadding, panelY + 16);
      context.font = "500 12px sans-serif";
      context.fillStyle = THEME.textSecondary;
      context.fillText(
        t(locale, "level.collectionMeta", {
          completed: Object.keys(snapshot.records).length,
          total: levels.length
        }),
        panelX + innerPadding,
        panelY + 36
      );
      for (let slot = 0; slot < rows * columns; slot += 1) {
        const col = slot % columns;
        const row = Math.floor(slot / columns);
        const x = gridStartX + col * (tileSize + gap);
        const y = gridStartY + row * (tileSize + gap);
        if (slot >= levels.length) {
          context.fillStyle = "rgba(255,255,255,0.42)";
          roundRect(context, { x, y, width: tileSize, height: tileSize }, 10);
          context.fill();
          continue;
        }
        const level = levels[slot];
        const completed = Boolean(snapshot.records[level.id]);
        const isCurrent = snapshot.levelIndex === slot;
        const isViewing = isCurrent && snapshot.mode === "record";
        context.fillStyle = completed ? "rgba(204,255,212,0.92)" : "rgba(255,255,255,0.94)";
        if (isCurrent) {
          context.fillStyle = isViewing ? THEME.infoSoft : "rgba(255, 238, 183, 0.98)";
        }
        context.strokeStyle = isCurrent ? THEME.borderAccent : THEME.border;
        context.lineWidth = isCurrent ? 2 : 1;
        roundRect(context, { x, y, width: tileSize, height: tileSize }, 10);
        context.fill();
        context.stroke();
        if (isCurrent) {
          context.fillStyle = isViewing ? THEME.info : THEME.accentFill;
          roundRect(context, { x: x + 6, y: y + 4, width: tileSize - 12, height: 5 }, 3);
          context.fill();
        }
        context.fillStyle = isCurrent ? THEME.accentStrong : THEME.textPrimary;
        if (isViewing) {
          context.fillStyle = THEME.info;
        }
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "700 15px sans-serif";
        context.fillText(String(slot + 1), x + tileSize / 2, y + tileSize / 2 + 3);
        if (completed) {
          context.fillStyle = THEME.success;
          context.beginPath();
          context.arc(x + tileSize - 10, y + 10, 8, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = THEME.white;
          context.font = "700 10px sans-serif";
          context.fillText("✓", x + tileSize - 10, y + 10.5);
        }
        if (isViewing) {
          context.fillStyle = THEME.infoSoft;
          roundRect(context, { x: x + 6, y: y + tileSize - 14, width: tileSize - 12, height: 8 }, 4);
          context.fill();
        }
        levelTiles.push({
          index: slot,
          rect: { x, y, width: tileSize, height: tileSize }
        });
      }
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
      if (!uiState.homeOpen) {
        renderer.render(currentSnapshot, {
          labels: {
            solvedBadge: t(locale, "renderer.badgeSolved"),
            recordBadge: t(locale, "renderer.badgeRecord")
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
      const placementEffectId = (_b = (_a = snapshot.effects.placement) == null ? void 0 : _a.id) != null ? _b : 0;
      if (placementEffectId !== lastPlacementEffectId) {
        lastPlacementEffectId = placementEffectId;
        if (placementEffectId > 0) {
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
      if (snapshot.effects.celebrationId !== lastCelebrationEffectId) {
        lastCelebrationEffectId = snapshot.effects.celebrationId;
        if (snapshot.effects.celebrationId > 0) {
          audio.playCelebration();
          triggerVibration("heavy");
        }
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
          const closeButtonHit = infoDialogButtonRect ? isPointInsideRect(x, y, infoDialogButtonRect) : false;
          const insidePanel = infoDialogPanelRect ? isPointInsideRect(x, y, infoDialogPanelRect) : false;
          if (closeButtonHit || !insidePanel) {
            uiState.helpOpen = false;
            uiState.goalOpen = false;
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
          if (snapshot.records[level.id]) {
            game.viewRecordedLevel(tile.index);
          } else {
            game.setLevel(tile.index);
          }
          uiState.levelPanelOpen = false;
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
        if (uiState.leaderboardOpen || uiState.helpOpen || uiState.goalOpen) {
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
})();
