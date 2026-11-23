import React, { useEffect, useRef } from 'react';
import { Flame, Loader2, Mic, Sparkles, Volume2 } from 'lucide-react';
import type { ChatMessage, MistakeCategory, Persona } from '../../shared/types.js';

interface ChatFeedProps {
  messages: ChatMessage[];
  persona: Persona;
  bilingualMode: boolean;
  isThinking: boolean;
  onPlayMessageAudio: (msg: ChatMessage) => void;
  onSpeakPhrase: (text: string) => void;
  onPracticeRepeat: (phrase: string) => void;
}

const CATEGORY_LABELS: Record<MistakeCategory, { label: string; style: string }> = {
  chinglish: { label: '中式英语', style: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  grammar: { label: '语法翻车', style: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  vocabulary: { label: '用词太干瘪', style: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  pronunciation: { label: '发音/连读', style: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  tone: { label: '语气/语境', style: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  persona,
  bilingualMode,
  isThinking,
  onPlayMessageAudio,
  onSpeakPhrase,
  onPracticeRepeat,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm border border-white/10 bg-[#1B2234] px-4 py-2.5 text-sm text-slate-100 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-slate-400">
                    {msg.isLive ? '🎙️ 实时语音' : '你'}
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.textEn}</p>
              </div>
            </div>
          );
        }

        const isRoast = Boolean(msg.didRoast);
        return (
          <div key={msg.id} className="flex items-start gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#151A28] text-lg select-none">
              {persona.avatar}
            </div>

            <div className="min-w-0 flex-1 max-w-[90%] sm:max-w-[82%] space-y-2.5">
              {/* Main Reply Bubble */}
              <div
                className={`rounded-2xl rounded-tl-sm border px-4 py-3 shadow-md ${
                  isRoast
                    ? 'border-[#FF5A36]/40 bg-gradient-to-br from-[#1C141A] via-[#151824] to-[#121622]'
                    : 'border-white/8 bg-[#121622]'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{persona.name}</span>
                    {isRoast && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FF5A36]/20 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                        <Flame className="h-3 w-3" />
                        毒舌暴击 Lv.{msg.roastIntensity || 3}
                      </span>
                    )}
                    {msg.isLive && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">
                        Live
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onPlayMessageAudio(msg)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/12 hover:text-white transition"
                    title="重听这句发音"
                  >
                    <Volume2 className="h-3 w-3" />
                    朗读
                  </button>
                </div>

                <p className="text-[15px] leading-relaxed text-slate-100 whitespace-pre-wrap">
                  {msg.textEn}
                </p>

                {bilingualMode && msg.textZh && (
                  <p className="mt-2 border-t border-white/8 pt-2 text-xs leading-relaxed text-slate-400">
                    {msg.textZh}
                  </p>
                )}

                {msg.pendingCoaching && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                    正在复盘刚才那句的语法与地道升级...
                  </div>
                )}

                {msg.followUpHintZh && (
                  <p className="mt-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-amber-200/90">
                    💡 {msg.followUpHintZh}
                  </p>
                )}
              </div>

              {/* Inline Pingo-Style Correction & Native Upgrade Cards */}
              {msg.corrections && msg.corrections.length > 0 && (
                <div className="space-y-2">
                  {msg.corrections.map((c, idx) => {
                    const cat = CATEGORY_LABELS[c.category] || CATEGORY_LABELS.chinglish;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-emerald-500/25 bg-[#0F171E]/90 p-3 text-xs space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cat.style}`}
                          >
                            {cat.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSpeakPhrase(c.native_upgrade || c.corrected)}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/6 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
                            >
                              <Volume2 className="h-3 w-3" />
                              听地道版
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onPracticeRepeat(c.repeat_after_me || c.native_upgrade || c.corrected)
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[11px] text-orange-200 hover:bg-orange-500/25"
                            >
                              <Mic className="h-3 w-3" />
                              我来跟读
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-1.5 sm:grid-cols-2">
                          <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-rose-300/80 block">
                              ❌ 你刚才说的
                            </span>
                            <span className="text-rose-200 line-through decoration-rose-400/70">
                              {c.original}
                            </span>
                          </div>

                          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300/90">
                              <Sparkles className="h-2.5 w-2.5" />
                              Native 地道说法
                            </span>
                            <div className="font-medium text-emerald-100">{c.native_upgrade}</div>
                            {c.corrected && c.corrected !== c.native_upgrade && (
                              <div className="mt-0.5 text-[11px] text-emerald-300/80">
                                规范改写：{c.corrected}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-[12px] leading-relaxed text-orange-200/95">
                          🗯️ {c.roast_comment_zh}
                        </div>
                        <div className="text-[11px] text-slate-400">📌 划重点：{c.tip_zh}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isThinking && (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#151A28] text-lg">
            {persona.avatar}
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-[#121622] px-4 py-2.5 text-xs text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF5A36]" />
            <span>{persona.name} 正在听你刚才那句并准备开喷...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
