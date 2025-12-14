import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-conditional-field',
  standalone: true,
  template: `
    @if (show) {
      <div class="conditional-field" [class.animate]="animate">
        <ng-content></ng-content>
      </div>
    }
  `,
  styles: [`
    .conditional-field {
      &.animate {
        animation: fadeSlideIn 0.3s ease;
      }
    }

    @keyframes fadeSlideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class ConditionalFieldComponent {
  @Input() show = false;
  @Input() animate = true;
}
