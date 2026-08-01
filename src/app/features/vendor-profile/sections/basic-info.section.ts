import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Vendor, VendorBusinessType } from '../../../core/models/service.model';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

@Component({
  selector: 'app-profile-basic-info',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="section-card">
      <div class="section-header">
        <h2>Basic Information</h2>
        <p>Business identity and contact details, as they appear on your bids and invoices.</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="form-group">
            <label for="businessName" class="required">Business Name</label>
            <input id="businessName" type="text" formControlName="businessName"
                   [class.invalid]="isInvalid('businessName')" />
            @if (isInvalid('businessName')) {
              <span class="error-text">Business name is required</span>
            }
          </div>

          <div class="form-group">
            <label for="businessType" class="required">Business Type</label>
            <select id="businessType" formControlName="businessType">
              @for (type of businessTypes; track type.value) {
                <option [value]="type.value">{{ type.label }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label for="gstNumber" class="required">GST Number</label>
            <input id="gstNumber" type="text" formControlName="gstNumber"
                   placeholder="07AABCU9603R1ZM" maxlength="15"
                   [class.invalid]="isInvalid('gstNumber')" />
            @if (isInvalid('gstNumber')) {
              <span class="error-text">Enter a valid 15-character GSTIN</span>
            }
          </div>

          <div class="form-group">
            <label for="panNumber" class="required">PAN Number</label>
            <input id="panNumber" type="text" formControlName="panNumber"
                   placeholder="AABCU9603R" maxlength="10"
                   [class.invalid]="isInvalid('panNumber')" />
            @if (isInvalid('panNumber')) {
              <span class="error-text">Enter a valid 10-character PAN</span>
            }
          </div>

          <div class="form-group">
            <label for="yearEstablished" class="required">Year Established</label>
            <input id="yearEstablished" type="number" formControlName="yearEstablished"
                   [min]="1900" [max]="currentYear"
                   [class.invalid]="isInvalid('yearEstablished')" />
            @if (isInvalid('yearEstablished')) {
              <span class="error-text">Enter a year between 1900 and {{ currentYear }}</span>
            }
          </div>

          <div class="form-group">
            <label for="primaryContactPerson" class="required">Primary Contact Person</label>
            <input id="primaryContactPerson" type="text" formControlName="primaryContactPerson"
                   [class.invalid]="isInvalid('primaryContactPerson')" />
            @if (isInvalid('primaryContactPerson')) {
              <span class="error-text">Contact person is required</span>
            }
          </div>

          <div class="form-group">
            <label for="designation" class="required">Designation</label>
            <input id="designation" type="text" formControlName="designation"
                   [class.invalid]="isInvalid('designation')" />
            @if (isInvalid('designation')) {
              <span class="error-text">Designation is required</span>
            }
          </div>

          <div class="form-group">
            <label for="phone" class="required">Phone</label>
            <input id="phone" type="tel" formControlName="phone"
                   placeholder="+91 98765 43210"
                   [class.invalid]="isInvalid('phone')" />
            @if (isInvalid('phone')) {
              <span class="error-text">Phone number is required</span>
            }
          </div>

          <div class="form-group">
            <label for="alternatePhone">Alternate Phone</label>
            <input id="alternatePhone" type="tel" formControlName="alternatePhone" />
          </div>

          <div class="form-group full-width">
            <label for="registeredAddress" class="required">Registered Address</label>
            <textarea id="registeredAddress" formControlName="registeredAddress" rows="2"
                      [class.invalid]="isInvalid('registeredAddress')"></textarea>
            @if (isInvalid('registeredAddress')) {
              <span class="error-text">Registered address is required</span>
            }
          </div>

          <div class="form-group">
            <label for="city" class="required">City</label>
            <input id="city" type="text" formControlName="city"
                   [class.invalid]="isInvalid('city')" />
          </div>

          <div class="form-group">
            <label for="state" class="required">State</label>
            <input id="state" type="text" formControlName="state"
                   [class.invalid]="isInvalid('state')" />
          </div>

          <div class="form-group">
            <label for="pinCode" class="required">PIN Code</label>
            <input id="pinCode" type="text" formControlName="pinCode" maxlength="6"
                   [class.invalid]="isInvalid('pinCode')" />
            @if (isInvalid('pinCode')) {
              <span class="error-text">Enter a 6-digit PIN code</span>
            }
          </div>
        </div>

        <div class="save-bar">
          <button type="submit" class="btn-primary" [disabled]="form.pristine">Save Changes</button>
        </div>
      </form>
    </section>
  `,
  styleUrls: ['./section.shared.scss'],
})
export class BasicInfoSectionComponent implements OnInit {
  @Input({ required: true }) vendor!: Vendor;
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  readonly currentYear = new Date().getFullYear();

  readonly businessTypes: { value: VendorBusinessType; label: string }[] = [
    { value: 'individual_contractor', label: 'Individual Contractor' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'private_limited', label: 'Private Limited' },
    { value: 'llp', label: 'LLP' },
    { value: 'others', label: 'Others' },
  ];

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      businessName: [this.vendor.businessName ?? '', Validators.required],
      businessType: [this.vendor.businessType ?? 'others', Validators.required],
      gstNumber: [this.vendor.gstNumber ?? '', [Validators.required, Validators.pattern(GSTIN_PATTERN)]],
      panNumber: [this.vendor.panNumber ?? '', [Validators.required, Validators.pattern(PAN_PATTERN)]],
      yearEstablished: [
        this.vendor.yearEstablished ?? null,
        [Validators.required, Validators.min(1900), Validators.max(this.currentYear)],
      ],
      primaryContactPerson: [this.vendor.primaryContactPerson ?? '', Validators.required],
      designation: [this.vendor.designation ?? '', Validators.required],
      phone: [this.vendor.phone ?? '', Validators.required],
      alternatePhone: [this.vendor.alternatePhone ?? ''],
      registeredAddress: [this.vendor.registeredAddress ?? '', Validators.required],
      city: [this.vendor.city ?? '', Validators.required],
      state: [this.vendor.state ?? '', Validators.required],
      pinCode: [this.vendor.pinCode ?? '', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Please fix the highlighted fields.');
      return;
    }

    const value = this.form.value;
    await this.serviceAuthService.updateVendorProfileAsync({
      ...value,
      gstNumber: value.gstNumber?.toUpperCase(),
      panNumber: value.panNumber?.toUpperCase(),
    });
    this.form.markAsPristine();
    this.toastService.success('Basic information saved.');
    this.saved.emit();
  }
}
