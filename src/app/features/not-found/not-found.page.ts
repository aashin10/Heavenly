import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

/**
 * Real 404. Replaces the old `path: '**' → redirectTo: ''`, whose silent
 * bounce to the homepage let fourteen dead links ship undetected
 * (docs/UI_ISSUES.md §1) — a missing page must fail loudly.
 */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="not-found">
      <div class="not-found-card">
        <p class="code" aria-hidden="true">404</p>
        <h1>Page not found</h1>
        <p class="message">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div class="actions">
          <a routerLink="/" class="btn-primary">
            <app-icon name="house" [size]="16" /> Back to Home
          </a>
          <a routerLink="/services" class="btn-outline">Browse Services</a>
          <a routerLink="/contact" class="btn-ghost">Contact Us</a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .not-found {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-16) var(--space-4);
        background-color: var(--surface-muted);
      }

      .not-found-card {
        text-align: center;
        max-width: 28rem;
      }

      .code {
        font-size: var(--text-5xl);
        font-weight: var(--font-bold);
        color: var(--navy-200);
        letter-spacing: 0.05em;
      }

      h1 {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--text);
        margin: var(--space-2) 0;
      }

      .message {
        color: var(--text-muted);
        margin-bottom: var(--space-6);
        line-height: var(--leading-normal);
      }

      .actions {
        display: flex;
        justify-content: center;
        gap: var(--space-3);
        flex-wrap: wrap;

        a {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          text-decoration: none;
        }
      }
    `,
  ],
})
export class NotFoundPageComponent {}
