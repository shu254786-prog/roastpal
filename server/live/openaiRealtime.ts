import crypto from 'node:crypto';
import WebSocket from 'ws';
import type {
  LiveServerEvent,
  MistakeRecord,
  Persona,
  ProviderConfig,
  RoastLevel,
  Scenario,
} from '../../shared/types.js';
import { buildLiveSystemPrompt } from '../prompts.js';
import { analyzeLiveTurn } from '../services/llm.js';
import { recordTurnOutcome } from '../storage.js';
import type { LiveSessionHandler } from './geminiLive.js';

function emit(ws: WebSocket, payload: LiveServerEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function toRealtimeWsUrl(baseUrl: string | undefined, model: string): string {
  const raw = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const wsBase = raw.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/realtime?model=${encodeURIComponent(model)}`;
}

// Upsample 16kHz PCM16 -> 24kHz PCM16 via linear interpolation for OpenAI Realtime
function upsample16To24Base64(base64Pcm16k: string): string {
  const inputBuf = Buffer.from(base64Pcm16k, 'base64');
  const inSamples = Math.floor(inputBuf.length / 2);
  if (inSamples === 0) return base64Pcm16k;

  const outSamples = Math.floor(inSamples * 1.5);
  const outBuf = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const srcIdx = i / 1.5;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(inSamples - 1, idx0 + 1);
    const frac = srcIdx - idx0;
    const s0 = inputBuf.readInt16LE(idx0 * 2);
    const s1 = inputBuf.readInt16LE(idx1 * 2);
    const val = Math.max(-32768, Math.min(32767, Math.round(s0 + (s1 - s0) * frac)));
    outBuf.writeInt16LE(val, i * 2);
  }
  return outBuf.toString('base64');
}

export async function createOpenAIRealtimeBridge(params: {
  ws: WebSocket;
  config: ProviderConfig;
  persona: Persona;
  scenario: Scenario;
  roastLevel: RoastLevel;
  pastMistakes: MistakeRecord[];
}): Promise<LiveSessionHandler> {
  const { ws, config, persona, scenario, roastLevel, pastMistakes } = params;
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    throw new Error('请先配置 OpenAI API Key 再开启 Realtime 实时连麦。');
  }

  const model = config.liveModel?.trim() || 'gpt-4o-realtime-preview';
  const voice = config.voice?.trim() || persona.openaiVoice || 'coral';
  const url = toRealtimeWsUrl(config.baseUrl, model);
  const instructions = buildLiveSystemPrompt({
    persona,
    scenario,
    roastLevel,
    pastMistakes,
  });

  const upstream = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  let closed = false;
  let userTranscript = '';
  let aiTranscript = '';

  const flushTurn = (uText: string, aText: string) => {
    const cleanUser = uText.trim();
    const cleanAi = aText.trim();
    if (!cleanUser && !cleanAi) return;

    const turnId = `live-${crypto.randomUUID().slice(0, 8)}`;
    emit(ws, { type: 'turn_complete', turnId, userText: cleanUser, aiText: cleanAi });
    if (!cleanAi) return;
    if (!cleanUser) {
      emit(ws, {
        type: 'coaching',
        turnId,
        analysis: {
          reply_en: cleanAi,
          reply_zh: '',
          emotion: 'amused',
          roast_intensity: roastLevel,
          did_roast: false,
          corrections: [],
        },
      });
      return;
    }

    void (async () => {
      try {
        const analysis = await analyzeLiveTurn({
          config,
          persona,
          roastLevel,
          userText: cleanUser,
          aiText: cleanAi,
          pastMistakes,
        });
        await recordTurnOutcome({
          didRoast: analysis.did_roast,
          corrections: analysis.corrections,
          scenarioTitle: scenario.title,
        });
        emit(ws, { type: 'coaching', turnId, analysis });
      } catch (err) {
        console.warn('[OpenAIRealtime] async coaching analysis failed:', err);
      }
    })();
  };

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OpenAI Realtime 连接超时')), 12000);
    upstream.once('open', () => {
      clearTimeout(timer);
      upstream.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions,
            voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 600,
            },
          },
        }),
      );
      emit(ws, { type: 'ready', provider: config.provider, model });
      upstream.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions: `Greet the user right now in character for scenario "${scenario.title}" in 1-2 punchy sentences.`,
          },
        }),
      );
      resolve();
    });
    upstream.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  upstream.on('message', (raw) => {
    if (closed) return;
    try {
      const ev = JSON.parse(raw.toString()) as {
        type?: string;
        delta?: string;
        transcript?: string;
        error?: { message?: string };
      };

      switch (ev.type) {
        case 'response.audio.delta':
          if (ev.delta) {
            emit(ws, { type: 'audio', data: ev.delta, sampleRate: 24000 });
          }
          break;
        case 'response.audio_transcript.delta':
          if (ev.delta) {
            aiTranscript += ev.delta;
            emit(ws, { type: 'ai_transcript_delta', text: ev.delta });
          }
          break;
        case 'conversation.item.input_audio_transcription.completed':
          if (ev.transcript) {
            userTranscript = ev.transcript;
            emit(ws, { type: 'user_transcript', text: userTranscript, final: true });
          }
          break;
        case 'input_audio_buffer.speech_started':
          emit(ws, { type: 'interrupted' });
          break;
        case 'response.done': {
          const u = userTranscript;
          const a = aiTranscript;
          userTranscript = '';
          aiTranscript = '';
          flushTurn(u, a);
          break;
        }
        case 'error':
          emit(ws, {
            type: 'error',
            message: ev.error?.message || 'OpenAI Realtime 返回错误',
          });
          break;
      }
    } catch {
      // ignore malformed frames
    }
  });

  upstream.on('close', (code, reason) => {
    if (!closed && code !== 1000) {
      emit(ws, {
        type: 'error',
        message: `OpenAI Realtime 连接断开 (${code}): ${reason.toString() || 'Connection closed'}`,
      });
    }
  });

  return {
    sendAudioChunk: (base64Pcm16k: string) => {
      if (closed || upstream.readyState !== WebSocket.OPEN) return;
      upstream.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: upsample16To24Base64(base64Pcm16k),
        }),
      );
    },
    endAudioInput: () => {
      if (closed || upstream.readyState !== WebSocket.OPEN) return;
      upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      upstream.send(JSON.stringify({ type: 'response.create' }));
    },
    sendText: (text: string) => {
      if (closed || upstream.readyState !== WebSocket.OPEN) return;
      upstream.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }],
          },
        }),
      );
      upstream.send(JSON.stringify({ type: 'response.create' }));
    },
    close: () => {
      closed = true;
      try {
        upstream.close();
      } catch {
        // ignore
      }
    },
  };
}
