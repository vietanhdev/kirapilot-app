import { useState } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { DatabaseProvider } from './services/database/DatabaseProvider';
import { TimerProvider } from './contexts/TimerContext';
import { AIProvider } from './contexts/AIContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Planner } from './components/planning/Planner';
import { Reports } from './components/reports/Reports';
import { Settings } from './components/settings/Settings';
import { Header } from './components/common/Header';
import { AIFloatingButton } from './components/ai/AIFloatingButton';
import TitleBar from './components/TitleBar';
import { useTheme } from './hooks/useTheme';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('week');
  const { resolvedTheme } = useTheme();

  return (
    <div
      className={`${resolvedTheme} text-foreground bg-background app-content`}
    >
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Header with Timer Integration */}
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {/* Main Content - Now scrollable */}
      <main className='app-main-content'>
        {(currentView === 'week' || currentView === 'day') && (
          <Planner viewMode={currentView as 'week' | 'day'} />
        )}

        {currentView === 'reports' && <Reports />}

        {currentView === 'settings' && <Settings />}
      </main>

      {/* AI Floating Button */}
      <AIFloatingButton />
    </div>
  );
}

function ThemedApp() {
  return (
    <HeroUIProvider>
      <AppContent />
    </HeroUIProvider>
  );
}

function App() {
  return (
    <PrivacyProvider>
      <SettingsProvider>
        <DatabaseProvider>
          <TimerProvider>
            <AIProvider>
              <ThemedApp />
            </AIProvider>
          </TimerProvider>
        </DatabaseProvider>
      </SettingsProvider>
    </PrivacyProvider>
  );
}

export default App;
