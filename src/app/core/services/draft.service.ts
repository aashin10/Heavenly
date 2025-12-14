import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ServiceAuthService } from './service-auth.service';

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
  private readonly serviceAuthService = inject(ServiceAuthService);
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
    
    // Refresh session on user activity to prevent session timeout
    this.serviceAuthService.refreshSession();
    
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
}
