import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import TopHeader from './components/TopHeader';
import Navigation from './components/Navigation';
import AuthModal from './components/AuthModal';
import FlatSetup from './components/FlatSetup';
import Dashboard from './components/Dashboard';
import AddExpense from './components/AddExpense';
import Approvals from './components/Approvals';
import SettleUp from './components/SettleUp';
import AIAdvisor from './components/AIAdvisor';

function MainApp() {
  const { user, flat, toastMessage } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prefilledExpense, setPrefilledExpense] = useState(null);

  // 1. Not Logged In -> Show Auth Screen
  if (!user) {
    return <AuthModal />;
  }

  // 2. Logged In but No Flat -> Show Flat Setup Screen
  if (!flat && !user.flat_id) {
    return <FlatSetup />;
  }

  // 3. Logged In & In Flat -> Show Main App Layout with Bottom Nav
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Top Header with Unique User ID & Flat Code */}
      <TopHeader />

      {/* Main Active Tab Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 pt-5">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'ai-advisor' && (
          <AIAdvisor setActiveTab={setActiveTab} onPrefillExpense={setPrefilledExpense} />
        )}
        {activeTab === 'add-expense' && (
          <AddExpense
            setActiveTab={setActiveTab}
            prefilledExpense={prefilledExpense}
            setPrefilledExpense={setPrefilledExpense}
          />
        )}
        {activeTab === 'approvals' && <Approvals />}
        {activeTab === 'settle' && <SettleUp />}
      </main>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold border backdrop-blur-md transition-all animate-bounce flex items-center gap-2 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-500/90 text-slate-950 border-emerald-400'
            : toastMessage.type === 'error'
            ? 'bg-rose-500/90 text-white border-rose-400'
            : 'bg-slate-800/90 text-slate-100 border-slate-700'
        }`}>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
