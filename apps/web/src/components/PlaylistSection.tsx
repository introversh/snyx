import React, { useState, useEffect } from 'react';
import { Plus, ListMusic, Trash2, Lock, Globe } from 'lucide-react';
import PlaylistModal from './PlaylistModal';

interface PlaylistSectionProps {
  userId: string;
  isOwnProfile: boolean;
  apiBaseUrl: string;
}

export default function PlaylistSection({ userId, isOwnProfile, apiBaseUrl }: PlaylistSectionProps) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  let currentUser: any = null;
  try {
    const stored = localStorage.getItem('snyx_user');
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/playlists/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${currentUser?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchPlaylists();
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          name: newTitle.trim(),
          description: newDesc.trim() || undefined,
          isPrivate: newIsPrivate,
        })
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
        headers: { 'Authorization': `Bearer ${currentUser?.token}` }
      });
      if (res.ok) {
        fetchPlaylists();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <h4 className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-white" /> Playlists
        </h4>
        {isOwnProfile && (
          <button 
            onClick={() => setIsCreateOpen(!isCreateOpen)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-white transition"
          >
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        )}
      </div>

      {isCreateOpen && isOwnProfile && (
        <form onSubmit={handleCreate} className="bg-[#080808] border border-white/10 p-4 rounded-xl space-y-3">
          <input 
            type="text" 
            placeholder="Playlist Name" 
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs text-white outline-none focus:border-white/20"
            required
          />
          <input 
            type="text" 
            placeholder="Description (Optional)" 
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs text-white outline-none focus:border-white/20"
          />

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between py-1 px-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
              <input 
                type="checkbox"
                checked={newIsPrivate}
                onChange={e => setNewIsPrivate(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-white accent-white"
              />
              <span className="flex items-center gap-1.5">
                {newIsPrivate ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Globe className="w-3.5 h-3.5 text-neutral-400" />}
                {newIsPrivate ? 'Private Playlist (Only you can see)' : 'Public Playlist (Anyone can see)'}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-white text-black text-[10px] font-bold rounded-lg hover:bg-neutral-200">Save</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-[10px] text-neutral-500 font-mono">Loading playlists...</div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {playlists.map(p => {
            const trackCount = p._count?.items ?? p.items?.length ?? 0;
            return (
              <div 
                key={p.id} 
                onClick={() => setSelectedPlaylistId(p.id)}
                className="bg-black border border-white/10 hover:border-white/20 p-3.5 rounded-xl cursor-pointer transition group relative flex justify-between items-center"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-xs font-bold text-white group-hover:underline truncate">{p.name}</h5>
                    {p.isPrivate && (
                      <span title="Private">
                        <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-neutral-400 block mt-1">
                    {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
                {isOwnProfile && (
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={(e) => handleDelete(e, p.id)}
                      className="p-1.5 bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[10px] text-neutral-500 font-mono italic">No playlists found.</div>
      )}

      {selectedPlaylistId && (
        <PlaylistModal 
          playlistId={selectedPlaylistId} 
          isOwner={isOwnProfile} 
          apiBaseUrl={apiBaseUrl} 
          onClose={() => {
            setSelectedPlaylistId(null);
            fetchPlaylists();
          }} 
        />
      )}
    </div>
  );
}
