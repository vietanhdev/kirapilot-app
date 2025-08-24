# Data Management

KiraPilot provides comprehensive data management tools to help you backup, restore, and migrate your productivity data safely. This guide covers all aspects of managing your KiraPilot data.

## Understanding Your Data

### What Data Does KiraPilot Store?

KiraPilot stores all your data locally in a SQLite database, including:

- **Tasks and Task Lists:** All your tasks, descriptions, priorities, and organization
- **Time Sessions:** Timer history, work sessions, and break tracking
- **AI Interactions:** Conversation history and learned patterns
- **User Preferences:** Settings, themes, and customizations
- **Productivity Patterns:** Analytics data for AI insights
- **Dependencies:** Task relationships and project structures

### Data Location

Your data is stored in the following locations:

**macOS:**

```
~/Library/Application Support/com.kirapilot.app/
├── kirapilot.db          # Main database
├── backups/              # Automatic backups
├── exports/              # Manual exports
└── logs/                 # Application logs
```

**Windows:**

```
%APPDATA%\com.kirapilot.app\
├── kirapilot.db          # Main database
├── backups\              # Automatic backups
├── exports\              # Manual exports
└── logs\                 # Application logs
```

**Linux:**

```
~/.local/share/com.kirapilot.app/
├── kirapilot.db          # Main database
├── backups/              # Automatic backups
├── exports/              # Manual exports
└── logs/                 # Application logs
```

## Backup Strategies

### Automatic Backups

KiraPilot can automatically backup your data at regular intervals:

1. **Enable Automatic Backups:**
   - Go to Settings → Data Management
   - Toggle "Enable Automatic Backups"
   - Choose backup frequency:
     - Daily (recommended)
     - Weekly
     - Monthly

2. **Configure Backup Settings:**
   - **Retention:** How many backups to keep (default: 30)
   - **Location:** Where to store backups (default: app data folder)
   - **Compression:** Enable to save disk space
   - **Encryption:** Password-protect your backups

3. **Backup Schedule:**
   - Backups run when the app starts (if due)
   - Background backups during idle time
   - Manual trigger available anytime

### Manual Backups

Create backups on-demand for important milestones:

1. **Full Database Backup:**
   - Go to Settings → Data Management
   - Click "Create Backup Now"
   - Choose backup location
   - Add optional description/notes

2. **Selective Backup:**
   - Click "Export Data" instead
   - Choose specific data types:
     - Tasks and Task Lists
     - Time Tracking Data
     - AI Conversation History
     - User Settings
   - Select date range if needed

### Backup Formats

KiraPilot supports multiple backup formats:

**Full Backup (.kpbackup):**

- Complete database snapshot
- Includes all data and settings
- Best for complete restoration
- Compressed and optionally encrypted

**JSON Export (.json):**

- Human-readable format
- Good for data portability
- Can be edited manually
- Larger file size

**CSV Export (.csv):**

- Spreadsheet-compatible
- Good for data analysis
- Tasks and time data only
- Easy to import into other tools

## Restoration Procedures

### Restoring from Full Backup

To restore your complete KiraPilot data:

1. **Prepare for Restoration:**
   - Close KiraPilot completely
   - Backup current data (if any) as precaution
   - Locate your backup file

2. **Restore Process:**
   - Launch KiraPilot
   - Go to Settings → Data Management
   - Click "Restore from Backup"
   - Select your .kpbackup file
   - Enter password if backup is encrypted

3. **Restoration Options:**
   - **Complete Replace:** Overwrites all current data
   - **Merge Data:** Combines backup with current data
   - **Preview First:** Shows what will be restored

4. **Post-Restoration:**
   - KiraPilot will restart automatically
   - Verify your data is restored correctly
   - Check settings and preferences

### Selective Data Import

Import specific data types from exports:

