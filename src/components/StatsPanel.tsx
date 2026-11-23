import React from 'react';
import { Flame, MessageCircle, ShieldAlert, Trophy } from 'lucide-react';
import type { AppStats, MistakeCategory, MistakeRecord } from '../../shared/types.js';

interface StatsPanelProps {
  stats: AppStats;
  mistakes: MistakeRecord[];
}

const CATEGORY_META: Record<MistakeCategory, { label: string; color: string }> = {
  chinglish: { label: '中式直译 (Chinglish)', color: 'bg-rose-500' },
  grammar: { label: '语法与时态', color: 'bg-amber-500' },
  vocabulary: { label: '用词干瘪/不地道', color: 'bg-sky-500' },
  pronunciation: { label: '发音与连读', color: 'bg-purple-500' },
  tone: { label: '语气与语境', color: 'bg-orange-500' },
};

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, mistakes }) => {
  const masteredCount = mistakes.filter((m) => m.mastered).length;
  const maxCat = Math.max(1, ...Object.values(stats.categoryCounts));

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-[#121622] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>连续开口打卡</span>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats.streakDays} 天</div>
          <p className="mt-1 text-[11px] text-slate-500">
            {stats.lastPracticeDate ? `最近练习：${stats.lastPracticeDate}` : '今天还没开聊'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#121622] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>累计交锋回合</span>
            <MessageCircle className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats.totalTurns} 句</div>
          <p className="mt-1 text-[11px] text-slate-500">开口越多，越不怕老外</p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#121622] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>被搭子毒舌暴击</span>
            <Flame className="h-4 w-4 text-[#FF5A36]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-300">{stats.totalRoasts} 次</div>
          <p className="mt-1 text-[11px] text-slate-500">每次挨喷都在帮你涨记性</p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#121622] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>已攻克黑历史</span>
            <ShieldAlert className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">
            {masteredCount} / {mistakes.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">累计揪出 {stats.totalCorrections} 处改进点</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-2xl border border-white/8 bg-[#121622] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">高频翻车类型分布</h3>
        <div className="space-y-3">
          {(Object.keys(CATEGORY_META) as MistakeCategory[]).map((cat) => {
            const count = stats.categoryCounts[cat] || 0;
            const pct = Math.round((count / maxCat) * 100);
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{meta.label}</span>
                  <span className="font-semibold text-slate-200">{count} 次</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/6">
                  <div
                    className={`h-full rounded-full ${meta.color} transition-all duration-500`}
                    style={{ width: `${count === 0 ? 0 : Math.max(6, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
