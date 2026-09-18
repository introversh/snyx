import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Plus, Search, Trash2, ArrowUp, ArrowDown, Lock, Globe, RefreshCw, Bookmark, Radio } from 'lucide-react';
import { getAvatarUrl } from '../pages/LandingPage';

interface PlaylistModalProps {
  playlistId: string;
  isOwner: boolean;
  apiBaseUrl: string;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export default function PlaylistModal({ playlistId, isOwner, apiBaseUrl, onClose, onNavigate }: PlaylistModalProps) {
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayingInRoom, setIsPlayingInRoom] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  let currentUser: any = null;
  try {
    const stored = localStorage.getItem('snyx_user');
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${currentUser?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const handleTogglePrivacy = async () => {
    if (!isOwner || !playlist || isUpdatingPrivacy) return;
    setIsUpdatingPrivacy(true);
    try {
      const newPrivacy = !playlist.isPrivate;
      const res = await fetch(`${apiBaseUrl}/playlists/${playlistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`,
        },
        body: JSON.stringify({ isPrivate: newPrivacy }),
      });
      if (res.ok) {
        setPlaylist({ ...playlist, isPrivate: newPrivacy });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser || !currentUser.token || !playlist) return;
    setIsSaving(true);
    try {
      const method = playlist.isSaved ? 'DELETE' : 'POST';
      const res = await fetch(`${apiBaseUrl}/playlists/${playlistId}/save`, {
        method,
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        setPlaylist({ ...playlist, isSaved: !playlist.isSaved });
        window.dispatchEvent(new Event('snyx_playlist_update'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlayInRoom = async () => {
    if (!currentUser || !currentUser.token || !playlist) return;
    setIsPlayingInRoom(true);
    try {
      const res = await fetch(`${apiBaseUrl}/rooms/from-playlist/${playlistId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        onClose();
        if (onNavigate) {
          onNavigate(`/room/${data.roomId}`);
        } else {
          window.location.href = `/room/${data.roomId}`;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPlayingInRoom(false);
    }
  };

  const executeSearch = async (query: string) => {
    const q = query.trim();
    if (q.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    try {
      const res = await fetch(`${apiBaseUrl}/youtube/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${currentUser?.token}` },
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setSearchResults(items);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error(e);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    executeSearch(searchQuery);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.trim().length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(value);
    }, 800);
  };

  const handleAddItem = async (video: any) => {
    const videoId = video.id?.videoId || video.id || video.videoId;
    const title = video.snippet?.title || video.title;
    const thumbnail = video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || video.thumbnail;
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const res = await fetch(`${apiBaseUrl}/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`,
        },
        body: JSON.stringify({
          videoId,
          title,
          thumbnail,
          sourceUrl,
        }),
      });
      if (res.ok) {
        setSearchQuery('');
        setSearchResults([]);
        fetchPlaylist();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/playlists/${playlistId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token}` }
      });
      if (res.ok) fetchPlaylist();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReorder = async (itemId: string, direction: 'up' | 'down') => {
    if (!playlist || !playlist.items) return;
    const items = [...playlist.items];
    const index = items.findIndex((i: any) => i.id === itemId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = items[index];
      items[index] = items[index - 1];
      items[index - 1] = temp;
    } else if (direction === 'down' && index < items.length - 1) {
      const temp = items[index];
      items[index] = items[index + 1];
      items[index + 1] = temp;
    } else {
      return;
    }

    const reordered = items.map((item: any, idx: number) => ({
      ...item,
      order: idx,
    }));
    setPlaylist({ ...playlist, items: reordered });

    try {
      await fetch(`${apiBaseUrl}/playlists/${playlistId}/items/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`,
        },
        body: JSON.stringify({
          items: reordered.map((item: any) => ({ id: item.id, order: item.order })),
        }),
      });
    } catch (e) {
      console.error('Failed to save order to server:', e);
    }
  };

  if (!playlist && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div className="text-white text-xs font-mono flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading playlist...
        </div>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#050505] border border-white/10 w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-white/10 shrink-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-lg">{playlist.name}</h3>
              {isOwner ? (
                <button
                  onClick={handleTogglePrivacy}
                  disabled={isUpdatingPrivacy}
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 transition"
                  title="Click to toggle privacy"
                >
                  {playlist.isPrivate ? <Lock className="w-3 h-3 text-amber-400" /> : <Globe className="w-3 h-3 text-emerald-400" />}
                  <span>{playlist.isPrivate ? 'Private' : 'Public'}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-neutral-400">
                  {playlist.isPrivate ? <Lock className="w-3 h-3 text-amber-400" /> : <Globe className="w-3 h-3 text-emerald-400" />}
                  <span>{playlist.isPrivate ? 'Private' : 'Public'}</span>
                </span>
              )}
            </div>

            {/* Creator Attribution */}
            {playlist.user && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <img
                  src={getAvatarUrl(playlist.user.profilePicture, playlist.user.gender)}
                  alt="Avatar"
                  className="w-4 h-4 rounded-full border border-white/20 object-cover"
                />
                <span>
                  By <span className="text-white font-bold">@{playlist.user.username}</span>
                  {playlist.user.displayName && ` (${playlist.user.displayName})`}
                </span>
              </div>
            )}

            {playlist.description && <p className="text-xs text-neutral-400">{playlist.description}</p>}
          </div>

          <div className="flex items-center gap-2">
            {/* Play in New Room Button */}
            <button
              onClick={handlePlayInRoom}
              disabled={isPlayingInRoom || !playlist.items || playlist.items.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-bold transition disabled:opacity-50"
              title="Open all playlist tracks in a new watch party room"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isPlayingInRoom ? 'Creating...' : 'Play in Room'}</span>
            </button>

            {/* Take to Home / Saved to Home Button */}
            {!isOwner && (
              <button
                onClick={handleToggleSave}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  playlist.isSaved
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}
                title={playlist.isSaved ? 'Remove from saved playlists' : 'Save this playlist to your profile'}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{playlist.isSaved ? 'Saved to Home' : 'Take to Home'}</span>
              </button>
            )}

            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white bg-white/5 rounded-full transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isOwner && (
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
              <h4 className="text-[10px] uppercase font-mono text-neutral-400 font-bold">Add to Playlist</h4>
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Search YouTube or paste URL..." 
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full bg-black border border-white/10 pl-9 pr-3 py-2 rounded-xl text-xs text-white focus:border-white/20 outline-none"
                  />
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                </div>
                <button 
                  type="submit" 
                  disabled={isSearching || searchQuery.trim().length < 2}
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2 mt-2 max-h-48 overflow-y-auto bg-black border border-white/5 p-2 rounded-xl">
                  {searchResults.map(result => {
                    const vid = result.id?.videoId || result.id || result.videoId;
                    const title = result.snippet?.title || result.title;
                    const thumb = result.snippet?.thumbnails?.default?.url || result.thumbnail;
                    return (
                      <div key={vid} className="flex gap-3 p-2 hover:bg-white/5 rounded-lg items-center">
                        <img src={thumb} alt={title} className="w-16 h-10 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{title}</p>
                          {result.channelTitle && <p className="text-[10px] text-neutral-400 truncate">{result.channelTitle}</p>}
                        </div>
                        <button 
                          onClick={() => handleAddItem(result)}
                          className="p-1.5 bg-white/10 text-white rounded hover:bg-white/20 transition shrink-0"
                          title="Add to playlist"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tracks List */}
          <div className="space-y-3">
            <h4 className="text-[10px] uppercase font-mono text-neutral-400 font-bold border-b border-white/10 pb-2">
              Tracks ({playlist.items?.length || 0})
            </h4>
            
            {playlist.items?.length > 0 ? (
              <div className="space-y-2">
                {playlist.items.map((item: any, idx: number) => (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 bg-white/5 border border-white/5 rounded-xl group hover:bg-white/10 transition">
                    <span className="text-[10px] text-neutral-500 w-4 text-center font-mono">{idx + 1}</span>
                    <img src={item.thumbnail} alt={item.title} className="w-16 h-10 object-cover rounded-md shadow shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{item.title}</p>
                      {item.sourceUrl && (
                        <span className="text-[9px] text-neutral-500 font-mono block truncate">
                          {item.sourceUrl}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => window.open(item.sourceUrl || `https://youtube.com/watch?v=${item.videoId}`, '_blank')}
                        className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition" 
                        title="Play on YouTube"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                      
                      {isOwner && (
                        <>
                          <button 
                            onClick={() => handleReorder(item.id, 'up')} 
                            disabled={idx === 0} 
                            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-30 transition"
                            title="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleReorder(item.id, 'down')} 
                            disabled={idx === playlist.items.length - 1} 
                            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-30 transition"
                            title="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleRemoveItem(item.id)} 
                            className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                            title="Remove from playlist"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 text-center py-8 italic">No tracks in this playlist yet.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
