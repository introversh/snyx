import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Route matching
  const roomMatch = currentPath.match(/^\/room\/([A-Za-z0-9-]+)$/);

  if (roomMatch) {
    const roomId = roomMatch[1];
    return <RoomPage roomId={roomId} onNavigate={navigateTo} />;
  }

  return <LandingPage onNavigate={navigateTo} />;
}

export default App;
