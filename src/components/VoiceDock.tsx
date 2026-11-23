import React, { useEffect } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Sparkles,
  Square,
  VolumeX,
} from 'lucide-react';

interface VoiceDockProps {
  interactionMode: 'turn' | 'live';
  isRecording: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  isLiveConnected: boolean;
  isLiveConnecting: boolean;
  isMicMuted: boolean;
  inputText: string;
  interimTranscript: string;
  quickReplies: string[];
  repeatTarget?: string | null;
  onClearRepeatTarget: () => void;
  onChangeInputText: (val: string) => void;
  onSendText: (text?: string) => void;
  onToggleRecord: () => void;
  onStartLiveCall: () => void;
  onStopLiveCall: () => void;
  onToggleMute: () => void;
  onInterruptAudio: () => void;
}

export const VoiceDock: React.FC<VoiceDockProps> = ({
  interactionMode,
  isRecording,
  isThinking,
  isSpeaking,
  isLiveConnected,
  isLiveConnecting,
  isMicMuted,
  inputText,
  interimTranscript,
  quickReplies,
  repeatTarget,
  onClearRepeatTarget,
  onChangeInputText,
  onSendText,
  onToggleRecord,
  onStartLiveCall,
  onStopLiveCall,
  onToggleMute,
  onInterruptAudio,
}) => {
  // Spacebar shortcut to toggle mic when not typing in an input/textarea
  useEffect(() => {
    if (interactionMode !== 'turn') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (!isThinking) {
        onToggleRecord();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [interactionMode, isThinking, onToggleRecord]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    onSendText();
  };

  return (
    <div className="border-t border-white/8 bg-[#0D1018]/95 px-3 sm:px-5 py-3 backdrop-blur-md space-y-2.5">
      {/* Repeat-After-Me Banner */}
      {repeatTarget && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-orange-500/35 bg-orange-500/12 px-3 py-2 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-orange-300">🔁 跟读挑战：</span>
            <span className="text-white italic">"{repeatTarget}"</span>
          </div>
          <button
            type="button"
            onClick={onClearRepeatTarget}
            className="shrink-0 text-slate-400 hover:text-white"
          >
            关闭
          </button>
        </div>
      )}

      {/* Quick Bait / Starter Chips */}
      {quickReplies.length > 0 && !isLiveConnected && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
            <Sparkles className="h-3 w-3 text-orange-400" />
            点一句开撩/作死：
          </span>
          {quickReplies.map((chip, i) => (
            <button
              key={i}
              type="button"
              disabled={isThinking || isRecording}
              onClick={() => onSendText(chip)}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200 hover:border-orange-500/50 hover:bg-orange-500/15 transition disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {interactionMode === 'live' ? (
        /* Live Call Controls */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-violet-500/25 bg-[#121625] px-4 py-3">
          <div className="flex items-center gap-3">
            {!isLiveConnected ? (
              <button
                type="button"
                disabled={isLiveConnecting}
                onClick={onStartLiveCall}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 hover:brightness-110 transition disabled:opacity-50"
              >
                <PhoneCall className="h-4 w-4" />
                {isLiveConnecting ? '正在接通搭子...' : '拨通实时语音连麦'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition ${
                    isMicMuted
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                      : 'border-white/15 bg-white/8 text-white hover:bg-white/15'
                  }`}
                >
                  {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-emerald-400" />}
                  {isMicMuted ? '已静音' : '麦克风开启'}
                </button>
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={onInterruptAudio}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/15 px-3.5 py-2.5 text-xs font-medium text-orange-200 hover:bg-orange-500/25"
                  >
                    <VolumeX className="h-4 w-4" />
                    打断插话
                  </button>
                )}
                <button
                  type="button"
                  onClick={onStopLiveCall}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-500 transition"
                >
                  <PhoneOff className="h-4 w-4" />
                  挂断
                </button>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex w-full sm:w-auto sm:flex-1 items-center gap-2">
            <input
              value={inputText}
              onChange={(e) => onChangeInputText(e.target.value)}
              disabled={!isLiveConnected}
              placeholder={
                isLiveConnected
                  ? '连麦中也可以直接打字给搭子...'
                  : '建议戴耳机防止回声 · 点击左侧拨通即可边说边被吐槽'
              }
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none disabled:opacity-60"
            />
            {isLiveConnected && (
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>
      ) : (
        /* Turn-Based Push-to-Talk & Text Dock */
        <div className="space-y-2">
          {isRecording && (
            <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-100">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                正在录音（再点一次红色按钮或按空格结束并发送）
              </span>
              {interimTranscript && (
                <span className="truncate max-w-[45%] italic text-rose-200">
                  "{interimTranscript}"
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              disabled={isThinking}
              onClick={onToggleRecord}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-xs font-semibold transition shadow-md ${
                isRecording
                  ? 'bg-rose-600 text-white shadow-rose-950/50 ring-2 ring-rose-400/60'
                  : 'bg-gradient-to-r from-[#FF5A36] to-[#FF8B3D] text-white shadow-orange-950/40 hover:brightness-110'
              } disabled:opacity-50`}
              title="点击开始/结束说话（也可按空格键）"
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 fill-current" />
                  <span>说完发送</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  <span>开口说英语</span>
                </>
              )}
            </button>

            <input
              value={inputText}
              onChange={(e) => onChangeInputText(e.target.value)}
              disabled={isRecording || isThinking}
              placeholder="或者直接输入你想说的英文（支持中英混杂，看搭子怎么吐槽你）..."
              className="h-11 flex-1 rounded-2xl border border-white/10 bg-[#121622] px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FF5A36]/60 focus:outline-none disabled:opacity-50"
            />

            {isSpeaking && (
              <button
                type="button"
                onClick={onInterruptAudio}
                className="flex h-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-slate-300 hover:bg-white/10"
                title="停止当前朗读"
              >
                <VolumeX className="h-4 w-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!inputText.trim() || isThinking || isRecording}
              className="flex h-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/18 disabled:opacity-40 transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
