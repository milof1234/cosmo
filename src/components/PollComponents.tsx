import React, { useState } from 'react';
import { PollData, PollOption, User } from '../types';
import { BarChart2, Plus, Trash2, Check, X, Users, Lock } from 'lucide-react';

export function normalizePollVoterIds(raw?: string[] | Record<string, boolean> | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, val]) => Boolean(val))
      .map(([k]) => k);
  }
  return [];
}

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (poll: PollData) => void;
}

export const PollModal: React.FC<PollModalProps> = ({ isOpen, onClose, onCreatePoll }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = question.trim();
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQ) {
      setError('Введите вопрос для голосования');
      return;
    }
    if (cleanOpts.length < 2) {
      setError('Добавьте минимум 2 варианта ответа');
      return;
    }

    const pollData: PollData = {
      question: cleanQ,
      options: cleanOpts.map((text, idx) => ({
        id: `opt_${idx}_${Date.now()}`,
        text,
        voterIds: []
      })),
      allowMultiple,
      isAnonymous
    };

    onCreatePoll(pollData);
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setIsAnonymous(false);
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Создать опрос</h3>
            <p className="text-xs text-slate-400">Голосование для участников чата в реальном времени</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Вопрос опроса *
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setError('');
              }}
              placeholder="Например: Во сколько сегодня созвон?"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Варианты ответа ({options.length}/6)
              </label>
              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить вариант
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Вариант ${idx + 1}`}
                    className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Удалить вариант"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-800">
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
              <span className="text-xs text-slate-200 font-medium">Выбор нескольких вариантов</span>
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
              <span className="text-xs text-slate-200 font-medium">Анонимное голосование</span>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {error && <div className="text-xs text-red-400 text-center font-medium">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              Отправить опрос
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PollCardProps {
  poll: PollData;
  isMe: boolean;
  currentUserId: string;
  usersMap: Record<string, User>;
  onVote: (optionId: string) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  isMe,
  currentUserId,
  usersMap,
  onVote
}) => {
  const options: PollOption[] = Array.isArray(poll.options)
    ? poll.options
    : Object.values(poll.options || {});

  const allUniqueVoters = new Set<string>();
  let totalOptionVotes = 0;

  options.forEach((opt) => {
    const voters = normalizePollVoterIds(opt.voterIds);
    totalOptionVotes += voters.length;
    voters.forEach((uid) => allUniqueVoters.add(uid));
  });

  return (
    <div className="min-w-[240px] sm:min-w-[290px] py-1 select-none">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1 opacity-85">
        <BarChart2 className="w-3.5 h-3.5 shrink-0" />
        <span>
          {poll.isAnonymous ? 'Анонимный опрос' : 'Публичный опрос'}
          {poll.allowMultiple ? ' • Несколько ответов' : ''}
        </span>
      </div>

      <div className="text-sm font-bold mb-2.5 leading-snug break-words">{poll.question}</div>

      <div className="space-y-2">
        {options.map((opt) => {
          const voters = normalizePollVoterIds(opt.voterIds);
          const votedByMe = voters.includes(currentUserId);
          const pct =
            totalOptionVotes > 0 ? Math.round((voters.length / totalOptionVotes) * 100) : 0;

          const voterNames = !poll.isAnonymous
            ? voters.map((uid) => (uid === currentUserId ? 'Вы' : usersMap[uid]?.name || 'Участник'))
            : [];

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onVote(opt.id)}
              className={`w-full text-left rounded-xl p-2.5 relative overflow-hidden border transition-all cursor-pointer ${
                isMe
                  ? votedByMe
                    ? 'bg-white/20 border-white/60 text-white'
                    : 'bg-black/20 hover:bg-black/30 border-white/20 text-indigo-50'
                  : votedByMe
                  ? 'bg-indigo-500/25 border-indigo-400/60 text-white'
                  : 'bg-slate-900/60 hover:bg-slate-900/80 border-slate-700/80 text-slate-200'
              }`}
            >
              {/* Progress Bar Fill */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none ${
                  isMe ? 'bg-white/20' : 'bg-indigo-500/25'
                }`}
                style={{ width: `${pct}%` }}
              />

              <div className="relative flex items-center justify-between gap-2 text-xs font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                      votedByMe
                        ? isMe
                          ? 'bg-white text-indigo-600 border-white'
                          : 'bg-indigo-500 text-white border-indigo-400'
                        : isMe
                        ? 'border-white/50'
                        : 'border-slate-500'
                    }`}
                  >
                    {votedByMe && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </span>
                  <span className="truncate font-semibold">{opt.text}</span>
                </div>
                <span className="text-[11px] font-bold shrink-0">{pct}%</span>
              </div>

              {!poll.isAnonymous && voterNames.length > 0 && (
                <div className="relative mt-1 pl-6 text-[10px] opacity-80 truncate">
                  {voterNames.join(', ')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[10px] opacity-80">
        <span className="flex items-center gap-1">
          {poll.isAnonymous ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
          <span>Проголосовало: {allUniqueVoters.size}</span>
        </span>
        <span>Нажмите для выбора</span>
      </div>
    </div>
  );
};
