import { GoogleGenAI } from '@google/genai';
import type { Persona, ProviderConfig } from '../../shared/types.js';

export interface TtsAudioResult {
  audioBase64?: string;
  mimeType?: string;
  useBrowserFallback?: boolean;
}

export async function synthesizeSpeech(params: {
  config: ProviderConfig;
  persona: Persona;
  text: string;
  styleHint?: string;
}): Promise<TtsAudioResult> {
  const mode = params.config.ttsMode || 'auto';
  if (mode === 'off' || mode === 'browser') {
    return { useBrowserFallback: mode === 'browser' };
  }

  const useGeminiTts =
    mode === 'gemini-tts' || (mode === 'auto' && params.config.provider === 'gemini');
  const useOpenAiTts =
    mode === 'openai-tts' || (mode === 'auto' && params.config.provider === 'openai');

  if (!useGeminiTts && !useOpenAiTts) {
    return { useBrowserFallback: true };
  }

  const apiKey = params.config.apiKey?.trim();
  if (!apiKey) {
    return { useBrowserFallback: true };
  }

  if (useGeminiTts) {
    const baseUrl = params.config.baseUrl?.trim();
    const ai = new GoogleGenAI({
      apiKey,
      ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
    });
    const model = params.config.ttsModel?.trim() || 'gemini-3.8-flash-lite-tts';
    const voice = params.config.voice?.trim() || params.persona.geminiVoice || 'Kore';
    const style = params.styleHint?.trim() || params.persona.ttsStyleHint;

    const interaction = await ai.interactions.create({
      model,
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: params.text,
              annotations: [
                {
                  type: 'speech_metadata',
                  style,
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice }],
      },
      store: false,
    });

    if (interaction.output_audio?.data) {
      return {
        audioBase64: interaction.output_audio.data,
        mimeType: interaction.output_audio.mime_type || 'audio/wav',
      };
    }
    return { useBrowserFallback: true };
  }

  // OpenAI / compatible /audio/speech
  const baseUrl = (params.config.baseUrl || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/+$/, '');
  const endpoint = `${baseUrl}/audio/speech`;
  const model = params.config.ttsModel?.trim() || 'gpt-4o-mini-tts';
  const voice = params.config.voice?.trim() || params.persona.openaiVoice || 'coral';
  const instructions = params.styleHint?.trim() || params.persona.ttsStyleHint;

  const callSpeech = async (withInstructions: boolean) => {
    const payload: Record<string, unknown> = {
      model,
      voice,
      input: params.text,
      response_format: 'mp3',
    };
    if (withInstructions && model.includes('gpt-4o') && instructions) {
      payload.instructions = instructions;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`TTS ${res.status}: ${errText.slice(0, 240)}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return {
      audioBase64: buf.toString('base64'),
      mimeType: 'audio/mp3',
    };
  };

  try {
    return await callSpeech(true);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 400) {
      return await callSpeech(false);
    }
    throw err;
  }
}
