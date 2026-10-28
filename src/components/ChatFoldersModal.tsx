import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatFolder, Group, User } from '../types';
import {
  FolderPlus,
  Plus,
  Trash2,
  Check,
  X,
  Search
} from 'lucide-react';

export const DEFAULT_CHAT_FOLDERS: ChatFolder[] = [
  {
    id: 'work',
    name: 'Работа',
    icon: '💼',
    color: 'indigo',
    chatIds: [],
    isArchivedFolder: false
  },
  {
    id: 'friends',
    name: 'Друзья',
    icon: '👥',
    color: 'emerald',
    chatIds: [],
    isArchivedFolder: false
  },
  {
    id: 'archived',
    name: 'Архив',
    icon: '📦',
    color: 'amber',
    chatIds: [],
    isArchivedFolder: true
  }
];

export const FOLDER_ICONS = ['💼', '👥', '📦', '⭐', '🚀', '🔥', '🎮', '📚', '❤️', '📁'];

export const FOLDER_COLORS: {
  id: string;
  label: string;
  badgeClass: string;
  activeTabClass: string;
  dotClass: string;
}[] = [
  {
    id: 'indigo',
    label: 'Индиго',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    activeTabClass: 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/20',
    dotClass: 'bg-indigo-500'
  },
  {
    id: 'emerald',
    label: 'Изумруд',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    activeTabClass: 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20',
    dotClass: 'bg-emerald-500'
  },
  {
    id: 'amber',
    label: 'Янтарь',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    activeTabClass: 'bg-amber-600 text-white border-amber-500 shadow-amber-600/20',
    dotClass: 'bg-amber-500'
  },
  {
    id: 'rose',
    label: 'Розовый',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    activeTabClass: 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20',
    dotClass: 'bg-rose-500'
  },
  {
    id: 'sky',
    label: 'Океан',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    activeTabClass: 'bg-sky-600 text-white border-sky-500 shadow-sky-600/20',
    dotClass: 'bg-sky-500'
  },
  {
    id: 'purple',
    label: 'Пурпур',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    activeTabClass: 'bg-purple-600 text-white border-purple-500 shadow-purple-600/20',
    dotClass: 'bg-purple-500'
  }
];

export function normalizeChatIds(rawIds: any): string[] {
  if (!rawIds) return [];
  if (Array.isArray(rawIds)) {
    return Array.from(
      new Set(
        rawIds.filter((v): v is string => typeof v === 'string' && Boolean(v) && v !== '__empty__')
      )
    );
  }
  if (typeof rawIds === 'object') {
    return Array.from(
      new Set(
        Object.values(rawIds).filter(
          (v): v is string => typeof v === 'string' && Boolean(v) && v !== '__empty__'
        )
      )
    );
  }
  return [];
}

export function sanitizeFoldersForStorage(folders: ChatFolder[]): ChatFolder[] {
  return folders.map((item) => ({
    id: String(item.id || 'folder_' + Math.random().toString(36).slice(2, 8)),
    name: String(item.name || 'Папка').trim() || 'Папка',
    icon: String(item.icon || '📁'),
    color: String(item.color || 'indigo'),
    chatIds: normalizeChatIds(item.chatIds),
    isArchivedFolder: Boolean(item.isArchivedFolder || item.id === 'archived')
  }));
}

export function normalizeUserFolders(rawFolders?: any): ChatFolder[] {
  if (!rawFolders) {
    return DEFAULT_CHAT_FOLDERS.map((f) => ({ ...f, chatIds: [...f.chatIds] }));
  }

  let list: any[] = [];
  if (Array.isArray(rawFolders)) {
    list = rawFolders.filter((item) => item && typeof item === 'object');
  } else if (typeof rawFolders === 'object') {
    list = Object.values(rawFolders).filter((item) => item && typeof item === 'object');
  }

  if (list.length === 0) {
    return DEFAULT_CHAT_FOLDERS.map((f) => ({ ...f, chatIds: [...f.chatIds] }));
  }

  return sanitizeFoldersForStorage(list);
}

export function getFolderColorConfig(colorId?: string) {
  return FOLDER_COLORS.find((c) => c.id === colorId) || FOLDER_COLORS[0];
}

