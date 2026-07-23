import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Standard empty / no-results state. Replaces ad-hoc "giant emoji + text"
 * blocks. Project any action button/link via content projection.
 *
 * <app-empty-state icon="inbox" title="No bids yet"
 *   message="Vendor bids will appear here once the tender is live.">
 *   <a class="btn-primary" routerLink="...">Browse tenders</a>
 * </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="empty-state">
      <span class="empty-state__icon">
        <app-icon [name]="icon" [size]="28" [strokeWidth]="1.75" />
      </span>
      <h3 class="empty-state__title">{{ title }}</h3>
      @if (message) {
        <p class="empty-state__message">{{ message }}</p>
      }
      <div class="empty-state__action">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 3rem 1.5rem;
      }
      .empty-state__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 4rem;
        height: 4rem;
        border-radius: var(--radius-full);
        background-color: var(--navy-50);
        color: var(--navy-600);
        margin-bottom: 1rem;
      }
      .empty-state__title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--gray-800);
        margin: 0;
      }
      .empty-state__message {
        margin: 0.5rem 0 0;
        font-size: var(--text-sm);
        color: var(--text-muted);
        max-width: 26rem;
        line-height: var(--leading-relaxed);
      }
      .empty-state__action:not(:empty) {
        margin-top: 1.25rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input({ required: true }) icon = 'inbox';
  @Input({ required: true }) title = '';
  @Input() message = '';
}
