import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Accordion,
  AccordionItem,
} from '@heroui/react';
import {
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  ArrowRight,
  Undo2,
} from 'lucide-react';
import {
  ConfirmationDialogProps,
  ActionChange,
  ActionImpact,
} from '../../types/aiConfirmation';

const getImpactColor = (impact: ActionImpact) => {
  switch (impact) {
    case 'low':
      return 'success';
    case 'medium':
      return 'warning';
    case 'high':
      return 'danger';
    case 'critical':
      return 'danger';
    default:
      return 'default';
  }
};

const getImpactIcon = (impact: ActionImpact) => {
  switch (impact) {
    case 'low':
      return <CheckCircle className='w-4 h-4' />;
    case 'medium':
      return <Info className='w-4 h-4' />;
    case 'high':
      return <AlertTriangle className='w-4 h-4' />;
    case 'critical':
      return <XCircle className='w-4 h-4' />;
    default:
      return <Info className='w-4 h-4' />;
  }
};

const getChangeIcon = (type: ActionChange['type']) => {
  switch (type) {
    case 'create':
      return <CheckCircle className='w-4 h-4 text-success' />;
    case 'update':
      return <ArrowRight className='w-4 h-4 text-warning' />;
    case 'delete':
      return <XCircle className='w-4 h-4 text-danger' />;
    case 'archive':
      return <Undo2 className='w-4 h-4 text-default-500' />;
    default:
      return <Info className='w-4 h-4' />;
  }
};

const ChangePreview: React.FC<{ change: ActionChange }> = ({ change }) => {
  return (
    <div className='flex items-start gap-3 p-3 bg-default-50 rounded-lg'>
      {getChangeIcon(change.type)}
      <div className='flex-1'>
        <div className='flex items-center gap-2 mb-1'>
          <span className='font-medium text-sm capitalize'>{change.type}</span>
          <span className='text-default-500 text-sm'>{change.target}</span>
        </div>
        <p className='text-sm text-default-600'>{change.description}</p>
        {change.field &&
          (change.oldValue !== undefined || change.newValue !== undefined) && (
            <div className='mt-2 text-xs'>
              <span className='text-default-500'>{change.field}: </span>
              {change.oldValue !== undefined && (
                <span className='line-through text-danger-500'>
                  {String(change.oldValue)}
                </span>
              )}
              {change.oldValue !== undefined &&
                change.newValue !== undefined && (
                  <span className='mx-1'>→</span>
                )}
              {change.newValue !== undefined && (
                <span className='text-success-600'>
                  {String(change.newValue)}
                </span>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export const SmartConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  preview,
  alternatives = [],
  loading = false,
}) => {
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(
    null
  );

  const handleConfirm = async () => {
    if (selectedAlternative) {
      const alternative = alternatives.find(
        alt => alt.id === selectedAlternative
      );
      if (alternative) {
        await alternative.action();
      }
    } else {
      await onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const impactColor = getImpactColor(preview.impact);
  const impactIcon = getImpactIcon(preview.impact);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='2xl'
      scrollBehavior='inside'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'py-6',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2'>
              {impactIcon}
              <h2 className='text-lg font-semibold'>{preview.title}</h2>
            </div>
            <Chip color={impactColor} variant='flat' size='sm'>
              {preview.impact.charAt(0).toUpperCase() + preview.impact.slice(1)}{' '}
              Impact
            </Chip>
          </div>
          <p className='text-sm text-default-600 font-normal'>
            {preview.description}
          </p>
        </ModalHeader>

        <ModalBody>
          <div className='space-y-4'>
            {/* Changes Preview */}
            <div>
              <h3 className='text-sm font-medium mb-3 flex items-center gap-2'>
                <Info className='w-4 h-4' />
                Proposed Changes ({preview.changes.length})
              </h3>
              <div className='space-y-2'>
                {preview.changes.map((change, index) => (
                  <ChangePreview key={index} change={change} />
                ))}
              </div>
            </div>

            {/* Reversibility Info */}
            <Card className='bg-default-50'>
              <CardBody className='py-3'>
                <div className='flex items-center gap-2'>
                  {preview.reversible ? (
                    <Undo2 className='w-4 h-4 text-success' />
                  ) : (
                    <AlertTriangle className='w-4 h-4 text-warning' />
                  )}
                  <span className='text-sm font-medium'>
                    {preview.reversible
                      ? 'Reversible Action'
                      : 'Permanent Action'}
                  </span>
                </div>
                <p className='text-xs text-default-600 mt-1'>
                  {preview.reversible
                    ? 'This action can be undone if needed.'
                    : 'This action cannot be undone. Please review carefully.'}
                </p>
              </CardBody>
            </Card>

            {/* Alternative Actions */}
            {alternatives.length > 0 && (
              <div>
                <Divider className='my-4' />
                <Accordion variant='bordered'>
                  <AccordionItem
                    key='alternatives'
                    aria-label='Alternative Actions'
                    title={
                      <div className='flex items-center gap-2'>
                        <ArrowRight className='w-4 h-4' />
                        <span>Alternative Actions ({alternatives.length})</span>
                      </div>
                    }
                  >
                    <div className='space-y-2'>
                      {alternatives.map(alternative => (
                        <Card
                          key={alternative.id}
                          isPressable
                          isHoverable
                          className={`cursor-pointer transition-colors ${
                            selectedAlternative === alternative.id
                              ? 'bg-primary-50 border-primary-200'
                              : 'bg-default-50'
                          }`}
                          onPress={() =>
                            setSelectedAlternative(
                              selectedAlternative === alternative.id
                                ? null
                                : alternative.id
                            )
                          }
                        >
                          <CardBody className='py-3'>
                            <div className='flex items-start gap-3'>
                              <div
                                className={`w-4 h-4 rounded-full border-2 mt-0.5 ${
                                  selectedAlternative === alternative.id
                                    ? 'bg-primary border-primary'
                                    : 'border-default-300'
                                }`}
                              />
                              <div className='flex-1'>
                                <h4 className='font-medium text-sm'>
                                  {alternative.label}
                                </h4>
                                <p className='text-xs text-default-600 mt-1'>
                                  {alternative.description}
                                </p>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant='light' onPress={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            color={selectedAlternative ? 'secondary' : 'primary'}
            onPress={handleConfirm}
            isLoading={loading}
            disabled={loading}
          >
            {selectedAlternative
              ? alternatives.find(alt => alt.id === selectedAlternative)
                  ?.label || 'Execute Alternative'
              : 'Confirm Action'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
