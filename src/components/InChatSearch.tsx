import React, { useEffect, useRef } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { Message } from '../types';

export function filterMessagesByText(messages: Message[], query: string): Message[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return messages;
  return messages.filter((msg) => {
    const textMatch = (msg.text || '').toLowerCase().includes(trimmed);
    const replyMatch = (msg.replyTo?.text || '').toLowerCase().includes(trimmed);
    const summaryMatch = (msg.summary || '').toLowerCase().includes(trimmed);
    const pollQuestionMatch = (msg.poll?.question || '').toLowerCase().includes(trimmed);
    const pollOptionsMatch = Array.isArray(msg.poll?.options)
      ? msg.poll!.options.some((opt) => (opt.text || '').toLowerCase().includes(trimmed))
      : false;
    return textMatch || replyMatch || summaryMatch || pollQuestionMatch || pollOptionsMatch;
  });
}

export function highlightMatchedText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed || !text) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark
        key={i}
        className="bg-amber-400/35 text-amber-100 rounded px-0.5 font-medium"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

interface InChatSearchTriggerProps {
  isOpen: boolean;
  hasActiveQuery: boolean;
  onToggle: () => void;
  title?: string;
}

export const InChatSearchTrigger: React.FC<InChatSearchTriggerProps> = ({
  isOpen,
  hasActiveQuery,
  onToggle,
  title = 'Поиск по сообщениям в чате'
}) => {
  const active = isOpen || hasActiveQuery;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
        active
          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-xs'
          : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800 border border-transparent'
      }`}
      title={title}
      aria-label={title}
    >
      <Search className="w-5 h-5" />
    </button>
  );
};

export interface InChatSearchProps {
  value: string;
  onChange: (val: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  placeholder?: string;
  matchCount?: number;
  totalCount?: number;
}

/**
 * Floating sub-header component that overlays the active chat message stream cleanly when active.
 */
export const InChatSearch: React.FC<InChatSearchProps> = ({
  value,
  onChange,
  isOpen = false,
  onClose,
  placeholder = 'Поиск сообщений в чате...',
  matchCount,
  totalCount
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasQuery = value.trim().length > 0;
  const isVisible = isOpen || hasQuery;

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleClose = () => {
    onChange('');
    onClose?.();
  };

  return (
    <div className="absolute top-3 left-3 right-3 sm:left-6 sm:right-6 z-30 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="pointer-events-auto max-w-3xl mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl shadow-slate-950/70 px-3.5 py-2 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleClose();
            }
          }}
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none min-w-0"
        />

        {hasQuery && typeof matchCount === 'number' && (
          <div
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border shrink-0 select-none flex items-center gap-1 ${
              matchCount > 0
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            }`}
            title={`Найдено совпадений: ${matchCount}`}
          >
            <span>
              {matchCount > 0
                ? `Найдено: ${matchCount}${typeof totalCount === 'number' ? ` из ${totalCount}` : ''}`
                : 'Нет совпадений'}
            </span>
          </div>
        )}

        {hasQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Очистить запрос"
          >
            Сбросить
          </button>
        )}

        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Закрыть поиск (Esc)"
          aria-label="Закрыть поиск"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
