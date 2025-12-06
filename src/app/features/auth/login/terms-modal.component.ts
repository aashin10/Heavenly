import { Component, EventEmitter, Output } from '@angular/core';

interface TermsSection {
  title: string;
  content: string;
}

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  template: `
    <div class="modal-overlay" (click)="closeModal.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">Terms and Conditions</h2>
          <button class="close-button" (click)="closeModal.emit()" aria-label="Close modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          @for (section of termsSections; track section.title) {
            <section class="terms-section">
              <h3 class="section-title">{{ section.title }}</h3>
              <p class="section-content">{{ section.content }}</p>
            </section>
          }
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeModal.emit()">Cancel</button>
          <button class="btn-accept" (click)="accept.emit()">I Accept</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 1rem;
    }

    .modal-content {
      background-color: var(--white);
      border-radius: 0.5rem;
      max-width: 42rem;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid var(--gray-200);
    }

    .modal-title {
      font-size: 1.5rem;
      color: var(--primary-color);
      font-weight: 500;
    }

    .close-button {
      background: none;
      border: none;
      color: var(--gray-600);
      cursor: pointer;
      padding: 0.25rem;
      transition: color 0.2s;

      &:hover {
        color: var(--gray-700);
      }
    }

    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .terms-section {
      margin-bottom: 1rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .section-title {
      font-size: 1.125rem;
      color: var(--primary-color);
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .section-content {
      color: var(--gray-700);
      line-height: 1.6;
      margin: 0;
    }

    .modal-footer {
      display: flex;
      gap: 1rem;
      padding: 1.5rem;
      border-top: 1px solid var(--gray-200);
      background-color: var(--gray-50);
    }

    .btn-cancel,
    .btn-accept {
      flex: 1;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel {
      background-color: var(--white);
      border: 1px solid var(--gray-300);
      color: var(--gray-700);

      &:hover {
        background-color: var(--gray-100);
      }
    }

    .btn-accept {
      background-color: var(--primary-color);
      border: none;
      color: var(--white);

      &:hover {
        background-color: var(--primary-light);
      }
    }
  `]
})
export class TermsModalComponent {
  @Output() accept = new EventEmitter<void>();
  @Output() closeModal = new EventEmitter<void>();

  readonly termsSections: TermsSection[] = [
    {
      title: '1. Acceptance of Terms',
      content: 'By accessing and using the Heavenly Corporation platform, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our services.'
    },
    {
      title: '2. User Accounts',
      content: 'Users may register as either Employers or Job Seekers. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.'
    },
    {
      title: '3. Job Postings',
      content: 'All job postings submitted by employers are subject to approval by Heavenly Corporation management. We reserve the right to reject or remove any job posting that violates our policies or applicable laws.'
    },
    {
      title: '4. User Conduct',
      content: 'Users agree to provide accurate and truthful information. Any fraudulent activity, misrepresentation, or violation of our policies may result in account suspension or termination.'
    },
    {
      title: '5. Privacy and Data Protection',
      content: 'We are committed to protecting your privacy. Personal information collected will be used solely for the purpose of providing our services and will not be shared with third parties without your consent, except as required by law.'
    },
    {
      title: '6. Employer Responsibilities',
      content: 'Employers agree to post only legitimate job opportunities and to treat all applicants fairly and without discrimination. Job postings must comply with all applicable employment laws and regulations.'
    },
    {
      title: '7. Job Seeker Responsibilities',
      content: 'Job seekers agree to provide accurate information about their qualifications and experience. Any misrepresentation may result in disqualification from opportunities and account termination.'
    },
    {
      title: '8. Limitation of Liability',
      content: 'Heavenly Corporation serves as a platform connecting employers and job seekers. We are not responsible for the hiring decisions, employment relationships, or any disputes that may arise between parties.'
    },
    {
      title: '9. Modifications',
      content: 'We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the modified terms.'
    },
    {
      title: '10. Contact',
      content: 'For questions about these terms, please contact us at legal@heavenlycorp.com'
    }
  ];
}
