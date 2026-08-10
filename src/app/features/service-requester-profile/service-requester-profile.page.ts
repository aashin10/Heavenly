import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceAuthService } from '../../core/services/service-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ServiceRequester } from '../../core/models/service.model';
import { humanizeEnum } from '../../shared/utils/humanize.util';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Service-requester account profile. Mirrors the vendor profile editor's design
 * (navy header + card + reactive form) but is a single card — requesters have
 * far fewer fields than vendors. Renders type-specific fields for individual /
 * SME / large-organization requesters.
 */
@Component({
  selector: 'app-service-requester-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, AppDatePipe],
  templateUrl: './service-requester-profile.page.html',
  styleUrl: './service-requester-profile.page.scss',
})
export class ServiceRequesterProfilePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  // Reactive to the service's own signal (see the constructor) rather than a
  // locally-set one — the effect below only needs to build the form once the
  // profile arrives, not write it anywhere.
  requester = computed(() => this.serviceAuthService.serviceRequester());
  form!: FormGroup;

  readonly typeLabel = computed(() => humanizeEnum(this.requester()?.requesterType ?? ''));
  readonly isIndividual = computed(() => this.requester()?.requesterType === 'individual');
  readonly isOrganization = computed(() => {
    const t = this.requester()?.requesterType;
    return t === 'sme' || t === 'large_organization';
  });
  readonly gstRequired = computed(() => this.requester()?.requesterType === 'large_organization');

  private formBuilt = false;

  constructor() {
    // The route guard only checks the cached session, not that the async
    // real-API rehydration (GET /me) that follows a hard navigation has
    // finished — so the requester profile can still be null on the first
    // tick even for a legitimately logged-in user. Reacting to the signal
    // rather than snapshotting it once means the form builds whenever the
    // profile actually arrives, and only redirects if the session itself
    // turns out to be invalid (rehydration failure clears it).
    effect(() => {
      const session = this.serviceAuthService.currentUser();
      if (!session) {
        this.router.navigate(['/login']);
        return;
      }
      if (session.userType !== 'service_requester') {
        this.router.navigate(['/login']);
        return;
      }
      const requester = this.serviceAuthService.serviceRequester();
      if (requester && !this.formBuilt) {
        this.buildForm(requester);
        this.formBuilt = true;
      }
    });
  }

  ngOnInit(): void {}

  private buildForm(r: ServiceRequester): void {
    const gstValidators = [Validators.pattern(GSTIN_PATTERN)];
    if (r.requesterType === 'large_organization') gstValidators.push(Validators.required);

    this.form = this.fb.group({
      phone: [r.phone ?? '', Validators.required],
      city: [r.city ?? '', Validators.required],

      // Individual
      fullName: [r.requesterType === 'individual' ? r.fullName : '', this.req(r, 'individual')],
      address: [r.requesterType === 'individual' ? (r.address ?? '') : ''],

      // Organization (SME + large org)
      organizationName: [this.orgField(r, 'organizationName'), this.reqOrg(r)],
      gstNumber: [this.orgField(r, 'gstNumber'), gstValidators],
      // businessAddress/registeredAddress are separate controls only so the
      // template can label + show one of them per requester type (see the
      // @if's in the .html); the model has a single `address` field (F10),
      // so both controls read from and write back to r.address / v.address's
      // counterpart in save() below — not a typo, and not two model fields.
      businessAddress: [r.requesterType === 'sme' ? r.address : ''],
      registeredAddress: [r.requesterType === 'large_organization' ? r.address : ''],
      authorizedPersonName: [this.orgField(r, 'authorizedPersonName'), this.reqOrg(r)],
      designation: [this.orgField(r, 'designation'), this.reqOrg(r)],
      department: [r.requesterType === 'large_organization' ? (r.department ?? '') : ''],
    });
  }

  private req(r: ServiceRequester, type: string) {
    return r.requesterType === type ? [Validators.required] : [];
  }
  private reqOrg(r: ServiceRequester) {
    return r.requesterType === 'sme' || r.requesterType === 'large_organization'
      ? [Validators.required]
      : [];
  }
  private orgField(r: ServiceRequester, field: string): string {
    return (r as unknown as Record<string, string>)[field] ?? '';
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  async save(): Promise<void> {
    const r = this.requester();
    if (!r) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Please fix the highlighted fields.');
      return;
    }

    const v = this.form.value;
    // Only persist the fields relevant to this requester's type.
    const updates: Partial<ServiceRequester> = { phone: v.phone, city: v.city } as Partial<ServiceRequester>;
    const typed = updates as Record<string, unknown>;

    if (r.requesterType === 'individual') {
      typed['fullName'] = v.fullName;
      typed['address'] = v.address;
    } else {
      typed['organizationName'] = v.organizationName;
      typed['gstNumber'] = v.gstNumber ? v.gstNumber.toUpperCase() : v.gstNumber;
      typed['authorizedPersonName'] = v.authorizedPersonName;
      typed['designation'] = v.designation;
      if (r.requesterType === 'sme') {
        typed['address'] = v.businessAddress;
      } else {
        typed['address'] = v.registeredAddress;
        typed['department'] = v.department;
      }
    }

    // requester is reactive to the service's own signal, which the update
    // call already refreshes — nothing to set here.
    await this.serviceAuthService.updateServiceRequesterProfileAsync(updates);
    this.form.markAsPristine();
    this.toastService.success('Profile updated.');
  }
}
