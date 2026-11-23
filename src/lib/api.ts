import type {
  AppStats,
  BootstrapPayload,
  ChatMessage,
  MistakeRecord,
  Persona,
  ProviderConfig,
  RoastLevel,
  Scenario,
  SessionReport,
  TurnResponse,
} from '../../shared/types.js';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error || `请求失败 (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export function fetchBootstrap(): Promise<BootstrapPayload> {
  return requestJson<BootstrapPayload>('/api/bootstrap');
}

export function fetchScenarioStarter(scenarioId: string): Promise<{ scenario: Scenario }> {
  return requestJson<{ scenario: Scenario }>(`/api/scenarios/${encodeURIComponent(scenarioId)}/starter`);
}

export function testConnection(config: ProviderConfig): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  latencyMs: number;
}> {
  return requestJson('/api/test-connection', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export interface ChatTurnResult {
  turn: TurnResponse;
  audioBase64?: string;
  audioMimeType?: string;
  useBrowserTts?: boolean;
  mistakes: MistakeRecord[];
  stats: AppStats;
}

export function sendChatTurn(payload: {
  config: ProviderConfig;
  personaId: string;
  scenarioId: string;
  roastLevel: RoastLevel;
  sessionId: string;
  history: ChatMessage[];
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  withTts: boolean;
}): Promise<ChatTurnResult> {
  return requestJson<ChatTurnResult>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendDemoChatTurn(payload: {
  personaId: string;
  scenarioId: string;
  roastLevel: RoastLevel;
  text: string;
}): Promise<ChatTurnResult> {
  return requestJson<ChatTurnResult>('/api/demo/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestTtsAudio(payload: {
  config: ProviderConfig;
  personaId: string;
  text: string;
  styleHint?: string;
}): Promise<{ audioBase64?: string; mimeType?: string; useBrowserFallback?: boolean }> {
  return requestJson('/api/tts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestSessionReview(payload: {
  config?: ProviderConfig;
  personaId: string;
  scenarioId: string;
  roastLevel: RoastLevel;
  messages: ChatMessage[];
}): Promise<SessionReport> {
  return requestJson<SessionReport>('/api/review', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function toggleMistakeMasteredApi(
  id: string,
  mastered: boolean,
): Promise<{ mistakes: MistakeRecord[] }> {
  return requestJson(`/api/mistakes/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ mastered }),
  });
}

export function deleteMistakeApi(id: string): Promise<{ mistakes: MistakeRecord[] }> {
  return requestJson(`/api/mistakes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function clearMistakesApi(): Promise<{ mistakes: MistakeRecord[] }> {
  return requestJson('/api/mistakes', { method: 'DELETE' });
}

export function createCustomPersonaApi(
  input: Omit<Persona, 'id' | 'isCustom'>,
): Promise<{ persona: Persona; personas: Persona[] }> {
  return requestJson('/api/personas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteCustomPersonaApi(id: string): Promise<{ personas: Persona[] }> {
  return requestJson(`/api/personas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function createCustomScenarioApi(
  input: Omit<Scenario, 'id' | 'isCustom' | 'category'>,
): Promise<{ scenario: Scenario; scenarios: Scenario[] }> {
  return requestJson('/api/scenarios', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteCustomScenarioApi(id: string): Promise<{ scenarios: Scenario[] }> {
  return requestJson(`/api/scenarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
