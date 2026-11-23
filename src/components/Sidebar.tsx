import React, { useState } from 'react';
import {
  BarChart3,
  Flame,
  MessageSquare,
  Plus,
  Skull,
  Trash2,
  X,
} from 'lucide-react';
import type { Persona, RoastLevel, Scenario } from '../../shared/types.js';

export type ActiveTab = 'chat' | 'shame' | 'stats';

interface SidebarProps {
  personas: Persona[];
  scenarios: Scenario[];
  selectedPersonaId: string;
  selectedScenarioId: string;
  roastLevel: RoastLevel;
  activeTab: ActiveTab;
  unmasteredCount: number;
  isLiveConnected: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectPersona: (id: string) => void;
  onSelectScenario: (id: string) => void;
  onChangeRoastLevel: (level: RoastLevel) => void;
  onChangeTab: (tab: ActiveTab) => void;
  onCreatePersona: (input: Omit<Persona, 'id' | 'isCustom'>) => Promise<void>;
  onDeletePersona: (id: string) => Promise<void>;
  onCreateScenario: (input: Omit<Scenario, 'id' | 'isCustom' | 'category'>) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
}

const ROAST_LABELS: Record<RoastLevel, { label: string; desc: string }> = {
  1: { label: 'Lv.1 温柔鼓励 🌱', desc: '顺毛摸为主，只轻点明显错误' },
  2: { label: 'Lv.2 轻度打趣 😏', desc: '像老朋友一样调侃两句' },
  3: { label: 'Lv.3 嘴毒心软 🔥', desc: 'Pingo 爆款手感：先吐槽再手把手教' },
  4: { label: 'Lv.4 毫不留情 🌶️', desc: '敢说中式直译当场抓包训话' },
  5: { label: 'Lv.5 暴躁核爆 ☢️', desc: '地狱教练模式，错一句直接拉警报' },
};

