# Frequently Asked Questions

Find answers to the most commonly asked questions about KiraPilot. If you don't find what you're looking for, check our [troubleshooting guide](./troubleshooting.md) or contact support.

## General Questions

### What is KiraPilot?

KiraPilot is a cross-platform productivity application that combines task management, time tracking, and intelligent AI assistance. It helps you navigate your day with precision through beautiful design and smart automation, all while keeping your data private and secure on your local device.

### Which platforms does KiraPilot support?

KiraPilot is available for:

- **macOS** 10.15 (Catalina) and later
- **Windows** 10 and later
- **Linux** (most modern distributions)

The application is built with Tauri for native performance across all platforms.

### Is KiraPilot free?

KiraPilot offers both free and premium tiers:

- **Free tier:** Core task management, basic time tracking, and limited AI interactions
- **Premium tier:** Advanced AI features, unlimited time tracking, pattern recognition, and priority support

### How is my data stored and protected?

Your data is stored locally on your device using SQLite database. KiraPilot follows a privacy-first approach:

- No data is sent to external servers without your explicit consent
- All AI processing can be done locally (premium feature)
- Optional cloud sync is encrypted end-to-end
- You maintain full control over your data

## Installation and Setup

### How do I install KiraPilot?

1. Download the installer for your operating system from the official website
2. Run the installer with administrator privileges
3. Follow the setup wizard
4. Launch KiraPilot and complete the initial configuration

### Can I use KiraPilot without an internet connection?

Yes! KiraPilot is designed to work offline:

- All core features (tasks, timer, data) work without internet
- AI assistant requires internet for cloud-based features
- Local AI processing is available in premium tier
- Sync features require internet connection

### How do I migrate from another productivity app?

KiraPilot supports importing data from popular productivity apps:

1. **From Todoist:**
   - Export your data from Todoist as JSON
   - Go to Settings → Data Management → Import
   - Select "Todoist JSON" and choose your file

2. **From Notion:**
   - Export your database as CSV
   - Use the "Generic CSV" import option
   - Map fields during the import process

3. **From other apps:**
   - Export as CSV or JSON if possible
   - Use the generic import options
   - Contact support for help with specific formats

## Task Management

### How do I create task dependencies?

1. Open the task you want to make dependent
2. Click the "Dependencies" tab
3. Click "Add Dependency"
4. Select the task that must be completed first
5. Choose the dependency type (blocks, relates to, etc.)

### Can I organize tasks into projects?

Yes! KiraPilot uses Task Lists to organize related tasks:

- Create a new Task List for each project
- Move tasks between lists by dragging
- Set different colors and icons for each list
- Filter views by specific task lists

### How does task prioritization work?

KiraPilot uses a flexible priority system:

- **Critical:** Must be done today
- **High:** Important and urgent
- **Medium:** Important but not urgent
- **Low:** Nice to have
- **None:** No specific priority

The AI assistant can help suggest priorities based on your patterns and deadlines.

### Can I set recurring tasks?

Yes, recurring tasks are supported:

1. Open the task editor
2. Click "Recurrence" tab
3. Choose pattern (daily, weekly, monthly, custom)
4. Set end date or number of occurrences
5. Save the task

## Time Tracking

### How accurate is the time tracking?

KiraPilot's timer is accurate to the second and includes:

- Automatic pause detection when you're away
- Manual time adjustments for accuracy
- Break time tracking
- Detailed session logs

### Can I track time for multiple tasks simultaneously?

No, KiraPilot follows the principle of focused work:

- Only one timer can run at a time
- This encourages single-tasking and better focus
- You can quickly switch between tasks if needed
- All time switches are logged for analysis

### How do I view my time tracking reports?

1. Go to the Reports section
2. Choose your date range
3. Select report type:
   - Daily summary
   - Weekly overview
   - Task-based analysis
   - Productivity patterns
4. Export reports as PDF or CSV

### Can I edit time entries after they're recorded?

Yes, you can edit time entries:

1. Go to Timer → Session History
2. Find the session you want to edit
3. Click the edit icon
4. Adjust start time, end time, or add notes
5. Save changes

## AI Assistant

### What can the AI assistant help me with?

The AI assistant can:

- Create and organize tasks from natural language
- Suggest optimal scheduling based on your patterns
- Provide productivity insights and recommendations
- Answer questions about your data and progress
- Help with time management strategies
- Automate routine task creation

### Is the AI assistant always listening?

No, the AI assistant only activates when:

