import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Vendor } from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { maskAccountNumber } from '../../../shared/utils/vendor-profile-completion.util';

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

@Component({
  selector: 'app-profile-bank',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <section class="section-card">
      <div class="section-header">
        <h2>Bank Details</h2>
        <p>Used for payouts on awarded work. Your account number is stored masked.</p>
      </div>

      @if (!isEditing()) {
        <!-- Read view: masked, nothing sensitive on screen -->
        <dl class="bank-summary">
          <div class="bank-row">
            <dt>Account Holder</dt>
            <dd>{{ vendorValue().bankDetails.accountHolderName || '—' }}</dd>
          </div>
          <div class="bank-row">
            <dt>Account Number</dt>
            <dd>{{ maskedAccount() || '—' }}</dd>
          </div>
          <div class="bank-row">
            <dt>IFSC Code</dt>
            <dd>{{ vendorValue().bankDetails.ifscCode || '—' }}</dd>
          </div>
          <div class="bank-row">
            <dt>Bank Name</dt>
            <dd>{{ vendorValue().bankDetails.bankName || '—' }}</dd>
          </div>
        </dl>

        <div class="save-bar">
          <button type="button" class="btn-outline edit-btn" (click)="startEditing()">
            <app-icon name="pencil" [size]="16" />
            {{ hasBankDetails() ? 'Update Bank Details' : 'Add Bank Details' }}
          </button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <div class="form-group">
              <label for="accountHolderName" class="required">Account Holder Name</label>
              <input id="accountHolderName" type="text" formControlName="accountHolderName"
                     [class.invalid]="isInvalid('accountHolderName')" />
              @if (isInvalid('accountHolderName')) {
                <span class="error-text">Account holder name is required</span>
              }
            </div>

            <div class="form-group">
              <label for="accountNumber" class="required">Account Number</label>
              <input id="accountNumber" type="text" formControlName="accountNumber"
                     inputmode="numeric" autocomplete="off"
                     [class.invalid]="isInvalid('accountNumber')" />
              @if (isInvalid('accountNumber')) {
                <span class="error-text">Enter a 9–18 digit account number</span>
              }
              <span class="field-hint">Re-enter in full — the stored number is never shown.</span>
            </div>

            <div class="form-group">
              <label for="ifscCode" class="required">IFSC Code</label>
              <input id="ifscCode" type="text" formControlName="ifscCode"
                     placeholder="HDFC0001234" maxlength="11"
                     [class.invalid]="isInvalid('ifscCode')" />
              @if (isInvalid('ifscCode')) {
                <span class="error-text">Enter a valid IFSC code</span>
              }
            </div>

            <div class="form-group">
              <label for="bankName" class="required">Bank Name</label>
              <input id="bankName" type="text" formControlName="bankName"
                     [class.invalid]="isInvalid('bankName')" />
              @if (isInvalid('bankName')) {
                <span class="error-text">Bank name is required</span>
              }
            </div>
          </div>

          <div class="save-bar">
            <button type="button" class="btn-ghost" (click)="cancelEditing()">Cancel</button>
            <button type="submit" class="btn-primary">Save Bank Details</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: [
    `
      .bank-summary {
        display: flex;
        flex-direction: column;
      }

      .bank-row {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-3) 0;
        border-bottom: 1px solid var(--border);

        &:last-child {
          border-bottom: none;
        }

        dt {
          font-size: var(--text-sm);
          color: var(--text-subtle);
        }

        dd {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }
      }

      .edit-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
    `,
  ],
  styleUrls: ['./section.shared.scss'],
})
export class BankSectionComponent {
  @Input({ required: true }) set vendor(value: Vendor) {
    this.vendorValue.set(value);
  }
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  vendorValue = signal<Vendor>({} as Vendor);
  isEditing = signal(false);

  maskedAccount = computed(() =>
    maskAccountNumber(this.vendorValue().bankDetails?.accountNumber)
  );

  hasBankDetails = computed(() => {
    const bank = this.vendorValue().bankDetails;
    return !!(bank?.accountHolderName && bank.accountNumber && bank.ifscCode && bank.bankName);
  });

  form: FormGroup = this.fb.group({
    accountHolderName: ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{9,18}$/)]],
    ifscCode: ['', [Validators.required, Validators.pattern(IFSC_PATTERN)]],
    bankName: ['', Validators.required],
  });

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  startEditing(): void {
    const bank = this.vendorValue().bankDetails;
    // Prefill everything except the account number, which must be re-entered.
    this.form.reset({
      accountHolderName: bank?.accountHolderName ?? '',
      accountNumber: '',
      ifscCode: bank?.ifscCode ?? '',
      bankName: bank?.bankName ?? '',
    });
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Please fix the highlighted fields.');
      return;
    }

    const value = this.form.value;
    this.serviceAuthService.updateVendorProfile({
      bankDetails: {
        accountHolderName: value.accountHolderName,
        accountNumber: value.accountNumber,
        ifscCode: value.ifscCode.toUpperCase(),
        bankName: value.bankName,
      },
    });
    this.isEditing.set(false);
    this.toastService.success('Bank details saved.');
    this.saved.emit();
  }
}
