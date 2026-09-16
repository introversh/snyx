import { MissedKnock } from '@youtube-together/shared';
import { getAvatarUrl } from '../pages/LandingPage';
import { X, DoorOpen } from 'lucide-react';

interface MissedKnocksModalProps {
  knocks: MissedKnock[];
  onDismiss: () => void;
}

export default function MissedKnocksModal({ knocks, onDismiss }: MissedKnocksModalProps) {
  const getRelativeTime = (timestamp: number) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = timestamp - Date.now();
    const diffMinutes = Math.round(diff / 60000);
    const diffHours = Math.round(diff / 3600000);
    const diffDays = Math.round(diff / 86400000);

    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
  };

  if (!knocks || knocks.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#050505] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-white" />
            <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">
              While you were away...
            </h3>
          </div>
          <button 
            onClick={onDismiss}
            className="p-1.5 text-neutral-400 hover:text-white bg-white/5 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {knocks.map(knock => (
            <div key={knock.knockId} className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
              <img 
                src={getAvatarUrl(knock.knocker.profilePicture)} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full border border-white/10 object-cover" 
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">
                  {knock.knocker.displayName || knock.knocker.username}
                </span>
                <span className="text-[10px] text-neutral-400">visited your home</span>
                <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
                  {getRelativeTime(knock.knockedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={onDismiss}
          className="w-full py-2.5 bg-white text-black text-xs font-extrabold rounded-xl hover:bg-neutral-200 transition"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
