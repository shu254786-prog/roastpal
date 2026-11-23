import crypto from 'node:crypto';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import type { WebSocket } from 'ws';
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

export interface LiveSessionHandler {
  sendAudioChunk: (base64Pcm16k: string) => void;
  endAudioInput: () => void;
  sendText: (text: string) => void;
  close: () => void;
}

function emit(ws: WebSocket, payload: LiveServerEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export async function createGeminiLiveBridge(params: {
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
    throw new Error('请先配置 Gemini API Key 再开启实时语音连麦。');
  }

  const enableAffective = config.enableAffectiveDialog !== false;
  const baseUrl = config.baseUrl?.trim();
  const ai = new GoogleGenAI({
    apiKey,
    ...(enableAffective ? { apiVersion: 'v1beta' } : {}),
    httpOptions: {
      ...(baseUrl ? { baseUrl } : {}),
      ...(enableAffective ? { apiVersion: 'v1beta' } : {}),
    },
  });

  const model = config.liveModel?.trim() || 'gemini-3.8-live';
  const voiceName = config.voice?.trim() || persona.geminiVoice || 'Kore';
  const systemPrompt = buildLiveSystemPrompt({
    persona,
    scenario,
    roastLevel,
    pastMistakes,
  });

  let userTranscriptBuffer = '';
  let aiTranscriptBuffer = '';
  let session: Session | null = null;
  let closed = false;

  const flushTurn = (userTextRaw: string, aiTextRaw: string) => {
    const userText = userTextRaw.trim();
    const aiText = aiTextRaw.trim();
    if (!userText && !aiText) return;

    const turnId = `live-${crypto.randomUUID().slice(0, 8)}`;
    emit(ws, { type: 'turn_complete', turnId, userText, aiText });

    if (!aiText) return;
    if (!userText) {
      emit(ws, {
        type: 'coaching',
        turnId,
        analysis: {
          reply_en: aiText,
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
          userText,
          aiText,
          pastMistakes,
        });
        await recordTurnOutcome({
          didRoast: analysis.did_roast,
          corrections: analysis.corrections,
          scenarioTitle: scenario.title,
        });
        emit(ws, { type: 'coaching', turnId, analysis });
      } catch (err) {
        console.warn('[GeminiLive] async coaching analysis failed:', err);
      }
    })();
  };

  session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: {
        slidingWindow: {},
      },
      ...(enableAffective ? { enableAffectiveDialog: true } : {}),
    },
    callbacks: {
      onopen: () => {
        emit(ws, { type: 'ready', provider: 'gemini', model });
      },
      onmessage: (message: LiveServerMessage) => {
        if (closed) return;
        const content = message.serverContent;
        if (!content) return;

        // Process ALL parts in each event so audio and inline parts are never dropped
        if (content.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data) {
              emit(ws, {
                type: 'audio',
                data: part.inlineData.data,
                sampleRate: 24000,
              });
            }
          }
        }

        if (content.inputTranscription?.text) {
          userTranscriptBuffer += content.inputTranscription.text;
          emit(ws, {
            type: 'user_transcript',
            text: userTranscriptBuffer,
            final: Boolean(content.inputTranscription.finished),
          });
        }

        if (content.outputTranscription?.text) {
          aiTranscriptBuffer += content.outputTranscription.text;
          emit(ws, {
            type: 'ai_transcript_delta',
            text: content.outputTranscription.text,
          });
        }

        if (content.interrupted) {
          emit(ws, { type: 'interrupted' });
        }

        if (content.turnComplete) {
          const finalUser = userTranscriptBuffer;
          const finalAi = aiTranscriptBuffer;
          userTranscriptBuffer = '';
          aiTranscriptBuffer = '';
          flushTurn(finalUser, finalAi);
        }
      },
      onerror: (err: ErrorEvent) => {
        emit(ws, {
          type: 'error',
          message: err?.message || 'Gemini Live WebSocket 连接异常',
        });
      },
      onclose: (event: CloseEvent) => {
        if (!closed && event?.reason) {
          emit(ws, { type: 'error', message: `Gemini Live 已断开：${event.reason}` });
        }
      },
    },
  });

  // Trigger the buddy's spicy opening line right after connecting
  session.sendRealtimeInput({
    text: `[System: The live voice call just connected for scenario "${scenario.title}". Greet the user immediately in character with 1-2 punchy sentences and kick off the conversation!]`,
  });

  return {
    sendAudioChunk: (base64Pcm16k: string) => {
      if (!session || closed) return;
      session.sendRealtimeInput({
        audio: {
          data: base64Pcm16k,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    },
    endAudioInput: () => {
      if (!session || closed) return;
      session.sendRealtimeInput({ audioStreamEnd: true });
    },
    sendText: (text: string) => {
      if (!session || closed) return;
      session.sendRealtimeInput({ text });
    },
    close: () => {
      closed = true;
      try {
        session?.close();
      } catch {
        // ignore close errors
      }
      session = null;
    },
  };
}
