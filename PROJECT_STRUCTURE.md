# KiraPilot Project Structure

## Overview
KiraPilot is built with Tauri + React + TypeScript, providing a cross-platform productivity application with AI assistant integration.

## Directory Structure

```
kirapilot-app/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── dashboard/           # Dashboard-related components
│   │   ├── tasks/               # Task management components
│   │   ├── timer/               # Time tracking components
│   │   ├── focus/               # Focus environment components
│   │   ├── ai/                  # AI assistant components
│   │   └── common/              # Shared/common components
│   ├── services/                # Business logic and API services
│   │   ├── database/            # Database operations
│   │   ├── ai/                  # AI service integration
│   │   ├── sync/                # Cloud synchronization
│   │   └── patterns/            # Pattern recognition
│   ├── utils/                   # Utility functions
│   ├── types/                   # TypeScript type definitions
│   ├── hooks/                   # Custom React hooks
│   ├── stores/                  # State management
│   └── App.tsx                  # Main application component
├── src-tauri/                   # Tauri backend (Rust)
├── public/                      # Static assets
├── dist/                        # Build output
└── package.json                 # Dependencies and scripts
```

## Technology Stack

- **Frontend**: React 18+ with TypeScript
- **Backend**: Tauri (Rust)
- **Styling**: Tailwind CSS with custom animations
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Database**: SQLite (to be implemented)
- **AI Integration**: Local LLM with cloud fallback (to be implemented)

## Development Commands

- `npm run dev` - Start development server
- `npm run tauri dev` - Start Tauri development mode
- `npm run build` - Build for production
- `npm run tauri build` - Build Tauri application

## Current Status

✅ Project structure initialized
✅ Tauri + React + TypeScript setup complete
✅ Tailwind CSS configured with custom animations
✅ Lucide React icons installed
✅ Basic type definitions created
✅ Utility functions implemented
✅ Build system working

## Next Steps

1. Implement core data models and database layer
2. Build task management system
3. Create time tracking engine
4. Develop focus environment
5. Integrate AI assistant
6. Build dashboard interface