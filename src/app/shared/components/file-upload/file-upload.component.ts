import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface UploadedFile {
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FileUploadComponent),
      multi: true
    }
  ],
  template: `
    <div class="file-upload-wrapper">
      <div 
        class="upload-zone"
        [class.dragover]="isDragging()"
        [class.has-files]="files().length > 0"
        (drop)="onDrop($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (click)="fileInput.click()"
        (keydown.enter)="fileInput.click()"
        (keydown.space)="fileInput.click()"
        tabindex="0"
        role="button"
        [attr.aria-label]="'Upload files. ' + helpText"
      >
        <div class="upload-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="upload-text">
          Drag & drop files here or <span class="browse-link">browse</span>
        </p>
        @if (helpText) {
          <p class="upload-hint">{{ helpText }}</p>
        }
        <p class="upload-limits">
          Max file size: {{ maxSize }}MB
          @if (accept !== '*') {
            • Accepted: {{ acceptLabel }}
          }
        </p>
      </div>

      <input 
        #fileInput 
        type="file" 
        [accept]="accept" 
        [multiple]="multiple"
        (change)="onFileSelected($event)"
        class="hidden-input"
      />

      @if (files().length > 0) {
        <ul class="file-list" role="list">
          @for (file of files(); track file.name; let i = $index) {
            <li class="file-item">
              <div class="file-info">
                <div class="file-icon">
                  @if (isImage(file)) {
                    <img [src]="file.preview" [alt]="file.name" class="file-preview" />
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  }
                </div>
                <div class="file-details">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-size">{{ formatFileSize(file.size) }}</span>
                </div>
              </div>
              <button 
                type="button" 
                class="remove-btn"
                (click)="removeFile(i); $event.stopPropagation()"
                aria-label="Remove file"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </li>
          }
        </ul>
      }

      @if (error()) {
        <div class="error-message" role="alert">
          {{ error() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .file-upload-wrapper {
      width: 100%;
    }

    .upload-zone {
      border: 2px dashed var(--gray-300);
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--gray-50);

      &:hover, &:focus {
        border-color: var(--primary-color);
        background: var(--blue-50);
        outline: none;
      }

      &.dragover {
        border-color: var(--primary-color);
        background: var(--blue-50);
        transform: scale(1.01);
      }

      &.has-files {
        padding: 1rem;
      }
    }

    .upload-icon {
      margin-bottom: 0.75rem;
      
      svg {
        width: 40px;
        height: 40px;
        color: var(--gray-400);
      }
    }

    .upload-text {
      font-size: 0.9375rem;
      color: var(--gray-600);
      margin-bottom: 0.25rem;

      .browse-link {
        color: var(--primary-color);
        font-weight: 500;
        text-decoration: underline;
      }
    }

    .upload-hint {
      font-size: 0.8125rem;
      color: var(--gray-500);
      margin-bottom: 0.25rem;
    }

    .upload-limits {
      font-size: 0.75rem;
      color: var(--gray-400);
    }

    .hidden-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .file-list {
      list-style: none;
      margin: 1rem 0 0;
      padding: 0;
    }

    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 6px;
      margin-bottom: 0.5rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .file-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-100);
      border-radius: 4px;
      flex-shrink: 0;

      svg {
        width: 20px;
        height: 20px;
        color: var(--gray-500);
      }
    }

    .file-preview {
      width: 36px;
      height: 36px;
      object-fit: cover;
      border-radius: 4px;
    }

    .file-details {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .file-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--gray-700);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      font-size: 0.75rem;
      color: var(--gray-500);
    }

    .remove-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: var(--gray-400);
      transition: all 0.2s ease;

      &:hover {
        background: var(--red-50);
        color: var(--red-500);
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }

    .error-message {
      margin-top: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--red-50);
      border: 1px solid var(--red-100);
      border-radius: 4px;
      color: var(--red-600);
      font-size: 0.8125rem;
    }
  `]
})
export class FileUploadComponent implements ControlValueAccessor {
  @Input() accept = '*';
  @Input() multiple = false;
  @Input() maxSize = 5; // MB
  @Input() helpText = '';

  files = signal<UploadedFile[]>([]);
  isDragging = signal(false);
  error = signal<string | null>(null);

  private onChange: (value: UploadedFile[]) => void = () => {};
  private onTouched: () => void = () => {};

  get acceptLabel(): string {
    if (this.accept === '*') return 'All files';
    return this.accept
      .split(',')
      .map(type => type.trim().replace('.', '').toUpperCase())
      .join(', ');
  }

  writeValue(value: UploadedFile[]): void {
    this.files.set(value || []);
  }

  registerOnChange(fn: (value: UploadedFile[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
    // Reset input to allow selecting the same file again
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  addFiles(newFiles: File[]): void {
    this.error.set(null);
    this.onTouched();

    const maxBytes = this.maxSize * 1024 * 1024;
    const validFiles: UploadedFile[] = [];

    for (const file of newFiles) {
      const processed = this.processFile(file, maxBytes);
      if (processed) {
        validFiles.push(processed);
      }
    }

    if (validFiles.length > 0) {
      this.updateFiles(validFiles);
    }
  }

  private processFile(file: File, maxBytes: number): UploadedFile | null {
    // Check file size
    if (file.size > maxBytes) {
      this.error.set(`File "${file.name}" exceeds the ${this.maxSize}MB size limit`);
      return null;
    }

    // Check file type if accept is specified
    if (this.accept !== '*' && !this.isAcceptedType(file)) {
      this.error.set(`File "${file.name}" is not an accepted file type`);
      return null;
    }

    const uploadedFile: UploadedFile = {
      file,
      name: file.name,
      size: file.size,
      type: file.type
    };

    // Create preview for images
    if (file.type.startsWith('image/')) {
      uploadedFile.preview = URL.createObjectURL(file);
    }

    return uploadedFile;
  }

  private updateFiles(validFiles: UploadedFile[]): void {
    if (this.multiple) {
      this.files.update(current => [...current, ...validFiles]);
    } else {
      // Revoke previous preview URL
      const current = this.files();
      if (current.length > 0 && current[0].preview) {
        URL.revokeObjectURL(current[0].preview);
      }
      this.files.set(validFiles.slice(0, 1));
    }
    this.onChange(this.files());
  }

  removeFile(index: number): void {
    const file = this.files()[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    this.files.update(current => current.filter((_, i) => i !== index));
    this.onChange(this.files());
    this.onTouched();
  }

  isImage(file: UploadedFile): boolean {
    return file.type.startsWith('image/');
  }

  isAcceptedType(file: File): boolean {
    const acceptedTypes = this.accept.split(',').map(t => t.trim().toLowerCase());
    const fileType = file.type.toLowerCase();
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    return acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileExtension === type;
      }
      if (type.endsWith('/*')) {
        return fileType.startsWith(type.replace('/*', '/'));
      }
      return fileType === type;
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
