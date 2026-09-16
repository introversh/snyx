import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';
import ProfilePage from './pages/ProfilePage';
import KnockWaitingPage from './pages/KnockWaitingPage';
import KnockPopup from './components/KnockPopup';
import { io, Socket } from 'socket.io-client';
import { SocketEvents, HomeKnockIncoming } from '@youtube-together/shared';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:3000';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const checkUserLoggedIn = (): boolean => {
    try {
      const stored = localStorage.getItem('snyx_user');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return !!(parsed && parsed.userId && parsed.token);
    } catch {
      return false;
    }
  };

  const [isLoggedIn, setIsLoggedIn] = useState(checkUserLoggedIn);
  const [knockIncoming, setKnockIncoming] = useState<HomeKnockIncoming | null>(null);
  const [globalSocket, setGlobalSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setIsLoggedIn(checkUserLoggedIn());
    };

    window.addEventListener('popstate', handleLocationChange);
    
    const handleAuthChange = () => {
      setIsLoggedIn(checkUserLoggedIn());
    };
    window.addEventListener('snyx_auth_change', handleAuthChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('snyx_auth_change', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      if (globalSocket) {
        globalSocket.disconnect();
        setGlobalSocket(null);
      }
      return;
    }

    const stored = localStorage.getItem('snyx_user');
    if (!stored) return;
    const user = JSON.parse(stored);

    const socket = io(SOCKET_URL, {
      auth: { token: user.token },
      transports: ['websocket']
    });

    socket.on(SocketEvents.HOME_KNOCK_INCOMING, (payload: HomeKnockIncoming) => {
      setKnockIncoming(payload);
    });

    socket.on(SocketEvents.SESSION_FORCE_LOGOUT, () => {
      localStorage.removeItem('snyx_user');
      window.dispatchEvent(new Event('snyx_auth_change'));
      navigateTo('/');
    });

    setGlobalSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [isLoggedIn]);

  const respondToKnock = (knockId: string, action: 'admit' | 'wait') => {
    if (globalSocket) {
      globalSocket.emit(SocketEvents.HOME_KNOCK_RESPONSE, { knockId, action });
    }
    setKnockIncoming(null);
  };

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setIsLoggedIn(checkUserLoggedIn());
  };

  const hasUser = isLoggedIn || checkUserLoggedIn();

  const renderPage = () => {
    // Route matching
    const roomMatch = currentPath.match(/^\/room\/([A-Za-z0-9-]+)$/);

    if (roomMatch && hasUser) {
      const roomId = roomMatch[1];
      return <RoomPage roomId={roomId} onNavigate={navigateTo} />;
    }

    // Force redirect to root if trying to join a room without an account
    if (roomMatch && !hasUser) {
      window.history.replaceState({}, '', '/');
      setTimeout(() => {
        setCurrentPath('/');
      }, 0);
      return null;
    }

    const knockMatch = currentPath.match(/^\/knock\/([a-zA-Z0-9_]{3,30})$/);
    if (knockMatch && hasUser) {
      const username = knockMatch[1];
      return <KnockWaitingPage username={username} onNavigate={navigateTo} />;
    }

    // Match username profile routes (alphanumeric and underscore, length 3 to 30)
    const profileMatch = currentPath.match(/^\/([a-zA-Z0-9_]{3,30})$/);
    if (profileMatch && hasUser) {
      const username = profileMatch[1];
      return <ProfilePage username={username} onNavigate={navigateTo} />;
    }

    return <LandingPage onNavigate={navigateTo} />;
  };

  return (
    <>
      {renderPage()}
      {knockIncoming && (
        <KnockPopup 
          knock={knockIncoming} 
          onRespond={respondToKnock} 
          onClose={() => setKnockIncoming(null)} 
        />
      )}
    </>
  );
}

export default App;
