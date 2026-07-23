import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VendorAdminService } from '../../../core/services/vendor-admin.service';
import { Vendor, VendorStatus } from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';

type VendorFilter = VendorStatus | 'all';

@Component({
  selector: 'app-vendor-queue',
  standalone: true,
  imports: [RouterLink, IconComponent, StatusBadgeComponent, EmptyStateComponent, AppDatePipe],
  templateUrl: './vendor-queue.component.html',
  styleUrl: './vendor-queue.component.scss',
})
export class VendorQueueComponent implements OnInit {
  private readonly vendorAdmin = inject(VendorAdminService);

  readonly stats = this.vendorAdmin.stats;

  readonly filterOptions: { value: VendorFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'verified', label: 'Verified' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'all', label: 'All Vendors' },
  ];

  filter = signal<VendorFilter>('pending');

  filteredVendors = computed<Vendor[]>(() => {
    const all = this.vendorAdmin.vendors();
    const f = this.filter();
    const list = f === 'all' ? all : all.filter(v => v.verificationStatus === f);
    // Oldest registration first — the queue works front-to-back.
    return [...list].sort((a, b) => this.time(a.createdAt) - this.time(b.createdAt));
  });

  ngOnInit(): void {
    // A vendor may have registered since this admin last opened the tab.
    this.vendorAdmin.refresh();
  }

  setFilter(value: VendorFilter): void {
    this.filter.set(value);
  }

  documentCount(vendor: Vendor): number {
    const docs = vendor.documentsUploaded ?? {};
    return Object.values(docs).filter(Boolean).length;
  }

  private time(d: Date | string | undefined): number {
    return d ? new Date(d).getTime() : 0;
  }
}
