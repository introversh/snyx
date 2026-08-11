import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('snyx_user'));

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      setIsLoggedIn(!!localStorage.getItem('snyx_user'));
    };

    window.addEventListener('popstate', handleLocationChange);
    
    const handleAuthChange = () => {
      setIsLoggedIn(!!localStorage.getItem('snyx_user'));
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
    setIsLoggedIn(!!localStorage.getItem('snyx_user'));
  };

  const hasUser = isLoggedIn || !!localStorage.getItem('snyx_user');

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

  const isRoot = currentPath === '/' || currentPath === '';
  if (!isRoot && hasUser) {
    const username = currentPath.substring(1);
    return <ProfilePage username={username} onNavigate={navigateTo} />;
  }

  return <LandingPage onNavigate={navigateTo} />;
}

export default App;
