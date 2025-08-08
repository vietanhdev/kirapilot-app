import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, Clock, Zap } from "lucide-react";
import { DatabaseProvider, DatabaseStatus } from "./services/database/DatabaseProvider";
import { DatabaseTest } from "./components/common/DatabaseTest";
import "./App.css";

function AppContent() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2 animate-fade-in">
            KiraPilot
          </h1>
          <p className="text-slate-600 dark:text-slate-300 animate-slide-up">
            Navigate your day with precision, powered by Kira AI
          </p>
        </div>

        {/* Database Status */}
        <div className="mb-8">
          <DatabaseStatus />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg animate-slide-up">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-8 h-8 text-primary-500 mr-3" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Task Management
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Organize your tasks with intelligent prioritization and dependency tracking.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg animate-slide-up">
            <div className="flex items-center mb-4">
              <Clock className="w-8 h-8 text-focus-500 mr-3" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Time Tracking
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Track your time with beautiful visualizations and productivity insights.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg animate-slide-up">
            <div className="flex items-center mb-4">
              <Zap className="w-8 h-8 text-yellow-500 mr-3" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                AI Assistant
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Let Kira help you optimize your productivity with intelligent suggestions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Database Test */}
          <DatabaseTest />

          {/* Tauri Integration Test */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Test Tauri Integration
            </h2>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                greet();
              }}
            >
              <input
                id="greet-input"
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Enter a name..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                           bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           transition-all duration-200"
              />
              <button 
                type="submit"
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium 
                           py-2 px-4 rounded-lg transition-colors duration-200
                           focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Greet
              </button>
            </form>
            {greetMsg && (
              <p className="mt-4 text-center text-slate-600 dark:text-slate-300 animate-fade-in">
                {greetMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
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
