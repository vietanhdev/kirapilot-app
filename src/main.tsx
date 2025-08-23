import React from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import App from './App';
import './App.css';
import { errorTracker } from './utils/errorTracking';
import { performanceMonitor } from './utils/performanceMonitoring';
import { initializeTranslationDevTools } from './utils/translationDevTools';

// Setup global error tracking
errorTracker.setupGlobalHandlers();

// Setup performance monitoring
performanceMonitor.setupWebVitalsMonitoring();

// Setup translation development tools
initializeTranslationDevTools();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HeroUIProvider>
      <App />
    </HeroUIProvider>
  </React.StrictMode>
);
