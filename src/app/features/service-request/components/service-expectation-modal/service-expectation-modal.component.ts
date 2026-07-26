import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { ServiceType } from '../../../../core/models/service.model';
import { WhatToExpectInfo, getWhatToExpect } from '../../../../shared/utils/service-category.util';

@Component({
  selector: 'app-service-expectation-modal',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div 
        class="modal-backdrop" 
        (click)="onBackdropClick()"
        (keydown.escape)="close(false)"
        tabindex="-1"
      >
        <div 
          class="modal-content" 
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'modal-title'"
          (click)="$event.stopPropagation()"
          (keydown.escape)="close(false)"
        >
          <!-- Header -->
          <div class="modal-header">
            <div class="service-icon"><app-icon [name]="service?.icon || 'clipboard-list'" [size]="28" /></div>
            <h2 id="modal-title" class="modal-title">You selected: {{ service?.name }}</h2>
            <button 
              type="button" 
              class="close-btn" 
              (click)="close(false)"
              aria-label="Close modal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Form Type Badge -->
            <div class="form-type-section">
              <span class="form-type-badge" [class]="getCategoryClass()">
                {{ expectInfo?.formType }}
              </span>
              <div class="time-estimate">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Estimated time: <strong>{{ expectInfo?.estimatedTime }}</strong></span>
              </div>
            </div>

            <!-- What You'll Need -->
            <div class="info-section">
              <h3 class="section-title">
                <span class="section-icon"><app-icon name="clipboard-list" [size]="16" /></span>
                You'll need:
              </h3>
              <ul class="requirements-list">
                @for (req of expectInfo?.requirements; track req) {
                  <li>{{ req }}</li>
                }
              </ul>
            </div>

            <!-- What Happens Next -->
            <div class="info-section">
              <h3 class="section-title">
                <span class="section-icon"><app-icon name="circle-check" [size]="16" /></span>
                What happens next:
              </h3>
              <ul class="next-steps-list">
                <li>Your request goes to management for review</li>
                <li>Approval within <strong>{{ expectInfo?.approvalTimeline }}</strong></li>
                <li>Once approved, vendors can bid on your request</li>
                <li>Compare offers and select the best vendor</li>
              </ul>
            </div>

            <!-- Draft Notice -->
            @if (hasDraft) {
              <div class="draft-notice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                <div class="draft-text">
                  <strong>You have a saved draft!</strong>
                  <span>You can continue where you left off.</span>
                </div>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button 
              type="button" 
              class="btn btn-secondary" 
              (click)="close(false)"
            >
              Cancel
            </button>
            <button 
              type="button" 
              class="btn btn-primary" 
              (click)="close(true)"
            >
              Let's Begin <app-icon name="arrow-right" [size]="16" />
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    }

    .modal-header {
      padding: 1.5rem;
      text-align: center;
      border-bottom: 1px solid var(--gray-100);
      position: relative;
    }

    .service-icon {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--gray-800);
      margin: 0;
    }

    .close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: var(--gray-400);
      transition: all 0.2s ease;

      &:hover {
        background: var(--gray-100);
        color: var(--gray-600);
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-type-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--gray-100);
    }

    .form-type-badge {
      padding: 0.375rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8125rem;
      font-weight: 600;

      &.quick_service {
        background: var(--green-100);
        color: var(--green-700);
      }

      &.mid_complexity {
        background: var(--yellow-100);
        color: var(--yellow-700);
      }

      &.technical {
        background: var(--blue-50);
        color: var(--primary-color);
      }
    }

    .time-estimate {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      color: var(--gray-600);

      svg {
        width: 16px;
        height: 16px;
        color: var(--gray-400);
      }
    }

    .info-section {
      margin-bottom: 1.25rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--gray-700);
      margin: 0 0 0.75rem;
    }

    .section-icon {
      font-size: 1rem;
    }

    .requirements-list,
    .next-steps-list {
      list-style: none;
      margin: 0;
      padding: 0;

      li {
        position: relative;
        padding-left: 1.25rem;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        color: var(--gray-600);
        line-height: 1.5;

        &::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--primary-color);
          font-weight: bold;
        }

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .draft-notice {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding: 1rem;
      background: var(--blue-50);
      border: 1px solid var(--primary-light);
      border-radius: 8px;

      svg {
        width: 20px;
        height: 20px;
        color: var(--primary-color);
        flex-shrink: 0;
        margin-top: 2px;
      }
    }

    .draft-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;

      strong {
        font-size: 0.875rem;
        color: var(--primary-color);
      }

      span {
        font-size: 0.8125rem;
        color: var(--gray-600);
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--gray-100);
      background: var(--gray-50);
      border-radius: 0 0 12px 12px;
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-secondary {
      background: white;
      color: var(--gray-700);
      border: 1px solid var(--gray-300);

      &:hover {
        background: var(--gray-50);
        border-color: var(--gray-400);
      }
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;

      &:hover {
        background: var(--primary-light);
      }
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

    @media (max-width: 480px) {
      .modal-content {
        margin: 0;
        max-height: 100vh;
        border-radius: 12px 12px 0 0;
        align-self: flex-end;
      }

      .modal-footer {
        flex-direction: column-reverse;

        .btn {
          width: 100%;
        }
      }
    }
  `]
})
export class ServiceExpectationModalComponent {
  @Input() service: ServiceType | null = null;
  @Input() hasDraft = false;
  @Output() closed = new EventEmitter<boolean>();

  isOpen = signal(false);
  expectInfo: WhatToExpectInfo | null = null;

  open(service: ServiceType, hasDraft = false): void {
    this.service = service;
    this.hasDraft = hasDraft;
    this.expectInfo = getWhatToExpect(service.name);
    this.isOpen.set(true);
  }

  close(proceed: boolean): void {
    this.isOpen.set(false);
    this.closed.emit(proceed);
  }

  onBackdropClick(): void {
    this.close(false);
  }

  getCategoryClass(): string {
    return this.service?.category || 'mid_complexity';
  }
}
