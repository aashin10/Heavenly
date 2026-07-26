import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { PortfolioEntry, Vendor } from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { generateUniqueId } from '../../../shared/utils/helpers';

@Component({
  selector: 'app-profile-portfolio',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, EmptyStateComponent],
  template: `
    <section class="section-card">
      <div class="section-header">
        <h2>Portfolio</h2>
        <p>
          Past projects shown to Heavenly's team during bid evaluation — real,
          verifiable work wins tenders.
        </p>
      </div>

      @if (entries().length === 0 && !showForm()) {
        <app-empty-state
          icon="briefcase"
          title="No portfolio entries yet"
          message="Add a past project to strengthen your bids." />
      }

      @if (entries().length > 0) {
        <div class="entry-list">
          @for (entry of entries(); track entry.id) {
            <article class="entry-card">
              <div class="entry-head">
                <h3>{{ entry.title }}</h3>
                <button type="button" class="entry-remove" (click)="remove(entry.id)"
                        [attr.aria-label]="'Remove ' + entry.title">
                  <app-icon name="x" [size]="16" />
                </button>
              </div>
              <p class="entry-meta">
                {{ entry.year }}@if (entry.clientName) {<span> · {{ entry.clientName }}</span>}
              </p>
              <p class="entry-description">{{ entry.description }}</p>
            </article>
          }
        </div>
      }

      @if (showForm()) {
        <form [formGroup]="form" (ngSubmit)="addEntry()" class="entry-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="pf-title" class="required">Project Title</label>
              <input id="pf-title" type="text" formControlName="title"
                     placeholder="e.g., 250 kVA transformer rewinding — DMRC depot"
                     [class.invalid]="isInvalid('title')" />
              @if (isInvalid('title')) {
                <span class="error-text">Title is required</span>
              }
            </div>

            <div class="form-group">
              <label for="pf-year" class="required">Year</label>
              <input id="pf-year" type="number" formControlName="year"
                     [min]="1980" [max]="currentYear"
                     [class.invalid]="isInvalid('year')" />
              @if (isInvalid('year')) {
                <span class="error-text">Enter a year between 1980 and {{ currentYear }}</span>
              }
            </div>

            <div class="form-group">
              <label for="pf-client">Client Name</label>
              <input id="pf-client" type="text" formControlName="clientName"
                     placeholder="Optional" />
            </div>

            <div class="form-group full-width">
              <label for="pf-description" class="required">Description</label>
              <textarea id="pf-description" formControlName="description" rows="3"
                        placeholder="Scope, outcome, anything an evaluator should know"
                        [class.invalid]="isInvalid('description')"></textarea>
              @if (isInvalid('description')) {
                <span class="error-text">Describe the project (at least 20 characters)</span>
              }
            </div>
          </div>

          <div class="save-bar">
            <button type="button" class="btn-ghost" (click)="cancelForm()">Cancel</button>
            <button type="submit" class="btn-primary">Add Entry</button>
          </div>
        </form>
      } @else {
        <div class="save-bar">
          <button type="button" class="btn-outline add-btn" (click)="showForm.set(true)">
            <app-icon name="plus" [size]="16" /> Add Project
          </button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .entry-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        margin-bottom: var(--space-4);
      }

      .entry-card {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: var(--space-4);
      }

      .entry-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);

        h3 {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text);
        }
      }

      .entry-remove {
        display: inline-flex;
        border: none;
        background: none;
        padding: var(--space-1);
        color: var(--gray-400);
        cursor: pointer;

        &:hover {
          color: var(--danger-solid);
        }
      }

      .entry-meta {
        font-size: var(--text-xs);
        color: var(--text-subtle);
        margin: var(--space-1) 0 var(--space-2);
      }

      .entry-description {
        font-size: var(--text-sm);
        color: var(--text-muted);
        line-height: var(--leading-normal);
        white-space: pre-line;
      }

      .entry-form {
        border-top: 1px solid var(--border);
        padding-top: var(--space-5);
      }

      .add-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
    `,
  ],
  styleUrls: ['./section.shared.scss'],
})
export class PortfolioSectionComponent {
  @Input({ required: true }) set vendor(value: Vendor) {
    this.entries.set([...(value.portfolio ?? [])]);
  }
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  readonly currentYear = new Date().getFullYear();

  entries = signal<PortfolioEntry[]>([]);
  showForm = signal(false);

  form: FormGroup = this.fb.group({
    title: ['', Validators.required],
    year: [this.currentYear, [Validators.required, Validators.min(1980), Validators.max(this.currentYear)]],
    clientName: [''],
    description: ['', [Validators.required, Validators.minLength(20)]],
  });

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  addEntry(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;
    const entry: PortfolioEntry = {
      id: generateUniqueId(),
      title: value.title,
      year: value.year,
      clientName: value.clientName || undefined,
      description: value.description,
    };

    const next = [...this.entries(), entry];
    this.entries.set(next);
    this.persist(next);
    this.form.reset({ year: this.currentYear });
    this.showForm.set(false);
    this.toastService.success('Portfolio entry added.');
  }

  remove(id: string): void {
    const next = this.entries().filter(e => e.id !== id);
    this.entries.set(next);
    this.persist(next);
    this.toastService.info('Portfolio entry removed.');
  }

  cancelForm(): void {
    this.form.reset({ year: this.currentYear });
    this.showForm.set(false);
  }

  private persist(entries: PortfolioEntry[]): void {
    this.serviceAuthService.updateVendorProfile({ portfolio: entries });
    this.saved.emit();
  }
}
