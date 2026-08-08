import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Declare YT namespace on window for TypeScript
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  loadVideo: (videoId: string) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  getDuration: () => number;
}

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  volume: number; // 0 to 100
  onStateChange?: (event: { data: number }) => void;
  onReady?: () => void;
  onTimeUpdate?: (seconds: number) => void;
}

let apiLoaded = false;
let apiLoadingPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded) return Promise.resolve();
  if (apiLoadingPromise) return apiLoadingPromise;

  apiLoadingPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      apiLoaded = true;
      resolve();
      return;
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback();
      apiLoaded = true;
      resolve();
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  });

  return apiLoadingPromise;
}

const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>((
  { videoId, isPlaying, volume, onStateChange, onReady, onTimeUpdate },
  ref
) => {
  const containerId = useRef(`yt-player-${Math.random().toString(36).substring(2, 9)}`);
  const playerRef = useRef<any>(null);
  const timeIntervalRef = useRef<number | null>(null);

  // Sync callbacks to mutable refs to prevent stale closure issues in persistent handlers
  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  onReadyRef.current = onReady;
  onStateChangeRef.current = onStateChange;
  onTimeUpdateRef.current = onTimeUpdate;

  // Initialize YT Player once on mount
  useEffect(() => {
    let active = true;
    let player: any = null;

    loadYouTubeAPI().then(() => {
      if (!active) return;

      player = new window.YT.Player(containerId.current, {
        height: '100%',
        width: '100%',
        videoId: videoId || undefined,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 0, // Disable native player controls to use custom UI overlay
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            if (!active) return;
            playerRef.current = player;
            player.setVolume(volume);
            if (isPlaying) {
              player.playVideo();
            } else {
              player.pauseVideo();
            }
            if (onReadyRef.current) onReadyRef.current();
          },
          onStateChange: (event: any) => {
            if (!active) return;
            if (onStateChangeRef.current) onStateChangeRef.current(event);
          },
        },
      });
    });

    // Start time tracking loop
    timeIntervalRef.current = window.setInterval(() => {
      if (
        playerRef.current &&
        typeof playerRef.current.getCurrentTime === 'function' &&
        playerRef.current.getPlayerState() === 1 // YT.PlayerState.PLAYING
      ) {
        if (onTimeUpdateRef.current) {
          onTimeUpdateRef.current(playerRef.current.getCurrentTime());
        }
      }
    }, 500);

    return () => {
      active = false;
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
      if (player) {
        try {
          player.destroy();
        } catch (e) {
          console.error('Error destroying player:', e);
        }
      }
      playerRef.current = null;
    };
  }, []); // Run once on mount!

  // Handle VideoId changes dynamically without destroying the player
  useEffect(() => {
    const player = playerRef.current;
    if (player && videoId && typeof player.loadVideoById === 'function') {
      player.loadVideoById({ videoId });
      if (isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }
  }, [videoId]);

  // Handle Play/Pause changes without re-initializing the IFrame
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.getPlayerState === 'function') {
      const state = player.getPlayerState();
      if (isPlaying && state !== 1) {
        player.playVideo();
      } else if (!isPlaying && state !== 2 && state !== 5) {
        player.pauseVideo();
      }
    }
  }, [isPlaying]);

  // Handle volume changes
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.setVolume === 'function') {
      player.setVolume(volume);
    }
  }, [volume]);

  // Expose Imperative Controls
  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
    },
    pause: () => {
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
      }
    },
    seek: (seconds: number) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(seconds, true);
      }
    },
    loadVideo: (id: string) => {
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById({ videoId: id });
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        return playerRef.current.getCurrentTime();
      }
      return 0;
    },
    getPlayerState: () => {
      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
        return playerRef.current.getPlayerState();
      }
      return -1; // Unstarted/None
    },
    setVolume: (vol: number) => {
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(vol);
      }
    },
    getDuration: () => {
      if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
        return playerRef.current.getDuration();
      }
      return 0;
    },
  }));

  return (
    <div className="relative w-full h-full bg-black aspect-video rounded-xl overflow-hidden shadow-2xl border border-slate-900">
      <div id={containerId.current} className="w-full h-full pointer-events-none" />
      {/* Overlay to disable direct YouTube interactions and ensure custom controls are used */}
      <div className="absolute inset-0 bg-transparent" />
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;