1. **Import Tasks:**
   - Go to Settings → Data Management → Import Data
   - Select "Tasks and Task Lists"
   - Choose your JSON or CSV file
   - Map fields if importing CSV
   - Choose merge or replace option

2. **Import Time Data:**
   - Select "Time Tracking Data"
   - Choose date range to import
   - Resolve conflicts with existing data
   - Verify session accuracy

3. **Import Settings:**
   - Select "User Preferences"
   - Choose which settings to import
   - Preview changes before applying
   - Restart app to apply all settings

## Migration Procedures

### Migrating Between Devices

Transfer your KiraPilot data to a new device:

1. **On Source Device:**
   - Create a full backup (.kpbackup format)
   - Include all data types
   - Use encryption for security
   - Transfer file to new device securely

2. **On Target Device:**
   - Install KiraPilot
   - Don't set up new data yet
   - Use restore procedure above
   - Verify all data transferred correctly

3. **Cloud Sync Alternative:**
   - Enable cloud sync on source device
   - Let data sync to cloud
   - Install KiraPilot on target device
   - Sign in with same account
   - Data syncs automatically

### Migrating from Other Apps

Import data from popular productivity applications:

#### From Todoist

1. **Export from Todoist:**
   - Go to Todoist Settings → Backups
   - Download JSON backup
   - Save file to accessible location

2. **Import to KiraPilot:**
   - Settings → Data Management → Import Data
   - Select "From Todoist"
   - Choose your JSON file
   - Map project structures to Task Lists
   - Review and confirm import

#### From Notion

1. **Export from Notion:**
   - Select your task database
   - Export as CSV with all properties
   - Include dates, priorities, and status

2. **Import to KiraPilot:**
   - Use "Generic CSV Import"
   - Map Notion fields to KiraPilot fields:
     - Title → Task Name
     - Status → Task Status
     - Priority → Priority Level
     - Due Date → Due Date

#### From Apple Reminders

1. **Export Process:**
   - Use third-party export tool or manual copy
   - Create CSV with task names and lists
   - Include due dates if available

2. **Import Process:**
   - Use CSV import feature
   - Create Task Lists for each Reminder list
   - Set up recurring tasks manually

#### From Microsoft To Do

1. **Export Data:**
   - No direct export available
   - Use browser extension or manual process
   - Create CSV with tasks and lists

2. **Import Process:**
   - Follow CSV import procedure
   - Recreate shared lists as needed
   - Set up sync preferences

## Data Maintenance

### Regular Maintenance Tasks

Keep your KiraPilot data healthy:

1. **Weekly Maintenance:**
   - Review and archive completed tasks
   - Clean up old time sessions
   - Check backup status
   - Update task priorities

2. **Monthly Maintenance:**
   - Run database integrity check
   - Clear old AI conversation history
   - Review and update task templates
   - Analyze productivity patterns

3. **Quarterly Maintenance:**
   - Full data backup to external storage
   - Review and clean task dependencies
   - Update user preferences
   - Archive old projects

### Database Optimization

Optimize performance with regular maintenance:

1. **Database Integrity Check:**
   - Go to Settings → Data Management
   - Click "Verify Database Integrity"
   - Fix any issues found
   - Run monthly or after crashes

2. **Compact Database:**
   - Click "Optimize Database"
   - Reclaims unused space
   - Improves query performance
   - Safe to run anytime

3. **Clear Old Data:**
   - Set retention policies for:
     - Completed tasks (default: 1 year)
     - Time sessions (default: 2 years)
     - AI conversations (default: 6 months)
   - Apply policies automatically

### Troubleshooting Data Issues

Common data problems and solutions:

#### Corrupted Database

**Symptoms:** App crashes, data missing, error messages

**Solutions:**

1. Run database integrity check
2. Restore from recent backup
3. Use database repair tools
4. Contact support for advanced recovery

#### Sync Conflicts

**Symptoms:** Duplicate tasks, conflicting data between devices

**Solutions:**