- You explicitly open the AI chat
- You use voice commands (if enabled)
- You click the AI suggestion buttons

Your privacy is protected - no passive listening occurs.

### Can I use KiraPilot's AI offline?

- **Free tier:** Requires internet connection
- **Premium tier:** Includes local AI processing for basic features
- **Hybrid mode:** Uses local AI when possible, cloud for complex queries

### How does the AI learn my patterns?

The AI analyzes your usage patterns locally:

- Task completion times and patterns
- Preferred working hours
- Break frequency and duration
- Project types and priorities
- All analysis happens on your device (premium tier)

## Data Management

### How do I backup my data?

KiraPilot offers several backup options:

1. **Automatic backups:**
   - Go to Settings → Data Management
   - Enable "Automatic Backups"
   - Choose backup frequency and location

2. **Manual backup:**
   - Settings → Data Management → Export Data
   - Choose format (JSON recommended for full backup)
   - Save to secure location

### Can I sync data between devices?

Yes, with optional cloud sync:

- End-to-end encrypted synchronization
- Works across all supported platforms
- Requires KiraPilot account (free to create)
- Can be disabled for complete local-only usage

### How do I restore from a backup?

1. Go to Settings → Data Management
2. Click "Import Data"
3. Select your backup file
4. Choose import options:
   - Replace all data
   - Merge with existing data
   - Import specific categories only
5. Confirm the restore operation

### What happens if I uninstall KiraPilot?

- Your data remains in the application data folder
- Reinstalling KiraPilot will restore your data automatically
- To completely remove data, manually delete the data folder
- Always backup before uninstalling if you want to keep your data

## Customization

### Can I change the appearance of KiraPilot?

Yes, KiraPilot offers extensive customization:

- Light and dark themes
- Custom color schemes
- Adjustable font sizes
- Layout preferences
- Custom keyboard shortcuts

### How do I set up keyboard shortcuts?

1. Go to Settings → Keyboard Shortcuts
2. Find the action you want to customize
3. Click in the shortcut field
4. Press your desired key combination
5. Save changes

See our [keyboard shortcuts guide](./keyboard-shortcuts.md) for a complete list.

### Can I create custom task templates?

Yes, task templates save time:

1. Create a task with your desired structure
2. Right-click and select "Save as Template"
3. Name your template
4. Use "New from Template" to create similar tasks

## Performance and Technical

### Why is KiraPilot using a lot of memory?

Common causes and solutions:

- Large number of tasks: Archive completed tasks regularly
- Long session history: Clear old sessions in Data Management
- Multiple large attachments: Compress or remove unused files
- Background sync: Disable if not needed

### How do I update KiraPilot?

Updates are handled automatically:

- KiraPilot checks for updates on startup
- You'll be notified when updates are available
- Updates install in the background
- Restart when prompted to complete the update

### Can I use KiraPilot on multiple monitors?

Yes, KiraPilot supports multi-monitor setups:

- Drag the window to any monitor
- Window position is remembered
- Different scaling is supported
- Notifications appear on the active monitor

## Troubleshooting

### KiraPilot won't start after an update

1. Restart your computer
2. Run KiraPilot as administrator
3. If still failing, reinstall the latest version
4. Contact support if the problem persists

### My tasks disappeared

Don't panic! Try these steps:

1. Check if you're viewing the correct task list
2. Clear any active filters
3. Go to Settings → Data Management → Verify Database
4. Restore from automatic backup if needed

### The AI assistant stopped working

1. Check your internet connection
2. Restart KiraPilot
3. Go to Settings → AI Assistant → Reset Configuration
4. Contact support if issues persist

## Getting Help

### How do I contact support?

- **Email:** support@kirapilot.com
- **GitHub Issues:** For bug reports and feature requests
- **Community Discord:** For real-time help and discussions
- **Knowledge Base:** Comprehensive guides and tutorials

### What information should I include in a support request?

Please include:

- Your operating system and version
- KiraPilot version number
- Detailed description of the issue
- Steps to reproduce the problem
- Screenshots or error messages
- Debug logs (if available)

### Is there a community forum?

Yes! Join our community:

- **Discord:** Real-time chat and support
- **GitHub Discussions:** Feature requests and development talk
- **Reddit:** r/KiraPilot for general discussions
- **Twitter:** @KiraPilot for updates and tips

---

_Still have questions? Check our [troubleshooting guide](./troubleshooting.md) or contact our support team. We're here to help!_
