import React from 'react';
import type { EmotionTag, Persona, RoastLevel } from '../../shared/types.js';

interface VoiceOrbProps {
  persona: Persona;
  roastLevel: RoastLevel;
  emotion?: EmotionTag;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  isLiveConnected: boolean;
  micLevel: number;
  speakerLevel: number;
  liveInterimUserText?: string;
  liveInterimAiText?: string;
}

const EMOTION_BADGES: Record<EmotionTag, { label: string; tone: string }> = {
  roasting: { label: '🔥 正在开喷', tone: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  furious_coach: { label: '🤬 暴躁训话', tone: 'bg-red-500/20 text-red-300 border-red-500/40' },
  speechless: { label: '🫠 沉默无语', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  amused: { label: '😏 憋笑吃瓜', tone: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  impressed: { label: '✨ 难得夸你', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  supportive: { label: '💛 温柔托底', tone: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
};

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  persona,
  roastLevel,
  emotion,
  isListening,
  isSpeaking,
  isThinking,
  isLiveConnected,
  micLevel,
  speakerLevel,
  liveInterimUserText,
  liveInterimAiText,
}) => {
  const activeEnergy = isListening ? micLevel : isSpeaking ? speakerLevel : 0;
  const scale = 1 + activeEnergy * 0.24;
  const ringScale = 1.15 + activeEnergy * 0.48;

  const badge = isListening
    ? { label: '🎙️ 正在听你说...', tone: 'bg-rose-500/20 text-rose-200 border-rose-500/40' }
    : isThinking
      ? { label: '⚡ 正在组织吐槽...', tone: 'bg-amber-500/20 text-amber-200 border-amber-500/40' }
      : isSpeaking
        ? emotion
          ? EMOTION_BADGES[emotion]
          : { label: '🔊 搭子开口中', tone: 'bg-orange-500/20 text-orange-200 border-orange-500/40' }
        : isLiveConnected
          ? { label: '🟣 实时连麦待命中', tone: 'bg-violet-500/20 text-violet-200 border-violet-500/40' }
          : emotion
            ? EMOTION_BADGES[emotion]
            : { label: `🔥 毒舌 Lv.${roastLevel}`, tone: 'bg-white/5 text-slate-300 border-white/10' };

  const orbGradient =
    isListening
      ? 'from-rose-500 via-orange-500 to-amber-400'
      : isSpeaking || emotion === 'roasting' || emotion === 'furious_coach'
        ? 'from-[#FF5A36] via-[#FF8B3D] to-amber-400'
        : isLiveConnected
          ? 'from-violet-500 via-fuchsia-500 to-orange-400'
          : 'from-slate-700 via-slate-800 to-slate-900';

  const statusBars = [0.45, 0.85, 1, 0.72, 0.52];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-[#121622]/85 px-4 py-3.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Reactive Orb */}
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-tr ${orbGradient} opacity-25 blur-md transition-transform duration-75`}
              style={{ transform: `scale(${ringScale})` }}
            />
            <div
              className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${orbGradient} shadow-lg shadow-orange-950/40 ring-1 ring-white/20 transition-transform duration-75 ${
                !isListening && !isSpeaking ? 'animate-orb-breathe' : ''
              } ${emotion === 'roasting' && isSpeaking ? 'animate-roast-shake' : ''}`}
              style={{ transform: `scale(${scale})` }}
            >
              <span className="text-2xl select-none">{persona.avatar}</span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-white">{persona.name}</span>
              <span className="text-xs text-slate-400">{persona.title}</span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.tone}`}
              >
                {badge.label}
              </span>
            </div>

            {liveInterimUserText ? (
              <p className="mt-1 truncate text-xs text-rose-200">
                你说：<span className="italic">"{liveInterimUserText}"</span>
              </p>
            ) : liveInterimAiText ? (
              <p className="mt-1 truncate text-xs text-orange-200">
                {persona.name}：{liveInterimAiText}
              </p>
            ) : (
              <p className="mt-1 truncate text-xs text-slate-400">{persona.tagline}</p>
            )}
          </div>
        </div>

        {/* Audio Bar Meter */}
        <div className="hidden sm:flex items-end gap-1 h-8 px-2" aria-hidden="true">
          {statusBars.map((weight, idx) => {
            const h = Math.max(
              20,
              Math.round((isListening || isSpeaking ? 25 + activeEnergy * 75 * weight : isThinking ? 45 : 22)),
            );
            return (
              <span
                key={idx}
                className={`w-1.5 rounded-full transition-all duration-75 ${
                  isListening
                    ? 'bg-rose-400'
                    : isSpeaking
                      ? 'bg-[#FF6B42]'
                      : isLiveConnected
                        ? 'bg-violet-400/70'
                        : 'bg-slate-600/60'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
