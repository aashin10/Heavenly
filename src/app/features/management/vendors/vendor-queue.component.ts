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
  protected readonly vendorAdmin = inject(VendorAdminService);

  readonly stats = this.vendorAdmin.queueStats;

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
    // Fire-and-forget: `filteredVendors` is a computed over the service's own
    // signal, so it re-renders when the load lands. Awaiting here would need
    // the component to be async and would gain nothing.
    //
    // Pass the current filter ('pending' by default), not an unfiltered
    // fetch — the real API returns one page, so an unfiltered load followed
    // by a local 'pending' filter would silently drop pending vendors sitting
    // past row 100, exactly the failure setFilter's own comment below warns
    // against. This keeps the initial load consistent with every later one.
    void this.vendorAdmin.refreshAsync(this.filter());
  }

  setFilter(value: VendorFilter): void {
    this.filter.set(value);

    // Against the real API the client holds one page, so filtering locally
    // would hide vendors that are simply on another page. Re-query instead;
    // in mock mode the whole set is already in memory and the computed filter
    // below is the whole story.
    if (this.vendorAdmin.useRealApi) {
      void this.vendorAdmin.refreshAsync(value);
    }
  }

  documentCount(vendor: Vendor): number {
    const docs = vendor.documentsUploaded ?? {};
    return Object.values(docs).filter(Boolean).length;
  }

  private time(d: Date | string | undefined): number {
    return d ? new Date(d).getTime() : 0;
  }
}
