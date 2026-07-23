import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Vendor, VendorDocuments } from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface DocumentSlot {
  key: keyof VendorDocuments;
  label: string;
  required: boolean;
  hint: string;
}

@Component({
  selector: 'app-profile-documents',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="section-card">
      <div class="section-header">
        <h2>Business Documents</h2>
        <p>
          Business certificate and GST certificate are required for verification.
          Accepted: PDF, JPG or PNG, up to 5&nbsp;MB.
        </p>
      </div>

      <div class="document-list">
        @for (slot of slots; track slot.key) {
          <div class="document-row">
            <div class="document-info">
              <span class="document-icon">
                <app-icon [name]="uploaded()[slot.key] ? 'circle-check' : 'file-text'" [size]="20" />
              </span>
              <div>
                <span class="document-label" [class.required]="slot.required">{{ slot.label }}</span>
                <span class="field-hint">{{ slot.hint }}</span>
              </div>
            </div>

            <div class="document-action">
              @if (uploaded()[slot.key]; as fileName) {
                <span class="chip">
                  {{ fileName }}
                  <button type="button" class="chip-remove" (click)="remove(slot.key)"
                          [attr.aria-label]="'Remove ' + slot.label">
                    <app-icon name="x" [size]="14" />
                  </button>
                </span>
              } @else {
                <label class="btn-outline upload-btn">
                  <app-icon name="upload" [size]="16" />
                  Upload
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
                         (change)="onFileSelected($event, slot.key)" />
                </label>
              }
            </div>
          </div>
        }
      </div>

      <div class="save-bar">
        <button type="button" class="btn-primary" [disabled]="!isDirty()" (click)="save()">
          Save Documents
        </button>
      </div>
    </section>
  `,
  styles: [
    `
      .document-list {
        display: flex;
        flex-direction: column;
      }

      .document-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-4) 0;
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;

        &:last-child {
          border-bottom: none;
        }
      }

      .document-info {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .document-icon {
        display: inline-flex;
        color: var(--gray-400);

        &:has(+ div) {
          flex: none;
        }
      }

      .document-row:has(.chip) .document-icon {
        color: var(--success-solid);
      }

      .document-label {
        display: block;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text);

        &.required::after {
          content: ' *';
          color: var(--danger-fg);
        }
      }

      .upload-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-4);
      }
    `,
  ],
  styleUrls: ['./section.shared.scss'],
})
export class DocumentsSectionComponent {
  @Input({ required: true }) set vendor(value: Vendor) {
    this.uploaded.set({ ...(value.documentsUploaded ?? {}) });
    this.dirty.set(false);
  }
  @Output() saved = new EventEmitter<void>();

  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  readonly slots: DocumentSlot[] = [
    { key: 'businessCertificate', label: 'Business Certificate', required: true, hint: 'Registration / incorporation certificate' },
    { key: 'gstCertificate', label: 'GST Certificate', required: true, hint: 'GSTIN registration certificate' },
    { key: 'tradeLicense', label: 'Trade License', required: false, hint: 'Municipal trade license, if held' },
    { key: 'insuranceCertificate', label: 'Insurance Certificate', required: false, hint: 'Liability / workmen insurance, if held' },
  ];

  uploaded = signal<VendorDocuments>({});
  private dirty = signal(false);

  isDirty(): boolean {
    return this.dirty();
  }

  onFileSelected(event: Event, key: keyof VendorDocuments): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.toastService.error('File is larger than 5 MB.');
      input.value = '';
      return;
    }

    // Mock upload: the file name stands in for the stored object until the
    // upload API exists (docs/backend/01-API-AUTH.md, file upload section).
    this.uploaded.update(docs => ({ ...docs, [key]: file.name }));
    this.dirty.set(true);
    input.value = '';
  }

  remove(key: keyof VendorDocuments): void {
    this.uploaded.update(docs => {
      const next = { ...docs };
      delete next[key];
      return next;
    });
    this.dirty.set(true);
  }

  save(): void {
    this.serviceAuthService.updateVendorProfile({ documentsUploaded: this.uploaded() });
    this.dirty.set(false);
    this.toastService.success('Documents saved.');
    this.saved.emit();
  }
}
