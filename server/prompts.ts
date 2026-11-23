import type {
  MistakeRecord,
  Persona,
  RoastLevel,
  Scenario,
} from '../shared/types.js';

export const ROAST_LEVEL_GUIDE: Record<RoastLevel, { label: string; badge: string; instruction: string }> = {
  1: {
    label: '温柔鼓励',
    badge: 'Lv.1 🌱',
    instruction:
      'Roast Level 1 (Gentle & Encouraging): Be warm, upbeat, and supportive. Only gently tease obvious slip-ups with soft humor while giving clear upgrades.',
  },
  2: {
    label: '轻度打趣',
    badge: 'Lv.2 😏',
    instruction:
      'Roast Level 2 (Playful Teasing): Act like a witty friend who chuckles at awkward phrasing or Chinglish, playfully mocks it for half a second, then smoothly upgrades it.',
  },
  3: {
    label: '嘴毒心软',
    badge: 'Lv.3 🔥',
    instruction:
      'Roast Level 3 (Pingo-Style Sharp & Loving): Deliver sharp, hilarious, dramatic roasts whenever the user uses Chinglish, wrong tenses, or robotic textbook phrasing ("Wait—did you just say open the light?!"), then immediately give the killer native way to say it and keep the conversation fun.',
  },
  4: {
    label: '毫不留情',
    badge: 'Lv.4 🌶️',
    instruction:
      'Roast Level 4 (Brutal Tough Love): Show zero mercy for lazy vocabulary ("very good", "very tired"), missing past tense, or literal Chinese translations. Roast them dramatically and demand high-standard idiomatic English.',
  },
  5: {
    label: '暴躁核爆',
    badge: 'Lv.5 ☢️',
    instruction:
      'Roast Level 5 (Maximum Theatrical Exasperation): Full comedy-drill-sergeant meltdown over every grammar/Chinglish slip! Dramatic gasps, savage witty metaphors about their textbook English, and tell them to repeat the corrected phrase out loud—yet strictly funny and focused on their English habits, never hateful or demeaning to them as a person.',
  },
};

function formatMistakeMemory(mistakes: MistakeRecord[]): string {
  if (!mistakes.length) return 'No stored past mistakes yet.';
  return mistakes
    .map(
      (m) =>
        `- "${m.original}" -> native: "${m.nativeUpgrade}" (repeated ${m.count}x, category: ${m.category})`,
    )
    .join('\n');
}

export function buildTurnSystemPrompt(params: {
  persona: Persona;
  scenario: Scenario;
  roastLevel: RoastLevel;
  pastMistakes: MistakeRecord[];
}): string {
  const roast = ROAST_LEVEL_GUIDE[params.roastLevel] || ROAST_LEVEL_GUIDE[3];

  return `${params.persona.stylePrompt}

${roast.instruction}

CURRENT SCENARIO: "${params.scenario.title}" (${params.scenario.titleEn})
Scenario Directive: ${params.scenario.contextPrompt}

USER'S HALL OF SHAME (Recurring Mistakes to Catch & Roast if Repeated):
${formatMistakeMemory(params.pastMistakes)}

CORE TEACHING & CONVERSATION RULES:
1. Respond in natural, spoken English in "reply_en" (2-4 punchy sentences max—sound like a real voice buddy, NOT an essay or bullet list!).
2. If the user made ANY mistake—grammar error, tense slip, Chinglish literal translation (e.g. "open the light", "very like", "how to say", "eat medicine", "play phone"), unnatural phrasing, or stiff textbook vocabulary—you MUST:
   - Roast/react to it in character inside "reply_en" (matching Roast Level ${params.roastLevel}) AND naturally weave in the better way or challenge them.
   - Populate "corrections" with 1-3 concrete, high-value fixes (do NOT nitpick minor punctuation when input came from voice/STT!).
3. If the user actually spoke great, natural English: praise them briefly in character (still playful!) and optionally offer 1 cooler native/slang "native_upgrade" if useful, with "did_roast": false.
4. Keep the conversation moving! Always end "reply_en" with a sharp question, hook, or roleplay prompt so the user has something fun to say next.
5. If the user spoke or wrote in Chinese (or mixed Chinese + English), call them out playfully for chickening out, translate what they meant into killer English, and push them to say it in English.
6. If the input is audio: listen closely to their actual pronunciation, stress, rhythm, and dropped word endings—call out pronunciation slips in "corrections" with category "pronunciation" and transcribe accurately into "user_transcript".
7. "reply_zh" must be a vivid, natural Chinese translation of "reply_en" matching your persona's spicy/playful tone (not stiff machine translation).
8. Always return valid JSON strictly matching the required schema.`;
}

