import { Component, Input, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { DraftService } from '../../../core/services/draft.service';

@Component({
  selector: 'app-form-progress',
  standalone: true,
  template: `
    <div class="form-progress">
      <div class="progress-info">
        <div class="progress-text">
          <span class="progress-label">Progress:</span>
          <span class="progress-value">{{ progress }}% complete</span>
        </div>
        @if (lastSaved) {
          <div class="last-saved">
            <svg class="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Last saved: {{ formattedLastSaved() }}</span>
          </div>
        }
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" [style.width.%]="progress"></div>
      </div>
    </div>
  `,
  styles: [`
    .form-progress {
      background: white;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 1rem;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .progress-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .progress-label {
      font-size: 0.875rem;
      color: var(--gray-600);
    }

    .progress-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--primary-color);
    }

    .last-saved {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--gray-500);
    }

    .save-icon {
      width: 14px;
      height: 14px;
      color: var(--green-600);
    }

    .progress-bar-container {
      height: 6px;
      background: var(--gray-200);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
      border-radius: 3px;
      transition: width 0.3s ease;
    }
  `]
})
export class FormProgressComponent implements OnInit, OnDestroy {
  @Input() progress = 0;
  @Input() lastSaved: Date | null = null;

  private readonly draftService = inject(DraftService);
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly updateTrigger = signal(0);

  formattedLastSaved = computed(() => {
    // Access trigger to force recomputation
    this.updateTrigger();
    
    if (!this.lastSaved) return '';
    return this.draftService.formatLastSaved(this.lastSaved);
  });

  ngOnInit(): void {
    // Update the "last saved" text every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateTrigger.update(v => v + 1);
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
