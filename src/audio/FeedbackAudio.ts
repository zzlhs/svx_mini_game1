import {
  COMBO_VOICE_VOLUME,
  INNER_AUDIO_COMBO_CLEANUP_TIMEOUT_MS,
  INNER_AUDIO_GENERIC_CLEANUP_TIMEOUT_MS,
} from './feedback-audio.constants';

type ToneType = 'sine' | 'triangle' | 'square';

type ToneTimbre = 'softPluck' | 'glass' | 'warmPulse';

type AudioContextLike = AudioContext;

interface ToneStep {
  frequency: number;
  durationSeconds: number;
  volume: number;
  type: ToneType;
  delaySeconds?: number;
  timbre?: ToneTimbre;
  attackSeconds?: number;
  releaseSeconds?: number;
  glideFromRatio?: number;
}

interface InnerAudioContextLike {
  autoplay: boolean;
  src: string;
  volume: number;
  obeyMuteSwitch?: boolean;
  play(): void;
  stop?(): void;
  destroy?(): void;
  onEnded?(callback: () => void): void;
  onStop?(callback: () => void): void;
  onError?(callback: () => void): void;
}

interface WechatAudioApiLike {
  createInnerAudioContext?: () => InnerAudioContextLike;
}

interface AudioBackend {
  prime(): void;
  playPlacement(): void;
  playInvalid(): void;
  playCelebration(): void;
  playComboVoice(url: string): void;
  stopComboVoice(): void;
}

const SAMPLE_RATE = 22_050;
const MASTER_VOLUME = 0.7;
const PLACEMENT_STEPS: ToneStep[] = [
  {
    frequency: 659.25,
    durationSeconds: 0.07,
    volume: 0.2,
    type: 'triangle',
    timbre: 'glass',
    attackSeconds: 0.012,
    releaseSeconds: 0.045,
    glideFromRatio: 1.018,
  },
  {
    frequency: 783.99,
    durationSeconds: 0.08,
    volume: 0.17,
    type: 'triangle',
    timbre: 'glass',
    delaySeconds: 0.05,
    attackSeconds: 0.012,
    releaseSeconds: 0.05,
    glideFromRatio: 1.014,
  },
  {
    frequency: 987.77,
    durationSeconds: 0.11,
    volume: 0.13,
    type: 'triangle',
    timbre: 'glass',
    delaySeconds: 0.108,
    attackSeconds: 0.014,
    releaseSeconds: 0.06,
    glideFromRatio: 1.01,
  },
];
const INVALID_STEPS: ToneStep[] = [
  {
    frequency: 293.66,
    durationSeconds: 0.08,
    volume: 0.13,
    type: 'sine',
    timbre: 'warmPulse',
    attackSeconds: 0.01,
    releaseSeconds: 0.055,
    glideFromRatio: 0.995,
  },
  {
    frequency: 246.94,
    durationSeconds: 0.12,
    volume: 0.13,
    type: 'sine',
    timbre: 'warmPulse',
    delaySeconds: 0.055,
    attackSeconds: 0.01,
    releaseSeconds: 0.07,
    glideFromRatio: 0.99,
  },
];
const CELEBRATION_STEPS: ToneStep[] = [
  {
    frequency: 523.25,
    durationSeconds: 0.11,
    volume: 0.16,
    type: 'triangle',
    timbre: 'softPluck',
    attackSeconds: 0.01,
    releaseSeconds: 0.06,
    glideFromRatio: 1.012,
  },
  {
    frequency: 659.25,
    durationSeconds: 0.11,
    volume: 0.16,
    type: 'triangle',
    timbre: 'softPluck',
    delaySeconds: 0.055,
    attackSeconds: 0.01,
    releaseSeconds: 0.06,
    glideFromRatio: 1.01,
  },
  {
    frequency: 783.99,
    durationSeconds: 0.11,
    volume: 0.16,
    type: 'triangle',
    timbre: 'softPluck',
    delaySeconds: 0.11,
    attackSeconds: 0.01,
    releaseSeconds: 0.06,
    glideFromRatio: 1.008,
  },
  {
    frequency: 1046.5,
    durationSeconds: 0.16,
    volume: 0.15,
    type: 'triangle',
    timbre: 'glass',
    delaySeconds: 0.19,
    attackSeconds: 0.012,
    releaseSeconds: 0.08,
    glideFromRatio: 1.015,
  },
  {
    frequency: 1318.51,
    durationSeconds: 0.18,
    volume: 0.11,
    type: 'triangle',
    timbre: 'glass',
    delaySeconds: 0.28,
    attackSeconds: 0.012,
    releaseSeconds: 0.09,
    glideFromRatio: 1.01,
  },
];

