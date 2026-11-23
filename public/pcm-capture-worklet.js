class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetSampleRate =
      (options && options.processorOptions && options.processorOptions.targetSampleRate) || 16000;
    this.buffer = [];
    this.chunkSamples = Math.floor(this.targetSampleRate * 0.1); // ~100ms
    this.samplePos = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0];
    const ratio = sampleRate / this.targetSampleRate;

    // Linear resampling from AudioContext sampleRate -> 16kHz
    while (this.samplePos < channel.length) {
      const idx = Math.floor(this.samplePos);
      const nextIdx = Math.min(channel.length - 1, idx + 1);
      const frac = this.samplePos - idx;
      const sample = channel[idx] + (channel[nextIdx] - channel[idx]) * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
      this.buffer.push(int16);
      this.samplePos += ratio;
    }
    this.samplePos -= channel.length;

    if (this.buffer.length >= this.chunkSamples) {
      const out = new Int16Array(this.buffer.splice(0, this.chunkSamples));
      let sumSq = 0;
      for (let i = 0; i < out.length; i++) {
        const norm = out[i] / 32768;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / out.length);
      const level = Math.min(1, rms * 4.5);
      this.port.postMessage({ pcm: out.buffer, level }, [out.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
