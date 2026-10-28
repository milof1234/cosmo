import React, { useState } from 'react';
import { Group, User, ChatTheme, Message } from '../types';
import {
  X,
  Users,
  Trash2,
  UserPlus,
  LogOut,
  Crown,
  Search,
  Check,
  Camera,
  Palette,
  Download,
  FileText,
  FileJson,
  BarChart3
} from 'lucide-react';
import { containsProfanity } from '../App';
import { ChatThemePicker, exportChatHistory } from './ChatThemePicker';
import { ChatAnalyticsPanel } from './ChatAnalyticsPanel';

interface GroupModalProps {
  mode: 'create' | 'info';
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  currentGroup?: Group | null;
  messages?: Message[];
  usersMap?: Record<string, User>;
  onCreateGroup: (
    name: string,
    description: string,
    avatar: string,
    memberIds: string[],
    initialTheme?: ChatTheme
  ) => Promise<void>;
  onUpdateGroup?: (groupId: string, data: Partial<Group>) => Promise<void>;
  onDeleteGroup?: (groupId: string) => Promise<void>;
  onLeaveGroup?: (groupId: string) => Promise<void>;
  onAddMember?: (groupId: string, userId: string) => Promise<void>;
  onRemoveMember?: (groupId: string, userId: string) => Promise<void>;
}

