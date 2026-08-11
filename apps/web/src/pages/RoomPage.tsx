import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Search,
  Plus,
  Trash2,
  Users,
  RefreshCw,
  Clock,
  Radio,
  MessageSquare,
  Send,
  LogOut,
  Camera,
  X
} from 'lucide-react';
import { useRoom } from '../hooks/useRoom';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import { getAvatarUrl } from './LandingPage';
import DmInboxModal from '../components/DmInboxModal';
import Navbar from '../components/Navbar';

interface RoomPageProps {
  roomId: string;
  onNavigate: (path: string) => void;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export default function RoomPage({ roomId, onNavigate }: RoomPageProps) {
  // Strict Login Check - redirect immediately if not logged in
  const storedUserStr = localStorage.getItem('snyx_user');
  if (!storedUserStr) {
    onNavigate('/');
    return null;
  }

  let currentUser: any = null;
  try {
    currentUser = JSON.parse(storedUserStr);
  } catch (e) {
    onNavigate('/');
    return null;
  }

  const {
    roomState,
    socketConnected,
    error,
    participantId,
    displayName,
    updateDisplayName,
    play,
    pause,
    seek,
    nextVideo,
    sendPlaybackEnded,
    addToQueue,
    removeFromQueue,
    playQueueItem,
    reorderQueue,
    sendChatMessage,
  } = useRoom(roomId);

  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);

  // Local UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  // Sliding Navigation Sidebar (Drawer) States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState(displayName);
  const [profileAvatarInput, setProfileAvatarInput] = useState('');
  const [profileBioInput, setProfileBioInput] = useState('');
  const [profileBannerInput, setProfileBannerInput] = useState('');
  const [profileGenderInput, setProfileGenderInput] = useState('male');
  const [profileSaving, setProfileSaving] = useState(false);

  // Tabbed Sidebar State
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'queue' | 'search'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesCountRef = useRef(0);
  const lastMsgRef = useRef<number>(0);

  // Chat Floating Notification Toast state
  const [chatToast, setChatToast] = useState<{ senderName: string; content: string } | null>(null);

