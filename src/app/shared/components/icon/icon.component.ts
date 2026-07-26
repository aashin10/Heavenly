import { ChangeDetectionStrategy, Component, Input, isDevMode } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../icons/app-icons';

/** PascalCase keys of everything registered in APP_ICONS. */
const REGISTERED = new Set(Object.keys(APP_ICONS));

/** Shown when a name isn't registered, so a typo never blanks or breaks a page. */
const FALLBACK_ICON = 'circle-help';

/** "triangle-alert" / "triangle_alert" -> "TriangleAlert" (matches lucide's lookup). */
function toPascalCase(name: string): string {
  return name.replace(/(\w)([a-z0-9]*)(_|-|\s*)/g, (_, first: string, rest: string) =>
    first.toUpperCase() + rest.toLowerCase()
  );
}

/**
 * Thin wrapper over lucide-angular so the whole app references icons through a
 * single component with consistent defaults. Icons must be registered in
 * `APP_ICONS` (see shared/icons/app-icons.ts).
 *
 * Unregistered names are swapped for a fallback rather than passed through:
 * lucide throws on an unknown icon, which would take down the whole view for
 * what is usually a one-character typo in a config entry.
 *
 * Usage: <app-icon name="wrench" [size]="20" />
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lucide-icon
    [name]="resolvedName"
    [size]="size"
    [strokeWidth]="strokeWidth"
    [class]="'app-icon'"
    aria-hidden="true"
  />`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        color: currentColor;
      }
      .app-icon {
        display: block;
      }
    `,
  ],
})
export class IconComponent {
  /** Kebab-case lucide name registered in APP_ICONS, e.g. "triangle-alert". */
  @Input({ required: true })
  set name(value: string) {
    if (value && REGISTERED.has(toPascalCase(value))) {
      this.resolvedName = value;
      return;
    }

    if (isDevMode()) {
      console.warn(
        `[app-icon] "${value}" is not registered in APP_ICONS — falling back to ` +
          `"${FALLBACK_ICON}". Add it to shared/icons/app-icons.ts.`
      );
    }
    this.resolvedName = FALLBACK_ICON;
  }

  @Input() size = 20;
  @Input() strokeWidth = 2;

  protected resolvedName = FALLBACK_ICON;
}
