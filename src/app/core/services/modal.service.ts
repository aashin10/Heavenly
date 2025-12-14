import { Injectable, signal, Type } from '@angular/core';
import { Subject } from 'rxjs';

export interface ModalConfig<T = unknown> {
  component: Type<unknown>;
  data?: T;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export interface ModalRef<T = unknown> {
  id: string;
  config: ModalConfig<T>;
  close: (result?: unknown) => void;
  afterClosed: Subject<unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private readonly modalStack = signal<ModalRef[]>([]);
  private idCounter = 0;

  readonly modals = this.modalStack.asReadonly();

  open<T = unknown, R = unknown>(config: ModalConfig<T>): ModalRef<T> {
    const id = `modal-${++this.idCounter}`;
    const afterClosed = new Subject<R>();

    const modalRef: ModalRef<T> = {
      id,
      config: {
        closeOnBackdrop: true,
        closeOnEscape: true,
        size: 'md',
        ...config
      },
      close: (result?: unknown) => {
        this.closeModal(id);
        afterClosed.next(result as R);
        afterClosed.complete();
      },
      afterClosed: afterClosed as Subject<unknown>
    };

    this.modalStack.update(stack => [...stack, modalRef]);

    // Add escape key listener
    if (config.closeOnEscape !== false) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          modalRef.close();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    }

    return modalRef;
  }

  closeModal(id: string): void {
    this.modalStack.update(stack => stack.filter(m => m.id !== id));
  }

  closeAll(): void {
    const modals = this.modalStack();
    modals.forEach(m => {
      m.afterClosed.next(undefined);
      m.afterClosed.complete();
    });
    this.modalStack.set([]);
  }

  hasOpenModals(): boolean {
    return this.modalStack().length > 0;
  }
}
