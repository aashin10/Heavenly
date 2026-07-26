import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-toaster',
  standalone: true,
  imports: [IconComponent],
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
          <app-icon [name]="iconFor(toast.type)" [size]="18" />
          <span class="toast-message">{{ toast.message }}</span>
          <button
            class="toast-close"
            type="button"
            (click)="toastService.removeToast(toast.id)"
            aria-label="Close notification"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toaster-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: var(--z-toast);
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
      gap: 0.625rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
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
      background-color: var(--success-solid);
      color: var(--white);
    }

    .toast-error {
      background-color: var(--danger-solid);
      color: var(--white);
    }

    .toast-info {
      background-color: var(--info-solid);
      color: var(--white);
    }

    .toast-warning {
      background-color: var(--warning-solid);
      color: var(--white);
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
  /** Semantic icon per toast type. */
  iconFor(type: string): string {
    switch (type) {
      case 'success': return 'circle-check';
      case 'error': return 'circle-x';
      case 'warning': return 'triangle-alert';
      default: return 'info';
    }
  }

  protected readonly toastService = inject(ToastService);
}
