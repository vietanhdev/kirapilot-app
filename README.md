<p align="center">
  <img alt="KiraPilot" style="width: 128px; height: 128px;" src="app-icon.png"/>
  <h1 align="center">🚀 KiraPilot 🚀</h1>
  <p align="center">Navigate your day with precision, powered by intelligent AI assistance!</p>
</p>

**WIP Warning:** This is a work-in-progress. APIs and data will be changed a lot in the future.

<p align="center">
  <a href="https://github.com/vietanhdev/kirapilot-app/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/vietanhdev/kirapilot-app.svg" alt="License"/>
  </a>
  <a href="https://github.com/vietanhdev/kirapilot-app/issues">
    <img src="https://img.shields.io/github/issues/vietanhdev/kirapilot-app.svg" alt="Open Issues"/>
  </a>
  <a href="https://github.com/vietanhdev/kirapilot-app/releases">
    <img src="https://img.shields.io/github/v/release/vietanhdev/kirapilot-app.svg" alt="Latest Release"/>
  </a>
  <a href="https://github.com/vietanhdev/kirapilot-app/stargazers">
    <img src="https://img.shields.io/github/stars/vietanhdev/kirapilot-app.svg" alt="GitHub Stars"/>
  </a>
  <a href="https://twitter.com/vietanhdev">
    <img src="https://img.shields.io/badge/+Follow-vietanhdev-blue" alt="Follow"/>
  </a>
  <a href="https://github.com/vietanhdev/kirapilot-app/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/vietanhdev/kirapilot-app/ci.yml?branch=main" alt="Build Status"/>
  </a>
  <a href="https://codecov.io/gh/vietanhdev/kirapilot-app">
    <img src="https://img.shields.io/codecov/c/github/vietanhdev/kirapilot-app" alt="Coverage"/>
  </a>
</p>

---

KiraPilot is a cross-platform productivity application that combines task management, time tracking, and intelligent AI assistance. The app helps users navigate their day with precision through beautiful design and smart automation.

![Screenshot - Dark](./screenshots/dark.png)

## ✨ Core Features

- **Task Management**: Rich text descriptions, priority levels, dependencies, and week-based planning
- **Time Tracking**: Built-in timer with session notes and productivity analytics
- **Pattern Recognition**: Productivity analytics and automatic scheduling suggestions
- **AI Assistant**: Natural language interface powered by Google Gemini with tool access to all app features
- **Periodic Tasks**: Automated recurring task generation with flexible scheduling
- **Multi-language Support**: Comprehensive internationalization with 7 languages and advanced translation management

## 🚀 Technology Stack

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
- **AI Framework**: LangChain with Google Gemini integration
- **ORM**: SeaORM for type-safe database operations

## 📦 Installation

### Download Pre-built Releases