function getAudioContextConstructor():
  | (new () => AudioContextLike)
  | undefined {
  const root = globalThis as typeof globalThis & {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };

  return root.AudioContext ?? root.webkitAudioContext;
}

function getWechatAudioApi(): WechatAudioApiLike | null {
  const root = globalThis as typeof globalThis & { wx?: WechatAudioApiLike };
  return root.wx ?? null;
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;

    output += alphabet[(triple >> 18) & 0x3f];
    output += alphabet[(triple >> 12) & 0x3f];
    output += index + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : '=';
    output += index + 2 < bytes.length ? alphabet[triple & 0x3f] : '=';
  }

  return output;
}

function writeAscii(view: DataView, offset: number, value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
  return offset + value.length;
}

function toneAmplitude(type: ToneType, phase: number): number {
  if (type === 'sine') {
    return Math.sin(phase * Math.PI * 2);
  }

  if (type === 'square') {
    return Math.sign(Math.sin(phase * Math.PI * 2));
  }

  return 2 * Math.asin(Math.sin(phase * Math.PI * 2)) / Math.PI;
}

function timbreAmplitude(step: ToneStep, phase: number): number {
  const timbre = step.timbre ?? 'softPluck';
  const base = toneAmplitude(step.type, phase);

  switch (timbre) {
    case 'glass':
      return (
        base * 0.76 +
        toneAmplitude('sine', phase * 2) * 0.18 +
        toneAmplitude('sine', phase * 3) * 0.08 +
        toneAmplitude('triangle', phase * 4) * 0.05
      );
    case 'warmPulse':
      return (
        toneAmplitude('sine', phase) * 0.82 +
        toneAmplitude('triangle', phase * 2) * 0.16 +
        toneAmplitude('square', phase * 3) * 0.03
      );
    case 'softPluck':
    default:
      return (
        base * 0.8 +
        toneAmplitude('sine', phase * 2) * 0.16 +
        toneAmplitude('triangle', phase * 3) * 0.06
      );
  }
}

function getHarmonicProfile(timbre: ToneTimbre): number[] {
  switch (timbre) {
    case 'glass':
      return [0, 0.82, 0.22, 0.1, 0.05];
    case 'warmPulse':
      return [0, 0.88, 0.18, 0.05, 0.02];
    case 'softPluck':
    default:
      return [0, 0.86, 0.16, 0.08, 0.03];
  }
}

