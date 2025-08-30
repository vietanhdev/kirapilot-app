export interface AIActionPreview {
  title: string;
  description: string;
  changes: ActionChange[];
  impact: ActionImpact;
  reversible: boolean;
}

export interface ActionChange {
  type: 'create' | 'update' | 'delete' | 'archive';
  target: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
}

export type ActionImpact = 'low' | 'medium' | 'high' | 'critical';

export interface ConfirmationLevel {
  impact: ActionImpact;
  requiresExplicitConfirmation: boolean;
  showPreview: boolean;
  allowAlternatives: boolean;
}

export interface AlternativeAction {
  id: string;
  label: string;
  description: string;
  action: () => Promise<void>;
}

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  preview: AIActionPreview;
  alternatives?: AlternativeAction[];
  loading?: boolean;
}

export interface SmartConfirmationOptions {
  title: string;
  description: string;
  changes: ActionChange[];
  impact?: ActionImpact; // Optional - will be auto-determined if not provided
  reversible?: boolean;
  alternatives?: AlternativeAction[];
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
}
