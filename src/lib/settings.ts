import type { ProviderConfig, ProviderPreset, RoastLevel } from '../../shared/types.js';

const STORAGE_KEY_CONFIG = 'roastpal.providerConfig.v1';
const STORAGE_KEY_PREFS = 'roastpal.userPrefs.v1';

export interface UserPreferences {
  personaId: string;
  scenarioId: string;
  roastLevel: RoastLevel;
  bilingualMode: boolean;
  autoPlayAudio: boolean;
  interactionMode: 'turn' | 'live';
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  provider: 'gemini',
  presetId: 'gemini',
  apiKey: '',
  baseUrl: '',
  chatModel: 'gemini-4-hydrogen',
  liveModel: 'gemini-3.8-live',
  ttsModel: 'gemini-3.8-flash-lite-tts',
  sttModel: 'whisper-1',
  voice: 'Kore',
  sttMode: 'auto',
  ttsMode: 'gemini-tts',
  enableAffectiveDialog: true,
};

export const DEFAULT_PREFS: UserPreferences = {
  personaId: 'maya',
  scenarioId: 'free-chat',
  roastLevel: 3,
  bilingualMode: true,
  autoPlayAudio: true,
  interactionMode: 'turn',
};

export function loadProviderConfig(): ProviderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return { ...DEFAULT_PROVIDER_CONFIG };
    return { ...DEFAULT_PROVIDER_CONFIG, ...(JSON.parse(raw) as Partial<ProviderConfig>) };
  } catch {
    return { ...DEFAULT_PROVIDER_CONFIG };
  }
}

export function saveProviderConfig(config: ProviderConfig): void {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
}

export function loadUserPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveUserPrefs(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
}

export function applyPresetToConfig(
  current: ProviderConfig,
  preset: ProviderPreset,
): ProviderConfig {
  return {
    ...current,
    presetId: preset.id,
    provider: preset.provider,
    baseUrl: preset.defaultBaseUrl || '',
    chatModel: preset.defaultChatModel,
    liveModel: preset.defaultLiveModel || '',
    ttsModel: preset.defaultTtsModel || '',
    sttModel: preset.defaultSttModel || 'whisper-1',
    sttMode: preset.defaultSttMode,
    ttsMode: preset.defaultTtsMode,
    voice:
      preset.provider === 'gemini'
        ? 'Kore'
        : preset.provider === 'openai'
          ? 'coral'
          : current.voice || '',
  };
}
