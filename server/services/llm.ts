import { GoogleGenAI } from '@google/genai';
import type {
  ChatMessage,
  EmotionTag,
  MistakeCategory,
  MistakeRecord,
  Persona,
  ProviderConfig,
  RoastLevel,
  Scenario,
  SessionReport,
  TurnResponse,
} from '../../shared/types.js';
import {
  buildLiveCoachingPrompt,
  buildTurnSystemPrompt,
  LIVE_COACHING_SCHEMA,
  SESSION_REPORT_SCHEMA,
  TURN_RESPONSE_SCHEMA,
} from '../prompts.js';

const VALID_EMOTIONS: EmotionTag[] = [
  'amused',
  'roasting',
  'speechless',
  'impressed',
  'furious_coach',
  'supportive',
];

const VALID_CATEGORIES: MistakeCategory[] = [
  'grammar',
  'chinglish',
  'vocabulary',
  'pronunciation',
  'tone',
];

function createGeminiClient(config: ProviderConfig, apiVersion?: string): GoogleGenAI {
  const baseUrl = config.baseUrl?.trim();
  const httpOptions =
    baseUrl || apiVersion
      ? {
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiVersion ? { apiVersion } : {}),
        }
      : undefined;

  return new GoogleGenAI({
    apiKey: config.apiKey.trim(),
    ...(apiVersion ? { apiVersion } : {}),
    ...(httpOptions ? { httpOptions } : {}),
  });
}

function normalizeAudioMimeType(mimeType?: string): string {
  if (!mimeType) return 'audio/wav';
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (base === 'audio/wave' || base === 'audio/x-wav') return 'audio/wav';
  if (base === 'audio/mpeg') return 'audio/mp3';
  return base || 'audio/wav';
}

function extractJsonObject<T>(rawText: string): T {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error(`Model did not return valid JSON: ${trimmed.slice(0, 180)}`);
  }
}

function sanitizeTurnResponse(raw: Partial<TurnResponse>, fallbackTranscript?: string): TurnResponse {
  const emotion: EmotionTag = VALID_EMOTIONS.includes(raw.emotion as EmotionTag)
    ? (raw.emotion as EmotionTag)
    : raw.did_roast
      ? 'roasting'
      : 'amused';

  const corrections = Array.isArray(raw.corrections)
    ? raw.corrections
        .filter((c) => c && typeof c.original === 'string' && typeof c.corrected === 'string')
        .map((c) => ({
          original: c.original.trim(),
          corrected: c.corrected.trim(),
          native_upgrade: (c.native_upgrade || c.corrected).trim(),
          category: VALID_CATEGORIES.includes(c.category as MistakeCategory)
            ? (c.category as MistakeCategory)
            : 'chinglish',
          roast_comment_zh: (c.roast_comment_zh || '这表达太中式了！').trim(),
          tip_zh: (c.tip_zh || '记住更地道的母语说法。').trim(),
          ...(c.repeat_after_me ? { repeat_after_me: c.repeat_after_me.trim() } : {}),
        }))
    : [];

  return {
    user_transcript: raw.user_transcript?.trim() || fallbackTranscript?.trim() || undefined,
    reply_en: (raw.reply_en || "Wait—say that again? Let's keep going!").trim(),
    reply_zh: (raw.reply_zh || '等等，你刚才说啥？再说一遍，咱们继续！').trim(),
    emotion,
    roast_intensity: Math.min(5, Math.max(1, Number(raw.roast_intensity || 3))),
    did_roast: Boolean(raw.did_roast),
    tts_style_hint: raw.tts_style_hint?.trim(),
    corrections,
    follow_up_hint_zh: raw.follow_up_hint_zh?.trim(),
  };
}

function formatHistorySnippet(history: ChatMessage[]): string {
  const recent = history.slice(-10);
  if (!recent.length) return '(Start of conversation)';
  return recent
    .map((m) => `${m.role === 'user' ? 'User' : 'Buddy'}: ${m.textEn}`)
    .join('\n');
}

