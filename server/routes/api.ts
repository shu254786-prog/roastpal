import { Router } from 'express';
import { z } from 'zod';
import type {
  BootstrapPayload,
  ChatMessage,
  CorrectionItem,
  Persona,
  ProviderConfig,
  RoastLevel,
  TurnResponse,
} from '../../shared/types.js';
import { GEMINI_VOICES, OPENAI_VOICES, PROVIDER_PRESETS } from '../presets.js';
import {
  generateSessionReport,
  generateTurnReply,
  testProviderConnection,
} from '../services/llm.js';
import { transcribeWithWhisper } from '../services/stt.js';
import { synthesizeSpeech } from '../services/tts.js';
import {
  addCustomPersona,
  addCustomScenario,
  clearMistakes,
  deleteCustomPersona,
  deleteCustomScenario,
  deleteMistake,
  getAllPersonas,
  getAllScenarios,
  getMistakes,
  getPersonaById,
  getScenarioById,
  getStats,
  getUnmasteredMistakes,
  recordTurnOutcome,
  toggleMistakeMastered,
  upsertSessionSummary,
} from '../storage.js';

export const apiRouter = Router();

const providerConfigSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'compatible']),
  presetId: z.string().default('gemini'),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  chatModel: z.string().min(1),
  liveModel: z.string().optional(),
  ttsModel: z.string().optional(),
  sttModel: z.string().optional(),
  voice: z.string().optional(),
  sttMode: z.enum(['auto', 'whisper', 'browser']).default('auto'),
  ttsMode: z.enum(['auto', 'gemini-tts', 'openai-tts', 'browser', 'off']).default('auto'),
  enableAffectiveDialog: z.boolean().optional(),
});

const historyItemSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  textEn: z.string(),
  textZh: z.string().optional(),
  createdAt: z.string(),
});

function formatFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403|invalid.*key|api key|unauthenticated/i.test(msg)) {
    return `API Key 验证失败或无权限，请检查 Key 是否正确：${msg}`;
  }
  if (/429|quota|rate limit|resource_exhausted/i.test(msg)) {
    return `触发 API 限流或额度不足（429），请稍后再试或更换 Key：${msg}`;
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
    return `无法连接到模型接口（请检查网络/代理或 Base URL 是否正确）：${msg}`;
  }
  return msg;
}

