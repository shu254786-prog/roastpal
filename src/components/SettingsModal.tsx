import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  PlugZap,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ProviderConfig,
  ProviderPreset,
  SttMode,
  TtsMode,
} from '../../shared/types.js';
import { testConnection } from '../lib/api.js';
import { applyPresetToConfig } from '../lib/settings.js';

interface SettingsModalProps {
  open: boolean;
  config: ProviderConfig;
  presets: ProviderPreset[];
  geminiVoices: { id: string; label: string }[];
  openaiVoices: { id: string; label: string }[];
  onClose: () => void;
  onSave: (next: ProviderConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  config,
  presets,
  geminiVoices,
  openaiVoices,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<ProviderConfig>(config);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!open) return null;

  const activePreset = presets.find((p) => p.id === draft.presetId) || presets[0];
  const voices =
    draft.provider === 'gemini'
      ? geminiVoices
      : draft.provider === 'openai'
        ? openaiVoices
        : [];

  const handleSelectPreset = (preset: ProviderPreset) => {
    setDraft((prev) => applyPresetToConfig(prev, preset));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection(draft);
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `${res.message || '连接成功'} (${res.latencyMs}ms)`,
        });
      } else {
        setTestResult({ ok: false, message: res.error || '连接失败' });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : '连接测试失败',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0F131D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">接入你的 API Key & 语音引擎</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Key 仅保存在你的浏览器本地（LocalStorage），按需直连你选的模型接口。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Provider Preset Grid */}
          <section className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              1. 选择模型服务商预设
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {presets.map((preset) => {
                const selected = draft.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-[#FF5A36] bg-[#FF5A36]/12'
                        : 'border-white/8 bg-[#141927] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{preset.name}</span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-orange-200">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-400">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* API Key & Base URL */}
          <section className="space-y-3 rounded-xl border border-white/8 bg-[#141927] p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                2. API Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder={activePreset?.keyPlaceholder || '填入你的 API Key'}
                  className="flex-1 rounded-xl border border-white/12 bg-black/35 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#FF5A36] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10"
                  title={showKey ? '隐藏 Key' : '显示 Key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Base URL {draft.provider === 'gemini' ? '（可选，中转反代地址）' : ''}
                </label>
                <input
                  type="text"
                  value={draft.baseUrl || ''}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                  placeholder={
                    draft.provider === 'gemini'
                      ? '留空直连 Google 官方'
                      : activePreset?.defaultBaseUrl || 'https://api.openai.com/v1'
                  }
                  className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#FF5A36] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  对话 / 纠错主模型
                </label>
                <input
                  type="text"
                  list="chat-models-list"
                  value={draft.chatModel}
                  onChange={(e) => setDraft({ ...draft, chatModel: e.target.value })}
                  className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#FF5A36] focus:outline-none"
                />
                <datalist id="chat-models-list">
                  {activePreset?.suggestedChatModels.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {activePreset?.supportsLive && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    实时连麦模型（Live / Realtime）
                  </label>
                  <input
                    type="text"
                    list="live-models-list"
                    value={draft.liveModel || ''}
                    onChange={(e) => setDraft({ ...draft, liveModel: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-xs text-white focus:border-[#FF5A36] focus:outline-none"
                  />
                  <datalist id="live-models-list">
                    {activePreset.suggestedLiveModels?.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>

                {draft.provider === 'gemini' && (
                  <label className="flex items-center gap-2 self-end rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.enableAffectiveDialog !== false}
                      onChange={(e) =>
                        setDraft({ ...draft, enableAffectiveDialog: e.target.checked })
                      }
                      className="accent-[#FF5A36]"
                    />
                    <span>开启 Gemini Live 情感感知（Affective Dialog）</span>
                  </label>
                )}
              </div>
            )}
          </section>

          {/* Voice / STT / TTS Config */}
          <section className="space-y-3 rounded-xl border border-white/8 bg-[#141927] p-4">
            <h3 className="text-xs font-semibold text-slate-200">3. 语音识别（STT）与搭子朗读（TTS）</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">语音转文字方式</label>
                <select
                  value={draft.sttMode}
                  onChange={(e) => setDraft({ ...draft, sttMode: e.target.value as SttMode })}
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="auto">智能匹配（推荐）</option>
                  <option value="browser">免费浏览器识别</option>
                  <option value="whisper">OpenAI Whisper 接口</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">搭子配音方案</label>
                <select
                  value={draft.ttsMode}
                  onChange={(e) => setDraft({ ...draft, ttsMode: e.target.value as TtsMode })}
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="auto">智能匹配</option>
                  <option value="gemini-tts">Gemini 3.8 情绪配音</option>
                  <option value="openai-tts">OpenAI 表情配音</option>
                  <option value="browser">免费系统自然英语配音</option>
                  <option value="off">关闭自动配音</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">音色（留空跟随机设）</label>
                {voices.length > 0 ? (
                  <select
                    value={draft.voice || ''}
                    onChange={(e) => setDraft({ ...draft, voice: e.target.value })}
                    className="w-full rounded-xl border border-white/12 bg-black/40 px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">跟随搭子默认音色</option>
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={draft.voice || ''}
                    onChange={(e) => setDraft({ ...draft, voice: e.target.value })}
                    placeholder="系统自然音色"
                    className="w-full rounded-xl border border-white/12 bg-black/35 px-2.5 py-2 text-xs text-white"
                  />
                )}
              </div>
            </div>
          </section>

          {/* Connection Test Banner */}
          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                testResult.ok
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span className="break-all">{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
            <button
              type="button"
              disabled={testing}
              onClick={() => void handleTest()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5 text-amber-400" />
              )}
              测试连通性
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF5A36] to-[#FF8B3D] px-5 py-2 text-xs font-semibold text-white hover:brightness-110"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                保存配置
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