  // Direct Messages (Inbox) Modal States
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);

  // Invite Friends Direct in-room Modal States
  const [isInviteFriendsOpen, setIsInviteFriendsOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Synchronous dragging flag to prevent race conditions during player updates
  const isDraggingRef = useRef(false);
  const isPlayingBusyRef = useRef(false);
  const [duration, setDuration] = useState(240);

  // Drag & Drop reorder index state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Search Debounce Ref
  const searchTimeoutRef = useRef<number | null>(null);

  // Save active room ID to local storage so navigation from profile page is seamless
  useEffect(() => {
    localStorage.setItem('snyx_active_room_id', roomId);
    return () => {
      localStorage.removeItem('snyx_active_room_id');
    };
  }, [roomId]);

  // Handle direct DM request triggers from Profile Page message click
  useEffect(() => {
    const targetUserId = localStorage.getItem('snyx_open_dm_userId');
    if (targetUserId) {
      setIsDmModalOpen(true);
    }
  }, []);

  // Notification Toast Auto-dismiss
  useEffect(() => {
    if (chatToast) {
      const t = setTimeout(() => setChatToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [chatToast]);

  // Monitor incoming chat messages to trigger notifications when not viewing Chat tab
  useEffect(() => {
    const messages = roomState?.chatMessages || [];
    if (messages.length > lastMsgRef.current) {
      if (lastMsgRef.current > 0 && activeSidebarTab !== 'chat') {
        const newMsg = messages[messages.length - 1];
        if (newMsg.senderId !== participantId) {
          setChatToast({
            senderName: newMsg.senderName,
            content: newMsg.content,
          });
        }
      }
      lastMsgRef.current = messages.length;
    }
  }, [roomState?.chatMessages, activeSidebarTab, participantId]);

  // Fetch followed friends list for the in-room Invite Friends panel
  useEffect(() => {
    if (isInviteFriendsOpen) {
      fetchFriendsList();
    }
  }, [isInviteFriendsOpen]);

  const fetchFriendsList = async () => {
    setFriendsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friends`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFriendsLoading(false);
    }
  };

  // YouTube Search with 450ms debounce & pasted link resolver
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const urlMatch = searchQuery.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (urlMatch) {
      const videoId = urlMatch[1];
      setIsSearching(true);
      searchTimeoutRef.current = window.setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/youtube/video/${videoId}`);
          if (res.ok) {
            const video = await res.json();
            setSearchResults([video]);
          }
        } catch (err) {
          console.error('Error fetching video details:', err);
        } finally {
          setIsSearching(false);
        }
      }, 200);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/youtube/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Periodic Playback Synchronization & Drift Correction (Every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!roomState || !roomState.isPlaying || !playerRef.current) return;

      const player = playerRef.current;
      const localTime = player.getCurrentTime();
      
      const now = Date.now();
      const elapsed = roomState.playbackStartedAt ? (now - roomState.playbackStartedAt) / 1000 : 0;
      const expectedTime = roomState.position + elapsed;

      const difference = localTime - expectedTime;
      const absDiff = Math.abs(difference);

      console.log(`[Sync] Local: ${localTime.toFixed(2)}s | Expected: ${expectedTime.toFixed(2)}s | Diff: ${difference.toFixed(2)}s`);

      if (absDiff >= 1.0) {
        player.seek(expectedTime);
      } else if (absDiff > 0.25) {
        const rate = difference > 0 ? 0.75 : 1.25;
        try {
          const rawPlayer = (playerRef.current as any);
          if (rawPlayer && typeof rawPlayer.setPlaybackRate === 'function') {
            rawPlayer.setPlaybackRate(rate);
          }
        } catch (e) {
          player.seek(expectedTime);
        }
      } else {
        try {
          const rawPlayer = (playerRef.current as any);
          if (rawPlayer && typeof rawPlayer.setPlaybackRate === 'function') {
            rawPlayer.setPlaybackRate(1.0);
          }
        } catch (e) {}
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [roomState]);

  // Scroll to bottom helper for Chat
  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatLogRef.current) {
        chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
      }
    }, 50);
  };

  // Manage unread badges and auto-scroll on new chat messages
  useEffect(() => {
    const messagesCount = roomState?.chatMessages?.length || 0;
    if (messagesCount > prevMessagesCountRef.current) {
      if (activeSidebarTab !== 'chat') {
        setUnreadCount((prev) => prev + (messagesCount - prevMessagesCountRef.current));
      } else {
        scrollToBottom();
      }
    }
    prevMessagesCountRef.current = messagesCount;
  }, [roomState?.chatMessages, activeSidebarTab]);

  // Handle active sidebar tab toggles
  useEffect(() => {
    if (activeSidebarTab === 'chat') {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [activeSidebarTab]);

  // API Call: Send watchroom invite inside Invite drawer
  const handleSendRoomInvite = async (friendId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/social/invites/${friendId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        setInvitedUserIds((prev) => {
          const next = new Set(prev);
          next.add(friendId);
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Playback State changes from IFrame events
  const handlePlayerStateChange = (event: { data: number }) => {
    if (event.data === 0) {
      sendPlaybackEnded();
    }
  };

  const handleTimeUpdate = (seconds: number) => {
    if (!isDraggingRef.current) {
      setLocalTime(seconds);
    }
    if (playerRef.current) {
      try {
        const d = playerRef.current.getDuration();
        if (d > 0 && d !== duration) {
          setDuration(d);
        }
      } catch (e) {}
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    reorderQueue(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // UI Control Event Handlers
  const handlePlayPause = () => {
    if (!roomState || isPlayingBusyRef.current) return;

    isPlayingBusyRef.current = true;
    setTimeout(() => {
      isPlayingBusyRef.current = false;
    }, 300);

    const currentTime = playerRef.current ? playerRef.current.getCurrentTime() : localTime;
    const nextPlaying = !roomState.isPlaying;

    if (playerRef.current) {
      if (nextPlaying) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }

    if (nextPlaying) {
      play(currentTime);
    } else {
      pause(currentTime);
    }
  };

  const handleSeekStart = () => {
    isDraggingRef.current = true;
    setIsDraggingProgress(true);
    setDragProgress(localTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = parseFloat(e.target.value);
    const val = isNaN(rawVal) ? 0 : Math.max(0, Math.min(rawVal, duration));
    setDragProgress(val);
    setLocalTime(val);
    if (playerRef.current) {
      playerRef.current.seek(val);
    }
  };

  const handleSeekEnd = () => {
    isDraggingRef.current = false;
    setIsDraggingProgress(false);
    const val = isNaN(dragProgress) ? 0 : Math.max(0, Math.min(dragProgress, duration));
    setLocalTime(val);
    if (playerRef.current) {
      playerRef.current.seek(val);
    }
    seek(val);
  };

  const handleAddVideo = (video: any) => {
    addToQueue(video.videoId, video.title, video.thumbnail, video.channelTitle);
    setSearchQuery('');
  };

  // Send Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  // Handle local file uploads inside room settings (Base64 encoding)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Image size should be less than 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'avatar') {
          setProfileAvatarInput(reader.result as string);
        } else {
          setProfileBannerInput(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save profile changes inside room settings sidebar
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.token) return;

    setProfileSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          displayName: profileNameInput.trim() || null,
          profilePicture: profileAvatarInput.trim() || null,
          bio: profileBioInput.trim(),
          profileBanner: profileBannerInput.trim(),
          gender: profileGenderInput
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save profile.');
      }

      const updatedUser = {
        ...currentUser,
        displayName: data.displayName,
        profilePicture: data.profilePicture,
        bio: data.bio,
        profileBanner: data.profileBanner,
        gender: data.gender
      };

      localStorage.setItem('snyx_user', JSON.stringify(updatedUser));
      updateDisplayName(data.displayName || data.username);
      setIsDrawerOpen(false);

      window.dispatchEvent(new Event('snyx_auth_change'));

    } catch (err) {
      console.error('Error saving profile inside room:', err);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('snyx_user');
    window.dispatchEvent(new Event('snyx_auth_change'));
    onNavigate('/');
  };

  const navigateToProfile = async (targetUserId: string) => {
    if (targetUserId === currentUser?.userId) {
      onNavigate(`/${currentUser.username}`);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/social/profile/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.username) {
          onNavigate(`/${data.username}`);
        }
      }
    } catch (e) {
      console.error('Failed to resolve profile navigation username:', e);
    }
  };

  // Formatter functions
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatMsgTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayTitle = roomState?.currentVideoTitle || 'No song playing';
  const displayChannel = roomState?.currentVideoId ? (roomState.currentVideoThumbnail?.includes('unsplash') ? 'Royalty Free' : 'YouTube') : 'Select a song below to start';

  // Fallbacks
  const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop&q=80';
  const defaultBanner = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop&q=80';

  // Format Notification Badge count text
  let unreadBadgeText = '';
  if (unreadCount > 0) {
    unreadBadgeText = unreadCount > 5 ? '5+ new messages' : `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`;
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans relative overflow-hidden select-none">
      
      {/* Floating Chat Message Toast Notification */}
      {chatToast && (
        <div
          onClick={() => {
            setActiveSidebarTab('chat');
            setChatToast(null);
          }}
          className="fixed top-20 right-6 z-50 bg-[#080808]/95 border border-white/10 backdrop-blur-2xl px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer animate-slideIn max-w-sm hover:border-white/30 transition duration-300"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="block text-[9px] text-white font-extrabold uppercase tracking-wider">New Chat Message</span>
            <span className="block text-xs font-bold text-white truncate mt-0.5">{chatToast.senderName}</span>
            <span className="block text-[11px] text-neutral-400 truncate mt-0.5">{chatToast.content}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChatToast(null);
            }}
            className="p-1 text-neutral-500 hover:text-white rounded-full hover:bg-white/5 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unified Monochromatic Navbar */}
      <Navbar
        onNavigate={onNavigate}
        roomId={roomId}
        socketConnected={socketConnected}
        onOpenInbox={() => setIsDmModalOpen(true)}
      />

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-300 text-center py-2.5 text-xs font-mono px-4">
          {error}
        </div>
      )}

      {/* Main Grid */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden z-10">
        
        {/* Left Side */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
            {roomState?.currentVideoId ? (
              <YouTubePlayer
                ref={playerRef}
                videoId={roomState.currentVideoId}
                isPlaying={roomState.isPlaying}
                volume={isMuted ? 0 : volume}
                onStateChange={handlePlayerStateChange}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#07080f]">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4 animate-pulse">
                  <Radio className="w-8 h-8 text-neutral-400 animate-spin" />
                </div>
                <h3 className="font-extrabold text-white text-base tracking-wider mb-1 uppercase">Room is empty</h3>
                <p className="text-neutral-500 text-xs max-w-xs font-medium leading-relaxed">
                  Search and add a YouTube track in the sidebar to start listening.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col gap-4 backdrop-blur-md">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="font-black text-white text-base md:text-lg line-clamp-1 leading-tight tracking-wide">
                  {displayTitle}
                </h2>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                  {displayChannel}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                <Users className="w-3 h-3 text-violet-400" />
                <span className="font-bold text-white">
                  {roomState?.users.filter(u => u.isConnected).length || 1}
                </span>
                <span>online</span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <span className="text-[10px] font-mono text-neutral-550 min-w-[36px]">
                {formatTime(isDraggingProgress ? dragProgress : localTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 1}
                step="0.1"
                value={isDraggingProgress ? dragProgress : localTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                disabled={!roomState?.currentVideoId}
                className="flex-grow h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white disabled:opacity-30"
              />
              <span className="text-[10px] font-mono text-neutral-550 min-w-[36px] text-right">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  disabled={!roomState?.currentVideoId}
                  className="p-2.5 text-neutral-450 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all duration-300"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                  disabled={!roomState?.currentVideoId}
                  className="w-16 md:w-24 h-1 bg-white/10 rounded appearance-none cursor-pointer accent-white disabled:opacity-30"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  disabled={!roomState?.currentVideoId}
                  className="w-12 h-12 bg-white hover:bg-neutral-200 active:scale-95 text-black flex items-center justify-center transition duration-300 shadow-md shadow-white/5 rounded-full"
                >
                  {roomState?.isPlaying ? (
                    <Pause className="w-4.5 h-4.5 fill-current" />
                  ) : (
                    <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={nextVideo}
                  disabled={!roomState || roomState.queue.length === 0}
                  className="p-3 text-neutral-450 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition rounded-full active:scale-95"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
              <div className="w-[100px] hidden sm:block" />
            </div>
          </div>

          {/* Connected Presence Tracker List with Profile Navigation Redirects */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-violet-400" /> Room Participants
              </h3>
              
              {/* Direct In-Room invite friends button */}
              <button
                onClick={() => setIsInviteFriendsOpen(true)}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 active:scale-95 text-[10px] font-bold uppercase tracking-wider rounded-full transition shadow-md shadow-violet-600/10"
              >
                + Invite Friends
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {roomState?.users.map((user) => (
                <div
                  key={user.participantId}
                  onClick={() => navigateToProfile(user.participantId)}
                  className="flex items-center justify-between bg-white/5 border border-white/5 hover:border-white/15 p-3 rounded-2xl cursor-pointer transition"
                  title="View Profile Page"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${user.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                    <span className={`text-xs font-semibold truncate ${user.isConnected ? 'text-white' : 'text-neutral-500'}`}>
                      {user.displayName}
                    </span>
                  </div>
                  <span className="text-[8px] uppercase tracking-wider font-mono text-neutral-500">
                    {user.participantId === participantId ? 'You' : 'Peer'}
                  </span>
                </div>
              ))}
              {roomState && roomState.users.length < 2 && (
                <div className="flex items-center justify-center p-3 border border-dashed border-white/15 rounded-2xl text-neutral-500 text-xs font-bold uppercase tracking-wider col-span-2">
                  WAITING FOR PEER TO CONNECT...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Side: Tabbed Sidebar */}
        <section className="lg:col-span-5 flex flex-col h-[650px] bg-white/[0.03] border border-white/10 rounded-3xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="flex border-b border-white/5 bg-white/5 p-2 gap-1.5 shrink-0 backdrop-blur-2xl">
            <button
              onClick={() => setActiveSidebarTab('chat')}
              className={`flex-grow flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-[10px] uppercase tracking-wider font-bold transition-all duration-300 relative ${
                activeSidebarTab === 'chat'
                  ? 'bg-white text-black font-black shadow-lg shadow-white/5'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-2 flex h-4.5 px-1.5 items-center justify-center bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full text-[8px] font-black text-white animate-bounce whitespace-nowrap shadow-md">
                  {unreadBadgeText}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSidebarTab('queue')}
              className={`flex-grow flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-[10px] uppercase tracking-wider font-bold transition-all duration-300 relative ${
                activeSidebarTab === 'queue'
                  ? 'bg-white text-black font-black shadow-lg shadow-white/5'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Queue</span>
              {roomState?.queue && roomState.queue.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  activeSidebarTab === 'queue' ? 'bg-black text-white' : 'bg-white/10 text-neutral-300'
                }`}>
                  {roomState.queue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSidebarTab('search')}
              className={`flex-grow flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-[10px] uppercase tracking-wider font-bold transition-all duration-300 ${
                activeSidebarTab === 'search'
                  ? 'bg-white text-black font-black shadow-lg shadow-white/5'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Add Songs</span>
            </button>
          </div>

          <div className="flex-grow overflow-hidden flex flex-col p-4">
            
            {activeSidebarTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div
                  ref={chatLogRef}
                  className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin scroll-smooth"
                >
                  {roomState?.chatMessages && roomState.chatMessages.length > 0 ? (
                    roomState.chatMessages.map((msg) => {
                      const isOwn = msg.senderId === participantId;
                      const avatar = msg.senderAvatar || defaultAvatar;
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isOwn && (
                            <img
                              src={avatar}
                              alt={msg.senderName}
                              onClick={() => navigateToProfile(msg.senderId)}
                              className="w-8 h-8 object-cover border border-white/10 rounded-full shrink-0 shadow-md cursor-pointer hover:border-violet-500 transition"
                              title="View Profile Page"
                            />
                          )}
                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                            {!isOwn && (
                              <span
                                onClick={() => navigateToProfile(msg.senderId)}
                                className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider mb-0.5 ml-1 cursor-pointer hover:text-white transition"
                              >
                                {msg.senderName}
                              </span>
                            )}
                            <div
                              className={`px-3.5 py-2.5 text-xs leading-relaxed rounded-2xl shadow-sm border ${
                                isOwn
                                  ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-none text-white rounded-tr-none'
                                  : 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                              }`}
                            >
                              <p className="break-words font-medium">{msg.content}</p>
                              <span className={`block text-[8px] text-right mt-1 font-mono leading-none ${
                                isOwn ? 'text-indigo-200' : 'text-neutral-550'
                              }`}>
                                {formatMsgTime(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                          {isOwn && (
                            <img
                              src={avatar}
                              alt="You"
                              className="w-8 h-8 object-cover border border-white/10 rounded-full shrink-0 shadow-md"
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-550 p-6">
                      <MessageSquare className="w-8 h-8 text-neutral-600 mb-2 stroke-[1.5] animate-bounce" />
                      <p className="text-xs uppercase tracking-wider font-extrabold text-neutral-400">NO MESSAGES</p>
                      <p className="text-[10px] text-neutral-550 mt-1.5 max-w-[180px] leading-normal font-medium">
                        Type a message below to start chatting instantly with your roommate!
                      </p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2 border-t border-white/5 pt-3.5 shrink-0">
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-grow bg-white/5 border border-white/10 focus:border-white/20 text-white px-4 py-2.5 rounded-2xl outline-none text-xs focus:bg-white/[0.08] transition duration-200"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 active:scale-95 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-violet-600/10"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}

            {activeSidebarTab === 'queue' && (
              <div className="flex-grow flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {roomState && roomState.queue.length > 0 ? (
                    roomState.queue.map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex gap-3 bg-white/[0.02] border p-3 rounded-2xl transition cursor-grab active:cursor-grabbing select-none ${
                          draggedIndex === index
                            ? 'opacity-30 border-dashed border-violet-500/50'
                            : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-14 h-10 object-cover rounded-xl bg-black border border-white/5 pointer-events-none"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between pointer-events-none">
                          <h4 className="text-xs font-bold text-white leading-snug line-clamp-1">
                            {item.title}
                          </h4>
                          <p className="text-[9px] text-neutral-550 uppercase tracking-wider truncate mt-1 leading-none font-bold">
                            {item.channelTitle} &bull; BY {item.addedBy}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 self-center">
                          <button
                            onClick={() => playQueueItem(item.id)}
                            className="text-neutral-450 hover:text-white p-2 hover:bg-white/5 transition rounded-full"
                            title="Play Now"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="text-neutral-450 hover:text-red-400 p-2 hover:bg-white/5 transition rounded-full"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-550 p-6">
                      <Clock className="w-8 h-8 text-neutral-700 mb-2 stroke-[1.5]" />
                      <p className="text-xs uppercase tracking-wider font-extrabold text-neutral-400">QUEUE EMPTY</p>
                      <p className="text-[10px] text-neutral-550 mt-1.5 max-w-[180px] leading-normal font-medium">
                        Select the "Add Songs" tab above to add items to your queue.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSidebarTab === 'search' && (
              <div className="flex-grow flex flex-col overflow-hidden">
                <div className="relative mb-4 shrink-0">
                  <input
                    type="text"
                    placeholder="Search YouTube tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-white/20 text-white pl-10 pr-4 py-2.5 rounded-2xl outline-none text-xs placeholder:text-neutral-600 focus:bg-white/[0.08] transition duration-250"
                  />
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-500" />
                  {isSearching && (
                    <RefreshCw className="absolute right-3.5 top-3.5 w-4 h-4 text-white animate-spin" />
                  )}
                </div>
                
                <div className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {searchResults.map((video) => (
                    <div
                      key={video.videoId}
                      className="flex gap-2.5 items-center p-2.5 bg-white/[0.01] hover:bg-white/5 border border-white/5 rounded-2xl group transition-all duration-300"
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-12 h-9 object-cover rounded-xl bg-black border border-white/5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-bold text-white truncate group-hover:text-violet-400 transition leading-snug">
                          {video.title}
                        </h4>
                        <p className="text-[9px] text-neutral-550 truncate mt-0.5">
                          {video.channelTitle}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddVideo(video)}
                        className="p-2 bg-white/5 hover:bg-white text-neutral-300 hover:text-black rounded-full transition-all duration-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {searchQuery.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
                    <div className="text-center text-xs text-neutral-600 py-6 font-mono font-bold tracking-widest">NO TRACKS FOUND</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Sliding Settings Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 select-none">
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          />
          <div className="absolute top-0 right-0 h-full w-80 bg-[#080915] border-l border-white/10 backdrop-blur-3xl p-6 flex flex-col justify-between shadow-2xl rounded-l-[32px] animate-slideIn overflow-y-auto">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">
                  Player settings
                </h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition duration-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-5">
                <div className="space-y-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <div className="space-y-2">
                    <label className="block text-[8px] uppercase tracking-widest font-mono font-bold text-neutral-400">Profile Banner</label>
                    <div className="relative h-20 border border-white/10 bg-neutral-900 overflow-hidden rounded-xl group cursor-pointer">
                      <img
                        src={profileBannerInput || defaultBanner}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/65 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                        <Camera className="w-4 h-4 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'banner')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 border-t border-white/5 pt-4">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 group cursor-pointer shrink-0">
                      <img
                        src={getAvatarUrl(profileAvatarInput, profileGenderInput)}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                        <Camera className="w-3.5 h-3.5 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'avatar')}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase tracking-widest font-mono font-bold text-neutral-300">Avatar Image</span>
                      <span className="block text-[8px] text-neutral-500 font-medium mt-0.5">Click circle to upload</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold ml-1">DISPLAY NAME</label>
                  <input
                    type="text"
                    placeholder={currentUser?.username}
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 focus:border-white/30 text-white px-4 py-3 rounded-2xl outline-none text-xs focus:bg-white/[0.08] transition duration-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold ml-1">BIOGRAPHY</label>
                  <textarea
                    rows={3}
                    placeholder="Tell room users about yourself..."
                    value={profileBioInput}
                    onChange={(e) => setProfileBioInput(e.target.value)}
                    maxLength={160}
                    className="w-full bg-white/5 border border-white/15 focus:border-white/30 text-white px-4 py-3 rounded-2xl outline-none text-xs resize-none focus:bg-white/[0.08] transition duration-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold ml-1">GENDER</label>
                  <select
                    value={profileGenderInput}
                    onChange={(e) => setProfileGenderInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 focus:border-white/30 text-white px-4 py-3 rounded-2xl outline-none text-xs focus:bg-white/[0.08] transition duration-200"
                  >
                    <option value="male" className="bg-[#0b0c1e] text-white">Male</option>
                    <option value="female" className="bg-[#0b0c1e] text-white">Female</option>
                    <option value="other" className="bg-[#0b0c1e] text-white">Other</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 active:scale-[0.98] text-white font-bold rounded-2xl transition duration-300 uppercase tracking-wider text-xs shadow-md shadow-violet-600/25"
                  >
                    {profileSaving ? 'Saving...' : 'Save settings'}
                  </button>
                </div>
              </form>
            </div>

            <div className="border-t border-white/5 pt-4 mt-6">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/20 text-red-400 text-xs font-bold rounded-2xl transition duration-300 uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable DM Inbox Modal */}
      <DmInboxModal
        isOpen={isDmModalOpen}
        onClose={() => setIsDmModalOpen(false)}
        onNavigate={onNavigate}
        currentUser={currentUser}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Direct Invite Friends Modal (Dedicated Room Invitation List) */}
      {isInviteFriendsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none animate-fadeIn">
          <div className="bg-[#080915] border border-white/10 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl p-6 space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                Invite Friends to Room
              </h3>
              <button
                onClick={() => setIsInviteFriendsOpen(false)}
                className="p-1.5 text-neutral-450 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {friendsLoading ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-2 font-mono text-[10px] text-neutral-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                  <span>Loading friends list...</span>
                </div>
              ) : friendsList.length > 0 ? (
                friendsList.map((friend) => {
                  const alreadyInvited = invitedUserIds.has(friend.id);
                  return (
                    <div key={friend.id} className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/5 rounded-2xl gap-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={getAvatarUrl(friend.profilePicture, friend.gender)} className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-white truncate leading-none">{friend.displayName || friend.username}</span>
                          <span className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider mt-1">@{friend.username}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRoomInvite(friend.id)}
                        disabled={alreadyInvited}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition ${
                          alreadyInvited
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-white hover:bg-neutral-200 text-black shadow-md'
                        }`}
                      >
                        {alreadyInvited ? 'Sent' : 'Invite'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 space-y-2">
                  <span className="block text-xs font-extrabold text-neutral-500 uppercase tracking-wider">No Friends Added</span>
                  <span className="block text-[10px] text-neutral-600 leading-normal max-w-[180px] mx-auto font-medium">
                    Search users next to chat bubbles or in DMs and add them as friends first.
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/5 text-[9px] font-mono tracking-widest text-neutral-600 bg-[#05060f]/60 backdrop-blur-md">
        sNyx Room: {roomId} &bull; Authoritative Synchronization Protocol v1.2.0
      </footer>
    </div>
  );
}