function buildDemoTurn(params: {
  text: string;
  persona: Persona;
  roastLevel: RoastLevel;
}): TurnResponse {
  const raw = params.text.trim();
  const lower = raw.toLowerCase();
  const corrections: CorrectionItem[] = [];

  if (/open\s+(the\s+)?(light|ac|air\s*conditioner|tv|fan)/i.test(raw)) {
    corrections.push({
      original: raw.match(/open\s+(the\s+)?(light|ac|air\s*conditioner|tv|fan)/i)?.[0] || 'open the light',
      corrected: 'turn on the light / AC',
      native_upgrade: 'Could you flip the light on? / Mind cranking the AC up?',
      category: 'chinglish',
      roast_comment_zh: '又在用手指把灯泡拧开、把空调掀盖子是吧？英语里电器开关用 turn on，不能 open！',
      tip_zh: '记住：开门开窗才用 open；开灯、开空调、开电脑一律用 turn on / switch on。',
      repeat_after_me: 'Could you turn the AC on? It is boiling in here.',
    });
  }

  if (/\bvery\s+(like|love|enjoy|want|hope|happy|tired|good|angry|busy)\b/i.test(raw)) {
    const match = raw.match(/\bvery\s+\w+/i)?.[0] || 'very like';
    const isVerb = /very\s+(like|love|enjoy|want|hope)/i.test(match);
    corrections.push({
      original: match,
      corrected: isVerb ? 'really like / totally love' : 'exhausted / super into / furious',
      native_upgrade: isVerb
        ? "I'm lowkey obsessed with..."
        : "I'm completely wiped out / I'm beyond hyped",
      category: isVerb ? 'grammar' : 'vocabulary',
      roast_comment_zh: isVerb
        ? `“${match}” 简直是中式英语防伪标！very 不能直接修饰动词，听起来就像小学生刚背完单词！`
        : `别再万金油 "${match}" 了！把 very 扔进垃圾桶，换个有画面感的词！`,
      tip_zh: isVerb
        ? '英语里修饰 like / love / want 请用 really、totally 或 a lot，千万别用 very + 动词。'
        : '用 exhausted 替代 very tired，furious 替代 very angry，地道感瞬间翻倍。',
      repeat_after_me: isVerb ? 'I really enjoy hanging out after work.' : "I'm completely wiped out today.",
    });
  }

  if (/no\s+(want|bring|fix|know|like|have)|go to home|play with phone|eat medicine|for play|contact way|too many works/i.test(raw)) {
    corrections.push({
      original: raw,
      corrected: raw
        .replace(/no\s+(want|bring|fix|know|like|have)/gi, "don't $1")
        .replace(/go to home/gi, 'head home')
        .replace(/for play/gi, 'for vacation / to hang out')
        .replace(/contact way/gi, 'contact info / socials')
        .replace(/too many works/gi, 'way too much work'),
      native_upgrade: /work/i.test(raw)
        ? 'My boss dumped a ton of work on me today.'
        : /play/i.test(raw)
          ? "I'm just visiting for fun with a friend."
          : "Let's swap Instagrams / numbers!",
      category: 'chinglish',
      roast_comment_zh: '这股浓郁的逐字翻译味隔着屏幕都冲进我鼻子里了！老外听了得愣三秒！',
      tip_zh: 'home 是副词不用加 to；work 不可数不能加 s；“联系方式”叫 contact info 或 socials。',
      repeat_after_me: 'My boss dumped way too much work on me today.',
    });
  }

  if (corrections.length === 0 && /[\u4e00-\u9fa5]/.test(raw)) {
    corrections.push({
      original: raw,
      corrected: 'Say that in English!',
      native_upgrade: 'Wait—let me put that into English for you.',
      category: 'tone',
      roast_comment_zh: '说好练英语结果直接飙中文？想偷懒门儿都没有！',
      tip_zh: '哪怕磕磕巴巴也要用英语先蹦出关键词，我来帮你接住并升级成地道表达。',
      repeat_after_me: 'Give me a second, let me say that in English.',
    });
  }

  const didRoast = corrections.length > 0 || params.roastLevel >= 4;
  const replyEn =
    corrections.length > 0
      ? `Hold everything—did my ears just hear "${corrections[0].original}"?! Bestie, stop translating Chinese word-for-word! Say "${corrections[0].native_upgrade}" instead—now try hitting me with a real reply!`
      : lower.length < 18
        ? `Whoa, giving me a three-word reply like that? Don't play shy with me—give me a full sentence with some actual spice! What really happened today?`
        : `Okayyy, wait—that actually sounded pretty smooth! Still a little safe though, so don't get cocky yet. Tell me more—what are you planning to do next?`;

  const replyZh =
    corrections.length > 0
      ? `等会儿——我刚没听错吧，你居然说了 “${corrections[0].original}”？！求求你别再逐字直译了！换成 “${corrections[0].native_upgrade}” 才像话——来，赶紧再回我一句！`
      : lower.length < 18
        ? `哇哦，就回我这么几个词敷衍谁呢？别害羞，给我甩一句完整的、带点情绪的英文出来！今天到底发生啥了？`
        : `不错嘛，这句挺顺溜的！不过先别得意太早，表达还是偏保守了点。接着说——你接下来打算咋整？`;

  return {
    user_transcript: raw,
    reply_en: replyEn,
    reply_zh: replyZh,
    emotion: corrections.length > 0 ? 'roasting' : 'impressed',
    roast_intensity: corrections.length > 0 ? params.roastLevel : Math.max(1, params.roastLevel - 1),
    did_roast: didRoast,
    tts_style_hint: params.persona.ttsStyleHint,
    corrections,
    follow_up_hint_zh:
      '【当前为内置试玩模式】点右上角「配置 API Key」填入 Gemini / OpenAI / DeepSeek Key，即可解锁真正大模型自由吐槽与实时语音连麦！',
    demo: true,
  };
}

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'roastpal', time: new Date().toISOString() });
});

apiRouter.get('/bootstrap', async (_req, res) => {
  try {
    const [personas, scenarios, mistakes, stats] = await Promise.all([
      getAllPersonas(),
      getAllScenarios(),
      getMistakes(),
      getStats(),
    ]);
    const payload: BootstrapPayload = {
      personas,
      scenarios,
      presets: PROVIDER_PRESETS,
      geminiVoices: GEMINI_VOICES,
      openaiVoices: OPENAI_VOICES,
      mistakes,
      stats,
    };
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/test-connection', async (req, res) => {
  try {
    const parsed = providerConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: '配置参数不完整，请检查模型名和 API Key。' });
      return;
    }
    const result = await testProviderConnection(parsed.data as ProviderConfig);
    res.json(result);
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: formatFriendlyError(err),
      latencyMs: 0,
    });
  }
});

