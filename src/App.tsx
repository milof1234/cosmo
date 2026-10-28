/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ref, set, onValue, remove, onDisconnect } from 'firebase/database';
import { db, auth, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { User, Message, UserActivity, Group, MessageReply, ChatTheme, ChatFolder, PollOption } from './types';
import { VoiceMessagePlayer } from './components/VoiceMessagePlayer';
import { GroupModal } from './components/GroupModal';
import {
  InChatSearch,
  InChatSearchTrigger,
  filterMessagesByText,
  highlightMatchedText
} from './components/InChatSearch';
import {
  ChatThemeModal,
  getChatBubbleStyle,
  getChatBackgroundStyle,
  exportChatHistory
} from './components/ChatThemePicker';
import {
  ChatFoldersModal,
  normalizeUserFolders,
  sanitizeFoldersForStorage,
  getFolderColorConfig,
  useHorizontalScroll
} from './components/ChatFoldersModal';
import {
  VoiceAssistantModal,
  VoiceAssistantCommandResult
} from './components/VoiceAssistantModal';
import {
  PollModal,
  PollCard,
  normalizePollVoterIds
} from './components/PollComponents';
import {
  Rocket,
  Search,
  Settings,
  LogOut,
  Send,
  Mic,
  Eye,
  EyeOff,
  Trash2,
  X,
  VolumeX,
  Volume2,
  Camera,
  MessageSquare,
  ArrowLeft,
  Crown,
  PenLine,
  Sparkles,
  CheckCircle2,
  Square,
  Users,
  Plus,
  Info,
  Radio,
  Play,
  Pause,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Forward,
  Paperclip,
  Pin,
  PinOff,
  Palette,
  FolderPlus,
  BarChart3,
  BarChart2,
  Bookmark,
  Image as ImageIcon
} from 'lucide-react';

const ADMIN_PHONE = '9254699801';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢', '🎉'];

const SENDER_COLORS = [
  'text-indigo-400',
  'text-sky-400',
  'text-emerald-400',
  'text-amber-400',
  'text-rose-400',
  'text-violet-400',
  'text-teal-400',
  'text-cyan-400'
];

function getSenderColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function compressAndResizeImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cleanDigits(str: string): string {
  const digits = (str || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function isAdmin(phone?: string): boolean {
  if (!phone) return false;
  return cleanDigits(phone) === ADMIN_PHONE;
}

function normalizeStr(str?: string): string {
  return (str || '').toString().toLowerCase().replace(/[\s()\-+@]/g, '');
}

const PROFANITY_PATTERNS = [
  /х[уy][йiеeяиюл]/i,
  /п[иi1][зz3][дd]/i,
  /[еeё][бb6][аaоoуyиiеeыэюялтн]/i,
  /[вb][ыy][еeё][бb6]/i,
  /[зz3][аa][еeё][бb6]/i,
  /[уy][еeё][бb6]/i,
  /[дd][оo0][лl][бb6][оo0][еeё][бb6]/i,
  /б[лl][я9]([дdтt]|$|\s|_|-)/i,
  /б[лl][я9][дdтt]/i,
  /с[уy][кk][аaиi]/i,
  /с[уy]ч[кkаa]/i,
  /м[уy][дd][аaоoиi][кkлlзво]/i,
  /г[аaоo0]н[дd][оo0]н/i,
  /п[иi1еe][дd][оo0аa][рp]/i,
  /п[еe][дd][иi1][кk]/i,
  /ш[лl]ю[хxш]/i,
  /ш[аa][лl][аa][вb]/i,
  /з[аa][лl][уy]п/i,
  /м[аa]н[дd][аaыуе]/i,
  /д[рp][оo0]ч/i,
  /г[оo0][вb]н/i,
  /ж[оo0]п[аaыуе]/i,
  /д[еe]б[иi1][лl]/i,
  /д[аa][уy]н/i,
  /м[рp][аa]з[ьот]/i,
  /f+u+c*k+/i,
  /s+h+i+t+/i,
  /b+i+t+c+h+/i,
  /c+u+n+t+/i,
  /d+i+c+k+/i,
  /p+u+s+s+y+/i,
  /a+s+s+h+o+l+e+/i,
  /w+h+o+r+e+/i,
  /s+l+u+t+/i,
  /n+i+g+g+(e+r+|a+)/i,
  /f+a+g+g*o*t*/i
];

export function containsProfanity(input?: string): boolean {
  if (!input) return false;
  const raw = input.toLowerCase().replace(/ё/g, 'е');
  const collapsed = raw.replace(/[\s_\-.,!@#$%^&*()+=[\]{};:'"|\\/<>?~`]+/g, '');
  const leetNormalized = collapsed
    .replace(/0/g, 'о')
    .replace(/3/g, 'з')
    .replace(/4/g, 'ч')
    .replace(/6/g, 'б')
    .replace(/1/g, 'и')
    .replace(/x/g, 'х')
    .replace(/y/g, 'у')
    .replace(/e/g, 'е')
    .replace(/p/g, 'р')
    .replace(/c/g, 'с')
    .replace(/o/g, 'о')
    .replace(/a/g, 'а')
    .replace(/k/g, 'к');

  return PROFANITY_PATTERNS.some(
    (pattern) => pattern.test(raw) || pattern.test(collapsed) || pattern.test(leetNormalized)
  );
}

function formatPhoneMask(inputVal: string): string {
  const digits = inputVal.replace(/\D/g, '');
  const matrix = '+7 (___) ___-__-__';
  let i = 0;
  return matrix.replace(/./g, (a) => {
    if (/[_\d]/.test(a) && i < digits.length) {
      return digits.charAt(i++);
    }
    return i >= digits.length ? '' : a;
  });
}

function formatLastSeen(timestamp?: number, isOnline?: boolean): string {
  if (isOnline) return 'в сети';
  if (!timestamp) return 'был(а) недавно';

  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'был(а) только что';
  if (diffMin < 60) {
    return `был(а) ${diffMin} мин. назад`;
  }
  if (diffHours < 24) {
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `был(а) сегодня в ${time}`;
  }
  const dateStr = new Date(timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `был(а) ${dateStr} в ${timeStr}`;
}

function formatChatTime(timeStr?: string): string {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatDateDivider(timeStr: string): string {
  const date = new Date(timeStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Сегодня';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

const TAB_ID = (() => {
  try {
    const existing = sessionStorage.getItem('cosmo_tab_id');
    if (existing) return existing;
    const next = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem('cosmo_tab_id', next);
    return next;
  } catch {
    return 'tab_default';
  }
})();

function registerActiveTabUser(userId?: string) {
  if (!userId) return;
  try {
    const now = Date.now();
    const raw = JSON.parse(localStorage.getItem('cosmo_active_tabs_map') || '{}');
    const cleaned: Record<string, { userId: string; ts: number }> = {};
    Object.keys(raw).forEach((tId) => {
      if (raw[tId] && now - raw[tId].ts < 12000) {
        cleaned[tId] = raw[tId];
      }
    });
    cleaned[TAB_ID] = { userId, ts: now };
    localStorage.setItem('cosmo_active_tabs_map', JSON.stringify(cleaned));
  } catch {
    // ignore storage errors
  }
}

function isUserTakenByAnotherTab(userId?: string): boolean {
  if (!userId) return false;
  try {
    const now = Date.now();
    const raw = JSON.parse(localStorage.getItem('cosmo_active_tabs_map') || '{}');
    return Object.keys(raw).some(
      (tId) => tId !== TAB_ID && raw[tId] && raw[tId].userId === userId && now - raw[tId].ts < 12000
    );
  } catch {
    return false;
  }
}

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const tabSaved = sessionStorage.getItem('cosmo_tab_user');
      if (tabSaved) return JSON.parse(tabSaved);
      const saved = localStorage.getItem('cosmo_currentUser');
      if (saved) {
        sessionStorage.setItem('cosmo_tab_user', saved);
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [allUsersMap, setAllUsersMap] = useState<Record<string, User>>({});
  const [allGroupsMap, setAllGroupsMap] = useState<Record<string, Group>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean; lastSeen: number }>>({});
  const [rawMessagesList, setRawMessagesList] = useState<Message[]>([]);
  const [dbResetAt, setDbResetAt] = useState<number>(0);
  const [activitiesMap, setActivitiesMap] = useState<Record<string, UserActivity>>({});

  const allMessagesList = useMemo(() => {
    if (!dbResetAt) return rawMessagesList;
    return rawMessagesList.filter((m) => {
      if (!m?.time) return false;
      return new Date(m.time).getTime() > dbResetAt;
    });
  }, [rawMessagesList, dbResetAt]);

  // Active Chat: either a user or a group
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Sidebar Filter Tab: 'all' | 'direct' | 'groups'
  const [sidebarTab, setSidebarTab] = useState<'all' | 'direct' | 'groups'>('all');

  // Search & Filter
  const [globalSearch, setGlobalSearch] = useState('');
  const [inChatSearch, setInChatSearch] = useState('');
  const [isInChatSearchOpen, setIsInChatSearchOpen] = useState(false);

  // Copy feedback state
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Local simulated activity for instant testing with 100% guarantee
  const [simulatedActivity, setSimulatedActivity] = useState<{
    targetId: string;
    userId: string;
    userName: string;
    status: 'typing' | 'recording';
    expiresAt: number;
  } | null>(null);

  // Group Modal, Chat Theme Modal, Chat Folders Modal & Voice Assistant states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'info'>('create');
  const [isChatThemeModalOpen, setIsChatThemeModalOpen] = useState(false);
  const [chatThemeModalTab, setChatThemeModalTab] = useState<'settings' | 'analytics'>('settings');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [savedToastMsgId, setSavedToastMsgId] = useState<string | null>(null);
  const [globalVoiceTheme, setGlobalVoiceTheme] = useState<ChatTheme | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isFoldersModalOpen, setIsFoldersModalOpen] = useState(false);
  const [foldersModalInitialId, setFoldersModalInitialId] = useState<string | null>(null);
  const [foldersModalInitialCreateMode, setFoldersModalInitialCreateMode] = useState(false);
  const [localFoldersMap, setLocalFoldersMap] = useState<Record<string, ChatFolder[]>>({});
  const [quickAssignChat, setQuickAssignChat] = useState<{
    id: string;
    name: string;
    isGroup: boolean;
  } | null>(null);

  // Auth Modal States
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authName, setAuthName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // Profile Modal States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editCustomStatus, setEditCustomStatus] = useState('');
  const [editAudioStatusUrl, setEditAudioStatusUrl] = useState<string>('');
  const [editReadReceipts, setEditReadReceipts] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string>('');
  const [profileError, setProfileError] = useState('');
  const [isRecordingAudioStatus, setIsRecordingAudioStatus] = useState(false);
  const [audioStatusRecordSeconds, setAudioStatusRecordSeconds] = useState(0);

  // Chat Input & Voice
  const [textMessage, setTextMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isMyTypingActive, setIsMyTypingActive] = useState(false);

  // Reply, Forward, Image & Lightbox states
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [forwardTargetMsg, setForwardTargetMsg] = useState<Message | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Pinned messages map (chatKey or groupId -> { messageId, text, senderName, pinnedAt })
  const [pinnedMessagesMap, setPinnedMessagesMap] = useState<
    Record<string, { messageId: string; text: string; senderName: string; pinnedAt: number }>
  >({});

  // Per-chat settings map (chatKey or groupId -> ChatTheme including wallpaper)
  const [chatSettingsMap, setChatSettingsMap] = useState<Record<string, ChatTheme>>({});

  // Test simulation menu & auto reply
  const [showTestMenu, setShowTestMenu] = useState(false);
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState(false);

  // Audio bio player in header
  const [playingBioUserId, setPlayingBioUserId] = useState<string | null>(null);
  const bioAudioRef = useRef<HTMLAudioElement | null>(null);
  const sidebarFoldersScroll = useHorizontalScroll();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);
  const recordHeartbeatRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const typingHeartbeatRef = useRef<any>(null);
  const audioStatusRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStatusChunksRef = useRef<Blob[]>([]);
  const audioStatusTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to safely extract group member IDs whether stored as array or Firebase object map
  const getGroupMembers = (grp?: Group | null): string[] => {
    if (!grp || !grp.memberIds) return [];
    if (Array.isArray(grp.memberIds)) return grp.memberIds.filter(Boolean);
    if (typeof grp.memberIds === 'object') {
      return Object.values(grp.memberIds as Record<string, string>).filter(Boolean);
    }
    return [];
  };

  // Helpers for message readBy status
  const isUserReadReceiptsEnabled = useCallback((user?: User | null): boolean => {
    if (!user) return true;
    return user.settings?.readReceipts !== false;
  }, []);

  const getReadByList = useCallback((msg?: Message | null): string[] => {
    if (!msg || !msg.readBy) return [];
    if (Array.isArray(msg.readBy)) return msg.readBy.filter(Boolean);
    if (typeof msg.readBy === 'object') {
      return Object.keys(msg.readBy).filter((k) => Boolean((msg.readBy as Record<string, boolean>)[k]));
    }
    return [];
  }, []);

  const isMessageRead = useCallback(
    (msg?: Message | null): boolean => {
      if (!msg) return false;
      const readers = getReadByList(msg).filter(
        (uid) => uid !== msg.senderId && isUserReadReceiptsEnabled(allUsersMap[uid])
      );
      return readers.length > 0;
    },
    [getReadByList, allUsersMap, isUserReadReceiptsEnabled]
  );

  // Get detailed read status for each participant of a group message
  const getGroupMessageReadStatus = useCallback(
    (msg: Message, grp: Group) => {
      const groupMembers = getGroupMembers(grp);
      const rawReaders = Array.from(
        new Set(getReadByList(msg).filter((uid) => Boolean(uid) && uid !== msg.senderId))
      );
      const recipientIds = Array.from(
        new Set([
          ...groupMembers.filter((uid) => Boolean(uid) && uid !== msg.senderId),
          ...rawReaders
        ])
      );

      const participants = recipientIds.map((uid) => {
        const usr = allUsersMap[uid];
        const isCurrent = currentUser?.id === uid;
        const baseName = usr?.name || (isCurrent ? currentUser?.name || 'Вы' : 'Участник');
        const displayName = isCurrent ? `${baseName} (Вы)` : baseName;
        const readReceiptsEnabled = isUserReadReceiptsEnabled(
          isCurrent ? allUsersMap[uid] || currentUser : usr
        );
        const hasRead = readReceiptsEnabled && rawReaders.includes(uid);
        return {
          id: uid,
          name: baseName,
          displayName,
          avatar: usr?.avatar,
          hasRead,
          readReceiptsEnabled
        };
      });

      const readParticipants = participants.filter((p) => p.hasRead);
      const unreadParticipants = participants.filter((p) => !p.hasRead);
      const visibleReceiptParticipants = participants.filter((p) => p.readReceiptsEnabled);

      return {
        participants,
        readParticipants,
        unreadParticipants,
        visibleReceiptParticipants,
        allRead:
          visibleReceiptParticipants.length > 0 &&
          readParticipants.length === visibleReceiptParticipants.length
      };
    },
    [getReadByList, allUsersMap, currentUser, isUserReadReceiptsEnabled]
  );

  // Helper to check if a message belongs to the current user
  const isMyMessage = useCallback(
    (msg?: Message | null): boolean => {
      if (!currentUser || !msg) return false;
      const myId = String(currentUser.id || '').trim();
      const msgSenderId = String(msg.senderId || '').trim();
      if (myId && msgSenderId) {
        if (myId === msgSenderId) return true;
        if (allUsersMap[msgSenderId] && allUsersMap[myId]) return false;
      }
      const myPhone = cleanDigits(currentUser.phone || '');
      const msgPhone = cleanDigits(msg.senderPhone || '');
      if (myPhone && msgPhone && myPhone === msgPhone) {
        return true;
      }
      const sender = allUsersMap[msgSenderId];
      if (sender && myPhone && cleanDigits(sender.phone) === myPhone) {
        return true;
      }
      if (!activeGroupId && activeChatUserId && activeChatUserId !== myId) {
        if (msg.receiverId === activeChatUserId && msgSenderId !== activeChatUserId) {
          return true;
        }
      }
      return false;
    },
    [currentUser, allUsersMap, activeGroupId, activeChatUserId]
  );

  // Sync users, groups, messages, activities, pinned, and presence from Firebase Realtime Database
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const raw = (snapshot.val() as Record<string, any>) || {};
      const resetTime = raw.__reset__ && raw.__reset__.resetAt ? Number(raw.__reset__.resetAt) || 0 : 0;
      if (resetTime) {
        setDbResetAt(resetTime);
      }
      if (raw.__groups__ && typeof raw.__groups__ === 'object') {
        const validGroups: Record<string, Group> = {};
        Object.keys(raw.__groups__).forEach((gk) => {
          const g = raw.__groups__[gk];
          const gTime = g && (g.createdAt || Number(String(g.id || gk).replace('grp_', '')));
          if (g && g.id && g.name && (!resetTime || !gTime || gTime > resetTime)) {
            validGroups[gk] = g as Group;
          }
        });
        setAllGroupsMap(validGroups);
      } else {
        setAllGroupsMap({});
      }
      if (raw.__pinned__ && typeof raw.__pinned__ === 'object') {
        setPinnedMessagesMap(raw.__pinned__);
      } else {
        setPinnedMessagesMap({});
      }
      if (raw.__chat_settings__ && typeof raw.__chat_settings__ === 'object') {
        setChatSettingsMap(raw.__chat_settings__);
      } else {
        setChatSettingsMap({});
      }
      if (raw.__folders__ && typeof raw.__folders__ === 'object') {
        setLocalFoldersMap((prev) => {
          const next = { ...prev };
          Object.keys(raw.__folders__).forEach((uid) => {
            if (!next[uid] && raw.__folders__[uid]) {
              next[uid] = normalizeUserFolders(raw.__folders__[uid]);
            }
          });
          return next;
        });
      }

      const data: Record<string, User> = {};
      Object.keys(raw).forEach((k) => {
        const u = raw[k];
        const uTime = u && Number(String(u.id || k).replace('usr_', ''));
        if (
          !k.startsWith('__') &&
          u &&
          typeof u === 'object' &&
          u.id &&
          u.name &&
          u.phone &&
          (!resetTime || !uTime || uTime > resetTime)
        ) {
          data[k] = u as User;
        }
      });
      setAllUsersMap(data);

      if (currentUser) {
        const freshUser = data[currentUser.id];
        if (freshUser) {
          setCurrentUser(freshUser);
          sessionStorage.setItem('cosmo_tab_user', JSON.stringify(freshUser));
        } else if (Object.keys(data).length === 0 || (raw.__reset__ && !data[currentUser.id])) {
          sessionStorage.removeItem('cosmo_tab_user');
          sessionStorage.removeItem('cosmo_explicit_login');
          localStorage.removeItem('cosmo_currentUser');
          setCurrentUser(null);
          setActiveChatUserId(null);
          setActiveGroupId(null);
        }
      }
    });

    const messagesRef = ref(db, 'messages');
    const unsubMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.values(data) as Message[];
      list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      setRawMessagesList(list);
    });

    const activitiesRef = ref(db, 'activities');
    const unsubActivities = onValue(activitiesRef, (snapshot) => {
      const data = (snapshot.val() as Record<string, UserActivity>) || {};
      setActivitiesMap(data);
    });

    const presenceRef = ref(db, 'status');
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const data = (snapshot.val() as Record<string, { isOnline: boolean; lastSeen: number }>) || {};
      setPresenceMap(data);
    });

    const pinnedRef = ref(db, 'users/__pinned__');
    const unsubPinned = onValue(pinnedRef, (snapshot) => {
      const data = (snapshot.val() as Record<string, any>) || {};
      setPinnedMessagesMap(data);
    });

    return () => {
      unsubUsers();
      unsubMessages();
      unsubActivities();
      unsubPresence();
      unsubPinned();
    };
  }, [currentUser?.id]);

  // Handle Online Presence via Firebase .info/connected
  useEffect(() => {
    if (!currentUser) return;

    const userOnlineRef = ref(db, `users/${currentUser.id}/isOnline`);
    const userLastSeenRef = ref(db, `users/${currentUser.id}/lastSeen`);
    const userActivityRef = ref(db, `users/${currentUser.id}/activity`);
    const statusRef = ref(db, `status/${currentUser.id}`);
    const connectedRef = ref(db, '.info/connected');

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(userOnlineRef).set(false);
        onDisconnect(userLastSeenRef).set(Date.now());
        onDisconnect(userActivityRef).set({ status: 'idle', updatedAt: Date.now() });
        onDisconnect(statusRef).set({ isOnline: false, lastSeen: Date.now() });

        set(userOnlineRef, true);
        set(userLastSeenRef, Date.now());
        set(statusRef, { isOnline: true, lastSeen: Date.now() });
      }
    });

    const heartbeat = setInterval(() => {
      registerActiveTabUser(currentUser.id);
      set(userOnlineRef, true);
      set(userLastSeenRef, Date.now());
      set(statusRef, { isOnline: true, lastSeen: Date.now() });
    }, 5000);

    return () => {
      unsubConnected();
      clearInterval(heartbeat);
      set(userOnlineRef, false);
      set(userLastSeenRef, Date.now());
      set(statusRef, { isOnline: false, lastSeen: Date.now() });
    };
  }, [currentUser?.id]);

  // Scroll to bottom on message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessagesList, activeChatUserId, activeGroupId]);

  // Cleanup simulation timer
  useEffect(() => {
    if (!simulatedActivity) return;
    const remaining = simulatedActivity.expiresAt - Date.now();
    if (remaining <= 0) {
      setSimulatedActivity(null);
      return;
    }
    const timer = setTimeout(() => {
      setSimulatedActivity(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [simulatedActivity]);

  const activePartner = useMemo(() => {
    if (!activeChatUserId) return null;
    if (currentUser && activeChatUserId === currentUser.id) {
      return allUsersMap[activeChatUserId] || currentUser;
    }
    return allUsersMap[activeChatUserId] || null;
  }, [activeChatUserId, allUsersMap, currentUser]);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return allGroupsMap[activeGroupId] || null;
  }, [activeGroupId, allGroupsMap]);

  // Map of last messages for each chat (groups and direct dialogs)
  const lastMessagesMap = useMemo(() => {
    const map: Record<string, Message> = {};
    if (!currentUser) return map;
    for (const msg of allMessagesList) {
      if (msg.groupId) {
        map[msg.groupId] = msg;
      } else if (msg.senderId && msg.receiverId) {
        const otherId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
        map[otherId] = msg;
      }
    }
    return map;
  }, [allMessagesList, currentUser?.id]);

  const copyMessageText = (msgId: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const handleDeleteMessage = async (msgId: string) => {
    setRawMessagesList((prev) => prev.filter((m) => m.id !== msgId));
    await remove(ref(db, `messages/${msgId}`)).catch(() => {});
  };

  const handleStartEditMessage = (msg: Message) => {
    if (msg.type !== 'text') return;
    setEditingMessage(msg);
    setReplyTarget(null);
    setTextMessage(msg.text || '');
  };

  const handleSaveToBookmarks = async (msg: Message) => {
    if (!currentUser) return;
    const originalSenderName =
      msg.forwardedFrom?.senderName ||
      (msg.senderId === currentUser.id
        ? currentUser.name
        : allUsersMap[msg.senderId]?.name || msg.senderName || 'Пользователь');

    const msgId = 'msg_' + Date.now();
    const savedMsg: Message = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name || '',
      senderPhone: cleanDigits(currentUser.phone || ''),
      receiverId: currentUser.id,
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: msg.type,
      ...(msg.text !== undefined ? { text: msg.text } : {}),
      ...(msg.imageUrl !== undefined ? { imageUrl: msg.imageUrl } : {}),
      ...(msg.audioUrl !== undefined ? { audioUrl: msg.audioUrl } : {}),
      ...(msg.duration !== undefined ? { duration: msg.duration } : {}),
      ...(msg.poll !== undefined ? { poll: msg.poll } : {}),
      forwardedFrom: {
        senderId: msg.forwardedFrom?.senderId || msg.senderId,
        senderName: originalSenderName
      }
    };

    setRawMessagesList((prev) => [...prev, savedMsg]);
    await set(ref(db, 'messages/' + msgId), savedMsg).catch(() => {});
    setSavedToastMsgId(msg.id);
    setTimeout(() => setSavedToastMsgId(null), 1600);
  };

  const handleVotePoll = async (msg: Message, optionId: string) => {
    if (!currentUser || !msg.poll) return;
    const currentOptions: PollOption[] = Array.isArray(msg.poll.options)
      ? msg.poll.options
      : (Object.values(msg.poll.options || {}) as PollOption[]);

    const updatedOptions: PollOption[] = currentOptions.map((opt) => {
      const voters = normalizePollVoterIds(opt.voterIds);
      const hasVoted = voters.includes(currentUser.id);

      if (opt.id === optionId) {
        const nextVoters = hasVoted
          ? voters.filter((uid) => uid !== currentUser.id)
          : [...voters, currentUser.id];
        return { ...opt, voterIds: nextVoters };
      } else if (!msg.poll?.allowMultiple) {
        return { ...opt, voterIds: voters.filter((uid) => uid !== currentUser.id) };
      }
      return { ...opt, voterIds: voters };
    });

    const updatedPoll = {
      ...msg.poll,
      options: updatedOptions
    };

    setRawMessagesList((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, poll: updatedPoll } : m))
    );
    await set(ref(db, `messages/${msg.id}/poll`), updatedPoll).catch(() => {});
  };

  // Extract normalized reactions for a message
  const getMessageReactions = useCallback(
    (msg?: Message | null) => {
      if (!msg || !msg.reactions || typeof msg.reactions !== 'object') return [];
      const result: {
        emoji: string;
        userIds: string[];
        count: number;
        reactedByMe: boolean;
        userNames: string[];
      }[] = [];

      for (const [emoji, rawUsers] of Object.entries(msg.reactions)) {
        let uids: string[] = [];
        if (Array.isArray(rawUsers)) {
          uids = rawUsers.filter(Boolean);
        } else if (rawUsers && typeof rawUsers === 'object') {
          uids = Object.keys(rawUsers).filter((k) => Boolean((rawUsers as Record<string, boolean>)[k]));
        }
        const uniqueIds = Array.from(new Set(uids));
        if (uniqueIds.length === 0) continue;

        const userNames = uniqueIds.map((uid) => {
          if (currentUser && uid === currentUser.id) return 'Вы';
          return allUsersMap[uid]?.name || 'Участник';
        });

        result.push({
          emoji,
          userIds: uniqueIds,
          count: uniqueIds.length,
          reactedByMe: Boolean(currentUser && uniqueIds.includes(currentUser.id)),
          userNames
        });
      }

      return result;
    },
    [allUsersMap, currentUser]
  );

  // Toggle an emoji reaction on a message for the current user
  const handleToggleReaction = async (msg: Message, emoji: string) => {
    if (!currentUser) return;
    const rawForEmoji = msg.reactions?.[emoji];
    let currentUids: string[] = [];
    if (Array.isArray(rawForEmoji)) {
      currentUids = rawForEmoji.filter(Boolean);
    } else if (rawForEmoji && typeof rawForEmoji === 'object') {
      currentUids = Object.keys(rawForEmoji).filter((k) => Boolean((rawForEmoji as Record<string, boolean>)[k]));
    }

    const uniqueIds = Array.from(new Set(currentUids));
    const hasReacted = uniqueIds.includes(currentUser.id);
    const updatedUids = hasReacted
      ? uniqueIds.filter((uid) => uid !== currentUser.id)
      : [...uniqueIds, currentUser.id];

    const reactionRef = ref(db, `messages/${msg.id}/reactions/${emoji}`);
    setRawMessagesList((prev) =>
      prev.map((m) => {
        if (m.id !== msg.id) return m;
        const nextReactions = { ...(m.reactions || {}) };
        if (updatedUids.length === 0) {
          delete nextReactions[emoji];
        } else {
          nextReactions[emoji] = updatedUids;
        }
        return { ...m, reactions: nextReactions };
      })
    );
    if (updatedUids.length === 0) {
      await remove(reactionRef).catch(() => {});
    } else {
      await set(reactionRef, updatedUids).catch(() => {});
    }
  };

  const handleSaveVoiceSummary = async (messageId: string, summary: string) => {
    if (!messageId || !summary) return;
    setRawMessagesList((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, summary } : m))
    );
    await set(ref(db, `messages/${messageId}/summary`), summary).catch(() => {});
  };

  const handleForwardMessage = async (target: { type: 'user' | 'group'; id: string }) => {
    if (!currentUser || !forwardTargetMsg) return;

    if (currentUser.isMuted) {
      alert('Вы замучены администратором и не можете отправлять сообщения.');
      return;
    }

    const originalSenderName =
      forwardTargetMsg.forwardedFrom?.senderName ||
      (forwardTargetMsg.senderId === currentUser.id
        ? currentUser.name
        : allUsersMap[forwardTargetMsg.senderId]?.name || forwardTargetMsg.senderName || 'Пользователь');

    const msgId = 'msg_' + Date.now();
    const newMsg: Message = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name || '',
      senderPhone: cleanDigits(currentUser.phone || ''),
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: forwardTargetMsg.type,
      forwardedFrom: {
        senderId: forwardTargetMsg.forwardedFrom?.senderId || forwardTargetMsg.senderId,
        senderName: originalSenderName
      }
    };

    if (forwardTargetMsg.text !== undefined) {
      newMsg.text = forwardTargetMsg.text;
    }
    if (forwardTargetMsg.imageUrl !== undefined) {
      newMsg.imageUrl = forwardTargetMsg.imageUrl;
    }
    if (forwardTargetMsg.audioUrl !== undefined) {
      newMsg.audioUrl = forwardTargetMsg.audioUrl;
    }
    if (forwardTargetMsg.duration !== undefined) {
      newMsg.duration = forwardTargetMsg.duration;
    }
    if (forwardTargetMsg.poll !== undefined) {
      newMsg.poll = forwardTargetMsg.poll;
    }

    if (target.type === 'group') {
      newMsg.groupId = target.id;
    } else {
      newMsg.receiverId = target.id;
    }

    setRawMessagesList((prev) => [...prev.filter((m) => m.id !== msgId), newMsg]);
    await set(ref(db, 'messages/' + msgId), newMsg).catch(() => {});

    setForwardTargetMsg(null);
    setForwardSearchQuery('');
    setInChatSearch('');

    if (target.type === 'group') {
      setActiveChatUserId(null);
      setActiveGroupId(target.id);
    } else {
      setActiveGroupId(null);
      setActiveChatUserId(target.id);
    }
  };

  // Broadcast current user's activity (typing, recording, idle)
  const updateMyActivity = useCallback(
    (status: 'typing' | 'recording' | 'idle') => {
      if (!currentUser) return;
      const target = activeGroupId || activeChatUserId;
      if (!target) return;

      const activityData: UserActivity = {
        targetId: target,
        status,
        updatedAt: Date.now(),
        userName: currentUser.name
      };

      // Save inside user node and activities node
      set(ref(db, `users/${currentUser.id}/activity`), activityData).catch(() => {});
      set(ref(db, `activities/${currentUser.id}`), activityData).catch(() => {});
    },
    [currentUser, activeChatUserId, activeGroupId]
  );

  // Get effective activity for a specific user (handles real & simulated)
  const getUserLiveActivity = useCallback(
    (userId: string): (Omit<UserActivity, 'status'> & { status: 'typing' | 'recording' }) | null => {
      // Check simulation first
      if (simulatedActivity && simulatedActivity.userId === userId && Date.now() < simulatedActivity.expiresAt) {
        return {
          targetId: simulatedActivity.targetId,
          status: simulatedActivity.status,
          updatedAt: Date.now(),
          userName: simulatedActivity.userName
        };
      }

      // Check both activitiesMap and user.activity, picking the most recent
      const act1 = activitiesMap[userId];
      const act2 = allUsersMap[userId]?.activity;

      let candidate: UserActivity | null = null;
      if (act1 && act2) {
        candidate = (act1.updatedAt || 0) >= (act2.updatedAt || 0) ? act1 : act2;
      } else {
        candidate = act1 || act2 || null;
      }

      if (!candidate) return null;
      if (candidate.status !== 'typing' && candidate.status !== 'recording') return null;

      // 45 seconds tolerance for clock skew
      if (candidate.updatedAt && Math.abs(Date.now() - candidate.updatedAt) > 45000) {
        return null;
      }

      return {
        ...candidate,
        status: candidate.status as 'typing' | 'recording'
      };
    },
    [simulatedActivity, activitiesMap, allUsersMap]
  );

  // Partner activity for active direct chat
  const partnerActivity = useMemo<'typing' | 'recording' | null>(() => {
    if (!activePartner || !currentUser) return null;
    const act = getUserLiveActivity(activePartner.id);
    if (!act) return null;

    // Must be aimed at current user (or no target in simulation)
    if (act.targetId && act.targetId !== currentUser.id) return null;

    return act.status;
  }, [activePartner, currentUser, getUserLiveActivity]);

  // Group activity: check if any member of the active group is typing or recording
  const activeGroupActivity = useMemo<{ status: 'typing' | 'recording'; userName: string } | null>(() => {
    if (!activeGroup || !currentUser) return null;

    // Check simulation in group
    if (simulatedActivity && simulatedActivity.targetId === activeGroup.id && Date.now() < simulatedActivity.expiresAt) {
      return {
        status: simulatedActivity.status,
        userName: simulatedActivity.userName
      };
    }

    // Check all members in group
    for (const mId of getGroupMembers(activeGroup)) {
      if (mId === currentUser.id) continue;
      const act = getUserLiveActivity(mId);
      if (act && act.targetId === activeGroup.id) {
        const memberUser = allUsersMap[mId];
        const name = act.userName || memberUser?.name || 'Участник';
        return { status: act.status, userName: name };
      }
    }

    return null;
  }, [activeGroup, currentUser, simulatedActivity, getUserLiveActivity, allUsersMap]);

  // Online check
  const isPartnerOnline = Boolean(
    activePartner?.isOnline || presenceMap[activePartner?.id || '']?.isOnline
  );
  const partnerLastSeen =
    activePartner?.lastSeen || presenceMap[activePartner?.id || '']?.lastSeen;

  // User's Custom Chat Folders (Work, Friends, Archived, and custom folders)
  const userChatFolders = useMemo<ChatFolder[]>(() => {
    if (!currentUser) return normalizeUserFolders();
    if (localFoldersMap[currentUser.id] && localFoldersMap[currentUser.id].length > 0) {
      return normalizeUserFolders(localFoldersMap[currentUser.id]);
    }
    try {
      const savedLocal = localStorage.getItem(`cosmo_folders_${currentUser.id}`);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeUserFolders(parsed);
        }
      }
    } catch {
      // ignore parse error
    }
    const latestMe = allUsersMap[currentUser.id] || currentUser;
    const remoteFolders =
      latestMe?.settings?.chatFolders || currentUser?.settings?.chatFolders;
    if (remoteFolders) {
      return normalizeUserFolders(remoteFolders);
    }
    return normalizeUserFolders();
  }, [currentUser, allUsersMap, localFoldersMap]);

  const activeFolderObj = useMemo<ChatFolder | null>(() => {
    if (!activeFolderId) return null;
    return userChatFolders.find((f) => f.id === activeFolderId) || null;
  }, [activeFolderId, userChatFolders]);

  const archivedChatIdsSet = useMemo(() => {
    const archFolder = userChatFolders.find((f) => f.isArchivedFolder || f.id === 'archived');
    return new Set(archFolder ? archFolder.chatIds : []);
  }, [userChatFolders]);

  const getFoldersForChat = useCallback(
    (chatId: string): ChatFolder[] => {
      return userChatFolders.filter((f) => f.chatIds.includes(chatId));
    },
    [userChatFolders]
  );

  // Sidebar list of direct chat users
  const sidebarDirectUsers = useMemo(() => {
    const users = Object.values(allUsersMap);
    const cleanQ = normalizeStr(globalSearch);

    // If a custom folder is active, filter to users inside that folder
    if (activeFolderObj) {
      const folderSet = new Set(activeFolderObj.chatIds);
      return users.filter((u) => {
        if (!currentUser || u.id === currentUser.id) return false;
        if (!folderSet.has(u.id)) return false;
        if (!cleanQ) return true;
        return (
          normalizeStr(u.name).includes(cleanQ) ||
          normalizeStr(u.username).includes(cleanQ) ||
          normalizeStr(u.phone).includes(cleanQ)
        );
      });
    }

    if (cleanQ) {
      return users.filter((u) => {
        if (currentUser && u.id === currentUser.id) return false;
        return (
          normalizeStr(u.name).includes(cleanQ) ||
          normalizeStr(u.username).includes(cleanQ) ||
          normalizeStr(u.phone).includes(cleanQ)
        );
      });
    }

    if (!currentUser) return [];

    // Dialogs based on message history
    const partnerIds = new Set<string>();
    allMessagesList.forEach((m) => {
      if (!m.groupId) {
        if (m.senderId === currentUser.id && m.receiverId) partnerIds.add(m.receiverId);
        if (m.receiverId === currentUser.id) partnerIds.add(m.senderId);
      }
    });

    const activeChats = users.filter(
      (u) => partnerIds.has(u.id) && u.id !== currentUser.id && !archivedChatIdsSet.has(u.id)
    );

    // If user has no previous chats yet, display all other registered users so they can start chatting immediately
    if (activeChats.length === 0) {
      return users.filter((u) => u.id !== currentUser.id && !archivedChatIdsSet.has(u.id));
    }

    return activeChats;
  }, [allUsersMap, globalSearch, currentUser, allMessagesList, activeFolderObj, archivedChatIdsSet]);

  // Sidebar list of groups
  const sidebarGroups = useMemo(() => {
    if (!currentUser) return [];
    const groups = Object.values(allGroupsMap);
    const cleanQ = normalizeStr(globalSearch);

    const userGroups = groups.filter((g) => getGroupMembers(g).includes(currentUser.id));

    if (activeFolderObj) {
      const folderSet = new Set(activeFolderObj.chatIds);
      return userGroups.filter((g) => {
        if (!folderSet.has(g.id)) return false;
        if (!cleanQ) return true;
        return (
          normalizeStr(g.name).includes(cleanQ) || normalizeStr(g.description).includes(cleanQ)
        );
      });
    }

    if (cleanQ) {
      return userGroups.filter((g) =>
        normalizeStr(g.name).includes(cleanQ) || normalizeStr(g.description).includes(cleanQ)
      );
    }

    return userGroups.filter((g) => !archivedChatIdsSet.has(g.id));
  }, [allGroupsMap, currentUser, globalSearch, activeFolderObj, archivedChatIdsSet]);

  // Unfiltered messages for the active chat
  const rawActiveChatMessages = useMemo(() => {
    if (!currentUser) return [];

    if (activeGroupId) {
      return allMessagesList.filter((m) => m.groupId === activeGroupId);
    }
    if (activeChatUserId) {
      return allMessagesList.filter((m) => {
        if (m.groupId) return false;
        const fromMeToPartner = isMyMessage(m) && m.receiverId === activeChatUserId;
        const fromPartnerToMe =
          m.senderId === activeChatUserId && (m.receiverId === currentUser.id || !isMyMessage(m));
        return fromMeToPartner || fromPartnerToMe;
      });
    }

    return [];
  }, [allMessagesList, currentUser, activeChatUserId, activeGroupId]);

  // Active chat messages (Direct or Group) filtered by InChatSearch
  const activeChatMessages = useMemo(() => {
    return filterMessagesByText(rawActiveChatMessages, inChatSearch);
  }, [rawActiveChatMessages, inChatSearch]);

  // Mark messages in the active chat as read by currentUser (only if readReceipts is enabled)
  useEffect(() => {
    if (!currentUser || (!activeChatUserId && !activeGroupId)) return;
    const myLatestUser = allUsersMap[currentUser.id] || currentUser;
    if (!isUserReadReceiptsEnabled(myLatestUser) || !isUserReadReceiptsEnabled(currentUser)) {
      return;
    }
    activeChatMessages.forEach((msg) => {
      if (!isMyMessage(msg)) {
        const currentReaders = getReadByList(msg);
        if (!currentReaders.includes(currentUser.id)) {
          const updatedReadBy = Array.from(new Set([...currentReaders, currentUser.id]));
          set(ref(db, `messages/${msg.id}/readBy`), updatedReadBy).catch(() => {});
        }
      }
    });
  }, [
    activeChatMessages,
    currentUser,
    allUsersMap,
    activeChatUserId,
    activeGroupId,
    isMyMessage,
    getReadByList,
    isUserReadReceiptsEnabled
  ]);

  // Stop simulated partner activity
  const stopSimulatePartnerActivity = () => {
    setSimulatedActivity(null);
    if (activePartner) {
      const idleData: UserActivity = { status: 'idle', updatedAt: Date.now() };
      set(ref(db, `users/${activePartner.id}/activity`), idleData).catch(() => {});
      set(ref(db, `activities/${activePartner.id}`), idleData).catch(() => {});
    }
  };

  // Instant simulation tools for 1-click testing of audio and typing status
  const simulatePartnerActivity = (type: 'typing' | 'recording') => {
    if (!currentUser) return;

    if (activeGroupId && activeGroup) {
      // Find another member to simulate
      const otherMemberId = getGroupMembers(activeGroup).find((id) => id !== currentUser.id);
      const otherUser = otherMemberId ? allUsersMap[otherMemberId] : null;
      const simName = otherUser?.name || 'Астронавт';
      const simId = otherMemberId || 'sim_bot';

      if (simulatedActivity && simulatedActivity.status === type && simulatedActivity.targetId === activeGroup.id) {
        stopSimulatePartnerActivity();
        return;
      }

      setSimulatedActivity({
        targetId: activeGroup.id,
        userId: simId,
        userName: simName,
        status: type,
        expiresAt: Date.now() + 25000
      });
      setShowTestMenu(false);
      return;
    }

    if (!activePartner) return;

    if (partnerActivity === type) {
      stopSimulatePartnerActivity();
      return;
    }

    // Set local immediate state
    setSimulatedActivity({
      targetId: currentUser.id,
      userId: activePartner.id,
      userName: activePartner.name,
      status: type,
      expiresAt: Date.now() + 25000
    });

    const activityData: UserActivity = {
      targetId: currentUser.id,
      status: type,
      updatedAt: Date.now(),
      userName: activePartner.name
    };

    set(ref(db, `users/${activePartner.id}/activity`), activityData).catch(() => {});
    set(ref(db, `activities/${activePartner.id}`), activityData).catch(() => {});
    setShowTestMenu(false);
  };

  const simulatePartnerOnlineToggle = () => {
    if (!activePartner) return;
    const newStatus = !isPartnerOnline;

    set(ref(db, `users/${activePartner.id}/isOnline`), newStatus).catch(() => {});
    set(ref(db, `users/${activePartner.id}/lastSeen`), Date.now()).catch(() => {});
    set(ref(db, `status/${activePartner.id}`), {
      isOnline: newStatus,
      lastSeen: Date.now()
    }).catch(() => {});

    setShowTestMenu(false);
  };

  // Phone input mask handler
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPhoneMask(raw);
    setAuthPhone(formatted);
    setAuthError('');
  };

  // Google / Gmail Auth Handler
  const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const email = firebaseUser.email || '';
      const name = firebaseUser.displayName || email.split('@')[0] || 'Пользователь Gmail';
      const photoURL = firebaseUser.photoURL || '';

      const usersList = Object.values(allUsersMap);
      let existingUser = usersList.find((u) => u.email === email || u.id === `usr_google_${firebaseUser.uid}`);

      if (existingUser) {
        setCurrentUser(existingUser);
        sessionStorage.setItem('cosmo_tab_user', JSON.stringify(existingUser));
        sessionStorage.setItem('cosmo_explicit_login', '1');
        localStorage.setItem('cosmo_currentUser', JSON.stringify(existingUser));
        registerActiveTabUser(existingUser.id);
      } else {
        const userId = `usr_google_${firebaseUser.uid}`;
        const username = 'user_' + Math.floor(Math.random() * 90000 + 10000);
        const newUser: User = {
          id: userId,
          name: name,
          username: username,
          phone: '+7 (999) 000-00-00',
          email: email,
          password: 'google_oauth_secure_auth',
          avatar: photoURL,
          isMuted: false,
          lastProfileChange: 0,
          isOnline: true,
          lastSeen: Date.now()
        };

        await set(ref(db, 'users/' + newUser.id), newUser);
        setCurrentUser(newUser);
        sessionStorage.setItem('cosmo_tab_user', JSON.stringify(newUser));
        sessionStorage.setItem('cosmo_explicit_login', '1');
        localStorage.setItem('cosmo_currentUser', JSON.stringify(newUser));
        registerActiveTabUser(newUser.id);
      }
    } catch (err: any) {
      setAuthError('Ошибка входа через Google / Gmail: ' + err.message);
    }
  };

  // Auth submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = cleanDigits(authPhone);

    if (phoneDigits.length < 10) {
      setAuthError('Введите корректный номер телефона (минимум 10 цифр)');
      return;
    }

    if (!authPassword || authPassword.length < 4) {
      setAuthError('Пароль должен быть не менее 4 символов');
      return;
    }

    const usersList = Object.values(allUsersMap);

    if (isLoginMode) {
      const existing = usersList.find((u) => cleanDigits(u.phone) === phoneDigits);
      if (!existing) {
        setAuthError('Пользователь с таким номером телефона не найден!');
        return;
      }
      if (existing.password !== authPassword) {
        setAuthError('Неверный пароль!');
        return;
      }

      setCurrentUser(existing);
      sessionStorage.setItem('cosmo_tab_user', JSON.stringify(existing));
      sessionStorage.setItem('cosmo_explicit_login', '1');
      localStorage.setItem('cosmo_currentUser', JSON.stringify(existing));
      registerActiveTabUser(existing.id);
      setAuthError('');
    } else {
      if (!authName.trim()) {
        setAuthError('Введите ваше имя для регистрации');
        return;
      }

      if (containsProfanity(authName) || containsProfanity(authUsername)) {
        setAuthError('Ник содержит недопустимые слова');
        return;
      }

      const existingPhone = usersList.find((u) => cleanDigits(u.phone) === phoneDigits);
      if (existingPhone) {
        setAuthError('Пользователь с таким номером уже зарегистрирован! Нажмите «Вход».');
        return;
      }

      let tag = authUsername.trim();
      if (!tag) {
        tag = 'user_' + Math.floor(Math.random() * 90000 + 10000);
      } else {
        const existingTag = usersList.find((u) => normalizeStr(u.username) === normalizeStr(tag));
        if (existingTag) {
          setAuthError('Имя пользователя (@username) уже занято!');
          return;
        }
      }

      const newUser: User = {
        id: 'usr_' + Date.now(),
        name: authName.trim(),
        username: tag,
        phone: authPhone.trim(),
        password: authPassword.trim(),
        avatar: '',
        isMuted: false,
        lastProfileChange: 0,
        isOnline: true,
        lastSeen: Date.now()
      };

      try {
        await set(ref(db, 'users/' + newUser.id), newUser);
        setCurrentUser(newUser);
        sessionStorage.setItem('cosmo_tab_user', JSON.stringify(newUser));
        sessionStorage.setItem('cosmo_explicit_login', '1');
        localStorage.setItem('cosmo_currentUser', JSON.stringify(newUser));
        registerActiveTabUser(newUser.id);
        setAuthError('');
      } catch (err: any) {
        setAuthError('Ошибка сохранения в базе: ' + err.message);
      }
    }
  };

  // Reset Cloud Database
  const handleResetDatabase = async () => {
    if (
      window.confirm(
        'Вы действительно хотите полностью очистить всю базу данных в облаке (все аккаунты, группы и сообщения)?'
      )
    ) {
      try {
        const promises: Promise<any>[] = [
          remove(ref(db, 'users/__groups__')).catch(() => {}),
          remove(ref(db, 'users/__pinned__')).catch(() => {}),
          set(ref(db, 'users/__reset__'), { resetAt: Date.now() }).catch(() => {})
        ];
        Object.keys(allUsersMap).forEach((k) => promises.push(remove(ref(db, `users/${k}`)).catch(() => {})));
        Object.keys(allGroupsMap).forEach((k) =>
          promises.push(remove(ref(db, `users/__groups__/${k}`)).catch(() => {}))
        );
        await Promise.all(promises);
      } catch {
        // ignore errors
      }
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  // Profile Edit
  const openProfileModal = () => {
    if (!currentUser) return;
    const latestMe = allUsersMap[currentUser.id] || currentUser;
    setEditName(latestMe.name || '');
    setEditUsername(latestMe.username || '');
    setEditCustomStatus(latestMe.customStatus || '');
    setEditAudioStatusUrl(latestMe.audioStatusUrl || '');
    setEditReadReceipts(latestMe.settings?.readReceipts !== false);
    setEditPassword('');
    setEditAvatarPreview(latestMe.avatar || '');
    setProfileError('');
    setIsProfileOpen(true);
  };

  const handleToggleReadReceipts = async (nextValue: boolean) => {
    setEditReadReceipts(nextValue);
    if (!currentUser) return;
    const latestMe = allUsersMap[currentUser.id] || currentUser;
    const updatedUser: User = {
      ...latestMe,
      settings: {
        ...(latestMe.settings || {}),
        readReceipts: nextValue
      }
    };
    setCurrentUser(updatedUser);
    sessionStorage.setItem('cosmo_tab_user', JSON.stringify(updatedUser));
    localStorage.setItem('cosmo_currentUser', JSON.stringify(updatedUser));
    await set(ref(db, `users/${currentUser.id}/settings/readReceipts`), nextValue).catch(() => {});
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setEditAvatarPreview(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Record short Voice Status / Audio Bio in Profile
  const startRecordingAudioStatus = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioStatusRecorderRef.current = recorder;
      audioStatusChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioStatusChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecordingAudioStatus(true);
      setAudioStatusRecordSeconds(0);

      audioStatusTimerRef.current = setInterval(() => {
        setAudioStatusRecordSeconds((s) => {
          if (s >= 30) {
            stopRecordingAudioStatus();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      alert('Нет доступа к микрофону для записи аудио-статуса.');
    }
  };

  const stopRecordingAudioStatus = () => {
    if (audioStatusRecorderRef.current && audioStatusRecorderRef.current.state !== 'inactive') {
      audioStatusRecorderRef.current.stop();
      audioStatusRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(audioStatusTimerRef.current);
    setIsRecordingAudioStatus(false);

    if (audioStatusRecorderRef.current) {
      audioStatusRecorderRef.current.onstop = () => {
        const blob = new Blob(audioStatusChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditAudioStatusUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      };
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const isAdm = isAdmin(currentUser.phone);
    const identityChanged =
      editName.trim() !== (currentUser.name || '') ||
      editUsername.trim() !== (currentUser.username || '') ||
      editAvatarPreview !== (currentUser.avatar || '') ||
      Boolean(editPassword.trim());

    if (!isAdm && identityChanged) {
      const now = Date.now();
      const cooldownTime = 24 * 60 * 60 * 1000;
      const lastChange = currentUser.lastProfileChange || 0;
      const timePassed = now - lastChange;

      if (timePassed < cooldownTime) {
        const timeLeft = cooldownTime - timePassed;
        const leftH = Math.floor(timeLeft / (1000 * 60 * 60));
        const leftM = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        setProfileError(`Слишком часто! Изменять данные можно раз в день. Осталось: ${leftH} ч. ${leftM} мин.`);
        return;
      }
    }

    if (editPassword && editPassword.length < 4) {
      setProfileError('Новый пароль должен содержать минимум 4 символа');
      return;
    }

    const usersList = Object.values(allUsersMap);
    const existing = usersList.find(
      (u) => normalizeStr(u.username) === normalizeStr(editUsername) && u.id !== currentUser.id
    );
    if (existing) {
      setProfileError('Имя пользователя (@username) уже занято другим аккаунтом');
      return;
    }

    const updatedUser: User = {
      ...currentUser,
      name: editName.trim(),
      username: editUsername.trim(),
      customStatus: editCustomStatus.trim(),
      audioStatusUrl: editAudioStatusUrl,
      avatar: editAvatarPreview,
      lastProfileChange: identityChanged ? Date.now() : currentUser.lastProfileChange,
      password: editPassword.trim() ? editPassword.trim() : currentUser.password,
      settings: {
        ...(currentUser.settings || {}),
        chatFolders: userChatFolders,
        readReceipts: editReadReceipts
      }
    };

    try {
      await set(ref(db, 'users/' + currentUser.id), updatedUser);
      setCurrentUser(updatedUser);
      sessionStorage.setItem('cosmo_tab_user', JSON.stringify(updatedUser));
      localStorage.setItem('cosmo_currentUser', JSON.stringify(updatedUser));
      setIsProfileOpen(false);
    } catch (err: any) {
      setProfileError('Ошибка сохранения: ' + err.message);
    }
  };

  // Play audio status bio
  const togglePlayAudioBio = (userId: string, audioUrl?: string) => {
    if (!audioUrl) return;

    if (playingBioUserId === userId && bioAudioRef.current) {
      bioAudioRef.current.pause();
      setPlayingBioUserId(null);
      return;
    }

    if (bioAudioRef.current) {
      bioAudioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    bioAudioRef.current = audio;
    setPlayingBioUserId(userId);

    audio.play().catch(() => {
      setPlayingBioUserId(null);
    });

    audio.onended = () => {
      setPlayingBioUserId(null);
    };
  };

  // Admin Mute Toggle
  const toggleMute = async (targetUser: User) => {
    if (!currentUser || !isAdmin(currentUser.phone)) return;
    const updated = {
      ...targetUser,
      isMuted: !targetUser.isMuted
    };
    await set(ref(db, 'users/' + targetUser.id), updated);
  };

  // Group Management Handlers
  const handleCreateGroup = async (
    name: string,
    description: string,
    avatar: string,
    memberIds: string[],
    initialTheme?: ChatTheme
  ) => {
    if (!currentUser) return;
    if (containsProfanity(name) || containsProfanity(description)) {
      throw new Error('Название содержит недопустимые слова');
    }
    const groupId = 'grp_' + Date.now();
    const cleanMembers = Array.from(new Set([currentUser.id, ...(memberIds || [])])).filter(Boolean);
    const newGroup: Group = {
      id: groupId,
      name: name.trim(),
      description: description.trim() || '',
      avatar: avatar || 'indigo',
      creatorId: currentUser.id,
      memberIds: cleanMembers,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(initialTheme
        ? {
            theme: initialTheme,
            wallpaperId: initialTheme.wallpaperId || 'none',
            wallpaperUrl: initialTheme.wallpaperUrl || ''
          }
        : {})
    };

    setAllGroupsMap((prev) => ({ ...prev, [groupId]: newGroup }));
    await set(ref(db, 'users/__groups__/' + groupId), newGroup);

    if (initialTheme) {
      setChatSettingsMap((prev) => ({ ...prev, [groupId]: initialTheme }));
      await set(ref(db, `users/${currentUser.id}/settings/chatThemes/${groupId}`), initialTheme);
      await set(ref(db, `users/__chat_settings__/${groupId}`), initialTheme);
    }

    // Initial system greeting message
    const welcomeMsgId = 'msg_' + Date.now();
    const welcomeMsg: Message = {
      id: welcomeMsgId,
      senderId: currentUser.id,
      groupId: groupId,
      time: new Date().toISOString(),
      type: 'text',
      text: `Группа «${name}» создана!`,
      readBy: [currentUser.id]
    };
    setRawMessagesList((prev) => [...prev, welcomeMsg]);
    await set(ref(db, 'messages/' + welcomeMsgId), welcomeMsg);

    // Select the new group
    setActiveChatUserId(null);
    setActiveGroupId(groupId);
    setSidebarTab('groups');
  };

  const handleDeleteGroup = async (groupId: string) => {
    setAllGroupsMap((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    await remove(ref(db, 'users/__groups__/' + groupId));
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!currentUser) return;
    const group = allGroupsMap[groupId];
    if (!group) return;

    const updatedMembers = getGroupMembers(group).filter((id) => id !== currentUser.id);
    await set(ref(db, `users/__groups__/${groupId}/memberIds`), updatedMembers);

    if (activeGroupId === groupId) {
      setActiveGroupId(null);
    }
  };

  const handleAddMemberToGroup = async (groupId: string, userId: string) => {
    const group = allGroupsMap[groupId];
    if (!group) return;
    const currentMembers = getGroupMembers(group);
    if (currentMembers.includes(userId)) return;

    const updatedMembers = [...currentMembers, userId];
    await set(ref(db, `users/__groups__/${groupId}/memberIds`), updatedMembers);
  };

  const handleRemoveMemberFromGroup = async (groupId: string, userId: string) => {
    const group = allGroupsMap[groupId];
    if (!group) return;

    const updatedMembers = getGroupMembers(group).filter((id) => id !== userId);
    await set(ref(db, `users/__groups__/${groupId}/memberIds`), updatedMembers);
  };

  const handleUpdateGroup = async (groupId: string, data: Partial<Group>) => {
    const group = allGroupsMap[groupId];
    if (!group) return;
    const updatedGroup: Group = {
      ...group,
      ...data,
      ...(data.theme
        ? {
            wallpaperId: data.theme.wallpaperId || 'none',
            wallpaperUrl: data.theme.wallpaperUrl || ''
          }
        : {}),
      updatedAt: Date.now()
    };
    setAllGroupsMap((prev) => ({ ...prev, [groupId]: updatedGroup }));
    await set(ref(db, `users/__groups__/${groupId}`), updatedGroup);

    if (data.theme && currentUser) {
      setChatSettingsMap((prev) => ({ ...prev, [groupId]: data.theme! }));
      await set(ref(db, `users/${currentUser.id}/settings/chatThemes/${groupId}`), data.theme);
      await set(ref(db, `users/__chat_settings__/${groupId}`), data.theme);
    }
  };

  const activeChatTheme = useMemo<ChatTheme | null>(() => {
    if (activeGroup) {
      const baseTheme =
        activeGroup.theme ||
        currentUser?.settings?.chatThemes?.[activeGroup.id] ||
        chatSettingsMap[activeGroup.id] ||
        null;
      if (baseTheme) return baseTheme;
      if (activeGroup.wallpaperUrl || activeGroup.wallpaperId) {
        return {
          wallpaperId: activeGroup.wallpaperId,
          wallpaperUrl: activeGroup.wallpaperUrl
        };
      }
      return null;
    }
    if (activePartner && currentUser) {
      const pairKey = [currentUser.id, activePartner.id].sort().join('_');
      return (
        currentUser.settings?.chatThemes?.[activePartner.id] ||
        chatSettingsMap[pairKey] ||
        globalVoiceTheme ||
        null
      );
    }
    return globalVoiceTheme || null;
  }, [activeGroup, activePartner, currentUser, chatSettingsMap, globalVoiceTheme]);

  const handleSaveActiveChatTheme = async (theme: ChatTheme) => {
    if (!currentUser) return;
    const cleanTheme: ChatTheme = {
      bubbleColorId: theme.bubbleColorId || 'indigo',
      customBubbleHex: theme.customBubbleHex || '#4f46e5',
      bgGradientId: theme.bgGradientId || 'default',
      customBgHexFrom: theme.customBgHexFrom || '#0b1121',
      customBgHexTo: theme.customBgHexTo || '#0b1121',
      wallpaperId: theme.wallpaperId || 'none',
      wallpaperUrl: theme.wallpaperUrl || '',
      wallpaperDimming: typeof theme.wallpaperDimming === 'number' ? theme.wallpaperDimming : 40
    };
    if (activeGroup) {
      await handleUpdateGroup(activeGroup.id, {
        theme: cleanTheme,
        wallpaperId: cleanTheme.wallpaperId || 'none',
        wallpaperUrl: cleanTheme.wallpaperUrl || ''
      });
    } else if (activePartner) {
      const pairKey = [currentUser.id, activePartner.id].sort().join('_');
      const nextSettings = {
        ...(currentUser.settings || {}),
        chatThemes: {
          ...(currentUser.settings?.chatThemes || {}),
          [activePartner.id]: cleanTheme
        }
      };
      const updatedUser: User = {
        ...currentUser,
        settings: nextSettings
      };
      setCurrentUser(updatedUser);
      setChatSettingsMap((prev) => ({ ...prev, [pairKey]: cleanTheme }));
      sessionStorage.setItem('cosmo_tab_user', JSON.stringify(updatedUser));
      localStorage.setItem('cosmo_currentUser', JSON.stringify(updatedUser));
      await set(ref(db, `users/${currentUser.id}/settings/chatThemes/${activePartner.id}`), cleanTheme).catch(() => {});
      await set(ref(db, `users/__chat_settings__/${pairKey}`), cleanTheme).catch(() => {});
    }
  };

  const handleSaveChatFolders = async (nextFolders: ChatFolder[]) => {
    if (!currentUser) return;
    const cleanFolders = sanitizeFoldersForStorage(nextFolders);
    const latestMe = allUsersMap[currentUser.id] || currentUser;
    const updatedSettings = {
      ...(latestMe.settings || {}),
      chatFolders: cleanFolders
    };
    const updatedUser: User = {
      ...latestMe,
      settings: updatedSettings
    };
    setLocalFoldersMap((prev) => ({ ...prev, [currentUser.id]: cleanFolders }));
    setCurrentUser(updatedUser);
    setAllUsersMap((prev) => ({ ...prev, [currentUser.id]: updatedUser }));
    sessionStorage.setItem('cosmo_tab_user', JSON.stringify(updatedUser));
    localStorage.setItem('cosmo_currentUser', JSON.stringify(updatedUser));
    localStorage.setItem(`cosmo_folders_${currentUser.id}`, JSON.stringify(cleanFolders));
    set(ref(db, `users/__folders__/${currentUser.id}`), cleanFolders).catch(() => {});
    set(ref(db, `users/${currentUser.id}/settings/chatFolders`), cleanFolders).catch(() => {});
  };

  const handleExecuteVoiceCommand = async (cmd: VoiceAssistantCommandResult): Promise<string> => {
    if (!currentUser) return 'Пользователь не авторизован';

    const otherUsers = Object.values(allUsersMap).filter((u) => u.id !== currentUser.id);
    const myGroups = Object.values(allGroupsMap).filter((g) =>
      getGroupMembers(g).includes(currentUser.id)
    );

    const resolveTarget = () => {
      if (cmd.targetId) {
        const matchedGroup = myGroups.find((g) => g.id === cmd.targetId);
        if (matchedGroup) return { isGroup: true as const, group: matchedGroup };
        const matchedUser = otherUsers.find((u) => u.id === cmd.targetId);
        if (matchedUser) return { isGroup: false as const, user: matchedUser };
      }

      const q = (cmd.targetName || '').trim().toLowerCase();
      if (q) {
        const stem = q.length > 3 ? q.slice(0, -1) : q;
        const matchedGroup = myGroups.find(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            (stem.length >= 3 && g.name.toLowerCase().includes(stem))
        );
        if (matchedGroup) return { isGroup: true as const, group: matchedGroup };

        const matchedUser = otherUsers.find(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            (u.username && u.username.toLowerCase().includes(q)) ||
            (stem.length >= 3 && u.name.toLowerCase().includes(stem))
        );
        if (matchedUser) return { isGroup: false as const, user: matchedUser };
      }

      if (activeGroup) return { isGroup: true as const, group: activeGroup };
      if (activePartner) return { isGroup: false as const, user: activePartner };
      if (otherUsers[0]) return { isGroup: false as const, user: otherUsers[0] };
      if (myGroups[0]) return { isGroup: true as const, group: myGroups[0] };
      return null;
    };

    if (cmd.action === 'send_message') {
      const target = resolveTarget();
      if (!target) {
        return 'Не найден получатель для отправки сообщения';
      }
      const textToSend = (cmd.messageText || cmd.transcript || 'Привет!').trim();
      const msgId = 'msg_' + Date.now();
      const newMsg: Message = {
        id: msgId,
        senderId: currentUser.id,
        senderName: currentUser.name || '',
        senderPhone: cleanDigits(currentUser.phone || ''),
        time: new Date().toISOString(),
        type: 'text',
        text: textToSend,
        readBy: [currentUser.id],
        ...(target.isGroup
          ? { groupId: target.group.id }
          : { receiverId: target.user.id })
      };

      if (target.isGroup) {
        setActiveChatUserId(null);
        setActiveGroupId(target.group.id);
      } else {
        setActiveGroupId(null);
        setActiveChatUserId(target.user.id);
      }

      setRawMessagesList((prev) => [...prev.filter((m) => m.id !== msgId), newMsg]);
      set(ref(db, 'messages/' + msgId), newMsg).catch(() => {});

      const recipientTitle = target.isGroup ? `группу «${target.group.name}»` : target.user.name;
      return `Отправлено в ${recipientTitle}: «${textToSend}»`;
    }

    if (cmd.action === 'change_theme') {
      const key = (cmd.themePreset || 'dark').toLowerCase();
      let nextTheme: ChatTheme = {
        bubbleColorId: 'slate',
        bgGradientId: 'default',
        wallpaperId: 'none',
        wallpaperUrl: ''
      };
      let themeName = 'Dark (Космическая ночь)';

      if (key.includes('cyber')) {
        nextTheme = {
          bubbleColorId: 'fuchsia',
          bgGradientId: 'cyber',
          wallpaperId: 'cyber_grid',
          wallpaperDimming: 45
        };
        themeName = 'Cyberpunk (Кибер-сетка)';
      } else if (key.includes('matrix') || key.includes('emerald') || key.includes('forest')) {
        nextTheme = {
          bubbleColorId: 'emerald',
          bgGradientId: 'forest',
          wallpaperId: 'matrix_code',
          wallpaperDimming: 50
        };
        themeName = 'Matrix / Изумруд';
      } else if (key.includes('aurora')) {
        nextTheme = {
          bubbleColorId: 'emerald',
          bgGradientId: 'aurora',
          wallpaperId: 'aurora_waves',
          wallpaperDimming: 35
        };
        themeName = 'Aurora (Северное сияние)';
      } else if (key.includes('sunset') || key.includes('amber')) {
        nextTheme = {
          bubbleColorId: 'amber',
          bgGradientId: 'sunset',
          wallpaperId: 'sunset_dunes',
          wallpaperDimming: 40
        };
        themeName = 'Sunset (Марсианский закат)';
      } else if (key.includes('ocean') || key.includes('sky') || key.includes('deep')) {
        nextTheme = {
          bubbleColorId: 'sky',
          bgGradientId: 'deepsea',
          wallpaperId: 'none',
          wallpaperUrl: ''
        };
        themeName = 'Ocean (Глубокий океан)';
      } else if (key.includes('royal') || key.includes('violet')) {
        nextTheme = {
          bubbleColorId: 'violet',
          bgGradientId: 'royal',
          wallpaperId: 'starfield',
          wallpaperDimming: 40
        };
        themeName = 'Royal (Королевский пурпур)';
      } else if (key.includes('rose')) {
        nextTheme = {
          bubbleColorId: 'rose',
          bgGradientId: 'sunset',
          wallpaperId: 'none',
          wallpaperUrl: ''
        };
        themeName = 'Rose (Неоновая роза)';
      } else if (key.includes('indigo')) {
        nextTheme = {
          bubbleColorId: 'indigo',
          bgGradientId: 'nebula',
          wallpaperId: 'starfield',
          wallpaperDimming: 40
        };
        themeName = 'Indigo Nebula';
      }

      setGlobalVoiceTheme(nextTheme);

      if (!activeGroup && !activePartner) {
        if (otherUsers[0]) {
          setActiveChatUserId(otherUsers[0].id);
        } else if (myGroups[0]) {
          setActiveGroupId(myGroups[0].id);
        }
      }

      await handleSaveActiveChatTheme(nextTheme);
      return `Установлена тема оформления: ${themeName}`;
    }

    if (cmd.action === 'open_chat') {
      const target = resolveTarget();
      if (!target) return 'Чат не найден';
      if (target.isGroup) {
        setActiveChatUserId(null);
        setActiveGroupId(target.group.id);
        return `Открыта группа «${target.group.name}»`;
      } else {
        setActiveGroupId(null);
        setActiveChatUserId(target.user.id);
        return `Открыт диалог с ${target.user.name}`;
      }
    }

    if (cmd.action === 'create_folder') {
      const folderTitle = (cmd.folderName || 'Новая папка').trim();
      const newFolder: ChatFolder = {
        id: 'folder_' + Date.now(),
        name: folderTitle,
        icon: '✨',
        color: 'indigo',
        chatIds: []
      };
      const updated = [...userChatFolders, newFolder];
      await handleSaveChatFolders(updated);
      setActiveFolderId(newFolder.id);
      setSidebarTab('all');
      return `Создана и выбрана папка «✨ ${folderTitle}»`;
    }

    if (cmd.action === 'open_analytics') {
      if (!activeGroup && !activePartner) {
        if (otherUsers[0]) setActiveChatUserId(otherUsers[0].id);
        else if (myGroups[0]) setActiveGroupId(myGroups[0].id);
      }
      setIsVoiceAssistantOpen(false);
      setChatThemeModalTab('analytics');
      setIsChatThemeModalOpen(true);
      return 'Открыта панель аналитики чата (Analytics)';
    }

    if (cmd.action === 'export_chat') {
      const fmt = cmd.exportFormat === 'json' ? 'json' : 'txt';
      const chatTitle = activeGroup ? activeGroup.name : activePartner?.name || 'CosmoChat';
      exportChatHistory({
        chatTitle,
        isGroup: Boolean(activeGroup),
        messages: rawActiveChatMessages,
        usersMap: allUsersMap,
        format: fmt
      });
      return `Экспортирована история чата «${chatTitle}» в формате .${fmt.toUpperCase()}`;
    }

    return cmd.assistantReply || 'Команда выполнена';
  };

  const currentChatKey = useMemo(() => {
    if (activeGroupId) return activeGroupId;
    if (activeChatUserId && currentUser) {
      return [currentUser.id, activeChatUserId].sort().join('_');
    }
    return null;
  }, [activeGroupId, activeChatUserId, currentUser]);

  const activePinnedMessage = currentChatKey ? pinnedMessagesMap[currentChatKey] : null;

  const handleTogglePinMessage = async (msg: Message) => {
    if (!currentChatKey) return;
    const sender = allUsersMap[msg.senderId];
    const isCurrentlyPinned = activePinnedMessage?.messageId === msg.id;

    if (isCurrentlyPinned) {
      await remove(ref(db, `users/__pinned__/${currentChatKey}`));
    } else {
      const pinData = {
        messageId: msg.id,
        text: msg.text || (msg.type === 'voice' ? 'Голосовое сообщение' : 'Фотография'),
        senderName: sender?.name || 'Собеседник',
        pinnedAt: Date.now()
      };
      await set(ref(db, `users/__pinned__/${currentChatKey}`), pinData);
    }
  };

  const handleUnpinMessage = async () => {
    if (!currentChatKey) return;
    await remove(ref(db, `users/__pinned__/${currentChatKey}`));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressAndResizeImage(file);
      setSelectedImage(base64);
    } catch (err) {
      console.warn('Failed to process image:', err);
    }
    e.target.value = '';
  };

  // Send message (direct or group)
  const saveMessage = async (msgData: {
    type: 'text' | 'voice' | 'image' | 'poll';
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    duration?: number;
    replyTo?: MessageReply;
    poll?: Message['poll'];
  }) => {
    if (!currentUser) return;
    if (!activeChatUserId && !activeGroupId) return;

    if (currentUser.isMuted) {
      alert('Вы замучены администратором и не можете отправлять сообщения.');
      return;
    }

    // Reset activity
    updateMyActivity('idle');
    setIsMyTypingActive(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }

    const msgId = 'msg_' + Date.now();
    const newMsg: Message = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.name || '',
      senderPhone: cleanDigits(currentUser.phone || ''),
      time: new Date().toISOString(),
      readBy: [currentUser.id],
      type: msgData.type,
      ...(msgData.text !== undefined ? { text: msgData.text } : {}),
      ...(msgData.imageUrl !== undefined ? { imageUrl: msgData.imageUrl } : {}),
      ...(msgData.audioUrl !== undefined ? { audioUrl: msgData.audioUrl } : {}),
      ...(msgData.duration !== undefined ? { duration: msgData.duration } : {}),
      ...(msgData.replyTo !== undefined ? { replyTo: msgData.replyTo } : {}),
      ...(msgData.poll !== undefined ? { poll: msgData.poll } : {})
    };

    if (replyTarget) {
      const sender = allUsersMap[replyTarget.senderId];
      newMsg.replyTo = {
        id: replyTarget.id,
        senderName: sender?.name || 'Собеседник',
        text:
          replyTarget.text ||
          (replyTarget.type === 'voice'
            ? 'Голосовое сообщение'
            : replyTarget.type === 'poll'
            ? `📊 ${replyTarget.poll?.question || 'Опрос'}`
            : 'Фотография'),
        type: replyTarget.type
      };
      setReplyTarget(null);
    }

    if (activeGroupId) {
      newMsg.groupId = activeGroupId;
    } else if (activeChatUserId) {
      newMsg.receiverId = activeChatUserId;
    }

    setRawMessagesList((prev) => [...prev.filter((m) => m.id !== msgId), newMsg]);
    await set(ref(db, 'messages/' + msgId), newMsg).catch(() => {});

    // Auto-reply simulation for instant testing of partner typing or voice message
    if (isAutoReplyEnabled && activeChatUserId && activeChatUserId !== currentUser.id && !activeGroupId) {
      const partnerId = activeChatUserId;
      setTimeout(() => {
        if (activeChatUserId !== partnerId) return;

        // If the user sent a voice message, simulate partner recording audio!
        const replyType = msgData.type === 'voice' ? 'recording' : 'typing';
        simulatePartnerActivity(replyType);

        setTimeout(() => {
          if (activeChatUserId !== partnerId) return;
          stopSimulatePartnerActivity();

          const replies = [
            'Привет! Сообщение увидел, всё отлично.',
            'Отлично, понял тебя! Сейчас разберусь.',
            'Да, аудио статус и группы работают супер!',
            'Договорились, остаюсь на связи в космосе!',
            'Отлично! Статус записи аудио отображается корректно.'
          ];
          const randomReply = replies[Math.floor(Math.random() * replies.length)];
          const botMsgId = 'msg_' + Date.now();
          const botMsg: Message = {
            id: botMsgId,
            senderId: partnerId,
            receiverId: currentUser.id,
            time: new Date().toISOString(),
            type: 'text',
            text: randomReply
          };
          set(ref(db, 'messages/' + botMsgId), botMsg).catch(() => {});
        }, 3200);
      }, 700);
    }
  };

  const handleCreatePoll = (pollData: NonNullable<Message['poll']>) => {
    saveMessage({
      type: 'poll',
      text: `📊 Опрос: ${pollData.question}`,
      poll: pollData
    });
  };

  const handleSendTextMessage = async () => {
    if (!textMessage.trim() && !selectedImage) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
    updateMyActivity('idle');
    setIsMyTypingActive(false);

    if (editingMessage) {
      const updatedText = textMessage.trim();
      const editedIso = new Date().toISOString();
      const targetId = editingMessage.id;
      setEditingMessage(null);
      setTextMessage('');
      setRawMessagesList((prev) =>
        prev.map((m) =>
          m.id === targetId ? { ...m, text: updatedText, editedAt: editedIso } : m
        )
      );
      await set(ref(db, `messages/${targetId}/text`), updatedText).catch(() => {});
      await set(ref(db, `messages/${targetId}/editedAt`), editedIso).catch(() => {});
      return;
    }

    if (selectedImage) {
      saveMessage({
        type: 'image',
        imageUrl: selectedImage,
        text: textMessage.trim() || undefined
      });
      setSelectedImage(null);
    } else {
      saveMessage({ type: 'text', text: textMessage.trim() });
    }
    setTextMessage('');
  };

  // Typing event handler with visual confirmation
  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextMessage(val);

    if (val.trim()) {
      setIsMyTypingActive(true);
      updateMyActivity('typing');

      if (!typingHeartbeatRef.current) {
        typingHeartbeatRef.current = setInterval(() => {
          updateMyActivity('typing');
        }, 2500);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateMyActivity('idle');
        setIsMyTypingActive(false);
        if (typingHeartbeatRef.current) {
          clearInterval(typingHeartbeatRef.current);
          typingHeartbeatRef.current = null;
        }
      }, 6000);
    } else {
      updateMyActivity('idle');
      setIsMyTypingActive(false);
      if (typingHeartbeatRef.current) {
        clearInterval(typingHeartbeatRef.current);
        typingHeartbeatRef.current = null;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendTextMessage();
    }
  };

  // Voice recording
  const startRecording = async () => {
    if (currentUser?.isMuted) {
      alert('Вы замучены администратором и не можете отправлять сообщения.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      // Broadcast recording audio status immediately
      updateMyActivity('recording');

      // Heartbeat: continuously re-send recording status every 1.5 seconds
      recordHeartbeatRef.current = setInterval(() => {
        updateMyActivity('recording');
      }, 1500);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert('Нет доступа к микрофону или устройство не поддерживается.');
    }
  };

  const stopAudioTracks = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    clearInterval(recordIntervalRef.current);
    clearInterval(recordHeartbeatRef.current);
    recordHeartbeatRef.current = null;
    setIsRecording(false);
    updateMyActivity('idle');
  };

  const cancelRecording = () => {
    stopAudioTracks();
    audioChunksRef.current = [];
  };

  const sendRecording = () => {
    if (!mediaRecorderRef.current) return;
    const finalSeconds = recordSeconds;

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        saveMessage({
          type: 'voice',
          audioUrl: base64Audio,
          duration: finalSeconds || 1
        });
      };
    };
    stopAudioTracks();
  };

  const logout = () => {
    updateMyActivity('idle');
    if (currentUser) {
      set(ref(db, `users/${currentUser.id}/isOnline`), false);
      set(ref(db, `users/${currentUser.id}/lastSeen`), Date.now());
      set(ref(db, `status/${currentUser.id}`), { isOnline: false, lastSeen: Date.now() });
    }
    sessionStorage.removeItem('cosmo_tab_user');
    sessionStorage.removeItem('cosmo_explicit_login');
    localStorage.removeItem('cosmo_currentUser');
    setCurrentUser(null);
    setActiveChatUserId(null);
    setActiveGroupId(null);
  };

  // If no user is logged in, show Auth Modal
  if (!currentUser) {
    return (
      <div className="h-screen w-screen bg-[#0f172a] text-slate-200 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto bg-indigo-500 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-lg shadow-indigo-500/20">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {isLoginMode ? 'Вход в CosmoChat' : 'Регистрация'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {isLoginMode ? 'Введите номер телефона и пароль' : 'Заполните данные для создания аккаунта'}
            </p>
          </div>

          {/* Switch tabs */}
          <div className="flex border-b border-slate-700 mb-5 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(true);
                setAuthError('');
              }}
              className={`flex-1 py-2 text-center transition-colors font-semibold cursor-pointer ${
                isLoginMode
                  ? 'text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-slate-400 border-b-2 border-transparent hover:text-slate-200'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(false);
                setAuthError('');
              }}
              className={`flex-1 py-2 text-center transition-colors font-semibold cursor-pointer ${
                !isLoginMode
                  ? 'text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-slate-400 border-b-2 border-transparent hover:text-slate-200'
              }`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-3.5">
            {!isLoginMode && (
              <div>
                <input
                  type="text"
                  placeholder="Ваше имя"
                  value={authName}
                  onChange={(e) => {
                    setAuthName(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500"
                />
              </div>
            )}

            {!isLoginMode && (
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-500">@</span>
                <input
                  type="text"
                  placeholder="username (необязательно)"
                  value={authUsername}
                  onChange={(e) => {
                    setAuthUsername(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500"
                />
              </div>
            )}

            <div>
              <input
                type="text"
                required
                placeholder="+7 (___) ___-__-__"
                value={authPhone}
                onChange={handlePhoneInputChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500"
              />
            </div>

            <div className="relative">
              <input
                type={showAuthPassword ? 'text' : 'password'}
                required
                placeholder="Пароль"
                value={authPassword}
                onChange={(e) => {
                  setAuthPassword(e.target.value);
                  setAuthError('');
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowAuthPassword(!showAuthPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showAuthPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {authError && (
              <div className="text-xs text-red-400 text-center font-medium leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-xl transition-colors mt-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              {isLoginMode ? 'Войти' : 'Зарегистрироваться'}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-4 text-xs text-slate-500">или</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2.5 text-sm shadow-sm cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.6 6.4C.6 8.4 0 10.6 0 13s.6 4.6 1.6 6.6l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.3L1.6 15.6C3.5 19.4 7.4 23 12 23z"
                />
              </svg>
              <span>Войти через Gmail / Google</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isUserAdmin = isAdmin(currentUser.phone);
  const isPartnerAdmin = activePartner ? isAdmin(activePartner.phone) : false;
  const isCurrentGroupCreator = activeGroup?.creatorId === currentUser.id;

  const currentChatActive = Boolean(activeChatUserId || activeGroupId);

  return (
    <div className="h-screen w-screen bg-[#080d1a] text-slate-100 overflow-hidden flex items-center justify-center p-0 sm:p-2 md:p-4 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))]">
      {/* Toast notification for copied text */}
      {copiedMsgId && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4" />
          <span>Текст скопирован</span>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full h-full max-w-[1440px] sm:rounded-2xl flex overflow-hidden bg-slate-900/95 border border-slate-800 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl relative">
        {/* LEFT SIDEBAR */}
        <div
          className={`w-full sm:w-[360px] lg:w-[380px] border-r border-slate-800/80 flex flex-col bg-slate-900/80 shrink-0 ${
            currentChatActive ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden shadow-sm ring-2 ring-indigo-500/20">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.name?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                {/* My Online Dot */}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" title="В сети" />
              </div>

              <div className="min-w-0 flex flex-col justify-center">
                <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                  <span className="truncate">{currentUser.name}</span>
                  {isUserAdmin && <Crown className="w-3.5 h-3.5 text-amber-400 crown-glow shrink-0" />}
                  {currentUser.isMuted && (
                    <span className="text-red-400 text-xs inline-flex items-center" title="Замучен">
                      <VolumeX className="w-3.5 h-3.5 inline" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-[11px] text-slate-400">@{currentUser.username}</span>
                  {currentUser.audioStatusUrl && (
                    <button
                      type="button"
                      onClick={() => togglePlayAudioBio(currentUser.id, currentUser.audioStatusUrl)}
                      className="inline-flex items-center gap-1 text-[10px] text-rose-300 bg-rose-500/15 border border-rose-500/25 px-2 py-0.5 rounded-full hover:bg-rose-500/25 transition-colors cursor-pointer shrink-0 font-medium"
                      title="Прослушать свой аудио-статус"
                    >
                      {playingBioUserId === currentUser.id ? <Pause className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                      <span>аудио</span>
                    </button>
                  )}
                  {currentUser.customStatus && (
                    <span className="text-indigo-300 font-medium truncate">• {currentUser.customStatus}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              {/* Voice Assistant Button */}
              <button
                type="button"
                onClick={() => setIsVoiceAssistantOpen(true)}
                className="text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold mr-1 shadow-xs"
                title="Voice Assistant — Голосовые команды Gemini"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Ассистент</span>
              </button>

              {/* New Group Button */}
              <button
                onClick={() => {
                  setGroupModalMode('create');
                  setIsGroupModalOpen(true);
                }}
                className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 p-2 rounded-xl transition-all cursor-pointer"
                title="Создать группу"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                onClick={openProfileModal}
                className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 p-2 rounded-xl transition-all cursor-pointer"
                title="Настройки профиля"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-400 hover:bg-slate-800/80 p-2 rounded-xl transition-all cursor-pointer"
                title="Выйти"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 pb-1">
            <div className="relative flex items-center bg-slate-800/70 rounded-xl border border-slate-700/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-xs">
              <Search className="w-4 h-4 absolute left-3 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск собеседников и групп..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-transparent pl-9 pr-8 py-2 text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-3 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs: Все / Личные / Группы */}
          <div className="flex flex-col px-3 pt-2 pb-2 gap-2 border-b border-slate-800/80 text-xs select-none min-w-0 overflow-hidden">
            <div className="flex items-center bg-slate-800/50 p-1 rounded-xl gap-1 w-full">
              <button
                onClick={() => {
                  setSidebarTab('all');
                  setActiveFolderId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all cursor-pointer text-center ${
                  sidebarTab === 'all' && !activeFolderId
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => {
                  setSidebarTab('direct');
                  setActiveFolderId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all cursor-pointer text-center ${
                  sidebarTab === 'direct' && !activeFolderId
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                Личные ({sidebarDirectUsers.length})
              </button>
              <button
                onClick={() => {
                  setSidebarTab('groups');
                  setActiveFolderId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  sidebarTab === 'groups' && !activeFolderId
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Группы ({sidebarGroups.length})</span>
              </button>
            </div>

            {/* Custom Chat Folders Bar (Работа, Друзья, Архив & Custom) */}
            <div
              ref={sidebarFoldersScroll.ref}
              onMouseDown={sidebarFoldersScroll.onMouseDown}
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              className="flex items-center gap-1.5 overflow-x-auto pb-1 folders-scroll w-full min-w-0 cursor-grab active:cursor-grabbing"
            >
              {userChatFolders.map((folder) => {
                const isSelected = activeFolderId === folder.id;
                const colorCfg = getFolderColorConfig(folder.color);
                const validCount = folder.chatIds.filter(
                  (id) => Boolean(allUsersMap[id]) || Boolean(allGroupsMap[id])
                ).length;

                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setActiveFolderId(null);
                      } else {
                        setActiveFolderId(folder.id);
                        setSidebarTab('all');
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? `${colorCfg.activeTabClass} shadow-xs`
                        : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={`Папка «${folder.name}» (${validCount})`}
                  >
                    <span>{folder.icon || '📁'}</span>
                    <span className="truncate max-w-[90px]">{folder.name}</span>
                    <span
                      className={`text-[10px] px-1.5 rounded-full ${
                        isSelected ? 'bg-black/25 text-white' : 'bg-slate-700/80 text-slate-300'
                      }`}
                    >
                      {validCount}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setQuickAssignChat(null);
                  setFoldersModalInitialId(activeFolderId || 'work');
                  setFoldersModalInitialCreateMode(true);
                  setIsFoldersModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-dashed border-indigo-500/50 text-indigo-300 hover:text-white hover:border-indigo-400 hover:bg-indigo-500/15 shrink-0 transition-colors cursor-pointer"
                title="Создать новую папку"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuickAssignChat(null);
                  setFoldersModalInitialId(activeFolderId || 'work');
                  setFoldersModalInitialCreateMode(false);
                  setIsFoldersModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-slate-700/80 text-slate-300 hover:text-white hover:border-indigo-500/60 hover:bg-slate-800 shrink-0 transition-colors cursor-pointer"
                title="Управление папками чатов"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Папки</span>
              </button>
            </div>
          </div>

          {/* Dialogs / Groups List */}
          <div className="flex-1 overflow-y-auto py-1">
            {/* Saved Messages (Избранное) pinned chat item */}
            {sidebarTab !== 'groups' && !activeFolderId && (
              <div
                onClick={() => {
                  updateMyActivity('idle');
                  setActiveGroupId(null);
                  setActiveChatUserId(currentUser.id);
                  setInChatSearch('');
                }}
                className={`flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-all duration-150 ${
                  activeChatUserId === currentUser.id && !activeGroupId
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'hover:bg-slate-800/70 text-slate-200 border border-slate-800/80 bg-slate-800/30'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Bookmark className="w-5 h-5 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-sm font-bold truncate">Избранное</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        activeChatUserId === currentUser.id && !activeGroupId
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      облако
                    </span>
                  </div>
                  <div
                    className={`text-xs truncate ${
                      activeChatUserId === currentUser.id && !activeGroupId
                        ? 'text-indigo-100'
                        : 'text-slate-400'
                    }`}
                  >
                    {lastMessagesMap[currentUser.id]?.text || 'Сохранённые сообщения и заметки'}
                  </div>
                </div>
              </div>
            )}

            {/* Show Groups if tab is 'all' or 'groups' */}
            {(sidebarTab === 'all' || sidebarTab === 'groups') && sidebarGroups.length > 0 && (
              <div>
                {sidebarTab === 'all' && (
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Группы
                  </div>
                )}
                {sidebarGroups.map((grp) => {
                  const isActive = activeGroupId === grp.id;
                  const lastMsg = lastMessagesMap[grp.id];
                  const lastMsgTime = lastMsg ? formatChatTime(lastMsg.time) : '';
                  const lastMsgSender = lastMsg ? allUsersMap[lastMsg.senderId] : null;

                  // Check group activity (typing or recording audio!)
                  let grpAct: { status: 'typing' | 'recording'; userName: string } | null = null;
                  if (simulatedActivity && simulatedActivity.targetId === grp.id && Date.now() < simulatedActivity.expiresAt) {
                    grpAct = { status: simulatedActivity.status, userName: simulatedActivity.userName };
                  } else {
                    for (const mId of getGroupMembers(grp)) {
                      if (mId === currentUser.id) continue;
                      const act = getUserLiveActivity(mId);
                      if (act && act.targetId === grp.id) {
                        const mUser = allUsersMap[mId];
                        grpAct = { status: act.status, userName: act.userName || mUser?.name || 'Участник' };
                        break;
                      }
                    }
                  }

                  return (
                    <div
                      key={grp.id}
                      onClick={() => {
                        updateMyActivity('idle');
                        setActiveChatUserId(null);
                        setActiveGroupId(grp.id);
                        setInChatSearch('');
                      }}
                      className={`group/item flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-lg font-bold text-white shrink-0 overflow-hidden shadow-xs">
                        {grp.avatar?.startsWith('data:') || grp.avatar?.startsWith('http') ? (
                          <img src={grp.avatar} alt={grp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(grp.name?.[0] || 'Г').toUpperCase()}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                            <span className="truncate">{grp.name}</span>
                            <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded-md shrink-0 ${
                              isActive ? 'bg-white/20 text-white' : 'text-indigo-300/80 bg-indigo-500/15'
                            }`}>
                              группа
                            </span>
                            {getFoldersForChat(grp.id).map((f) => (
                              <span
                                key={f.id}
                                title={`В папке «${f.name}»`}
                                className="text-[10px] leading-none shrink-0"
                              >
                                {f.icon || '📁'}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickAssignChat({ id: grp.id, name: grp.name, isGroup: true });
                                setIsFoldersModalOpen(true);
                              }}
                              className={`opacity-0 group-hover/item:opacity-100 p-1 rounded-md transition-opacity cursor-pointer ${
                                isActive
                                  ? 'hover:bg-white/20 text-indigo-100'
                                  : 'hover:bg-slate-700 text-slate-400 hover:text-indigo-300'
                              }`}
                              title="Добавить группу в папку"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                            {lastMsgTime && (
                              <span className={`text-[11px] font-mono shrink-0 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {lastMsgTime}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subtitle: Live activity > Last message > Members count */}
                        {grpAct && grpAct.status === 'recording' ? (
                          <div className="text-xs text-rose-400 font-semibold truncate flex items-center gap-1 animate-pulse">
                            <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{grpAct.userName} записывает аудио...</span>
                          </div>
                        ) : grpAct && grpAct.status === 'typing' ? (
                          <div className={`text-xs font-medium truncate flex items-center gap-1 animate-pulse ${isActive ? 'text-white' : 'text-indigo-300'}`}>
                            <PenLine className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{grpAct.userName} печатает...</span>
                          </div>
                        ) : lastMsg ? (
                          <div className={`text-xs truncate flex items-center gap-1 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                            <span className={`font-medium truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                              {isMyMessage(lastMsg) ? 'Вы: ' : `${lastMsgSender?.name || lastMsg.senderName || 'Участник'}: `}
                            </span>
                            {lastMsg.type === 'voice' ? (
                              <span className="flex items-center gap-1 text-rose-400 shrink-0 font-medium">
                                <Mic className="w-3 h-3" />
                                <span>Голосовое</span>
                              </span>
                            ) : (
                              <span className="truncate">{lastMsg.text}</span>
                            )}
                          </div>
                        ) : (
                          <div className={`text-xs truncate ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {getGroupMembers(grp).length} участников
                            {grp.description && <span> • {grp.description}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show Direct Chats if tab is 'all' or 'direct' */}
            {(sidebarTab === 'all' || sidebarTab === 'direct') && (
              <div>
                {sidebarTab === 'all' && sidebarDirectUsers.length > 0 && (
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Личные сообщения
                  </div>
                )}

                {sidebarDirectUsers.length === 0 && sidebarTab === 'direct' ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    {globalSearch.trim()
                      ? 'Пользователь не найден'
                      : 'Нет активных диалогов.\nНайдите кого-нибудь через поиск.'}
                  </div>
                ) : (
                  sidebarDirectUsers.map((user) => {
                    const isActive = activeChatUserId === user.id && !activeGroupId;
                    const isItemAdmin = isAdmin(user.phone);
                    const online = Boolean(user.isOnline || presenceMap[user.id]?.isOnline);
                    const lastMsg = lastMessagesMap[user.id];
                    const lastMsgTime = lastMsg ? formatChatTime(lastMsg.time) : '';

                    // Check live activity (typing or recording audio!)
                    const act = getUserLiveActivity(user.id);
                    const isActToMe = act && (!act.targetId || act.targetId === currentUser.id);

                    return (
                      <div
                        key={user.id}
                        onClick={() => {
                          if (activeChatUserId && activeChatUserId !== user.id) {
                            updateMyActivity('idle');
                          }
                          setActiveGroupId(null);
                          setActiveChatUserId(user.id);
                          setInChatSearch('');
                        }}
                        className={`group/item flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-all duration-150 ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'hover:bg-slate-800/70 text-slate-200'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shrink-0 overflow-hidden ${
                              isActive ? 'bg-white/20' : 'bg-slate-700'
                            }`}
                          >
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              user.name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          {/* Online badge */}
                          {online && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" title="В сети" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="text-sm font-semibold truncate flex items-center gap-1">
                              <span className="truncate">{user.name}</span>
                              {isItemAdmin && <Crown className="w-3.5 h-3.5 text-amber-400 crown-glow shrink-0" />}
                              {getFoldersForChat(user.id).map((f) => (
                                <span
                                  key={f.id}
                                  title={`В папке «${f.name}»`}
                                  className="text-[10px] leading-none shrink-0"
                                >
                                  {f.icon || '📁'}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickAssignChat({ id: user.id, name: user.name, isGroup: false });
                                  setIsFoldersModalOpen(true);
                                }}
                                className={`opacity-0 group-hover/item:opacity-100 p-1 rounded-md transition-opacity cursor-pointer ${
                                  isActive
                                    ? 'hover:bg-white/20 text-indigo-100'
                                    : 'hover:bg-slate-700 text-slate-400 hover:text-indigo-300'
                                }`}
                                title="Добавить чат в папку"
                              >
                                <FolderPlus className="w-3.5 h-3.5" />
                              </button>
                              {lastMsgTime && (
                                <span className={`text-[11px] font-mono shrink-0 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  {lastMsgTime}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Subtitle: Live activity > Last message > Online status > Username */}
                          {isActToMe && act?.status === 'recording' ? (
                            <div className="text-xs text-rose-400 font-semibold truncate flex items-center gap-1 animate-pulse">
                              <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>записывает аудио...</span>
                            </div>
                          ) : isActToMe && act?.status === 'typing' ? (
                            <div className={`text-xs font-medium truncate flex items-center gap-1 animate-pulse ${isActive ? 'text-white' : 'text-indigo-300'}`}>
                              <PenLine className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span>печатает...</span>
                            </div>
                          ) : lastMsg ? (
                            <div className={`text-xs truncate flex items-center gap-1 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {lastMsg.senderId === currentUser.id && (
                                <CheckCheck className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-200' : 'text-indigo-400'}`} />
                              )}
                              {lastMsg.type === 'voice' ? (
                                <span className="flex items-center gap-1 text-rose-400 shrink-0 font-medium">
                                  <Mic className="w-3 h-3" />
                                  <span>Голосовое</span>
                                </span>
                              ) : (
                                <span className="truncate">{lastMsg.text}</span>
                              )}
                            </div>
                          ) : online ? (
                            <div className="text-xs truncate font-medium flex items-center gap-1 text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span>в сети</span>
                            </div>
                          ) : (
                            <div className={`text-xs truncate ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                              @{user.username}
                              {user.customStatus && <span> • {user.customStatus}</span>}
                            </div>
                          )}
                        </div>

                        {user.isMuted && (
                          <span className="text-red-400 text-xs ml-auto shrink-0 inline-flex items-center" title="Замучен">
                            <VolumeX className="w-3.5 h-3.5 inline" />
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Empty state when tab or folder has no items */}
            {sidebarTab === 'all' && sidebarDirectUsers.length === 0 && sidebarGroups.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                {activeFolderObj ? (
                  <>
                    <div className="text-2xl mb-2">{activeFolderObj.icon || '📁'}</div>
                    <p className="font-semibold text-slate-300 mb-1">
                      В папке «{activeFolderObj.name}» пока нет чатов
                    </p>
                    <p className="text-slate-500 mb-3">
                      Добавьте сюда рабочие, дружеские или архивные диалоги и группы
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAssignChat(null);
                        setFoldersModalInitialId(activeFolderObj.id);
                        setIsFoldersModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium cursor-pointer inline-flex items-center gap-1.5 text-xs"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Добавить чаты в папку
                    </button>
                  </>
                ) : (
                  <>
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>Нет диалогов или групп.</p>
                    <button
                      onClick={() => {
                        setGroupModalMode('create');
                        setIsGroupModalOpen(true);
                      }}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium cursor-pointer inline-flex items-center gap-1 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Создать группу
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CHAT AREA */}
        <div
          className={`flex-1 flex flex-col bg-[#0b1121] relative ${
            !currentChatActive ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {activeGroup ? (
            /* GROUP CHAT VIEW */
            <>
              {/* Group Chat Header */}
              <div className="h-[73px] border-b border-slate-700 flex items-center px-4 sm:px-6 bg-slate-900 justify-between shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <button
                    onClick={() => {
                      updateMyActivity('idle');
                      setActiveGroupId(null);
                    }}
                    className="sm:hidden p-2 -ml-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white overflow-hidden shrink-0 shadow-md">
                    {activeGroup.avatar?.startsWith('data:') || activeGroup.avatar?.startsWith('http') ? (
                      <img src={activeGroup.avatar} alt={activeGroup.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-lg text-white">{(activeGroup.name?.[0] || 'Г').toUpperCase()}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white flex items-center gap-1.5 truncate">
                      <span>{activeGroup.name}</span>
                      {isCurrentGroupCreator && (
                        <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          <Crown className="w-3 h-3" /> Владелец
                        </span>
                      )}
                    </div>

                    {/* Group live activity or member count */}
                    <div className="text-xs truncate transition-all duration-200">
                      {activeGroupActivity ? (
                        activeGroupActivity.status === 'recording' ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1.5 animate-pulse bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 shadow-sm">
                            <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{activeGroupActivity.userName} записывает аудио</span>
                            <span className="inline-flex gap-0.5 font-bold">
                              <span className="animate-bounce">.</span>
                              <span className="animate-bounce [animation-delay:0.2s]">.</span>
                              <span className="animate-bounce [animation-delay:0.4s]">.</span>
                            </span>
                          </span>
                        ) : (
                          <span className="text-indigo-400 font-semibold flex items-center gap-1.5 animate-pulse bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 shadow-sm">
                            <PenLine className="w-3.5 h-3.5 shrink-0" />
                            <span>{activeGroupActivity.userName} печатает...</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>{getGroupMembers(activeGroup).length} участников</span>
                          {activeGroup.description && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="truncate">{activeGroup.description}</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Voice Assistant button */}
                  <button
                    type="button"
                    onClick={() => setIsVoiceAssistantOpen(true)}
                    className="p-2 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/25 rounded-lg transition-colors cursor-pointer"
                    title="Voice Assistant — Голосовые команды Gemini"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>

                  {/* Group Analytics button */}
                  <button
                    type="button"
                    onClick={() => {
                      setChatThemeModalTab('analytics');
                      setIsChatThemeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Analytics — Статистика чата"
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>

                  {/* Group Theme & Settings button */}
                  <button
                    type="button"
                    onClick={() => {
                      setChatThemeModalTab('settings');
                      setIsChatThemeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Тема, экспорт и аналитика чата"
                  >
                    <Palette className="w-5 h-5" />
                  </button>

                  {/* Group Info button */}
                  <button
                    onClick={() => {
                      setGroupModalMode('info');
                      setIsGroupModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Информация о группе"
                  >
                    <Info className="w-5 h-5" />
                  </button>

                  {/* Search in chat toggle */}
                  <InChatSearchTrigger
                    isOpen={isInChatSearchOpen}
                    hasActiveQuery={Boolean(inChatSearch.trim())}
                    onToggle={() => {
                      if (isInChatSearchOpen || inChatSearch.trim()) {
                        setIsInChatSearchOpen(false);
                        setInChatSearch('');
                      } else {
                        setIsInChatSearchOpen(true);
                      }
                    }}
                    title="Поиск в группе"
                  />
                </div>
              </div>

              {/* Pinned Message Bar for Group */}
              {activePinnedMessage && (
                <div className="px-4 py-2 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs select-none backdrop-blur-xs shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Закрепленное сообщение</div>
                      <div className="text-white truncate">
                        <span className="font-semibold text-indigo-300 mr-1">{activePinnedMessage.senderName}:</span>
                        <span>{activePinnedMessage.text}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnpinMessage}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Открепить"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Messages Stream Wrapper with Floating InChatSearch Sub-Header */}
              <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
                <InChatSearch
                  value={inChatSearch}
                  onChange={setInChatSearch}
                  isOpen={isInChatSearchOpen}
                  onClose={() => setIsInChatSearchOpen(false)}
                  placeholder="Поиск в группе..."
                  matchCount={activeChatMessages.length}
                  totalCount={rawActiveChatMessages.length}
                />

                {/* Messages Area for Group */}
                <div
                  className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 transition-all duration-300 ${
                    isInChatSearchOpen || inChatSearch.trim() ? 'pt-16 sm:pt-18' : ''
                  }`}
                  style={getChatBackgroundStyle(activeChatTheme)}
                >
                {activeChatMessages.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm mt-16 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-indigo-400">
                      {inChatSearch.trim() ? <Search className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                    </div>
                    {inChatSearch.trim() ? (
                      <>
                        <span className="font-medium text-slate-400">По запросу «{inChatSearch}» ничего не найдено</span>
                        <button
                          type="button"
                          onClick={() => setInChatSearch('')}
                          className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Сбросить поиск
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-slate-400">В группе пока нет сообщений</span>
                        <span className="text-xs text-slate-500">Напишите первое сообщение или запишите голосовое!</span>
                      </>
                    )}
                  </div>
                ) : (
                  activeChatMessages.map((msg, index) => {
                    const isMe = isMyMessage(msg);
                    const sender = allUsersMap[msg.senderId];
                    const senderName = sender ? sender.name : (msg.senderName || 'Пользователь');
                    const isMsgSenderAdmin = sender ? isAdmin(sender.phone) : false;
                    const isMsgSenderCreator = sender ? sender.id === activeGroup.creatorId : false;
                    const timeStr = new Date(msg.time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const senderColor = getSenderColor(msg.senderId);

                    const currentDateGroup = formatDateDivider(msg.time);
                    const prevMsg = index > 0 ? activeChatMessages[index - 1] : null;
                    const prevDateGroup = prevMsg ? formatDateDivider(prevMsg.time) : null;
                    const showDateDivider = currentDateGroup !== prevDateGroup;
                    const groupReadInfo = getGroupMessageReadStatus(msg, activeGroup);

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-3 select-none">
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50 shadow-xs">
                              {currentDateGroup}
                            </span>
                          </div>
                        )}

                        <div
                          className={`${
                            isMe ? 'msg-row-own justify-end' : 'msg-row-other justify-start'
                          } flex w-full items-start gap-2 group/msg relative`}
                          style={{
                            display: 'flex',
                            width: '100%',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-start'
                          }}
                        >
                          {!isMe && (
                            <div className="w-8 h-8 mt-1 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden border border-slate-600">
                              {sender?.avatar ? (
                                <img src={sender.avatar} alt={senderName} className="w-full h-full object-cover" />
                              ) : (
                                (senderName[0] || '?').toUpperCase()
                              )}
                            </div>
                          )}

                          <div
                            className={`flex flex-col max-w-[80%] sm:max-w-[68%] ${
                              isMe ? 'items-end ml-auto' : 'items-start mr-auto'
                            }`}
                            style={{
                              marginLeft: isMe ? 'auto' : 0,
                              marginRight: isMe ? 0 : 'auto'
                            }}
                          >
                            <div
                              className={`w-fit max-w-full rounded-2xl px-4 py-2.5 relative shadow-sm transition-all ${
                                isMe
                                  ? 'msg-bubble-own bg-gradient-to-br from-indigo-600 to-indigo-500 text-white rounded-br-none shadow-indigo-600/10'
                                  : 'msg-bubble-other bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-xs'
                              }`}
                              style={isMe ? getChatBubbleStyle(activeChatTheme) : undefined}
                            >
                              {isMe ? (
                                <div className="text-[10px] font-semibold text-indigo-200 mb-0.5 text-right select-none">
                                  Вы
                                </div>
                              ) : (
                                <div className={`text-xs font-semibold ${senderColor} mb-1 flex items-center gap-1.5`}>
                                  <span>{senderName}</span>
                                  {isMsgSenderCreator && (
                                    <span title="Владелец группы">
                                      <Crown className="w-3 h-3 text-amber-400" />
                                    </span>
                                  )}
                                  {isMsgSenderAdmin && !isMsgSenderCreator && (
                                    <span title="Администратор">
                                      <Crown className="w-3 h-3 text-amber-400" />
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Forwarded Badge */}
                              {msg.forwardedFrom && (
                                <div className={`mb-1.5 flex items-center gap-1 text-[11px] italic select-none ${
                                  isMe ? 'text-indigo-100/90' : 'text-indigo-300/90'
                                }`}>
                                  <Forward className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Переслано от <strong className="font-semibold not-italic">{msg.forwardedFrom.senderName}</strong></span>
                                </div>
                              )}

                              {/* Reply Quote Preview */}
                              {msg.replyTo && (
                                <div className={`mb-2 pl-2.5 py-1 pr-2 rounded-r-lg border-l-2 text-xs select-none ${
                                  isMe
                                    ? 'border-white/80 bg-black/15 text-indigo-100'
                                    : 'border-indigo-400 bg-slate-900/60 text-slate-300'
                                }`}>
                                  <div className="font-semibold text-[11px] truncate flex items-center gap-1">
                                    <CornerUpLeft className="w-3 h-3 shrink-0" />
                                    <span>{msg.replyTo.senderName}</span>
                                  </div>
                                  <div className="truncate opacity-80 text-[11px] mt-0.5">
                                    {msg.replyTo.text ? highlightMatchedText(msg.replyTo.text, inChatSearch) : (msg.replyTo.type === 'voice' ? 'Голосовое сообщение' : 'Фотография')}
                                  </div>
                                </div>
                              )}

                              {/* Image rendering */}
                              {msg.type === 'image' && msg.imageUrl && (
                                <div className="mb-2 -mx-1 -mt-1 rounded-xl overflow-hidden bg-black/20">
                                  <img
                                    src={msg.imageUrl}
                                    alt="Изображение"
                                    onClick={() => setLightboxImage(msg.imageUrl || null)}
                                    className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                                  />
                                </div>
                              )}

                              {msg.type === 'poll' && msg.poll ? (
                                <PollCard
                                  poll={msg.poll}
                                  isMe={isMe}
                                  currentUserId={currentUser.id}
                                  usersMap={allUsersMap}
                                  onVote={(optId) => handleVotePoll(msg, optId)}
                                />
                              ) : msg.type === 'voice' ? (
                                <VoiceMessagePlayer
                                  audioUrl={msg.audioUrl}
                                  isMe={isMe}
                                  timeStr={timeStr}
                                  initialDuration={msg.duration}
                                  initialSummary={msg.summary}
                                  onSaveSummary={(s) => handleSaveVoiceSummary(msg.id, s)}
                                />
                              ) : (
                                msg.text && <div className="text-sm break-words whitespace-pre-wrap leading-relaxed">{highlightMatchedText(msg.text, inChatSearch)}</div>
                              )}

                              <div className={`text-[10px] flex items-center justify-end gap-1 mt-1 select-none ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {msg.editedAt && <span className="italic opacity-80">изм.</span>}
                                <span>{timeStr}</span>
                                {isMe &&
                                  isUserReadReceiptsEnabled(allUsersMap[currentUser.id] || currentUser) &&
                                  groupReadInfo.visibleReceiptParticipants.length > 0 && (
                                    groupReadInfo.readParticipants.length > 0 ? (
                                      <span
                                        title={`Просмотрели (${groupReadInfo.readParticipants.length}/${groupReadInfo.visibleReceiptParticipants.length}): ${groupReadInfo.readParticipants.map((p) => p.name).join(', ')}`}
                                        className="inline-flex items-center gap-0.5"
                                      >
                                        <CheckCheck
                                          className={`w-3.5 h-3.5 shrink-0 ${
                                            groupReadInfo.allRead ? 'text-sky-300' : 'text-sky-300/80'
                                          }`}
                                        />
                                      </span>
                                    ) : (
                                      <span title="Доставлено" className="inline-flex items-center">
                                        <Check className="w-3.5 h-3.5 text-indigo-200/75 shrink-0" />
                                      </span>
                                    )
                                  )}
                              </div>
                            </div>

                            {/* Emoji Reactions Badges below Group Message Bubble */}
                            {(() => {
                              const reactionsList = getMessageReactions(msg);
                              if (reactionsList.length === 0) return null;
                              return (
                                <div
                                  className={`mt-1 flex flex-wrap items-center gap-1 select-none ${
                                    isMe ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  {reactionsList.map((r) => (
                                    <button
                                      key={r.emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg, r.emoji)}
                                      title={`Реакция ${r.emoji}: ${r.userNames.join(', ')}`}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all cursor-pointer ${
                                        r.reactedByMe
                                          ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-100 shadow-xs'
                                          : 'bg-slate-800/85 border-slate-700/80 text-slate-300 hover:bg-slate-700/80'
                                      }`}
                                    >
                                      <span>{r.emoji}</span>
                                      <span className="text-[11px] font-semibold">{r.count}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Group Read Status & Viewer Names under the message */}
                            {groupReadInfo.participants.length > 0 && (
                              <div
                                className={`mt-1 px-1 flex flex-col gap-1 select-none ${
                                  isMe ? 'items-end text-right' : 'items-start text-left'
                                }`}
                              >
                                {/* List of names of participants who have already viewed the message */}
                                <div className="flex items-center gap-1.5 text-[11px] leading-tight text-slate-400 flex-wrap">
                                  {groupReadInfo.readParticipants.length > 0 ? (
                                    <>
                                      <Eye className="w-3 h-3 text-sky-400 shrink-0" />
                                      <span>
                                        Просмотрели ({groupReadInfo.readParticipants.length}/{groupReadInfo.participants.length}):{' '}
                                        <span className="text-slate-200 font-medium">
                                          {groupReadInfo.readParticipants.map((p) => p.displayName).join(', ')}
                                        </span>
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="w-3 h-3 text-slate-500 shrink-0" />
                                      <span className="text-slate-500">
                                        Просмотрели (0/{groupReadInfo.participants.length}): пока никто не просмотрел
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Individual read status badges for each participant in the group */}
                                <div
                                  className={`flex flex-wrap gap-1 ${
                                    isMe ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  {groupReadInfo.participants.map((participant) => (
                                    <div
                                      key={participant.id}
                                      title={
                                        !participant.readReceiptsEnabled
                                          ? `${participant.name}: Отчеты о прочтении отключены`
                                          : participant.hasRead
                                          ? `${participant.name}: Просмотрено`
                                          : `${participant.name}: Еще не прочитано`
                                      }
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                                        participant.hasRead
                                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                                          : 'bg-slate-800/70 border-slate-700/60 text-slate-400'
                                      }`}
                                    >
                                      <div className="w-3.5 h-3.5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden shrink-0">
                                        {participant.avatar ? (
                                          <img
                                            src={participant.avatar}
                                            alt={participant.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          (participant.name[0] || '?').toUpperCase()
                                        )}
                                      </div>
                                      <span className="truncate max-w-[110px] font-medium">
                                        {participant.displayName}
                                      </span>
                                      {participant.readReceiptsEnabled ? (
                                        participant.hasRead ? (
                                          <CheckCheck className="w-3 h-3 text-sky-400 shrink-0" />
                                        ) : (
                                          <Check className="w-3 h-3 text-slate-500 shrink-0" />
                                        )
                                      ) : (
                                        <EyeOff className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick Actions on Hover */}
                          <div className={`opacity-0 group-hover/msg:opacity-100 transition-opacity absolute -top-3 ${
                            isMe ? 'right-2' : 'left-2'
                          } bg-slate-800 border border-slate-700/80 rounded-lg p-0.5 shadow-md flex items-center gap-0.5 z-10 backdrop-blur-xs`}>
                            <div className="flex items-center gap-0.5 pr-1 mr-0.5 border-r border-slate-700/80">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg, emoji)}
                                  className="px-1 py-0.5 text-xs hover:scale-125 rounded hover:bg-slate-700/80 transition-transform cursor-pointer leading-none"
                                  title={`Реакция ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplyTarget(msg)}
                              className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Ответить"
                            >
                              <CornerUpLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setForwardTargetMsg(msg);
                                setForwardSearchQuery('');
                              }}
                              className="p-1 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Переслать"
                            >
                              <Forward className="w-3 h-3" />
                            </button>
                            {msg.type !== 'voice' && msg.text && (
                              <button
                                type="button"
                                onClick={() => copyMessageText(msg.id, msg.text || '')}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Копировать текст"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                            {isMe && msg.type === 'text' && (
                              <button
                                type="button"
                                onClick={() => handleStartEditMessage(msg)}
                                className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Редактировать сообщение"
                              >
                                <PenLine className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSaveToBookmarks(msg)}
                              className={`p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer ${
                                savedToastMsgId === msg.id
                                  ? 'text-amber-400'
                                  : 'text-slate-400 hover:text-amber-300'
                              }`}
                              title="Сохранить в Избранное"
                            >
                              <Bookmark className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePinMessage(msg)}
                              className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                              title={activePinnedMessage?.messageId === msg.id ? 'Открепить' : 'Закрепить'}
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                            {(isMe || isUserAdmin) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Удалить сообщение"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}

                {/* Floating typing/recording bubbles for group */}
                {activeGroupActivity && (
                  <div className="flex justify-start">
                    {activeGroupActivity.status === 'recording' ? (
                      <div className="bg-slate-800 text-rose-400 border border-rose-500/30 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2.5 shadow-lg">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 pulse-record" />
                        <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                        <span className="text-xs text-rose-200 font-medium">
                          {activeGroupActivity.userName} записывает аудио
                        </span>
                        <div className="flex items-center gap-0.5 h-3 ml-1">
                          <span className="w-0.5 bg-rose-400 rounded-full animate-wave-1" />
                          <span className="w-0.5 bg-rose-400 rounded-full animate-wave-2" />
                          <span className="w-0.5 bg-rose-400 rounded-full animate-wave-3" />
                          <span className="w-0.5 bg-rose-400 rounded-full animate-wave-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800 text-indigo-300 border border-indigo-500/30 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center gap-2 shadow-lg">
                        <PenLine className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        <span className="text-xs text-slate-300 font-medium">{activeGroupActivity.userName} печатает...</span>
                      </div>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Group Input Area */}
              <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-700">
                {currentUser.isMuted ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs text-red-400 font-medium">
                    <VolumeX className="w-4 h-4 inline-block mr-1 align-sub" /> Вы замучены администратором и не можете отправлять сообщения.
                  </div>
                ) : (
                  <div>
                    {/* Editing Message Preview */}
                    {editingMessage && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PenLine className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0 text-xs">
                            <div className="text-indigo-300 font-semibold">Редактирование сообщения</div>
                            <div className="text-slate-300 truncate text-[11px]">{editingMessage.text}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessage(null);
                            setTextMessage('');
                          }}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 cursor-pointer"
                          title="Отменить редактирование"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Reply Preview */}
                    {replyTarget && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-1 h-8 bg-indigo-500 rounded-full shrink-0" />
                          <div className="min-w-0 text-xs">
                            <div className="text-indigo-400 font-semibold flex items-center gap-1">
                              <CornerUpLeft className="w-3 h-3" />
                              <span>Ответ {allUsersMap[replyTarget.senderId]?.name || 'Собеседник'}</span>
                            </div>
                            <div className="text-slate-300 truncate text-[11px]">
                              {replyTarget.text || (replyTarget.type === 'voice' ? 'Голосовое сообщение' : 'Фотография')}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyTarget(null)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 cursor-pointer transition-colors"
                          title="Отменить ответ"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Image Preview */}
                    {selectedImage && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="flex items-center gap-3">
                          <img src={selectedImage} alt="Превью" className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />
                          <div className="text-xs">
                            <div className="text-white font-medium">Фотография прикреплена</div>
                            <div className="text-slate-400 text-[11px]">Добавьте подпись или нажмите «Отправить»</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
                          title="Удалить фото"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {isMyTypingActive && (
                      <div className="max-w-4xl mx-auto mb-1.5 px-1 text-[11px] text-indigo-400 flex items-center gap-1.5 animate-pulse">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                        <span>Вы печатаете в группу... Участники видят статус «печатает»</span>
                      </div>
                    )}

                    <div className="max-w-4xl mx-auto flex items-end gap-2 relative">
                      {!isRecording ? (
                        <>
                          <button
                            type="button"
                            onClick={() => imageFileInputRef.current?.click()}
                            className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                            title="Прикрепить фото"
                          >
                            <Paperclip className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPollModalOpen(true)}
                            className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                            title="Создать опрос (голосование)"
                          >
                            <BarChart2 className="w-5 h-5" />
                          </button>
                          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-1 flex items-center focus-within:border-indigo-500 transition-colors">
                            <textarea
                              rows={1}
                              placeholder="Написать в группу..."
                              value={textMessage}
                              onChange={handleTextInputChange}
                              onKeyDown={handleKeyDown}
                              className="w-full bg-transparent resize-none outline-none text-white px-3 py-2 text-sm max-h-32 min-h-[40px]"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-rose-500 pulse-record" />
                            <span className="text-sm font-mono text-rose-400 font-bold">
                              {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                              {String(recordSeconds % 60).padStart(2, '0')}
                            </span>
                            <span className="text-xs text-rose-300 font-medium hidden sm:inline">
                              (участники группы видят статус: «записывает аудио»)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded bg-slate-800 cursor-pointer transition-colors"
                            >
                              Отмена
                            </button>
                            <button
                              type="button"
                              onClick={sendRecording}
                              className="text-xs text-white px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 cursor-pointer font-medium transition-colors"
                            >
                              Отправить
                            </button>
                          </div>
                        </div>
                      )}

                      {!isRecording && (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="Голосовое сообщение"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}

                      {!isRecording && (
                        <button
                          type="button"
                          onClick={handleSendTextMessage}
                          className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shrink-0 transition-colors cursor-pointer"
                          title="Отправить"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : activePartner ? (
            /* DIRECT CHAT VIEW */
            <>
              {/* Chat Header */}
              <div className="h-[73px] border-b border-slate-700 flex items-center px-4 sm:px-6 bg-slate-900 justify-between shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <button
                    onClick={() => {
                      updateMyActivity('idle');
                      setActiveChatUserId(null);
                    }}
                    className="sm:hidden p-2 -ml-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white overflow-hidden shrink-0">
                      {activePartner.avatar ? (
                        <img src={activePartner.avatar} alt={activePartner.name} className="w-full h-full object-cover" />
                      ) : (
                        activePartner.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    {/* Header Avatar Online Dot */}
                    {isPartnerOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" title="В сети" />
                    )}
                  </div>

                  {/* Interlocutor Name & Dynamic Activity Indicator */}
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white flex items-center gap-1.5 truncate">
                      <span>
                        {activePartner.id === currentUser.id
                          ? 'Избранное (Сохранённые сообщения)'
                          : activePartner.name}
                      </span>
                      {isPartnerAdmin && <Crown className="w-4 h-4 text-amber-400 crown-glow shrink-0" />}
                      {activePartner.isMuted && (
                        <span className="text-red-400 text-xs inline-flex items-center" title="Замучен">
                          <VolumeX className="w-4 h-4 inline" />
                        </span>
                      )}
                      {activePartner.audioStatusUrl && (
                        <button
                          type="button"
                          onClick={() => togglePlayAudioBio(activePartner.id, activePartner.audioStatusUrl)}
                          className="inline-flex items-center gap-1 text-[11px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full hover:bg-rose-500/25 border border-rose-500/20 cursor-pointer ml-1 font-normal"
                          title="Слушать аудио-статус собеседника"
                        >
                          {playingBioUserId === activePartner.id ? (
                            <Pause className="w-3 h-3 fill-current" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                          <span>Аудио-статус</span>
                        </button>
                      )}
                    </div>

                    {/* VIVID AUDIO AND TYPING STATUS DISPLAY */}
                    <div className="text-xs truncate transition-all duration-200">
                      {partnerActivity === 'recording' ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isPartnerOnline && (
                            <>
                              <span className="text-emerald-400 font-medium flex items-center gap-1 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>в сети</span>
                              </span>
                              <span className="text-slate-600">•</span>
                            </>
                          )}
                          <span className="text-rose-400 font-semibold flex items-center gap-1.5 animate-pulse bg-rose-500/15 px-2.5 py-0.5 rounded-md border border-rose-500/30 shadow-sm">
                            <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>записывает аудио</span>
                            <div className="flex items-center gap-0.5 h-3 ml-0.5">
                              <span className="w-0.5 bg-rose-400 rounded-full animate-wave-1" />
                              <span className="w-0.5 bg-rose-400 rounded-full animate-wave-2" />
                              <span className="w-0.5 bg-rose-400 rounded-full animate-wave-3" />
                              <span className="w-0.5 bg-rose-400 rounded-full animate-wave-4" />
                            </div>
                          </span>
                        </div>
                      ) : partnerActivity === 'typing' ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isPartnerOnline && (
                            <>
                              <span className="text-emerald-400 font-medium flex items-center gap-1 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>в сети</span>
                              </span>
                              <span className="text-slate-600">•</span>
                            </>
                          )}
                          <span className="text-indigo-400 font-semibold flex items-center gap-1.5 animate-pulse bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 shadow-sm">
                            <PenLine className="w-3.5 h-3.5 shrink-0" />
                            <span>печатает</span>
                            <span className="inline-flex gap-0.5 font-bold">
                              <span className="animate-bounce">.</span>
                              <span className="animate-bounce [animation-delay:0.2s]">.</span>
                              <span className="animate-bounce [animation-delay:0.4s]">.</span>
                            </span>
                          </span>
                        </div>
                      ) : isPartnerOnline ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <span>в сети</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400 font-normal">@{activePartner.username}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                          <span>{formatLastSeen(partnerLastSeen, false)}</span>
                          <span className="text-slate-600">•</span>
                          <span>@{activePartner.username}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Admin Mute Button */}
                  {isUserAdmin && activePartner.id !== currentUser.id && (
                    <button
                      onClick={() => toggleMute(activePartner)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activePartner.isMuted
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                      }`}
                    >
                      {activePartner.isMuted ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5" /> Размутить
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5" /> Замутить
                        </>
                      )}
                    </button>
                  )}

                  {/* Voice Assistant button */}
                  <button
                    type="button"
                    onClick={() => setIsVoiceAssistantOpen(true)}
                    className="p-2 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/25 rounded-lg transition-colors cursor-pointer"
                    title="Voice Assistant — Голосовые команды Gemini"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>

                  {/* Chat Analytics button */}
                  <button
                    type="button"
                    onClick={() => {
                      setChatThemeModalTab('analytics');
                      setIsChatThemeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Analytics — Статистика чата"
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>

                  {/* Chat Theme Settings button */}
                  <button
                    type="button"
                    onClick={() => {
                      setChatThemeModalTab('settings');
                      setIsChatThemeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Тема, экспорт и аналитика чата"
                  >
                    <Palette className="w-5 h-5" />
                  </button>

                  {/* Search in chat toggle */}
                  <InChatSearchTrigger
                    isOpen={isInChatSearchOpen}
                    hasActiveQuery={Boolean(inChatSearch.trim())}
                    onToggle={() => {
                      if (isInChatSearchOpen || inChatSearch.trim()) {
                        setIsInChatSearchOpen(false);
                        setInChatSearch('');
                      } else {
                        setIsInChatSearchOpen(true);
                      }
                    }}
                    title="Поиск в чате"
                  />
                </div>
              </div>

              {/* Pinned Message Bar for Direct Chat */}
              {activePinnedMessage && (
                <div className="px-4 py-2 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs select-none backdrop-blur-xs shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Закрепленное сообщение</div>
                      <div className="text-white truncate">
                        <span className="font-semibold text-indigo-300 mr-1">{activePinnedMessage.senderName}:</span>
                        <span>{activePinnedMessage.text}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnpinMessage}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Открепить"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Messages Stream Wrapper with Floating InChatSearch Sub-Header */}
              <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
                <InChatSearch
                  value={inChatSearch}
                  onChange={setInChatSearch}
                  isOpen={isInChatSearchOpen}
                  onClose={() => setIsInChatSearchOpen(false)}
                  placeholder="Поиск в чате..."
                  matchCount={activeChatMessages.length}
                  totalCount={rawActiveChatMessages.length}
                />

                {/* Messages Area */}
                <div
                  className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 transition-all duration-300 ${
                    isInChatSearchOpen || inChatSearch.trim() ? 'pt-16 sm:pt-18' : ''
                  }`}
                  style={getChatBackgroundStyle(activeChatTheme)}
                >
                {activeChatMessages.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm mt-16 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-indigo-400">
                      {inChatSearch.trim() ? <Search className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                    </div>
                    {inChatSearch.trim() ? (
                      <>
                        <span className="font-medium text-slate-400">По запросу «{inChatSearch}» ничего не найдено</span>
                        <button
                          type="button"
                          onClick={() => setInChatSearch('')}
                          className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Сбросить поиск
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-slate-400">История сообщений пуста</span>
                        <span className="text-xs text-slate-500">Отправьте сообщение или голосовую заметку</span>
                      </>
                    )}
                  </div>
                ) : (
                  activeChatMessages.map((msg, index) => {
                    const isMe = isMyMessage(msg);
                    const sender = allUsersMap[msg.senderId] || activePartner;
                    const senderName = sender ? sender.name : 'Собеседник';
                    const timeStr = new Date(msg.time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const currentDateGroup = formatDateDivider(msg.time);
                    const prevMsg = index > 0 ? activeChatMessages[index - 1] : null;
                    const prevDateGroup = prevMsg ? formatDateDivider(prevMsg.time) : null;
                    const showDateDivider = currentDateGroup !== prevDateGroup;

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-3 select-none">
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50 shadow-xs">
                              {currentDateGroup}
                            </span>
                          </div>
                        )}

                        <div className={`flex w-full items-start gap-2 ${isMe ? 'justify-end' : 'justify-start'} group/msg relative`}>
                          {!isMe && (
                            <div className="w-8 h-8 mt-1 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden border border-slate-600">
                              {sender?.avatar ? (
                                <img src={sender.avatar} alt={senderName} className="w-full h-full object-cover" />
                              ) : (
                                (senderName[0] || '?').toUpperCase()
                              )}
                            </div>
                          )}
                          <div
                            className={`flex flex-col max-w-[80%] sm:max-w-[68%] ${
                              isMe ? 'items-end ml-auto' : 'items-start mr-auto'
                            }`}
                          >
                            <div
                              className={`w-fit max-w-full rounded-2xl px-4 py-2.5 relative shadow-sm transition-all ${
                                isMe
                                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 text-white rounded-br-none shadow-indigo-600/10'
                                  : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-xs'
                              }`}
                              style={isMe ? getChatBubbleStyle(activeChatTheme) : undefined}
                            >
                              {/* Forwarded Badge */}
                              {msg.forwardedFrom && (
                                <div className={`mb-1.5 flex items-center gap-1 text-[11px] italic select-none ${
                                  isMe ? 'text-indigo-100/90' : 'text-indigo-300/90'
                                }`}>
                                  <Forward className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Переслано от <strong className="font-semibold not-italic">{msg.forwardedFrom.senderName}</strong></span>
                                </div>
                              )}

                              {/* Reply Quote Preview */}
                              {msg.replyTo && (
                                <div className={`mb-2 pl-2.5 py-1 pr-2 rounded-r-lg border-l-2 text-xs select-none ${
                                  isMe
                                    ? 'border-white/80 bg-black/15 text-indigo-100'
                                    : 'border-indigo-400 bg-slate-900/60 text-slate-300'
                                }`}>
                                  <div className="font-semibold text-[11px] truncate flex items-center gap-1">
                                    <CornerUpLeft className="w-3 h-3 shrink-0" />
                                    <span>{msg.replyTo.senderName}</span>
                                  </div>
                                  <div className="truncate opacity-80 text-[11px] mt-0.5">
                                    {msg.replyTo.text ? highlightMatchedText(msg.replyTo.text, inChatSearch) : (msg.replyTo.type === 'voice' ? 'Голосовое сообщение' : 'Фотография')}
                                  </div>
                                </div>
                              )}

                              {/* Image rendering */}
                              {msg.type === 'image' && msg.imageUrl && (
                                <div className="mb-2 -mx-1 -mt-1 rounded-xl overflow-hidden bg-black/20">
                                  <img
                                    src={msg.imageUrl}
                                    alt="Изображение"
                                    onClick={() => setLightboxImage(msg.imageUrl || null)}
                                    className="max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                                  />
                                </div>
                              )}

                              {msg.type === 'poll' && msg.poll ? (
                                <PollCard
                                  poll={msg.poll}
                                  isMe={isMe}
                                  currentUserId={currentUser.id}
                                  usersMap={allUsersMap}
                                  onVote={(optId) => handleVotePoll(msg, optId)}
                                />
                              ) : msg.type === 'voice' ? (
                                <VoiceMessagePlayer
                                  audioUrl={msg.audioUrl}
                                  isMe={isMe}
                                  timeStr={timeStr}
                                  initialDuration={msg.duration}
                                  initialSummary={msg.summary}
                                  onSaveSummary={(s) => handleSaveVoiceSummary(msg.id, s)}
                                />
                              ) : (
                                msg.text && <div className="text-sm break-words whitespace-pre-wrap leading-relaxed">{highlightMatchedText(msg.text, inChatSearch)}</div>
                              )}

                              <div className={`text-[10px] flex items-center justify-end gap-1 mt-1 select-none ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {msg.editedAt && <span className="italic opacity-80">изм.</span>}
                                <span>{timeStr}</span>
                                {isMe &&
                                  isUserReadReceiptsEnabled(allUsersMap[currentUser.id] || currentUser) &&
                                  isUserReadReceiptsEnabled(activePartner) && (
                                    isMessageRead(msg) ? (
                                      <span title="Прочитано" className="inline-flex items-center">
                                        <CheckCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                                      </span>
                                    ) : (
                                      <span title="Доставлено" className="inline-flex items-center">
                                        <Check className="w-3.5 h-3.5 text-indigo-200/75 shrink-0" />
                                      </span>
                                    )
                                  )}
                              </div>
                            </div>

                            {/* Emoji Reactions Badges below Direct Message Bubble */}
                            {(() => {
                              const reactionsList = getMessageReactions(msg);
                              if (reactionsList.length === 0) return null;
                              return (
                                <div
                                  className={`mt-1 flex flex-wrap items-center gap-1 select-none ${
                                    isMe ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  {reactionsList.map((r) => (
                                    <button
                                      key={r.emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg, r.emoji)}
                                      title={`Реакция ${r.emoji}: ${r.userNames.join(', ')}`}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all cursor-pointer ${
                                        r.reactedByMe
                                          ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-100 shadow-xs'
                                          : 'bg-slate-800/85 border-slate-700/80 text-slate-300 hover:bg-slate-700/80'
                                      }`}
                                    >
                                      <span>{r.emoji}</span>
                                      <span className="text-[11px] font-semibold">{r.count}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Quick Actions on Hover */}
                          <div className={`opacity-0 group-hover/msg:opacity-100 transition-opacity absolute -top-3 ${
                            isMe ? 'right-2' : 'left-2'
                          } bg-slate-800 border border-slate-700/80 rounded-lg p-0.5 shadow-md flex items-center gap-0.5 z-10 backdrop-blur-xs`}>
                            <div className="flex items-center gap-0.5 pr-1 mr-0.5 border-r border-slate-700/80">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg, emoji)}
                                  className="px-1 py-0.5 text-xs hover:scale-125 rounded hover:bg-slate-700/80 transition-transform cursor-pointer leading-none"
                                  title={`Реакция ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplyTarget(msg)}
                              className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Ответить"
                            >
                              <CornerUpLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setForwardTargetMsg(msg);
                                setForwardSearchQuery('');
                              }}
                              className="p-1 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Переслать"
                            >
                              <Forward className="w-3 h-3" />
                            </button>
                            {msg.type !== 'voice' && msg.text && (
                              <button
                                type="button"
                                onClick={() => copyMessageText(msg.id, msg.text || '')}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Копировать текст"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                            {isMe && msg.type === 'text' && (
                              <button
                                type="button"
                                onClick={() => handleStartEditMessage(msg)}
                                className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Редактировать сообщение"
                              >
                                <PenLine className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSaveToBookmarks(msg)}
                              className={`p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer ${
                                savedToastMsgId === msg.id
                                  ? 'text-amber-400'
                                  : 'text-slate-400 hover:text-amber-300'
                              }`}
                              title="Сохранить в Избранное"
                            >
                              <Bookmark className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePinMessage(msg)}
                              className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                              title={activePinnedMessage?.messageId === msg.id ? 'Открепить' : 'Закрепить'}
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                            {(isMe || isUserAdmin) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Удалить сообщение"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}

                {/* Floating typing/recording bubbles in the chat stream */}
                {partnerActivity === 'recording' && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-rose-400 border border-rose-500/30 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2.5 shadow-lg">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 pulse-record" />
                      <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                      <span className="text-xs text-rose-200 font-medium">
                        {activePartner.name} записывает аудио
                      </span>
                      <div className="flex items-center gap-0.5 h-3 ml-1">
                        <span className="w-0.5 bg-rose-400 rounded-full animate-wave-1" />
                        <span className="w-0.5 bg-rose-400 rounded-full animate-wave-2" />
                        <span className="w-0.5 bg-rose-400 rounded-full animate-wave-3" />
                        <span className="w-0.5 bg-rose-400 rounded-full animate-wave-4" />
                      </div>
                    </div>
                  </div>
                )}

                {partnerActivity === 'typing' && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-indigo-400 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 shadow-md">
                      <PenLine className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                      <span className="text-xs text-slate-300 font-medium">{activePartner.name} печатает</span>
                      <span className="flex items-center gap-1 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-700">
                {currentUser.isMuted ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs text-red-400 font-medium">
                    <VolumeX className="w-4 h-4 inline-block mr-1 align-sub" /> Вы замучены администратором и не
                    можете отправлять сообщения.
                  </div>
                ) : (
                  <div>
                    {/* Editing Message Preview */}
                    {editingMessage && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PenLine className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0 text-xs">
                            <div className="text-indigo-300 font-semibold">Редактирование сообщения</div>
                            <div className="text-slate-300 truncate text-[11px]">{editingMessage.text}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessage(null);
                            setTextMessage('');
                          }}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 cursor-pointer"
                          title="Отменить редактирование"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Reply Preview */}
                    {replyTarget && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-1 h-8 bg-indigo-500 rounded-full shrink-0" />
                          <div className="min-w-0 text-xs">
                            <div className="text-indigo-400 font-semibold flex items-center gap-1">
                              <CornerUpLeft className="w-3 h-3" />
                              <span>Ответ {allUsersMap[replyTarget.senderId]?.name || 'Собеседник'}</span>
                            </div>
                            <div className="text-slate-300 truncate text-[11px]">
                              {replyTarget.text || (replyTarget.type === 'voice' ? 'Голосовое сообщение' : 'Фотография')}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyTarget(null)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 cursor-pointer transition-colors"
                          title="Отменить ответ"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Image Preview */}
                    {selectedImage && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="flex items-center gap-3">
                          <img src={selectedImage} alt="Превью" className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />
                          <div className="text-xs">
                            <div className="text-white font-medium">Фотография прикреплена</div>
                            <div className="text-slate-400 text-[11px]">Добавьте подпись или нажмите «Отправить»</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
                          title="Удалить фото"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Visual confirmation badge for typing */}
                    {isMyTypingActive && (
                      <div className="max-w-4xl mx-auto mb-1.5 px-1 text-[11px] text-indigo-400 flex items-center gap-1.5 animate-pulse">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                        <span>Вы печатаете... Собеседник видит статус «печатает»</span>
                      </div>
                    )}

                    <div className="max-w-4xl mx-auto flex items-end gap-2 relative">
                      {!isRecording ? (
                        <>
                          <button
                            type="button"
                            onClick={() => imageFileInputRef.current?.click()}
                            className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                            title="Прикрепить фото"
                          >
                            <Paperclip className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPollModalOpen(true)}
                            className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                            title="Создать опрос (голосование)"
                          >
                            <BarChart2 className="w-5 h-5" />
                          </button>
                          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-1 flex items-center focus-within:border-indigo-500 transition-colors">
                            <textarea
                              rows={1}
                              placeholder="Введите сообщение..."
                              value={textMessage}
                              onChange={handleTextInputChange}
                              onKeyDown={handleKeyDown}
                              className="w-full bg-transparent resize-none outline-none text-white px-3 py-2 text-sm max-h-32 min-h-[40px]"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-rose-500 pulse-record" />
                            <span className="text-sm font-mono text-rose-400 font-bold">
                              {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                              {String(recordSeconds % 60).padStart(2, '0')}
                            </span>
                            <span className="text-xs text-rose-300 font-medium hidden sm:inline">
                              (собеседник видит статус: «записывает аудио»)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded bg-slate-800 cursor-pointer transition-colors"
                            >
                              Отмена
                            </button>
                            <button
                              type="button"
                              onClick={sendRecording}
                              className="text-xs text-white px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 cursor-pointer font-medium transition-colors"
                            >
                              Отправить
                            </button>
                          </div>
                        </div>
                      )}

                      {!isRecording && (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="Голосовое сообщение"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}

                      {!isRecording && (
                        <button
                          type="button"
                          onClick={handleSendTextMessage}
                          className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shrink-0 transition-colors cursor-pointer"
                          title="Отправить"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty Chat State */
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-indigo-400">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">CosmoChat</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">
                Выберите диалог или группу из списка слева, либо создайте новую группу
              </p>
              <button
                onClick={() => {
                  setGroupModalMode('create');
                  setIsGroupModalOpen(true);
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Создать группу
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GROUP MODAL (Create & Info) */}
      <GroupModal
        mode={groupModalMode}
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        currentUser={currentUser}
        allUsers={Object.values(allUsersMap)}
        currentGroup={activeGroup}
        messages={rawActiveChatMessages}
        usersMap={allUsersMap}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onLeaveGroup={handleLeaveGroup}
        onAddMember={handleAddMemberToGroup}
        onRemoveMember={handleRemoveMemberFromGroup}
      />

      {/* CHAT THEME & SETTINGS MODAL (Per-chat bubble color, background, export & analytics) */}
      <ChatThemeModal
        isOpen={isChatThemeModalOpen}
        onClose={() => setIsChatThemeModalOpen(false)}
        chatTitle={activeGroup ? activeGroup.name : activePartner?.name || 'Чат'}
        isGroup={Boolean(activeGroup)}
        currentTheme={activeChatTheme}
        onSaveTheme={handleSaveActiveChatTheme}
        messages={rawActiveChatMessages}
        usersMap={allUsersMap}
        initialTab={chatThemeModalTab}
      />

      {/* CHAT FOLDERS MODAL (Work, Friends, Archived & Custom Folders) */}
      <ChatFoldersModal
        isOpen={isFoldersModalOpen}
        onClose={() => {
          setIsFoldersModalOpen(false);
          setFoldersModalInitialCreateMode(false);
          setQuickAssignChat(null);
        }}
        folders={userChatFolders}
        onSaveFolders={handleSaveChatFolders}
        onSelectFolder={(fid) => {
          setActiveFolderId(fid);
          setSidebarTab('all');
        }}
        allUsers={Object.values(allUsersMap)}
        userGroups={Object.values(allGroupsMap).filter((g) =>
          getGroupMembers(g).includes(currentUser.id)
        )}
        currentUserId={currentUser.id}
        initialSelectedFolderId={foldersModalInitialId}
        initialCreateMode={foldersModalInitialCreateMode}
        quickAssignChat={quickAssignChat}
      />

      {/* VOICE ASSISTANT MODAL (Gemini Voice Transcription & Command Execution) */}
      <VoiceAssistantModal
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        currentUser={currentUser}
        contacts={Object.values(allUsersMap)}
        groups={Object.values(allGroupsMap).filter((g) =>
          getGroupMembers(g).includes(currentUser.id)
        )}
        folders={userChatFolders}
        activeChatTitle={activeGroup ? activeGroup.name : activePartner?.name || ''}
        onExecuteCommand={handleExecuteVoiceCommand}
      />

      {/* INTERACTIVE POLL MODAL */}
      <PollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        onCreatePoll={handleCreatePoll}
      />

      {/* PROFILE MODAL */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 sm:p-8 shadow-2xl my-auto">
            <div className="text-center mb-6">
              {/* Avatar Preview & Upload */}
              <div className="relative w-20 h-20 mx-auto mb-2 group">
                <div className="w-20 h-20 rounded-full bg-indigo-500 border-2 border-indigo-400 flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-lg">
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    currentUser.name?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <label
                  htmlFor="editAvatarFileInput"
                  className="absolute inset-0 bg-slate-950/70 rounded-full flex flex-col items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span>Изменить</span>
                </label>
                <input
                  id="editAvatarFileInput"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFile}
                  className="hidden"
                />
              </div>

              {editAvatarPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setEditAvatarPreview('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-red-400 hover:text-red-300 mb-3 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Удалить фото
                </button>
              )}

              <h2 className="text-2xl font-bold text-white">Настройки профиля</h2>
              <p
                className={`text-xs mt-1 ${
                  isUserAdmin ? 'text-amber-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {isUserAdmin
                  ? 'Режим Администратора: кулдаун отключен'
                  : 'Смена данных доступна раз в 24 часа'}
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Имя</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setProfileError('');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-500">@</span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => {
                      setEditUsername(e.target.value);
                      setProfileError('');
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Статус профиля (о себе)</label>
                <input
                  type="text"
                  placeholder="Например: В космосе, не беспокоить"
                  value={editCustomStatus}
                  onChange={(e) => setEditCustomStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500"
                />
              </div>

              {/* Audio Status in Profile */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Аудио-статус (голосовая визитка)
                </label>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-xs text-slate-300 truncate">
                      {isRecordingAudioStatus
                        ? `Запись... ${audioStatusRecordSeconds} сек`
                        : editAudioStatusUrl
                        ? 'Аудио-статус записан'
                        : 'Нет аудио-статуса'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isRecordingAudioStatus ? (
                      <button
                        type="button"
                        onClick={stopRecordingAudioStatus}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg cursor-pointer animate-pulse"
                      >
                        Стоп
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={startRecordingAudioStatus}
                          className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium rounded-lg border border-rose-500/30 cursor-pointer flex items-center gap-1"
                        >
                          <Mic className="w-3 h-3" />
                          <span>{editAudioStatusUrl ? 'Перезаписать' : 'Записать'}</span>
                        </button>

                        {editAudioStatusUrl && (
                          <button
                            type="button"
                            onClick={() => setEditAudioStatusUrl('')}
                            className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                            title="Удалить аудио-статус"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Read Receipts Toggle in Profile Settings */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <CheckCheck className={`w-4 h-4 shrink-0 ${editReadReceipts ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span>Отчеты о прочтении</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {editReadReceipts
                      ? 'Включены: собеседники видят галочки прочтения ваших сообщений'
                      : 'Отключены: ваш статус прочтения и галочки скрыты от других'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editReadReceipts}
                  onClick={() => handleToggleReadReceipts(!editReadReceipts)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    editReadReceipts ? 'bg-indigo-500' : 'bg-slate-700'
                  }`}
                  title={editReadReceipts ? 'Отключить отчеты о прочтении' : 'Включить отчеты о прочтении'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      editReadReceipts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Новый пароль (оставьте пустым, если не меняете)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="Новый пароль"
                    value={editPassword}
                    onChange={(e) => {
                      setEditPassword(e.target.value);
                      setProfileError('');
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {profileError && (
                <div className="text-xs text-red-400 text-center font-medium leading-relaxed">
                  {profileError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl transition-colors text-sm font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIDDEN IMAGE FILE INPUT */}
      <input
        type="file"
        ref={imageFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* FORWARD MESSAGE MODAL */}
      {forwardTargetMsg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setForwardTargetMsg(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Forward className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Переслать сообщение</h3>
                  <p className="text-xs text-slate-400">Выберите чат или группу для отправки</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForwardTargetMsg(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview of message being forwarded */}
            <div className="my-3 px-3 py-2 bg-slate-800/70 border border-slate-700/70 rounded-xl flex items-center gap-2.5">
              <div className="w-1 h-8 bg-sky-400 rounded-full shrink-0" />
              <div className="min-w-0 flex-1 text-xs">
                <div className="text-sky-400 font-semibold truncate">
                  {forwardTargetMsg.senderId === currentUser.id
                    ? 'Вы'
                    : allUsersMap[forwardTargetMsg.senderId]?.name || forwardTargetMsg.senderName || 'Пользователь'}
                </div>
                <div className="text-slate-300 truncate mt-0.5">
                  {forwardTargetMsg.text ||
                    (forwardTargetMsg.type === 'voice' ? '🎤 Голосовое сообщение' : '📷 Фотография')}
                </div>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                placeholder="Поиск чата или группы..."
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* List of available groups and chats */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {(() => {
                const q = normalizeStr(forwardSearchQuery);
                const availableGroups = Object.values(allGroupsMap).filter((g) => {
                  if (!getGroupMembers(g).includes(currentUser.id)) return false;
                  if (g.id === activeGroupId) return false;
                  if (!q) return true;
                  return normalizeStr(g.name).includes(q) || normalizeStr(g.description).includes(q);
                });

                const availableUsers = Object.values(allUsersMap).filter((u) => {
                  if (u.id === currentUser.id) return false;
                  if (u.id === activeChatUserId) return false;
                  if (!q) return true;
                  return (
                    normalizeStr(u.name).includes(q) ||
                    normalizeStr(u.username).includes(q) ||
                    normalizeStr(u.phone).includes(q)
                  );
                });

                if (availableGroups.length === 0 && availableUsers.length === 0) {
                  return (
                    <div className="text-center py-8 text-sm text-slate-500">
                      Другие чаты или группы не найдены
                    </div>
                  );
                }

                return (
                  <>
                    {availableGroups.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
                          Группы
                        </div>
                        {availableGroups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => handleForwardMessage({ type: 'group', id: group.id })}
                            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-colors text-left group cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                                {group.avatar?.startsWith('data:') || group.avatar?.startsWith('http') ? (
                                  <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                                ) : (
                                  (group.name[0] || 'Г').toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span className="truncate">{group.name}</span>
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                  {getGroupMembers(group).length} участников
                                </div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 group-hover:bg-sky-500 group-hover:text-white text-xs font-medium transition-colors shrink-0 flex items-center gap-1">
                              <Send className="w-3 h-3" />
                              Отправить
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {availableUsers.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
                          Личные чаты
                        </div>
                        {availableUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleForwardMessage({ type: 'user', id: user.id })}
                            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-colors text-left group cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden border border-slate-600">
                                {user.avatar ? (
                                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                  (user.name[0] || '?').toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate">
                                  {user.name}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                  @{user.username}
                                </div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 group-hover:bg-sky-500 group-hover:text-white text-xs font-medium transition-colors shrink-0 flex items-center gap-1">
                              <Send className="w-3 h-3" />
                              Отправить
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2.5 text-white/70 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Просмотр"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
