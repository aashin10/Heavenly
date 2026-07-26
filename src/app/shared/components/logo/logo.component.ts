import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Brand logotype. Text uses `currentColor` so it adapts to light or dark
 * surfaces; the accent arc is fixed brand red. Set `variant="mark"` for the
 * icon-only mark (e.g. compact/mobile).
 *
 * NOTE: the mark below is a clean interim built from the brand's H + red arc.
 * Replace with the official vector artwork when available (swap the <svg>).
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo" [class.logo--mark-only]="variant === 'mark'">
      <svg
        class="logo__mark"
        [attr.width]="markSize"
        [attr.height]="markSize"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="38" height="38" rx="9" stroke="currentColor" stroke-width="2" opacity="0.9" />
        <path d="M12 11v18M28 11v18M12 20h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
        <path d="M7 24c7-8 19-8 26 0" stroke="var(--accent-600)" stroke-width="2.6" stroke-linecap="round" />
      </svg>
      @if (variant !== 'mark') {
        <span class="logo__text">
          <span class="logo__name">Heavenly</span>
          <span class="logo__sub">CORPORATION</span>
        </span>
      }
    </span>
  `,
  styles: [
    `
      .logo {
        display: inline-flex;
        align-items: center;
        gap: 0.625rem;
        color: currentColor;
      }
      .logo__mark {
        flex: none;
        display: block;
      }
      .logo__text {
        display: flex;
        flex-direction: column;
        line-height: 1;
      }
      .logo__name {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .logo__sub {
        font-size: 0.625rem;
        font-weight: 600;
        letter-spacing: 0.22em;
        opacity: 0.75;
        margin-top: 0.2rem;
      }
    `,
  ],
})
export class LogoComponent {
  @Input() variant: 'full' | 'mark' = 'full';
  @Input() markSize = 36;
}
