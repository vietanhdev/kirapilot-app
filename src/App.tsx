import { useState } from 'react';
import { Settings } from 'lucide-react';
import { HeroUIProvider } from '@heroui/react';
import { DatabaseProvider } from './services/database/DatabaseProvider';
import { TimerProvider } from './contexts/TimerContext';
import { AIProvider } from './contexts/AIContext';
import { Planner } from './components/planning/Planner';
import { Reports } from './components/reports/Reports';
import { Header } from './components/common/Header';
import { AIFloatingButton } from './components/ai/AIFloatingButton';
import TitleBar from './components/TitleBar';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('week');

  return (
    <div className='dark text-foreground bg-gray-800 min-h-screen'>
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Header with Timer Integration */}
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {/* Main Content */}
      <main className='flex-1 flex flex-col'>
        {(currentView === 'week' || currentView === 'day') && (
          <Planner viewMode={currentView as 'week' | 'day'} />
        )}

        {currentView === 'reports' && <Reports />}

        {currentView === 'settings' && (
          <div className='flex-1 flex items-center justify-center'>
            <div className='text-center'>
              <Settings className='w-16 h-16 text-gray-600 mx-auto mb-4' />
              <h2 className='text-xl font-semibold text-gray-300 mb-2'>
                Settings
              </h2>
              <p className='text-gray-400'>
                Configuration options coming soon...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* AI Floating Button */}
      <AIFloatingButton />
    </div>
  );
}

function App() {
  return (
    <HeroUIProvider>
      <DatabaseProvider>
        <TimerProvider>
          <AIProvider>
            <AppContent />
          </AIProvider>
        </TimerProvider>
      </DatabaseProvider>
    </HeroUIProvider>
  );
}

export default App;
