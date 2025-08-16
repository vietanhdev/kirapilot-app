# Technology Stack & Build System

## Core Technologies

- **Frontend**: React 19+ with TypeScript
- **Backend**: Tauri v2 (Rust)
- **Build Tool**: Vite 7+ with HMR
- **Database**: SQLite via Tauri SQL plugin
- **Styling**: Tailwind CSS 4+ with HeroUI components
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Rich Text**: Tiptap editor
- **Drag & Drop**: @dnd-kit
- **Validation**: Zod schemas

## Development Tools

- **Linting**: ESLint 9+ with TypeScript rules
- **Formatting**: Prettier with single quotes, 2-space tabs
- **Testing**: Jest with ts-jest, React Testing Library
- **Git Hooks**: Husky with lint-staged
- **Type Checking**: TypeScript 5.8+ in strict mode

## Common Commands

```bash
# Development
npm run dev              # Start Vite dev server
npm run tauri dev        # Start Tauri app in dev mode

# Building
npm run build            # Build frontend (tsc + vite build)
npm run tauri build      # Build Tauri application

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run type-check       # TypeScript check without emit
```

## Database Architecture

- **Primary**: SQLite with migrations system
- **Fallback**: Mock database for development/testing
- **Queries**: Direct SQL with type-safe interfaces
- **Transactions**: Proper concurrency handling with queue system

## Key Dependencies

- `@tauri-apps/api` - Tauri frontend APIs
- `@tauri-apps/plugin-sql` - Database access
- `@heroui/react` - UI component library
- `zod` - Runtime type validation
