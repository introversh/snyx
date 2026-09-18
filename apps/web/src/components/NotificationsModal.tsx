import { useState, useEffect } from 'react';
import { X, Bell, DoorOpen, Radio, UserPlus, Check, Trash2, RefreshCw } from 'lucide-react';
import { getAvatarUrl } from '../pages/LandingPage';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  apiBaseUrl: string;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  onNavigate,
  apiBaseUrl,
}: NotificationsModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'knocks' | 'invites' | 'friends'>('all');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    unreadCount: number;
    unseenKnocksCount: number;
    knocks: any[];
    invites: any[];
    friendRequests: any[];
  }>({
    unreadCount: 0,
    unseenKnocksCount: 0,
    knocks: [],
    invites: [],
    friendRequests: [],
  });

  const getStoredUser = () => {
    try {
      const stored = localStorage.getItem('snyx_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const currentUser = getStoredUser();

  const fetchNotifications = async () => {
    if (!currentUser || !currentUser.token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/social/notifications`, {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    if (!currentUser || !currentUser.token) return;
    try {
      await fetch(`${apiBaseUrl}/social/notifications/mark-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      setData((prev) => ({
        ...prev,
        unreadCount: prev.invites.length + prev.friendRequests.length,
        unseenKnocksCount: 0,
        knocks: prev.knocks.map((k) => ({ ...k, seenByOwner: true })),
      }));
      window.dispatchEvent(new Event('snyx_notification_update'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleKnockRespond = async (knockId: string, action: 'admit' | 'dismiss') => {
    if (!currentUser || !currentUser.token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/social/knocks/${knockId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          knocks: prev.knocks.map((k) =>
            k.id === knockId ? { ...k, status: action === 'admit' ? 'ADMITTED' : 'DISMISSED', seenByOwner: true } : k
          ),
        }));
        window.dispatchEvent(new Event('snyx_notification_update'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    if (!currentUser || !currentUser.token) return;
    try {
      await fetch(`${apiBaseUrl}/social/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      setData((prev) => ({
        ...prev,
        invites: prev.invites.filter((i) => i.id !== inviteId),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      window.dispatchEvent(new Event('snyx_notification_update'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptFriend = async (userId: string) => {
    if (!currentUser || !currentUser.token) return;
    try {
      await fetch(`${apiBaseUrl}/social/friend-request/accept/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      setData((prev) => ({
        ...prev,
        friendRequests: prev.friendRequests.filter((fr) => fr.sender?.id !== userId),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      window.dispatchEvent(new Event('snyx_notification_update'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineFriend = async (userId: string) => {
    if (!currentUser || !currentUser.token) return;
    try {
      await fetch(`${apiBaseUrl}/social/friend-request/decline/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      setData((prev) => ({
        ...prev,
        friendRequests: prev.friendRequests.filter((fr) => fr.sender?.id !== userId),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      window.dispatchEvent(new Event('snyx_notification_update'));
    } catch (e) {
      console.error(e);
    }
  };

  const getRelativeTime = (timestamp: string | number | Date) => {
    const time = new Date(timestamp).getTime();
    const diff = time - Date.now();
    const diffMinutes = Math.round(diff / 60000);
    const diffHours = Math.round(diff / 3600000);
    const diffDays = Math.round(diff / 86400000);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
  };

  if (!isOpen) return null;

  const filteredKnocks = activeTab === 'all' || activeTab === 'knocks' ? data.knocks : [];
  const filteredInvites = activeTab === 'all' || activeTab === 'invites' ? data.invites : [];
  const filteredFriends = activeTab === 'all' || activeTab === 'friends' ? data.friendRequests : [];
  const totalItemsCount = filteredKnocks.length + filteredInvites.length + filteredFriends.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#050505] border border-white/10 w-full max-w-lg max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Notifications</h3>
              <p className="text-[11px] text-neutral-400">
                {data.unreadCount > 0 ? `${data.unreadCount} unread update${data.unreadCount === 1 ? '' : 's'}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.unseenKnocksCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-neutral-400 hover:text-white font-mono px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Mark read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white bg-white/5 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/40 px-6 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'all'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All ({data.knocks.length + data.invites.length + data.friendRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('knocks')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'knocks'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            Knocks ({data.knocks.length})
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'invites'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Invites ({data.invites.length})
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'friends'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Friends ({data.friendRequests.length})
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading && totalItemsCount === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-neutral-400 text-xs font-mono">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading updates...
            </div>
          ) : totalItemsCount === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Bell className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-semibold text-neutral-300">No notifications yet</p>
              <p className="text-xs text-neutral-500">
                Door knocks, room invites, and friend requests will show up here.
              </p>
            </div>
          ) : (
            <>
              {/* Door Knocks Section */}
              {filteredKnocks.map((k) => (
                <div
                  key={`knock-${k.id}`}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    !k.seenByOwner
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getAvatarUrl(k.knocker?.profilePicture, k.knocker?.gender)}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full border border-white/20 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {k.knocker?.displayName || k.knocker?.username}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          @{k.knocker?.username}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 flex items-center gap-1 mt-0.5">
                        <DoorOpen className="w-3 h-3 text-neutral-400" />
                        Knocked on your Home door
                      </p>
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                        {getRelativeTime(k.knockedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Status */}
                  <div className="shrink-0 flex items-center gap-2">
                    {k.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => handleKnockRespond(k.id, 'admit')}
                          className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Let In
                        </button>
                        <button
                          onClick={() => handleKnockRespond(k.id, 'dismiss')}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                          k.status === 'ADMITTED'
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-white/5 border-white/10 text-neutral-400'
                        }`}
                      >
                        {k.status === 'ADMITTED' ? 'Admitted' : 'Dismissed'}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Room Invites Section */}
              {filteredInvites.map((inv) => (
                <div
                  key={`invite-${inv.id}`}
                  className="p-3.5 rounded-2xl border bg-white/5 border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getAvatarUrl(inv.sender?.profilePicture, inv.sender?.gender)}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full border border-white/20 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {inv.sender?.displayName || inv.sender?.username}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          @{inv.sender?.username}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 flex items-center gap-1 mt-0.5">
                        <Radio className="w-3 h-3 text-neutral-400" />
                        Invited you to room <span className="font-mono font-bold text-white">{inv.roomId}</span>
                      </p>
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                        {getRelativeTime(inv.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onNavigate(`/room/${inv.roomId}`);
                      }}
                      className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      Join Room
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(inv.id)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition"
                      title="Decline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Friend Requests Section */}
              {filteredFriends.map((fr) => (
                <div
                  key={`fr-${fr.id}`}
                  className="p-3.5 rounded-2xl border bg-white/5 border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getAvatarUrl(fr.sender?.profilePicture, fr.sender?.gender)}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full border border-white/20 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {fr.sender?.displayName || fr.sender?.username}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          @{fr.sender?.username}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 flex items-center gap-1 mt-0.5">
                        <UserPlus className="w-3 h-3 text-neutral-400" />
                        Sent you a friend request
                      </p>
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                        {getRelativeTime(fr.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => handleAcceptFriend(fr.sender?.id)}
                      className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => handleDeclineFriend(fr.sender?.id)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition"
                      title="Decline"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
