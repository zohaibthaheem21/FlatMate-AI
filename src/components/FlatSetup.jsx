import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Home, Users, PlusCircle, LogIn, Key, Phone, Lock, Copy, Check, Sparkles, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';

export default function FlatSetup() {
  const { user, createFlat, joinFlat, logout, loading, showToast } = useAuth();
  const [tab, setTab] = useState('join'); // 'join' | 'create'
  
  // Create Room State
  const [roomName, setRoomName] = useState('');
  const [roomPhone, setRoomPhone] = useState('');
  const [roomPassword, setRoomPassword] = useState('');

  // Join Room State
  const [joinMode, setJoinMode] = useState('key'); // 'key' | 'credentials'
  const [roomKey, setRoomKey] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  // Feedback State
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!roomName.trim()) {
      setErrorMessage('Please enter a room or flat name.');
      return;
    }

    try {
      await createFlat({
        flatName: roomName.trim(),
        phone: roomPhone.trim(),
        password: roomPassword.trim(),
      });
      setSuccessMessage('Room created successfully! Redirecting...');
    } catch (err) {
      const msg = err.message || 'Failed to create room. Please try again.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (joinMode === 'key') {
      if (!roomKey.trim()) {
        setErrorMessage('Please enter a Unique Room Key (e.g. ROOM-5501).');
        return;
      }
      try {
        await joinFlat(roomKey.trim());
        setSuccessMessage('Joined room successfully!');
      } catch (err) {
        const msg = err.message || 'Failed to join room. Please check the key.';
        setErrorMessage(msg);
        showToast(msg, 'error');
      }
    } else {
      if (!joinPhone.trim() || !joinPassword.trim()) {
        setErrorMessage('Please enter both Room Phone Number & Room Password.');
        return;
      }
      try {
        await joinFlat({
          phone: joinPhone.trim(),
          password: joinPassword.trim(),
        });
        setSuccessMessage('Joined room successfully!');
      } catch (err) {
        const msg = err.message || 'Failed to join room. Incorrect Phone or Password.';
        setErrorMessage(msg);
        showToast(msg, 'error');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        
        {/* Decorative Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Welcome Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 font-bold mb-3 shadow-md">
            <CheckCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            Account Ready, {user?.name}! 🎉
          </h2>
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wide">Your Unique User Code</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-black text-emerald-400 tracking-wider">{user?.user_code}</span>
              <button
                type="button"
                onClick={() => {
                  if (user?.user_code) {
                    navigator.clipboard.writeText(user.user_code);
                    showToast('User Code copied to clipboard!', 'success');
                  }
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition-all text-xs flex items-center gap-1 font-bold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-0.5">
              Share this code with roommates so they can add you to expenses!
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 underline"
            >
              Log Out / Register New Account
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950/70 p-1 rounded-2xl border border-slate-800/80 mb-6">
          <button
            type="button"
            onClick={() => {
              setTab('join');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              tab === 'join'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Join Room
          </button>
          
          <button
            type="button"
            onClick={() => {
              setTab('create');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              tab === 'create'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Room
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert Box */}
        {successMessage && (
          <div className="mb-4 p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{successMessage}</span>
          </div>
        )}

        {tab === 'join' ? (
          /* Join Room Form */
          <div className="space-y-4">
            
            {/* Join Mode Toggle */}
            <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-400 pb-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="joinMode"
                  checked={joinMode === 'key'}
                  onChange={() => {
                    setJoinMode('key');
                    setErrorMessage('');
                  }}
                  className="accent-cyan-500"
                />
                <span className={joinMode === 'key' ? 'text-cyan-400 font-bold' : ''}>Via Unique Room Key</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="joinMode"
                  checked={joinMode === 'credentials'}
                  onChange={() => {
                    setJoinMode('credentials');
                    setErrorMessage('');
                  }}
                  className="accent-cyan-500"
                />
                <span className={joinMode === 'credentials' ? 'text-cyan-400 font-bold' : ''}>Via Phone & Password</span>
              </label>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              {joinMode === 'key' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Unique Room Key
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. ROOM-5501 or Roommate ID"
                      value={roomKey}
                      onChange={(e) => {
                        setRoomKey(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 font-mono uppercase placeholder:normal-case placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    💡 Ask your room creator for the <span className="text-cyan-400 font-mono">ROOM-XXXX</span> key!
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Room Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        placeholder="e.g. 03001234567"
                        value={joinPhone}
                        onChange={(e) => {
                          setJoinPhone(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Room Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        placeholder="Enter room password"
                        value={joinPassword}
                        onChange={(e) => {
                          setJoinPassword(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {loading ? (
                  <span>Entering Room...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Enter Room</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Create Room Form */
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Room Name
              </label>
              <div className="relative">
                <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. Bachelor Villa 402"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Room Contact Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  placeholder="e.g. 03009876543"
                  value={roomPhone}
                  onChange={(e) => setRoomPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Room Secret Password (Optional)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="Password for roommates to join"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/50 text-[11px] text-slate-400 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                System will generate a <strong className="text-cyan-400 font-mono">Unique Room Key</strong> (e.g. ROOM-5501) to share with roommates!
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Creating Room...</span>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Room & Get Key</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
