import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, Check, AlertCircle, Clock, Sparkles, HandCoins } from 'lucide-react';

export default function Approvals() {
  const { user, showToast, refreshPendingApprovalsCount } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchPendingApprovals = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/approvals?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setApprovals(data.approvals || []);
        refreshPendingApprovalsCount(user.id);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshPendingApprovalsCount]);

  useEffect(() => {
    fetchPendingApprovals();
    if (!user?.id) return;

    const timer = setInterval(() => {
      fetchPendingApprovals();
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchPendingApprovals, user?.id]);

  const handleAction = async (item, status) => {
    const isSettlement = item.approval_type === 'settlement';
    const itemId = isSettlement ? item.settlement_id : item.split_id;

    setActionLoadingId(itemId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.approval_type,
          status,
          userId: user.id,
          ...(isSettlement ? { settlementId: itemId } : { splitId: itemId }),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update approval status');
      }

      if (isSettlement) {
        showToast(
          status === 'approved' || status === 'confirmed'
            ? `Confirmed cash payment of PKR ${item.share_amount} from ${item.paid_by_name}! Debt updated.`
            : `Declined cash payment claim from ${item.paid_by_name}`,
          status === 'approved' || status === 'confirmed' ? 'success' : 'error'
        );
      } else {
        showToast(
          status === 'approved'
            ? `Approved your PKR ${item.share_amount} share for "${item.title}"`
            : `Flagged dispute on "${item.title}"`,
          status === 'approved' ? 'success' : 'error'
        );
      }

      setApprovals(prev => prev.filter(a => (isSettlement ? a.settlement_id : a.split_id) !== itemId));
      refreshPendingApprovalsCount(user.id);
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-5 pb-24 max-w-md mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-slate-950 flex items-center justify-center font-bold shadow-lg">
          <CheckSquare className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight">
            Pending Approvals
          </h2>
          <p className="text-xs text-slate-400">
            Confirm room expenses & cash settlements
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs animate-pulse">
          Loading pending requests...
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">All Caught Up! 🎉</h3>
            <p className="text-xs text-slate-400 mt-1">
              No pending expense shares or settlement requests waiting for your confirmation.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((item) => {
            const isSettlement = item.approval_type === 'settlement';
            const itemId = isSettlement ? item.settlement_id : item.split_id;
            const isProcessing = actionLoadingId === itemId;

            const dateStr = new Date(item.expense_date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={`${item.approval_type}-${itemId}`}
                className={`bg-slate-900/90 border rounded-3xl p-5 shadow-lg space-y-4 relative overflow-hidden ${
                  isSettlement ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5 ${
                      isSettlement ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {isSettlement ? '💸 Cash Settlement Verification' : item.category}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {dateStr}
                  </span>
                </div>

                {/* Main Prompt Card Text as requested */}
                <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-2">
                  {isSettlement ? (
                    <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                      "<strong className="text-cyan-400">{item.paid_by_name}</strong> claims they handed you <strong className="text-emerald-400 font-mono">PKR {item.share_amount.toLocaleString()}</strong>. Did you receive this cash?"
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                      "<strong className="text-cyan-400">{item.paid_by_name}</strong> paid <strong className="text-emerald-400 font-mono">PKR {item.total_amount.toLocaleString()}</strong> for <strong className="text-slate-100">{item.title}</strong>. Your share is <strong className="text-emerald-400 font-mono">PKR {item.share_amount.toLocaleString()}</strong>. Please confirm."
                    </p>
                  )}
                </div>

                {/* Action Button - Single Approve Button */}
                <div className="pt-1">
                  <button
                    onClick={() => handleAction(item, 'approved')}
                    disabled={isProcessing}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>{isSettlement ? 'Confirm Received (✓)' : 'Approve (✓)'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
