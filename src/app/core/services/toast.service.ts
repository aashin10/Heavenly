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
  private readonly timeoutIds = new Map<number, any>();

  readonly toasts = this.toastsSignal.asReadonly();

  private addToast(message: string, type: Toast['type'], duration = 3000): void {
    const toast: Toast = {
      id: ++this.idCounter,
      message,
      type,
      duration
    };

    this.toastsSignal.update(toasts => [...toasts, toast]);

    const timeoutId = setTimeout(() => {
      this.removeToast(toast.id);
    }, duration);
    
    this.timeoutIds.set(toast.id, timeoutId);
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

  show(config: { message: string; type: Toast['type']; duration?: number }): void {
    this.addToast(config.message, config.type, config.duration);
  }

  removeToast(id: number): void {
    const timeoutId = this.timeoutIds.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(id);
    }
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }
}
