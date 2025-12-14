import { Component, Input, signal, effect, OnChanges, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-auto-save-indicator',
  standalone: true,
  template: `
    @if (visible()) {
      <div 
        class="auto-save-indicator" 
        [class.saving]="saving" 
        [class.saved]="!saving"
        role="status"
        aria-live="polite"
      >
        @if (saving) {
          <div class="spinner"></div>
          <span>Saving...</span>
        } @else {
          <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Draft saved</span>
        }
      </div>
    }
  `,
  styles: [`
    .auto-save-indicator {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
    }

    .saving {
      background: var(--gray-700);
      color: white;
    }

    .saved {
      background: var(--green-600);
      color: white;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .check-icon {
      width: 16px;
      height: 16px;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class AutoSaveIndicatorComponent implements OnChanges, OnDestroy {
  @Input() saving = false;
  @Input() lastSaved: Date | null = null;

  visible = signal(false);
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // Show indicator when saving starts
      if (this.saving) {
        this.visible.set(true);
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
      }
    });
  }

  ngOnChanges(): void {
    if (this.saving) {
      this.visible.set(true);
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    } else if (this.lastSaved) {
      // Show "saved" for 3 seconds then hide
      this.visible.set(true);
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
      }
      this.hideTimeout = setTimeout(() => {
        this.visible.set(false);
      }, 3000);
    }
  }

  ngOnDestroy(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
  }
}
