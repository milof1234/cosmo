export interface ChatTheme {
  bubbleColorId?: string;
  customBubbleHex?: string;
  bgGradientId?: string;
  customBgHexFrom?: string;
  customBgHexTo?: string;
  wallpaperId?: string;
  wallpaperUrl?: string;
  wallpaperDimming?: number;
}

export interface ChatFolder {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  chatIds: string[];
  isArchivedFolder?: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  email?: string;
  password?: string;
  avatar?: string;
  isMuted?: boolean;
  lastProfileChange?: number;
  isOnline?: boolean;
  lastSeen?: number;
  customStatus?: string;
  audioStatusUrl?: string; // Voice status bio
  audioStatusDuration?: number;
  activity?: UserActivity;
  settings?: {
    chatThemes?: Record<string, ChatTheme>;
    readReceipts?: boolean;
    chatFolders?: ChatFolder[];
  };
}

export interface MessageReply {
  id: string;
  senderName: string;
  text?: string;
  type?: 'text' | 'voice' | 'image' | 'poll';
}

export interface MessageForward {
  senderId?: string;
  senderName: string;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds?: string[] | Record<string, boolean>;
}

export interface PollData {
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
  isAnonymous?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  creatorId: string;
  memberIds: string[];
  createdAt: number;
  updatedAt?: number;
  pinnedMessageId?: string;
  theme?: ChatTheme;
  wallpaperId?: string;
  wallpaperUrl?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderPhone?: string;
  receiverId?: string; // For 1-on-1 private chat
  groupId?: string;    // For group chats
  time: string;
  type: 'text' | 'voice' | 'image' | 'poll';
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  summary?: string;
  replyTo?: MessageReply;
  forwardedFrom?: MessageForward;
  poll?: PollData;
  editedAt?: string;
  isPinned?: boolean;
  readBy?: string[] | Record<string, boolean>;
  reactions?: Record<string, string[] | Record<string, boolean>>;
}

export interface UserActivity {
  targetId?: string; // userId or groupId
  status: 'typing' | 'recording' | 'idle';
  updatedAt: number;
  userName?: string;
}
