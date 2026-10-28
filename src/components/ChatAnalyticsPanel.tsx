import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import { Message, User } from '../types';
import { BarChart3, MessageSquare, Users, Clock, Mic } from 'lucide-react';

interface ChatAnalyticsPanelProps {
  messages: Message[];
  usersMap?: Record<string, User>;
  chatTitle: string;
  isGroup: boolean;
}

const PARTICIPANT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#0ea5e9',
  '#a855f7',
  '#f43f5e'
];

export const ChatAnalyticsPanel: React.FC<ChatAnalyticsPanelProps> = ({
  messages,
  usersMap = {},
  chatTitle,
  isGroup
}) => {
  const resolveSenderName = (msg: Message) => {
    const u = usersMap[msg.senderId];
    return u?.name || msg.senderName || 'Участник';
  };

  // 1. Messages Count Over Time (by date)
  const messagesOverTimeData = useMemo(() => {
    const countsByDate = new Map<string, { label: string; count: number; ts: number }>();

    const sorted = [...messages].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    sorted.forEach((m) => {
      const d = new Date(m.time);
      if (isNaN(d.getTime())) return;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
      const existing = countsByDate.get(dateKey);
      if (existing) {
        existing.count += 1;
      } else {
        countsByDate.set(dateKey, {
          label,
          count: 1,
          ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        });
      }
    });

    // If fewer than 5 days exist, pad recent days so the AreaChart looks smooth and informative
    if (countsByDate.size < 5) {
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        if (!countsByDate.has(dateKey)) {
          countsByDate.set(dateKey, {
            label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
            count: 0,
            ts: d.getTime()
          });
        }
      }
    }

    return Array.from(countsByDate.values())
      .sort((a, b) => a.ts - b.ts)
      .slice(-14)
      .map(({ label, count }) => ({
        date: label,
        messages: count
      }));
  }, [messages]);

  // 2. Top Participants
  const topParticipantsData = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();

    messages.forEach((m) => {
      const senderId = m.senderId || 'unknown';
      const name = resolveSenderName(m);
      const existing = counts.get(senderId);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(senderId, { name, count: 1 });
      }
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((item, idx) => ({
        name: item.name.length > 14 ? item.name.slice(0, 13) + '…' : item.name,
        fullName: item.name,
        messages: item.count,
        color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length]
      }));
  }, [messages, usersMap]);

  // 3. Most Active Hours (00:00 - 23:00)
  const activeHoursData = useMemo(() => {
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      shortHour: `${String(h).padStart(2, '0')}ч`,
      messages: 0,
      rawHour: h
    }));

    messages.forEach((m) => {
      const d = new Date(m.time);
      if (!isNaN(d.getTime())) {
        const h = d.getHours();
        if (hourBuckets[h]) {
          hourBuckets[h].messages += 1;
        }
      }
    });

    return hourBuckets;
  }, [messages]);

  const peakHourObj = useMemo(() => {
    let best = activeHoursData[0];
    for (const h of activeHoursData) {
      if (h.messages > (best?.messages || 0)) {
        best = h;
      }
    }
    return best && best.messages > 0 ? best.hour : '—';
  }, [activeHoursData]);

  const voiceAndMediaCount = useMemo(
    () => messages.filter((m) => m.type === 'voice' || m.type === 'image').length,
    [messages]
  );

  return (
    <div className="space-y-4">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Сообщений</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">{messages.length}</div>
        </div>

        <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Активных авторов</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">{topParticipantsData.length}</div>
        </div>

        <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Пиковый час</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">{peakHourObj}</div>
        </div>

        <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span>Голос / Медиа</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">{voiceAndMediaCount}</div>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center">
          <BarChart3 className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-medium text-slate-300">
            Недостаточно данных для построения графиков
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Отправьте сообщения в чате «{chatTitle}», чтобы увидеть статистику активности.
          </p>
        </div>
      ) : (
        <>
          {/* Chart 1: Messages Count Over Time */}
          <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Динамика сообщений по дням
              </span>
              <span className="text-[11px] text-slate-400">
                {isGroup ? 'Групповой чат' : 'Личный чат'}
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={messagesOverTimeData}
                  margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="msgTimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any) => [`${val} сообщ.`, 'Активность']}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#msgTimeGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Top Participants */}
          <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Топ участников по сообщениям
              </span>
              <span className="text-[11px] text-slate-400">
                Топ-{topParticipantsData.length}
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topParticipantsData}
                  margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any) => [`${val} сообщ.`, 'Сообщений']}
                  />
                  <Bar dataKey="messages" radius={[6, 6, 0, 0]}>
                    {topParticipantsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Most Active Hours */}
          <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Активность по часам суток (00:00 – 23:00)
              </span>
              <span className="text-[11px] text-amber-400 font-medium">
                Пик: {peakHourObj}
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeHoursData}
                  margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="shortHour"
                    interval={2}
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.hour
                        ? `Время: ${payload[0].payload.hour}`
                        : 'Час'
                    }
                    formatter={(val: any) => [`${val} сообщ.`, 'Активность']}
                  />
                  <Bar dataKey="messages" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