async function callOpenAICompatJson<T>(params: {
  config: ProviderConfig;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
}): Promise<T> {
  const baseUrl = (params.config.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const model = params.config.chatModel.trim();

  const doRequest = async (useResponseFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.85,
    };
    if (useResponseFormat) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.config.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`API ${res.status}: ${text.slice(0, 320)}`);
      (err as Error & { status?: number; body?: string }).status = res.status;
      (err as Error & { body?: string }).body = text;
      throw err;
    }
    const json = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Model returned empty content.');
    }
    return extractJsonObject<T>(content);
  };

  try {
    return await doRequest(true);
  } catch (err) {
    const status = (err as { status?: number }).status;
    const body = (err as { body?: string }).body || '';
    if (
      status === 400 &&
      /response_format|json_object|unsupported/i.test(body)
    ) {
      return await doRequest(false);
    }
    throw err;
  }
}

export async function generateTurnReply(params: {
  config: ProviderConfig;
  persona: Persona;
  scenario: Scenario;
  roastLevel: RoastLevel;
  pastMistakes: MistakeRecord[];
  history: ChatMessage[];
  userText?: string;
  audioBase64?: string;
  audioMimeType?: string;
}): Promise<TurnResponse> {
  const systemPrompt = buildTurnSystemPrompt({
    persona: params.persona,
    scenario: params.scenario,
    roastLevel: params.roastLevel,
    pastMistakes: params.pastMistakes,
  });

  if (params.config.provider === 'gemini') {
    const ai = createGeminiClient(params.config);
    const model = params.config.chatModel.trim() || 'gemini-4-hydrogen';
    const historyText = formatHistorySnippet(params.history);

    const userPrompt = params.audioBase64
      ? `Recent conversation:\n${historyText}\n\n${
          params.userText
            ? `Browser speech-to-text draft (verify carefully against the actual audio!): "${params.userText}"\n`
            : ''
        }Listen closely to the user's audio recording below. Transcribe exactly what they said into "user_transcript", evaluate both phrasing and pronunciation/clarity, roast & reply in character, and return valid JSON.`
      : `Recent conversation:\n${historyText}\n\nUser's latest message:\n"${params.userText || ''}"\n\nRespond in character and return valid JSON.`;

    const inputPayload = params.audioBase64
      ? [
          { type: 'text' as const, text: userPrompt },
          {
            type: 'audio' as const,
            data: params.audioBase64,
            mime_type: normalizeAudioMimeType(params.audioMimeType),
          },
        ]
      : userPrompt;

    const interaction = await ai.interactions.create({
      model,
      system_instruction: systemPrompt,
      input: inputPayload,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: TURN_RESPONSE_SCHEMA,
      },
      store: false,
    });

    const parsed = extractJsonObject<Partial<TurnResponse>>(interaction.output_text || '{}');
    return sanitizeTurnResponse(parsed, params.userText);
  }

  // OpenAI or OpenAI-compatible provider
  const jsonReminder = `\n\nCRITICAL OUTPUT CONTRACT: Respond ONLY with a single raw JSON object (no markdown fences) matching these keys: user_transcript (optional string), reply_en (string), reply_zh (string), emotion ("amused"|"roasting"|"speechless"|"impressed"|"furious_coach"|"supportive"), roast_intensity (1-5), did_roast (boolean), tts_style_hint (string), corrections (array of {original, corrected, native_upgrade, category: "grammar"|"chinglish"|"vocabulary"|"pronunciation"|"tone", roast_comment_zh, tip_zh, repeat_after_me}), follow_up_hint_zh (string).`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt + jsonReminder },
    ...params.history.slice(-10).map((m) => ({
      role: m.role,
      content: m.textEn,
    })),
    {
      role: 'user',
      content: params.userText || '(User sent an empty message)',
    },
  ];

  const parsed = await callOpenAICompatJson<Partial<TurnResponse>>({
    config: params.config,
    messages,
  });
  return sanitizeTurnResponse(parsed, params.userText);
}

