import React, { useState, useRef, useEffect } from 'react';
import { User, Group, ChatFolder } from '../types';
import {
  Mic,
  Square,
  Sparkles,
  Send,
  X,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Palette,
  FolderPlus,
  BarChart3,
  Download,
  Volume2
} from 'lucide-react';

export interface VoiceAssistantCommandResult {
  transcript: string;
  action:
    | 'send_message'
    | 'change_theme'
    | 'open_chat'
    | 'create_folder'
    | 'open_analytics'
    | 'export_chat'
    | 'general_reply';
  targetId?: string;
  targetName?: string;
  isGroup?: boolean;
  messageText?: string;
  themePreset?: string;
  folderName?: string;
  exportFormat?: 'txt' | 'json';
  assistantReply: string;
}

interface CommandHistoryItem extends VoiceAssistantCommandResult {
  id: string;
  timestamp: string;
  executedDetail?: string;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  contacts: User[];
  groups: Group[];
  folders: ChatFolder[];
  activeChatTitle: string;
  onExecuteCommand: (cmd: VoiceAssistantCommandResult) => Promise<string>;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  contacts,
  groups,
  folders,
  activeChatTitle,
  onExecuteCommand
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualCommand, setManualCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>('');

  const otherContacts = contacts.filter((u) => u.id !== currentUser.id);
  const sampleContactName = otherContacts[0]?.name || groups[0]?.name || 'Алексей';

