import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServiceRequestApiService } from '../api/services-portal/service-request-api.service';
import { ServiceRequestDraftDto } from '../api/services-portal/service-request-api.models';
import { ServiceCategory } from '../models/service.model';

export interface ServiceRequestDraft {
  id: string;
  serviceId: string;
  serviceName: string;
  category: 'quick_service' | 'mid_complexity' | 'technical';
  formData: Record<string, unknown>;
  currentStep: number;
  totalSteps: number;
  lastSaved: Date;
  createdAt: Date;
  expiresAt: Date;
  /**
   * Set when this draft is an edit of a request the admin sent back
   * (`changes_required`). On submit the wizard resubmits that request rather
   * than creating a new one. See docs/backend/04-API-SERVICE-REQUESTS.md §7.
   */
  resubmitOfRequestId?: string;
}

export interface DraftRestoreResult {
  draft: ServiceRequestDraft;
  isExpired: boolean;
  daysRemaining: number;
}

const DRAFTS_STORAGE_KEY = 'heavenly_service_request_drafts';
const DRAFT_RETENTION_DAYS = 7;

@Injectable({
  providedIn: 'root'
})
export class DraftService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly serviceRequestApi = inject(ServiceRequestApiService);
  private currentDraftId: string | null = null;

  constructor() {
    // Cleanup expired drafts on service initialization
    this.cleanupExpiredDrafts();
  }

  /**
   * Generate a unique draft ID
   */
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Calculate expiration date (7 days from now)
   */
  private calculateExpirationDate(): Date {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + DRAFT_RETENTION_DAYS);
    return expiration;
  }

  /**
   * Get all drafts from localStorage
   */
  getAllDrafts(): ServiceRequestDraft[] {
    if (!isPlatformBrowser(this.platformId)) return [];

    try {
      const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (!stored) return [];

      const drafts: ServiceRequestDraft[] = JSON.parse(stored);
      
      // Convert date strings back to Date objects
      return drafts.map(draft => ({
        ...draft,
        lastSaved: new Date(draft.lastSaved),
        createdAt: new Date(draft.createdAt),
        expiresAt: new Date(draft.expiresAt)
      }));
    } catch {
      return [];
    }
  }

  /**
   * Save drafts to localStorage
   */
  private saveDraftsToStorage(drafts: ServiceRequestDraft[]): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Failed to save drafts to localStorage:', error);
    }
  }

  /**
   * Create or update a draft
   */
  saveDraft(draftData: Omit<ServiceRequestDraft, 'id' | 'lastSaved' | 'createdAt' | 'expiresAt'> & { id?: string }): string {
    const drafts = this.getAllDrafts();
    const now = new Date();

    let draftId: string;

    if (draftData.id) {
      // Update existing draft
      draftId = draftData.id;
      const existingIndex = drafts.findIndex(d => d.id === draftId);
      
      if (existingIndex >= 0) {
        drafts[existingIndex] = {
          ...drafts[existingIndex],
          ...draftData,
          id: draftId,
          lastSaved: now
        };
      } else {
        // Draft not found, create new
        const newDraft: ServiceRequestDraft = {
          ...draftData,
          id: draftId,
          lastSaved: now,
          createdAt: now,
          expiresAt: this.calculateExpirationDate()
        };
        drafts.push(newDraft);
      }
    } else {
      // Create new draft
      draftId = this.generateDraftId();
      const newDraft: ServiceRequestDraft = {
        ...draftData,
        id: draftId,
        lastSaved: now,
        createdAt: now,
        expiresAt: this.calculateExpirationDate()
      };
      drafts.push(newDraft);
    }

    this.currentDraftId = draftId;
    this.saveDraftsToStorage(drafts);
    return draftId;
  }

  /**
   * Get a specific draft by ID
   */
  getDraft(draftId: string): ServiceRequestDraft | null {
    const drafts = this.getAllDrafts();
    const draft = drafts.find(d => d.id === draftId);
    
    if (!draft) return null;

    // Check if expired
    if (new Date(draft.expiresAt) < new Date()) {
      this.clearDraft(draftId);
      return null;
    }

    return draft;
  }

  /**
   * Get draft by service ID (for checking if user has existing draft)
   */
  getDraftByServiceId(serviceId: string): ServiceRequestDraft | null {
    const drafts = this.getAllDrafts();
    const draft = drafts.find(d => d.serviceId === serviceId);
    
    if (!draft) return null;

    // Check if expired
    if (new Date(draft.expiresAt) < new Date()) {
      this.clearDraft(draft.id);
      return null;
    }

    return draft;
  }

  /**
   * Get draft restore result with additional info
   */
  getDraftRestoreInfo(draftId: string): DraftRestoreResult | null {
    const draft = this.getDraft(draftId);
    if (!draft) return null;

    const now = new Date();
    const expiresAt = new Date(draft.expiresAt);
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      draft,
      isExpired: daysRemaining <= 0,
      daysRemaining: Math.max(0, daysRemaining)
    };
  }

  /**
   * Delete a specific draft
   */
  clearDraft(draftId: string): void {
    const drafts = this.getAllDrafts();
    const filtered = drafts.filter(d => d.id !== draftId);
    this.saveDraftsToStorage(filtered);
    
    if (this.currentDraftId === draftId) {
      this.currentDraftId = null;
    }
  }

  /**
   * Delete all drafts for a specific service
   */
  clearDraftsByServiceId(serviceId: string): void {
    const drafts = this.getAllDrafts();
    const filtered = drafts.filter(d => d.serviceId !== serviceId);
    this.saveDraftsToStorage(filtered);
  }

  /**
   * Cleanup expired drafts
   */
  cleanupExpiredDrafts(): void {
    const drafts = this.getAllDrafts();
    const now = new Date();
    const validDrafts = drafts.filter(d => new Date(d.expiresAt) > now);

    if (validDrafts.length !== drafts.length) {
      this.saveDraftsToStorage(validDrafts);
    }
  }

  /**
   * Get the current active draft ID
   */
  getCurrentDraftId(): string | null {
    return this.currentDraftId;
  }

  /**
   * Set the current active draft ID
   */
  setCurrentDraftId(draftId: string): void {
    this.currentDraftId = draftId;
  }

  /**
   * Get count of active drafts
   */
  getDraftCount(): number {
    return this.getAllDrafts().length;
  }

  /**
   * Format last saved time for display
   */
  formatLastSaved(lastSaved: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(lastSaved).getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  // ==================== real API (behind environment.useRealApi) ====================
  //
  // The backend has no "get draft by its own id" lookup — only by serviceId,
  // which is also what enforces the one-draft-per-service rule server-side.
  // So in real-API mode the "key" this service hands back and accepts IS the
  // serviceId, not a generated row id. Every call site already treats a
  // draft's `id` as an opaque handle, so this substitution is invisible to
  // callers — it just means the handle is stable and human-readable instead
  // of a UUID.

  /** Create-or-update the caller's draft for a service. Returns the draft's handle. */
  async saveDraftAsync(
    draftData: Omit<ServiceRequestDraft, 'id' | 'lastSaved' | 'createdAt' | 'expiresAt'> & { id?: string }
  ): Promise<string> {
    if (!environment.useRealApi) {
      return this.saveDraft(draftData);
    }

    const dto = await firstValueFrom(
      this.serviceRequestApi.saveDraft(draftData.serviceId, {
        serviceName: draftData.serviceName,
        category: draftData.category,
        currentStep: draftData.currentStep,
        totalSteps: draftData.totalSteps,
        formData: draftData.formData,
        resubmitOfRequestId: draftData.resubmitOfRequestId,
      })
    );
    this.currentDraftId = dto.serviceId;
    return dto.serviceId;
  }

  /** Resume lookup by the draft's handle (a serviceId in real-API mode). */
  async getDraftAsync(key: string): Promise<ServiceRequestDraft | null> {
    if (!environment.useRealApi) {
      return this.getDraft(key);
    }
    return this.getDraftByServiceIdAsync(key);
  }

  /** Resume lookup by serviceId — the check the wizard runs before starting fresh. */
  async getDraftByServiceIdAsync(serviceId: string): Promise<ServiceRequestDraft | null> {
    if (!environment.useRealApi) {
      return this.getDraftByServiceId(serviceId);
    }

    try {
      const dto = await firstValueFrom(this.serviceRequestApi.getDraft(serviceId));
      return mapDraftDto(dto);
    } catch {
      return null;
    }
  }

  /** Every unexpired draft belonging to the caller. */
  async getAllDraftsAsync(): Promise<ServiceRequestDraft[]> {
    if (!environment.useRealApi) {
      return this.getAllDrafts();
    }
    const dtos = await firstValueFrom(this.serviceRequestApi.getDrafts());
    return dtos.map(mapDraftDto);
  }

  /** Discards a draft by its handle — "start over" in the wizard. */
  async clearDraftAsync(key: string): Promise<void> {
    if (!environment.useRealApi) {
      this.clearDraft(key);
      return;
    }
    await firstValueFrom(this.serviceRequestApi.deleteDraft(key));
    if (this.currentDraftId === key) {
      this.currentDraftId = null;
    }
  }
}

function mapDraftDto(dto: ServiceRequestDraftDto): ServiceRequestDraft {
  return {
    id: dto.serviceId,
    serviceId: dto.serviceId,
    serviceName: dto.serviceName,
    category: dto.category as ServiceCategory,
    formData: dto.formData,
    currentStep: dto.currentStep,
    totalSteps: dto.totalSteps,
    lastSaved: new Date(dto.lastSaved),
    createdAt: new Date(dto.createdAt),
    expiresAt: new Date(dto.expiresAt),
    resubmitOfRequestId: dto.resubmitOfRequestId ?? undefined,
  };
}
