import { useState } from 'react';
import {
  Chip,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  Card,
  CardBody,
  Divider,
} from '@heroui/react';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Code,
  Settings,
  Play,
  Database,
  FileText,
  Calendar,
  Timer,
  Plus,
  Edit,
  Trash2,
  Search,
} from 'lucide-react';
import { ToolExecutionLog } from '../../types/aiLogging';

interface ToolDetailsProps {
  toolCalls: ToolExecutionLog[];
  className?: string;
}

export function ToolDetails({ toolCalls, className = '' }: ToolDetailsProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTool, setSelectedTool] = useState<ToolExecutionLog | null>(
    null
  );

  if (toolCalls.length === 0) {
    return (
      <span className={`text-default-400 text-sm ${className}`}>None</span>
    );
  }

  const getToolIcon = (toolName: string) => {
    const name = toolName.toLowerCase();
    if (name.includes('task') || name.includes('create')) {
      return <Plus className='w-3 h-3' />;
    }
    if (name.includes('timer') || name.includes('time')) {
      return <Timer className='w-3 h-3' />;
    }
    if (name.includes('edit') || name.includes('update')) {
      return <Edit className='w-3 h-3' />;
    }
    if (name.includes('delete') || name.includes('remove')) {
      return <Trash2 className='w-3 h-3' />;
    }
    if (name.includes('search') || name.includes('find')) {
      return <Search className='w-3 h-3' />;
    }
    if (name.includes('calendar') || name.includes('schedule')) {
      return <Calendar className='w-3 h-3' />;
    }
    if (name.includes('file') || name.includes('document')) {
      return <FileText className='w-3 h-3' />;
    }
    if (name.includes('database') || name.includes('data')) {
      return <Database className='w-3 h-3' />;
    }
    if (name.includes('setting') || name.includes('config')) {
      return <Settings className='w-3 h-3' />;
    }
    if (name.includes('run') || name.includes('execute')) {
      return <Play className='w-3 h-3' />;
    }
    if (name.includes('code')) {
      return <Code className='w-3 h-3' />;
    }
    return <Wrench className='w-3 h-3' />;
  };

  const getToolColor = (toolName: string) => {
    const name = toolName.toLowerCase();
    if (name.includes('create') || name.includes('add')) {
      return 'success';
    }
    if (name.includes('delete') || name.includes('remove')) {
      return 'danger';
    }
    if (name.includes('edit') || name.includes('update')) {
      return 'warning';
    }
    if (name.includes('timer') || name.includes('time')) {
      return 'secondary';
    }
    return 'primary';
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const parseArguments = (args: string) => {
    try {
      return JSON.parse(args);
    } catch {
      return args;
    }
  };

  const parseResult = (result: string) => {
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  };

  const handleToolClick = (tool: ToolExecutionLog) => {
    setSelectedTool(tool);
    onOpen();
  };

  // Group tools by name for compact display
  const toolGroups = toolCalls.reduce(
    (groups, tool) => {
      const key = tool.toolName;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tool);
      return groups;
    },
    {} as Record<string, ToolExecutionLog[]>
  );

  const toolNames = Object.keys(toolGroups);

  if (toolNames.length === 1 && toolGroups[toolNames[0]].length === 1) {
    // Single tool - show as clickable chip
    const tool = toolGroups[toolNames[0]][0];
    return (
      <>
        <Tooltip content={`Click to view ${tool.toolName} details`}>
          <Chip
            size='sm'
            color={getToolColor(tool.toolName)}
            variant='flat'
            startContent={getToolIcon(tool.toolName)}
            className={`cursor-pointer hover:opacity-80 ${className}`}
            onClick={() => handleToolClick(tool)}
          >
            {tool.toolName}
          </Chip>
        </Tooltip>

        <Modal
          isOpen={isOpen}
          onClose={onClose}
          size='2xl'
          scrollBehavior='inside'
        >
          <ModalContent>
            <ModalHeader className='flex items-center gap-2'>
              {selectedTool && getToolIcon(selectedTool.toolName)}
              Tool Execution Details: {selectedTool?.toolName}
            </ModalHeader>
            <ModalBody>
              {selectedTool && (
                <div className='space-y-4'>
                  {/* Status and Timing */}
                  <div className='flex items-center gap-4'>
                    <div className='flex items-center gap-2'>
                      {selectedTool.success ? (
                        <CheckCircle className='w-4 h-4 text-success' />
                      ) : (
                        <AlertCircle className='w-4 h-4 text-danger' />
                      )}
                      <span
                        className={
                          selectedTool.success ? 'text-success' : 'text-danger'
                        }
                      >
                        {selectedTool.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className='flex items-center gap-2 text-default-500'>
                      <Clock className='w-4 h-4' />
                      <span>
                        {formatExecutionTime(selectedTool.executionTime)}
                      </span>
                    </div>
                  </div>

                  {/* Arguments */}
                  <Card>
                    <CardBody>
                      <h4 className='font-medium mb-2 flex items-center gap-2'>
                        <Settings className='w-4 h-4' />
                        Arguments
                      </h4>
                      <pre className='bg-default-100 p-3 rounded text-sm overflow-auto max-h-40'>
                        {JSON.stringify(
                          parseArguments(selectedTool.arguments),
                          null,
                          2
                        )}
                      </pre>
                    </CardBody>
                  </Card>

                  {/* Result */}
                  <Card>
                    <CardBody>
                      <h4 className='font-medium mb-2 flex items-center gap-2'>
                        <Eye className='w-4 h-4' />
                        Result
                      </h4>
                      <pre className='bg-default-100 p-3 rounded text-sm overflow-auto max-h-40'>
                        {JSON.stringify(
                          parseResult(selectedTool.result),
                          null,
                          2
                        )}
                      </pre>
                    </CardBody>
                  </Card>

                  {/* Error (if any) */}
                  {selectedTool.error && (
                    <Card>
                      <CardBody>
                        <h4 className='font-medium mb-2 flex items-center gap-2 text-danger'>
                          <AlertCircle className='w-4 h-4' />
                          Error
                        </h4>
                        <div className='bg-danger-50 border border-danger-200 p-3 rounded text-sm text-danger-700'>
                          {selectedTool.error}
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {/* Metadata */}
                  <Card>
                    <CardBody>
                      <h4 className='font-medium mb-2'>Metadata</h4>
                      <div className='space-y-2 text-sm'>
                        <div className='flex justify-between'>
                          <span className='text-default-500'>Tool ID:</span>
                          <span className='font-mono'>{selectedTool.id}</span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-default-500'>
                            Interaction ID:
                          </span>
                          <span className='font-mono'>
                            {selectedTool.interactionLogId}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-default-500'>Executed At:</span>
                          <span>{selectedTool.createdAt.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color='primary' onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }

  // Multiple tools - show count with tooltip listing all tools
  const toolList = toolNames
    .map(name => {
      const count = toolGroups[name].length;
      return count > 1 ? `${name} (${count}x)` : name;
    })
    .join(', ');

  return (
    <>
      <Tooltip content={`Tools used: ${toolList}`}>
        <Chip
          size='sm'
          color='primary'
          variant='flat'
          startContent={<Wrench className='w-3 h-3' />}
          className={`cursor-pointer hover:opacity-80 ${className}`}
          onClick={onOpen}
        >
          {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''}
        </Chip>
      </Tooltip>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size='3xl'
        scrollBehavior='inside'
      >
        <ModalContent>
          <ModalHeader className='flex items-center gap-2'>
            <Wrench className='w-5 h-5' />
            Tool Executions ({toolCalls.length})
          </ModalHeader>
          <ModalBody>
            <div className='space-y-4'>
              {toolCalls.map((tool, index) => (
                <Card key={tool.id} className='border'>
                  <CardBody>
                    <div className='space-y-3'>
                      {/* Tool Header */}
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          {getToolIcon(tool.toolName)}
                          <h4 className='font-medium'>{tool.toolName}</h4>
                          <Chip
                            size='sm'
                            color={tool.success ? 'success' : 'danger'}
                            variant='flat'
                            startContent={
                              tool.success ? (
                                <CheckCircle className='w-3 h-3' />
                              ) : (
                                <AlertCircle className='w-3 h-3' />
                              )
                            }
                          >
                            {tool.success ? 'Success' : 'Failed'}
                          </Chip>
                        </div>
                        <div className='flex items-center gap-2 text-sm text-default-500'>
                          <Clock className='w-3 h-3' />
                          {formatExecutionTime(tool.executionTime)}
                        </div>
                      </div>

                      {/* Arguments and Result in columns */}
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <h5 className='text-sm font-medium mb-2 text-default-600'>
                            Arguments
                          </h5>
                          <pre className='bg-default-100 p-2 rounded text-xs overflow-auto max-h-32'>
                            {JSON.stringify(
                              parseArguments(tool.arguments),
                              null,
                              2
                            )}
                          </pre>
                        </div>
                        <div>
                          <h5 className='text-sm font-medium mb-2 text-default-600'>
                            Result
                          </h5>
                          <pre className='bg-default-100 p-2 rounded text-xs overflow-auto max-h-32'>
                            {JSON.stringify(parseResult(tool.result), null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Error (if any) */}
                      {tool.error && (
                        <div className='bg-danger-50 border border-danger-200 p-2 rounded'>
                          <h5 className='text-sm font-medium mb-1 text-danger-700'>
                            Error
                          </h5>
                          <p className='text-sm text-danger-600'>
                            {tool.error}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardBody>
                  {index < toolCalls.length - 1 && <Divider />}
                </Card>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color='primary' onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
