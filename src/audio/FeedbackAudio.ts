type ToneType = 'sine' | 'triangle';

type AudioContextLike = AudioContext;

interface ToneStep {
  frequency: number;
  durationSeconds: number;
  volume: number;
  type: ToneType;
  delaySeconds?: number;
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
}

const SAMPLE_RATE = 22_050;
const MASTER_VOLUME = 0.82;
const PLACEMENT_STEPS: ToneStep[] = [
  { frequency: 493.88, durationSeconds: 0.06, volume: 0.32, type: 'triangle' },
  { frequency: 659.25, durationSeconds: 0.07, volume: 0.26, type: 'triangle', delaySeconds: 0.04 },
];
const INVALID_STEPS: ToneStep[] = [
  { frequency: 220, durationSeconds: 0.09, volume: 0.34, type: 'sine' },
];
const CELEBRATION_STEPS: ToneStep[] = [
  { frequency: 523.25, durationSeconds: 0.16, volume: 0.22, type: 'triangle' },
  { frequency: 659.25, durationSeconds: 0.16, volume: 0.22, type: 'triangle', delaySeconds: 0.08 },
  { frequency: 783.99, durationSeconds: 0.16, volume: 0.22, type: 'triangle', delaySeconds: 0.16 },
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

  return 2 * Math.asin(Math.sin(phase * Math.PI * 2)) / Math.PI;
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
    const attackFrames = Math.max(1, Math.floor(Math.min(0.02, step.durationSeconds * 0.35) * SAMPLE_RATE));
    const releaseFrames = Math.max(1, Math.floor(Math.min(0.05, step.durationSeconds * 0.45) * SAMPLE_RATE));

    for (let frame = 0; frame < durationFrames; frame += 1) {
      const sampleIndex = startFrame + frame;
      if (sampleIndex >= frameCount) {
        break;
      }

      const phase = (frame * step.frequency) / SAMPLE_RATE;
      let envelope = 1;
      if (frame < attackFrames) {
        envelope = frame / attackFrames;
      } else if (frame > durationFrames - releaseFrames) {
        envelope = Math.max(0, (durationFrames - frame) / releaseFrames);
      }

      samples[sampleIndex] +=
        toneAmplitude(step.type, phase) * step.volume * envelope * MASTER_VOLUME;
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
      const gainNode = context.createGain();

      oscillator.type = step.type;
      oscillator.frequency.setValueAtTime(step.frequency, startTime);

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(step.volume, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
    }
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

  private playClip(source: string): void {
    const wxAudio = getWechatAudioApi();
    const audio = wxAudio?.createInnerAudioContext?.();
    if (!audio) {
      return;
    }

    audio.autoplay = false;
    audio.src = source;
    audio.volume = 0.9;
    if ('obeyMuteSwitch' in audio) {
      audio.obeyMuteSwitch = false;
    }

    const cleanup = (): void => {
      try {
        audio.stop?.();
      } catch {
        // Ignore stop failures during teardown.
      }
      audio.destroy?.();
    };

    audio.onEnded?.(() => cleanup());
    audio.onStop?.(() => cleanup());
    audio.onError?.(() => cleanup());

    if (!this.primed) {
      this.primed = true;
    }

    try {
      audio.play();
      globalThis.setTimeout(() => {
        cleanup();
      }, 1500);
    } catch {
      cleanup();
    }
  }
}

class SilentBackend implements AudioBackend {
  prime(): void {}

  playPlacement(): void {}

  playInvalid(): void {}

  playCelebration(): void {}
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

  prime(): void {
    this.backend.prime();
  }

  playPlacement(): void {
    this.backend.playPlacement();
  }

  playInvalid(): void {
    this.backend.playInvalid();
  }

  playCelebration(): void {
    this.backend.playCelebration();
  }
}