apiRouter.post('/stt', async (req, res) => {
  try {
    const schema = z.object({
      config: providerConfigSchema,
      audioBase64: z.string().min(1),
      audioMimeType: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '音频数据无效' });
      return;
    }
    const transcript = await transcribeWithWhisper({
      config: parsed.data.config as ProviderConfig,
      audioBase64: parsed.data.audioBase64,
      audioMimeType: parsed.data.audioMimeType,
    });
    res.json({ transcript });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/tts', async (req, res) => {
  try {
    const schema = z.object({
      config: providerConfigSchema,
      personaId: z.string().default('maya'),
      text: z.string().min(1),
      styleHint: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'TTS 参数无效' });
      return;
    }
    const persona = await getPersonaById(parsed.data.personaId);
    const result = await synthesizeSpeech({
      config: parsed.data.config as ProviderConfig,
      persona,
      text: parsed.data.text,
      styleHint: parsed.data.styleHint,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/chat', async (req, res) => {
  try {
    const schema = z.object({
      config: providerConfigSchema,
      personaId: z.string().default('maya'),
      scenarioId: z.string().default('free-chat'),
      roastLevel: z.number().int().min(1).max(5).optional(),
      sessionId: z.string().optional(),
      history: z.array(historyItemSchema).default([]),
      text: z.string().optional(),
      audioBase64: z.string().optional(),
      audioMimeType: z.string().optional(),
      withTts: z.boolean().default(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '请求参数格式不正确' });
      return;
    }

    const {
      config,
      personaId,
      scenarioId,
      roastLevel: requestedRoast,
      sessionId,
      history,
      text,
      audioBase64,
      audioMimeType,
      withTts,
    } = parsed.data;

    if (!config.apiKey?.trim()) {
      res.status(400).json({ error: '请先配置 API Key，或使用试玩模式体验。' });
      return;
    }

    if (!text?.trim() && !audioBase64) {
      res.status(400).json({ error: '请先说点什么或输入英文句子。' });
      return;
    }

    const [persona, scenario, pastMistakes] = await Promise.all([
      getPersonaById(personaId),
      getScenarioById(scenarioId),
      getUnmasteredMistakes(6),
    ]);
    const roastLevel = (requestedRoast || persona.defaultRoastLevel || 3) as RoastLevel;

    let finalUserText = text?.trim() || '';
    const useNativeAudioInTurn = config.provider === 'gemini' && Boolean(audioBase64);

    if (!useNativeAudioInTurn && audioBase64 && !finalUserText) {
      if (config.sttMode === 'whisper' || (config.sttMode === 'auto' && config.provider === 'openai')) {
        finalUserText = await transcribeWithWhisper({
          config: config as ProviderConfig,
          audioBase64,
          audioMimeType,
        });
      }
    }

    if (!useNativeAudioInTurn && !finalUserText) {
      res.status(400).json({
        error:
          '未识别到清晰的英文语音。若当前服务商未开启 Whisper，请确认浏览器麦克风权限，或直接在输入框打字 / 开启「浏览器语音识别」。',
      });
      return;
    }

    const turn = await generateTurnReply({
      config: config as ProviderConfig,
      persona,
      scenario,
      roastLevel,
      pastMistakes,
      history: history as ChatMessage[],
      userText: finalUserText,
      audioBase64: useNativeAudioInTurn ? audioBase64 : undefined,
      audioMimeType: useNativeAudioInTurn ? audioMimeType : undefined,
    });

    const [{ mistakes, stats }, ttsResult] = await Promise.all([
      recordTurnOutcome({
        didRoast: turn.did_roast,
        corrections: turn.corrections,
        scenarioTitle: scenario.title,
      }),
      withTts
        ? synthesizeSpeech({
            config: config as ProviderConfig,
            persona,
            text: turn.reply_en,
            styleHint: turn.tts_style_hint,
          }).catch((ttsErr) => {
            console.warn('[TTS] fallback triggered:', ttsErr);
            return { useBrowserFallback: true } as {
              audioBase64?: string;
              mimeType?: string;
              useBrowserFallback?: boolean;
            };
          })
        : Promise.resolve({ useBrowserFallback: false } as {
            audioBase64?: string;
            mimeType?: string;
            useBrowserFallback?: boolean;
          }),
    ]);

    if (sessionId) {
      await upsertSessionSummary({
        id: sessionId,
        personaId: persona.id,
        scenarioId: scenario.id,
        roastLevel,
      });
    }

    res.json({
      turn,
      audioBase64: ttsResult.audioBase64,
      audioMimeType: ttsResult.mimeType,
      useBrowserTts: Boolean(ttsResult.useBrowserFallback),
      mistakes,
      stats,
    });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/demo/chat', async (req, res) => {
  try {
    const schema = z.object({
      personaId: z.string().default('maya'),
      scenarioId: z.string().default('free-chat'),
      roastLevel: z.number().int().min(1).max(5).optional(),
      text: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '请输入要测试的英文句子。' });
      return;
    }

    const [persona, scenario] = await Promise.all([
      getPersonaById(parsed.data.personaId),
      getScenarioById(parsed.data.scenarioId),
    ]);
    const roastLevel = (parsed.data.roastLevel || persona.defaultRoastLevel || 3) as RoastLevel;
    const turn = buildDemoTurn({
      text: parsed.data.text,
      persona,
      roastLevel,
    });
    const { mistakes, stats } = await recordTurnOutcome({
      didRoast: turn.did_roast,
      corrections: turn.corrections,
      scenarioTitle: scenario.title,
    });

    res.json({
      turn,
      useBrowserTts: true,
      mistakes,
      stats,
    });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/review', async (req, res) => {
  try {
    const schema = z.object({
      config: providerConfigSchema.optional(),
      personaId: z.string().default('maya'),
      scenarioId: z.string().default('free-chat'),
      roastLevel: z.number().int().min(1).max(5).default(3),
      messages: z.array(historyItemSchema).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '需要至少一轮对话才能生成复盘报告。' });
      return;
    }

    const [persona, scenario] = await Promise.all([
      getPersonaById(parsed.data.personaId),
      getScenarioById(parsed.data.scenarioId),
    ]);

    if (!parsed.data.config?.apiKey?.trim()) {
      res.json({
        overall_score: 78,
        fluency_score: 75,
        naturalness_score: 72,
        grammar_score: 80,
        buddy_verdict_en:
          "Not bad for warm-up! You're brave enough to talk, now plug in an API key so I can really roast those Chinglish habits.",
        buddy_verdict_zh:
          '热身表现不错，起码敢开口！赶紧去设置里把 API Key 插上，让我火力全开给你特训！',
        top_roast_moment: '试玩模式体验中：记得把 open the light / very like 彻底踢出你的词库！',
        best_expression: 'I completely wiped out today. / Could you turn the AC on?',
        next_focus_zh: [
          '改掉「动词前加 very」和「开电器用 open」的直译习惯',
          '接入 API Key 后开启实时语音连麦，训练 3 秒内脱口而出的反应速度',
        ],
        recommended_drills: [
          'Could you turn the AC up? It is boiling in here.',
          'My boss dumped way too much work on me today.',
        ],
      });
      return;
    }

    const report = await generateSessionReport({
      config: parsed.data.config as ProviderConfig,
      persona,
      scenario,
      roastLevel: parsed.data.roastLevel as RoastLevel,
      messages: parsed.data.messages as ChatMessage[],
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/mistakes/:id/toggle', async (req, res) => {
  try {
    const mastered = Boolean(req.body?.mastered);
    const mistakes = await toggleMistakeMastered(req.params.id, mastered);
    res.json({ mistakes });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.delete('/mistakes/:id', async (req, res) => {
  try {
    const mistakes = await deleteMistake(req.params.id);
    res.json({ mistakes });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.delete('/mistakes', async (_req, res) => {
  try {
    const mistakes = await clearMistakes();
    res.json({ mistakes });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/personas', async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(30),
      title: z.string().min(1).max(40),
      avatar: z.string().default('🎭'),
      tagline: z.string().min(1).max(120),
      stylePrompt: z.string().min(5),
      geminiVoice: z.string().default('Kore'),
      openaiVoice: z.string().default('coral'),
      ttsStyleHint: z.string().default('expressive, sharp, playful conversational tone'),
      accentColor: z.string().default('#FF5A36'),
      defaultRoastLevel: z.number().int().min(1).max(5).default(3),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '搭子人设字段填写不完整' });
      return;
    }
    const created = await addCustomPersona({
      ...parsed.data,
      defaultRoastLevel: parsed.data.defaultRoastLevel as RoastLevel,
    });
    const personas = await getAllPersonas();
    res.json({ persona: created, personas });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.delete('/personas/:id', async (req, res) => {
  try {
    await deleteCustomPersona(req.params.id);
    const personas = await getAllPersonas();
    res.json({ personas });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.post('/scenarios', async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(40),
      titleEn: z.string().min(1).max(60),
      icon: z.string().default('🎯'),
      description: z.string().min(1).max(160),
      contextPrompt: z.string().min(5),
      starterPrompt: z.string().min(5),
      quickReplies: z.array(z.string()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '场景字段填写不完整' });
      return;
    }
    const created = await addCustomScenario(parsed.data);
    const scenarios = await getAllScenarios();
    res.json({ scenario: created, scenarios });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.delete('/scenarios/:id', async (req, res) => {
  try {
    await deleteCustomScenario(req.params.id);
    const scenarios = await getAllScenarios();
    res.json({ scenarios });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});

apiRouter.get('/scenarios/:id/starter', async (req, res) => {
  try {
    const scenario = await getScenarioById(req.params.id);
    res.json({ scenario });
  } catch (err) {
    res.status(500).json({ error: formatFriendlyError(err) });
  }
});
