# Troubleshooting

This guide helps you resolve common issues you might encounter while using KiraPilot. If you can't find a solution here, check our [FAQ](./faq.md) or contact support.

## Installation Issues

### KiraPilot Won't Start

**Symptoms:** Application fails to launch or crashes immediately on startup.

**Solutions:**

1. **Check System Requirements**
   - Ensure your operating system is supported (macOS 10.15+, Windows 10+, or modern Linux)
   - Verify you have sufficient disk space (at least 100MB free)

2. **Clear Application Data**

   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/com.kirapilot.app

   # Windows
   # Delete: %APPDATA%\com.kirapilot.app

   # Linux
   rm -rf ~/.local/share/com.kirapilot.app
   ```

3. **Reinstall the Application**
   - Download the latest version from the official website
   - Uninstall the current version completely
   - Install the new version with administrator privileges

### Database Initialization Errors

**Symptoms:** Error messages about database connection or initialization failures.

**Solutions:**

1. **Reset Database**
   - Close KiraPilot completely
   - Navigate to the application data directory (see paths above)
   - Delete the `kirapilot.db` file
   - Restart KiraPilot (a new database will be created)

2. **Check File Permissions**
   - Ensure KiraPilot has read/write access to its data directory
   - On macOS/Linux: `chmod 755 ~/.local/share/com.kirapilot.app`

## Performance Issues

### Slow Application Performance

**Symptoms:** KiraPilot feels sluggish, takes long to load, or freezes during use.

**Solutions:**

1. **Clear Old Data**
   - Go to Settings → Data Management
   - Use "Clear Old Sessions" to remove data older than 6 months
   - Restart the application

2. **Reduce Visual Effects**
   - Go to Settings → Appearance
   - Disable animations if enabled
   - Switch to light theme if using dark theme

3. **Check System Resources**
   - Close other resource-intensive applications
   - Ensure you have at least 4GB of available RAM
   - Check if your disk is nearly full

### High Memory Usage

**Symptoms:** KiraPilot consuming excessive RAM or causing system slowdown.

**Solutions:**

1. **Restart the Application**
   - Close KiraPilot completely
   - Wait 10 seconds
   - Reopen the application

2. **Limit Task History**
   - Go to Settings → Data Management
   - Set "Keep completed tasks for" to 30 days or less
   - Apply changes and restart

## Task Management Issues

### Tasks Not Saving

**Symptoms:** Created or edited tasks disappear after closing the application.

**Solutions:**

1. **Check Auto-Save Settings**
   - Go to Settings → General
   - Ensure "Auto-save changes" is enabled
   - Set auto-save interval to 30 seconds or less

2. **Manual Save**
   - Use Ctrl+S (Cmd+S on macOS) to manually save changes
   - Look for the save indicator in the task editor

3. **Database Integrity Check**
   - Go to Settings → Data Management
   - Click "Verify Database Integrity"
   - Follow any repair suggestions

### Task Dependencies Not Working

**Symptoms:** Dependent tasks don't update when parent tasks change status.

**Solutions:**

1. **Refresh Dependencies**
   - Right-click on the task with dependencies
   - Select "Refresh Dependencies"
   - Check if the dependency chain is correct

2. **Clear Dependency Cache**
   - Go to Settings → Advanced
   - Click "Clear Dependency Cache"
   - Restart the application

## Timer Issues

### Timer Not Starting

**Symptoms:** Timer button doesn't respond or timer immediately stops.

**Solutions:**

1. **Check Task Selection**
   - Ensure a task is selected before starting the timer
   - Try selecting a different task

2. **Reset Timer State**
   - Go to Settings → Timer
   - Click "Reset Timer State"
   - Try starting the timer again

### Timer Notifications Not Working

**Symptoms:** No notifications when timer completes or during breaks.

**Solutions:**

1. **Check System Permissions**
   - **macOS:** System Preferences → Notifications → KiraPilot → Allow notifications
   - **Windows:** Settings → System → Notifications → KiraPilot → On
   - **Linux:** Check your desktop environment's notification settings

2. **Test Notifications**
   - Go to Settings → Notifications
   - Click "Test Notification"
   - Adjust settings if needed

## AI Assistant Issues

### AI Not Responding

**Symptoms:** AI assistant doesn't respond to queries or shows error messages.

**Solutions:**

1. **Check Internet Connection**
   - Ensure you have a stable internet connection
   - Try refreshing the page or restarting the app

2. **Clear AI Cache**
   - Go to Settings → AI Assistant
   - Click "Clear Conversation History"
   - Try asking a simple question

3. **Reset AI Settings**
   - Go to Settings → AI Assistant
   - Click "Reset to Defaults"
   - Reconfigure your preferences

### AI Suggestions Seem Inaccurate

**Symptoms:** AI provides irrelevant suggestions or misunderstands context.

**Solutions:**

1. **Provide More Context**
   - Be more specific in your requests
   - Include relevant details about your tasks and goals

2. **Update Pattern Data**
   - Go to Settings → AI Assistant
   - Click "Refresh Pattern Analysis"
   - Allow the AI to relearn your patterns

## Data and Sync Issues

### Data Not Syncing

**Symptoms:** Changes made on one device don't appear on others.

**Solutions:**

1. **Manual Sync**
   - Go to Settings → Data Management
   - Click "Force Sync Now"
   - Wait for sync to complete

2. **Check Sync Settings**
   - Ensure sync is enabled in Settings
   - Verify you're signed in to the same account on all devices

### Export/Import Problems

**Symptoms:** Cannot export data or import fails with errors.

**Solutions:**

1. **Check File Permissions**
   - Ensure you have write permissions to the export location
   - Try exporting to a different folder

2. **Verify File Format**
   - Use only supported formats (JSON, CSV)
   - Check that import files aren't corrupted

## Advanced Troubleshooting

### Enable Debug Mode

For persistent issues, enable debug mode to get more detailed error information:

1. **Enable Debug Logging**
   - Go to Settings → Advanced
   - Enable "Debug Mode"
   - Restart the application

2. **Access Debug Logs**
   - **macOS:** `~/Library/Logs/KiraPilot/`
   - **Windows:** `%APPDATA%\KiraPilot\logs\`
   - **Linux:** `~/.local/share/KiraPilot/logs/`

### Safe Mode

If KiraPilot won't start normally, try safe mode:

1. **Start in Safe Mode**
   - Hold Shift while launching KiraPilot
   - Or use command line: `kirapilot --safe-mode`

2. **Safe Mode Features**
   - Disables all plugins and extensions
   - Uses minimal UI
   - Allows access to settings for troubleshooting

### Database Recovery

For severe database issues:

1. **Create Backup First**
   - Copy your database file before attempting recovery
   - Location varies by OS (see paths in Installation Issues)

2. **Run Database Repair**
   - Go to Settings → Data Management
   - Click "Advanced Database Tools"
   - Select "Repair Database"
   - Follow the recovery wizard

## Getting Additional Help

If these solutions don't resolve your issue:

1. **Check System Requirements**
   - Verify your system meets minimum requirements
   - Update your operating system if needed

2. **Contact Support**
   - Include your operating system and KiraPilot version
   - Describe the exact steps that led to the issue
   - Attach debug logs if available

3. **Community Resources**
   - Check the GitHub issues page for similar problems
   - Join the community Discord for real-time help
   - Browse the knowledge base for additional solutions

Remember to always backup your data before attempting major troubleshooting steps!
