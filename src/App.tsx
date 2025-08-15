import { useState } from "react";
import { BarChart3, Settings, CheckCircle } from "lucide-react";
import { DatabaseProvider } from "./services/database/DatabaseProvider";
import { PlanningScreen } from "./components/planning/PlanningScreen";
import TitleBar from "./components/TitleBar";
import "./App.css";

function AppContent() {
  const [currentView, setCurrentView] = useState('week');

  return (
    <div className="dark min-h-screen bg-dark-gradient">
      {/* Custom Title Bar */}
      <TitleBar />
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700/30 glass-effect">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-emerald rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-100">KiraPilot</h1>
        </div>
        
        <nav className="flex items-center gap-3">
          {/* Week/Day Toggle */}
          <div className="flex rounded-md border border-gray-600 overflow-hidden">
            <button
              onClick={() => setCurrentView('week')}
              className={`px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                currentView === 'week'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setCurrentView('day')}
              className={`px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                currentView === 'day'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              }`}
            >
              Day
            </button>
          </div>

          {/* Other Navigation Buttons */}
          {[
            { icon: BarChart3, label: 'Reports', id: 'reports' },
            { icon: Settings, label: 'Settings', id: 'settings' },
          ].map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              className={`p-2 rounded-lg transition-colors ${
                currentView === id 
                  ? 'bg-primary-500/20 text-primary-400' 
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {(currentView === 'week' || currentView === 'day') && (
          <PlanningScreen viewMode={currentView as 'week' | 'day'} />
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
      <AppContent />
    </DatabaseProvider>
  );
}

export default App;