Visit the [Releases page](https://github.com/vietanhdev/kirapilot-app/releases) to download the latest version for your platform:

- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` or `.deb` package

### System Requirements

- **macOS**: 10.15 (Catalina) or later
- **Windows**: Windows 10 version 1903 or later
- **Linux**: Ubuntu 18.04+ or equivalent distribution
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 500MB available space

## 🛠️ Development

### Prerequisites

- **Node.js**: 18.x or later (LTS recommended)
- **Rust**: 1.70.0 or later (latest stable)
- **System Dependencies**:
  - macOS: Xcode Command Line Tools
  - Windows: Microsoft C++ Build Tools
  - Linux: `build-essential`, `libwebkit2gtk-4.0-dev`, `libssl-dev`

### Getting Started

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Start Tauri app in development mode
npm run tauri dev
```

### Code Quality

```bash
# Linting and formatting
npm run lint              # ESLint check
npm run lint:fix          # ESLint auto-fix
npm run format           # Prettier format
npm run type-check       # TypeScript check

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Generate coverage report

# Building
npm run build            # Build frontend
npm run tauri build      # Build Tauri application
```

## 🏗️ Project Structure

```
src/
├── components/           # React components by feature
│   ├── common/          # Shared UI components
│   ├── planning/        # Task planning and scheduling
│   ├── timer/           # Time tracking and session management
│   ├── ai/              # AI assistant components
│   └── TitleBar.tsx     # Custom window title bar
├── services/            # Business logic and external integrations
│   ├── database/        # Database layer with repositories
│   ├── ai/              # AI service implementations and tools
│   ├── notifications/   # System notifications
│   ├── security/        # Security and privacy utilities
│   └── startup/         # Application startup services
├── contexts/            # React context providers
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
├── utils/               # Pure utility functions
└── App.tsx             # Main application component
```

## 🌍 Multi-language Support

KiraPilot supports 7 languages with comprehensive internationalization:

| Language   | Code | Native Name | Coverage         |
| ---------- | ---- | ----------- | ---------------- |
| English    | `en` | English     | 100% (Reference) |
| Spanish    | `es` | Español     | ~95%             |
| French     | `fr` | Français    | ~95%             |
| German     | `de` | Deutsch     | ~95%             |
| Vietnamese | `vi` | Tiếng Việt  | ~95%             |
| Japanese   | `ja` | 日本語      | ~95%             |
| Portuguese | `pt` | Português   | ~95%             |

### Translation Features

- **Advanced i18n System**: Hierarchical key structure with validation
- **Development Tools**: Translation manager UI and CLI tools
- **Quality Assurance**: Automatic coverage validation and consistency checks
- **Variable Substitution**: Dynamic content with placeholder support
- **Plural Forms**: Proper pluralization for different languages
- **Translation Health Monitoring**: Real-time coverage and quality metrics

### For Developers

```bash
# Check translation coverage
npm run i18n:check

# Validate translation structure
npm run i18n:validate

# Export translations to CSV
npm run i18n:export

# Generate translation stubs
npm run i18n:stubs <language-code>
```

### Usage in Components

```tsx
import { useTranslation } from '../hooks/useTranslation';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('tasks.description', { count: 5 })}</p>
    </div>
  );
};
```

## 🤖 AI Assistant

KiraPilot features an intelligent AI assistant that provides:

- **Natural Language Interface**: Conversational chat for app control
- **Tool Integration**: Direct access to all app functionality
- **Context Awareness**: Adapts recommendations based on patterns
- **Privacy-First**: Local data processing with optional cloud features
- **Multi-language Support**: AI assistance available in all supported languages

### Example Interactions

**Task Management**

```
User: "I need to prepare the quarterly report by next Friday"
Kira: "I've created 'Prepare quarterly report' due next Friday at 5pm.
Based on similar tasks, this typically takes 2-3 hours.
Should I schedule a time block for this?"
```

**Productivity Insights**

```
User: "When am I most productive?"
Kira: "Based on your completed tasks, you're most productive:
• Tuesday mornings (9-11am): 87% completion rate
• Thursday afternoons (2-4pm): 82% completion rate
Would you like me to schedule deep work during these times?"
```

## 🎯 Target Platforms

Desktop-first application built with Tauri for native performance on:

- macOS
- Windows
- Linux

## 🔒 Privacy & Data

- **Local-First**: SQLite database with offline-first approach
- **Optional Sync**: Cloud synchronization with user control
- **Data Security**: Encryption for sensitive information
- **Transparent AI**: Clear visibility into AI operations and suggestions

## 📝 Development Philosophy

- Privacy-first with local data storage
- Beautiful, native-feeling interface with smooth animations
- Contextual intelligence that adapts to user patterns
- Minimal UI that expands when needed
- Supportive, not authoritative AI assistance

## 🗺️ Roadmap

### Current Version (v1.x)

- ✅ Core task management with rich text support
- ✅ Built-in time tracking and session management
- ✅ AI assistant with natural language interface
- ✅ Multi-language support (7 languages)
- ✅ Local SQLite database with privacy-first approach
- ✅ Cross-platform desktop application

### Upcoming Features (v2.x)

- 🔄 Cloud synchronization (optional)
- 🔄 Mobile companion app
- 🔄 Advanced analytics and productivity insights
- 🔄 Team collaboration features
- 🔄 Plugin system for extensibility
- 🔄 Calendar integration (Google, Outlook, etc.)

### Future Vision (v3.x+)

- 📋 Advanced project management features
- 📋 Integration with popular development tools
- 📋 Voice commands and dictation
- 📋 Smart scheduling with machine learning
- 📋 Workflow automation and templates

## 🧪 Using Kiro for Coding

This project is developed using [Kiro](https://kiro.ai), an AI-powered coding assistant that helps with:

- Code generation and refactoring
- Architecture decisions and best practices
- Testing and documentation
- Bug fixes and optimizations

The `.kiro/` directory contains our project steering documents that guide development decisions and ensure consistency across the codebase.

## 📚 Documentation

- [Development Setup](docs/DEVELOPMENT.md) - Complete development environment setup
- [Project Structure](docs/PROJECT_STRUCTURE.md) - Architecture and organization guide
- [Testing Strategy](docs/TESTING.md) - Testing approach and guidelines
- [Internationalization Guide](src/i18n/README.md) - Multi-language support and translation management
- [AI Assistant Documentation](docs/AI_ASSISTANT.md) - AI features and integration guide
- [Database Schema](docs/DATABASE.md) - Database structure and migration guide

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Code Quality

1. Follow the code style defined in our ESLint and Prettier configurations
2. Run `npm run lint` and `npm run build` before submitting changes
3. Ensure all tests pass and maintain test coverage
4. Update documentation for significant changes

### Translation Contributions

1. Check current translation coverage with `npm run i18n:check`
2. Add missing translations to language files in `src/i18n/locales/`
3. Validate translations with `npm run i18n:validate`
4. Test your translations using the language switcher in development

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Run quality checks: `npm run lint && npm run type-check && npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Reporting Issues

- Use the [GitHub Issues](https://github.com/vietanhdev/kirapilot-app/issues) page
- Include steps to reproduce the issue
- Provide system information (OS, Node.js version, etc.)
- Add screenshots for UI-related issues

## ❓ Frequently Asked Questions

### General Questions

**Q: Is KiraPilot free to use?**
A: Yes, KiraPilot is open-source and free to use under the MIT License.

**Q: Does KiraPilot require an internet connection?**
A: No, KiraPilot works completely offline. Your data stays on your device. Internet is only needed for optional AI features if you choose to use cloud-based AI services.

**Q: Can I sync my data across devices?**
A: Currently, KiraPilot stores data locally. Cloud synchronization is planned for a future release.

### Technical Questions

**Q: What AI models does KiraPilot support?**
A: KiraPilot currently integrates with Google Gemini. Support for additional AI providers is planned.

**Q: Can I export my data?**
A: Yes, your data is stored in a standard SQLite database that you can access and export at any time.

**Q: How do I contribute translations?**
A: Check the [Internationalization Guide](src/i18n/README.md) for detailed instructions on adding or improving translations.

### Privacy & Security

**Q: What data does KiraPilot collect?**
A: KiraPilot is privacy-first. All your task data, time tracking, and personal information stays on your device. No data is sent to external servers unless you explicitly enable cloud AI features.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vietanhdev/kirapilot-app&type=Date)](https://www.star-history.com/#vietanhdev/kirapilot-app&Date)
