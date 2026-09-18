import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '@youtube-together/shared';
import { getAvatarUrl } from './LandingPage';
import { ArrowLeft, RefreshCw, DoorClosed, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';
const KNOCK_TIMEOUT_SECONDS = 60; // 1-minute timeout as requested

interface KnockWaitingPageProps {
  username: string;
  onNavigate: (path: string) => void;
}

export default function KnockWaitingPage({ username, onNavigate }: KnockWaitingPageProps) {
  const [targetUser, setTargetUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [knockState, setKnockState] = useState<'knocking' | 'waiting' | 'offline' | 'timeout' | 'admitted'>('knocking');
  const [secondsRemaining, setSecondsRemaining] = useState(KNOCK_TIMEOUT_SECONDS);

  const socketRef = useRef<Socket | null>(null);
  
  let currentUser: any = null;
  try {
    const stored = localStorage.getItem('snyx_user');
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  const sendKnock = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(SocketEvents.HOME_KNOCK, { targetUsername: username });
    }
  };

  const handleRetry = () => {
    setSecondsRemaining(KNOCK_TIMEOUT_SECONDS);
    setKnockState('knocking');
    sendKnock();
  };

  useEffect(() => {
    if (!currentUser || !currentUser.token) {
      onNavigate('/');
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/social/profile/username/${username}`, {
          headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        if (!isMounted) return;
        setTargetUser(data);

        const socket = io(SOCKET_URL, {
          auth: { token: currentUser.token },
          transports: ['websocket']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit(SocketEvents.HOME_KNOCK, { targetUsername: username });
        });

        socket.on(SocketEvents.HOME_KNOCK_WAITING, (payload?: { offline?: boolean }) => {
          if (payload?.offline) {
            setKnockState('offline');
          } else {
            setKnockState('waiting');
          }
        });

        socket.on(SocketEvents.HOME_KNOCK_ADMITTED, (payload) => {
          setKnockState('admitted');
          socket.disconnect();
          onNavigate(`/room/${payload.roomId}`);
        });

        setLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [username, currentUser?.token]);

  // 1-minute countdown timer
  useEffect(() => {
    if (loading || knockState === 'offline' || knockState === 'admitted' || knockState === 'timeout') {
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setKnockState('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, knockState]);

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 font-sans">
      <Navbar onNavigate={onNavigate} onOpenInbox={() => {}} />
      
      <main className="flex-grow flex flex-col items-center justify-center p-6 z-10">
        <div className="w-full max-w-sm bg-[#050505] border border-white/10 rounded-3xl p-8 flex flex-col items-center shadow-2xl space-y-6">
          
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-white" />
              <span className="text-xs text-neutral-400 font-mono tracking-widest uppercase">Connecting...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="text-sm font-bold text-red-400">{error}</span>
            </div>
          ) : targetUser && (
            <>
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-white/20 overflow-hidden bg-neutral-900 relative z-10">
                  <img src={getAvatarUrl(targetUser.profilePicture, targetUser.gender)} className="w-full h-full object-cover" alt={targetUser.username} />
                </div>
                {(knockState === 'knocking' || knockState === 'waiting') && (
                  <div className="absolute inset-0 rounded-full border border-white/30 animate-ping z-0" />
                )}
              </div>

              <div className="text-center space-y-2 w-full">
                <h2 className="text-lg font-black text-white">
                  {targetUser.displayName || targetUser.username}
                </h2>
                
                {knockState === 'knocking' && (
                  <p className="text-xs text-neutral-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Knocking on their door...
                  </p>
                )}
                {knockState === 'waiting' && (
                  <p className="text-xs text-neutral-400">
                    Waiting for response...
                  </p>
                )}
                {knockState === 'timeout' && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <p className="text-xs font-semibold text-amber-400">
                      No response within 1 minute
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      They might be away from their screen right now.
                    </p>
                  </div>
                )}
                {knockState === 'offline' && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <DoorClosed className="w-5 h-5 text-neutral-500" />
                    <p className="text-xs text-neutral-400">
                      Not home right now. They'll be notified of your visit.
                    </p>
                  </div>
                )}

                {/* Progress bar and countdown for 1-minute timeout */}
                {(knockState === 'knocking' || knockState === 'waiting') && (
                  <div className="w-full space-y-1 pt-2">
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-white/80 h-full transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${(secondsRemaining / KNOCK_TIMEOUT_SECONDS) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {secondsRemaining}s remaining
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="w-full space-y-2 pt-2">
            {knockState === 'timeout' && (
              <button 
                onClick={handleRetry}
                className="w-full py-2.5 bg-white/20 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Knock Again
              </button>
            )}

            <button 
              onClick={() => onNavigate('/')}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
