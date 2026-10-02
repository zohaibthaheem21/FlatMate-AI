import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Check, Users, DollarSign, Tag, CheckSquare, Square, ArrowRight } from 'lucide-react';

const CATEGORIES = [
  { id: 'Meal', label: 'Meal / Dinner', icon: '🍲' },
  { id: 'Tea', label: 'Tea & Snacks', icon: '☕' },
  { id: 'Groceries', label: 'Groceries', icon: '🛒' },
  { id: 'Rent', label: 'Flat Rent', icon: '🏠' },
  { id: 'Utilities', label: 'Utilities / Bills', icon: '⚡' },
  { id: 'Entertainment', label: 'Outing / Movie', icon: '🎬' },
  { id: 'Other', label: 'Other Expense', icon: '💳' },
];

export default function AddExpense({ setActiveTab, prefilledExpense, setPrefilledExpense }) {
  const { user, flat, members, showToast, refreshPendingApprovalsCount } = useAuth();
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Meal');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize selected members to all flatmates by default
  useEffect(() => {
    if (members && members.length > 0) {
      setSelectedUserIds(members.map(m => m.id));
    }
  }, [members]);

  // Handle AI prefill data
  useEffect(() => {
    if (prefilledExpense) {
      if (prefilledExpense.title) setTitle(prefilledExpense.title);
      if (prefilledExpense.amount !== undefined && prefilledExpense.amount !== null && prefilledExpense.amount !== '') {
        setAmount(prefilledExpense.amount.toString());
      }
      if (prefilledExpense.category) setCategory(prefilledExpense.category);
    }
  }, [prefilledExpense]);

  const toggleSelectAll = () => {
    if (selectedUserIds.length === members.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(members.map(m => m.id));
    }
  };

  const toggleUser = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const perPersonShare = selectedUserIds.length > 0 ? (parsedAmount / selectedUserIds.length).toFixed(2) : '0.00';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Please enter an expense title', 'error');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (selectedUserIds.length === 0) {
      showToast('Select at least one roommate to split with', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flatId: flat.id,
          paidBy: user.id,
          title: title.trim(),
          amount: parsedAmount,
          category,
          splitUserIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record expense');
      }

      showToast(`Added "${title}" (PKR ${parsedAmount}) successfully!`, 'success');
      refreshPendingApprovalsCount(user.id);
      setActiveTab('dashboard');
    } catch (err) {
      showToast(err.message || 'Error adding expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-20 max-w-md mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 flex items-center justify-center font-bold shadow-lg">
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight">
            Log New Expense
          </h2>
          <p className="text-xs text-slate-400">
            Split bill equally with present roommates
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Expense Description / Title
          </label>
          <input
            type="text"
            placeholder="e.g. Biryani & Drinks, Grocery, Electric Bill"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            required
          />
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Total Amount Paid (PKR)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-sm">
              PKR
            </span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-14 pr-4 py-3 text-base font-extrabold text-emerald-400 placeholder-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              required
            />
          </div>
        </div>

        {/* Category Selector Pills */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Category
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Roommate Checklist */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Split Among Roommates
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedUserIds.length} of {members.length} selected
              </p>
            </div>

            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
            >
              {selectedUserIds.length === members.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {members.map((m) => {
              const isChecked = selectedUserIds.includes(m.id);
              const isPayer = m.id === user.id;

              return (
                <div
                  key={m.id}
                  onClick={() => toggleUser(m.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-slate-800/90 border-emerald-500/50 text-slate-100'
                      : 'bg-slate-950/60 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      isChecked
                        ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                        : 'border-slate-700 bg-slate-900'
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div>
                      <span className="text-xs font-bold block leading-tight">
                        {m.name} {isPayer && <span className="text-[10px] text-emerald-400 font-normal">(You - Payer)</span>}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {m.user_code}
                      </span>
                    </div>
                  </div>

                  {isChecked && (
                    <span className="text-xs font-extrabold text-emerald-400 font-mono">
                      PKR {perPersonShare}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Preview Summary */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-300 block">
              Share Per Selected Roommate
            </span>
            <span className="text-xs text-slate-400">
              Payer share is auto-approved, rest sent for approval
            </span>
          </div>
          <span className="text-lg font-black text-emerald-400 font-mono">
            PKR {perPersonShare}
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {loading ? (
            <span>Adding Expense...</span>
          ) : (
            <>
              <span>Submit & Request Approvals</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

      </form>
    </div>
  );
}