export const TURN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    user_transcript: {
      type: 'string',
      description: 'Exact transcript of what the user said (especially when audio input is provided).',
    },
    reply_en: {
      type: 'string',
      description: 'Spoken English reply in persona (2-4 punchy sentences, natural contractions, roast + reaction + next hook).',
    },
    reply_zh: {
      type: 'string',
      description: 'Vivid Chinese translation of reply_en matching the persona tone.',
    },
    emotion: {
      type: 'string',
      enum: ['amused', 'roasting', 'speechless', 'impressed', 'furious_coach', 'supportive'],
    },
    roast_intensity: {
      type: 'integer',
      description: 'Actual intensity used in this reply from 1 to 5.',
    },
    did_roast: {
      type: 'boolean',
      description: 'True if the buddy roasted/scolded the user in this turn.',
    },
    tts_style_hint: {
      type: 'string',
      description: 'Short English voice acting direction for TTS, e.g. "dramatically shocked, fast-paced, playful sarcasm".',
    },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string', description: 'Exact flawed or awkward phrase from the user.' },
          corrected: { type: 'string', description: 'Grammatically clean version.' },
          native_upgrade: { type: 'string', description: 'How a native speaker actually says it effortlessly.' },
          category: {
            type: 'string',
            enum: ['grammar', 'chinglish', 'vocabulary', 'pronunciation', 'tone'],
          },
          roast_comment_zh: { type: 'string', description: 'Punchy, funny Chinese roast comment explaining why it sounds funny/wrong.' },
          tip_zh: { type: 'string', description: 'Clear, actionable Chinese tip so the user remembers it.' },
          repeat_after_me: { type: 'string', description: 'Optional short sentence to make the user repeat out loud.' },
        },
        required: ['original', 'corrected', 'native_upgrade', 'category', 'roast_comment_zh', 'tip_zh'],
      },
    },
    follow_up_hint_zh: {
      type: 'string',
      description: 'Optional short Chinese hint of how the user could answer next.',
    },
  },
  required: ['reply_en', 'reply_zh', 'emotion', 'roast_intensity', 'did_roast', 'corrections'],
} as const;

export function buildLiveSystemPrompt(params: {
  persona: Persona;
  scenario: Scenario;
  roastLevel: RoastLevel;
  pastMistakes: MistakeRecord[];
}): string {
  const roast = ROAST_LEVEL_GUIDE[params.roastLevel] || ROAST_LEVEL_GUIDE[3];

  return `${params.persona.stylePrompt}

${roast.instruction}

CURRENT LIVE VOICE SCENARIO: "${params.scenario.title}" (${params.scenario.titleEn})
${params.scenario.contextPrompt}

USER'S RECURRING MISTAKES (Catch & roast them live if they slip up again):
${formatMistakeMemory(params.pastMistakes)}

LIVE AUDIO CONVERSATION RULES:
- This is a real-time spoken voice call! Speak naturally in English with vivid emotion, pauses, laughs, gasps, and punchy reactions.
- Keep every turn concise (1 to 3 crisp sentences) so it feels like fast ping-pong banter with a real human buddy.
- Do NOT output markdown, bullet points, or JSON in voice mode—just speak naturally!
- When the user makes a grammar, pronunciation, or Chinglish mistake: roast it immediately in character with humor, drop the exact native upgrade ("Say this instead: ..."), and bounce the ball back with a quick question or prompt.
- If they speak Chinese instead of English, playfully scold them and make them translate it into English.`;
}

export function buildLiveCoachingPrompt(params: {
  persona: Persona;
  roastLevel: RoastLevel;
  userText: string;
  aiText: string;
  pastMistakes: MistakeRecord[];
}): string {
  return `You are analyzing one completed voice-call turn between an English learner and their AI speaking buddy "${params.persona.name}" (Roast Level ${params.roastLevel}/5).

USER SAID: ${JSON.stringify(params.userText)}
AI BUDDY REPLIED: ${JSON.stringify(params.aiText)}

USER'S HALL OF SHAME:
${formatMistakeMemory(params.pastMistakes)}

Produce a JSON object matching the schema:
- "reply_en": repeat the exact AI buddy reply or clean up whitespace.
- "reply_zh": natural, spicy Chinese translation of AI BUDDY REPLIED matching the persona's voice.
- "emotion": pick best match from ['amused', 'roasting', 'speechless', 'impressed', 'furious_coach', 'supportive'].
- "roast_intensity": integer 1-5 reflecting how fierce the AI reply was.
- "did_roast": boolean whether AI roasted/corrected the user.
- "corrections": extract 0-3 high-value mistakes from USER SAID (ignore minor ASR punctuation issues). Include Chinglish, tense errors, awkward phrasing, or pronunciation clues implied in the reply, with hilarious Chinese "roast_comment_zh" and practical "tip_zh".
- "follow_up_hint_zh": short Chinese suggestion for what the user can say next.`;
}

export const LIVE_COACHING_SCHEMA = {
  type: 'object',
  properties: {
    reply_en: { type: 'string' },
    reply_zh: { type: 'string' },
    emotion: {
      type: 'string',
      enum: ['amused', 'roasting', 'speechless', 'impressed', 'furious_coach', 'supportive'],
    },
    roast_intensity: { type: 'integer' },
    did_roast: { type: 'boolean' },
    corrections: TURN_RESPONSE_SCHEMA.properties.corrections,
    follow_up_hint_zh: { type: 'string' },
  },
  required: ['reply_en', 'reply_zh', 'emotion', 'roast_intensity', 'did_roast', 'corrections'],
} as const;

export const SESSION_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'integer', description: '0-100 score' },
    fluency_score: { type: 'integer', description: '0-100 score' },
    naturalness_score: { type: 'integer', description: '0-100 score' },
    grammar_score: { type: 'integer', description: '0-100 score' },
    buddy_verdict_en: { type: 'string', description: 'Punchy in-character summary verdict in English.' },
    buddy_verdict_zh: { type: 'string', description: 'Vivid Chinese summary verdict in character.' },
    top_roast_moment: { type: 'string', description: 'Funniest/most memorable mistake or roast moment from the session (in Chinese + English quote).' },
    best_expression: { type: 'string', description: 'Best native phrase the user used or learned in this session.' },
    next_focus_zh: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 specific actionable focus points in Chinese.',
    },
    recommended_drills: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 English sentences the user should practice out loud tomorrow.',
    },
  },
  required: [
    'overall_score',
    'fluency_score',
    'naturalness_score',
    'grammar_score',
    'buddy_verdict_en',
    'buddy_verdict_zh',
    'top_roast_moment',
    'best_expression',
    'next_focus_zh',
    'recommended_drills',
  ],
} as const;
