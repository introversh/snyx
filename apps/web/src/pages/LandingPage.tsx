import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, User, Lock, CheckCircle, X, RefreshCw } from 'lucide-react';
import DmInboxModal from '../components/DmInboxModal';
import Navbar from '../components/Navbar';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

// Facebook-style default silhouette SVGs based on gender
export const getAvatarUrl = (userPic?: string, gender?: string) => {
  if (userPic && userPic.trim()) {
    return userPic;
  }
  if (gender === 'female') {
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='100%25' height='100%25' fill='%23fceef2'/><circle cx='12' cy='9' r='4.5' fill='%23e67e9f'/><path d='M12 15c-4.5 0-7.5 2.5-7.5 5v1h15v-1c0-2.5-3-5-7.5-5z' fill='%23e67e9f'/></svg>`;
  }
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='100%25' height='100%25' fill='%23ebedf0'/><circle cx='12' cy='9' r='4.5' fill='%238a8f9d'/><path d='M12 15c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z' fill='%238a8f9d'/></svg>`;
};

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Authentication States
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [genderInput, setGenderInput] = useState('male'); // male, female, other
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Invites list state
  const [invites, setInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // DM Inbox Modal State
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('snyx_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem('snyx_user');
      }
    }
  }, []);

  // Fetch Received Watchroom Invites
  useEffect(() => {
    if (user && user.token) {
      fetchInvites();
      const interval = setInterval(fetchInvites, 5000); // Poll invites every 5s
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchInvites = async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/invites`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInvitesLoading(false);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/social/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRoom = async () => {
    if (!user) {
      setError('Please log in to continue.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      setIsLoading(false);
      onNavigate(`/room/${data.roomId}`);
    } catch (err) {
      setIsLoading(false);
      setError('Failed to create room. Please check if the API is online.');
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to continue.');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code.');
      return;
    }
    const cleanCode = roomCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(cleanCode)) {
      setError('Invalid room code format.');
      return;
    }
    onNavigate(`/room/${cleanCode}`);
  };

  // Auth Submit Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const username = usernameInput.trim();
    const password = passwordInput;

    if (!username || !password) {
      setAuthError('Please fill in all fields.');
      return;
    }

    if (username.length < 3) {
      setAuthError('Username must be at least 3 characters long.');
      return;
    }

    if (password.length < 4) {
      setAuthError('Password must be at least 4 characters long.');
      return;
    }

    setAuthLoading(true);
    const endpoint = authMode === 'signup' ? 'signup' : 'login';

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, gender: genderInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      localStorage.setItem('snyx_user', JSON.stringify(data));
      setUser(data);
      setAuthSuccess(authMode === 'signup' ? 'Account created successfully!' : 'Logged in successfully!');
      
      setUsernameInput('');
      setPasswordInput('');

      // Dispatch auth state change
      window.dispatchEvent(new Event('snyx_auth_change'));

      setTimeout(() => {
        setAuthSuccess(null);
      }, 800);

    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-black text-slate-100 font-sans relative">
      
      {/* Unified Monochromatic Navbar */}
      <Navbar
        onNavigate={onNavigate}
        onOpenInbox={() => setIsDmModalOpen(true)}
      />

      {/* Hero Body */}
      <main className="flex-grow flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-12 px-6 z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full items-center">
          
          {/* Left Column */}
          <div className="md:col-span-6 text-center md:text-left space-y-6">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-slate-300 cursor-default">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-white" /> Next-Gen Social watch party
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-none">
              Hangout, listen <br/>& vibe together.
            </h1>
            <p className="text-neutral-400 text-xs md:text-sm leading-relaxed max-w-sm">
              Create synchronized watch parties with low-latency media syncing, instantaneous chat feeds, and mutual friend connections.
            </p>
          </div>

          {/* Right Column */}
          <div className="md:col-span-6 w-full max-w-md mx-auto">
            
            <div className="bg-[#050505] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6">
              
              {!user ? (
                <div className="space-y-4">
                  {authError && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-slate-200 text-xs">
                      <AlertCircle className="w-4 h-4 text-white shrink-0" />
                      <span className="font-mono">{authError}</span>
                    </div>
                  )}
                  {authSuccess && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white text-xs">
                      <CheckCircle className="w-4 h-4 text-white shrink-0" />
                      <span className="font-mono">{authSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                        {authMode === 'login' ? 'MEMBER LOGIN' : 'CREATE ACCOUNT'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === 'login' ? 'signup' : 'login');
                          setAuthError(null);
                        }}
                        className="text-[10px] font-bold text-slate-300 hover:text-white underline underline-offset-4"
                      >
                        {authMode === 'login' ? "Register" : 'Login'}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="USERNAME"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-white/20 text-white pl-10 pr-4 py-3 rounded-2xl outline-none text-xs focus:bg-white/10 transition"
                      />
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-500" />
                    </div>

                    <div className="relative">
                      <input
                        type="password"
                        placeholder="PASSWORD"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-white/20 text-white pl-10 pr-4 py-3 rounded-2xl outline-none text-xs focus:bg-white/10 transition"
                      />
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-500" />
                    </div>

                    {/* Gender Selector in Signup Form */}
                    {authMode === 'signup' && (
                      <div className="space-y-1">
                        <label className="block text-[8px] uppercase tracking-widest font-mono font-bold text-neutral-400 ml-1">SELECT GENDER</label>
                        <select
                          value={genderInput}
                          onChange={(e) => setGenderInput(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-2xl outline-none text-xs focus:bg-white/10 transition"
                        >
                          <option value="male" className="bg-[#0b0c1e] text-white">Male</option>
                          <option value="female" className="bg-[#0b0c1e] text-white">Female</option>
                          <option value="other" className="bg-[#0b0c1e] text-white">Other</option>
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 bg-white hover:bg-neutral-200 active:scale-[0.98] text-black text-xs font-black rounded-2xl transition duration-300 uppercase tracking-widest font-mono flex items-center justify-center gap-2"
                    >
                      {authLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          <span>AUTHENTICATING...</span>
                        </>
                      ) : (
                        authMode === 'login' ? 'LOGIN' : 'SIGN UP'
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Playrooms Panel */
                <div className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-slate-200 text-xs">
                      <AlertCircle className="w-4 h-4 text-white shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Invites list with smooth loader */}
                  <div className="space-y-2.5 bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <h4 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center justify-between">
                      <span>Received Watchroom Invites</span>
                      {invitesLoading && <RefreshCw className="w-3 h-3 animate-spin text-white" />}
                    </h4>
                    
                    {invitesLoading && invites.length === 0 ? (
                      <div className="py-4 text-center text-neutral-400 font-mono text-[10px] flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Checking invites...</span>
                      </div>
                    ) : invites.length > 0 ? (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {invites.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between bg-black border border-white/10 p-2.5 rounded-xl gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={getAvatarUrl(inv.sender.profilePicture, inv.sender.gender)}
                                className="w-6 h-6 rounded-full object-cover border border-white/10 shrink-0"
                              />
                              <span className="text-[11px] truncate font-medium text-slate-200 cursor-pointer hover:underline" onClick={() => onNavigate(`/${inv.sender.username}`)}>
                                <strong>{inv.sender.displayName || inv.sender.username}</strong> invites you
                              </span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => onNavigate(`/room/${inv.roomId}`)}
                                className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black text-[9px] font-black uppercase rounded-lg"
                              >
                                Join
                              </button>
                              <button
                                onClick={() => handleDeclineInvite(inv.id)}
                                className="p-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-lg"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-400 font-medium italic">No watchroom invites right now.</p>
                    )}
                  </div>

                  <button
                    onClick={handleCreateRoom}
                    disabled={isLoading}
                    className="w-full py-3.5 bg-white hover:bg-neutral-200 active:scale-[0.98] text-black font-extrabold rounded-2xl transition duration-300 uppercase tracking-wider text-xs shadow-md flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Creating Room...</span>
                      </>
                    ) : (
                      'Create Watchroom'
                    )}
                  </button>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10" />
                    <span className="flex-shrink mx-4 text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">or join room</span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>

                  <form onSubmit={handleJoinRoom} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ROOM CODE (eg. UMI-1432)"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      className="flex-grow bg-white/5 border border-white/10 focus:border-white/20 text-white px-4 py-3 rounded-2xl outline-none text-xs focus:bg-white/10 transition"
                    />
                    <button
                      type="submit"
                      className="px-6 bg-white hover:bg-neutral-200 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider rounded-2xl transition duration-300"
                    >
                      JOIN
                    </button>
                  </form>
                </div>
              )}

            </div>

          </div>
        </div>
      </main>

      {/* DM Inbox Modal Component */}
      <DmInboxModal
        isOpen={isDmModalOpen}
        onClose={() => setIsDmModalOpen(false)}
        onNavigate={onNavigate}
        currentUser={user}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Footer */}
      <footer className="text-center text-[10px] text-neutral-500 font-mono tracking-widest py-4 max-w-4xl mx-auto w-full border-t border-white/10">
        <p>&copy; {new Date().getFullYear()} SNYX. MONOCHROME PLATFORM CONTRACT v1.5.0</p>
      </footer>
    </div>
  );
}
