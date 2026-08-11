import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, MessageCircle, RefreshCw, UserCheck, UserX, Users } from 'lucide-react';
import { getAvatarUrl } from '../pages/LandingPage';

interface DmInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  currentUser: any;
  apiBaseUrl: string;
}

export default function DmInboxModal({
  isOpen,
  onClose,
  onNavigate,
  currentUser,
  apiBaseUrl,
}: DmInboxModalProps) {
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');

  // DM Messages States
  const [threads, setThreads] = useState<any[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');

  // Friend Requests States
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const dmLogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && currentUser && currentUser.token) {
      fetchThreads();
      fetchIncomingRequests();
      const interval = setInterval(() => {
        fetchThreads();
        fetchIncomingRequests();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (isOpen && selectedUser && currentUser && currentUser.token) {
      fetchMessages(selectedUser.id);
      const interval = setInterval(() => fetchMessages(selectedUser.id), 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, selectedUser, currentUser]);

  // Handle open DM target trigger from localStorage
  useEffect(() => {
    if (isOpen && currentUser && currentUser.token) {
      const targetUserId = localStorage.getItem('snyx_open_dm_userId');
      if (targetUserId) {
        localStorage.removeItem('snyx_open_dm_userId');
        setSelectedUser({ id: targetUserId, displayName: 'Loading...' });
        fetchMessages(targetUserId);
        fetch(`${apiBaseUrl}/social/profile/${targetUserId}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) setSelectedUser(data);
          })
          .catch(console.error);
      }
    }
  }, [isOpen]);

  // Search debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const delay = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/social/users?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: { Authorization: `Bearer ${currentUser.token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (e) {
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, apiBaseUrl, currentUser]);

  const fetchThreads = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/social/dms`, {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setThreads(data);
      }
    } catch (e) {
    } finally {
      setThreadsLoading(false);
    }
  };

  const fetchIncomingRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/social/friend-requests`, {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data);
      }
    } catch (e) {
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/social/friend-request/accept/${senderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        setIncomingRequests((prev) => prev.filter((r) => r.sender.id !== senderId));
      }
    } catch (e) {}
  };

  const handleDeclineRequest = async (senderId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/social/friend-request/decline/${senderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        setIncomingRequests((prev) => prev.filter((r) => r.sender.id !== senderId));
      }
    } catch (e) {}
  };

  const fetchMessages = async (otherUserId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/social/dms/${otherUserId}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !input.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/social/dms/${selectedUser.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ content: input }),
      });
      if (res.ok) {
        setInput('');
        fetchMessages(selectedUser.id);
        fetchThreads();
        setTimeout(() => {
          if (dmLogRef.current) {
            dmLogRef.current.scrollTop = dmLogRef.current.scrollHeight;
          }
        }, 50);
      }
    } catch (e) {}
  };

  const formatMsgTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm select-none animate-fadeIn">
      <div className="bg-[#050505] border border-white/10 w-full max-w-4xl h-[75vh] rounded-3xl flex overflow-hidden shadow-2xl">
        {/* Left Section: Tabs, Threads & Friend Requests */}
        <div className="w-1/3 border-r border-white/10 flex flex-col bg-black">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black">
            <span className="font-extrabold text-white text-xs uppercase tracking-wider">
              Social Inbox
            </span>
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages vs Friend Requests Tabs */}
          <div className="flex border-b border-white/10 bg-white/5 p-1 gap-1">
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-2 rounded-xl text-[10px] uppercase font-bold tracking-wider transition ${
                activeTab === 'messages'
                  ? 'bg-white text-black font-extrabold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-2 rounded-xl text-[10px] uppercase font-bold tracking-wider transition relative ${
                activeTab === 'requests'
                  ? 'bg-white text-black font-extrabold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Requests</span>
              {incomingRequests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-violet-600 text-white text-[9px] rounded-full font-black">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search bar */}
          {activeTab === 'messages' && (
            <div className="p-3 border-b border-white/10 relative">
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white px-3.5 py-2 rounded-xl outline-none text-xs focus:border-white/20 transition"
              />
              {searchLoading && (
                <RefreshCw className="w-3.5 h-3.5 text-white animate-spin absolute right-5 top-4.5" />
              )}
            </div>
          )}

          {/* Tab Content List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {activeTab === 'messages' ? (
              searchQuery ? (
                searchLoading ? (
                  <div className="flex flex-col items-center justify-center p-8 space-y-2 text-neutral-400 font-mono text-[10px]">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Searching users...</span>
                  </div>
                ) : (
                  searchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setSearchQuery('');
                        fetchMessages(u.id);
                      }}
                      className="flex items-center gap-2.5 p-2 bg-white/[0.01] hover:bg-white/5 border border-white/5 rounded-xl cursor-pointer transition"
                    >
                      <img
                        src={getAvatarUrl(u.profilePicture, u.gender)}
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                      />
                      <div className="flex-grow min-w-0">
                        <span className="block text-xs font-bold text-white truncate">
                          {u.displayName || u.username}
                        </span>
                        <span className="block text-[9px] text-neutral-500 font-bold uppercase">
                          @{u.username}
                        </span>
                      </div>
                    </div>
                  ))
                )
              ) : threadsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-2 text-neutral-400 font-mono text-[10px]">
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Loading chats...</span>
                </div>
              ) : threads.length > 0 ? (
                threads.map((thread) => {
                  const active = selectedUser && selectedUser.id === thread.user.id;
                  return (
                    <div
                      key={thread.user.id}
                      onClick={() => {
                        setSelectedUser(thread.user);
                        fetchMessages(thread.user.id);
                      }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition ${
                        active
                          ? 'bg-white/10 border border-white/20'
                          : 'bg-transparent hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <img
                        src={getAvatarUrl(thread.user.profilePicture, thread.user.gender)}
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                      />
                      <div className="flex-grow min-w-0">
                        <span className="block text-xs font-bold text-white truncate">
                          {thread.user.displayName || thread.user.username}
                        </span>
                        <span className="block text-[10px] text-neutral-400 truncate mt-0.5 font-medium">
                          {thread.lastMessage}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 p-4">
                  <MessageSquare className="w-6 h-6 text-neutral-600 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    No Conversations
                  </span>
                </div>
              )
            ) : (
              /* Friend Requests List */
              requestsLoading && incomingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-2 text-neutral-400 font-mono text-[10px]">
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Loading requests...</span>
                </div>
              ) : incomingRequests.length > 0 ? (
                incomingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="p-3 bg-white/[0.02] border border-white/10 rounded-2xl space-y-2.5"
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer"
                      onClick={() => {
                        onClose();
                        onNavigate(`/${req.sender.username}`);
                      }}
                    >
                      <img
                        src={getAvatarUrl(req.sender.profilePicture, req.sender.gender)}
                        className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-extrabold text-white truncate leading-none">
                          {req.sender.displayName || req.sender.username}
                        </span>
                        <span className="block text-[9px] text-neutral-500 font-bold uppercase mt-1">
                          @{req.sender.username}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.sender.id)}
                        className="flex-1 py-1.5 bg-white hover:bg-neutral-200 text-black text-[10px] font-black uppercase rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.sender.id)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold uppercase rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 p-6">
                  <Users className="w-6 h-6 text-neutral-600 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    No Pending Requests
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Section: Conversation Feed */}
        <div className="w-2/3 flex flex-col justify-between bg-black">
          {selectedUser ? (
            <>
              <div className="p-4 border-b border-white/10 bg-black flex justify-between items-center">
                <div
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => {
                    onClose();
                    onNavigate(`/${selectedUser.username}`);
                  }}
                >
                  <img
                    src={getAvatarUrl(selectedUser.profilePicture, selectedUser.gender)}
                    className="w-8 h-8 rounded-full object-cover border border-white/10"
                  />
                  <div>
                    <span className="block text-xs font-extrabold text-white leading-none">
                      {selectedUser.displayName || selectedUser.username}
                    </span>
                    <span className="block text-[9px] text-neutral-500 font-bold uppercase mt-0.5">
                      View Profile Page
                    </span>
                  </div>
                </div>
              </div>

              <div ref={dmLogRef} className="flex-grow overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                {messagesLoading && messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-2 font-mono text-[10px]">
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>Loading conversation...</span>
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const isOwn = msg.senderId === currentUser.userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`px-3.5 py-2.5 text-xs leading-relaxed max-w-[70%] border rounded-2xl ${
                            isOwn
                              ? 'bg-white text-black border-white rounded-tr-none font-medium'
                              : 'bg-white/5 border border-white/10 text-slate-100 rounded-tl-none font-medium'
                          }`}
                        >
                          <p className="break-words">{msg.content}</p>
                          <span
                            className={`block text-[8px] text-right mt-1 font-mono leading-none ${
                              isOwn ? 'text-neutral-700' : 'text-neutral-500'
                            }`}
                          >
                            {formatMsgTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-600 py-16">
                    <MessageCircle className="w-7 h-7 text-neutral-700 mb-2 stroke-[1.5]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Start Chatting
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-white/10 flex gap-2 shrink-0 bg-black">
                <input
                  type="text"
                  placeholder="Send private message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-grow bg-white/5 border border-white/10 focus:border-white/20 text-white px-4 py-2.5 rounded-2xl outline-none text-xs focus:bg-white/10 transition"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-white hover:bg-neutral-200 active:scale-95 text-black rounded-2xl text-xs font-bold transition shadow-md shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-6">
              <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center text-white mb-4">
                <MessageSquare className="w-8 h-8 text-neutral-400 stroke-[1.5]" />
              </div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">
                Your Messages
              </h3>
              <p className="text-[10px] text-neutral-500 mt-1 max-w-[210px] leading-relaxed">
                Select a conversation thread or check pending friend requests.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
