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
  Share2,
  Users,
  Check,
  Edit2,
  RefreshCw,
  Clock,
  Radio
} from 'lucide-react';
import { useRoom } from '../hooks/useRoom';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';

interface RoomPageProps {
  roomId: string;
  onNavigate: (path: string) => void;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export default function RoomPage({ roomId, onNavigate }: RoomPageProps) {
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
  } = useRoom(roomId);

  const playerRef = useRef<YouTubePlayerRef | null>(null);

  // Local UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [copied, setCopied] = useState(false);

  // Synchronous dragging flag to prevent race conditions during player updates
  const isDraggingRef = useRef(false);
  const [duration, setDuration] = useState(240);

  // Drag & Drop reorder index state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Search Debounce Ref
  const searchTimeoutRef = useRef<number | null>(null);

  // Copy Room Link to Clipboard
  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // YouTube Search with 400ms debounce & pasted link resolver
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Check if query is a YouTube link
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
      
      // Calculate server-expected playback position
      const now = Date.now();
      const elapsed = roomState.playbackStartedAt ? (now - roomState.playbackStartedAt) / 1000 : 0;
      const expectedTime = roomState.position + elapsed;

      const difference = localTime - expectedTime;
      const absDiff = Math.abs(difference);

      console.log(`[Sync] Local: ${localTime.toFixed(2)}s | Expected: ${expectedTime.toFixed(2)}s | Diff: ${difference.toFixed(2)}s`);

