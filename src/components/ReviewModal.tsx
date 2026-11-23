import React from 'react';
import { Award, Flame, Loader2, Sparkles, Volume2, X } from 'lucide-react';
import type { Persona, SessionReport } from '../../shared/types.js';

interface ReviewModalProps {
  open: boolean;
  loading: boolean;
  report: SessionReport | null;
  error?: string | null;
  persona: Persona;
  onClose: () => void;
  onSpeak: (text: string) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  open,
  loading,
  report,
  error,
  persona,
  onClose,
  onSpeak,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0F131D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">本场口语毒舌复盘报告</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-14 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF5A36]" />
              <p className="text-xs text-slate-300">
                {persona.name} 正在翻看你刚才的所有黑历史并打分...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 text-xs text-rose-200">
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              {/* Score Cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '综合', value: report.overall_score, highlight: true },
                  { label: '流利度', value: report.fluency_score },
                  { label: '地道度', value: report.naturalness_score },
                  { label: '语法', value: report.grammar_score },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border p-3 text-center ${
                      s.highlight
                        ? 'border-orange-500/40 bg-orange-500/15'
                        : 'border-white/8 bg-[#141927]'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400">{s.label}</div>
                    <div className="mt-1 text-xl font-bold text-white">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Buddy Verdict */}
              <div className="rounded-xl border border-white/10 bg-[#141927] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-orange-300">
                    {persona.avatar} {persona.name} 毒舌总评
                  </span>
                  <button
                    type="button"
                    onClick={() => onSpeak(report.buddy_verdict_en)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/15"
                  >
                    <Volume2 className="h-3 w-3" />
                    听点评
                  </button>
                </div>
                <p className="text-sm text-white leading-relaxed">{report.buddy_verdict_en}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{report.buddy_verdict_zh}</p>
              </div>

              {/* Top Roast & Best Expression */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5">
                  <div className="flex items-center gap-1 text-xs font-semibold text-rose-300">
                    <Flame className="h-3.5 w-3.5" />
                    今日最社死名场面
                  </div>
                  <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
                    {report.top_roast_moment}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    最地道高光表达
                  </div>
                  <p className="mt-1.5 text-xs text-emerald-100 leading-relaxed">
                    {report.best_expression}
                  </p>
                </div>
              </div>

              {/* Next Focus */}
              <div className="rounded-xl border border-white/8 bg-[#141927] p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-200">🎯 接下来重点攻克</div>
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {report.next_focus_zh.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Recommended Drills */}
              <div className="rounded-xl border border-white/8 bg-[#141927] p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-200">🗣️ 建议大声跟读 3 遍</div>
                <div className="space-y-2">
                  {report.recommended_drills.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs text-slate-100"
                    >
                      <span>{line}</span>
                      <button
                        type="button"
                        onClick={() => onSpeak(line)}
                        className="shrink-0 text-emerald-300 hover:text-emerald-200"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