function buildToneClipDataUri(steps: ToneStep[]): string {
  const releaseSeconds = 0.05;
  let clipLengthSeconds = releaseSeconds;
  for (const step of steps) {
    const start = step.delaySeconds ?? 0;
    clipLengthSeconds = Math.max(
      clipLengthSeconds,
      start + step.durationSeconds + releaseSeconds,
    );
  }

  const frameCount = Math.max(1, Math.ceil(clipLengthSeconds * SAMPLE_RATE));
  const samples = new Float32Array(frameCount);

  for (const step of steps) {
    const startFrame = Math.max(0, Math.floor((step.delaySeconds ?? 0) * SAMPLE_RATE));
    const durationFrames = Math.max(1, Math.floor(step.durationSeconds * SAMPLE_RATE));
    const attackFrames = Math.max(
      1,
      Math.floor((step.attackSeconds ?? Math.min(0.018, step.durationSeconds * 0.3)) * SAMPLE_RATE),
    );
    const releaseFrames = Math.max(
      1,
      Math.floor((step.releaseSeconds ?? Math.min(0.06, step.durationSeconds * 0.45)) * SAMPLE_RATE),
    );
    const glideFromRatio = step.glideFromRatio ?? 1;

    for (let frame = 0; frame < durationFrames; frame += 1) {
      const sampleIndex = startFrame + frame;
      if (sampleIndex >= frameCount) {
        break;
      }

      const progress = durationFrames <= 1 ? 1 : frame / (durationFrames - 1);
      const glideRatio = glideFromRatio + (1 - glideFromRatio) * progress;
      const phase = (frame * step.frequency * glideRatio) / SAMPLE_RATE;
      let envelope = 1;
      if (frame < attackFrames) {
        envelope = frame / attackFrames;
      } else if (frame > durationFrames - releaseFrames) {
        envelope = Math.max(0, (durationFrames - frame) / releaseFrames);
      }

      samples[sampleIndex] +=
        timbreAmplitude(step, phase) * step.volume * envelope * MASTER_VOLUME;
    }
  }

  const bytesPerSample = 2;
  const dataSize = frameCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  offset = writeAscii(view, offset, 'RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  offset = writeAscii(view, offset, 'WAVE');
  offset = writeAscii(view, offset, 'fmt ');
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
  offset = writeAscii(view, offset, 'data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let index = 0; index < frameCount; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  return `data:audio/wav;base64,${encodeBase64(new Uint8Array(buffer))}`;
}

class WebAudioBackend implements AudioBackend {
  private context: AudioContextLike | null = null;

  private masterGain: GainNode | null = null;

  private periodicWaveCache = new Map<ToneTimbre, PeriodicWave>();

  private activeComboAudio: HTMLAudioElement | null = null;

  prime(): void {
    const context = this.ensureContext();
    if (!context || context.state !== 'suspended') {
      return;
    }

    void context.resume().catch(() => undefined);
  }

  playPlacement(): void {
    this.playSteps(PLACEMENT_STEPS);
  }

  playInvalid(): void {
    this.playSteps(INVALID_STEPS);
  }

  playCelebration(): void {
    this.playSteps(CELEBRATION_STEPS);
  }

  playComboVoice(url: string): void {
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

  stopComboVoice(): void {
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
    } catch {
      // Ignore pause failures during teardown.
    }
  }

  private playSteps(steps: ToneStep[]): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const masterGain = this.masterGain;
    if (!masterGain) {
      return;
    }

    const baseTime = context.currentTime;
    for (const step of steps) {
      const startTime = baseTime + (step.delaySeconds ?? 0);
      const endTime = startTime + step.durationSeconds;
      const oscillator = context.createOscillator();
      const overtoneOscillator = context.createOscillator();
      const gainNode = context.createGain();
      const shimmerGain = context.createGain();
      const attackSeconds = step.attackSeconds ?? Math.min(0.018, step.durationSeconds * 0.3);
      const releaseSeconds = step.releaseSeconds ?? Math.min(0.06, step.durationSeconds * 0.45);
      const glideFromRatio = step.glideFromRatio ?? 1;
      const timbre = step.timbre ?? 'softPluck';

      oscillator.setPeriodicWave(this.getPeriodicWave(context, timbre));
      overtoneOscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(step.frequency * glideFromRatio, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(step.frequency, startTime + step.durationSeconds);
      overtoneOscillator.frequency.setValueAtTime(step.frequency * 2, startTime);

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(step.volume, startTime + attackSeconds);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime + releaseSeconds * 0.35);

      shimmerGain.gain.setValueAtTime(0.0001, startTime);
      shimmerGain.gain.exponentialRampToValueAtTime(step.volume * 0.14, startTime + attackSeconds * 1.2);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

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

  private getPeriodicWave(context: AudioContextLike, timbre: ToneTimbre): PeriodicWave {
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

  private ensureContext(): AudioContextLike | null {
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
}

class InnerAudioBackend implements AudioBackend {
  private readonly clipMap = {
    placement: buildToneClipDataUri(PLACEMENT_STEPS),
    invalid: buildToneClipDataUri(INVALID_STEPS),
    celebration: buildToneClipDataUri(CELEBRATION_STEPS),
  };

  private primed = false;

  private activeComboAudio: InnerAudioContextLike | null = null;

  private activeComboCleanupTimeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  private comboCleanupInProgress = false;

  prime(): void {
    this.primed = true;
  }

  playPlacement(): void {
    this.playClip(this.clipMap.placement);
  }

  playInvalid(): void {
    this.playClip(this.clipMap.invalid);
  }

  playCelebration(): void {
    this.playClip(this.clipMap.celebration);
  }

  playComboVoice(url: string): void {
    this.stopComboVoice();
    const audio = this.createInnerAudio(url, COMBO_VOICE_VOLUME);
    if (!audio) {
      return;
    }

    this.activeComboAudio = audio;
    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.cleanupComboVoice(audio);
    };

    audio.onEnded?.(() => cleanup());
    audio.onStop?.(() => cleanup());
    audio.onError?.(() => cleanup());

    try {
      audio.play();
      this.activeComboCleanupTimeoutId = globalThis.setTimeout(() => {
        cleanup();
      }, INNER_AUDIO_COMBO_CLEANUP_TIMEOUT_MS);
    } catch {
      cleanup();
    }
  }

  stopComboVoice(): void {
    this.cleanupComboVoice();
  }

  private playClip(source: string, cleanupTimeoutMs = INNER_AUDIO_GENERIC_CLEANUP_TIMEOUT_MS): void {
    const audio = this.createInnerAudio(source, 0.9);
    if (!audio) {
      return;
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.disposeInnerAudio(audio);
    };

    audio.onEnded?.(() => cleanup());
    audio.onStop?.(() => cleanup());
    audio.onError?.(() => cleanup());

    try {
      audio.play();
      globalThis.setTimeout(() => {
        cleanup();
      }, cleanupTimeoutMs);
    } catch {
      cleanup();
    }
  }

  private createInnerAudio(source: string, volume: number): InnerAudioContextLike | null {
    const wxAudio = getWechatAudioApi();
    const audio = wxAudio?.createInnerAudioContext?.();
    if (!audio) {
      return null;
    }

    audio.autoplay = false;
    audio.src = source;
    audio.volume = volume;
    if ('obeyMuteSwitch' in audio) {
      audio.obeyMuteSwitch = false;
    }

    if (!this.primed) {
      this.primed = true;
    }

    return audio;
  }

  private cleanupComboVoice(expectedAudio: InnerAudioContextLike | null = this.activeComboAudio): void {
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

  private disposeInnerAudio(audio: InnerAudioContextLike): void {
    try {
      audio.stop?.();
    } catch {
      // Ignore stop failures during teardown.
    }

    try {
      audio.destroy?.();
    } catch {
      // Ignore destroy failures during teardown.
    }
  }
}

class SilentBackend implements AudioBackend {
  prime(): void {}

  playPlacement(): void {}

  playInvalid(): void {}

  playCelebration(): void {}

  playComboVoice(_url: string): void {}

  stopComboVoice(): void {}
}

function createAudioBackend(): AudioBackend {
  const wechatAudio = getWechatAudioApi();
  if (wechatAudio?.createInnerAudioContext) {
    return new InnerAudioBackend();
  }

  if (getAudioContextConstructor()) {
    return new WebAudioBackend();
  }

  return new SilentBackend();
}

export class FeedbackAudio {
  private readonly backend = createAudioBackend();

  private enabled = true;

  private readonly comboVoiceUrls: Record<string, string>;

  constructor(comboVoiceUrls: Record<string, string> = {}) {
    this.comboVoiceUrls = comboVoiceUrls;
  }

  prime(): void {
    if (!this.enabled) {
      return;
    }
    this.backend.prime();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.backend.stopComboVoice();
    }
  }

  playPlacement(): void {
    if (!this.enabled) {
      return;
    }
    this.backend.playPlacement();
  }

  playInvalid(): void {
    if (!this.enabled) {
      return;
    }
    this.backend.playInvalid();
  }

  playCelebration(): void {
    if (!this.enabled) {
      return;
    }
    this.backend.stopComboVoice();
    this.backend.playCelebration();
  }

  playComboVoice(name: string): void {
    if (!this.enabled) {
      return;
    }

    const url = this.comboVoiceUrls[name];
    if (!url) {
      return;
    }

    this.backend.playComboVoice(url);
  }
}
