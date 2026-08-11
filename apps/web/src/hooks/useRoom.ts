import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents, RoomState, JoinRoomPayload } from '@youtube-together/shared';
import { getAvatarUrl } from '../pages/LandingPage';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';

export function getOrCreateParticipant() {
  const loggedInUserStr = localStorage.getItem('snyx_user');
  if (loggedInUserStr) {
    try {
      const user = JSON.parse(loggedInUserStr);
      if (user && user.userId && user.username) {
        return {
          participantId: user.userId,
          displayName: user.displayName || user.username,
          profilePicture: getAvatarUrl(user.profilePicture, user.gender),
          token: user.token
        };
      }
    } catch (e) {}
  }

  let participantId = localStorage.getItem('together_participant_id');
  if (!participantId) {
    participantId = 'usr_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('together_participant_id', participantId);
  }
  let displayName = localStorage.getItem('together_display_name');
  if (!displayName) {
    const defaultNames = ['Aura', 'Tempo', 'Beat', 'Echo', 'Harmony', 'Melody', 'Vibe', 'Sonic'];
    displayName = defaultNames[Math.floor(Math.random() * defaultNames.length)];
    localStorage.setItem('together_display_name', displayName);
  }
  return { participantId, displayName, profilePicture: '' };
}

export function useRoom(roomId: string | null) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { participantId, displayName: storedDisplayName } = getOrCreateParticipant();
  const [displayName, setDisplayName] = useState(storedDisplayName);

  // Update display name
  const updateDisplayName = (newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    localStorage.setItem('together_display_name', cleanName);
    setDisplayName(cleanName);
    
    // Re-join with new display name if socket is active
    if (socketRef.current && socketRef.current.connected && roomId) {
      const payload: JoinRoomPayload = {
        roomId,
        displayName: cleanName,
        participantId,
      };
      socketRef.current.emit(SocketEvents.ROOM_JOIN, payload);
    }
  };

  useEffect(() => {
    if (!roomId) {
      setRoomState(null);
      return;
    }

    // Connect to Socket.IO server
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      setError(null);

      // Join the room
      const payload: JoinRoomPayload = {
        roomId,
        displayName,
        participantId,
      };
      socket.emit(SocketEvents.ROOM_JOIN, payload);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on(SocketEvents.ROOM_STATE, (state: RoomState) => {
      setRoomState(state);
    });

    socket.on(SocketEvents.CHAT_MESSAGE, (msg: any) => {
      setRoomState((prevState) => {
        if (!prevState) return null;
        const exists = prevState.chatMessages.some((m) => m.id === msg.id);
        if (exists) return prevState;
        return {
          ...prevState,
          chatMessages: [...prevState.chatMessages, msg],
        };
      });
    });

    socket.on(SocketEvents.ERROR, (err: { message: string }) => {
      setError(err.message);
    });

    // Cleanup on unmount
    return () => {
      if (socket.connected) {
        socket.emit(SocketEvents.ROOM_LEAVE, { roomId, participantId });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomId, displayName, participantId]);

  // Synchronized Playback Actions
  const play = (position: number) => {
    setRoomState((prev) => (prev ? { ...prev, isPlaying: true, position, playbackStartedAt: Date.now() } : null));
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_PLAY, { roomId, position });
    }
  };

  const pause = (position: number) => {
    setRoomState((prev) => (prev ? { ...prev, isPlaying: false, position, playbackStartedAt: null } : null));
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_PAUSE, { roomId, position });
    }
  };

  const seek = (position: number) => {
    setRoomState((prev) => (prev ? { ...prev, position, playbackStartedAt: prev.isPlaying ? Date.now() : null } : null));
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_SEEK, { roomId, position });
    }
  };

  const loadVideo = (videoId: string, title: string, thumbnail: string, channelTitle: string) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_LOAD, {
        roomId,
        videoId,
        title,
        thumbnail,
        channelTitle,
      });
    }
  };

  const nextVideo = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_NEXT, { roomId });
    }
  };

  const sendPlaybackEnded = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_ENDED, { roomId });
    }
  };

  // Synchronized Queue Actions
  const addToQueue = (videoId: string, title: string, thumbnail: string, channelTitle: string, duration?: number) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.QUEUE_ADD, {
        roomId,
        videoId,
        title,
        thumbnail,
        channelTitle,
        duration,
        participantId,
        displayName,
      });
    }
  };

  const removeFromQueue = (itemId: string) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.QUEUE_REMOVE, { roomId, itemId });
    }
  };

  const playQueueItem = (itemId: string) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.PLAYBACK_PLAY_QUEUE_ITEM, { roomId, itemId });
    }
  };

  const reorderQueue = (startIndex: number, endIndex: number) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit(SocketEvents.QUEUE_REORDER, { roomId, startIndex, endIndex });
    }
  };

  const sendChatMessage = (content: string) => {
    if (socketRef.current && roomId && content.trim()) {
      const { displayName: latestName, profilePicture: latestAvatar } = getOrCreateParticipant();
      socketRef.current.emit(SocketEvents.CHAT_MESSAGE, {
        roomId,
        senderId: participantId,
        senderName: latestName,
        senderAvatar: latestAvatar || undefined,
        content: content.trim(),
      });
    }
  };

  return {
    roomState,
    socketConnected,
    error,
    participantId,
    displayName,
    updateDisplayName,
    play,
    pause,
    seek,
    loadVideo,
    nextVideo,
    sendPlaybackEnded,
    addToQueue,
    removeFromQueue,
    playQueueItem,
    reorderQueue,
    sendChatMessage,
  };
}
