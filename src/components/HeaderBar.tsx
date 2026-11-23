import React from 'react';
import {
  Award,
  Flame,
  KeyRound,
  Languages,
  Menu,
  PhoneCall,
  Radio,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Persona, ProviderConfig, Scenario } from '../../shared/types.js';

interface HeaderBarProps {
  persona: Persona;
  scenario: Scenario;
  config: ProviderConfig;
  interactionMode: 'turn' | 'live';
  onChangeMode: (mode: 'turn' | 'live') => void;
  bilingualMode: boolean;
  onToggleBilingual: () => void;
  autoPlayAudio: boolean;
  onToggleAutoPlay: () => void;
  onResetChat: () => void;
  onOpenReview: () => void;
  onOpenSettings: () => void;
  onOpenMobileSidebar: () => void;
  isLiveConnected: boolean;
  canReview: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  persona,
  scenario,
  config,
  interactionMode,
  onChangeMode,
  bilingualMode,
  onToggleBilingual,
  autoPlayAudio,
  onToggleAutoPlay,
  onResetChat,
  onOpenReview,
  onOpenSettings,
  onOpenMobileSidebar,
  isLiveConnected,
  canReview,
}) => {
  const hasKey = Boolean(config.apiKey?.trim());
  const supportsLive = config.provider === 'gemini' || config.provider === 'openai';

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-[#0D1018]/90 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          title="打开搭子与场景面板"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">
              {scenario.icon} {scenario.title}
            </span>
            {!hasKey && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/25"
              >
                <KeyRound className="h-3 w-3" />
                试玩模式 · 点此插 Key
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            搭子：{persona.name} · 模型：{hasKey ? config.chatModel : 'Built-in Demo'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Turn vs Live Switch */}
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            disabled={isLiveConnected}
            onClick={() => onChangeMode('turn')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              interactionMode === 'turn'
                ? 'bg-gradient-to-r from-[#FF5A36] to-[#FF8B3D] text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            } disabled:opacity-50`}
            title="按住说话 / 发文字，带即时红绿纠错卡片"
          >
            <Radio className="h-3.5 w-3.5" />
            对讲精练
          </button>
          <button
            type="button"
            disabled={!supportsLive}
            onClick={() => onChangeMode('live')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              interactionMode === 'live'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              supportsLive
                ? '端到端实时语音连麦（Gemini Live / OpenAI Realtime）'
                : '仅 Gemini 或 OpenAI 官方 Key 支持端到端实时连麦'
            }
          >
            <PhoneCall className="h-3.5 w-3.5" />
            实时连麦
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleBilingual}
          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition ${
            bilingualMode
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
          }`}
          title="显示/隐藏中文吐槽翻译"
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">双语</span>
        </button>

        <button
          type="button"
          onClick={onToggleAutoPlay}
          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition ${
            autoPlayAudio
              ? 'border-orange-500/40 bg-orange-500/15 text-orange-200'
              : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
          }`}
          title="自动语音朗读搭子回复"
        >
          {autoPlayAudio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          disabled={!canReview}
          onClick={onOpenReview}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40"
          title="生成本场口语毒舌复盘报告"
        >
          <Award className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden sm:inline">复盘</span>
        </button>

        <button
          type="button"
          onClick={onResetChat}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
          title="重开当前场景对话"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
            hasKey
              ? 'border-white/15 bg-white/8 text-white hover:bg-white/15'
              : 'border-[#FF5A36]/60 bg-[#FF5A36]/20 text-orange-200 hover:bg-[#FF5A36]/30'
          }`}
        >
          {hasKey ? <Settings className="h-3.5 w-3.5" /> : <Flame className="h-3.5 w-3.5" />}
          <span>{hasKey ? 'API 设置' : '接入 Key'}</span>
        </button>
      </div>
    </header>
  );
};
