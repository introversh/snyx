import { useEffect } from 'react';
import { HomeKnockIncoming } from '@youtube-together/shared';
import { playNotificationChime } from '../utils/sound';
import { getAvatarUrl } from '../pages/LandingPage';
import { Check, X } from 'lucide-react';

interface KnockPopupProps {
  knock: HomeKnockIncoming;
  onRespond: (knockId: string, action: 'admit' | 'wait') => void;
  onClose: () => void;
}

export default function KnockPopup({ knock, onRespond, onClose }: KnockPopupProps) {
  useEffect(() => {
    playNotificationChime();
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-fadeIn">
      <div className="bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-sm w-full">
        <div className="flex items-center gap-3">
          <img 
            src={getAvatarUrl(knock.knocker.profilePicture)} 
            alt="Avatar" 
            className="w-10 h-10 rounded-full border border-white/20 object-cover" 
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white leading-tight">
              {knock.knocker.displayName || knock.knocker.username}
            </span>
            <span className="text-xs text-neutral-400">is at your door</span>
          </div>
        </div>
        
        <div className="flex gap-2 mt-1">
          <button 
            onClick={() => {
              onRespond(knock.knockId, 'admit');
              onClose();
            }}
            className="flex-1 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Let In
          </button>
          <button 
            onClick={() => {
              onRespond(knock.knockId, 'wait');
              onClose();
            }}
            className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Keep Waiting
          </button>
        </div>
      </div>
    </div>
  );
}
