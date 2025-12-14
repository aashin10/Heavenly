import { Component, inject } from '@angular/core';
import { ModalService, ModalRef } from '../../../core/services/modal.service';

@Component({
  selector: 'app-modal-container',
  standalone: true,
  template: `
    @for (modal of modalService.modals(); track modal.id) {
      <div 
        class="modal-overlay" 
        [class.modal-size-sm]="modal.config.size === 'sm'"
        [class.modal-size-md]="modal.config.size === 'md'"
        [class.modal-size-lg]="modal.config.size === 'lg'"
        [class.modal-size-xl]="modal.config.size === 'xl'"
        (click)="onBackdropClick($event, modal)"
      >
        <div class="modal-wrapper" (click)="$event.stopPropagation()">
          <ng-container #modalHost></ng-container>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
      animation: fadeIn 0.2s ease;
    }

    .modal-wrapper {
      background: var(--white);
      border-radius: 0.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
      width: 100%;
    }

    .modal-size-sm .modal-wrapper {
      max-width: 400px;
    }

    .modal-size-md .modal-wrapper {
      max-width: 560px;
    }

    .modal-size-lg .modal-wrapper {
      max-width: 800px;
    }

    .modal-size-xl .modal-wrapper {
      max-width: 1140px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class ModalContainerComponent {
  protected readonly modalService = inject(ModalService);

  onBackdropClick(event: MouseEvent, modal: ModalRef): void {
    if (modal.config.closeOnBackdrop !== false) {
      modal.close();
    }
  }
}
