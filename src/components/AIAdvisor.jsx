import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ShieldAlert, ArrowRightLeft, TrendingUp, Camera, MessageSquare, Send, CheckCircle2, AlertTriangle, RefreshCw, Share2, Mic, MicOff } from 'lucide-react';

export default function AIAdvisor({ setActiveTab, onPrefillExpense }) {
  const { flat, user, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agentData, setAgentData] = useState(null);

  // Command Assistant state
  const [commandText, setCommandText] = useState('');
  const [parsingCommand, setParsingCommand] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Receipt Scanner Modal state
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [scanning, setScanning] = useState(false);

  const fetchAgentInsights = async (silent = false) => {
    if (!flat?.id) return;
    if (!silent && !agentData) setLoading(true);
    try {
      const res = await fetch(`/api/ai?action=multi-agent-insights&flatId=${flat.id}`);
      const data = await res.json();
      if (data.success) {
        setAgentData(data.agents);
      } else if (!silent) {
        showToast(data.error || 'Failed to fetch AI insights', 'error');
      }
    } catch (err) {
      console.error('AI fetch error:', err);
      if (!silent) showToast('Could not load AI agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentInsights(false);
    if (!flat?.id) return;

    const timer = setInterval(() => {
      fetchAgentInsights(true);
    }, 8000);

    return () => clearInterval(timer);
  }, [flat?.id]);

  const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast('Voice input is supported in Chrome, Edge & Brave browsers', 'info');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        showToast('🎙️ Listening... Speak your expense details now!', 'info');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setCommandText(transcript);
          showToast(`Recorded: "${transcript}"`, 'success');
        }
      };

      recognition.onerror = (event) => {
        console.warn('Voice recognition error:', event.error);
        setIsListening(false);
        showToast('Voice input stopped or microphone permission denied', 'error');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Speech API start error:', err);
      setIsListening(false);
      showToast('Could not start microphone', 'error');
    }
  };

  const handleCommandSubmit = async (e) => {
    e.preventDefault();
    if (!commandText.trim()) return;

    setParsingCommand(true);
    try {
      const res = await fetch('/api/ai?action=parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandText })
      });
      const data = await res.json();
      if (data.success && data.parsed) {
        showToast('AI parsed expense successfully!', 'success');
        if (onPrefillExpense) {
          onPrefillExpense(data.parsed);
        }
        setActiveTab('add-expense');
      } else {
        showToast('Could not parse command', 'error');
      }
    } catch (err) {
      showToast('Error processing AI command', 'error');
    } finally {
      setParsingCommand(false);
    }
  };

  const handleReceiptScan = async () => {
    if (!receiptText.trim() && !receiptImage) {
      showToast('Please upload receipt image or paste bill text', 'error');
      return;
    }

    setScanning(true);
    try {
      let extractedText = receiptText;

      if (receiptImage && !extractedText.trim()) {
        try {
          showToast('Scanning image text via GenAI OCR...', 'info');
          const { recognize } = await import('tesseract.js');
          const ocrRes = await recognize(receiptImage, 'eng');
          extractedText = ocrRes.data?.text || '';
        } catch (ocrErr) {
          console.warn('Client OCR error:', ocrErr);
        }
      }

      const res = await fetch('/api/ai?action=scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: extractedText,
          imageBase64: receiptImage
        })
      });
      const data = await res.json();
      if (data.success && data.parsed) {
        showToast(`Receipt parsed: ${data.parsed.title} (PKR ${data.parsed.amount})`, 'success');
        setShowScannerModal(false);
        if (onPrefillExpense) {
          onPrefillExpense(data.parsed);
        }
        setActiveTab('add-expense');
      } else {
        throw new Error(data.error || 'Receipt parsing failed');
      }
    } catch (err) {
      showToast(err.message || 'Receipt scanning failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateWhatsAppLink = (transfer) => {
    const fromName = transfer.fromName || 'Roommate';
    const toName = transfer.toName || 'Roommate';
    const amtStr = (parseFloat(transfer.amount) || 0).toLocaleString();
    const message = `*Flatmate AI Debt Reminder* 🏠\nHi ${fromName}, according to Flatmate AI Debt Minimizer, please settle PKR ${amtStr} to ${toName} to clear flat balance.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/60 via-slate-900 to-purple-900/40 p-5 border border-indigo-500/30 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="w-32 h-32 text-indigo-400" />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Multi-Agent Engine Active
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Flatmate AI Control Center</h2>
        <p className="text-xs text-slate-300 mt-1">Autonomous multi-agent system managing flat audits, debt optimization, and budget insights.</p>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowScannerModal(true)}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Camera className="w-4 h-4" /> Scan Receipt (GenAI)
          </button>
          <button
            onClick={fetchAgentInsights}
            disabled={loading}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Natural Language Voice/Text Command Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-md">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Fast Voice & Natural Language AI Assistant
        </label>
        <form onSubmit={handleCommandSubmit} className="flex gap-2 mt-1">
          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder='e.g., "Paid 2500 PKR for groceries split with Ali"'
            className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={startVoiceRecognition}
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all border ${
              isListening
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse ring-2 ring-rose-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
            }`}
            title="Click to speak (Voice-to-Text)"
          >
            {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-indigo-400" />}
          </button>
          <button
            type="submit"
            disabled={parsingCommand || !commandText.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl flex items-center justify-center transition-all"
          >
            {parsingCommand ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* AGENT 1: EXPENSE AUDITOR AGENT */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Agent 1: Expense Auditor</h3>
              <p className="text-[10px] text-slate-400">Scans flat transactions for spikes & anomalies</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
            Live Monitoring
          </span>
        </div>

        {loading ? (
          <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> Auditor Agent Analyzing Flat Data...
          </div>
        ) : (
          <div className="space-y-2">
            {agentData?.auditor?.findings?.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  item.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : item.severity === 'info'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                }`}
              >
                {item.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-white text-[11px]">{item.title}</div>
                  <div className="text-[11px] opacity-90 mt-0.5 leading-snug">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AGENT 2: DEBT MINIMIZER AGENT */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Agent 2: Debt Minimizer</h3>
              <p className="text-[10px] text-slate-400">Graph algorithm for minimum bank transfers</p>
            </div>
          </div>
          {agentData?.debtOptimizer?.reductionRatio && (
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
              {agentData.debtOptimizer.reductionRatio}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Computing Optimal Settlement Graph...
          </div>
        ) : agentData?.debtOptimizer?.recommendedTransfers?.length === 0 ? (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-300 font-medium">
            🎉 All roommate debts are fully settled! Zero balances pending.
          </div>
        ) : (
          <div className="space-y-2">
            {agentData?.debtOptimizer?.recommendedTransfers?.map((transfer, idx) => (
              <div key={idx} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">
                    <span className="text-rose-400 font-bold">{transfer.fromName}</span> pays{' '}
                    <span className="text-emerald-400 font-bold">{transfer.toName}</span>
                  </div>
                  <div className="text-sm font-extrabold text-white mt-0.5">
                    PKR {transfer.amount.toLocaleString()}
                  </div>
                </div>
                <a
                  href={generateWhatsAppLink(transfer)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold py-1.5 px-2.5 rounded-lg text-[11px] flex items-center gap-1 transition-all"
                >
                  <Share2 className="w-3 h-3" /> Remind (BPA)
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AGENT 3: BUDGET ADVISOR AGENT */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Agent 3: Budget Advisor</h3>
              <p className="text-[10px] text-slate-400">Actionable saving tips & financial literacy</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Generating Saving Recommendations...
          </div>
        ) : (
          <div className="space-y-2">
            {agentData?.budgetAdvisor?.recommendations?.map((tip, idx) => (
              <div key={idx} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <span>{tip.icon}</span> {tip.title}
                </div>
                <div className="text-slate-300 text-[11px] mt-1 leading-snug">{tip.tip}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECEIPT SCANNER MODAL */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">GenAI Receipt & Bill OCR Scanner</h3>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Upload Bill Image or Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-2 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-slate-950"
                />
              </div>

              {receiptImage && (
                <div className="relative rounded-xl overflow-hidden max-h-36 border border-slate-800">
                  <img src={receiptImage} alt="Receipt preview" className="w-full object-cover" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Or Paste Receipt / Bill Text</label>
                <textarea
                  rows="4"
                  value={receiptText}
                  onChange={(e) => setReceiptText(e.target.value)}
                  placeholder="e.g. K-Electric Bill Account #123 Total Payable: PKR 14500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowScannerModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReceiptScan}
                disabled={scanning}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {scanning ? 'Scanning...' : 'Extract & Fill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