1. Disable sync temporarily
2. Choose authoritative device
3. Export data from authoritative device
4. Clear data on other devices
5. Import authoritative data
6. Re-enable sync

#### Missing Data

**Symptoms:** Tasks or time sessions disappeared

**Solutions:**

1. Check active filters and views
2. Search for missing items
3. Check recent backups
4. Use data recovery tools
5. Restore from backup if needed

## Security and Privacy

### Data Encryption

Protect your sensitive data:

1. **Backup Encryption:**
   - Always encrypt backups with strong passwords
   - Use different passwords for different backups
   - Store passwords securely (password manager)

2. **Local Database Encryption:**
   - Enable in Settings → Security
   - Encrypts database at rest
   - Requires password on app start
   - Performance impact minimal

3. **Cloud Sync Encryption:**
   - End-to-end encryption enabled by default
   - Keys stored locally only
   - Zero-knowledge architecture
   - Cannot be decrypted by KiraPilot servers

### Data Privacy

KiraPilot's privacy-first approach:

- **Local Storage:** All data stored on your device
- **No Tracking:** No analytics or tracking by default
- **Optional Telemetry:** Crash reports only, with consent
- **Open Source:** Code available for security review

### Compliance

For business users:

- **GDPR Compliant:** Full data control and portability
- **HIPAA Considerations:** Local storage suitable for sensitive data
- **SOC 2:** Cloud sync infrastructure certified
- **Data Residency:** Choose your data location

## Advanced Data Management

### Scripting and Automation

Automate data management tasks:

1. **Backup Scripts:**

   ```bash
   # Example backup script (macOS/Linux)
   #!/bin/bash
   BACKUP_DIR="$HOME/KiraPilot-Backups"
   DATE=$(date +%Y%m%d)

   # Create backup directory
   mkdir -p "$BACKUP_DIR"

   # Copy database
   cp "$HOME/Library/Application Support/com.kirapilot.app/kirapilot.db" \
      "$BACKUP_DIR/kirapilot-$DATE.db"

   # Compress backup
   gzip "$BACKUP_DIR/kirapilot-$DATE.db"
   ```

2. **Data Export Automation:**
   - Use KiraPilot's command-line interface
   - Schedule regular exports
   - Integrate with backup systems

### API Access

For advanced users and integrations:

1. **Local API:**
   - REST API for local data access
   - Requires authentication token
   - Full CRUD operations available
   - Documentation in developer section

2. **Export Formats:**
   - JSON for programmatic access
   - CSV for spreadsheet analysis
   - XML for system integrations
   - Custom formats via API

### Bulk Operations

Handle large datasets efficiently:

1. **Bulk Import:**
   - CSV files up to 10,000 tasks
   - JSON files with complete structure
   - Progress tracking during import
   - Error handling and rollback

2. **Bulk Export:**
   - Filter by date ranges
   - Select specific data types
   - Batch processing for large datasets
   - Resume interrupted exports

## Best Practices

### Backup Strategy

Implement the 3-2-1 backup rule:

- **3 copies** of important data
- **2 different** storage media types
- **1 offsite** backup location

**Recommended Schedule:**

- **Daily:** Automatic local backups
- **Weekly:** Manual backup to external drive
- **Monthly:** Cloud backup or offsite storage

### Data Organization

Keep your data organized:

1. **Task Lists:** Use clear, descriptive names
2. **Tags:** Consistent tagging strategy
3. **Archives:** Regular archiving of completed work
4. **Dependencies:** Document complex relationships

### Performance Optimization

Maintain good performance:

1. **Regular Cleanup:** Archive old data monthly
2. **Database Maintenance:** Run optimization quarterly
3. **Backup Management:** Don't keep excessive backups
4. **Sync Efficiency:** Sync only necessary data

---

_Need help with data management? Check our [troubleshooting guide](./troubleshooting.md) or contact support for personalized assistance._
