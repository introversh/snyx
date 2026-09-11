import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';
import ProfilePage from './pages/ProfilePage';

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

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setIsLoggedIn(checkUserLoggedIn());
  };

  const hasUser = isLoggedIn || checkUserLoggedIn();

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
  }

  // Match username profile routes (alphanumeric and underscore, length 3 to 30)
  const profileMatch = currentPath.match(/^\/([a-zA-Z0-9_]{3,30})$/);
  if (profileMatch && hasUser) {
    const username = profileMatch[1];
    return <ProfilePage username={username} onNavigate={navigateTo} />;
  }

  return <LandingPage onNavigate={navigateTo} />;
}

export default App;
