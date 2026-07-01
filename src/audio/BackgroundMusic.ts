type InnerAudioContextLike = {
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
};

interface WechatAudioApiLike {
  createInnerAudioContext?: () => InnerAudioContextLike;
}

function getWechatAudioApi(): WechatAudioApiLike | null {
  const root = globalThis as typeof globalThis & { wx?: WechatAudioApiLike };
  return root.wx ?? null;
}

export class BackgroundMusic {
  private readonly source: string;

  private context: InnerAudioContextLike | null = null;

  private enabled = true;

  private shouldPlay = true;

  private primed = false;

  constructor(source: string) {
    this.source = source;
  }

  prime(): void {
    if (this.primed) {
      return;
    }

    const wxAudio = getWechatAudioApi();
    if (!wxAudio?.createInnerAudioContext) {
      return;
    }

    const audio = wxAudio.createInnerAudioContext();
    audio.autoplay = false;
    audio.src = this.source;
    audio.volume = 0.48;
    if ('obeyMuteSwitch' in audio) {
      audio.obeyMuteSwitch = false;
    }
    audio.onEnded?.(() => {
      if (!this.enabled || !this.shouldPlay) {
        return;
      }
      try {
        this.context?.play();
      } catch {
        // Ignore replay errors and keep the player quiet.
      }
    });
    audio.onStop?.(() => {
      if (this.enabled && this.shouldPlay) {
        return;
      }
    });
    audio.onError?.(() => {
      if (this.enabled && this.shouldPlay) {
        return;
      }
    });

    this.context = audio;
    this.primed = true;
    this.sync();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.shouldPlay = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    this.sync();
  }

  stop(): void {
    this.shouldPlay = false;
    if (!this.context) {
      return;
    }

    try {
      this.context.stop?.();
    } catch {
      // Ignore stop failures.
    }
  }

  dispose(): void {
    this.shouldPlay = false;
    this.enabled = false;
    if (!this.context) {
      return;
    }

    try {
      this.context.stop?.();
    } catch {
      // Ignore stop failures.
    }
    try {
      this.context.destroy?.();
    } catch {
      // Ignore destroy failures.
    }
    this.context = null;
    this.primed = false;
  }

  private sync(): void {
    if (!this.enabled || !this.shouldPlay || !this.context) {
      return;
    }

    try {
      this.context.play();
    } catch {
      // Ignore autoplay restrictions and wait for the next user gesture.
    }
  }
}