interface ChatFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: ChatFolder[];
  onSaveFolders: (nextFolders: ChatFolder[]) => Promise<void> | void;
  onSelectFolder?: (folderId: string) => void;
  allUsers: User[];
  userGroups: Group[];
  currentUserId: string;
  initialSelectedFolderId?: string | null;
  initialCreateMode?: boolean;
  quickAssignChat?: {
    id: string;
    name: string;
    isGroup: boolean;
  } | null;
}

export function useHorizontalScroll() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    elRef.current = node;
    if (!node) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 && e.deltaX === 0) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta !== 0) {
        e.preventDefault();
        e.stopPropagation();
        node.scrollLeft += delta;
      }
    };

    node.addEventListener('wheel', handleNativeWheel, { passive: false });
    cleanupRef.current = () => {
      node.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const node = elRef.current;
    if (!node || e.button !== 0) return;
    const startX = e.pageX - node.offsetLeft;
    const startScrollLeft = node.scrollLeft;
    let isDragging = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.pageX - node.offsetLeft;
      const walk = x - startX;
      if (Math.abs(walk) > 4) {
        isDragging = true;
        node.scrollLeft = startScrollLeft - walk;
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (isDragging) {
        const suppressClick = (clickEvent: MouseEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
          window.removeEventListener('click', suppressClick, true);
        };
        window.addEventListener('click', suppressClick, true);
        setTimeout(() => window.removeEventListener('click', suppressClick, true), 50);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const scrollByAmount = useCallback((amount: number) => {
    if (elRef.current) {
      elRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }, []);

  return { ref: setRef, onMouseDown: handleMouseDown, scrollByAmount, elRef };
}

export const ChatFoldersModal: React.FC<ChatFoldersModalProps> = ({
  isOpen,
  onClose,
  folders,
  onSaveFolders,
  onSelectFolder,
  allUsers,
  userGroups,
  currentUserId,
  initialSelectedFolderId,
  initialCreateMode = false,
  quickAssignChat
}) => {
  const [draftFolders, setDraftFolders] = useState<ChatFolder[]>(() =>
    normalizeUserFolders(folders)
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>('work');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [newFolderColor, setNewFolderColor] = useState('indigo');
  const [showNewFolderOptions, setShowNewFolderOptions] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Track modal open transition so background Firebase presence updates NEVER reset modal state
  const wasOpenRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalTabsScroll = useHorizontalScroll();

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const normalized = normalizeUserFolders(folders);
      setDraftFolders(normalized);
      if (initialSelectedFolderId && normalized.some((f) => f.id === initialSelectedFolderId)) {
        setSelectedFolderId(initialSelectedFolderId);
      } else if (normalized.length > 0) {
        setSelectedFolderId(normalized[0].id);
      }
      setNewFolderName('');
      setNewFolderIcon('📁');
      setNewFolderColor('indigo');
      setShowNewFolderOptions(Boolean(initialCreateMode));
      setChatSearch('');
      setStatusMessage('');

      if (initialCreateMode) {
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 50);
      }
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
    }
  }, [isOpen, folders, initialSelectedFolderId, initialCreateMode]);

  if (!isOpen) return null;

  const activeFolder = draftFolders.find((f) => f.id === selectedFolderId) || draftFolders[0];

  const showTempStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? '' : prev));
    }, 3500);
  };

  const applyAndSaveFolders = (nextFolders: ChatFolder[]) => {
    const sanitized = sanitizeFoldersForStorage(nextFolders);
    setDraftFolders(sanitized);
    try {
      void onSaveFolders(sanitized);
    } catch (err) {
      console.warn('Failed to save folders:', err);
    }
    return sanitized;
  };

  const handleToggleChatInFolder = (folderId: string, chatId: string) => {
    const nextFolders = draftFolders.map((folder) => {
      if (folder.id !== folderId) return folder;
      const exists = folder.chatIds.includes(chatId);
      const nextIds = exists
        ? folder.chatIds.filter((id) => id !== chatId)
        : [...folder.chatIds, chatId];
      return {
        ...folder,
        chatIds: nextIds
      };
    });
    applyAndSaveFolders(nextFolders);
  };

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      nameInputRef.current?.focus();
      return;
    }

    const newId = 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const created: ChatFolder = {
      id: newId,
      name: trimmed,
      icon: newFolderIcon || '📁',
      color: newFolderColor || 'indigo',
      chatIds: quickAssignChat ? [quickAssignChat.id] : [],
      isArchivedFolder: false
    };

    const nextFolders = [...draftFolders, created];
    applyAndSaveFolders(nextFolders);
    setSelectedFolderId(newId);
    setNewFolderName('');
    setShowNewFolderOptions(false);
    onSelectFolder?.(newId);
    showTempStatus(`Папка «${trimmed}» создана! Ниже можно отметить чаты для неё.`);
  };

  const handleDeleteFolder = (folderId: string) => {
    const target = draftFolders.find((f) => f.id === folderId);
    const next = draftFolders.filter((f) => f.id !== folderId);
    const finalFolders = next.length > 0 ? next : DEFAULT_CHAT_FOLDERS;
    const sanitized = applyAndSaveFolders(finalFolders);
    if (selectedFolderId === folderId && sanitized.length > 0) {
      setSelectedFolderId(sanitized[0].id);
    }
    if (target) {
      showTempStatus(`Папка «${target.name}» удалена`);
    }
  };

  const handleUpdateActiveFolderMeta = (patch: Partial<ChatFolder>) => {
    if (!activeFolder) return;
    const nextFolders = draftFolders.map((f) =>
      f.id === activeFolder.id ? { ...f, ...patch } : f
    );
    applyAndSaveFolders(nextFolders);
  };

  const handleSaveAndClose = () => {
    let foldersToSave = [...draftFolders];

    // If user typed a folder name in the input box and clicked "Сохранить и закрыть" directly:
    const pendingName = newFolderName.trim();
    if (pendingName) {
      const newId = 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const created: ChatFolder = {
        id: newId,
        name: pendingName,
        icon: newFolderIcon || '📁',
        color: newFolderColor || 'indigo',
        chatIds: quickAssignChat ? [quickAssignChat.id] : [],
        isArchivedFolder: false
      };
      foldersToSave = [...foldersToSave, created];
      onSelectFolder?.(newId);
    }

    applyAndSaveFolders(foldersToSave);
    onClose();
  };

  const otherUsers = allUsers.filter((u) => u.id !== currentUserId);
  const cleanSearch = chatSearch.toLowerCase().trim();

  const filteredGroups = userGroups.filter(
    (g) => !cleanSearch || (g.name || '').toLowerCase().includes(cleanSearch)
  );
  const filteredUsers = otherUsers.filter(
    (u) =>
      !cleanSearch ||
      (u.name || '').toLowerCase().includes(cleanSearch) ||
      (u.username || '').toLowerCase().includes(cleanSearch) ||
      (u.phone || '').includes(cleanSearch)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={handleSaveAndClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSaveAndClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-3.5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-white truncate">
              {quickAssignChat ? `Папки для «${quickAssignChat.name}»` : 'Управление папками чатов'}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              Создавайте свои папки и отмечайте чаты или группы
            </p>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ALWAYS-VISIBLE CREATE NEW FOLDER BAR */}
        <div className="mb-3.5 p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Создать новую папку</span>
            </span>
            <button
              type="button"
              onClick={() => setShowNewFolderOptions((prev) => !prev)}
              className="text-[11px] text-slate-400 hover:text-indigo-300 cursor-pointer"
            >
              {showNewFolderOptions ? 'Скрыть иконки' : `Иконка ${newFolderIcon} и цвет`}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewFolderOptions((prev) => !prev)}
              className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 flex items-center justify-center text-base shrink-0 cursor-pointer"
              title="Выбрать иконку и цвет папки"
            >
              {newFolderIcon}
            </button>

            <input
              ref={nameInputRef}
              type="text"
              placeholder="Введите название папки (напр. Учеба, Семья)..."
              value={newFolderName}
              onFocus={() => setShowNewFolderOptions(true)}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateFolder();
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 min-w-0"
            />

            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать</span>
            </button>
          </div>

          {showNewFolderOptions && (
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-indigo-500/20">
              <div className="flex items-center gap-1 flex-wrap">
                {FOLDER_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setNewFolderIcon(ic)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs cursor-pointer transition-all ${
                      newFolderIcon === ic
                        ? 'bg-indigo-600/40 ring-1 ring-indigo-400 scale-110'
                        : 'bg-slate-800/80 hover:bg-slate-700'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {FOLDER_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    title={col.label}
                    onClick={() => setNewFolderColor(col.id)}
                    className={`w-5 h-5 rounded-full ${col.dotClass} cursor-pointer transition-transform ${
                      newFolderColor === col.id
                        ? 'ring-2 ring-white scale-110'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Assign Banner if opened from a specific chat */}
        {quickAssignChat && (
          <div className="mb-3.5 p-3 bg-slate-800/70 border border-slate-700 rounded-xl space-y-2 shrink-0">
            <div className="text-xs font-semibold text-slate-300">
              Быстрое распределение чата «{quickAssignChat.name}»:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {draftFolders.map((folder) => {
                const inFolder = folder.chatIds.includes(quickAssignChat.id);
                const colorCfg = getFolderColorConfig(folder.color);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleToggleChatInFolder(folder.id, quickAssignChat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      inFolder
                        ? colorCfg.activeTabClass
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>{folder.icon || '📁'}</span>
                    <span>{folder.name}</span>
                    {inFolder && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Existing Folders Selector Tabs */}
        <div
          ref={modalTabsScroll.ref}
          onMouseDown={modalTabsScroll.onMouseDown}
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-slate-800 shrink-0 folders-scroll w-full min-w-0"
        >
          {draftFolders.map((folder) => {
            const isSelected = activeFolder?.id === folder.id;
            const colorCfg = getFolderColorConfig(folder.color);
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? colorCfg.activeTabClass
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{folder.icon || '📁'}</span>
                <span>{folder.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/25">
                  {folder.chatIds.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Folder Configuration & Chat Checklist */}
        {activeFolder && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
            {/* Folder Name, Icon, Color & Delete Controls */}
            <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-2.5 space-y-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base">{activeFolder.icon || '📁'}</span>
                  <input
                    type="text"
                    value={activeFolder.name}
                    onChange={(e) => handleUpdateActiveFolderMeta({ name: e.target.value })}
                    className="bg-slate-900/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-indigo-500 w-full max-w-[190px]"
                  />
                </div>

                {draftFolders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(activeFolder.id)}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 cursor-pointer transition-colors"
                    title="Удалить эту папку"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                )}
              </div>

              {/* Quick Icon & Color Row for Selected Folder */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-700/50">
                <div className="flex items-center gap-1">
                  {FOLDER_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => handleUpdateActiveFolderMeta({ icon: ic })}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs cursor-pointer transition-all ${
                        activeFolder.icon === ic
                          ? 'bg-indigo-600/40 ring-1 ring-indigo-400'
                          : 'hover:bg-slate-700'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  {FOLDER_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      title={col.label}
                      onClick={() => handleUpdateActiveFolderMeta({ color: col.id })}
                      className={`w-4 h-4 rounded-full ${col.dotClass} cursor-pointer transition-transform ${
                        activeFolder.color === col.id
                          ? 'ring-2 ring-white scale-110'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Search Chats to include in this folder */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Отметьте чаты для папки «${activeFolder.name}»...`}
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Checklist of Groups & Direct Chats */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 bg-slate-800/30 border border-slate-800 rounded-xl p-2.5 min-h-[150px]">
              {filteredGroups.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
                    Группы ({filteredGroups.length})
                  </div>
                  <div className="space-y-1">
                    {filteredGroups.map((grp) => {
                      const isChecked = activeFolder.chatIds.includes(grp.id);
                      return (
                        <div
                          key={grp.id}
                          onClick={() => handleToggleChatInFolder(activeFolder.id, grp.id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-600/20 border border-indigo-500/40'
                              : 'hover:bg-slate-800/80 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                              {grp.avatar?.startsWith('data:') || grp.avatar?.startsWith('http') ? (
                                <img src={grp.avatar} alt={grp.name} className="w-full h-full object-cover" />
                              ) : (
                                (grp.name?.[0] || 'Г').toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{grp.name}</div>
                              <div className="text-[10px] text-indigo-300">Группа</div>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-600 bg-slate-800'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredUsers.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
                    Личные чаты ({filteredUsers.length})
                  </div>
                  <div className="space-y-1">
                    {filteredUsers.map((u) => {
                      const isChecked = activeFolder.chatIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleToggleChatInFolder(activeFolder.id, u.id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-600/20 border border-indigo-500/40'
                              : 'hover:bg-slate-800/80 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                (u.name?.[0] || '?').toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{u.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">@{u.username}</div>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-600 bg-slate-800'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredGroups.length === 0 && filteredUsers.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500">
                  Чаты или группы не найдены
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex gap-2 pt-3.5 mt-3.5 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {newFolderName.trim()
              ? `Создать папку «${newFolderName.trim()}» и сохранить`
              : 'Сохранить и закрыть'}
          </button>
        </div>
      </div>
    </div>
  );
};
