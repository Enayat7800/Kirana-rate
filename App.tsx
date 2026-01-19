
import React, { useState, useRef, useEffect } from 'react';
import { analyzeProductImage, analyzeIngredients } from './services/geminiService';
import { AppState, AppView } from './types';
import LoadingSpinner from './components/LoadingSpinner';

// --- CONFIGURATION ---
// Inayatalibarkaat Bhai, aapke details yahan set hain:
const TELEGRAM_BOT_TOKEN = '7036939850:AAELrXWVf7f7dYFoZ023mnMIdL8AhxZ33ZU';
// Telegram Channel ID usually starts with -100 for API calls.
const TELEGRAM_CHAT_ID = '-1002721939691'; 
// ---------------------

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    view: 'PRICE_SCOUT',
    image: null,
    loading: false,
    priceResult: null,
    healthResult: null,
    error: null,
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  // Feedback states
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const [userQuantity, setUserQuantity] = useState<number>(0);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const cleanText = (text: string) => {
    if (!text) return "";
    return text.replace(/\*\*/g, '').replace(/###/g, '').trim();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setState(prev => ({ 
          ...prev, 
          image: base64, 
          priceResult: null, 
          healthResult: null, 
          error: null 
        }));
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      if (state.view === 'PRICE_SCOUT') {
        const result = await analyzeProductImage(base64);
        setState(prev => ({ ...prev, priceResult: result, loading: false }));
        setUserQuantity(result.baseWeightValue);
      } else {
        const result = await analyzeIngredients(base64);
        setState(prev => ({ ...prev, healthResult: result, loading: false }));
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  const reset = () => {
    setState(prev => ({ 
      ...prev, 
      image: null, 
      loading: false, 
      priceResult: null, 
      healthResult: null, 
      error: null 
    }));
    setUserQuantity(0);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const switchView = (newView: AppView) => {
    setState(prev => ({ 
      ...prev, 
      view: newView,
      image: null,
      loading: false,
      priceResult: null,
      healthResult: null,
      error: null
    }));
    setSidebarOpen(false);
  };

  const calculateDynamicPrice = () => {
    if (!state.priceResult) return 0;
    const unitPrice = state.priceResult.basePriceValue / state.priceResult.baseWeightValue;
    return (unitPrice * userQuantity).toFixed(2);
  };

  const handleShare = async () => {
    if (!state.priceResult && !state.healthResult) return;
    let shareText = "";
    if (state.view === 'PRICE_SCOUT' && state.priceResult) {
      const { productName, currentMarketPrice, aiAdvice } = state.priceResult;
      shareText = `Product: ${cleanText(productName)}\nRate: ${cleanText(currentMarketPrice)}\nAI Advice: ${cleanText(aiAdvice)}\n\nChecked via Kirana Scout!`;
    } else if (state.healthResult) {
      shareText = `Product: ${state.healthResult.productName}\nHealth Advice: ${state.healthResult.healthAdvice}\nShould Consume: ${state.healthResult.shouldConsume}`;
    }

    if (navigator.share) {
      try { await navigator.share({ title: 'Kirana Scout', text: shareText, url: window.location.href }); } catch (err) {}
    } else {
      try { await navigator.clipboard.writeText(shareText); alert('Details copied!'); } catch (err) {}
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(feedbackEmail.toLowerCase().trim())) {
      setFeedbackError('Kripya ek asli @gmail.com address hi dalein.');
      return;
    }
    
    if (feedbackText.trim().length < 5) {
      setFeedbackError('Feedback thoda vistar mein likhein.');
      return;
    }
    
    setFeedbackError('');
    setIsSendingFeedback(true);

    // Using HTML instead of Markdown to avoid issues with special characters in user text
    const message = `
<b>🚀 Naya Feedback Aaya Hai!</b>

<b>📧 User Gmail:</b> ${feedbackEmail}
<b>📝 Message:</b> ${feedbackText}

<b>📱 App Mode:</b> ${state.view}
<b>🕒 Time:</b> ${new Date().toLocaleString()}
    `;
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Telegram API Error:", JSON.stringify(responseData, null, 2));
        // Provide a clearer error message from the API if possible
        const apiErrorMsg = responseData.description || 'Unknown error';
        throw new Error(`Telegram error: ${apiErrorMsg}`);
      }

      setFeedbackSubmitted(true);
      setTimeout(() => {
        setFeedbackSubmitted(false);
        setFeedbackOpen(false);
        setFeedbackEmail('');
        setFeedbackText('');
      }, 3000);
    } catch (err: any) {
      console.error("Feedback Submission Failed:", err);
      setFeedbackError(`Send nahi ho paya: ${err.message}. Please check karein ki Bot aapke channel ka Admin hai.`);
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] flex flex-col items-center overflow-x-hidden transition-colors duration-300">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-72 bg-white dark:bg-[#1e293b] z-50 shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Menu</h2>
            <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <nav className="flex-1 space-y-3">
            <button 
              onClick={() => switchView('PRICE_SCOUT')}
              className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${state.view === 'PRICE_SCOUT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <span className="font-bold">Price Scout</span>
            </button>
            
            <button 
              onClick={() => switchView('HEALTH_SCOUT')}
              className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${state.view === 'HEALTH_SCOUT' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="font-bold">Health Scout</span>
            </button>

            <div className="pt-4 pb-2">
              <div className="h-px bg-gray-100 dark:bg-slate-700 w-full mb-4"></div>
            </div>

            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center justify-between p-4 rounded-2xl transition-all hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300"
            >
              <div className="flex items-center space-x-4">
                {isDarkMode ? (
                  <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg>
                ) : (
                  <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
                )}
                <span className="font-bold">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isDarkMode ? 'translate-x-4' : ''}`}></div>
              </div>
            </button>

            {/* Feedback Button */}
            <button 
              onClick={() => { setSidebarOpen(false); setFeedbackOpen(true); }}
              className="w-full flex items-center space-x-4 p-4 rounded-2xl transition-all hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              <span className="font-bold">Feedback</span>
            </button>
          </nav>

          <div className="pt-6 border-t border-gray-100 dark:border-slate-700">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center">Kirana Scout v2.1</p>
          </div>
        </div>
      </div>

      {/* Feedback Popup */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            {feedbackSubmitted ? (
              <div className="text-center py-10 space-y-6">
                 <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-3xl font-black text-gray-900 dark:text-white">Dhanyawad!</h3>
                 <p className="text-gray-600 dark:text-gray-400 font-medium">Apka feedback humein Telegram par mil gaya hai. Thank you!</p>
              </div>
            ) : (
              <form onSubmit={submitFeedback} className="space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">Feedback Dein</h3>
                  <button type="button" onClick={() => setFeedbackOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2 block">Apka Gmail (Real @gmail.com)</label>
                    <input 
                      type="text"
                      placeholder="example@gmail.com"
                      value={feedbackEmail}
                      disabled={isSendingFeedback}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2 block">Apka Sujhaav (Feedback)</label>
                    <textarea 
                      placeholder="App kaisa laga? Kuch naya chahiye?"
                      rows={4}
                      value={feedbackText}
                      disabled={isSendingFeedback}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:border-indigo-500 outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {feedbackError && (
                  <p className="text-red-500 text-sm font-bold animate-shake">{feedbackError}</p>
                )}

                <button 
                  type="submit"
                  disabled={isSendingFeedback}
                  className={`w-full py-5 ${isSendingFeedback ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center`}
                >
                  {isSendingFeedback ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : 'Send Karein'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <header className="w-full max-w-2xl px-6 py-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors duration-300">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${state.view === 'PRICE_SCOUT' ? 'bg-indigo-600' : 'bg-emerald-600'} rounded-xl flex items-center justify-center shadow-lg transition-colors duration-500`}>
            {state.view === 'PRICE_SCOUT' ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            )}
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {state.view === 'PRICE_SCOUT' ? 'Kirana Scout' : 'Health Scout'}
          </h1>
        </div>
        
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90"
        >
          <svg className="w-8 h-8 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <main className="w-full max-w-2xl px-6 pt-4 pb-20">
        {!state.image && (
          <div className="mt-12 text-center space-y-10">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white leading-tight transition-colors duration-300">
                {state.view === 'PRICE_SCOUT' 
                  ? <>Product ki photo khicho, <br/> asli rate jano.</> 
                  : <>Product ki photo khicho, <br/> asli ingredients jano.</>}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg max-w-md mx-auto font-medium transition-colors duration-300">
                {state.view === 'PRICE_SCOUT' 
                  ? "Blinkit, Zepto aur market ke sahi rate ka pata lagayein."
                  : "Isme kya pada hai aur ye kitna healthy hai, sab jano."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div 
                onClick={() => cameraInputRef.current?.click()}
                className={`group relative cursor-pointer border-2 border-dashed border-gray-200 dark:border-slate-800 ${state.view === 'PRICE_SCOUT' ? 'hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20' : 'hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20'} rounded-[2rem] p-10 transition-all duration-300 transform hover:scale-[1.02] flex flex-col items-center justify-center space-y-6 shadow-sm`}
              >
                <input type="file" className="hidden" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleImageUpload} />
                <div className={`w-20 h-20 ${state.view === 'PRICE_SCOUT' ? 'bg-indigo-50 dark:bg-indigo-900/40 group-hover:bg-indigo-600 shadow-indigo-100 dark:shadow-none' : 'bg-emerald-50 dark:bg-emerald-900/40 group-hover:bg-emerald-600 shadow-emerald-100 dark:shadow-none'} rounded-[1.5rem] flex items-center justify-center transition-all duration-300 shadow-md`}>
                  <svg className={`w-10 h-10 ${state.view === 'PRICE_SCOUT' ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'} group-hover:text-white transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-xl font-black text-gray-900 dark:text-white">Direct Camera</span>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium">Snap & Instant Scan</p>
                </div>
              </div>

              <div 
                onClick={() => galleryInputRef.current?.click()}
                className={`group relative cursor-pointer border-2 border-dashed border-gray-200 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 rounded-[2rem] p-10 transition-all duration-300 transform hover:scale-[1.02] flex flex-col items-center justify-center space-y-6 shadow-sm`}
              >
                <input type="file" className="hidden" ref={galleryInputRef} accept="image/*" onChange={handleImageUpload} />
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/40 rounded-[1.5rem] flex items-center justify-center group-hover:bg-blue-600 transition-all duration-300 shadow-md shadow-blue-100 dark:shadow-none">
                  <svg className="w-10 h-10 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-xl font-black text-gray-900 dark:text-white">Gallery Pick</span>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium">Upload Saved Photo</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.image && (
          <div className="mt-4 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden shadow-2xl shadow-gray-200 dark:shadow-none border-4 border-white dark:border-slate-800">
              <img src={state.image} alt="Product" className="w-full h-full object-cover" />
              {state.loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-20 transition-colors duration-300">
                  <LoadingSpinner />
                </div>
              )}
            </div>

            {/* PRICE SCOUT RESULT VIEW */}
            {state.view === 'PRICE_SCOUT' && state.priceResult && (
              <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700 delay-100 px-2">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2">
                       <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full transition-colors duration-300">
                         {cleanText(state.priceResult.brand)}
                       </span>
                    </div>
                    <h3 className="text-4xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight transition-colors duration-300">
                      {cleanText(state.priceResult.productName)}
                    </h3>
                  </div>
                </div>

                <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 dark:shadow-none">
                   <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="space-y-4 w-full sm:w-auto">
                         <div className="flex items-center space-x-2 opacity-80 uppercase tracking-widest font-black text-[10px]">
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 11V5h-2v6H5v2h6v6h2v-6h6v-2h-6z"/></svg>
                           <span>Quantity Calculator</span>
                         </div>
                         <div className="flex items-center space-x-4">
                            <input 
                              type="number" 
                              value={userQuantity}
                              onChange={(e) => setUserQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                              className="bg-white/20 border-2 border-white/30 rounded-2xl px-6 py-4 text-3xl font-black w-40 focus:outline-none focus:border-white transition-all"
                            />
                            <span className="text-2xl font-bold opacity-60 uppercase">{state.priceResult.baseWeightUnit}</span>
                         </div>
                         <p className="text-xs font-medium opacity-60">
                           Original: {state.priceResult.baseWeightValue}{state.priceResult.baseWeightUnit} for ₹{state.priceResult.basePriceValue}
                         </p>
                      </div>
                      <div className="h-px sm:h-20 w-full sm:w-px bg-white/20"></div>
                      <div className="text-center sm:text-right w-full sm:w-auto">
                         <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Calculated Price</span>
                         <p className="text-5xl font-black tracking-tighter">₹{calculateDynamicPrice()}</p>
                      </div>
                   </div>
                </div>

                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-100/50 dark:shadow-none transition-colors duration-300">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest">AI Ki Rai (Advice)</h4>
                  </div>
                  <p className="text-gray-800 dark:text-gray-300 text-xl font-medium leading-relaxed italic">
                    "{cleanText(state.priceResult.aiAdvice)}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {state.priceResult.officialPrice && (
                    <div className="p-8 rounded-[2rem] border-2 border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-800/20 shadow-sm transition-colors duration-300">
                      <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Retail Online Price</span>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{cleanText(state.priceResult.officialPrice)}</p>
                    </div>
                  )}
                  {state.priceResult.detectedPriceInPhoto && (
                    <div className="p-8 rounded-[2rem] border-2 border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-800/20 shadow-sm transition-colors duration-300">
                      <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Photo MRP (Visible)</span>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{cleanText(state.priceResult.detectedPriceInPhoto)}</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50/50 dark:bg-slate-800/30 rounded-[2.5rem] p-8 border border-gray-100 dark:border-slate-700 transition-colors duration-300">
                   <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-4">Market Summary</h4>
                   <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed font-medium">
                     {cleanText(state.priceResult.summary)}
                   </p>
                </div>
              </div>
            )}

            {/* HEALTH SCOUT RESULT VIEW */}
            {state.view === 'HEALTH_SCOUT' && state.healthResult && (
              <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700 delay-100 px-2">
                <div className="space-y-2">
                   <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full transition-colors duration-300">
                     {state.healthResult.brand}
                   </span>
                   <h3 className="text-4xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight transition-colors duration-300">
                     {state.healthResult.productName}
                   </h3>
                </div>

                {/* Ingredients Card */}
                <div className="bg-white dark:bg-slate-800/20 rounded-[2.5rem] p-8 border-2 border-gray-50 dark:border-slate-800 shadow-sm transition-colors duration-300">
                   <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.673.337a4 4 0 01-2.586.344l-2.457-.491a2 2 0 01-1.604-1.604l-.491-2.457a4 4 0 01.344-2.586l.337-.673a6 6 0 00.517-3.86l-.477-2.387a2 2 0 00-.547-1.022L7.428 2.572a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.673.337a4 4 0 01-2.586.344l-2.457-.491a2 2 0 01-1.604-1.604l-.491-2.457a4 4 0 01.344-2.586l.337-.673a6 6 0 00.517-3.86l-.477-2.387a2 2 0 00-.547-1.022L2.572 7.428a2 2 0 00-.547-1.022l-.477-2.387a6 6 0 00.517-3.86l.337-.673a4 4 0 012.586-.344l2.457.491a2 2 0 011.604 1.604l.491 2.457a4 4 0 01-.344 2.586l-.337.673a6 6 0 00-.517 3.86l.477 2.387a2 2 0 00.547 1.022L16.572 21.428a2 2 0 001.022.547l2.387.477a6 6 0 003.86-.517l.673-.337a4 4 0 012.586-.344l2.457.491a2 2 0 011.604-1.604l.491-2.457a4 4 0 01-.344-2.586l-.337-.673a6 6 0 00-.517-3.86l.477-2.387a2 2 0 00.547-1.022L21.428 16.572a2 2 0 00-.547 1.022z" /></svg>
                      Ingredients (Kya pada hai)
                   </h4>
                   <div className="flex flex-wrap gap-2">
                      {state.healthResult.ingredients.map((ing, i) => (
                        <span key={i} className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl border border-gray-100 dark:border-slate-700 transition-colors duration-300">
                           {ing}
                        </span>
                      ))}
                   </div>
                </div>

                {/* Composition/Amounts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {state.healthResult.composition.map((comp, i) => (
                      <div key={i} className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 flex justify-between items-center transition-colors duration-300">
                         <span className="font-black text-emerald-900 dark:text-emerald-400">{comp.item}</span>
                         <span className="font-bold text-emerald-600 dark:text-emerald-300 bg-white dark:bg-emerald-900/40 px-3 py-1 rounded-full shadow-sm">{comp.amount}</span>
                      </div>
                   ))}
                </div>

                {/* Health Verdict Card */}
                <div className="relative bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-emerald-100 dark:shadow-none transition-colors duration-300">
                   <div className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-white/20 rounded-xl">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                         </div>
                         <h4 className="font-black uppercase tracking-widest text-xs">AI Health Verdict</h4>
                      </div>
                      <div className="space-y-4">
                         <div>
                            <span className="text-[10px] font-black uppercase opacity-60">Should you eat?</span>
                            <p className="text-3xl font-black">{state.healthResult.shouldConsume}</p>
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase opacity-60">AI Advice</span>
                            <p className="text-xl font-medium italic opacity-90 leading-relaxed">"{state.healthResult.healthAdvice}"</p>
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase opacity-60">How much / How often?</span>
                            <p className="text-lg font-bold">{state.healthResult.frequencyAdvice}</p>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* Common Result Actions */}
            {(state.priceResult || state.healthResult) && (
              <div className="flex flex-col sm:flex-row gap-4 pt-6 px-2">
                <button onClick={reset} className="flex-[3] py-5 bg-gray-900 dark:bg-indigo-600 text-white rounded-[1.8rem] font-black text-xl hover:brightness-110 transition-all shadow-2xl shadow-gray-200 dark:shadow-none active:scale-95">
                  Naya Scan Karein
                </button>
                <button onClick={handleShare} className={`flex-1 py-5 ${state.view === 'PRICE_SCOUT' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'} rounded-[1.8rem] border-2 hover:brightness-95 transition-all flex items-center justify-center shadow-lg active:scale-95`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-2.684 3 3 0 000 2.684zm0 12.684a3 3 0 100-2.684 3 3 0 000 2.684z" />
                  </svg>
                </button>
              </div>
            )}

            {state.error && (
              <div className="p-10 bg-red-50 dark:bg-red-900/20 rounded-[2.5rem] border-2 border-red-100 dark:border-red-900/30 text-center animate-shake transition-colors duration-300">
                <p className="text-red-700 dark:text-red-400 font-black text-xl mb-6">{state.error}</p>
                <button onClick={reset} className="px-10 py-4 bg-red-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-red-100 dark:shadow-none">
                  Dobara Koshish Karein
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
