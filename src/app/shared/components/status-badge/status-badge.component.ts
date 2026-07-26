import { Component, Input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** The six visual tones a status can take. */
type Tone = 'neutral' | 'info' | 'attention' | 'positive' | 'negative' | 'brand';

interface StatusConfig {
  label: string;
  tone: Tone;
}

/**
 * Every status string the app can render, in one place.
 *
 * Covers the jobs portal (`pending`/`approved`/`rejected`), service requests,
 * tenders and bids. Keys are normalized to snake_case on lookup, so
 * `under-review` and `under_review` resolve to the same entry.
 */
const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Service requests
  submitted: { label: 'Submitted', tone: 'neutral' },
  under_review: { label: 'Under Review', tone: 'info' },
  changes_required: { label: 'Changes Required', tone: 'attention' },
  approved: { label: 'Approved', tone: 'positive' },
  published: { label: 'Published', tone: 'brand' },
  closed: { label: 'Closed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'negative' },

  // Jobs portal
  pending: { label: 'Pending Approval', tone: 'attention' },

  // Clarifications
  answered: { label: 'Answered', tone: 'positive' },
  forwarded: { label: 'Forwarded', tone: 'info' },

  // Tenders
  draft: { label: 'Draft', tone: 'neutral' },
  live: { label: 'Live', tone: 'brand' },
  cancelled: { label: 'Cancelled', tone: 'negative' },
  sealed: { label: 'Sealed', tone: 'info' },
  opened: { label: 'Opened', tone: 'info' },

  // Bids
  shortlisted: { label: 'Shortlisted', tone: 'attention' },
  awarded: { label: 'Awarded', tone: 'positive' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'positive' },

  // Evaluation
  qualified: { label: 'Qualified', tone: 'positive' },
  disqualified: { label: 'Disqualified', tone: 'negative' },
  not_started: { label: 'Not Started', tone: 'neutral' },
  in_progress: { label: 'In Progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'positive' },
  verified: { label: 'Verified', tone: 'positive' },
  suspended: { label: 'Suspended', tone: 'negative' },

  // Bid-window state, shown on tender detail
  open_for_bidding: { label: 'Open for Bidding', tone: 'positive' },
  closing_soon: { label: 'Closing Soon', tone: 'attention' },
  bidding_closed: { label: 'Bidding Closed', tone: 'neutral' },
  ready_to_publish: { label: 'Ready to Publish', tone: 'positive' },
};

/** Icon per tone — matches what the hand-rolled badges used before consolidation. */
const TONE_ICON: Record<Tone, string> = {
  neutral: 'file-text',
  info: 'eye',
  attention: 'clock',
  positive: 'circle-check',
  negative: 'circle-x',
  brand: 'circle-check',
};

const FALLBACK: StatusConfig = { label: 'Unknown', tone: 'neutral' };

/**
 * The single status chip for the whole app.
 *
 * Before this was applied everywhere, five screens hand-rolled their own badge
 * markup and SCSS, which is why the same bid could read as a blue "Under
 * Review" pill on one screen and purple sentence-case text on another.
 *
 * Usage: <app-status-badge status="shortlisted" />
 *        <app-status-badge status="approved" [showIcon]="true" />
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [IconComponent],
  template: `
    <span class="status-badge" [class]="'tone--' + config.tone">
      @if (showIcon) {
        <app-icon [name]="icon" [size]="12" [strokeWidth]="2.5" />
      }
      {{ label || config.label }}
    </span>
  `,
  styles: [
    `
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1, 0.25rem);
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: var(--text-xs, 0.75rem);
        font-weight: var(--font-semibold, 600);
        line-height: 1.4;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        white-space: nowrap;
      }

      .tone--neutral {
        background-color: var(--gray-100);
        color: var(--gray-700);
      }
      .tone--info {
        background-color: var(--info-bg);
        color: var(--info-fg);
      }
      .tone--attention {
        background-color: var(--warning-bg);
        color: var(--warning-fg);
      }
      .tone--positive {
        background-color: var(--success-bg);
        color: var(--success-fg);
      }
      .tone--negative {
        background-color: var(--danger-bg);
        color: var(--danger-fg);
      }
      /* "published" / "live" — brand navy rather than an off-palette purple. */
      .tone--brand {
        background-color: var(--navy-50);
        color: var(--navy-700);
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input()
  set status(value: string) {
    const key = (value ?? '').toLowerCase().replace(/-/g, '_');
    this.config = STATUS_CONFIG[key] ?? { ...FALLBACK, label: value || FALLBACK.label };
    this.icon = TONE_ICON[this.config.tone];
  }

  /** Icon-and-label variant, used where the badge carries the row's meaning. */
  @Input() showIcon = false;

  /**
   * Overrides the mapped text while keeping the tone. For audience-specific
   * wording only — a vendor sees their own losing bid as "Not Selected" where
   * management sees the same status as "Rejected".
   */
  @Input() label?: string;

  protected config: StatusConfig = STATUS_CONFIG['submitted'];
  protected icon = TONE_ICON['neutral'];
}
