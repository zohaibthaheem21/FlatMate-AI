import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRightLeft, DollarSign, CheckCircle2, History, Sparkles, Send, Trash2, X, AlertCircle, Check, HandCoins } from 'lucide-react';

export default function SettleUp() {
  const { user, flat, showToast, refreshPendingApprovalsCount } = useAuth();
  
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Settlement Form Modal State
  const [selectedTx, setSelectedTx] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  const fetchSettlementData = useCallback(async (silent = false) => {
    if (!flat?.id || !user?.id) return;
    try {
      if (!silent && balances.length === 0) setLoading(true);
      const res = await fetch(`/api/settle?flatId=${flat.id}&userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setBalances(data.balances || []);
        setTransactions(data.transactions || []);
        setPendingSettlements(data.pendingSettlements || []);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching settlement data:', err);
    } fontally: {
      setLoading(false);
    }
  }, [flat?.id, user?.id, balances.length]);

  useEffect(() => {
    fetchSettlementData(false);
    if (!flat?.id || !user?.id) return;

    const timer = setInterval(() => {
      fetchSettlementData(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchSettlementData, flat?.id, user?.id]);

  const openSettlementModal = (tx) => {
    setSelectedTx(tx);
    setCustomAmount(tx.amount.toString());
  };

  const handleSendSettlementRequest = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;

    const parsedAmount = parseFloat(customAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Enter a valid settlement amount', 'error');
      return;
    }

    const isPayer = selectedTx.payer_id === user.id;
    const targetName = isPayer ? selectedTx.payee_name : selectedTx.payer_name;

    setActionLoadingId(`${selectedTx.payer_id}-${selectedTx.payee_id}`);
    try {
      const res = await fetch('/api/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flatId: flat.id,
          payerId: selectedTx.payer_id,
          payeeId: selectedTx.payee_id,
          amount: parsedAmount,
          initiatorId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send settlement request');
      }

      showToast(`Cash payment request of PKR ${parsedAmount} sent to ${targetName}!`, 'success');
      setSelectedTx(null);
      fetchSettlementData(true);
    } catch (err) {
      showToast(err.message || 'Settlement request failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmOrDeclineCash = async (settlementId, status, payerName, amount) => {
    setActionLoadingId(settlementId);
    try {
      const res = await fetch('/api/settle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId,
          status,
          userId: user.id
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update settlement status');
      }

      showToast(
        status === 'confirmed' || status === 'approved'
          ? `Confirmed cash received (PKR ${amount}) from ${payerName}! Balance updated.`
          : `Declined cash payment from ${payerName}`,
        status === 'confirmed' || status === 'approved' ? 'success' : 'error'
      );

      setPendingSettlements(prev => prev.filter(s => s.id !== settlementId));
      fetchSettlementData(true);
      refreshPendingApprovalsCount(user.id);
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteHistory = async (settlementId) => {
    if (!window.confirm('Delete this settlement record?')) return;

    try {
      const res = await fetch('/api/settle', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete settlement');
      }

      showToast('Settlement record deleted', 'success');
      setHistory(prev => prev.filter(h => h.id !== settlementId));
      fetchSettlementData(true);
    } catch (err) {
      showToast(err.message || 'Error deleting settlement', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-md mx-auto">
      
      {/* Simple, Clean Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 flex items-center justify-center font-bold shadow-lg">
          <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight">
            Room Balances & Settle Up
          </h2>
          <p className="text-xs text-slate-400">
            Give money, take money, and clear debts with roommates
          </p>
        </div>
      </div>

      {loading && balances.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs animate-pulse">
          Updating room balances...
        </div>
      ) : (
        <>
          {/* Creditor Cash Verification Inbox Alert Box */}
          {pendingSettlements.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <HandCoins className="w-4 h-4 text-cyan-400" />
                Incoming Cash Verification Requests
              </h3>

              <div className="space-y-3">
                {pendingSettlements.map((ps) => (
                  <div
                    key={ps.id}
                    className="bg-cyan-950/60 border border-cyan-500/40 rounded-3xl p-4 shadow-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                          Cash Verification Request
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        PKR {ps.amount.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-100 leading-relaxed bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                      "<strong className="text-cyan-400">{ps.payer_name}</strong> claims they handed you <strong className="text-emerald-400 font-mono">PKR {ps.amount.toLocaleString()}</strong>. Did you receive this cash?"
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleConfirmOrDeclineCash(ps.id, 'rejected', ps.payer_name, ps.amount)}
                        disabled={actionLoadingId === ps.id}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>Decline (!)</span>
                      </button>

                      <button
                        onClick={() => handleConfirmOrDeclineCash(ps.id, 'confirmed', ps.payer_name, ps.amount)}
                        disabled={actionLoadingId === ps.id}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Confirm Received (✓)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Bilateral Debt Overview Board */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Room Debts (Who Owes Whom)
            </h3>

            {transactions.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">All Debts Cleared! 🎉</h4>
                <p className="text-xs text-slate-400">
                  You and all room members have zero outstanding debts!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, idx) => {
                  const isUserPayer = tx.payer_id === user.id;
                  const isUserPayee = tx.payee_id === user.id;

                  return (
                    <div
                      key={idx}
                      className={`bg-slate-900/90 border rounded-3xl p-5 transition-all shadow-lg space-y-3 ${
                        isUserPayer
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : isUserPayee
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          {/* Simple, natural wording without owe */}
                          {isUserPayer ? (
                            <p className="text-sm font-black text-rose-400">
                              You have to give back <span className="text-emerald-400 font-mono">PKR {tx.amount.toLocaleString()}</span> to <span className="text-slate-100">{tx.payee_name}</span>
                            </p>
                          ) : isUserPayee ? (
                            <p className="text-sm font-black text-emerald-400">
                              You have to take <span className="text-emerald-400 font-mono">PKR {tx.amount.toLocaleString()}</span> from <span className="text-slate-100">{tx.payer_name}</span>
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-slate-200">
                              <span>{tx.payer_name}</span> has to give back <span className="text-emerald-400 font-mono">PKR {tx.amount.toLocaleString()}</span> to <span>{tx.payee_name}</span>
                            </p>
                          )}

                          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                            {tx.payer_code} → {tx.payee_code}
                          </span>
                        </div>

                        <span className="text-xl font-black font-mono text-emerald-400">
                          PKR {tx.amount.toLocaleString()}
                        </span>
                      </div>

                      {/* Action Button - Only for Debtor/Payer to record cash payment */}
                      {isUserPayer && (
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            Pay back full or partial cash to roommate
                          </span>

                          <button
                            onClick={() => openSettlementModal(tx)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-emerald-500/20"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Settle Cash Payment</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Roommate Standings Summary */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              Roommate Net Standings
            </h3>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-2">
              {balances.map((b) => {
                const isMe = b.id === user.id;
                const isCreditor = b.net_balance > 0.01;
                const isDebtor = b.net_balance < -0.01;

                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border ${
                      isMe ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-950/60 border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isCreditor ? 'bg-emerald-500/20 text-emerald-400' : isDebtor ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {b.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1">
                          <span>{b.name}</span>
                          {isMe && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">You</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{b.user_code}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className={`text-xs font-black block ${
                        isCreditor ? 'text-emerald-400' : isDebtor ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {isCreditor ? `+ PKR ${b.net_balance.toLocaleString()}` :
                         isDebtor ? `- PKR ${Math.abs(b.net_balance).toLocaleString()}` :
                         `Settled (0.00)`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: History Log with Delete Option */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                Confirmed Cash Payment History
              </h3>

              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-300">
                        <strong className="text-slate-100">{h.payer_name}</strong> paid{' '}
                        <strong className="text-slate-100">{h.payee_name}</strong>
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {new Date(h.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-400 font-mono block">
                          PKR {h.amount.toLocaleString()}
                        </span>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                          Confirmed ✓
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteHistory(h.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Partial or Full Payment Settlement Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-100">
                Record Cash Payment
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Sending payment request from <strong className="text-rose-400">{selectedTx.payer_name}</strong> to <strong className="text-emerald-400">{selectedTx.payee_name}</strong>.
            </p>

            <form onSubmit={handleSendSettlementRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cash Amount (Full or Partial Payment)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs font-mono">
                    PKR
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedTx.amount}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-2.5 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Current Outstanding: PKR {selectedTx.amount.toLocaleString()}</span>
                  {parseFloat(customAmount) > 0 && parseFloat(customAmount) < selectedTx.amount && (
                    <span className="text-amber-400 font-bold">
                      Remaining: PKR {(selectedTx.amount - parseFloat(customAmount)).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId !== null}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-md"
                >
                  Send Cash Confirmation Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
