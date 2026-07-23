export class WebBackgroundMusic {
  private readonly audio: HTMLAudioElement;

  private enabled = true;

  private primed = false;

  constructor(source: string) {
    this.audio = new Audio(source);
    this.audio.preload = 'auto';
    this.audio.loop = true;
    this.audio.volume = 0.24;
  }

  prime(): void {
    this.primed = true;
    this.sync();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.audio.pause();
      this.audio.currentTime = 0;
      return;
    }
    this.sync();
  }

  stop(): void {
    this.audio.pause();
  }

  dispose(): void {
    this.enabled = false;
    this.primed = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private sync(): void {
    if (!this.enabled || !this.primed) return;
    const playResult = this.audio.play();
    playResult.catch(() => {
      // Browsers may reject playback until a user gesture is received.
    });
  }
}
