import React, { useState, useEffect } from 'react';
import { Plus, ListMusic, Trash2, Lock, Globe, Bookmark, Play } from 'lucide-react';
import PlaylistModal from './PlaylistModal';
import { getAvatarUrl } from '../pages/LandingPage';

interface PlaylistSectionProps {
  userId: string;
  isOwnProfile: boolean;
  apiBaseUrl: string;
  onNavigate?: (path: string) => void;
}

export default function PlaylistSection({ userId, isOwnProfile, apiBaseUrl, onNavigate }: PlaylistSectionProps) {
  const [tab, setTab] = useState<'created' | 'saved'>('created');
  const [createdPlaylists, setCreatedPlaylists] = useState<any[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistOwner, setSelectedPlaylistOwner] = useState<boolean>(false);
  const [startingRoomId, setStartingRoomId] = useState<string | null>(null);

  let currentUser: any = null;
  try {
    const stored = localStorage.getItem('snyx_user');
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${currentUser?.token}` };
      const [createdRes, savedRes] = await Promise.all([
        fetch(`${apiBaseUrl}/playlists/user/${userId}`, { headers }),
        isOwnProfile ? fetch(`${apiBaseUrl}/playlists/user/${userId}/saved`, { headers }) : Promise.resolve(null),
      ]);

      if (createdRes.ok) {
        const data = await createdRes.json();
        setCreatedPlaylists(data);
      }
      if (savedRes && savedRes.ok) {
        const data = await savedRes.json();
        setSavedPlaylists(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchPlaylists();

    const handleUpdate = () => fetchPlaylists();
    window.addEventListener('snyx_playlist_update', handleUpdate);
    return () => window.removeEventListener('snyx_playlist_update', handleUpdate);
  }, [userId, isOwnProfile]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`,
        },
        body: JSON.stringify({
          name: newTitle.trim(),
          description: newDesc.trim() || undefined,
          isPrivate: newIsPrivate,
        }),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setNewTitle('');
        setNewDesc('');
        setNewIsPrivate(false);
        fetchPlaylists();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/playlists/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token}` },
      });
      if (res.ok) {
        fetchPlaylists();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnsave = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${apiBaseUrl}/playlists/${id}/save`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token}` },
      });
      if (res.ok) {
        fetchPlaylists();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlayInRoom = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    if (!currentUser || !currentUser.token) return;
    setStartingRoomId(playlistId);
    try {
      const res = await fetch(`${apiBaseUrl}/rooms/from-playlist/${playlistId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (onNavigate) {
          onNavigate(`/room/${data.roomId}`);
        } else {
          window.location.href = `/room/${data.roomId}`;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStartingRoomId(null);
    }
  };

  const currentList = tab === 'created' ? createdPlaylists : savedPlaylists;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
      {/* Header with Title & Action / Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <h4 className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-white" /> Playlists
          </h4>

          {/* Own profile tabs: Created vs Saved */}
          {isOwnProfile && (
            <div className="flex bg-black/40 border border-white/10 rounded-xl p-0.5">
              <button
                onClick={() => setTab('created')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  tab === 'created'
                    ? 'bg-white text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Created ({createdPlaylists.length})
              </button>
              <button
                onClick={() => setTab('saved')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  tab === 'saved'
                    ? 'bg-white text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Bookmark className="w-3 h-3" />
                Saved ({savedPlaylists.length})
              </button>
            </div>
          )}
        </div>

        {isOwnProfile && tab === 'created' && (
          <button
            onClick={() => setIsCreateOpen(!isCreateOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-white transition self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Create Playlist
          </button>
        )}
      </div>

      {isCreateOpen && isOwnProfile && (
        <form onSubmit={handleCreate} className="bg-[#080808] border border-white/10 p-4 rounded-2xl space-y-3">
          <input
            type="text"
            placeholder="Playlist Name"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-white outline-none focus:border-white/20"
            required
          />
          <input
            type="text"
            placeholder="Description (Optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-white outline-none focus:border-white/20"
          />

          <div className="flex items-center justify-between py-1 px-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={newIsPrivate}
                onChange={(e) => setNewIsPrivate(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-white accent-white"
              />
              <span className="flex items-center gap-1.5">
                {newIsPrivate ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Globe className="w-3.5 h-3.5 text-neutral-400" />}
                {newIsPrivate ? 'Private Playlist (Only you can see)' : 'Public Playlist (Anyone can see)'}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3.5 py-1.5 text-xs font-bold text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-xl hover:bg-neutral-200 transition"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-[10px] text-neutral-500 font-mono">Loading playlists...</div>
      ) : currentList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentList.map((p) => {
            const trackCount = p._count?.items ?? p.items?.length ?? 0;
            const isOwner = p.userId === currentUser?.userId;

            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPlaylistId(p.id);
                  setSelectedPlaylistOwner(isOwner);
                }}
                className="bg-black border border-white/10 hover:border-white/20 p-4 rounded-2xl cursor-pointer transition group relative flex justify-between items-center"
              >
                <div className="min-w-0 flex-1 pr-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-xs font-bold text-white group-hover:underline truncate">{p.name}</h5>
                    {p.isPrivate && (
                      <span title="Private">
                        <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />
                      </span>
                    )}
                  </div>

                  {/* Creator attribution if saved or someone else's */}
                  {p.user && (!isOwner || tab === 'saved') && (
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <img
                        src={getAvatarUrl(p.user?.profilePicture, p.user?.gender)}
                        alt="Avatar"
                        className="w-3.5 h-3.5 rounded-full object-cover border border-white/20"
                      />
                      <span className="truncate">by @{p.user.username}</span>
                    </div>
                  )}

                  <span className="text-[10px] text-neutral-500 font-mono block">
                    {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Quick Play in Room button */}
                  <button
                    onClick={(e) => handlePlayInRoom(e, p.id)}
                    disabled={startingRoomId === p.id || trackCount === 0}
                    className="p-2 bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white rounded-xl transition disabled:opacity-40"
                    title="Play in Room"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>

                  {/* Delete (if owner of created) or Unsave (if saved) */}
                  {isOwnProfile && tab === 'created' && (
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      className="p-2 bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-xl transition"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isOwnProfile && tab === 'saved' && (
                    <button
                      onClick={(e) => handleUnsave(e, p.id)}
                      className="p-2 bg-white/5 hover:bg-amber-500/20 text-neutral-400 hover:text-amber-400 rounded-xl transition"
                      title="Remove from saved playlists"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-neutral-500 font-mono italic py-4">
          {tab === 'saved' ? 'No saved playlists yet. Explore other users to take playlists to home!' : 'No playlists created yet.'}
        </div>
      )}

      {selectedPlaylistId && (
        <PlaylistModal
          playlistId={selectedPlaylistId}
          isOwner={selectedPlaylistOwner}
          apiBaseUrl={apiBaseUrl}
          onNavigate={onNavigate}
          onClose={() => {
            setSelectedPlaylistId(null);
            fetchPlaylists();
          }}
        />
      )}
    </div>
  );
}
