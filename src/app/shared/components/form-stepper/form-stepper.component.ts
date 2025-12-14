import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface StepItem {
  label: string;
  isComplete: boolean;
  isActive: boolean;
}

@Component({
  selector: 'app-form-stepper',
  standalone: true,
  template: `
    <nav class="stepper" role="navigation" aria-label="Form progress">
      <ol class="stepper-list">
        @for (step of stepItems; track step; let i = $index) {
          <li 
            class="stepper-item"
            [class.active]="i + 1 === currentStep"
            [class.completed]="i + 1 < currentStep"
            [class.clickable]="i + 1 < currentStep"
            (click)="onStepClick(i + 1)"
            (keydown.enter)="onStepClick(i + 1)"
            [attr.tabindex]="i + 1 < currentStep ? 0 : -1"
            role="button"
            [attr.aria-current]="i + 1 === currentStep ? 'step' : null"
          >
            <div class="step-indicator">
              @if (i + 1 < currentStep) {
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else {
                <span class="step-number">{{ i + 1 }}</span>
              }
            </div>
            <span class="step-label">{{ step }}</span>
            @if (i < steps.length - 1) {
              <div class="step-connector"></div>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    .stepper {
      padding: 1rem 0;
      margin-bottom: 1.5rem;
    }

    .stepper-list {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    .stepper-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
      text-align: center;
      
      &.clickable {
        cursor: pointer;
        
        &:hover .step-indicator {
          transform: scale(1.1);
        }
      }
    }

    .step-indicator {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      background: var(--gray-200);
      color: var(--gray-500);
      transition: all 0.2s ease;
      position: relative;
      z-index: 1;

      .completed & {
        background: var(--green-600);
        color: white;
      }

      .active & {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 0 0 4px rgba(0, 54, 100, 0.2);
      }
    }

    .check-icon {
      width: 18px;
      height: 18px;
    }

    .step-label {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--gray-500);
      max-width: 100px;
      line-height: 1.3;

      .active & {
        color: var(--primary-color);
        font-weight: 600;
      }

      .completed & {
        color: var(--green-700);
      }
    }

    .step-connector {
      position: absolute;
      top: 20px;
      left: calc(50% + 25px);
      width: calc(100% - 50px);
      height: 2px;
      background: var(--gray-200);

      .completed & {
        background: var(--green-600);
      }
    }

    @media (max-width: 768px) {
      .step-label {
        display: none;
      }

      .step-indicator {
        width: 32px;
        height: 32px;
        font-size: 0.75rem;
      }

      .step-connector {
        top: 16px;
        left: calc(50% + 20px);
        width: calc(100% - 40px);
      }
    }
  `]
})
export class FormStepperComponent {
  @Input() steps: string[] = [];
  @Input() currentStep = 1;
  @Output() stepChange = new EventEmitter<number>();

  get stepItems(): string[] {
    return this.steps;
  }

  onStepClick(step: number): void {
    // Only allow navigating to completed steps
    if (step < this.currentStep) {
      this.stepChange.emit(step);
    }
  }
}
