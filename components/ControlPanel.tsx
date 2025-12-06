import React from 'react';
import { ConnectionStatus } from '../types';

interface ControlPanelProps {
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  error: string | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ status, onConnect, onDisconnect, error }) => {
  const isConnected = status === ConnectionStatus.CONNECTED;
  const isConnecting = status === ConnectionStatus.CONNECTING;

  return (
    <div className="flex flex-col items-center gap-8 z-20 w-full animate-fade-in" style={{animationDelay: '0.2s'}}>
      
      {/* Main Action Button */}
      <div className="relative group">
        <div className={`absolute -inset-1 rounded-full blur-md opacity-40 transition duration-500 ${isConnected ? 'bg-red-500' : 'bg-cyan-500 group-hover:opacity-80'}`}></div>
        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting}
          className={`relative px-12 py-5 rounded-full flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-2xl ${
            isConnected 
              ? 'bg-slate-900 text-red-400 border border-red-500/30 hover:bg-slate-800' 
              : 'bg-white text-black border border-white hover:bg-cyan-50'
          }`}
        >
          {isConnected ? (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
          <span className="text-lg font-bold font-display tracking-wider">
            {isConnecting ? 'CONNECTING...' : isConnected ? 'END SESSION' : 'ACTIVATE MIROVA'}
          </span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg text-center backdrop-blur-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Footer Info - Clean and Minimal */}
      <div className="text-center space-y-1 opacity-40 hover:opacity-100 transition-opacity duration-500">
        <p className="text-[10px] tracking-[0.3em] font-medium text-white uppercase">Saint John's School Talent Fest</p>
        <p className="text-[10px] text-cyan-400 tracking-widest">Kasimkota • Class 7th A</p>
      </div>
    </div>
  );
};

export default ControlPanel;