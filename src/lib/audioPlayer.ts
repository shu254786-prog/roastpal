function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

class AudioPlayerEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private htmlAudio: HTMLAudioElement | null = null;
  private speakingCount = 0;
  private onSpeakingChange?: (speaking: boolean) => void;

  setSpeakingListener(cb: (speaking: boolean) => void): void {
    this.onSpeakingChange = cb;
  }

  private updateSpeaking(delta: number): void {
    const prev = this.speakingCount > 0;
    this.speakingCount = Math.max(0, this.speakingCount + delta);
    const next = this.speakingCount > 0;
    if (prev !== next) {
      this.onSpeakingChange?.(next);
    }
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.ctx.destination);
      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  async playPcmChunk(base64Pcm: string, sampleRate = 24000): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.analyser) return;

    const bytes = base64ToUint8Array(base64Pcm);
    const sampleCount = Math.floor(bytes.byteLength / 2);
    if (sampleCount === 0) return;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);

    const now = ctx.currentTime;
    if (this.nextStartTime < now + 0.02) {
      this.nextStartTime = now + 0.04;
    }
    const startAt = this.nextStartTime;
    this.nextStartTime = startAt + audioBuffer.duration;

    this.activeSources.add(source);
    this.updateSpeaking(1);
    source.onended = () => {
      this.activeSources.delete(source);
      this.updateSpeaking(-1);
    };
    source.start(startAt);
  }

  async playEncodedAudio(base64: string, mimeType = 'audio/wav'): Promise<void> {
    this.interrupt();
    const ctx = await this.ensureContext();
    if (!this.analyser) return;

    const bytes = base64ToUint8Array(base64);
    try {
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      const decoded = await ctx.decodeAudioData(copy);
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(this.analyser);
      this.activeSources.add(source);
      this.updateSpeaking(1);
      source.onended = () => {
        this.activeSources.delete(source);
        this.updateSpeaking(-1);
      };
      source.start();
    } catch {
      // Fallback to HTMLAudioElement if decodeAudioData cannot parse container
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.htmlAudio = audio;
      this.updateSpeaking(1);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (this.htmlAudio === audio) this.htmlAudio = null;
        this.updateSpeaking(-1);
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    }
  }

  interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // already ended
      }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;

    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.currentTime = 0;
      this.htmlAudio = null;
    }
    if (this.speakingCount !== 0) {
      this.speakingCount = 0;
      this.onSpeakingChange?.(false);
    }
  }

  getOutputLevel(): number {
    if (!this.analyser || !this.timeData || this.speakingCount === 0) return 0;
    this.analyser.getByteTimeDomainData(this.timeData);
    let sumSq = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const normalized = (this.timeData[i] - 128) / 128;
      sumSq += normalized * normalized;
    }
    const rms = Math.sqrt(sumSq / this.timeData.length);
    return Math.min(1, rms * 3.8);
  }
}

export const audioPlayer = new AudioPlayerEngine();