export const Sidebar: React.FC<SidebarProps> = ({
  personas,
  scenarios,
  selectedPersonaId,
  selectedScenarioId,
  roastLevel,
  activeTab,
  unmasteredCount,
  isLiveConnected,
  mobileOpen,
  onCloseMobile,
  onSelectPersona,
  onSelectScenario,
  onChangeRoastLevel,
  onChangeTab,
  onCreatePersona,
  onDeletePersona,
  onCreateScenario,
  onDeleteScenario,
}) => {
  const [showNewPersona, setShowNewPersona] = useState(false);
  const [showNewScenario, setShowNewScenario] = useState(false);

  const [pName, setPName] = useState('');
  const [pTitle, setPTitle] = useState('');
  const [pAvatar, setPAvatar] = useState('🦊');
  const [pTagline, setPTagline] = useState('');
  const [pPrompt, setPPrompt] = useState('');

  const [sTitle, setSTitle] = useState('');
  const [sTitleEn, setSTitleEn] = useState('');
  const [sIcon, setSIcon] = useState('🎬');
  const [sDesc, setSDesc] = useState('');
  const [sStarter, setSStarter] = useState('');

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pPrompt.trim()) return;
    await onCreatePersona({
      name: pName.trim(),
      title: pTitle.trim() || '自定义毒舌搭子',
      avatar: pAvatar.trim() || '🎭',
      tagline: pTagline.trim() || '专属定制的英语搭子人格',
      stylePrompt: pPrompt.trim(),
      geminiVoice: 'Kore',
      openaiVoice: 'coral',
      ttsStyleHint: 'expressive, witty, conversational',
      accentColor: '#FF5A36',
      defaultRoastLevel: roastLevel,
    });
    setPName('');
    setPTitle('');
    setPTagline('');
    setPPrompt('');
    setShowNewPersona(false);
  };

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim() || !sDesc.trim()) return;
    await onCreateScenario({
      title: sTitle.trim(),
      titleEn: sTitleEn.trim() || sTitle.trim(),
      icon: sIcon.trim() || '🎯',
      description: sDesc.trim(),
      contextPrompt: `Roleplay scenario: ${sTitleEn.trim() || sTitle.trim()}. ${sDesc.trim()}`,
      starterPrompt:
        sStarter.trim() ||
        `Alright, welcome to "${sTitleEn.trim() || sTitle.trim()}"! Hit me with your opening line—and make it sound natural!`,
      quickReplies: [],
    });
    setSTitle('');
    setSTitleEn('');
    setSDesc('');
    setSStarter('');
    setShowNewScenario(false);
  };

  const content = (
    <div className="flex h-full flex-col bg-[#0C0F17] border-r border-white/8">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5A36] to-[#FF8B3D] text-lg shadow-md shadow-orange-950/50">
            🔥
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">RoastPal · 英语搭子</h1>
            <p className="text-[11px] text-slate-400">能陪聊 · 会开喷 · 秒纠错</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary View Switcher */}
      <div className="grid grid-cols-3 gap-1 p-2.5 border-b border-white/8">
        <button
          type="button"
          onClick={() => {
            onChangeTab('chat');
            onCloseMobile();
          }}
          className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition ${
            activeTab === 'chat'
              ? 'bg-white/12 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          练口语
        </button>
        <button
          type="button"
          onClick={() => {
            onChangeTab('shame');
            onCloseMobile();
          }}
          className={`relative flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition ${
            activeTab === 'shame'
              ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <Skull className="h-3.5 w-3.5" />
          黑历史
          {unmasteredCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[#FF5A36] px-1.5 py-0.2 text-[10px] font-bold text-white">
              {unmasteredCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            onChangeTab('stats');
            onCloseMobile();
          }}
          className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition ${
            activeTab === 'stats'
              ? 'bg-white/12 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          战绩
        </button>
      </div>

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Roast Intensity Slider */}
        <section className="rounded-2xl border border-white/8 bg-[#121622] p-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Flame className="h-3.5 w-3.5 text-[#FF5A36]" />
              毒舌烈度调节
            </span>
            <span className="text-[11px] font-semibold text-orange-300">
              {ROAST_LABELS[roastLevel].label}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            disabled={isLiveConnected}
            value={roastLevel}
            onChange={(e) => onChangeRoastLevel(Number(e.target.value) as RoastLevel)}
            className="mt-2.5 w-full accent-[#FF5A36] cursor-pointer disabled:opacity-50"
          />
          <p className="mt-1 text-[11px] text-slate-400">{ROAST_LABELS[roastLevel].desc}</p>
        </section>

        {/* Persona Selection */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              选择你的英语搭子
            </h2>
            <button
              type="button"
              onClick={() => setShowNewPersona((v) => !v)}
              className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[11px] text-orange-300 hover:bg-orange-500/15"
            >
              <Plus className="h-3 w-3" />
              捏一个
            </button>
          </div>

          {showNewPersona && (
            <form
              onSubmit={(e) => void handleSavePersona(e)}
              className="mb-2.5 space-y-2 rounded-xl border border-orange-500/30 bg-[#141927] p-2.5"
            >
              <div className="flex gap-1.5">
                <input
                  value={pAvatar}
                  onChange={(e) => setPAvatar(e.target.value)}
                  className="w-11 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-center text-sm"
                  placeholder="🦊"
                />
                <input
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  required
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                  placeholder="搭子英文名（如 Alex）"
                />
              </div>
              <input
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                placeholder="头衔（如：伦敦毒舌毒奶室友）"
              />
              <input
                value={pTagline}
                onChange={(e) => setPTagline(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                placeholder="一句话人设介绍"
              />
              <textarea
                value={pPrompt}
                onChange={(e) => setPPrompt(e.target.value)}
                required
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                placeholder="性格指令（如：你是伦敦毒舌室友，用英式冷幽默嘲讽中式英语...）"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowNewPersona(false)}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#FF5A36] px-3 py-1 text-xs font-medium text-white hover:bg-[#ff6d4d]"
                >
                  保存搭子
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5">
            {personas.map((p) => {
              const active = p.id === selectedPersonaId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isLiveConnected) {
                      onSelectPersona(p.id);
                      onCloseMobile();
                    }
                  }}
                  className={`group relative flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                    active
                      ? 'border-[#FF5A36]/60 bg-gradient-to-r from-[#FF5A36]/15 to-transparent'
                      : 'border-white/6 bg-[#121622]/60 hover:border-white/15 hover:bg-[#161B2A]'
                  } ${isLiveConnected && !active ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="mt-0.5 text-xl select-none">{p.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {p.name} · {p.title}
                      </span>
                      {p.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeletePersona(p.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-400 hover:text-rose-400"
                          title="删除自定义搭子"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">
                      {p.tagline}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Scenario Selection */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              实战场景 / 特训
            </h2>
            <button
              type="button"
              onClick={() => setShowNewScenario((v) => !v)}
              className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[11px] text-orange-300 hover:bg-orange-500/15"
            >
              <Plus className="h-3 w-3" />
              自定义
            </button>
          </div>

          {showNewScenario && (
            <form
              onSubmit={(e) => void handleSaveScenario(e)}
              className="mb-2.5 space-y-2 rounded-xl border border-orange-500/30 bg-[#141927] p-2.5"
            >
              <div className="flex gap-1.5">
                <input
                  value={sIcon}
                  onChange={(e) => setSIcon(e.target.value)}
                  className="w-11 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-center text-sm"
                  placeholder="🎬"
                />
                <input
                  value={sTitle}
                  onChange={(e) => setSTitle(e.target.value)}
                  required
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                  placeholder="场景名称（如：餐厅退菜吵架）"
                />
              </div>
              <input
                value={sTitleEn}
                onChange={(e) => setSTitleEn(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                placeholder="英文主题（可选）"
              />
              <textarea
                value={sDesc}
                onChange={(e) => setSDesc(e.target.value)}
                required
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                placeholder="场景设定（如：牛排烤糊了服务员还态度拽...）"
              />
              <input
                value={sStarter}
                onChange={(e) => setSStarter(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                placeholder="搭子开场白英文（可选）"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowNewScenario(false)}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#FF5A36] px-3 py-1 text-xs font-medium text-white hover:bg-[#ff6d4d]"
                >
                  创建场景
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5">
            {/* Special Hall of Shame Drill */}
            <button
              type="button"
              disabled={isLiveConnected}
              onClick={() => {
                onSelectScenario('shame-drill');
                onChangeTab('chat');
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                selectedScenarioId === 'shame-drill'
                  ? 'border-rose-500/70 bg-rose-500/15'
                  : 'border-rose-500/20 bg-rose-950/15 hover:border-rose-500/40'
              } disabled:opacity-50`}
            >
              <span className="text-lg">💀</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-200">黑历史鞭尸特训</span>
                  {unmasteredCount > 0 && (
                    <span className="text-[10px] text-rose-300">{unmasteredCount} 项待赎罪</span>
                  )}
                </div>
                <p className="text-[11px] text-rose-200/70 truncate">
                  专抓你过去犯过的错现场突击抽考
                </p>
              </div>
            </button>

            {scenarios.map((s) => {
              const active = s.id === selectedScenarioId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    if (!isLiveConnected) {
                      onSelectScenario(s.id);
                      onChangeTab('chat');
                      onCloseMobile();
                    }
                  }}
                  className={`group flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                    active
                      ? 'border-orange-500/50 bg-orange-500/12'
                      : 'border-white/6 bg-[#121622]/60 hover:border-white/15 hover:bg-[#161B2A]'
                  } ${isLiveConnected && !active ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="mt-0.5 text-lg select-none">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium text-white truncate">{s.title}</span>
                      {s.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteScenario(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-80 shrink-0 h-full">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <aside className="relative z-10 h-full w-80 max-w-[85vw]">{content}</aside>
        </div>
      )}
    </>
  );
};
