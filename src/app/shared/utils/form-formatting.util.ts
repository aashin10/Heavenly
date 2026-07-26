import { ServiceRequestDraft } from '../../core/services/draft.service';
import { ServiceCategory } from '../../core/models/service.model';
import { FORM_CONFIGS } from '../../features/service-request/service-request.model';
import { formatAppDate } from './date-format.util';

export interface PreviewField {
  label: string;
  value: string;
  type: 'text' | 'list' | 'file';
}

export interface PreviewSection {
  title: string;
  stepNumber: number;
  fields: PreviewField[];
}

export function formatFormData(draft: ServiceRequestDraft): PreviewSection[] {
  return formatCategoryFormData(draft.category, draft.formData, draft.totalSteps);
}

/**
 * Same read-back as {@link formatFormData}, but from the category + form data
 * directly — used by the request-detail screen, which renders a submitted
 * request (a `ServiceRequestSubmission`, which has no `totalSteps`).
 */
export function formatCategoryFormData(
  category: ServiceCategory,
  rawFormData: Record<string, unknown>,
  totalSteps?: number
): PreviewSection[] {
  const formData = rawFormData as Record<string, Record<string, unknown>>;
  const config = FORM_CONFIGS[category];
  const steps = totalSteps ?? config.totalSteps;
  const sections: PreviewSection[] = [];

  // Process each step
  for (let i = 1; i <= steps; i++) {
    const stepData = formData[`step${i}`];
    if (!stepData) continue;

    const fields: PreviewField[] = [];

    for (const [key, value] of Object.entries(stepData)) {
      if (shouldSkipField(key, value)) continue;

      fields.push({
        label: formatLabel(key),
        value: formatValue(key, value),
        type: getFieldType(key, value)
      });
    }

    if (fields.length > 0) {
      sections.push({
        title: config.stepLabels[i - 1],
        stepNumber: i,
        fields
      });
    }
  }

  return sections;
}

function shouldSkipField(key: string, value: unknown): boolean {
  // Skip empty values
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  
  // Skip internal fields
  if (key.endsWith('Other') && !value) return true;
  
  return false;
}

function formatLabel(key: string): string {
  // Convert camelCase to Title Case with spaces
  return key
    .replaceAll(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function formatValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    return formatArrayValue(value);
  }

  if (typeof value === 'object' && value !== null) {
    return formatObjectValue(value);
  }

  // Format dates
  if (key.toLowerCase().includes('date') && typeof value === 'string') {
    return formatDateValue(value);
  }

  return String(value);
}

function formatArrayValue(value: unknown[]): string {
  if (value.length === 0) return '-';
  
  // Handle array of objects (like equipment list)
  if (typeof value[0] === 'object') {
    return value.map((item, i) => {
      const itemData = item as Record<string, unknown>;
      const parts: string[] = [];
      for (const [k, v] of Object.entries(itemData)) {
        if (v) parts.push(`${formatLabel(k)}: ${formatValue(k, v)}`);
      }
      return `(${i + 1}) ${parts.join(', ')}`;
    }).join('\n');
  }
  
  return value.join(', ');
}

function formatObjectValue(value: object): string {
  // Handle File objects
  if ('name' in value && 'size' in value) {
    const file = value as { name: string; size: number };
    return `${file.name} (${formatFileSize(file.size)})`;
  }
  return JSON.stringify(value);
}

function formatDateValue(value: string): string {
  // Fall back to the raw value rather than an em-dash: this renders form data
  // back to the user, where showing what they typed beats showing nothing.
  return formatAppDate(value, value);
}

function getFieldType(_key: string, value: unknown): 'text' | 'list' | 'file' {
  if (Array.isArray(value) && value.length > 1) return 'list';
  if (typeof value === 'object' && value !== null && 'name' in value) return 'file';
  return 'text';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
