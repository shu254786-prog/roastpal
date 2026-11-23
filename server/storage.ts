import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import type {
  AppStats,
  CorrectionItem,
  MistakeCategory,
  MistakeRecord,
  Persona,
  RoastLevel,
  Scenario,
  SessionSummary,
} from '../shared/types.js';
import { DEFAULT_PERSONAS, DEFAULT_SCENARIOS } from './presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

interface StoreData {
  mistakes: MistakeRecord[];
  stats: AppStats;
  customPersonas: Persona[];
  customScenarios: Scenario[];
  sessions: SessionSummary[];
}

const DEFAULT_STATS: AppStats = {
  totalTurns: 0,
  totalRoasts: 0,
  totalCorrections: 0,
  streakDays: 0,
  lastPracticeDate: '',
  categoryCounts: {
    grammar: 0,
    chinglish: 0,
    vocabulary: 0,
    pronunciation: 0,
    tone: 0,
  },
};

function createEmptyStore(): StoreData {
  return {
    mistakes: [],
    stats: {
      ...DEFAULT_STATS,
      categoryCounts: { ...DEFAULT_STATS.categoryCounts },
    },
    customPersonas: [],
    customScenarios: [],
    sessions: [],
  };
}

let writeQueue: Promise<void> = Promise.resolve();

async function ensureStore(): Promise<StoreData> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
      stats: {
        ...DEFAULT_STATS,
        ...(parsed.stats || {}),
        categoryCounts: {
          ...DEFAULT_STATS.categoryCounts,
          ...(parsed.stats?.categoryCounts || {}),
        },
      },
      customPersonas: Array.isArray(parsed.customPersonas) ? parsed.customPersonas : [],
      customScenarios: Array.isArray(parsed.customScenarios) ? parsed.customScenarios : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    const initial = createEmptyStore();
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

