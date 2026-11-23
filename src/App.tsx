import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type {
  AppStats,
  ChatMessage,
  EmotionTag,
  LiveServerEvent,
  MistakeRecord,
  Persona,
  ProviderConfig,
  ProviderPreset,
  RoastLevel,
  Scenario,
  SessionReport,
} from '../shared/types.js';
import { ChatFeed } from './components/ChatFeed';
import { HallOfShame } from './components/HallOfShame';
import { HeaderBar } from './components/HeaderBar';
import { ReviewModal } from './components/ReviewModal';
import { SettingsModal } from './components/SettingsModal';
import { type ActiveTab, Sidebar } from './components/Sidebar';
import { StatsPanel } from './components/StatsPanel';
import { VoiceDock } from './components/VoiceDock';
import { VoiceOrb } from './components/VoiceOrb';
import {
  clearMistakesApi,
  createCustomPersonaApi,
  createCustomScenarioApi,
  deleteCustomPersonaApi,
  deleteCustomScenarioApi,
  deleteMistakeApi,
  fetchBootstrap,
  fetchScenarioStarter,
  requestSessionReview,
  requestTtsAudio,
  sendChatTurn,
  sendDemoChatTurn,
  toggleMistakeMasteredApi,
} from './lib/api';
import { audioPlayer } from './lib/audioPlayer';
import { speakWithBrowserTts, stopBrowserSpeech } from './lib/browserTts';
import { LiveSessionClient } from './lib/liveClient';
import {
  type LiveMicHandle,
  startLiveMicStream,
  startTurnRecorder,
  type TurnRecorderHandle,
} from './lib/micCapture';
import {
  DEFAULT_PREFS,
  DEFAULT_PROVIDER_CONFIG,
  loadProviderConfig,
  loadUserPrefs,
  saveProviderConfig,
  saveUserPrefs,
  type UserPreferences,
} from './lib/settings';

