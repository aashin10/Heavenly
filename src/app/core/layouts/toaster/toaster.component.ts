import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toaster',
  standalone: true,
  template: `
    <div class="toaster-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="toast"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
          [class.toast-success]="toast.type === 'success'"
          [class.toast-error]="toast.type === 'error'"
          [class.toast-info]="toast.type === 'info'"
          [class.toast-warning]="toast.type === 'warning'"
        >
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.removeToast(toast.id)" aria-label="Close notification">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toaster-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 24rem;
    }

    .toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      background-color: #10b981;
      color: white;
    }

    .toast-error {
      background-color: #ef4444;
      color: white;
    }

    .toast-info {
      background-color: #3b82f6;
      color: white;
    }

    .toast-warning {
      background-color: #f59e0b;
      color: white;
    }

    .toast-message {
      flex: 1;
      margin-right: 0.5rem;
    }

    .toast-close {
      background: none;
      border: none;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.7;
    }

    .toast-close:hover {
      opacity: 1;
    }
  `]
})
export class ToasterComponent {
  protected readonly toastService = inject(ToastService);
}
