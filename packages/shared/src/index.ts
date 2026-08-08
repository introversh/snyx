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

export interface RoomState {
  roomId: string;
  currentVideoId: string | null;
  currentVideoTitle: string | null;
  currentVideoThumbnail: string | null;
  isPlaying: boolean;
  position: number;
  playbackStartedAt: number | null; // Server timestamp in ms
  queue: QueueItem[];
  users: RoomUser[];
}

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
  ERROR: 'room:error'
} as const;

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
  participantId: string;
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
