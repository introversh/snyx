import React, { useState, useEffect } from 'react';
import { Play, Sparkles, AlertCircle } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Health check check to verify frontend-backend communication
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }
      } catch (err) {
        setApiStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async () => {
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

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0a0a0c] p-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Play className="w-4 h-4 text-white fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Together</span>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121216] border border-slate-800 rounded-full text-xs text-slate-400">
          <span className={`w-2 h-2 rounded-full ${
            apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
            apiStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500 animate-bounce'
          }`} />
          {apiStatus === 'online' && <span>API Online</span>}
          {apiStatus === 'offline' && <span>API Offline</span>}
          {apiStatus === 'checking' && <span>Checking API...</span>}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-12">
        <div className="text-center max-w-md w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold mb-6 border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" /> Private Listening Rooms
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Listen to YouTube together.
          </h1>
          <p className="text-slate-400 text-base mb-10 leading-relaxed">
            Create a private synchronized room with one other person. Synchronize play, pause, seek, and queue state in real time.
          </p>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm mb-6 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition duration-200 text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? 'Creating Room...' : 'Create Private Room'}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">or join existing</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Room Code (e.g. UMI-7X4K)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="flex-1 bg-[#121216] border border-slate-800 focus:border-slate-700 text-white px-4 py-3 rounded-xl outline-none text-sm placeholder:text-slate-600 transition"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-750 text-white font-semibold rounded-xl text-sm transition"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 py-4 max-w-4xl mx-auto w-full">
        <p>&copy; {new Date().getFullYear()} Together. Made for private synchronized listening.</p>
      </footer>
    </div>
  );
}
