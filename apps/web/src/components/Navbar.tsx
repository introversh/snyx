import { useState, useEffect } from 'react';
import { Radio, MessageCircle, LogOut, Share2, Check, Bell } from 'lucide-react';
import { getAvatarUrl } from '../pages/LandingPage';

interface NavbarProps {
  onNavigate: (path: string) => void;
  roomId?: string;
  socketConnected?: boolean;
  onOpenInbox: () => void;
  onOpenNotifications?: () => void;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export default function Navbar({ onNavigate, roomId, socketConnected, onOpenInbox, onOpenNotifications }: NavbarProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnread = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/social/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifications(data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    const stored = localStorage.getItem('snyx_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed);
        if (parsed.token) fetchUnread(parsed.token);
      } catch (e) {}
    }

    const handleAuthChange = () => {
      const u = localStorage.getItem('snyx_user');
      const parsed = u ? JSON.parse(u) : null;
      setCurrentUser(parsed);
      if (parsed?.token) fetchUnread(parsed.token);
    };

    const handleNotificationUpdate = () => {
      const u = localStorage.getItem('snyx_user');
      if (u) {
        try {
          const parsed = JSON.parse(u);
          if (parsed.token) fetchUnread(parsed.token);
        } catch {}
      }
    };

    window.addEventListener('snyx_auth_change', handleAuthChange);
    window.addEventListener('snyx_notification_update', handleNotificationUpdate);

    const interval = setInterval(() => {
      const u = localStorage.getItem('snyx_user');
      if (u) {
        try {
          const parsed = JSON.parse(u);
          if (parsed.token) fetchUnread(parsed.token);
        } catch {}
      }
    }, 6000);

    return () => {
      window.removeEventListener('snyx_auth_change', handleAuthChange);
      window.removeEventListener('snyx_notification_update', handleNotificationUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleCopyLink = () => {
    if (!roomId) return;
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('snyx_user');
    window.dispatchEvent(new Event('snyx_auth_change'));
    onNavigate('/');
  };

  return (
    <header className="border-b border-white/10 bg-[#050505]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 select-none">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => onNavigate('/')}
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center group-hover:scale-105 transition duration-300 shadow-md shadow-white/10">
              <Radio className="w-4.5 h-4.5 text-black animate-pulse" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">Snyx</span>
          </div>

          {socketConnected !== undefined && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase font-bold tracking-wider text-neutral-400">
              <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-white animate-pulse' : 'bg-red-400'}`} />
              {socketConnected ? 'Connected' : 'Offline'}
            </span>
          )}
        </div>

        {/* Right: Controls */}
        {currentUser ? (
          <div className="flex items-center gap-3">
            {/* Room Share button if inside watchroom */}
            {roomId && (
              <>
                <button
                  onClick={handleCopyLink}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full text-xs font-bold text-slate-200 transition active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Link' : `Room: ${roomId}`}</span>
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('snyx_active_room_id');
                    onNavigate('/');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-full text-xs font-bold text-red-400 hover:text-red-300 transition duration-300 active:scale-95 cursor-pointer"
                  title="Exit Room and Return to Home"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Exit Room</span>
                </button>
              </>
            )}

            {/* Notifications Bell Button */}
            <button
              onClick={() => {
                if (onOpenNotifications) {
                  onOpenNotifications();
                } else {
                  window.dispatchEvent(new Event('snyx_open_notifications'));
                }
              }}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full text-slate-200 hover:text-white transition duration-300 relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-black animate-pulse">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {/* Inbox / Friend Requests Button */}
            <button
              onClick={onOpenInbox}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-full text-slate-200 hover:text-white transition duration-300 relative"
              title="Inbox & Friend Requests"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            {/* Profile Avatar Button */}
            <button
              onClick={() => onNavigate(`/${currentUser.username}`)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition duration-300 active:scale-95"
              title="View Profile Page"
            >
              <div className="relative">
                <img
                  src={getAvatarUrl(currentUser.profilePicture, currentUser.gender)}
                  alt="Avatar"
                  className="w-5 h-5 object-cover rounded-full border border-white/20 shrink-0"
                />
                {currentUser.showActiveStatus && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-black"></div>
                )}
              </div>
              <span className="max-w-[100px] truncate font-extrabold">@{currentUser.username}</span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-400 hover:text-white rounded-full transition duration-300"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/')}
              className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-extrabold text-xs rounded-full transition uppercase tracking-wider"
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
