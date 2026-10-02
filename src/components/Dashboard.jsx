import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, DollarSign, Receipt, Copy, Check, Clock, Plus, Sparkles, TrendingUp, TrendingDown, Trash2, ChevronRight } from 'lucide-react';

const CATEGORIES = ['All', 'Meal', 'Tea', 'Groceries', 'Rent', 'Utilities', 'Other'];

export default function Dashboard({ setActiveTab }) {
  const { user, flat, members, showToast, refreshPendingApprovalsCount } = useAuth();
  
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!flat?.id) return;
    try {
      if (!silent && expenses.length === 0) setLoading(true);
      const [expRes, settleRes] = await Promise.all([
        fetch(`/api/expenses?flatId=${flat.id}`),
        fetch(`/api/settle?flatId=${flat.id}`),
      ]);

      const expData = await expRes.json();
      const settleData = await settleRes.json();

      if (expData.success) {
        setExpenses(expData.expenses || []);
      }
      if (settleData.success) {
        setBalances(settleData.balances || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [flat?.id, expenses.length]);

  useEffect(() => {
    fetchData(false);
    if (!flat?.id) return;

    const timer = setInterval(() => {
      fetchData(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchData, flat?.id]);

  const handleDeleteExpense = async (expenseId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    setDeletingId(expenseId);
    try {
      const res = await fetch(`/api/expenses?expenseId=${expenseId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete expense');
      }

      showToast(`Deleted "${title}" successfully`, 'success');
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      fetchData(true);
      refreshPendingApprovalsCount(user.id);
    } catch (err) {
      showToast(err.message || 'Error deleting expense', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const totalFlatSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const myBalanceObj = balances.find(b => b.id === user.id);
  const myNetBalance = myBalanceObj ? myBalanceObj.net_balance : 0;

  const copyRoomCode = () => {
    if (!flat) return;
    navigator.clipboard.writeText(flat.code);
    setCopiedCode(true);
    showToast(`Copied Room Key: ${flat.code}`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredExpenses = selectedCategory === 'All'
    ? expenses
    : expenses.filter(e => e.category === selectedCategory);

  return (
    <div className="space-y-5 pb-24 max-w-md mx-auto">
      
      {/* Hero Flat Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Bachelor Expense Manager
            </span>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight mt-0.5">
              {flat?.name || 'Bachelor Room'}
            </h2>
          </div>

          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono font-extrabold text-cyan-300 transition-all active:scale-95 shadow-sm"
            title="Copy Unique Room Key"
          >
            <span>{flat?.code}</span>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {/* User's Net Status Banner with Natural Wording */}
        <div className={`mt-4 p-4 rounded-2xl border backdrop-blur-md flex items-center justify-between ${
          myNetBalance > 0.01
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : myNetBalance < -0.01
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
              myNetBalance > 0.01 ? 'bg-emerald-500 text-slate-950' : myNetBalance < -0.01 ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {myNetBalance > 0.01 ? <TrendingUp className="w-5 h-5 stroke-[2.5]" /> : myNetBalance < -0.01 ? <TrendingDown className="w-5 h-5 stroke-[2.5]" /> : <DollarSign className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider block opacity-80">
                Your Flat Position Summary
              </span>
              <span className="text-xs font-bold">
                {myNetBalance > 0.01 ? 'You have to take back from flatmates in total' : myNetBalance < -0.01 ? 'You have to give back to flatmates in total' : 'All clear! Zero debt'}
              </span>
            </div>
          </div>

          <span className="text-xl font-black font-mono">
            {myNetBalance > 0.01 ? `+ PKR ${myNetBalance.toLocaleString()}` :
             myNetBalance < -0.01 ? `- PKR ${Math.abs(myNetBalance).toLocaleString()}` :
             `PKR 0`}
          </span>
        </div>

        {/* Room Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span>Total Room Spent</span>
            </div>
            <p className="text-lg font-black text-emerald-400 font-mono mt-1">
              PKR {totalFlatSpent.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Roommates</span>
            </div>
            <p className="text-lg font-black text-cyan-400 mt-1">
              {members.length} {members.length === 1 ? 'Member' : 'Members'}
            </p>
          </div>
        </div>
      </div>

      {/* Roommates Balances Roster */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            Roommates Net Standings
          </h3>
          <button
            onClick={() => setActiveTab('settle')}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
          >
            <span>Settle Up</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {balances.map((m) => {
            const isMe = m.id === user.id;
            const isCreditor = m.net_balance > 0.01;
            const isDebtor = m.net_balance < -0.01;

            return (
              <div
                key={m.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isMe
                    ? 'bg-slate-900 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                    isCreditor ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    isDebtor ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                      {m.name} {isMe && <span className="text-[9px] text-emerald-400">(You)</span>}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block truncate">
                      {m.user_code}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Net:</span>
                  <span className={`text-xs font-black font-mono ${
                    isCreditor ? 'text-emerald-400' : isDebtor ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    {isCreditor ? `+PKR ${m.net_balance}` : isDebtor ? `-PKR ${Math.abs(m.net_balance)}` : '0'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense History Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            Expenses Feed
          </h3>

          <button
            onClick={() => setActiveTab('add-expense')}
            className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-all flex items-center gap-1 shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs animate-pulse">
            Loading room expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center space-y-2">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No expenses logged yet</p>
            <p className="text-xs text-slate-500">
              Tap "Add Expense" to log meals, groceries, tea, or rent!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredExpenses.map((expense) => {
              const dateStr = new Date(expense.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isPaidByMe = expense.paid_by === user.id;
              const isDeleting = deletingId === expense.id;

              return (
                <div
                  key={expense.id}
                  className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 shadow-lg space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                        {expense.category === 'Meal' ? '🍲' :
                         expense.category === 'Tea' ? '☕' :
                         expense.category === 'Groceries' ? '🛒' :
                         expense.category === 'Rent' ? '🏠' :
                         expense.category === 'Utilities' ? '⚡' : '💳'}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-100 leading-snug">
                          {expense.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                          <span>Paid by <strong className={isPaidByMe ? 'text-emerald-400 font-bold' : 'text-slate-300 font-semibold'}>{isPaidByMe ? 'You' : expense.payer_name}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {dateStr}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-emerald-400 font-mono block">
                          PKR {expense.amount.toLocaleString()}
                        </span>
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {expense.splits ? expense.splits.length : 0} split
                        </span>
                      </div>

                      {/* Delete Button (Only creator of the expense can see & delete it) */}
                      {isPaidByMe && (
                        <button
                          onClick={() => handleDeleteExpense(expense.id, expense.title)}
                          disabled={isDeleting}
                          className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-rose-500/10 hover:border-rose-500/40 text-slate-500 hover:text-rose-400 transition-all active:scale-95 disabled:opacity-50"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Badges for each split member */}
                  {expense.splits && (
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-semibold mr-1">Approvals:</span>
                      {expense.splits.map((s) => (
                        <span
                          key={s.id}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                            s.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : s.status === 'disputed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {s.user_name}: {s.status === 'approved' ? '✓ Approved' : s.status === 'disputed' ? '! Disputed' : '⏳ Pending'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
