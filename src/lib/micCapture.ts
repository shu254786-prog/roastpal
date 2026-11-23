function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function encodeInt16ChunksToWavBase64(chunks: Uint8Array[], sampleRate = 16000): string {
  const totalBytes = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const wavBuffer = new ArrayBuffer(44 + totalBytes);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, totalBytes, true);

  const outBytes = new Uint8Array(wavBuffer, 44);
  let offset = 0;
  for (const chunk of chunks) {
    outBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return uint8ToBase64(new Uint8Array(wavBuffer));
}

export interface LiveMicHandle {
  setMuted: (muted: boolean) => void;
  stop: () => void;
}

export async function startLiveMicStream(params: {
  onPcmChunk: (base64Pcm16k: string) => void;
  onLevel: (level: number) => void;
}): Promise<LiveMicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioCtx = new AudioContext();
  await audioCtx.audioWorklet.addModule('/pcm-capture-worklet.js');

  const source = audioCtx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', {
    processorOptions: { targetSampleRate: 16000 },
  });
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  let muted = false;

  worklet.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
    if (muted) {
      params.onLevel(0);
      return;
    }
    params.onLevel(event.data.level || 0);
    const bytes = new Uint8Array(event.data.pcm);
    params.onPcmChunk(uint8ToBase64(bytes));
  };

  source.connect(worklet);
  worklet.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  return {
    setMuted: (m: boolean) => {
      muted = m;
      if (m) params.onLevel(0);
    },
    stop: () => {
      try {
        worklet.disconnect();
        source.disconnect();
        silentGain.disconnect();
      } catch {
        // ignore
      }
      stream.getTracks().forEach((t) => t.stop());
      void audioCtx.close();
      params.onLevel(0);
    },
  };
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  start: () => void;
  stop: () => void;
}

export interface TurnRecordingResult {
  audioBase64: string;
  audioMimeType: string;
  speechTranscript: string;
  durationMs: number;
}

export interface TurnRecorderHandle {
  stop: () => Promise<TurnRecordingResult>;
  cancel: () => void;
}

export async function startTurnRecorder(params: {
  onLevel: (level: number) => void;
  onInterimTranscript?: (text: string) => void;
}): Promise<TurnRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioCtx = new AudioContext();
  await audioCtx.audioWorklet.addModule('/pcm-capture-worklet.js');

  const source = audioCtx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', {
    processorOptions: { targetSampleRate: 16000 },
  });
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  const chunks: Uint8Array[] = [];
  const startedAt = Date.now();
  let transcript = '';

  worklet.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
    params.onLevel(event.data.level || 0);
    chunks.push(new Uint8Array(event.data.pcm));
  };

  source.connect(worklet);
  worklet.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  // Concurrent Web Speech API recognition for instant draft & DeepSeek/Qwen free STT
  let recognition: SpeechRecognitionLike | null = null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const RecCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (RecCtor) {
    try {
      recognition = new RecCtor();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i++) {
          parts.push(ev.results[i][0].transcript);
        }
        transcript = parts.join(' ').trim();
        params.onInterimTranscript?.(transcript);
      };
      recognition.onerror = () => {
        // Silent fallback: Gemini audio or Whisper will still process WAV
      };
      recognition.start();
    } catch {
      recognition = null;
    }
  }

  const cleanup = async () => {
    try {
      worklet.disconnect();
      source.disconnect();
      silentGain.disconnect();
    } catch {
      // ignore
    }
    stream.getTracks().forEach((t) => t.stop());
    await audioCtx.close();
    params.onLevel(0);
  };

  return {
    stop: async () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
        // Brief pause so final Web Speech result flushes
        await new Promise((r) => setTimeout(r, 180));
      }
      await cleanup();
      const audioBase64 = encodeInt16ChunksToWavBase64(chunks, 16000);
      return {
        audioBase64,
        audioMimeType: 'audio/wav',
        speechTranscript: transcript.trim(),
        durationMs: Date.now() - startedAt,
      };
    },
    cancel: () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
      void cleanup();
    },
  };
}
