import { Component, Input, forwardRef, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="star-rating" [class.disabled]="disabled" [class.readonly]="readonly">
      @for (star of stars; track star) {
        <span 
          class="star"
          [class.filled]="star <= rating"
          [class.hover]="star <= hoverRating && !readonly"
          (click)="!readonly && !disabled && setRating(star)"
          (mouseenter)="!readonly && !disabled && (hoverRating = star)"
          (mouseleave)="hoverRating = 0">
          {{ star <= (hoverRating || rating) ? '★' : '☆' }}
        </span>
      }
      @if (showValue) {
        <span class="rating-value">{{ rating }}/{{ maxStars }}</span>
      }
    </div>
  `,
  styles: [`
    .star-rating {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    
    .star {
      font-size: 24px;
      cursor: pointer;
      color: #d1d5db;
      transition: all 0.15s ease;
      user-select: none;
    }
    
    .star.filled,
    .star.hover {
      color: #f59e0b;
    }
    
    .star:hover {
      transform: scale(1.1);
    }
    
    .star-rating.readonly .star,
    .star-rating.disabled .star {
      cursor: default;
    }
    
    .star-rating.readonly .star:hover,
    .star-rating.disabled .star:hover {
      transform: none;
    }
    
    .star-rating.disabled {
      opacity: 0.5;
    }
    
    .rating-value {
      margin-left: 8px;
      font-size: 14px;
      color: var(--gray-500);
      font-weight: 500;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true
    }
  ]
})
export class StarRatingComponent implements ControlValueAccessor, OnInit {
  @Input() maxStars = 5;
  @Input() showValue = false;
  @Input() readonly = false;
  
  rating = 0;
  hoverRating = 0;
  disabled = false;
  
  stars: number[] = [];
  
  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};
  
  ngOnInit(): void {
    this.stars = Array.from({ length: this.maxStars }, (_, i) => i + 1);
  }
  
  setRating(value: number): void {
    this.rating = value;
    this.onChange(value);
    this.onTouched();
  }
  
  writeValue(value: number): void {
    this.rating = value || 0;
  }
  
  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