const FALLBACK_STATS: AppStats = {
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

function makeStarterMessage(persona: Persona, scenario: Scenario): ChatMessage {
  return {
    id: `starter-${scenario.id}-${Date.now()}`,
    role: 'assistant',
    textEn: scenario.starterPrompt,
    textZh: `【场景：${scenario.title}】${persona.name} 已经就位，随时开口接招吧！`,
    emotion: 'amused',
    didRoast: false,
    createdAt: new Date().toISOString(),
  };
}

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [geminiVoices, setGeminiVoices] = useState<{ id: string; label: string }[]>([]);
  const [openaiVoices, setOpenaiVoices] = useState<{ id: string; label: string }[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [stats, setStats] = useState<AppStats>(FALLBACK_STATS);

  const [config, setConfig] = useState<ProviderConfig>(() => loadProviderConfig() || DEFAULT_PROVIDER_CONFIG);
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPrefs() || DEFAULT_PREFS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState(() => `sess-${Date.now()}`);

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [repeatTarget, setRepeatTarget] = useState<string | null>(null);

  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [liveUserInterim, setLiveUserInterim] = useState('');
  const [liveAiInterim, setLiveAiInterim] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewReport, setReviewReport] = useState<SessionReport | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const recorderRef = useRef<TurnRecorderHandle | null>(null);
  const liveClientRef = useRef<LiveSessionClient | null>(null);
  const liveMicRef = useRef<LiveMicHandle | null>(null);

  const selectedPersona = useMemo(() => {
    return (
      personas.find((p) => p.id === prefs.personaId) ||
      personas[0] || {
        id: 'maya',
        name: 'Maya',
        title: '纽约毒舌闺蜜',
        avatar: '💅',
        tagline: '嘴上嫌弃你到崩溃，下一秒手把手教你地道美语',
        stylePrompt: '',
        geminiVoice: 'Kore',
        openaiVoice: 'coral',
        ttsStyleHint: '',
        accentColor: '#FF5A36',
        defaultRoastLevel: 3,
      }
    );
  }, [personas, prefs.personaId]);

  const currentScenario = useMemo<Scenario>(() => {
    if (activeScenario && activeScenario.id === prefs.scenarioId) {
      return activeScenario;
    }
    return (
      scenarios.find((s) => s.id === prefs.scenarioId) ||
      scenarios[0] || {
        id: 'free-chat',
        title: '自由闲聊 · 吐槽日常',
        titleEn: 'Free Chat & Daily Rant',
        icon: '🔥',
        category: 'daily',
        description: '想聊啥聊啥，搭子随时抓你中式英语。',
        contextPrompt: '',
        starterPrompt: 'Alright, spill it—how is your day actually going?',
        quickReplies: [],
      }
    );
  }, [activeScenario, scenarios, prefs.scenarioId]);

  const latestEmotion: EmotionTag | undefined = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].emotion) {
        return messages[i].emotion;
      }
    }
    return undefined;
  }, [messages]);

  // Persist prefs whenever changed
  useEffect(() => {
    saveUserPrefs(prefs);
  }, [prefs]);

  // Audio player speaking state listener & 60fps orb visualizer
  useEffect(() => {
    audioPlayer.setSpeakingListener((speaking) => {
      setIsSpeaking(speaking);
      if (!speaking) setSpeakerLevel(0);
    });
  }, []);

  useEffect(() => {
    if (!isSpeaking) return;
    let raf = 0;
    const tick = () => {
      const lvl = audioPlayer.getOutputLevel();
      setSpeakerLevel(lvl > 0.01 ? lvl : 0.28);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking]);

  // Initial bootstrap
  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchBootstrap();
        setPersonas(data.personas);
        setScenarios(data.scenarios);
        setPresets(data.presets);
        setGeminiVoices(data.geminiVoices);
        setOpenaiVoices(data.openaiVoices);
        setMistakes(data.mistakes);
        setStats(data.stats);

        const initPersona =
          data.personas.find((p) => p.id === prefs.personaId) || data.personas[0];
        let initScenario =
          data.scenarios.find((s) => s.id === prefs.scenarioId) || data.scenarios[0];

        if (prefs.scenarioId === 'shame-drill') {
          const starterRes = await fetchScenarioStarter('shame-drill');
          initScenario = starterRes.scenario;
        }
        if (initScenario && initPersona) {
          setActiveScenario(initScenario);
          setMessages([makeStarterMessage(initPersona, initScenario)]);
        }
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : '初始化后端服务失败');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshScenarioConversation = useCallback(
    async (nextPersona: Persona, scenarioId: string) => {
      try {
        const res = await fetchScenarioStarter(scenarioId);
        setActiveScenario(res.scenario);
        setMessages([makeStarterMessage(nextPersona, res.scenario)]);
        setSessionId(`sess-${Date.now()}`);
        setRepeatTarget(null);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : '切换场景失败');
      }
    },
    [],
  );

  const speakText = useCallback(
    async (text: string, styleHint?: string) => {
      audioPlayer.interrupt();
      stopBrowserSpeech();
      if (!text.trim()) return;

      const hasKey = Boolean(config.apiKey?.trim());
      if (
        hasKey &&
        config.ttsMode !== 'browser' &&
        config.ttsMode !== 'off' &&
        (config.ttsMode === 'gemini-tts' ||
          config.ttsMode === 'openai-tts' ||
          (config.ttsMode === 'auto' &&
            (config.provider === 'gemini' || config.provider === 'openai')))
      ) {
        try {
          const res = await requestTtsAudio({
            config,
            personaId: selectedPersona.id,
            text,
            styleHint,
          });
          if (res.audioBase64) {
            await audioPlayer.playEncodedAudio(res.audioBase64, res.mimeType || 'audio/wav');
            return;
          }
        } catch {
          // Fall through cleanly to browser TTS
        }
      }

      speakWithBrowserTts({
        text,
        personaId: selectedPersona.id,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    },
    [config, selectedPersona.id],
  );

  const playMessageAudio = useCallback(
    (msg: ChatMessage) => {
      audioPlayer.interrupt();
      stopBrowserSpeech();
      if (msg.audioBase64) {
        void audioPlayer.playEncodedAudio(msg.audioBase64, msg.audioMimeType || 'audio/wav');
        return;
      }
      void speakText(msg.textEn, msg.ttsStyleHint);
    },
    [speakText],
  );

  const interruptAudio = useCallback(() => {
    audioPlayer.interrupt();
    stopBrowserSpeech();
    setIsSpeaking(false);
  }, []);

  const handleTurnSubmit = useCallback(
    async (opts: { text?: string; audioBase64?: string; audioMimeType?: string }) => {
      setErrorBanner(null);
      setIsThinking(true);
      interruptAudio();

      const hasKey = Boolean(config.apiKey?.trim());
      const draftUserText = opts.text?.trim();
      const tempUserId = `u-${Date.now()}`;

      if (draftUserText) {
        setMessages((prev) => [
          ...prev,
          {
            id: tempUserId,
            role: 'user',
            textEn: draftUserText,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      try {
        const res = hasKey
          ? await sendChatTurn({
              config,
              personaId: selectedPersona.id,
              scenarioId: currentScenario.id,
              roastLevel: prefs.roastLevel,
              sessionId,
              history: messages,
              text: draftUserText,
              audioBase64: opts.audioBase64,
              audioMimeType: opts.audioMimeType,
              withTts: prefs.autoPlayAudio && config.ttsMode !== 'off',
            })
          : await sendDemoChatTurn({
              personaId: selectedPersona.id,
              scenarioId: currentScenario.id,
              roastLevel: prefs.roastLevel,
              text: draftUserText || 'I very like open the light!',
            });

        const resolvedTranscript = res.turn.user_transcript || draftUserText || '(语音输入)';
        if (!draftUserText) {
          setMessages((prev) => [
            ...prev,
            {
              id: tempUserId,
              role: 'user',
              textEn: resolvedTranscript,
              createdAt: new Date().toISOString(),
            },
          ]);
        } else if (res.turn.user_transcript && res.turn.user_transcript !== draftUserText) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempUserId ? { ...m, textEn: res.turn.user_transcript! } : m)),
          );
        }

        const aiMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          textEn: res.turn.reply_en,
          textZh: res.turn.reply_zh,
          emotion: res.turn.emotion,
          roastIntensity: res.turn.roast_intensity,
          didRoast: res.turn.did_roast,
          ttsStyleHint: res.turn.tts_style_hint,
          corrections: res.turn.corrections,
          followUpHintZh: res.turn.follow_up_hint_zh,
          audioBase64: res.audioBase64,
          audioMimeType: res.audioMimeType,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setMistakes(res.mistakes);
        setStats(res.stats);
        setRepeatTarget(null);

        if (prefs.autoPlayAudio && config.ttsMode !== 'off') {
          if (res.audioBase64) {
            void audioPlayer.playEncodedAudio(res.audioBase64, res.audioMimeType || 'audio/wav');
          } else if (res.useBrowserTts) {
            speakWithBrowserTts({
              text: res.turn.reply_en,
              personaId: selectedPersona.id,
              onStart: () => setIsSpeaking(true),
              onEnd: () => setIsSpeaking(false),
            });
          }
        }
      } catch (err) {
        if (draftUserText) {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
        }
        setErrorBanner(err instanceof Error ? err.message : '请求失败，请检查配置');
      } finally {
        setIsThinking(false);
      }
    },
    [
      config,
      currentScenario.id,
      interruptAudio,
      messages,
      prefs.autoPlayAudio,
      prefs.roastLevel,
      selectedPersona.id,
      sessionId,
    ],
  );

  const handleSendText = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? inputText).trim();
      if (!text) return;
      if (!overrideText) setInputText('');

      if (prefs.interactionMode === 'live' && isLiveConnected && liveClientRef.current) {
        liveClientRef.current.sendText(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `u-live-${Date.now()}`,
            role: 'user',
            textEn: text,
            createdAt: new Date().toISOString(),
            isLive: true,
          },
        ]);
        return;
      }

      void handleTurnSubmit({ text });
    },
    [handleTurnSubmit, inputText, isLiveConnected, prefs.interactionMode],
  );

  const handleToggleRecord = useCallback(async () => {
    if (isRecording && recorderRef.current) {
      setIsRecording(false);
      setMicLevel(0);
      try {
        const result = await recorderRef.current.stop();
        recorderRef.current = null;
        setInterimTranscript('');

        if (result.durationMs < 350) {
          setErrorBanner('说话时间太短啦，再按住多说几个词！');
          return;
        }
        if (!config.apiKey?.trim() && !result.speechTranscript) {
          setErrorBanner('试玩模式下请确认浏览器支持语音识别，或者直接打字并点「接入 Key」开启真实听音！');
          return;
        }
        await handleTurnSubmit({
          text: result.speechTranscript || undefined,
          audioBase64: result.audioBase64,
          audioMimeType: result.audioMimeType,
        });
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : '录音处理失败');
      }
      return;
    }

    try {
      setErrorBanner(null);
      interruptAudio();
      await audioPlayer.ensureContext();
      const handle = await startTurnRecorder({
        onLevel: (lvl) => setMicLevel(lvl),
        onInterimTranscript: (txt) => setInterimTranscript(txt),
      });
      recorderRef.current = handle;
      setIsRecording(true);
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? `无法打开麦克风（请检查浏览器麦克风权限）：${err.message}`
          : '无法打开麦克风',
      );
    }
  }, [config.apiKey, handleTurnSubmit, interruptAudio, isRecording]);

  const stopLiveCall = useCallback(() => {
    liveMicRef.current?.stop();
    liveMicRef.current = null;
    liveClientRef.current?.close();
    liveClientRef.current = null;
    audioPlayer.interrupt();
    setIsLiveConnected(false);
    setIsLiveConnecting(false);
    setIsMicMuted(false);
    setMicLevel(0);
    setLiveUserInterim('');
    setLiveAiInterim('');
  }, []);

  const startLiveCall = useCallback(async () => {
    if (!config.apiKey?.trim()) {
      setErrorBanner('实时语音连麦需要接入 Gemini 或 OpenAI 的 API Key。');
      setSettingsOpen(true);
      return;
    }

    setErrorBanner(null);
    setIsLiveConnecting(true);
    interruptAudio();
    await audioPlayer.ensureContext();

    const client = new LiveSessionClient(
      (ev: LiveServerEvent) => {
        switch (ev.type) {
          case 'ready':
            setIsLiveConnecting(false);
            setIsLiveConnected(true);
            void startLiveMicStream({
              onPcmChunk: (pcm) => client.sendAudioChunk(pcm),
              onLevel: (lvl) => setMicLevel(lvl),
            })
              .then((mic) => {
                liveMicRef.current = mic;
              })
              .catch((micErr) => {
                setErrorBanner(
                  micErr instanceof Error ? `麦克风开启失败：${micErr.message}` : '麦克风开启失败',
                );
                stopLiveCall();
              });
            break;

          case 'audio':
            void audioPlayer.playPcmChunk(ev.data, ev.sampleRate);
            break;

          case 'user_transcript':
            setLiveUserInterim(ev.text);
            break;

          case 'ai_transcript_delta':
            setLiveAiInterim((prev) => prev + ev.text);
            break;

          case 'interrupted':
            audioPlayer.interrupt();
            setLiveAiInterim('');
            break;

          case 'turn_complete':
            setLiveUserInterim('');
            setLiveAiInterim('');
            setMessages((prev) => {
              const next = [...prev];
              if (ev.userText) {
                next.push({
                  id: `${ev.turnId}-u`,
                  role: 'user',
                  textEn: ev.userText,
                  createdAt: new Date().toISOString(),
                  isLive: true,
                });
              }
              if (ev.aiText) {
                next.push({
                  id: `${ev.turnId}-a`,
                  role: 'assistant',
                  textEn: ev.aiText,
                  createdAt: new Date().toISOString(),
                  isLive: true,
                  pendingCoaching: true,
                });
              }
              return next;
            });
            break;

          case 'coaching':
            setMessages((prev) =>
              prev.map((m) =>
                m.id === `${ev.turnId}-a`
                  ? {
                      ...m,
                      textZh: ev.analysis.reply_zh,
                      emotion: ev.analysis.emotion,
                      roastIntensity: ev.analysis.roast_intensity,
                      didRoast: ev.analysis.did_roast,
                      corrections: ev.analysis.corrections,
                      followUpHintZh: ev.analysis.follow_up_hint_zh,
                      pendingCoaching: false,
                    }
                  : m,
              ),
            );
            void fetchBootstrap().then((data) => {
              setMistakes(data.mistakes);
              setStats(data.stats);
            });
            break;

          case 'error':
            setErrorBanner(ev.message);
            stopLiveCall();
            break;
        }
      },
      () => {
        setIsLiveConnected(false);
        setIsLiveConnecting(false);
      },
    );

    liveClientRef.current = client;
    client.connect({
      config,
      personaId: selectedPersona.id,
      scenarioId: currentScenario.id,
      roastLevel: prefs.roastLevel,
    });
  }, [config, currentScenario.id, interruptAudio, prefs.roastLevel, selectedPersona.id, stopLiveCall]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      stopLiveCall();
    };
  }, [stopLiveCall]);

  const handleOpenReview = async () => {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    try {
      const report = await requestSessionReview({
        config: config.apiKey?.trim() ? config : undefined,
        personaId: selectedPersona.id,
        scenarioId: currentScenario.id,
        roastLevel: prefs.roastLevel,
        messages,
      });
      setReviewReport(report);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '生成复盘失败');
    } finally {
      setReviewLoading(false);
    }
  };

  const unmasteredCount = mistakes.filter((m) => !m.mastered).length;
  const userTurnsCount = messages.filter((m) => m.role === 'user').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090B11] text-slate-100">
      <Sidebar
        personas={personas}
        scenarios={scenarios}
        selectedPersonaId={selectedPersona.id}
        selectedScenarioId={currentScenario.id}
        roastLevel={prefs.roastLevel}
        activeTab={activeTab}
        unmasteredCount={unmasteredCount}
        isLiveConnected={isLiveConnected}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onSelectPersona={(id) => {
          const next = personas.find((p) => p.id === id);
          if (!next) return;
          setPrefs((prev) => ({
            ...prev,
            personaId: id,
            roastLevel: next.defaultRoastLevel || prev.roastLevel,
          }));
          void refreshScenarioConversation(next, currentScenario.id);
        }}
        onSelectScenario={(id) => {
          setPrefs((prev) => ({ ...prev, scenarioId: id }));
          void refreshScenarioConversation(selectedPersona, id);
        }}
        onChangeRoastLevel={(level: RoastLevel) =>
          setPrefs((prev) => ({ ...prev, roastLevel: level }))
        }
        onChangeTab={setActiveTab}
        onCreatePersona={async (input) => {
          const res = await createCustomPersonaApi(input);
          setPersonas(res.personas);
          setPrefs((prev) => ({ ...prev, personaId: res.persona.id }));
          await refreshScenarioConversation(res.persona, currentScenario.id);
        }}
        onDeletePersona={async (id) => {
          const res = await deleteCustomPersonaApi(id);
          setPersonas(res.personas);
          if (prefs.personaId === id && res.personas[0]) {
            setPrefs((prev) => ({ ...prev, personaId: res.personas[0].id }));
          }
        }}
        onCreateScenario={async (input) => {
          const res = await createCustomScenarioApi(input);
          setScenarios(res.scenarios);
          setPrefs((prev) => ({ ...prev, scenarioId: res.scenario.id }));
          setActiveScenario(res.scenario);
          setMessages([makeStarterMessage(selectedPersona, res.scenario)]);
        }}
        onDeleteScenario={async (id) => {
          const res = await deleteCustomScenarioApi(id);
          setScenarios(res.scenarios);
          if (prefs.scenarioId === id && res.scenarios[0]) {
            setPrefs((prev) => ({ ...prev, scenarioId: res.scenarios[0].id }));
            await refreshScenarioConversation(selectedPersona, res.scenarios[0].id);
          }
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col h-full">
        <HeaderBar
          persona={selectedPersona}
          scenario={currentScenario}
          config={config}
          interactionMode={prefs.interactionMode}
          onChangeMode={(mode) => {
            if (isLiveConnected) return;
            setPrefs((prev) => ({ ...prev, interactionMode: mode }));
          }}
          bilingualMode={prefs.bilingualMode}
          onToggleBilingual={() =>
            setPrefs((prev) => ({ ...prev, bilingualMode: !prev.bilingualMode }))
          }
          autoPlayAudio={prefs.autoPlayAudio}
          onToggleAutoPlay={() =>
            setPrefs((prev) => ({ ...prev, autoPlayAudio: !prev.autoPlayAudio }))
          }
          onResetChat={() => void refreshScenarioConversation(selectedPersona, currentScenario.id)}
          onOpenReview={() => void handleOpenReview()}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          isLiveConnected={isLiveConnected}
          canReview={userTurnsCount >= 1}
        />

        {errorBanner && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs text-rose-100">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="truncate">{errorBanner}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
              >
                打开设置
              </button>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-300 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <>
            <div className="px-3 sm:px-5 pt-3">
              <VoiceOrb
                persona={selectedPersona}
                roastLevel={prefs.roastLevel}
                emotion={latestEmotion}
                isListening={isRecording || (isLiveConnected && !isMicMuted && micLevel > 0.06)}
                isSpeaking={isSpeaking}
                isThinking={isThinking}
                isLiveConnected={isLiveConnected}
                micLevel={micLevel}
                speakerLevel={speakerLevel}
                liveInterimUserText={liveUserInterim || interimTranscript}
                liveInterimAiText={liveAiInterim}
              />
            </div>

            <ChatFeed
              messages={messages}
              persona={selectedPersona}
              bilingualMode={prefs.bilingualMode}
              isThinking={isThinking}
              onPlayMessageAudio={playMessageAudio}
              onSpeakPhrase={(txt) => void speakText(txt)}
              onPracticeRepeat={(phrase) => {
                setRepeatTarget(phrase);
                if (prefs.interactionMode === 'turn') {
                  void handleToggleRecord();
                }
              }}
            />

            <VoiceDock
              interactionMode={prefs.interactionMode}
              isRecording={isRecording}
              isThinking={isThinking}
              isSpeaking={isSpeaking}
              isLiveConnected={isLiveConnected}
              isLiveConnecting={isLiveConnecting}
              isMicMuted={isMicMuted}
              inputText={inputText}
              interimTranscript={interimTranscript}
              quickReplies={currentScenario.quickReplies}
              repeatTarget={repeatTarget}
              onClearRepeatTarget={() => setRepeatTarget(null)}
              onChangeInputText={setInputText}
              onSendText={handleSendText}
              onToggleRecord={() => void handleToggleRecord()}
              onStartLiveCall={() => void startLiveCall()}
              onStopLiveCall={stopLiveCall}
              onToggleMute={() => {
                const next = !isMicMuted;
                setIsMicMuted(next);
                liveMicRef.current?.setMuted(next);
              }}
              onInterruptAudio={interruptAudio}
            />
          </>
        )}

        {activeTab === 'shame' && (
          <HallOfShame
            mistakes={mistakes}
            onToggleMastered={async (id, mastered) => {
              const res = await toggleMistakeMasteredApi(id, mastered);
              setMistakes(res.mistakes);
            }}
            onDelete={async (id) => {
              const res = await deleteMistakeApi(id);
              setMistakes(res.mistakes);
            }}
            onClearAll={async () => {
              const res = await clearMistakesApi();
              setMistakes(res.mistakes);
            }}
            onSpeak={(txt) => void speakText(txt)}
            onStartShameDrill={() => {
              setPrefs((prev) => ({ ...prev, scenarioId: 'shame-drill' }));
              setActiveTab('chat');
              void refreshScenarioConversation(selectedPersona, 'shame-drill');
            }}
          />
        )}

        {activeTab === 'stats' && <StatsPanel stats={stats} mistakes={mistakes} />}
      </main>

      <SettingsModal
        key={settingsOpen ? 'open' : 'closed'}
        open={settingsOpen}
        config={config}
        presets={presets}
        geminiVoices={geminiVoices}
        openaiVoices={openaiVoices}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setConfig(next);
          saveProviderConfig(next);
          if (
            next.provider !== 'gemini' &&
            next.provider !== 'openai' &&
            prefs.interactionMode === 'live'
          ) {
            setPrefs((prev) => ({ ...prev, interactionMode: 'turn' }));
          }
        }}
      />

      <ReviewModal
        open={reviewOpen}
        loading={reviewLoading}
        report={reviewReport}
        error={reviewError}
        persona={selectedPersona}
        onClose={() => setReviewOpen(false)}
        onSpeak={(txt) => void speakText(txt)}
      />
    </div>
  );
}
