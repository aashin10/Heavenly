import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  requester = signal<ServiceRequester | null>(null);
  form!: FormGroup;

  readonly typeLabel = computed(() => humanizeEnum(this.requester()?.requesterType ?? ''));
  readonly isIndividual = computed(() => this.requester()?.requesterType === 'individual');
  readonly isOrganization = computed(() => {
    const t = this.requester()?.requesterType;
    return t === 'sme' || t === 'large_organization';
  });
  readonly gstRequired = computed(() => this.requester()?.requesterType === 'large_organization');

  ngOnInit(): void {
    const session = this.serviceAuthService.getCurrentUserSession();
    if (session?.userType !== 'service_requester') {
      this.router.navigate(['/login']);
      return;
    }
    const requester = this.serviceAuthService.getCurrentUser() as ServiceRequester;
    if (!requester) {
      this.router.navigate(['/login']);
      return;
    }
    this.requester.set(requester);
    this.buildForm(requester);
  }

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
      businessAddress: [r.requesterType === 'sme' ? r.businessAddress : ''],
      registeredAddress: [r.requesterType === 'large_organization' ? r.registeredAddress : ''],
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

  save(): void {
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
        typed['businessAddress'] = v.businessAddress;
      } else {
        typed['registeredAddress'] = v.registeredAddress;
        typed['department'] = v.department;
      }
    }

    this.serviceAuthService.updateServiceRequesterProfile(updates);
    this.requester.set(this.serviceAuthService.getCurrentUser() as ServiceRequester);
    this.form.markAsPristine();
    this.toastService.success('Profile updated.');
  }
}
