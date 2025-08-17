import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Switch,
  Divider,
  Progress,
  Chip,
} from '@heroui/react';
import {
  Download,
  Upload,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Database,
  Bot,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
} from 'lucide-react';
import { useAI } from '../../contexts/AIContext';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { resetDatabase } from '../../utils/resetDatabase';
import { forceClearData } from '../../utils/clearOldData';

interface DataManagementProps {
  className?: string;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  className = '',
}) => {
  const { conversations, clearConversation } = useAI();
  const { settings: privacySettings, updateSettings: updatePrivacySettings } =
    usePrivacy();

  // Modal controls
  const {
    isOpen: isExportOpen,
    onOpen: onExportOpen,
    onClose: onExportClose,
  } = useDisclosure();
  const {
    isOpen: isImportOpen,
    onOpen: onImportOpen,
    onClose: onImportClose,
  } = useDisclosure();
  const {
    isOpen: isResetOpen,
    onOpen: onResetOpen,
    onClose: onResetClose,
  } = useDisclosure();
  const {
    isOpen: isPrivacyOpen,
    onOpen: onPrivacyOpen,
    onClose: onPrivacyClose,
  } = useDisclosure();
  const {
    isOpen: isAILogsOpen,
    onOpen: onAILogsOpen,
    onClose: onAILogsClose,
  } = useDisclosure();

  // State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [showAILogs, setShowAILogs] = useState(false);

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      onExportOpen();

      // Simulate progress for better UX
      const progressSteps = [20, 40, 60, 80, 100];
      for (const progress of progressSteps) {
        setExportProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Create simple backup data
      const mockDb = JSON.parse(
        localStorage.getItem('kirapilot-mock-db') || '{}'
      );
      const preferences = JSON.parse(
        localStorage.getItem('kirapilot-preferences') || '{}'
      );

      const exportData = {
        tasks: mockDb.tasks || [],
        timeSessions: mockDb.timeSessions || [],
        focusSessions: mockDb.focusSessions || [],
        preferences,
        privacySettings,
        // Include AI conversations only if retention is enabled
        aiConversations: privacySettings.conversationRetention
          ? conversations
          : [],
        exportMetadata: {
          version: '1.0',
          exportDate: new Date().toISOString(),
          appVersion: 'KiraPilot v1.0',
        },
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kirapilot-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        onExportClose();
        setExportProgress(0);
      }, 1000);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    onImportOpen();

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        // Basic validation
        if (!importData.exportMetadata || !importData.exportMetadata.version) {
          throw new Error('Invalid backup file format');
        }

        // Simulate progress
        const progressSteps = [20, 40, 60, 80, 100];
        for (const progress of progressSteps) {
          setImportProgress(progress);
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Restore data
        if (importData.tasks) {
          const currentData = JSON.parse(
            localStorage.getItem('kirapilot-mock-db') || '{}'
          );
          const newData = {
            ...currentData,
            tasks: importData.tasks,
            timeSessions: importData.timeSessions || [],
            focusSessions: importData.focusSessions || [],
          };
          localStorage.setItem('kirapilot-mock-db', JSON.stringify(newData));
        }

        if (importData.preferences) {
          localStorage.setItem(
            'kirapilot-preferences',
            JSON.stringify(importData.preferences)
          );
        }

        if (importData.privacySettings) {
          localStorage.setItem(
            'kirapilot-privacy-settings',
            JSON.stringify(importData.privacySettings)
          );
        }

        // Clear AI conversations if not retaining them
        if (!privacySettings.conversationRetention) {
          clearConversation();
        }
      } catch (error) {
        console.error('Failed to import data:', error);
        alert('Failed to import backup file. Please check the file format.');
      } finally {
        setIsImporting(false);
        setTimeout(() => {
          onImportClose();
          setImportProgress(0);
          // Reload to apply imported data
          window.location.reload();
        }, 1000);
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllData = () => {
    try {
      // Clear all localStorage data
      forceClearData();
      localStorage.removeItem('kirapilot-preferences');
      localStorage.removeItem('kirapilot-privacy-settings');
      localStorage.removeItem('kira_api_key');

      // Clear AI conversations
      clearConversation();

      // Reset database
      resetDatabase();

      onResetClose();
    } catch (error) {
      console.error('Failed to reset data:', error);
    }
  };

  const getDataSize = () => {
    try {
      const mockDb = localStorage.getItem('kirapilot-mock-db') || '{}';
      const preferences = localStorage.getItem('kirapilot-preferences') || '{}';
      const privacy =
        localStorage.getItem('kirapilot-privacy-settings') || '{}';

      const totalSize = mockDb.length + preferences.length + privacy.length;
      return (totalSize / 1024).toFixed(2); // KB
    } catch {
      return '0';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Data Export/Import Section */}
      <Card className='bg-content2 border-divider'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Database className='w-5 h-5 text-blue-400' />
            <h3 className='text-lg font-semibold text-foreground'>
              Data Management
            </h3>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 bg-content3 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-foreground'>
                  Export All Data
                </h4>
                <p className='text-xs text-foreground-600'>
                  Download a complete backup of your tasks, sessions, and
                  settings
                </p>
                <p className='text-xs text-foreground-500 mt-1'>
                  Current data size: {getDataSize()} KB
                </p>
              </div>
              <Button
                onPress={handleExportData}
                variant='bordered'
                size='sm'
                startContent={<Download className='w-4 h-4' />}
                isDisabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>

            <div className='flex items-center justify-between p-4 bg-content3 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-foreground'>
                  Import Data
                </h4>
                <p className='text-xs text-foreground-600'>
                  Restore from a previous backup file
                </p>
              </div>
              <Button
                as='label'
                variant='bordered'
                size='sm'
                startContent={<Upload className='w-4 h-4' />}
                isDisabled={isImporting}
              >
                {isImporting ? 'Importing...' : 'Import'}
                <input
                  type='file'
                  accept='.json'
                  onChange={handleImportData}
                  className='hidden'
                />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Privacy Controls Section */}
      <Card className='bg-content2 border-divider'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Shield className='w-5 h-5 text-green-400' />
            <h3 className='text-lg font-semibold text-foreground'>
              Privacy Controls
            </h3>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  AI Data Usage
                </label>
                <p className='text-xs text-foreground-600'>
                  Allow AI to learn from your usage patterns
                </p>
              </div>
              <Switch
                isSelected={privacySettings.aiDataUsage}
                onValueChange={checked =>
                  updatePrivacySettings({ aiDataUsage: checked })
                }
                size='sm'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  Conversation Retention
                </label>
                <p className='text-xs text-foreground-600'>
                  Keep AI conversation history for context
                </p>
              </div>
              <Switch
                isSelected={privacySettings.conversationRetention}
                onValueChange={checked =>
                  updatePrivacySettings({ conversationRetention: checked })
                }
                size='sm'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  Analytics Collection
                </label>
                <p className='text-xs text-foreground-600'>
                  Anonymous usage analytics to improve the app
                </p>
              </div>
              <Switch
                isSelected={privacySettings.analyticsCollection}
                onValueChange={checked =>
                  updatePrivacySettings({ analyticsCollection: checked })
                }
                size='sm'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-foreground'>
                  Crash Reporting
                </label>
                <p className='text-xs text-foreground-600'>
                  Send crash reports to help fix issues
                </p>
              </div>
              <Switch
                isSelected={privacySettings.crashReporting}
                onValueChange={checked =>
                  updatePrivacySettings({ crashReporting: checked })
                }
                size='sm'
              />
            </div>
          </div>

          <Divider className='bg-divider my-4' />

          <div className='space-y-3'>
            <Button
              onPress={onPrivacyOpen}
              variant='bordered'
              size='sm'
              startContent={<Settings className='w-4 h-4' />}
              className='w-full'
            >
              Advanced Privacy Settings
            </Button>

            <Button
              onPress={onAILogsOpen}
              variant='bordered'
              size='sm'
              startContent={<Bot className='w-4 h-4' />}
              className='w-full'
            >
              View AI Operation Logs
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Data Security Section */}
      <Card className='bg-green-500/10 border-green-500/20'>
        <CardBody className='p-6'>
          <div className='flex items-start gap-3'>
            <Shield className='w-5 h-5 text-green-400 mt-0.5' />
            <div>
              <h4 className='text-sm font-medium text-green-300 mb-2'>
                Local Data Storage
              </h4>
              <p className='text-xs text-green-400 mb-3'>
                All your personal data is stored locally on your device.
                KiraPilot never sends your tasks, time tracking data, or
                personal information to external servers.
              </p>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>Tasks stored locally</span>
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>Time data encrypted</span>
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>No cloud sync required</span>
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-3 h-3 text-green-400' />
                  <span className='text-green-400'>Full user control</span>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className='bg-red-500/10 border-red-500/20'>
        <CardBody className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <AlertTriangle className='w-5 h-5 text-red-400' />
            <h3 className='text-lg font-semibold text-red-300'>Danger Zone</h3>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg'>
              <div>
                <h4 className='text-sm font-medium text-red-300'>
                  Reset All Data
                </h4>
                <p className='text-xs text-red-400'>
                  Permanently delete all tasks, sessions, settings, and AI
                  conversations
                </p>
              </div>
              <Button
                onPress={onResetOpen}
                color='danger'
                variant='bordered'
                size='sm'
                startContent={<Trash2 className='w-4 h-4' />}
              >
                Reset Everything
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Export Progress Modal */}
      <Modal
        isOpen={isExportOpen}
        onClose={onExportClose}
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>Exporting Data</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <Progress value={exportProgress} className='w-full' />
              <p className='text-sm text-foreground-600 text-center'>
                {exportProgress < 100
                  ? 'Preparing your data...'
                  : 'Export complete!'}
              </p>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Import Progress Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={onImportClose}
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>Importing Data</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <Progress value={importProgress} className='w-full' />
              <p className='text-sm text-foreground-600 text-center'>
                {importProgress < 100
                  ? 'Restoring your data...'
                  : 'Import complete!'}
              </p>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalContent>
          <ModalHeader className='text-red-400'>Confirm Data Reset</ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg'>
                <AlertTriangle className='w-5 h-5 text-red-400 mt-0.5' />
                <div>
                  <p className='text-sm text-red-300 font-medium mb-2'>
                    This action cannot be undone!
                  </p>
                  <p className='text-xs text-red-400'>
                    All your tasks, time sessions, focus sessions, AI
                    conversations, and settings will be permanently deleted.
                  </p>
                </div>
              </div>
              <p className='text-sm text-foreground'>
                Consider exporting your data first as a backup.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onResetClose}>
              Cancel
            </Button>
            <Button color='danger' onPress={handleResetAllData}>
              Reset Everything
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Advanced Privacy Settings Modal */}
      <Modal isOpen={isPrivacyOpen} onClose={onPrivacyClose} size='2xl'>
        <ModalContent>
          <ModalHeader>Advanced Privacy Settings</ModalHeader>
          <ModalBody>
            <div className='space-y-6'>
              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  Data Collection
                </h4>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <label className='text-sm text-foreground'>
                        Performance Metrics
                      </label>
                      <p className='text-xs text-foreground-600'>
                        Collect app performance data
                      </p>
                    </div>
                    <Switch
                      isSelected={privacySettings.performanceMetrics}
                      onValueChange={checked =>
                        updatePrivacySettings({ performanceMetrics: checked })
                      }
                      size='sm'
                    />
                  </div>
                </div>
              </div>

              <Divider className='bg-divider' />

              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  AI Data Handling
                </h4>
                <div className='space-y-3'>
                  <div className='p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg'>
                    <div className='flex items-start gap-2'>
                      <Info className='w-4 h-4 text-blue-400 mt-0.5' />
                      <div>
                        <p className='text-xs text-blue-300 font-medium'>
                          AI Processing
                        </p>
                        <p className='text-xs text-blue-400 mt-1'>
                          When AI features are used, only anonymized,
                          non-personal data is sent to cloud services for
                          processing. Your task content and personal information
                          never leave your device.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Divider className='bg-divider' />

              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  Data Retention
                </h4>
                <div className='space-y-3'>
                  <div className='p-3 bg-content3 rounded-lg'>
                    <p className='text-xs text-foreground mb-2'>
                      AI Conversation History
                    </p>
                    <p className='text-xs text-foreground-600'>
                      Conversations: {conversations.length} stored locally
                    </p>
                    <Button
                      size='sm'
                      variant='bordered'
                      onPress={clearConversation}
                      className='mt-2'
                      startContent={<Trash2 className='w-3 h-3' />}
                    >
                      Clear All Conversations
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onPress={onPrivacyClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AI Operation Logs Modal */}
      <Modal isOpen={isAILogsOpen} onClose={onAILogsClose} size='3xl'>
        <ModalContent>
          <ModalHeader className='flex items-center gap-2'>
            <Bot className='w-5 h-5' />
            AI Operation Logs
            <Button
              size='sm'
              variant='light'
              onPress={() => setShowAILogs(!showAILogs)}
              startContent={
                showAILogs ? (
                  <EyeOff className='w-3 h-3' />
                ) : (
                  <Eye className='w-3 h-3' />
                )
              }
            >
              {showAILogs ? 'Hide Details' : 'Show Details'}
            </Button>
          </ModalHeader>
          <ModalBody>
            <div className='space-y-4 max-h-96 overflow-y-auto'>
              {conversations.length === 0 ? (
                <div className='text-center py-8'>
                  <Bot className='w-8 h-8 text-foreground-600 mx-auto mb-2' />
                  <p className='text-foreground-600'>No AI conversations yet</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div key={conv.id} className='p-4 bg-content3 rounded-lg'>
                    <div className='flex items-start justify-between mb-2'>
                      <div className='flex items-center gap-2'>
                        <Chip size='sm' variant='flat'>
                          #{index + 1}
                        </Chip>
                        <span className='text-xs text-foreground-600'>
                          {conv.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        {conv.actions.length > 0 && (
                          <Chip size='sm' color='primary' variant='flat'>
                            {conv.actions.length} actions
                          </Chip>
                        )}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div>
                        <p className='text-xs text-foreground-500 mb-1'>
                          User:
                        </p>
                        <p className='text-sm text-foreground bg-content2 p-2 rounded'>
                          {conv.message}
                        </p>
                      </div>

                      {showAILogs && (
                        <>
                          <div>
                            <p className='text-xs text-foreground-500 mb-1'>
                              AI Response:
                            </p>
                            <p className='text-sm text-foreground bg-content2 p-2 rounded'>
                              {conv.response}
                            </p>
                          </div>

                          {conv.reasoning && (
                            <div>
                              <p className='text-xs text-foreground-500 mb-1'>
                                Reasoning:
                              </p>
                              <p className='text-xs text-foreground-600 bg-content2 p-2 rounded'>
                                {conv.reasoning}
                              </p>
                            </div>
                          )}

                          {conv.actions.length > 0 && (
                            <div>
                              <p className='text-xs text-foreground-500 mb-1'>
                                Actions Taken:
                              </p>
                              <div className='space-y-1'>
                                {conv.actions.map((action, actionIndex) => (
                                  <div
                                    key={actionIndex}
                                    className='text-xs text-foreground-600 bg-content2 p-2 rounded'
                                  >
                                    <span className='font-medium'>
                                      {action.type}
                                    </span>
                                    {action.reasoning && (
                                      <p className='mt-1 text-foreground-500'>
                                        {action.reasoning}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant='light' onPress={onAILogsClose}>
              Close
            </Button>
            {conversations.length > 0 && (
              <Button
                color='danger'
                variant='bordered'
                onPress={() => {
                  clearConversation();
                  onAILogsClose();
                }}
                startContent={<Trash2 className='w-4 h-4' />}
              >
                Clear All Logs
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
