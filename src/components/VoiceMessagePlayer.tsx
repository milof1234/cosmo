import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Sparkles, Loader2, ChevronUp, RefreshCw } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl?: string;
  isMe: boolean;
  timeStr?: string;
  initialDuration?: number;
  initialSummary?: string;
  onSaveSummary?: (summary: string) => void;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  isMe,
  timeStr,
  initialDuration,
  initialSummary,
  onSaveSummary
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [summary, setSummary] = useState<string>(initialSummary || '');
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(Boolean(initialSummary));
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (initialSummary && initialSummary !== summary) {
      setSummary(initialSummary);
    }
  }, [initialSummary]);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.playbackRate = playbackRate;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration) && !duration) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Playback error:', err);
        });
    }
  };

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates: (1 | 1.5 | 2)[] = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * duration;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const runSummarize = async (e?: React.MouseEvent, forceRefresh = false) => {
    if (e) e.stopPropagation();
    if (!audioUrl) {
      setSummaryError('Нет аудиозаписи для анализа.');
      setIsSummaryExpanded(true);
      return;
    }

    if (summary && !forceRefresh) {
      setIsSummaryExpanded((prev) => !prev);
      return;
    }

    setIsSummarizing(true);
    setSummaryError('');
    setIsSummaryExpanded(true);

    try {
      const response = await fetch('/api/gemini/summarize-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioUrl,
          duration: duration || initialDuration || 0
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось получить сводку голосового сообщения.');
      }

      const generatedSummary = String(data?.summary || '').trim();
      setSummary(generatedSummary);
      onSaveSummary?.(generatedSummary);
    } catch (err: any) {
      setSummaryError(err?.message || 'Ошибка анализа голосового сообщения.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const formatSec = (sec: number) => {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  // 24 proportional bars for a richer voice waveform visual
  const bars = [10, 18, 14, 26, 32, 20, 38, 24, 42, 30, 22, 36, 40, 26, 18, 34, 28, 16, 24, 30, 20, 14, 18, 12];
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="py-1 min-w-[240px] sm:min-w-[290px] select-none">
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
            isMe
              ? 'bg-white text-indigo-600 hover:bg-slate-100 shadow-indigo-950/20'
              : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-slate-900/30'
          }`}
          title={isPlaying ? 'Пауза' : 'Слушать'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Waveform and progress */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div
            onClick={handleSeek}
            className="flex items-center gap-1 h-8 cursor-pointer py-1 group"
            title="Перемотать"
          >
            {bars.map((height, idx) => {
              const barPercent = (idx / bars.length) * 100;
              const isPassed = barPercent <= progressPercent;

              return (
                <div
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-100 ${
                    isPlaying
                      ? isPassed
                        ? isMe
                          ? 'bg-white'
                          : 'bg-indigo-400'
                        : isMe
                        ? 'bg-white/35'
                        : 'bg-slate-600/70'
                      : isPassed
                      ? isMe
                        ? 'bg-white'
                        : 'bg-indigo-400'
                      : isMe
                      ? 'bg-white/35'
                      : 'bg-slate-600/70'
                  } group-hover:opacity-90`}
                  style={{
                    height: `${height}px`,
                    transform: isPlaying && isPassed ? 'scaleY(1.12)' : 'scaleY(1)'
                  }}
                />
              );
            })}
          </div>

          {/* Time, Summarize Button, Speed Selector & Audio Badge */}
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono leading-none mt-1">
            <span className={isMe ? 'text-indigo-100' : 'text-slate-400'}>
              {isPlaying ? formatSec(currentTime) : duration > 0 ? formatSec(duration) : '0:00'}
            </span>

            <div className="flex items-center gap-1.5">
              {/* Summarize Button */}
              <button
                type="button"
                disabled={isSummarizing}
                onClick={(e) => runSummarize(e, false)}
                className={`inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  isMe
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                } disabled:opacity-60`}
                title="Суммаризировать голосовое сообщение с помощью Gemini AI"
              >
                {isSummarizing ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <Sparkles className="w-2.5 h-2.5" />
                )}
                <span>{summary && isSummaryExpanded ? 'Скрыть' : 'Summarize'}</span>
              </button>

              <button
                type="button"
                onClick={cyclePlaybackRate}
                className={`text-[10px] font-sans font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  isMe
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-slate-700/80 text-indigo-300 hover:bg-slate-700'
                }`}
                title="Скорость воспроизведения"
              >
                {playbackRate}x
              </button>

              <span
                className={`hidden sm:flex items-center gap-1 text-[10px] uppercase tracking-wider font-sans font-semibold ${
                  isMe ? 'text-indigo-200' : 'text-indigo-400'
                }`}
              >
                <Mic className="w-2.5 h-2.5" />
                <span>Голос</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Summary Output Block */}
      {isSummaryExpanded && (isSummarizing || summary || summaryError) && (
        <div
          className={`mt-2.5 rounded-xl p-2.5 text-xs select-text transition-all border ${
            isMe
              ? 'bg-black/20 border-white/20 text-indigo-50'
              : 'bg-slate-900/75 border-indigo-500/30 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1 select-none">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                isMe ? 'text-indigo-200' : 'text-indigo-400'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Краткая сводка</span>
            </span>

            <div className="flex items-center gap-1">
              {!isSummarizing && (
                <button
                  type="button"
                  onClick={(e) => runSummarize(e, true)}
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    isMe ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Обновить сводку"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSummaryExpanded(false)}
                className={`p-0.5 rounded transition-colors cursor-pointer ${
                  isMe ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Свернуть сводку"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isSummarizing ? (
            <div className="flex items-center gap-2 py-1 text-[11px] opacity-90">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Анализируем голосовое сообщение...</span>
            </div>
          ) : summaryError ? (
            <div className="text-[11px] text-rose-300 leading-snug">{summaryError}</div>
          ) : (
            <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">{summary}</div>
          )}
        </div>
      )}
    </div>
  );
};
