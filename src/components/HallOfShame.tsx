import React, { useMemo, useState } from 'react';
import { CheckCircle2, Flame, RotateCcw, Skull, Trash2, Volume2 } from 'lucide-react';
import type { MistakeCategory, MistakeRecord } from '../../shared/types.js';

interface HallOfShameProps {
  mistakes: MistakeRecord[];
  onToggleMastered: (id: string, mastered: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onSpeak: (text: string) => void;
  onStartShameDrill: () => void;
}

const FILTERS: Array<{ id: 'all' | MistakeCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'chinglish', label: '中式英语' },
  { id: 'grammar', label: '语法翻车' },
  { id: 'vocabulary', label: '用词升级' },
  { id: 'pronunciation', label: '发音' },
  { id: 'tone', label: '语气' },
];

export const HallOfShame: React.FC<HallOfShameProps> = ({
  mistakes,
  onToggleMastered,
  onDelete,
  onClearAll,
  onSpeak,
  onStartShameDrill,
}) => {
  const [filter, setFilter] = useState<'all' | MistakeCategory>('all');
  const [hideMastered, setHideMastered] = useState(false);

  const visible = useMemo(() => {
    return mistakes.filter((m) => {
      if (filter !== 'all' && m.category !== filter) return false;
      if (hideMastered && m.mastered) return false;
      return true;
    });
  }, [mistakes, filter, hideMastered]);

  const unmasteredCount = mistakes.filter((m) => !m.mastered).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-950/35 to-[#121622] p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <Skull className="h-5 w-5 text-rose-400" />
            黑历史错题本（Hall of Shame）
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            搭子会暗中记住你常犯的错。下次对话再说错，TA 会当场抓包翻旧账！当前待赎罪：
            <span className="ml-1 font-semibold text-rose-300">{unmasteredCount} 条</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartShameDrill}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF5A36] to-[#FF8B3D] px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            <Flame className="h-3.5 w-3.5" />
            开启鞭尸特训
          </button>
          {mistakes.length > 0 && (
            <button
              type="button"
              onClick={() => void onClearAll()}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                filter === f.id
                  ? 'bg-white text-slate-900 font-semibold'
                  : 'bg-white/6 text-slate-300 hover:bg-white/12'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hideMastered}
            onChange={(e) => setHideMastered(e.target.checked)}
            className="accent-emerald-500"
          />
          隐藏已掌握
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#121622] p-10 text-center">
          <p className="text-sm text-slate-300">目前还没有对应的黑历史记录！</p>
          <p className="mt-1 text-xs text-slate-500">
            快去和搭子聊几句——哪怕故意说句中式英语试试看？
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border p-4 space-y-2.5 transition ${
                m.mastered
                  ? 'border-emerald-500/20 bg-emerald-950/10 opacity-70'
                  : 'border-white/8 bg-[#121622]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                    翻车 {m.count} 次
                  </span>
                  {m.scenarioTitle && (
                    <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {m.scenarioTitle}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSpeak(m.nativeUpgrade)}
                    className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-500/15"
                    title="听地道发音"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onToggleMastered(m.id, !m.mastered)}
                    className={`rounded-lg p-1.5 transition ${
                      m.mastered
                        ? 'text-emerald-400 bg-emerald-500/15'
                        : 'text-slate-400 hover:bg-white/10 hover:text-emerald-300'
                    }`}
                    title={m.mastered ? '取消已掌握' : '标记已掌握'}
                  >
                    {m.mastered ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(m.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="text-rose-300 line-through">❌ {m.original}</div>
                <div className="font-semibold text-emerald-200">✨ {m.nativeUpgrade}</div>
                {m.corrected && m.corrected !== m.nativeUpgrade && (
                  <div className="text-slate-400">规范：{m.corrected}</div>
                )}
              </div>

              <p className="text-xs text-orange-200/90">🗯️ {m.roastCommentZh}</p>
              <p className="text-[11px] text-slate-400">📌 {m.tipZh}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
