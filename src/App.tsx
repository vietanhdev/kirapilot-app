// @ts-nocheck
import { useState } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { DatabaseProvider } from './services/database/DatabaseProvider';
import { TimerProvider } from './contexts/TimerContext';
import { AIProvider } from './contexts/AIContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { TaskListProvider } from './contexts/TaskListContext';
import { Planner } from './components/planning/Planner';
import { Reports } from './components/reports/Reports';
import { Settings } from './components/settings/Settings';
import { Header } from './components/common/Header';
import { AIFloatingButton } from './components/ai/AIFloatingButton';
import TitleBar from './components/TitleBar';
import { useTheme } from './hooks/useTheme';
import { useWindowState } from './hooks/useWindowState';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('week');
  const [viewParams, setViewParams] = useState<Record<string, unknown>>({});
  const { resolvedTheme } = useTheme();
  const { isMaximized } = useWindowState();

  const handleViewChange = (view: string, params?: Record<string, unknown>) => {
    setCurrentView(view);
    setViewParams(params || {});
  };

  // Force TypeScript to recognize usage
  console.log('Debug:', { viewParams, handleViewChange });

  return (
    <NavigationProvider
      currentView={currentView}
      viewParams={viewParams}
      onViewChange={handleViewChange}
    >
      <div
        className={`${resolvedTheme} text-foreground bg-background app-content ${
          isMaximized ? '' : 'rounded-xl overflow-hidden'
        }`}
      >
        {/* Custom Title Bar */}
        <TitleBar />

        {/* Header with Timer Integration */}
        <Header currentView={currentView} onViewChange={handleViewChange} />

        {/* Main Content - Now scrollable */}
        <main className='app-main-content'>
          {(currentView === 'week' || currentView === 'day') && (
            <Planner viewMode={currentView as 'week' | 'day'} />
          )}

          {currentView === 'reports' && <Reports />}

          {currentView === 'settings' && (
            <Settings initialTab={viewParams.tab as string} />
          )}
        </main>

        {/* AI Floating Button */}
        <AIFloatingButton />
      </div>
    </NavigationProvider>
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
          <TaskListProvider>
            <TimerProvider>
              <AIProvider>
                <ThemedApp />
              </AIProvider>
            </TimerProvider>
          </TaskListProvider>
        </DatabaseProvider>
      </SettingsProvider>
    </PrivacyProvider>
  );
}

export default App;
