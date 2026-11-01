import { createContext } from 'react';

type ToastVariant = 'error' | 'success';

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export type { ToastVariant };
