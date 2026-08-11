import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, MessageCircle, RefreshCw, Camera, X, Users, Clock, UserX, Lock } from 'lucide-react';
import { getAvatarUrl } from './LandingPage';
import Navbar from '../components/Navbar';
import DmInboxModal from '../components/DmInboxModal';

interface ProfilePageProps {
  username: string;
  onNavigate: (path: string) => void;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export default function ProfilePage({ username, onNavigate }: ProfilePageProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DM Modal State
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);

  // Edit Profile Inline States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGender, setEditGender] = useState('male');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Friends Modal States
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsBlocked, setFriendsBlocked] = useState(false);

  // Friend Request Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  // Current logged in user info
  const storedUserStr = localStorage.getItem('snyx_user');
  if (!storedUserStr) {
    onNavigate('/');
    return null;
  }
  const currentUser = JSON.parse(storedUserStr);
  const isOwnProfile = currentUser.username.toLowerCase() === username.toLowerCase();

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/social/profile/username/${username}`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (!res.ok) {
        throw new Error('Profile not found.');
      }
      const data = await res.json();
      setUser(data);
      // Pre-fill edit inputs
      setEditName(data.displayName || '');
      setEditBio(data.bio || '');
      setEditGender(data.gender || 'male');
      setEditAvatar(data.profilePicture || '');
      setEditBanner(data.profileBanner || '');
      setEditIsPrivate(data.isPrivate || false);
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Friend Request Actions: Send, Accept, Decline, Cancel, Remove
  const handleSendRequest = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friend-request/send/${user.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setUser({ ...user, friendStatus: 'SENT_PENDING' });
      }
    } catch (e) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friend-request/cancel/${user.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setUser({ ...user, friendStatus: 'NONE' });
      }
    } catch (e) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friend-request/accept/${user.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setUser({
          ...user,
          friendStatus: 'FRIENDS',
          friendsCount: (user.friendsCount || 0) + 1
        });
      }
    } catch (e) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friend-request/decline/${user.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setUser({ ...user, friendStatus: 'NONE' });
      }
    } catch (e) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user || actionLoading) return;
    if (!confirm(`Are you sure you want to remove @${user.username} from your friends?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friend-request/unfriend/${user.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setUser({
          ...user,
          friendStatus: 'NONE',
          friendsCount: Math.max(0, (user.friendsCount || 0) - 1)
        });
      }
    } catch (e) {
    } finally {
      setActionLoading(false);
    }
  };

  const fetchFriendsModal = async () => {
    if (!user) return;
    setIsFriendsModalOpen(true);
    setFriendsBlocked(false);

    // If target profile is private, non-owner, and not mutual friend -> Block access immediately
    if (user.isPrivate && !isOwnProfile && user.friendStatus !== 'FRIENDS') {
      setFriendsBlocked(true);
      return;
    }

    setFriendsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/friends/${user.id}`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.status === 403) {
        setFriendsBlocked(true);
        return;
      }
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

  // Direct Image File Pickers for Inline Editing
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Image size should be less than 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'avatar') {
          setEditAvatar(reader.result as string);
        } else {
          setEditBanner(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          displayName: editName.trim() || null,
          profilePicture: editAvatar.trim() || null,
          bio: editBio.trim(),
          profileBanner: editBanner.trim(),
          gender: editGender,
          isPrivate: editIsPrivate
        })
      });

      if (!res.ok) throw new Error('Failed to save profile');
      const data = await res.json();

      const updatedUser = {
        ...currentUser,
        displayName: data.displayName,
        profilePicture: data.profilePicture,
        bio: data.bio,
        profileBanner: data.profileBanner,
        gender: data.gender,
        isPrivate: data.isPrivate
      };
      localStorage.setItem('snyx_user', JSON.stringify(updatedUser));

      setUser({
        ...user,
        displayName: data.displayName,
        profilePicture: data.profilePicture,
        bio: data.bio,
        profileBanner: data.profileBanner,
        gender: data.gender,
        isPrivate: data.isPrivate
      });

      setIsEditing(false);
      window.dispatchEvent(new Event('snyx_auth_change'));

    } catch (e: any) {
      alert(e.message || 'Error saving profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const defaultBanner = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop&q=80';

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between font-sans relative">
      
      {/* Unified Monochromatic Navbar */}
      <Navbar
        onNavigate={onNavigate}
        onOpenInbox={() => setIsDmModalOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto p-6 z-10 space-y-8">
        
        {loading ? (
          <div className="text-center p-24 space-y-3 font-mono">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-white" />
            <span className="text-neutral-400">LOADING PROFILE...</span>
          </div>
        ) : error ? (
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl text-center space-y-4 max-w-md mx-auto">
            <p className="text-neutral-300 text-sm font-semibold">{error}</p>
            <button
              onClick={() => onNavigate('/')}
              className="px-4 py-2.5 bg-white text-black text-xs font-bold rounded-2xl"
            >
              Go Home
            </button>
          </div>
        ) : user ? (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Inline Profile Editing Mode */}
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="bg-[#080808] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Edit Your Profile</h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="p-1.5 text-neutral-400 hover:text-white bg-white/5 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Banner & Avatar interactive upload pickers */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 h-36">
                  <img
                    src={editBanner || defaultBanner}
                    alt="Banner"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <label className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 transition">
                    <div className="flex items-center gap-2 bg-black/80 px-4 py-2 rounded-full border border-white/20 text-xs font-bold text-white">
                      <Camera className="w-4 h-4" /> Change Cover Banner
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImagePick(e, 'banner')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 bg-black shrink-0">
                    <img
                      src={getAvatarUrl(editAvatar, editGender)}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 transition">
                      <Camera className="w-4 h-4 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImagePick(e, 'avatar')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">Click circle or cover image to upload photo</span>
                    <span className="block text-[10px] text-neutral-500">Supports JPG, PNG & Base64 uploads</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold ml-1">DISPLAY NAME</label>
                  <input
                    type="text"
                    placeholder={user.username}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-white/20 text-white px-4 py-3 rounded-2xl outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold ml-1">BIOGRAPHY</label>
                  <textarea
                    rows={3}
                    placeholder="Tell your friends about yourself..."
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={160}
                    className="w-full bg-white/5 border border-white/10 focus:border-white/20 text-white px-4 py-3 rounded-2xl outline-none text-xs resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold ml-1">GENDER</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-2xl outline-none text-xs"
                  >
                    <option value="male" className="bg-[#0b0c1e] text-white">Male (Blue Silhouette Default)</option>
                    <option value="female" className="bg-[#0b0c1e] text-white">Female (Pink Silhouette Default)</option>
                    <option value="other" className="bg-[#0b0c1e] text-white">Other</option>
                  </select>
                </div>

                {/* Account Privacy Setting Toggle */}
                <div
                  onClick={() => setEditIsPrivate(!editIsPrivate)}
                  className="flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer transition select-none"
                >
                  <div className="space-y-0.5">
                    <span className="block text-xs font-extrabold text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-white" /> Private Account
                    </span>
                    <span className="block text-[10px] text-neutral-400">
                      Hide your friends list from non-friends. Only mutual friends can view your friends list.
                    </span>
                  </div>
                  <div className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 ${editIsPrivate ? 'bg-white justify-end' : 'bg-white/10 justify-start'}`}>
                    <div className={`w-4 h-4 rounded-full shadow-md ${editIsPrivate ? 'bg-black' : 'bg-neutral-500'}`} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex-grow py-3 bg-white hover:bg-neutral-200 active:scale-95 text-black font-extrabold rounded-2xl transition duration-300 uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-2xl text-xs uppercase"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Instagram Style Display Header */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
                
                {/* Left Side: Large Avatar */}
                <div className="md:col-span-4 flex justify-center">
                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border border-white/20 overflow-hidden shadow-2xl bg-neutral-900">
                    <img
                      src={getAvatarUrl(user.profilePicture, user.gender)}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Right Side: Identity information, privacy badge, buttons */}
                <div className="md:col-span-8 space-y-5 text-center md:text-left">
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg md:text-xl font-normal text-white">@{user.username}</h2>
                      {user.isPrivate && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/10 border border-white/15 rounded-full text-[9px] font-extrabold uppercase tracking-wider text-neutral-300" title="Private Account">
                          <Lock className="w-3 h-3 text-white" /> Private
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isOwnProfile ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-bold transition duration-300"
                        >
                          Edit Profile
                        </button>
                      ) : (
                        <>
                          {user.friendStatus === 'FRIENDS' ? (
                            <button
                              onClick={handleRemoveFriend}
                              disabled={actionLoading}
                              className="px-5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition duration-300"
                              title="Click to Unfriend"
                            >
                              <UserCheck className="w-4 h-4" />
                              <span>Friend</span>
                            </button>
                          ) : user.friendStatus === 'SENT_PENDING' ? (
                            <button
                              onClick={handleCancelRequest}
                              disabled={actionLoading}
                              className="px-5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white/70 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition duration-300"
                              title="Click to Cancel Request"
                            >
                              <Clock className="w-4 h-4 text-white/70" />
                              <span>Requested</span>
                            </button>
                          ) : user.friendStatus === 'RECEIVED_PENDING' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={handleAcceptRequest}
                                disabled={actionLoading}
                                className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition shadow-md"
                              >
                                <UserCheck className="w-4 h-4" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={handleDeclineRequest}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition"
                              >
                                <UserX className="w-4 h-4" />
                                <span>Decline</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={handleSendRequest}
                              disabled={actionLoading}
                              className="px-5 py-1.5 bg-white hover:bg-neutral-250 text-black rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition duration-300 shadow-md"
                            >
                              {actionLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  <span>Add Friend</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              const activeRoom = localStorage.getItem('snyx_active_room_id');
                              localStorage.setItem('snyx_open_dm_userId', user.id);
                              if (activeRoom) {
                                onNavigate(`/room/${activeRoom}`);
                              } else {
                                onNavigate('/');
                              }
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition"
                            title="Message User"
                          >
                            <MessageCircle className="w-4 h-4 text-white" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Friends Count (With Private Access Restrictions) */}
                  <div className="flex justify-center md:justify-start gap-8 border-t border-b border-white/5 py-2 md:border-none md:py-0">
                    <span
                      onClick={fetchFriendsModal}
                      className="text-sm text-neutral-400 cursor-pointer hover:underline flex items-center gap-1.5"
                    >
                      <Users className="w-4 h-4 text-white" />
                      <strong className="text-white font-bold">{user.friendsCount || 0}</strong> friends
                    </span>
                  </div>

                  {/* Display Name & Bio */}
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-slate-100">{user.displayName || user.username}</h3>
                    <p className="text-xs text-neutral-350 leading-relaxed font-medium mt-2 max-w-md whitespace-pre-line italic">
                      {user.bio || "Do I need to introduce myself?."}
                    </p>
                  </div>

                </div>
              </div>
            )}

          </div>
        ) : null}

      </main>

      {/* Friends List Modal (Supports Private Account Blocking) */}
      {isFriendsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm select-none animate-fadeIn">
          <div className="bg-[#050505] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                {user?.username}'s Friends
              </h3>
              <button
                onClick={() => setIsFriendsModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {friendsBlocked ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mx-auto text-white">
                    <Lock className="w-6 h-6" />
                  </div>
                  <span className="block text-xs font-black text-white uppercase tracking-wider">This Account is Private</span>
                  <span className="block text-[10px] text-neutral-400 max-w-[220px] mx-auto leading-relaxed">
                    Only mutual friends can view @{user?.username}'s friends list. Send a friend request to connect!
                  </span>
                </div>
              ) : friendsLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2 font-mono text-[10px] text-neutral-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Loading friends list...</span>
                </div>
              ) : friendsList.length > 0 ? (
                friendsList.map((friend) => (
                  <div
                    key={friend.id}
                    onClick={() => {
                      setIsFriendsModalOpen(false);
                      onNavigate(`/${friend.username}`);
                    }}
                    className="flex items-center justify-between p-2.5 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-2xl gap-3 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <img src={getAvatarUrl(friend.profilePicture, friend.gender)} className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate leading-none">{friend.displayName || friend.username}</span>
                        <span className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider mt-1">@{friend.username}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 space-y-2">
                  <span className="block text-xs font-extrabold text-neutral-500 uppercase tracking-wider">No Friends Found</span>
                  <span className="block text-[10px] text-neutral-600 font-medium">
                    This user has no friends added yet.
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* DM Inbox Modal Component */}
      <DmInboxModal
        isOpen={isDmModalOpen}
        onClose={() => setIsDmModalOpen(false)}
        onNavigate={onNavigate}
        currentUser={currentUser}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Footer */}
      <footer className="text-center text-[10px] text-neutral-600 font-mono tracking-widest py-4 max-w-4xl mx-auto w-full border-t border-white/5 mt-8">
        <p>&copy; {new Date().getFullYear()} SNYX. MONOCHROME PLATFORM CONTRACT v1.5.0</p>
      </footer>
    </div>
  );
}