export async function analyzeLiveTurn(params: {
  config: ProviderConfig;
  persona: Persona;
  roastLevel: RoastLevel;
  userText: string;
  aiText: string;
  pastMistakes: MistakeRecord[];
}): Promise<Omit<TurnResponse, 'user_transcript'>> {
  const prompt = buildLiveCoachingPrompt({
    persona: params.persona,
    roastLevel: params.roastLevel,
    userText: params.userText,
    aiText: params.aiText,
    pastMistakes: params.pastMistakes,
  });

  if (params.config.provider === 'gemini') {
    const ai = createGeminiClient(params.config);
    const model = params.config.chatModel.trim() || 'gemini-4-hydrogen';
    const interaction = await ai.interactions.create({
      model,
      input: prompt,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: LIVE_COACHING_SCHEMA,
      },
      store: false,
    });
    const parsed = extractJsonObject<Partial<TurnResponse>>(interaction.output_text || '{}');
    const clean = sanitizeTurnResponse({ ...parsed, reply_en: params.aiText });
    return clean;
  }

  const parsed = await callOpenAICompatJson<Partial<TurnResponse>>({
    config: params.config,
    messages: [
      {
        role: 'system',
        content:
          'Return ONLY a raw JSON object with keys: reply_en, reply_zh, emotion, roast_intensity, did_roast, corrections, follow_up_hint_zh.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
  });
  return sanitizeTurnResponse({ ...parsed, reply_en: params.aiText });
}

export async function generateSessionReport(params: {
  config: ProviderConfig;
  persona: Persona;
  scenario: Scenario;
  roastLevel: RoastLevel;
  messages: ChatMessage[];
}): Promise<SessionReport> {
  const transcript = params.messages
    .map((m) => `${m.role === 'user' ? 'Learner' : params.persona.name}: ${m.textEn}`)
    .join('\n');

  const prompt = `Review this English speaking practice session between a Chinese learner and "${params.persona.name}" (${params.persona.title}) in scenario "${params.scenario.title}". Roast Level: ${params.roastLevel}/5.

TRANSCRIPT:
${transcript}

Provide an honest, insightful, entertaining SessionReport JSON evaluating overall_score, fluency_score, naturalness_score, grammar_score (0-100), buddy_verdict_en (in ${params.persona.name}'s voice), buddy_verdict_zh, top_roast_moment, best_expression, next_focus_zh (2-3 items), and recommended_drills (2-3 English sentences to practice next).`;

  if (params.config.provider === 'gemini') {
    const ai = createGeminiClient(params.config);
    const model = params.config.chatModel.trim() || 'gemini-4-hydrogen';
    const interaction = await ai.interactions.create({
      model,
      input: prompt,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: SESSION_REPORT_SCHEMA,
      },
      store: false,
    });
    return extractJsonObject<SessionReport>(interaction.output_text || '{}');
  }

  return await callOpenAICompatJson<SessionReport>({
    config: params.config,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert, witty English speaking coach. Output ONLY a raw JSON object matching the requested SessionReport keys.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.6,
  });
}

export async function testProviderConnection(config: ProviderConfig): Promise<{
  ok: boolean;
  message: string;
  latencyMs: number;
}> {
  const start = Date.now();
  if (!config.apiKey?.trim()) {
    return { ok: false, message: '请先填入 API Key 再测试连接。', latencyMs: 0 };
  }

  if (config.provider === 'gemini') {
    const ai = createGeminiClient(config);
    const model = config.chatModel.trim() || 'gemini-4-hydrogen';
    const interaction = await ai.interactions.create({
      model,
      input: 'Reply with two words: "Ready buddy!"',
      store: false,
    });
    const out = (interaction.output_text || '').trim();
    return {
      ok: true,
      message: `Gemini 连接成功（${model}）：${out || 'OK'}`,
      latencyMs: Date.now() - start,
    };
  }

  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const model = config.chatModel.trim();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say "Ready buddy!" in two words.' }],
      max_tokens: 20,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 260)}`);
  }
  const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  const reply = parsed.choices?.[0]?.message?.content?.trim() || 'OK';
  return {
    ok: true,
    message: `接口连通成功（${model}）：${reply}`,
    latencyMs: Date.now() - start,
  };
}
