export type ProviderKind = 'gemini' | 'openai' | 'compatible';

export type SttMode = 'auto' | 'whisper' | 'browser';
export type TtsMode = 'auto' | 'gemini-tts' | 'openai-tts' | 'browser' | 'off';

export interface ProviderConfig {
  provider: ProviderKind;
  presetId: string;
  apiKey: string;
  baseUrl?: string;
  chatModel: string;
  liveModel?: string;
  ttsModel?: string;
  sttModel?: string;
  voice?: string;
  sttMode: SttMode;
  ttsMode: TtsMode;
  enableAffectiveDialog?: boolean;
}

export interface ProviderPreset {
  id: string;
  name: string;
  provider: ProviderKind;
  badge: string;
  description: string;
  defaultBaseUrl?: string;
  defaultChatModel: string;
  suggestedChatModels: string[];
  defaultLiveModel?: string;
  suggestedLiveModels?: string[];
  defaultTtsModel?: string;
  suggestedTtsModels?: string[];
  defaultSttModel?: string;
  supportsLive: boolean;
  supportsNativeAudioTurn: boolean;
  defaultSttMode: SttMode;
  defaultTtsMode: TtsMode;
  keyPlaceholder: string;
}

export type RoastLevel = 1 | 2 | 3 | 4 | 5;

export interface Persona {
  id: string;
  name: string;
  title: string;
  avatar: string;
  tagline: string;
  stylePrompt: string;
  geminiVoice: string;
  openaiVoice: string;
  ttsStyleHint: string;
  accentColor: string;
  defaultRoastLevel: RoastLevel;
  isCustom?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  category: 'daily' | 'work' | 'travel' | 'social' | 'drill' | 'custom';
  description: string;
  contextPrompt: string;
  starterPrompt: string;
  quickReplies: string[];
  isCustom?: boolean;
}

export type MistakeCategory = 'grammar' | 'chinglish' | 'vocabulary' | 'pronunciation' | 'tone';

export interface CorrectionItem {
  original: string;
  corrected: string;
  native_upgrade: string;
  category: MistakeCategory;
  roast_comment_zh: string;
  tip_zh: string;
  repeat_after_me?: string;
}

export type EmotionTag =
  | 'amused'
  | 'roasting'
  | 'speechless'
  | 'impressed'
  | 'furious_coach'
  | 'supportive';

export interface TurnResponse {
  user_transcript?: string;
  reply_en: string;
  reply_zh: string;
  emotion: EmotionTag;
  roast_intensity: number;
  did_roast: boolean;
  tts_style_hint?: string;
  corrections: CorrectionItem[];
  follow_up_hint_zh?: string;
  demo?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  textEn: string;
  textZh?: string;
  emotion?: EmotionTag;
  roastIntensity?: number;
  didRoast?: boolean;
  ttsStyleHint?: string;
  corrections?: CorrectionItem[];
  followUpHintZh?: string;
  audioBase64?: string;
  audioMimeType?: string;
  createdAt: string;
  isLive?: boolean;
  pendingCoaching?: boolean;
}

export interface MistakeRecord {
  id: string;
  original: string;
  corrected: string;
  nativeUpgrade: string;
  category: MistakeCategory;
  roastCommentZh: string;
  tipZh: string;
  count: number;
  mastered: boolean;
  scenarioTitle?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AppStats {
  totalTurns: number;
  totalRoasts: number;
  totalCorrections: number;
  streakDays: number;
  lastPracticeDate: string;
  categoryCounts: Record<MistakeCategory, number>;
}

export interface SessionSummary {
  id: string;
  personaId: string;
  scenarioId: string;
  roastLevel: RoastLevel;
  turns: number;
  startedAt: string;
  updatedAt: string;
}

export interface SessionReport {
  overall_score: number;
  fluency_score: number;
  naturalness_score: number;
  grammar_score: number;
  buddy_verdict_en: string;
  buddy_verdict_zh: string;
  top_roast_moment: string;
  best_expression: string;
  next_focus_zh: string[];
  recommended_drills: string[];
}

export interface BootstrapPayload {
  personas: Persona[];
  scenarios: Scenario[];
  presets: ProviderPreset[];
  geminiVoices: { id: string; label: string }[];
  openaiVoices: { id: string; label: string }[];
  mistakes: MistakeRecord[];
  stats: AppStats;
}

export type LiveServerEvent =
  | { type: 'ready'; provider: ProviderKind; model: string }
  | { type: 'audio'; data: string; sampleRate: number }
  | { type: 'user_transcript'; text: string; final: boolean }
  | { type: 'ai_transcript_delta'; text: string }
  | { type: 'interrupted' }
  | { type: 'turn_complete'; turnId: string; userText: string; aiText: string }
  | { type: 'coaching'; turnId: string; analysis: Omit<TurnResponse, 'user_transcript'> }
  | { type: 'error'; message: string };
