// @ts-nocheck
import { useState, useEffect } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { DatabaseProvider } from './services/database/DatabaseProvider';
import { TimerProvider } from './contexts/TimerContext';
import { AIProvider } from './contexts/AIContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { TaskListProvider } from './contexts/TaskListContext';
import { LoggingStatusProvider } from './contexts/LoggingStatusContext';
import { ToastProvider } from './contexts/ToastContext';
import { Planner } from './components/planning/Planner';
import { Reports } from './components/reports/Reports';
import { Settings } from './components/settings/Settings';
import { LogViewerContainer } from './components/ai/LogViewerContainer';
import { KiraView } from './components/kira/KiraView';
import { PeriodicTasksView } from './components/planning/PeriodicTasksView';

import { Header } from './components/common/Header';
import { AIFloatingButton } from './components/ai/AIFloatingButton';
import { OnboardingManager } from './components/ai/OnboardingManager';
import TitleBar from './components/TitleBar';
import { useTheme } from './hooks/useTheme';
import { useWindowState } from './hooks/useWindowState';
import { initializeDebugCommands } from './utils/debugCommands';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('week');
  const [viewParams, setViewParams] = useState<Record<string, unknown>>({});
  const { resolvedTheme } = useTheme();
  const { isMaximized } = useWindowState();

  // Initialize debug commands for development
  useEffect(() => {
    initializeDebugCommands();
  }, []);

  // Listen for navigation events from child components
  useEffect(() => {
    const handleNavigateToSettings = (event: CustomEvent) => {
      const { tab } = event.detail || {};
      handleViewChange('settings', { tab });
    };

    window.addEventListener(
      'navigate-to-settings',
      handleNavigateToSettings as EventListener
    );

    return () => {
      window.removeEventListener(
        'navigate-to-settings',
        handleNavigateToSettings as EventListener
      );
    };
  }, []);

  const handleViewChange = (view: string, params?: Record<string, unknown>) => {
    setCurrentView(view);
    setViewParams(params || {});
  };

  const getCurrentPageContext = () => {
    if (currentView === 'settings') {
      return 'settings';
    }
    if (
      currentView === 'week' ||
      currentView === 'day' ||
      currentView === 'recurring'
    ) {
      return 'tasks';
    }
    if (currentView === 'logs' || currentView === 'kira') {
      return 'chat';
    }

    return 'general';
  };

  return (
    <NavigationProvider
      currentView={currentView}
      viewParams={viewParams}
      onViewChange={handleViewChange}
    >
      <OnboardingManager currentPage={getCurrentPageContext()}>
        <div
          className={`${resolvedTheme} text-foreground bg-background app-content ${
            isMaximized ? 'maximized-window' : 'rounded-lg overflow-hidden'
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

            {currentView === 'recurring' && <PeriodicTasksView />}

            {currentView === 'reports' && (
              <Reports initialTab={viewParams.tab as string} />
            )}

            {currentView === 'logs' && (
              <div className='p-4 sm:p-6'>
                <LogViewerContainer />
              </div>
            )}

            {currentView === 'kira' && <KiraView />}

            {currentView === 'settings' && (
              <Settings initialTab={viewParams.tab as string} />
            )}
          </main>

          {/* AI Floating Button - Hidden in Kira view */}
          {currentView !== 'kira' && <AIFloatingButton />}
        </div>
      </OnboardingManager>
    </NavigationProvider>
  );
}

function ThemedApp() {
  return (
    <HeroUIProvider>
      <ToastProvider position='top-right'>
        <AppContent />
      </ToastProvider>
    </HeroUIProvider>
  );
}

function App() {
  return (
    <PrivacyProvider>
      <SettingsProvider>
        <DatabaseProvider>
          <LoggingStatusProvider>
            <TaskListProvider>
              <TimerProvider>
                <AIProvider>
                  <ThemedApp />
                </AIProvider>
              </TimerProvider>
            </TaskListProvider>
          </LoggingStatusProvider>
        </DatabaseProvider>
      </SettingsProvider>
    </PrivacyProvider>
  );
}

export default App;
