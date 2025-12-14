import { Component, Input, signal } from '@angular/core';

@Component({
  selector: 'app-collapsible-section',
  standalone: true,
  template: `
    <div class="collapsible-section" [class.expanded]="isExpanded()">
      <button 
        type="button"
        class="section-header" 
        (click)="toggle()"
        [attr.aria-expanded]="isExpanded()"
      >
        <span class="section-title">{{ title }}</span>
        <span class="toggle-icon" aria-hidden="true">
          @if (isExpanded()) {
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          }
        </span>
      </button>
      @if (isExpanded()) {
        <div class="section-content">
          <ng-content></ng-content>
        </div>
      }
    </div>
  `,
  styles: [`
    .collapsible-section {
      border: 1px solid var(--gray-200);
      border-radius: 0.5rem;
      overflow: hidden;
      margin-bottom: 0.75rem;
      background: var(--white);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0.875rem 1rem;
      background: var(--gray-50);
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: background-color 0.2s;

      &:hover {
        background: var(--gray-100);
      }
    }

    .section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--gray-700);
    }

    .toggle-icon {
      color: var(--gray-500);
      display: flex;
      align-items: center;
    }

    .section-content {
      padding: 1rem;
      border-top: 1px solid var(--gray-200);
    }
  `]
})
export class CollapsibleSectionComponent {
  @Input() title: string = '';
  @Input() set expanded(value: boolean) {
    this.isExpanded.set(value);
  }

  isExpanded = signal(false);

  toggle(): void {
    this.isExpanded.update(v => !v);
  }
}
