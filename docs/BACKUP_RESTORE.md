# Backup & Restore Guide

KiraPilot includes comprehensive backup and restore functionality to help you protect and migrate your data.

## Features

### Export Data

- Creates a compressed ZIP archive (.kpbackup extension) containing all your data
- Includes tasks, time sessions, AI conversations, task dependencies, and settings
- File dialog allows you to choose save location
- Progress indicators show export status
- Comprehensive validation ensures data integrity

### Import Data

- Supports .kpbackup and .zip files
- Validates backup file before import
- Shows detailed preview of backup contents
- Warns about data replacement
- Progress indicators show import status
- Automatic application refresh after successful import

### Data Validation

- Checks file format and structure
- Validates data integrity and relationships
- Ensures task dependencies reference valid tasks
- Checks for duplicate IDs
- Provides detailed error messages and warnings

## How to Use

### Creating a Backup

1. Open Settings → Data Management
2. Click "Export Data" button
3. Choose save location in the file dialog
4. Wait for export to complete
5. Confirmation dialog shows backup details

### Restoring from Backup

1. Open Settings → Data Management
2. Click "Import Data" button
3. Select your .kpbackup file
4. Review backup contents in confirmation dialog
5. Confirm to proceed (⚠️ This will replace all current data!)
6. Wait for import to complete
7. Application automatically refreshes

### Test Backup (Development)

The "Test Backup" button creates a quick backup to your desktop and validates it immediately. This is useful for:

- Testing backup functionality
- Verifying data integrity
- Development and debugging

## File Format

Backup files are ZIP archives containing:

- `metadata.json` - Backup information and statistics
- `data.json` - Complete backup data
- `tasks.json` - Individual task data
- `time_sessions.json` - Time tracking sessions
- `ai_interactions.json` - AI conversation history
- `task_dependencies.json` - Task dependency relationships
- `settings.json` - User preferences and settings

## Data Integrity

The system performs comprehensive validation:

- File format verification
- Required field validation
- Relationship integrity checks
- Duplicate ID detection
- Version compatibility checks

## Security & Privacy

- All data remains local during backup/restore
- No data is sent to external servers
- Backup files are standard ZIP archives
- You control where backups are stored
- Import validation prevents corrupted data

## Troubleshooting

### Export Issues

- Ensure you have write permissions to the selected location
- Check available disk space
- Verify no other application is using the target file

### Import Issues

- Ensure the backup file is not corrupted
- Check that the backup version is compatible
- Verify all required data is present in the backup
- Make sure no other application is using the backup file

### Validation Errors

- Check the detailed error messages in the validation dialog
- Ensure the backup file is a valid KiraPilot backup
- Try creating a new backup if the file appears corrupted

## Best Practices

1. **Regular Backups**: Create backups regularly, especially before major changes
2. **Safe Storage**: Store backups in multiple locations (cloud storage, external drives)
3. **Test Restores**: Periodically test your backups by restoring to a test environment
4. **Version Control**: Keep multiple backup versions with dates in filenames
5. **Before Updates**: Always backup before updating KiraPilot

## Technical Details

### Backend Implementation

- Uses Rust with SeaORM for database operations
- ZIP compression with proper file structure
- Comprehensive error handling and validation
- Transaction-based import for data consistency

### Frontend Implementation

- React with TypeScript for type safety
- Tauri dialog integration for native file dialogs
- Progress indicators and user feedback
- Comprehensive error handling and user guidance

### File Permissions

The application requires the following Tauri permissions:

- `dialog:allow-open` - For selecting backup files
- `dialog:allow-save` - For choosing backup save location
- `dialog:allow-message` - For showing confirmation dialogs
- `dialog:allow-confirm` - For user confirmations

## API Reference

### Tauri Commands

- `export_data_to_file(filePath: string)` - Export data to specified file
- `import_data_from_file(filePath: string, overwrite: boolean)` - Import data from file
- `validate_backup_file(filePath: string)` - Basic backup validation
- `validate_backup_comprehensive(filePath: string)` - Comprehensive validation with warnings

### Data Structures

- `BackupMetadata` - Backup file information and statistics
- `BackupData` - Complete backup data structure
- `BackupValidationResult` - Validation results with errors and warnings
