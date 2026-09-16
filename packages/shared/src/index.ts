export interface RoomUser {
  participantId: string;
  displayName: string;
  isConnected: boolean;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: number;
  addedBy: string;
  addedAt: number;
}

export interface ChatMessageReaction {
  id: string;
  messageId: string;
  participantId: string;
  displayName: string;
  emoji: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  replyToId?: string;
  replyToSenderName?: string;
  replyToContent?: string;
  isEdited?: boolean;
  isDelivered?: boolean;
  isRead?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  createdAt: number;
  reactions?: ChatMessageReaction[];
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName?: string;
  profilePicture?: string;
  bio?: string;
  profileBanner?: string;
  gender?: string;
  isPrivate?: boolean;
  token?: string;
  homeRoomId?: string;
  showActiveStatus?: boolean;
  isOnline?: boolean | null;
}

export interface RoomState {
  roomId: string;
  currentVideoId: string | null;
  currentVideoTitle: string | null;
  currentVideoThumbnail: string | null;
  isPlaying: boolean;
  position: number;
  playbackStartedAt: number | null; // Server timestamp in ms
  serverTime?: number; // Server timestamp in ms
  queue: QueueItem[];
  users: RoomUser[];
  chatMessages: ChatMessage[];
  isPermanent?: boolean;
  expiresAt?: number | null;
}

// ──────────────────────────────────────────────────
// Knock system interfaces
// ──────────────────────────────────────────────────

export interface HomeKnockPayload {
  targetUsername: string;
}

export interface HomeKnockIncoming {
  knockId: string;
  knocker: {
    userId: string;
    username: string;
    displayName?: string;
    profilePicture?: string;
  };
  knockedAt: number;
}

export interface HomeKnockResponse {
  knockId: string;
  action: 'admit' | 'wait';
}

export interface HomeKnockAdmitted {
  knockId: string;
  roomId: string;
}

export interface MissedKnock {
  knockId: string;
  knocker: {
    userId: string;
    username: string;
    displayName?: string;
    profilePicture?: string;
  };
  knockedAt: number;
}

// ──────────────────────────────────────────────────
// Playlist interfaces
// ──────────────────────────────────────────────────

export interface PlaylistData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  createdAt: number;
  updatedAt: number;
  items?: PlaylistItemData[];
}

export interface PlaylistItemData {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  duration?: number;
  sourceUrl: string;
  order: number;
  addedAt: number;
}

// ──────────────────────────────────────────────────
// Socket events
// ──────────────────────────────────────────────────

export const SocketEvents = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  PLAYBACK_PLAY: 'playback:play',
  PLAYBACK_PAUSE: 'playback:pause',
  PLAYBACK_SEEK: 'playback:seek',
  PLAYBACK_LOAD: 'playback:load',
  PLAYBACK_NEXT: 'playback:next',
  PLAYBACK_PREVIOUS: 'playback:previous',
  PLAYBACK_ENDED: 'playback:ended',
  PLAYBACK_PLAY_QUEUE_ITEM: 'playback:play-queue-item',
  QUEUE_ADD: 'queue:add',
  QUEUE_REMOVE: 'queue:remove',
  QUEUE_REORDER: 'queue:reorder',
  ROOM_STATE: 'room:state',
  ROOM_USER_JOINED: 'room:user-joined',
  ROOM_USER_LEFT: 'room:user-left',
  CHAT_MESSAGE: 'room:chat-message',
  CHAT_REACTION: 'room:chat-reaction',
  CHAT_DELETE: 'room:chat-delete',
  CHAT_EDIT: 'room:chat-edit',
  CHAT_TYPING: 'room:chat-typing',
  CHAT_READ: 'room:chat-read',
  CHAT_DELIVERED: 'room:chat-delivered',
  ROOM_USER_REMOVE: 'room:user-remove',
  ROOM_USER_KICKED: 'room:user-kicked',
  ERROR: 'room:error',

  // Knock system
  HOME_KNOCK: 'home:knock',
  HOME_KNOCK_INCOMING: 'home:knock-incoming',
  HOME_KNOCK_RESPONSE: 'home:knock-response',
  HOME_KNOCK_ADMITTED: 'home:knock-admitted',
  HOME_KNOCK_WAITING: 'home:knock-waiting',

  // Session management
  SESSION_FORCE_LOGOUT: 'session:force-logout',
} as const;

// ──────────────────────────────────────────────────
// Payloads
// ──────────────────────────────────────────────────

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
  participantId: string;
}

export interface ChatTypingPayload {
  roomId: string;
  participantId: string;
  displayName: string;
  isTyping: boolean;
}

export interface ChatReadPayload {
  roomId: string;
  participantId: string;
  messageIds?: string[];
}

export interface PlaybackPlayPayload {
  position: number;
}

export interface PlaybackSeekPayload {
  position: number;
}

export interface QueueAddPayload {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: number;
}

export interface QueueRemovePayload {
  itemId: string;
}

export interface QueueReorderPayload {
  startIndex: number;
  endIndex: number;
}

export interface ErrorPayload {
  message: string;
}
