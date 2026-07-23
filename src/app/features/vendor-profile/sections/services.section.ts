import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  SERVICE_CATEGORIES,
  SERVICES,
  ServiceCategory,
  Vendor,
} from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-profile-services',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <section class="section-card">
      <div class="section-header">
        <h2>Services Offered</h2>
        <p>
          Tenders are matched to these capabilities and areas — you only see
          opportunities you can actually serve.
        </p>
      </div>

      <h3 class="group-title">Service capabilities</h3>
      @for (category of categories; track category.id) {
        <div class="capability-group">
          <span class="capability-category">{{ category.label }}</span>
          <div class="capability-grid">
            @for (service of servicesFor(category.id); track service.id) {
              <label class="capability-item" [class.selected]="isSelected(service.id)">
                <input
                  type="checkbox"
                  [checked]="isSelected(service.id)"
                  (change)="toggle(service.id)"
                />
                <app-icon [name]="service.icon" [size]="18" />
                <span>{{ service.name }}</span>
              </label>
            }
          </div>
        </div>
      }

      <h3 class="group-title">Service areas</h3>
      <p class="field-hint">Cities or regions you operate in — e.g. New Delhi, Gurugram.</p>
      <div class="area-input-row">
        <input
          type="text"
          [(ngModel)]="areaInput"
          (keydown.enter)="addArea(); $event.preventDefault()"
          placeholder="Add a city or region"
          aria-label="Add a service area"
        />
        <button type="button" class="btn-outline" (click)="addArea()">
          <app-icon name="plus" [size]="16" /> Add
        </button>
      </div>
      <div class="chip-list">
        @for (area of areas(); track area) {
          <span class="chip">
            {{ area }}
            <button type="button" class="chip-remove" (click)="removeArea(area)"
                    [attr.aria-label]="'Remove ' + area">
              <app-icon name="x" [size]="14" />
            </button>
          </span>
        }
      </div>

      <div class="save-bar">
        <button type="button" class="btn-primary" [disabled]="!dirty()" (click)="save()">
          Save Services
        </button>
      </div>
    </section>
  `,
  styles: [
    `
      .group-title {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text);
        margin: var(--space-6) 0 var(--space-2);

        &:first-of-type {
          margin-top: 0;
        }
      }

      .capability-group {
        margin-bottom: var(--space-4);
      }

      .capability-category {
        display: block;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-subtle);
        margin-bottom: var(--space-2);
      }

      .capability-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: var(--space-2);
      }

      .capability-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        color: var(--text-muted);
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;

        input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        app-icon {
          color: var(--gray-400);
          flex: none;
        }

        &:hover {
          border-color: var(--navy-200);
        }

        &.selected {
          background-color: var(--navy-50);
          border-color: var(--navy-600);
          color: var(--navy-800);

          app-icon {
            color: var(--navy-700);
          }
        }
      }

      .area-input-row {
        display: flex;
        gap: var(--space-2);
        margin: var(--space-3) 0;

        input {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);

          &:focus {
            outline: none;
            border-color: var(--navy-600);
            box-shadow: var(--ring-brand);
          }
        }

        .btn-outline {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
        }
      }
    `,
  ],
  styleUrls: ['./section.shared.scss'],
})
export class ServicesSectionComponent {
  @Input({ required: true }) set vendor(value: Vendor) {
    this.selected.set(new Set(value.serviceCapabilities ?? []));
    this.areas.set([...(value.serviceAreas ?? [])]);
    this.dirty.set(false);
  }
  @Output() saved = new EventEmitter<void>();

  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  readonly categories = Object.values(SERVICE_CATEGORIES);

  selected = signal<Set<string>>(new Set());
  areas = signal<string[]>([]);
  dirty = signal(false);
  areaInput = '';

  servicesFor(category: ServiceCategory) {
    return SERVICES.filter(s => s.category === category);
  }

  isSelected(serviceId: string): boolean {
    return this.selected().has(serviceId);
  }

  toggle(serviceId: string): void {
    this.selected.update(set => {
      const next = new Set(set);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
    this.dirty.set(true);
  }

  addArea(): void {
    const area = this.areaInput.trim();
    if (!area) return;
    if (this.areas().some(a => a.toLowerCase() === area.toLowerCase())) {
      this.areaInput = '';
      return;
    }
    this.areas.update(list => [...list, area]);
    this.areaInput = '';
    this.dirty.set(true);
  }

  removeArea(area: string): void {
    this.areas.update(list => list.filter(a => a !== area));
    this.dirty.set(true);
  }

  save(): void {
    if (this.selected().size === 0) {
      this.toastService.error('Select at least one service capability.');
      return;
    }
    if (this.areas().length === 0) {
      this.toastService.error('Add at least one service area.');
      return;
    }

    this.serviceAuthService.updateVendorProfile({
      serviceCapabilities: [...this.selected()],
      serviceAreas: this.areas(),
    });
    this.dirty.set(false);
    this.toastService.success('Services saved.');
    this.saved.emit();
  }
}
