import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
const fallbackLoader = document.getElementById('fallback-loader');

if (!rootElement) {
  console.error("Critical Failure: Root element not found.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Smoothly remove loader once React initializes
    if (fallbackLoader) {
      setTimeout(() => {
        fallbackLoader.classList.add('hidden');
      }, 500);
    }
  } catch (error) {
    console.error("Runtime Exception during hydration:", error);
    // Force visibility of root for error display if needed
    if (fallbackLoader) fallbackLoader.style.display = 'none';
  }
}