async function saveStore(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function runSerialized<T>(fn: (store: StoreData) => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(async () => {
    const store = await ensureStore();
    const result = await fn(store);
    await saveStore(store);
    return result;
  });
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ');
}

export async function getAllPersonas(): Promise<Persona[]> {
  const store = await ensureStore();
  return [...DEFAULT_PERSONAS, ...store.customPersonas];
}

export async function getPersonaById(id: string): Promise<Persona> {
  const all = await getAllPersonas();
  return all.find((p) => p.id === id) || DEFAULT_PERSONAS[0];
}

export async function addCustomPersona(
  input: Omit<Persona, 'id' | 'isCustom'>,
): Promise<Persona> {
  return runSerialized((store) => {
    const persona: Persona = {
      ...input,
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      isCustom: true,
    };
    store.customPersonas.push(persona);
    return persona;
  });
}

export async function deleteCustomPersona(id: string): Promise<boolean> {
  return runSerialized((store) => {
    const before = store.customPersonas.length;
    store.customPersonas = store.customPersonas.filter((p) => p.id !== id);
    return store.customPersonas.length < before;
  });
}

export async function getAllScenarios(): Promise<Scenario[]> {
  const store = await ensureStore();
  return [...DEFAULT_SCENARIOS, ...store.customScenarios];
}

export async function getScenarioById(id: string): Promise<Scenario> {
  if (id === 'shame-drill') {
    const mistakes = await getUnmasteredMistakes(8);
    const lines = mistakes.length
      ? mistakes
          .map(
            (m, i) =>
              `${i + 1}. Previously said "${m.original}" -> should be "${m.nativeUpgrade}" (${m.roastCommentZh})`,
          )
          .join('\n')
      : 'No unmastered mistakes yet—quiz them with classic tricky Chinglish traps!';
    return {
      id: 'shame-drill',
      title: '黑历史鞭尸特训',
      titleEn: 'Hall of Shame Drill',
      icon: '💀',
      category: 'drill',
      description: '专挑你过去反复犯错的中式英语进行突击抽考，敢再犯直接当场加倍毒舌处刑。',
      contextPrompt: `You are running a rapid-fire "Hall of Shame" torture drill. Grill the user specifically on their past recurring mistakes listed below, trick them into using those phrases naturally in mini-situations, and mercilessly roast them if they fall into the same trap again!\nPast Mistakes:\n${lines}`,
      starterPrompt:
        mistakes.length > 0
          ? `Oh, welcome to the Hall of Shame! Ready to face your past crimes? Let’s start with a classic—you literally told me "${mistakes[0].original}" before. Say it like an actual native right now!`
          : 'Welcome to the Hall of Shame! Your slate is suspiciously clean—so I am going to test your instincts. How would you naturally say "帮我开一下空调" without sounding like a robot?',
      quickReplies: mistakes.slice(0, 3).map((m) => m.nativeUpgrade),
    };
  }
  const all = await getAllScenarios();
  return all.find((s) => s.id === id) || DEFAULT_SCENARIOS[0];
}

export async function addCustomScenario(
  input: Omit<Scenario, 'id' | 'isCustom' | 'category'>,
): Promise<Scenario> {
  return runSerialized((store) => {
    const scenario: Scenario = {
      ...input,
      id: `scenario-${crypto.randomUUID().slice(0, 8)}`,
      category: 'custom',
      isCustom: true,
    };
    store.customScenarios.push(scenario);
    return scenario;
  });
}

export async function deleteCustomScenario(id: string): Promise<boolean> {
  return runSerialized((store) => {
    const before = store.customScenarios.length;
    store.customScenarios = store.customScenarios.filter((s) => s.id !== id);
    return store.customScenarios.length < before;
  });
}

export async function getMistakes(): Promise<MistakeRecord[]> {
  const store = await ensureStore();
  return [...store.mistakes].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function getUnmasteredMistakes(limit = 6): Promise<MistakeRecord[]> {
  const all = await getMistakes();
  return all
    .filter((m) => !m.mastered)
    .sort((a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit);
}

export async function getStats(): Promise<AppStats> {
  const store = await ensureStore();
  return store.stats;
}

export async function recordTurnOutcome(params: {
  didRoast: boolean;
  corrections: CorrectionItem[];
  scenarioTitle?: string;
}): Promise<{ mistakes: MistakeRecord[]; stats: AppStats }> {
  return runSerialized((store) => {
    const now = new Date().toISOString();
    const today = getTodayStr();
    const yesterday = getYesterdayStr();

    store.stats.totalTurns += 1;
    if (params.didRoast) {
      store.stats.totalRoasts += 1;
    }

    if (store.stats.lastPracticeDate === today) {
      if (store.stats.streakDays === 0) store.stats.streakDays = 1;
    } else if (store.stats.lastPracticeDate === yesterday) {
      store.stats.streakDays += 1;
    } else {
      store.stats.streakDays = 1;
    }
    store.stats.lastPracticeDate = today;

    for (const item of params.corrections) {
      if (!item.original?.trim() || !item.corrected?.trim()) continue;
      store.stats.totalCorrections += 1;
      const cat: MistakeCategory = item.category || 'chinglish';
      store.stats.categoryCounts[cat] = (store.stats.categoryCounts[cat] || 0) + 1;

      const normOrig = normalizePhrase(item.original);
      const normCorr = normalizePhrase(item.corrected);
      const existing = store.mistakes.find(
        (m) =>
          normalizePhrase(m.original) === normOrig ||
          (normOrig.length > 4 &&
            normalizePhrase(m.corrected) === normCorr &&
            normalizePhrase(m.original).includes(normOrig.slice(0, 8))),
      );

      if (existing) {
        existing.count += 1;
        existing.mastered = false;
        existing.lastSeenAt = now;
        existing.roastCommentZh = item.roast_comment_zh || existing.roastCommentZh;
        existing.tipZh = item.tip_zh || existing.tipZh;
        existing.nativeUpgrade = item.native_upgrade || existing.nativeUpgrade;
        if (params.scenarioTitle) existing.scenarioTitle = params.scenarioTitle;
      } else {
        store.mistakes.unshift({
          id: `m-${crypto.randomUUID().slice(0, 8)}`,
          original: item.original.trim(),
          corrected: item.corrected.trim(),
          nativeUpgrade: (item.native_upgrade || item.corrected).trim(),
          category: cat,
          roastCommentZh: item.roast_comment_zh || '这句太中式直译了！',
          tipZh: item.tip_zh || '注意地道英语表达习惯。',
          count: 1,
          mastered: false,
          scenarioTitle: params.scenarioTitle,
          createdAt: now,
          lastSeenAt: now,
        });
      }
    }

    // Keep store bounded to recent 250 mistakes
    if (store.mistakes.length > 250) {
      store.mistakes = store.mistakes.slice(0, 250);
    }

    return {
      mistakes: [...store.mistakes].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)),
      stats: store.stats,
    };
  });
}

export async function toggleMistakeMastered(id: string, mastered: boolean): Promise<MistakeRecord[]> {
  return runSerialized((store) => {
    const target = store.mistakes.find((m) => m.id === id);
    if (target) {
      target.mastered = mastered;
    }
    return [...store.mistakes].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  });
}

export async function deleteMistake(id: string): Promise<MistakeRecord[]> {
  return runSerialized((store) => {
    store.mistakes = store.mistakes.filter((m) => m.id !== id);
    return [...store.mistakes].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  });
}

export async function clearMistakes(): Promise<MistakeRecord[]> {
  return runSerialized((store) => {
    store.mistakes = [];
    return [];
  });
}

export async function upsertSessionSummary(params: {
  id: string;
  personaId: string;
  scenarioId: string;
  roastLevel: RoastLevel;
  turnsDelta?: number;
}): Promise<void> {
  await runSerialized((store) => {
    const now = new Date().toISOString();
    const existing = store.sessions.find((s) => s.id === params.id);
    if (existing) {
      existing.personaId = params.personaId;
      existing.scenarioId = params.scenarioId;
      existing.roastLevel = params.roastLevel;
      existing.turns += params.turnsDelta ?? 1;
      existing.updatedAt = now;
    } else {
      store.sessions.unshift({
        id: params.id,
        personaId: params.personaId,
        scenarioId: params.scenarioId,
        roastLevel: params.roastLevel,
        turns: params.turnsDelta ?? 1,
        startedAt: now,
        updatedAt: now,
      });
      if (store.sessions.length > 50) {
        store.sessions = store.sessions.slice(0, 50);
      }
    }
  });
}