  useEffect(() => {
    if (!isOpen) {
      stopRecordingCleanup();
    }
    return () => {
      stopRecordingCleanup();
    };
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
  };

  if (!isOpen) return null;

  const processVoiceCommand = async (payload: { audioUrl?: string; textCommand?: string }) => {
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/gemini/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: payload.audioUrl,
          textCommand: payload.textCommand,
          contacts: otherContacts.map((u) => ({
            id: u.id,
            name: u.name,
            username: u.username
          })),
          groups: groups.map((g) => ({
            id: g.id,
            name: g.name
          })),
          folders: folders.map((f) => ({
            id: f.id,
            name: f.name
          })),
          activeChatTitle
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось обработать голосовую команду.');
      }

      const cmdResult: VoiceAssistantCommandResult = {
        transcript: data.transcript || payload.textCommand || 'Голосовая команда',
        action: data.action || 'general_reply',
        targetId: data.targetId || '',
        targetName: data.targetName || '',
        isGroup: Boolean(data.isGroup),
        messageText: data.messageText || '',
        themePreset: data.themePreset || '',
        folderName: data.folderName || '',
        exportFormat: data.exportFormat === 'json' ? 'json' : 'txt',
        assistantReply: data.assistantReply || 'Команда выполнена.'
      };

      const executedDetail = await onExecuteCommand(cmdResult);

      const item: CommandHistoryItem = {
        ...cmdResult,
        id: 'va_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        executedDetail
      };

      setHistory((prev) => [item, ...prev]);
      setManualCommand('');
      setLiveTranscript('');
      liveTranscriptRef.current = '';
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка при обращении к голосовому ассистенту Gemini.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceRecording = async () => {
    setErrorMsg('');
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setRecordingSeconds(0);

    // Start Web Speech API live recognition in parallel if available
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0].transcript + ' ';
          }
          const clean = combined.trim();
          if (clean) {
            liveTranscriptRef.current = clean;
            setLiveTranscript(clean);
          }
        };
        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        // ignore speech recognition init issues
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          void processVoiceCommand({
            audioUrl: base64Audio,
            textCommand: liveTranscriptRef.current || undefined
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Fallback if microphone hardware is unavailable in preview environment
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    }
  };

  const stopVoiceRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    } else {
      setIsRecording(false);
      // Fallback if MediaRecorder wasn't available
      const fallbackCmd =
        liveTranscriptRef.current ||
        manualCommand.trim() ||
        `Change theme to dark`;
      void processVoiceCommand({ textCommand: fallbackCmd });
    }
  };

  const getActionBadge = (action: VoiceAssistantCommandResult['action']) => {
    switch (action) {
      case 'send_message':
        return {
          label: 'SEND MESSAGE',
          icon: <MessageSquare className="w-3 h-3" />,
          cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
        };
      case 'change_theme':
        return {
          label: 'CHANGE THEME',
          icon: <Palette className="w-3 h-3" />,
          cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        };
      case 'create_folder':
        return {
          label: 'CREATE FOLDER',
          icon: <FolderPlus className="w-3 h-3" />,
          cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        };
      case 'open_analytics':
        return {
          label: 'OPEN ANALYTICS',
          icon: <BarChart3 className="w-3 h-3" />,
          cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        };
      case 'export_chat':
        return {
          label: 'EXPORT CHAT',
          icon: <Download className="w-3 h-3" />,
          cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
        };
      case 'open_chat':
        return {
          label: 'OPEN CHAT',
          icon: <MessageSquare className="w-3 h-3" />,
          cls: 'bg-teal-500/20 text-teal-300 border-teal-500/30'
        };
      default:
        return {
          label: 'ASSISTANT',
          icon: <Sparkles className="w-3 h-3" />,
          cls: 'bg-slate-700/60 text-slate-300 border-slate-600'
        };
    }
  };

  const quickPresets = [
    `Send message to ${sampleContactName}: Привет! Как дела?`,
    `Change theme to dark`,
    `Change theme to cyberpunk`,
    `Создай папку Проекты`,
    `Покажи аналитику чата`
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white truncate">Voice Assistant</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Gemini AI
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Голосовое управление чатами, отправкой сообщений и темами оформления
            </p>
          </div>
        </div>

        {/* Voice Microphone Orb */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex flex-col items-center text-center mb-4 shrink-0">
          <button
            type="button"
            disabled={isProcessing}
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer relative ${
              isRecording
                ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/40 scale-105 animate-pulse'
                : isProcessing
                ? 'bg-indigo-600/40 text-indigo-200 cursor-wait'
                : 'bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/30 hover:scale-105'
            }`}
            title={isRecording ? 'Остановить запись и выполнить команду' : 'Начать запись голосовой команды'}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isRecording ? (
              <Square className="w-7 h-7 fill-current" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          <div className="mt-3">
            {isRecording ? (
              <div className="space-y-1">
                <div className="text-sm font-bold text-rose-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Запись голосовой команды... ({recordingSeconds} сек.)</span>
                </div>
                <p className="text-xs text-slate-300">
                  {liveTranscript
                    ? `«${liveTranscript}»`
                    : 'Произнесите команду, например: «Send message to Alex: Привет!» или «Change theme to dark»'}
                </p>
              </div>
            ) : isProcessing ? (
              <div className="text-xs font-medium text-indigo-300">
                Распознавание речи и выполнение команды через Gemini...
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold text-white">
                  Нажмите на микрофон и произнесите команду
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Например: «Отправь сообщение {sampleContactName} Привет!» или «Change theme to dark»
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Voice Command Chips */}
        <div className="mb-3.5 shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Быстрые голосовые команды (1 клик):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={isProcessing || isRecording}
                onClick={() => void processVoiceCommand({ textCommand: preset })}
                className="text-[11px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600/25 text-slate-300 hover:text-indigo-200 border border-slate-700 hover:border-indigo-500/40 transition-all cursor-pointer disabled:opacity-40"
              >
                «{preset}»
              </button>
            ))}
          </div>
        </div>

        {/* Manual / Transcribed Command Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manualCommand.trim() || isProcessing) return;
            void processVoiceCommand({ textCommand: manualCommand.trim() });
          }}
          className="flex items-center gap-2 mb-4 shrink-0"
        >
          <input
            type="text"
            value={manualCommand}
            onChange={(e) => setManualCommand(e.target.value)}
            placeholder="Или введите команду (напр. Send message to Иван: Привет)..."
            className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!manualCommand.trim() || isProcessing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md shadow-indigo-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Выполнить</span>
          </button>
        </form>

        {errorMsg && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Executed Commands Log */}
        <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[120px] pr-1">
          {history.length === 0 ? (
            <div className="text-center py-6 bg-slate-800/30 border border-slate-800 rounded-xl text-xs text-slate-500">
              История выполненных голосовых команд появится здесь
            </div>
          ) : (
            history.map((item) => {
              const badge = getActionBadge(item.action);
              return (
                <div
                  key={item.id}
                  className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                  </div>

                  <div className="text-xs text-slate-300">
                    <span className="text-slate-500">Распознано: </span>
                    <span className="font-medium text-white">«{item.transcript}»</span>
                  </div>

                  <div className="text-xs text-indigo-200 flex items-start gap-1.5 pt-1 border-t border-slate-700/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-emerald-300">{item.assistantReply}</div>
                      {item.executedDetail && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.executedDetail}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