const PRESET_COLORS = [
  { id: 'indigo', label: 'Индиго', bg: 'bg-indigo-600', ring: 'ring-indigo-400' },
  { id: 'blue', label: 'Синий', bg: 'bg-blue-600', ring: 'ring-blue-400' },
  { id: 'emerald', label: 'Изумруд', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
  { id: 'rose', label: 'Розовый', bg: 'bg-rose-600', ring: 'ring-rose-400' },
  { id: 'amber', label: 'Янтарь', bg: 'bg-amber-600', ring: 'ring-amber-400' },
  { id: 'purple', label: 'Фиолетовый', bg: 'bg-purple-600', ring: 'ring-purple-400' },
  { id: 'teal', label: 'Морской', bg: 'bg-teal-600', ring: 'ring-teal-400' },
  { id: 'slate', label: 'Графит', bg: 'bg-slate-700', ring: 'ring-slate-400' }
];

export const GroupModal: React.FC<GroupModalProps> = ({
  mode,
  isOpen,
  onClose,
  currentUser,
  allUsers,
  currentGroup,
  messages = [],
  usersMap = {},
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onLeaveGroup,
  onAddMember,
  onRemoveMember
}) => {
  if (!isOpen) return null;

  // Create Mode state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].id);
  const [customAvatar, setCustomAvatar] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [createTheme, setCreateTheme] = useState<ChatTheme>({
    bubbleColorId: 'indigo',
    customBubbleHex: '#4f46e5',
    bgGradientId: 'default',
    customBgHexFrom: '#0b1121',
    customBgHexTo: '#0b1121',
    wallpaperId: 'none',
    wallpaperUrl: '',
    wallpaperDimming: 40
  });
  const [showCreateThemeSection, setShowCreateThemeSection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Info Mode state
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [showThemeSection, setShowThemeSection] = useState(false);
  const [showAnalyticsSection, setShowAnalyticsSection] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'json'>('txt');
  const [exportSuccess, setExportSuccess] = useState('');

  const isCreator = currentGroup?.creatorId === currentUser.id;
  const currentGroupMembers: string[] = currentGroup?.memberIds
    ? Array.isArray(currentGroup.memberIds)
      ? currentGroup.memberIds.filter(Boolean)
      : Object.values(currentGroup.memberIds as Record<string, string>).filter(Boolean)
    : [];

  const toggleMemberSelection = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomAvatar(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название группы');
      return;
    }

    if (containsProfanity(name) || containsProfanity(description)) {
      setError('Название содержит недопустимые слова');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const avatar = customAvatar || selectedColor;
      const initialMembers = Array.from(new Set([currentUser.id, ...selectedMemberIds]));
      await onCreateGroup(name.trim(), description.trim(), avatar, initialMembers, createTheme);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка создания группы');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered users for create mode
  const filteredUsersForCreate = allUsers.filter((u) => {
    if (u.id === currentUser.id) return false;
    const q = memberSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  });

  // Filtered users for add-member in info mode
  const existingMemberSet = new Set(currentGroupMembers);
  const nonMembers = allUsers.filter(
    (u) =>
      !existingMemberSet.has(u.id) &&
      ((u.name || '').toLowerCase().includes(addMemberSearch.toLowerCase().trim()) ||
        (u.username || '').toLowerCase().includes(addMemberSearch.toLowerCase().trim()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative my-auto animate-in fade-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {mode === 'create' ? (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Новая группа</h3>
                <p className="text-xs text-slate-400">Создайте чат для нескольких участников</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Group Avatar Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Оформление группы
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      title={col.label}
                      onClick={() => {
                        setSelectedColor(col.id);
                        setCustomAvatar('');
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 cursor-pointer transition-all ${col.bg} ${
                        selectedColor === col.id && !customAvatar
                          ? `ring-2 ring-white scale-105 shadow-md`
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {(name?.[0] || 'Г').toUpperCase()}
                    </button>
                  ))}
                  <label className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 cursor-pointer border border-dashed transition-all ${
                    customAvatar ? 'bg-indigo-600 ring-2 ring-white text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-600'
                  }`} title="Загрузить свою картинку">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Group Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Название группы *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Орбитальная станция"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Описание / Тема (необязательно)
                </label>
                <input
                  type="text"
                  placeholder="О чем этот чат..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              {/* Group Wallpaper & Theme on Creation */}
              <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Обои и оформление чата
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateThemeSection((prev) => !prev)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    {showCreateThemeSection ? 'Скрыть' : 'Выбрать обои / цвет'}
                  </button>
                </div>

                {showCreateThemeSection && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60">
                    <ChatThemePicker compact value={createTheme} onChange={setCreateTheme} />
                  </div>
                )}
              </div>

              {/* Add Members Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Добавить участников ({selectedMemberIds.length})
                  </label>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Поиск пользователей..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 bg-slate-800/40 p-2 rounded-xl border border-slate-700/60">
                  {filteredUsersForCreate.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">
                      Пользователи не найдены
                    </div>
                  ) : (
                    filteredUsersForCreate.map((u) => {
                      const isSelected = selectedMemberIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleMemberSelection(u.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-600/30 border border-indigo-500/40' : 'hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                u.name?.[0]?.toUpperCase() || '?'
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">{u.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">@{u.username}</div>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-600 bg-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Создание...' : 'Создать группу'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Info Mode */
          currentGroup && (
            <div>
              {/* Header */}
              <div className="text-center mb-5">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-xl shadow-indigo-600/20 overflow-hidden">
                  {currentGroup.avatar?.startsWith('data:') || currentGroup.avatar?.startsWith('http') ? (
                    <img src={currentGroup.avatar} alt={currentGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(currentGroup.name?.[0] || 'Г').toUpperCase()}</span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{currentGroup.name}</span>
                </h3>
                {currentGroup.description && (
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{currentGroup.description}</p>
                )}
                <div className="text-xs text-indigo-400 mt-2 font-medium">
                  {currentGroupMembers.length} участников
                </div>
              </div>

              {/* Group Theme, Wallpaper & Bubble Color Settings */}
              <div className="mb-5 bg-slate-800/50 border border-slate-700/70 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Обои, тема и цвета чата
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowThemeSection((prev) => !prev)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    {showThemeSection ? 'Скрыть настройки' : 'Обои и цвета'}
                  </button>
                </div>

                {showThemeSection && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60">
                    <ChatThemePicker
                      compact
                      value={
                        currentGroup.theme ||
                        currentUser.settings?.chatThemes?.[currentGroup.id] || {
                          wallpaperId: currentGroup.wallpaperId,
                          wallpaperUrl: currentGroup.wallpaperUrl
                        }
                      }
                      onChange={(nextTheme: ChatTheme) => {
                        onUpdateGroup?.(currentGroup.id, {
                          theme: nextTheme,
                          wallpaperId: nextTheme.wallpaperId,
                          wallpaperUrl: nextTheme.wallpaperUrl
                        });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Export Group Chat History Section */}
              <div className="mb-5 bg-slate-800/50 border border-slate-700/70 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Экспорт истории чата ({messages.length})
                    </span>
                  </div>
                  <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700/80 text-xs">
                    <button
                      type="button"
                      onClick={() => setExportFormat('txt')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                        exportFormat === 'txt'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-2.5 h-2.5" />
                      <span>TXT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                        exportFormat === 'json'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileJson className="w-2.5 h-2.5" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    exportChatHistory({
                      chatTitle: currentGroup.name,
                      isGroup: true,
                      messages,
                      usersMap,
                      format: exportFormat
                    });
                    setExportSuccess(`Экспортировано в .${exportFormat.toUpperCase()}`);
                    setTimeout(() => setExportSuccess(''), 3000);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Chat (.{exportFormat.toUpperCase()})</span>
                </button>

                {exportSuccess && (
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{exportSuccess}</span>
                  </div>
                )}
              </div>

              {/* Group Analytics Section */}
              <div className="mb-5 bg-slate-800/50 border border-slate-700/70 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Analytics — Статистика группы ({messages.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnalyticsSection((prev) => !prev)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    {showAnalyticsSection ? 'Скрыть графики' : 'Показать графики'}
                  </button>
                </div>

                {showAnalyticsSection && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60">
                    <ChatAnalyticsPanel
                      messages={messages}
                      usersMap={usersMap}
                      chatTitle={currentGroup.name}
                      isGroup={true}
                    />
                  </div>
                )}
              </div>

              {/* Members List */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Участники
                  </span>
                  {isCreator && !showAddMember && (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Добавить
                    </button>
                  )}
                </div>

                {/* Add member dropdown/search */}
                {showAddMember && (
                  <div className="mb-3 p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Добавить в группу:</span>
                      <button
                        onClick={() => setShowAddMember(false)}
                        className="text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Поиск людей..."
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {nonMembers.length === 0 ? (
                        <div className="text-xs text-slate-500 py-2 text-center">Все найденные уже в группе</div>
                      ) : (
                        nonMembers.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-slate-700/60"
                          >
                            <span className="text-xs text-white">{u.name} (@{u.username})</span>
                            <button
                              type="button"
                              onClick={() => {
                                onAddMember?.(currentGroup.id, u.id);
                                setShowAddMember(false);
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium cursor-pointer"
                            >
                              Добавить
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-slate-800/40 p-2 rounded-xl border border-slate-700/60">
                  {currentGroupMembers.map((mId) => {
                    const memberUser = allUsers.find((u) => u.id === mId);
                    const isMemberCreator = currentGroup.creatorId === mId;
                    const isMe = currentUser.id === mId;

                    return (
                      <div
                        key={mId}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden relative">
                            {memberUser?.avatar ? (
                              <img src={memberUser.avatar} alt={memberUser?.name} className="w-full h-full object-cover" />
                            ) : (
                              memberUser?.name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white flex items-center gap-1 truncate">
                              <span>{memberUser ? memberUser.name : 'Пользователь'}</span>
                              {isMe && <span className="text-[10px] text-slate-400 font-normal">(вы)</span>}
                              {isMemberCreator && (
                                <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                  <Crown className="w-2.5 h-2.5" /> Владелец
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              @{memberUser?.username || 'user'}
                            </div>
                          </div>
                        </div>

                        {/* Remove button for creator */}
                        {isCreator && !isMemberCreator && (
                          <button
                            type="button"
                            onClick={() => onRemoveMember?.(currentGroup.id, mId)}
                            className="text-xs text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            title="Удалить из группы"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions: Leave / Delete */}
              <div className="pt-2 border-t border-slate-800 flex gap-2">
                {isCreator ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Удалить группу «${currentGroup.name}» для всех участников?`)) {
                        onDeleteGroup?.(currentGroup.id);
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Удалить группу
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Вы действительно хотите покинуть группу «${currentGroup.name}»?`)) {
                        onLeaveGroup?.(currentGroup.id);
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Покинуть группу
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
