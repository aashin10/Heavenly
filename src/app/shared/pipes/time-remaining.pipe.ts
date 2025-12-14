import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeRemaining',
  standalone: true
})
export class TimeRemainingPipe implements PipeTransform {
  transform(dateString: string | Date): string {
    if (!dateString) return '';
    
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Closed';
    }
    
    return this.formatDuration(diffMs);
  }

  private formatDuration(diffMs: number): string {
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 7) {
      const weeks = Math.floor(diffDays / 7);
      return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    
    if (diffDays > 0) {
      return this.formatDays(diffDays, diffHours);
    }
    
    if (diffHours > 0) {
      const remainingMinutes = diffMinutes % 60;
      if (remainingMinutes > 0) {
        return `in ${diffHours}h ${remainingMinutes}m`;
      }
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
    
    if (diffMinutes > 0) {
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
    
    return 'Closing soon';
  }

  private formatDays(diffDays: number, diffHours: number): string {
    const remainingHours = diffHours % 24;
    if (remainingHours > 0) {
      return `in ${diffDays}d ${remainingHours}h`;
    }
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
}
