import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private idCounter = 0;

  readonly toasts = this.toastsSignal.asReadonly();

  private addToast(message: string, type: Toast['type'], duration = 3000): void {
    const toast: Toast = {
      id: ++this.idCounter,
      message,
      type,
      duration
    };

    this.toastsSignal.update(toasts => [...toasts, toast]);

    setTimeout(() => {
      this.removeToast(toast.id);
    }, duration);
  }

  success(message: string, duration?: number): void {
    this.addToast(message, 'success', duration);
  }

  error(message: string, duration?: number): void {
    this.addToast(message, 'error', duration);
  }

  info(message: string, duration?: number): void {
    this.addToast(message, 'info', duration);
  }

  warning(message: string, duration?: number): void {
    this.addToast(message, 'warning', duration);
  }

  removeToast(id: number): void {
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }
}
