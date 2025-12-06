import React from 'react';
import { useMirovaSession } from './hooks/useMirovaSession';
import Visualizer from './components/Visualizer';
import ControlPanel from './components/ControlPanel';
import { ConnectionStatus } from './types';

function App() {
  // Safety check: Ensure process is defined before accessing it to prevent white-screen crashes
  // in environments where process/env vars are not polyfilled.
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
  
  const { status, isAiSpeaking, error, connect, disconnect } = useMirovaSession(apiKey);

  const handleRestart = () => {
    disconnect();
    // Small timeout to allow state to clear before potentially auto-reconnecting if desired, 
    // but here we just reset to let user click again or we could auto-click. 
    // For now, it resets to "Ready" state.
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between overflow-hidden bg-black text-white selection:bg-cyan-500/30">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Deep space gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#000000]"></div>
        
        {/* Glowing Aurora Effects */}
        <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] transition-all duration-1000 ${isAiSpeaking ? 'opacity-40 scale-110' : 'opacity-20 scale-100'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[100px] transition-all duration-1000 ${status === ConnectionStatus.CONNECTED ? 'opacity-30' : 'opacity-10'}`}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 w-full pt-12 flex flex-col items-center animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
            <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-slate-600'}`}></div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                {status === ConnectionStatus.CONNECTED ? 'Online' : 'Standby'}
            </span>
        </div>
        <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-2xl">
          MIROVA
        </h1>
        <p className="text-cyan-400 font-medium tracking-[0.5em] text-xs mt-2 uppercase">Advanced AI Assistant</p>
      </header>

      {/* Main Content - Centered Visualizer */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-4xl px-4">
        
        <div className="w-full transition-all duration-700 transform">
            <Visualizer 
              isActive={status === ConnectionStatus.CONNECTED} 
              isSpeaking={isAiSpeaking} 
            />
        </div>

      </main>

      {/* Bottom Controls */}
      <footer className="relative z-10 w-full pb-16 px-6 flex flex-col items-center">
        <ControlPanel 
          status={status}
          onConnect={connect}
          onDisconnect={disconnect}
          error={error}
        />
        
        <div className="mt-8 text-slate-700 text-[10px] font-medium tracking-wider uppercase">
          Developed by G. Vikas
        </div>
      </footer>

      {/* Floating Restart / Plus Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button 
          onClick={handleRestart}
          className="group relative flex items-center justify-center w-14 h-14 bg-white/5 backdrop-blur-md border border-white/10 rounded-full shadow-2xl hover:bg-white/10 transition-all duration-300 hover:scale-110 active:scale-95"
          title="New Session"
        >
           <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-lg group-hover:rotate-90 transition-transform duration-500">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

    </div>
  );
}

export default App;