      if (absDiff >= 1.0) {
        // Hard Seek if drift is >= 1 second
        console.log(`[Sync] Drift too high (${difference.toFixed(2)}s). Performing hard seek to: ${expectedTime.toFixed(2)}s`);
        player.seek(expectedTime);
        // Reset playback rate back to 1.0
        try {
          (player as any).setPlaybackRate?.(1.0);
        } catch (e) {}
      } else if (absDiff > 0.25) {
        // Gradual Correction if drift is between 0.25s and 1.0s
        // If local is ahead (difference > 0.25), slow down
        // If local is behind (difference < -0.25), speed up
        const rate = difference > 0 ? 0.75 : 1.25;
        console.log(`[Sync] Micro-drift detected (${difference.toFixed(2)}s). Setting playback rate to ${rate}x`);
        try {
          // Adjust rate safely
          const rawPlayer = (playerRef.current as any);
          if (rawPlayer && typeof rawPlayer.setPlaybackRate === 'function') {
            rawPlayer.setPlaybackRate(rate);
          }
        } catch (e) {
          // Fallback to hard seek if playback rate adjustment fails
          player.seek(expectedTime);
        }
      } else {
        // No correction needed, ensure normal speed
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

  // Handle Playback State changes from IFrame events
  const handlePlayerStateChange = (event: { data: number }) => {
    // YT.PlayerState.ENDED is 0
    if (event.data === 0) {
      console.log('[Player Event] Video ended. Requesting server next video.');
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
    if (!roomState) return;
    const currentTime = playerRef.current ? playerRef.current.getCurrentTime() : localTime;
    if (roomState.isPlaying) {
      pause(currentTime);
    } else {
      play(currentTime);
    }
  };

  const handleSeekStart = () => {
    isDraggingRef.current = true;
    setIsDraggingProgress(true);
    setDragProgress(localTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDragProgress(parseFloat(e.target.value));
  };

  const handleSeekEnd = () => {
    isDraggingRef.current = false;
    setIsDraggingProgress(false);
    seek(dragProgress);
  };

  const handleAddVideo = (video: any) => {
    addToQueue(video.videoId, video.title, video.thumbnail, video.channelTitle);
    setSearchQuery('');
  };

  // Format Seconds to MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const displayTitle = roomState?.currentVideoTitle || 'No song playing';
  const displayChannel = roomState?.currentVideoId ? (roomState.currentVideoThumbnail?.includes('unsplash') ? 'Royalty Free' : 'YouTube') : 'Select a song below to start';

  return (
    <div className="min-h-screen bg-[#07070a] text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-900 bg-[#0a0a0e]/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-xl font-extrabold tracking-tight text-white cursor-pointer flex items-center gap-2"
              onClick={() => onNavigate('/')}
            >
              <Radio className="w-5 h-5 text-indigo-500" /> Together
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-indigo-500 animate-pulse' : 'bg-rose-500'}`} />
              {socketConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Display Name Editor */}
            <div className="flex items-center bg-[#101015] border border-slate-850 px-3 py-1.5 rounded-xl text-sm">
              {isEditingName ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateDisplayName(tempName);
                    setIsEditingName(false);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-transparent border-b border-indigo-500 focus:outline-none text-white text-xs py-0.5 px-1 max-w-[80px]"
                    autoFocus
                  />
                  <button type="submit" className="text-indigo-400 hover:text-indigo-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">As:</span>
                  <span className="font-semibold text-white text-xs">{displayName}</span>
                  <button onClick={() => setIsEditingName(true)} className="text-slate-500 hover:text-slate-350">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Room Copy Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-750 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-600/15"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" /> {roomId}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-center py-2.5 text-xs px-4">
          {error}
        </div>
      )}

      {/* Main Grid */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Video Player & Audio Controls */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* YouTube Player IFrame Wrapper (Authoritative Container) */}
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-900 group">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0d0d12]">
                <div className="w-16 h-16 rounded-full bg-slate-900/50 flex items-center justify-center text-slate-650 border border-slate-800 mb-4 animate-pulse">
                  <Radio className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="font-bold text-white text-lg mb-1">Room is empty</h3>
                <p className="text-slate-450 text-sm max-w-xs">
                  Search and add a YouTube video on the right to start listening together.
                </p>
              </div>
            )}
          </div>

          {/* Music Control Panel */}
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col gap-4">
            
            {/* Song Details */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="font-extrabold text-white text-lg md:text-xl line-clamp-1 leading-tight">
                  {displayTitle}
                </h2>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  {displayChannel}
                </p>
              </div>

              {/* Connected Users Status Bubble */}
              <div className="flex items-center gap-1 bg-[#101015] border border-slate-850 px-2.5 py-1 rounded-full text-[10px] text-slate-400">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono text-white">
                  {roomState?.users.filter(u => u.isConnected).length || 1}
                </span>
                <span>online</span>
              </div>
            </div>

            {/* Seek Bar Slider */}
            <div className="flex items-center gap-3 w-full">
              <span className="text-xs font-mono text-slate-500 min-w-[36px]">
                {formatTime(isDraggingProgress ? dragProgress : localTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration}
                value={isDraggingProgress ? dragProgress : localTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                disabled={!roomState?.currentVideoId}
                className="flex-grow h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
              />
              <span className="text-xs font-mono text-slate-500 min-w-[36px] text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Playback Controls (Play, Pause, Next, Volume) */}
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                {/* Volume Button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  disabled={!roomState?.currentVideoId}
                  className="p-2.5 text-slate-400 hover:text-white bg-[#101015] border border-slate-850 hover:bg-[#15151c] rounded-xl transition"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-450" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                  disabled={!roomState?.currentVideoId}
                  className="w-16 md:w-24 h-1 bg-slate-850 rounded appearance-none cursor-pointer accent-slate-400 disabled:opacity-40"
                />
              </div>

              {/* Main Command Action Trigger Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayPause}
                  disabled={!roomState?.currentVideoId}
                  className="w-12 h-12 rounded-full bg-white hover:bg-slate-100 active:scale-95 text-[#07070a] flex items-center justify-center shadow-lg shadow-white/5 transition disabled:opacity-50"
                >
                  {roomState?.isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={nextVideo}
                  disabled={!roomState || roomState.queue.length === 0}
                  className="p-3 text-slate-350 hover:text-white bg-[#101015] border border-slate-850 hover:bg-[#15151c] disabled:opacity-30 rounded-full transition active:scale-95"
                >
                  <SkipForward className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="w-[100px] hidden sm:block" />
            </div>

          </div>

          {/* Connected Presence Tracker List */}
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" /> Room Participants
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {roomState?.users.map((user) => (
                <div key={user.participantId} className="flex items-center justify-between bg-[#0e0e13] border border-slate-850 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${user.isConnected ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} />
                    <span className={`text-xs font-semibold truncate ${user.isConnected ? 'text-white' : 'text-slate-500'}`}>
                      {user.displayName}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-mono text-slate-600">
                    {user.participantId === participantId ? 'You' : 'Peer'}
                  </span>
                </div>
              ))}
              {roomState && roomState.users.length < 2 && (
                <div className="flex items-center justify-center p-2.5 border border-dashed border-slate-850 rounded-xl text-slate-600 text-xs">
                  Waiting for second person...
                </div>
              )}
            </div>
          </div>

        </section>

        {/* Right Side: YouTube Search & Shared Queue */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Shared Queue List */}
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[300px]">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Queue
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[320px] pr-1 scrollbar-thin">
              {roomState && roomState.queue.length > 0 ? (
                roomState.queue.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex gap-3 bg-[#0d0d12] border p-2.5 rounded-xl transition cursor-grab active:cursor-grabbing select-none ${
                      draggedIndex === index
                        ? 'opacity-30 border-dashed border-indigo-500'
                        : 'border-slate-850 hover:border-slate-800'
                    }`}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-14 h-10 object-cover rounded-lg bg-slate-900 border border-slate-800 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between pointer-events-none">
                      <h4 className="text-xs font-bold text-white leading-snug line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate leading-none mt-1">
                        {item.channelTitle} &bull; Added by {item.addedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 self-center">
                      <button
                        onClick={() => playQueueItem(item.id)}
                        className="text-slate-400 hover:text-emerald-450 p-1.5 rounded-lg hover:bg-slate-900 transition"
                        title="Play Now"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="text-slate-400 hover:text-rose-450 p-1.5 rounded-lg hover:bg-slate-900 transition"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[140px] text-center text-slate-650">
                  <p className="text-xs">No upcoming songs</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
                    Use the search bar below to add tracks to the queue.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Search YouTube panel */}
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-400" /> Search YouTube
            </h3>
            
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search songs or artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d0d12] border border-slate-850 focus:border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl outline-none text-xs placeholder:text-slate-600 transition"
              />
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
              {isSearching && (
                <RefreshCw className="absolute right-3.5 top-3 w-4 h-4 text-indigo-500 animate-spin" />
              )}
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {searchResults.map((video) => (
                <div
                  key={video.videoId}
                  className="flex gap-2.5 items-center p-2 bg-[#0e0e13] hover:bg-[#121219] border border-slate-850 rounded-lg group transition"
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-12 h-9 object-cover rounded-md bg-slate-900 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold text-white truncate group-hover:text-indigo-400 transition leading-snug">
                      {video.title}
                    </h4>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5 leading-none">
                      {video.channelTitle}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddVideo(video)}
                    className="p-1.5 bg-[#121217] text-slate-400 hover:text-white hover:bg-indigo-600 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
                <div className="text-center text-xs text-slate-600 py-4">No results found</div>
              )}
            </div>
          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-slate-950 text-[10px] text-slate-700 bg-[#07070a]">
        Together room: {roomId} &bull; Autoritative Synchronization Protocol v1.0
      </footer>
    </div>
  );
}
