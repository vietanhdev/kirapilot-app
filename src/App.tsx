import { useState } from "react";
import { BarChart3, Settings } from "lucide-react";
import { DatabaseProvider } from "./services/database/DatabaseProvider";
import { TimerProvider } from "./contexts/TimerContext";
import { Planner } from "./components/planning/Planner";
import { Header } from "./components/common/Header";
import TitleBar from "./components/TitleBar";
import "./App.css";

function AppContent() {
  const [currentView, setCurrentView] = useState('week');

  return (
    <div className="dark min-h-screen bg-gradient-to-br from-gray-800 to-gray-750">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Header with Timer Integration */}
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {(currentView === 'week' || currentView === 'day') && (
          <Planner viewMode={currentView as 'week' | 'day'} />
        )}

        {currentView === 'reports' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-300 mb-2">Reports</h2>
              <p className="text-gray-400">Analytics and insights coming soon...</p>
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-300 mb-2">Settings</h2>
              <p className="text-gray-400">Configuration options coming soon...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <DatabaseProvider>
      <TimerProvider>
        <AppContent />
      </TimerProvider>
    </DatabaseProvider>
  );
}

export default App;
