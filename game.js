"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/audio/FeedbackAudio.ts
  var SAMPLE_RATE = 22050;
  var MASTER_VOLUME = 0.82;
  var PLACEMENT_STEPS = [
    { frequency: 493.88, durationSeconds: 0.06, volume: 0.32, type: "triangle" },
    { frequency: 659.25, durationSeconds: 0.07, volume: 0.26, type: "triangle", delaySeconds: 0.04 }
  ];
  var INVALID_STEPS = [
    { frequency: 220, durationSeconds: 0.09, volume: 0.34, type: "sine" }
  ];
  var CELEBRATION_STEPS = [
    { frequency: 523.25, durationSeconds: 0.16, volume: 0.22, type: "triangle" },
    { frequency: 659.25, durationSeconds: 0.16, volume: 0.22, type: "triangle", delaySeconds: 0.08 },
    { frequency: 783.99, durationSeconds: 0.16, volume: 0.22, type: "triangle", delaySeconds: 0.16 }
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
    return 2 * Math.asin(Math.sin(phase * Math.PI * 2)) / Math.PI;
  }
  function buildToneClipDataUri(steps) {
    var _a, _b;
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
      const attackFrames = Math.max(1, Math.floor(Math.min(0.02, step.durationSeconds * 0.35) * SAMPLE_RATE));
      const releaseFrames = Math.max(1, Math.floor(Math.min(0.05, step.durationSeconds * 0.45) * SAMPLE_RATE));
      for (let frame = 0; frame < durationFrames; frame += 1) {
        const sampleIndex = startFrame + frame;
        if (sampleIndex >= frameCount) {
          break;
        }
        const phase = frame * step.frequency / SAMPLE_RATE;
        let envelope = 1;
        if (frame < attackFrames) {
          envelope = frame / attackFrames;
        } else if (frame > durationFrames - releaseFrames) {
          envelope = Math.max(0, (durationFrames - frame) / releaseFrames);
        }
        samples[sampleIndex] += toneAmplitude(step.type, phase) * step.volume * envelope * MASTER_VOLUME;
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
      var _a;
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
        const gainNode = context.createGain();
        oscillator.type = step.type;
        oscillator.frequency.setValueAtTime(step.frequency, startTime);
        gainNode.gain.setValueAtTime(1e-4, startTime);
        gainNode.gain.exponentialRampToValueAtTime(step.volume, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(1e-4, endTime);
        oscillator.connect(gainNode);
        gainNode.connect(masterGain);
        oscillator.start(startTime);
        oscillator.stop(endTime + 0.02);
      }
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
    }
    prime() {
      this.backend.prime();
    }
    playPlacement() {
      this.backend.playPlacement();
    }
    playInvalid() {
      this.backend.playInvalid();
    }
    playCelebration() {
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
      "app.title": "填充格子",
      "app.heroCopy": "拖拽生成矩形，让每个矩形只包含一个数字，并且面积等于该数字。",
      "home.subtitle": "把棋盘完整填满，让每个数字恰好对应一个矩形。",
      "home.progress": "已完成 {completed} / {total} 关",
      "home.currentLevel": "当前进度：第 {level} 关",
      "home.continue": "继续挑战",
      "home.start": "从第一关开始",
      "home.resumeTip": "会恢复你上次的局面，并保留已通关记录。",
      "home.freshTip": "会从第 1 关重新开始当前进度，已通关记录会保留。",
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
    "#f2c572",
    "#9fd0c7",
    "#f4a076",
    "#b5c9f6",
    "#d9b8f3",
    "#f6c3d7",
    "#cce4a7"
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
      gradient.addColorStop(0, "#fcf8ef");
      gradient.addColorStop(1, "#efe4d3");
      this.context.fillStyle = gradient;
      this.context.fillRect(0, 0, width, height);
    }
    drawBoardSurface() {
      const { context, metrics } = this;
      const frameInset = 14;
      context.save();
      context.fillStyle = "#fffaf1";
      context.strokeStyle = "#d4c8b6";
      context.lineWidth = 2.5;
      context.shadowColor = "rgba(53, 41, 25, 0.12)";
      context.shadowBlur = 18;
      context.shadowOffsetY = 8;
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
      const fillColor = valid ? "#6eb59b" : "#d9735c";
      const strokeColor = valid ? "#2f7d61" : "#8f4334";
      this.fillRect(rect, fillColor, strokeColor, 0.45, [10, 6]);
      this.drawPreviewAccent(rect, strokeColor);
      this.drawPreviewCorners(rect, strokeColor);
      if (clue) {
        this.drawPreviewClueHighlight(clue, strokeColor);
      }
    }
    drawHint(rect) {
      this.fillRect(rect, "#79aee3", "#2f5f93", 0.24, [8, 6]);
    }
    drawSelectedPlacement(placement) {
      const badgeRect = this.getPlacementDeleteBadgeRect(placement);
      const { context } = this;
      this.drawPreviewAccent(placement.rect, "#8f4a22");
      this.drawPreviewCorners(placement.rect, "#8f4a22");
      context.save();
      context.fillStyle = "#fff6f3";
      context.strokeStyle = "#c65443";
      context.lineWidth = 2;
      this.roundRect(badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height, 11);
      context.fill();
      context.stroke();
      context.strokeStyle = "#c65443";
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
      context.fillRect(x + 2, y + 2, width - 4, height - 4);
      context.restore();
      context.save();
      context.strokeStyle = strokeColor;
      context.lineWidth = 3;
      context.setLineDash(dash);
      context.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
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
      context.strokeStyle = "#c7bba9";
      context.lineWidth = 1;
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
        this.context.fillStyle = covered ? "#22333f" : "#334f62";
        this.context.beginPath();
        this.context.arc(centerX, centerY, this.metrics.cellSize * 0.24, 0, Math.PI * 2);
        this.context.fillStyle = covered ? "rgba(255, 250, 241, 0.92)" : "rgba(255, 255, 255, 0.96)";
        this.context.fill();
        this.context.strokeStyle = covered ? "#22333f" : "#7995a8";
        this.context.lineWidth = 2;
        this.context.stroke();
        this.context.fillStyle = covered ? "#22333f" : "#334f62";
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
      context.fillStyle = "#2f8f62";
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
      const colors = ["#f2c572", "#9fd0c7", "#f4a076", "#b5c9f6", "#cce4a7"];
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
    backgroundStart: "#fcf8ef",
    backgroundEnd: "#efe4d3",
    surfaceStrong: "rgba(255, 250, 242, 0.98)",
    surface: "rgba(255, 250, 242, 0.90)",
    surfaceSoft: "rgba(255, 250, 242, 0.78)",
    surfaceMuted: "rgba(239, 231, 219, 0.82)",
    border: "rgba(94, 77, 52, 0.10)",
    borderSoft: "rgba(94, 77, 52, 0.08)",
    borderAccent: "rgba(143, 91, 43, 0.14)",
    shadow: "rgba(53, 41, 25, 0.12)",
    overlay: "rgba(33, 27, 20, 0.24)",
    textPrimary: "#24313b",
    textSecondary: "#667785",
    textMuted: "#7b6a57",
    accent: "#8f5b2b",
    accentStrong: "#8f4a22",
    accentSoft: "#fff0df",
    accentFill: "#e5a15b",
    success: "#2f8f62",
    successSoft: "#e9f8ef",
    info: "#31507f",
    infoSoft: "#e7f0ff",
    white: "#fffaf1",
    disabledText: "#9a8b76"
  };
  var cachedCanvas = null;
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
      gradient.addColorStop(1, THEME.backgroundEnd);
      context.fillStyle = gradient;
      context.fillRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = THEME.textPrimary;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 26px sans-serif";
      context.fillText("填充格子", metrics.width / 2, metrics.height / 2 - 16);
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
      context.fillText("填充格子", 20, 24);
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
    context.fillStyle = THEME.surface;
    context.strokeStyle = THEME.borderSoft;
    context.lineWidth = 1;
    roundRect(context, rect, 14);
    context.fill();
    context.stroke();
    context.restore();
  }
  function drawHudShell(context, rect) {
    context.save();
    context.fillStyle = THEME.surfaceSoft;
    context.strokeStyle = THEME.borderSoft;
    context.lineWidth = 1;
    roundRect(context, rect, 18);
    context.fill();
    context.stroke();
    context.restore();
  }
  function drawToolbarShell(context, rect) {
    context.save();
    context.fillStyle = THEME.surface;
    context.strokeStyle = THEME.borderSoft;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    roundRect(context, rect, 22);
    context.fill();
    context.shadowColor = "transparent";
    context.stroke();
    context.restore();
  }
  function drawTextFrame(context, rect, options = {}) {
    var _a, _b, _c;
    context.save();
    context.fillStyle = (_a = options.fill) != null ? _a : "rgba(255, 250, 242, 0.52)";
    context.strokeStyle = (_b = options.stroke) != null ? _b : THEME.borderSoft;
    context.lineWidth = 1;
    roundRect(context, rect, (_c = options.radius) != null ? _c : 10);
    context.fill();
    context.stroke();
    context.restore();
  }
  function drawToolbarIcon(context, button) {
    const centerX = button.rect.x + button.rect.width / 2;
    const centerY = button.rect.y + 15;
    const iconColor = button.enabled ? THEME.accent : THEME.disabledText;
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
  function bootstrapWechatGame() {
    const locale = resolveLocale();
    const canvas = resolveWechatCanvas();
    const metrics = getWindowMetrics();
    const layout = computeLayout(metrics);
    const storage = new BrowserGameStorage(new WechatStorageAdapter());
    const loadedGameState = storage.load(levels);
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
    const inputSource = new WechatPointerInputSource();
    const uiState = {
      levelPanelOpen: false,
      homeOpen: true,
      pressedUiId: null
    };
    new PointerController(inputSource, surface, renderer, game, {
      shouldIgnoreInput: () => uiState.levelPanelOpen || uiState.homeOpen
    });
    let currentSnapshot = game.getSnapshot();
    let animationFrameId = 0;
    let buttons = [];
    let homeButtons = [];
    let levelTiles = [];
    let lastPlacementEffectId = 0;
    let lastInvalidEffectId = 0;
    let lastCelebrationEffectId = 0;
    let autoAdvanceTimeoutId = 0;
    let lastAutoAdvanceCelebrationId = 0;
    let autoAdvanceBannerUntil = 0;
    function drawHeader(snapshot) {
      var _a, _b;
      const context = surface.getContext2D();
      drawHudShell(context, layout.headerRect);
      context.save();
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = THEME.accent;
      context.font = "600 10px sans-serif";
      context.fillText(t(locale, "app.eyebrow"), layout.headerRect.x + 14, layout.headerRect.y + 7);
      context.fillStyle = THEME.textPrimary;
      context.font = "700 19px sans-serif";
      context.fillText(t(locale, "app.title"), layout.headerRect.x + 14, layout.headerRect.y + 16);
      context.fillStyle = THEME.textSecondary;
      context.font = "600 10px sans-serif";
      context.fillText(
        t(locale, "level.progress", {
          current: snapshot.levelIndex + 1,
          total: levels.length
        }),
        layout.headerRect.x + 14,
        layout.headerRect.y + 34
      );
      context.fillText(
        t(locale, "board.meta", {
          width: snapshot.level.width,
          height: snapshot.level.height,
          clues: snapshot.level.clues.length
        }),
        layout.headerRect.x + 102,
        layout.headerRect.y + 34
      );
      context.fillStyle = THEME.textPrimary;
      context.font = "700 11px sans-serif";
      context.fillText(
        formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey),
        layout.headerRect.x + 14,
        layout.headerRect.y + 46
      );
      context.restore();
      context.save();
      context.fillStyle = snapshot.mode === "record" ? THEME.infoSoft : snapshot.solved ? THEME.successSoft : ((_a = snapshot.preview) == null ? void 0 : _a.validation.ok) ? THEME.accentSoft : THEME.surfaceMuted;
      context.strokeStyle = snapshot.mode === "record" ? THEME.borderSoft : snapshot.solved ? THEME.borderSoft : THEME.borderSoft;
      roundRect(context, layout.chipRect, 13);
      context.fill();
      context.stroke();
      context.fillStyle = snapshot.mode === "record" ? THEME.info : snapshot.solved ? THEME.success : THEME.accent;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 12px sans-serif";
      context.fillText(
        snapshot.mode === "record" ? t(locale, "chip.record") : snapshot.solved ? t(locale, "chip.solved") : ((_b = snapshot.preview) == null ? void 0 : _b.validation.ok) ? t(locale, "chip.ready") : t(locale, "chip.active"),
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
        context.fillStyle = button.enabled ? THEME.surfaceStrong : THEME.surfaceMuted;
        context.strokeStyle = button.enabled ? THEME.border : THEME.borderSoft;
        context.lineWidth = 1;
        roundRect(context, buttonRect, 14);
        context.fill();
        context.stroke();
        drawToolbarIcon(context, { ...button, rect: buttonRect });
        context.fillStyle = button.enabled ? THEME.textPrimary : THEME.disabledText;
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
    function drawHomeScreen(snapshot) {
      const context = surface.getContext2D();
      const panelWidth = Math.min(metrics.width - 36, 320);
      const panelHeight = 300;
      const panelRect = {
        x: (metrics.width - panelWidth) / 2,
        y: Math.max(layout.headerRect.y + 18, (metrics.height - panelHeight) / 2 - 18),
        width: panelWidth,
        height: panelHeight
      };
      const completed = Object.keys(snapshot.records).length;
      const hasProgress = snapshot.levelIndex > 0 || snapshot.placements.length > 0;
      const buttonWidth = panelWidth - 44;
      const startButtonRect = {
        x: panelRect.x + 22,
        y: panelRect.y + panelRect.height - 74,
        width: buttonWidth,
        height: 44
      };
      const continueButtonRect = {
        x: panelRect.x + 22,
        y: startButtonRect.y - 54,
        width: buttonWidth,
        height: 44
      };
      homeButtons = [
        {
          id: "continue",
          label: t(locale, "home.continue"),
          rect: continueButtonRect,
          primary: true
        },
        {
          id: "start",
          label: t(locale, "home.start"),
          rect: startButtonRect,
          primary: false
        }
      ];
      context.save();
      context.fillStyle = THEME.overlay;
      context.fillRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = THEME.surfaceStrong;
      context.strokeStyle = THEME.border;
      context.lineWidth = 1;
      context.shadowColor = THEME.shadow;
      context.shadowBlur = 24;
      context.shadowOffsetY = 10;
      roundRect(context, panelRect, 26);
      context.fill();
      context.shadowColor = "transparent";
      context.stroke();
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = THEME.accent;
      context.font = "700 11px sans-serif";
      context.fillText(t(locale, "app.eyebrow"), panelRect.x + 22, panelRect.y + 20);
      context.fillStyle = THEME.textPrimary;
      context.font = "700 28px sans-serif";
      context.fillText(t(locale, "app.title"), panelRect.x + 22, panelRect.y + 38);
      drawWrappedText(
        context,
        t(locale, "home.subtitle"),
        {
          x: panelRect.x + 22,
          y: panelRect.y + 78,
          width: panelRect.width - 44,
          height: 44
        },
        {
          font: "12px sans-serif",
          color: THEME.textSecondary,
          lineHeight: 16,
          maxLines: 2
        }
      );
      drawHudShell(context, {
        x: panelRect.x + 22,
        y: panelRect.y + 126,
        width: panelRect.width - 44,
        height: 68
      });
      context.fillStyle = THEME.accent;
      context.font = "700 10px sans-serif";
      context.fillText(
        t(locale, "home.progress", { completed, total: levels.length }),
        panelRect.x + 36,
        panelRect.y + 140
      );
      context.fillStyle = THEME.textPrimary;
      context.font = "700 15px sans-serif";
      context.fillText(
        t(locale, "home.currentLevel", { level: snapshot.levelIndex + 1 }),
        panelRect.x + 36,
        panelRect.y + 158
      );
      for (const button of homeButtons) {
        const isPressed = uiState.pressedUiId === `home:${button.id}`;
        const buttonRect = { ...button.rect, y: button.rect.y + (isPressed ? 1.5 : 0) };
        context.fillStyle = button.primary ? THEME.textPrimary : THEME.surfaceStrong;
        context.strokeStyle = button.primary ? THEME.textPrimary : THEME.border;
        context.lineWidth = 1;
        roundRect(context, buttonRect, 18);
        context.fill();
        context.stroke();
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "700 13px sans-serif";
        context.fillStyle = button.primary ? THEME.white : THEME.textPrimary;
        context.fillText(
          button.label,
          buttonRect.x + buttonRect.width / 2,
          buttonRect.y + buttonRect.height / 2
        );
      }
      context.fillStyle = THEME.textMuted;
      context.font = "10px sans-serif";
      context.fillText(
        hasProgress ? t(locale, "home.resumeTip") : t(locale, "home.freshTip"),
        panelRect.x + 26,
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
      context.fillStyle = THEME.surfaceStrong;
      context.strokeStyle = THEME.border;
      context.lineWidth = 1;
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
          context.fillStyle = THEME.surfaceMuted;
          roundRect(context, { x, y, width: tileSize, height: tileSize }, 10);
          context.fill();
          continue;
        }
        const level = levels[slot];
        const completed = Boolean(snapshot.records[level.id]);
        const isCurrent = snapshot.levelIndex === slot;
        const isViewing = isCurrent && snapshot.mode === "record";
        context.fillStyle = completed ? THEME.successSoft : THEME.surfaceStrong;
        if (isCurrent) {
          context.fillStyle = isViewing ? THEME.infoSoft : THEME.accentSoft;
        }
        context.strokeStyle = THEME.border;
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
      drawHeader(snapshot);
      drawInfoCards(snapshot);
      drawButtons(snapshot);
      drawAutoAdvanceBanner(snapshot);
      if (uiState.levelPanelOpen) {
        drawLevelPanel(snapshot);
      }
      if (uiState.homeOpen) {
        drawHomeScreen(snapshot);
      }
    }
    function render() {
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
      drawOverlay(currentSnapshot);
      syncFeedbackAudio(currentSnapshot);
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
    function syncFeedbackAudio(snapshot) {
      var _a, _b;
      const placementEffectId = (_b = (_a = snapshot.effects.placement) == null ? void 0 : _a.id) != null ? _b : 0;
      if (placementEffectId !== lastPlacementEffectId) {
        lastPlacementEffectId = placementEffectId;
        if (placementEffectId > 0) {
          audio.playPlacement();
        }
      }
      if (snapshot.effects.invalidId !== lastInvalidEffectId) {
        lastInvalidEffectId = snapshot.effects.invalidId;
        if (snapshot.effects.invalidId > 0) {
          audio.playInvalid();
        }
      }
      if (snapshot.effects.celebrationId !== lastCelebrationEffectId) {
        lastCelebrationEffectId = snapshot.effects.celebrationId;
        if (snapshot.effects.celebrationId > 0) {
          audio.playCelebration();
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
      context.fillStyle = THEME.surfaceStrong;
      context.strokeStyle = THEME.borderAccent;
      context.lineWidth = 1;
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
        const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
        uiState.pressedUiId = null;
        if (!homeButton) {
          render();
          return true;
        }
        if (homeButton.id === "continue") {
          uiState.homeOpen = false;
          render();
          return true;
        }
        uiState.homeOpen = false;
        game.setLevel(0);
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
        const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
        uiState.pressedUiId = homeButton ? `home:${homeButton.id}` : null;
        render();
        return;
      }
      if (uiState.levelPanelOpen) {
        uiState.pressedUiId = null;
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
    bootstrapWechatGame();
  } catch (error) {
    console.error("[Fill Grid] WeChat bootstrap failed:", error);
    drawBootstrapError(error);
  }
})();
