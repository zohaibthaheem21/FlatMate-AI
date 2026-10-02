import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Copy, Check, LogOut, Home, ArrowLeftRight, Users, X, AlertTriangle, UserMinus } from 'lucide-react';

export default function TopHeader() {
  const { user, flat, members, leaveFlat, logout, showToast } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedFlat, setCopiedFlat] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exitError, setExitError] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);

  if (!user) return null;

  const copyUserId = () => {
    navigator.clipboard.writeText(user.user_code);
    setCopiedId(true);
    showToast(`Copied User ID: ${user.user_code}`, 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyFlatCode = () => {
    if (!flat) return;
    navigator.clipboard.writeText(flat.code);
    setCopiedFlat(true);
    showToast(`Copied Room Key: ${flat.code}`, 'success');
    setTimeout(() => setCopiedFlat(false), 2000);
  };

  const handleLeaveFlat = async () => {
    setLeaving(true);
    setExitError(null);
    try {
      await leaveFlat();
      setShowRoomModal(false);
    } catch (err) {
      setExitError(err.message || 'Cannot leave flat. Settle outstanding debts first.');
    } finally {
      setLeaving(false);
    }
  };

  const handleRemoveMember = async (targetUserId, targetName) => {
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the flat?`)) return;
    setRemovingUserId(targetUserId);
    try {
      await leaveFlat(targetUserId);
    } catch (err) {
      showToast(err.message || `Failed to remove ${targetName}`, 'error');
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-lg px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          
          {/* Left: User badge with Copy ID */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md ring-2 ring-emerald-500/20">
              {user.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-100 text-sm leading-none">{user.name}</span>
              </div>
              
              {/* Unique User ID Pill & Copy Button */}
              <button
                onClick={copyUserId}
                className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold hover:bg-emerald-500/20 active:scale-95 transition-all"
                title="Click to copy your Unique User ID"
              >
                <span>{user.user_code}</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-70" />}
              </button>
            </div>
          </div>

          {/* Right: Room Key & Settings/Logout */}
          <div className="flex items-center gap-2">
            {flat && (
              <div className="flex items-center gap-1">
                <button
                  onClick={copyFlatCode}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-300 text-xs font-medium active:scale-95 transition-all"
                  title="Click to copy Unique Room Key"
                >
                  <Home className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-mono font-bold text-cyan-300">{flat.code}</span>
                  {copiedFlat ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>

                <button
                  onClick={() => {
                    setExitError(null);
                    setShowRoomModal(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-colors"
                  title="Room Members & Safe Exit Settings"
                >
                  <Users className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={logout}
              className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Room Settings & Safe Exit Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-cyan-400" />
                  {flat?.name || 'Room Settings'}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Key: {flat?.code}
                </p>
              </div>
              <button
                onClick={() => setShowRoomModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banner when exit is blocked */}
            {exitError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-rose-200 font-bold mb-0.5">Exit Blocked by Safe Rule</strong>
                  <span>{exitError}</span>
                </div>
              </div>
            )}

            {/* Room Members Roster */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Room Members ({members.length})
              </span>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {members.map((m) => {
                  const isSelf = m.id === user.id;
                  const isRemoving = removingUserId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[11px]">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-200 block">
                            {m.name} {isSelf && <span className="text-[10px] text-emerald-400">(You)</span>}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{m.user_code}</span>
                        </div>
                      </div>

                      {!isSelf && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.name)}
                          disabled={isRemoving}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-rose-400 text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                          title="Remove member (requires zero balance)"
                        >
                          <UserMinus className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Safe Exit Section */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <p className="text-[11px] text-slate-400">
                🔒 Safe Exit Rule: You can only leave the flat if your net balance is exactly PKR 0.00 with all debts settled.
              </p>

              <button
                onClick={handleLeaveFlat}
                disabled={leaving}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{leaving ? 'Validating Balances...' : 'Leave Flat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
