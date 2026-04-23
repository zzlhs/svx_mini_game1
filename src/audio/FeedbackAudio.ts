type ToneType = 'sine' | 'triangle';

export class FeedbackAudio {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  playPlacement(): void {
    this.playTone(493.88, 0.06, 0.04, 'triangle');
    window.setTimeout(() => {
      this.playTone(659.25, 0.07, 0.03, 'triangle');
    }, 40);
  }

  playInvalid(): void {
    this.playTone(220, 0.09, 0.045, 'sine');
  }

  playCelebration(): void {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      window.setTimeout(() => {
        this.playTone(frequency, 0.16, 0.05, 'triangle');
      }, index * 80);
    });
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    volume: number,
    type: ToneType,
  ): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startTime = context.currentTime;
    const endTime = startTime + durationSeconds;
    const masterGain = this.masterGain;

    if (!masterGain) {
      return;
    }

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextConstructor = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

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
